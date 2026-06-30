
import { useEffect, useMemo, useState } from 'react';

type SymbolCode = '00631L' | '0050' | '00865B';
type TradeAction = 'BUY' | 'SELL' | 'DIVIDEND';
type Quote = { symbol: SymbolCode; name: string; price: number; previousClose: number; change: number; changePct: number; volume: number; source: string; updatedAt: string };
type Holding = { symbol: SymbolCode; shares: number; avgCost: number; targetWeight: number };
type CashItem = { id: string; name: string; amount: number; note: string };
type LoanItem = { id: string; name: string; principal: number; annualRate: number; monthlyPayment: number; startDate: string };
type Trade = { id: string; date: string; symbol: SymbolCode; action: TradeAction; shares: number; price: number; fee: number; tax: number; note: string };
type FirebaseConfig = { databaseURL: string; secretPath: string };
type AppState = { holdings: Holding[]; cash: CashItem[]; loans: LoanItem[]; trades: Trade[]; monthlyContribution: number; simCagr: number; simDividend: number; simYears: number; refreshSec: number; firebase: FirebaseConfig; workerUrl: string };

const STORAGE_KEY = '00631l-pro-v61-state';
const SYMBOLS: SymbolCode[] = ['00631L','0050','00865B'];
const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();
const money = (n: number) => n.toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
const num = (n: number) => Number.isFinite(n) ? n : 0;
const pct = (n: number) => `${num(n).toFixed(2)}%`;
const tw = (iso: string) => new Date(iso).toLocaleString('zh-TW');

const defaultQuotes: Record<SymbolCode, Quote> = {
  '00631L': { symbol:'00631L', name:'元大台灣50正2', price:38.42, previousClose:37.61, change:0.81, changePct:2.15, volume:28455, source:'內建備援', updatedAt: now() },
  '0050': { symbol:'0050', name:'元大台灣50', price:107.8, previousClose:106.75, change:1.05, changePct:0.98, volume:53123, source:'內建備援', updatedAt: now() },
  '00865B': { symbol:'00865B', name:'國泰US短期公債', price:48.52, previousClose:48.41, change:0.11, changePct:0.23, volume:9140, source:'內建備援', updatedAt: now() }
};

const defaultState: AppState = {
  holdings: [
    { symbol:'00631L', shares:1000, avgCost:36.8, targetWeight:50 },
    { symbol:'0050', shares:200, avgCost:104.7, targetWeight:20 },
    { symbol:'00865B', shares:500, avgCost:31.5, targetWeight:20 }
  ],
  cash: [{ id:uid(), name:'高利活存 / 預備金', amount:50000, note:'逢低加碼資金' }],
  loans: [{ id:uid(), name:'信貸', principal:0, annualRate:6.5, monthlyPayment:10000, startDate:new Date().toISOString().slice(0,10) }],
  trades: [], monthlyContribution:5000, simCagr:10, simDividend:2, simYears:10, refreshSec:60,
  firebase: { databaseURL:'', secretPath:'00631l-pro-v61' }, workerUrl:''
};

function readState(): AppState { try { return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return defaultState; } }
function writeState(s: AppState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function parseWorkerQuote(symbol: SymbolCode, data: any): Quote | null {
  if (typeof data?.price === 'number') {
    const prev = Number(data.previousClose ?? data.prev ?? data.price);
    return { ...defaultQuotes[symbol], price:data.price, previousClose:prev, change:data.price-prev, changePct: prev ? (data.price-prev)/prev*100 : 0, volume:Number(data.volume ?? 0), source:data.source ?? 'Cloudflare Worker', updatedAt: now() };
  }
  const meta = data?.chart?.result?.[0]?.meta;
  if (meta?.regularMarketPrice) {
    const p = Number(meta.regularMarketPrice); const prev = Number(meta.previousClose || meta.chartPreviousClose || p);
    return { ...defaultQuotes[symbol], price:p, previousClose:prev, change:p-prev, changePct: prev ? (p-prev)/prev*100 : 0, volume:Number(meta.regularMarketVolume || 0), source:'Yahoo via Worker', updatedAt: now() };
  }
  return null;
}

async function fetchQuote(symbol: SymbolCode, workerUrl: string): Promise<Quote> {
  const base = workerUrl.trim();
  const urls = base ? [`${base}${base.includes('?') ? '&' : '?'}symbol=${encodeURIComponent(symbol + '.TW')}`] : [];
  // Direct Yahoo often fails by CORS in browsers. It is kept as a best-effort fallback for local testing.
  urls.push(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol + '.TW')}?range=5d&interval=1d`);
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache:'no-store' });
      if (!res.ok) continue;
      const q = parseWorkerQuote(symbol, await res.json());
      if (q) return q;
    } catch {}
  }
  return { ...defaultQuotes[symbol], source:'離線備援 / API 未連線', updatedAt: now() };
}

async function syncFirebase(config: FirebaseConfig, state?: AppState): Promise<AppState | null> {
  if (!config.databaseURL) return null;
  const base = config.databaseURL.replace(/\/$/, '');
  const path = encodeURIComponent(config.secretPath || '00631l-pro-v61');
  const url = `${base}/portfolio/${path}.json`;
  if (state) { await fetch(url, { method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(state) }); return null; }
  const res = await fetch(url); if (!res.ok) throw new Error(`Firebase ${res.status}`);
  return await res.json();
}

function calculateMetrics(state: AppState, quotes: Record<SymbolCode, Quote>) {
  const rows = state.holdings.map(h => { const q = quotes[h.symbol]; const marketValue = h.shares*q.price; const cost = h.shares*h.avgCost; const pnl=marketValue-cost; const dayPnl=h.shares*q.change; return {...h, quote:q, marketValue, cost, pnl, dayPnl}; });
  const stocks = rows.reduce((a,r)=>a+r.marketValue,0); const cash = state.cash.reduce((a,c)=>a+num(c.amount),0); const debt=state.loans.reduce((a,l)=>a+num(l.principal),0);
  const totalAssets=stocks+cash; const netWorth=totalAssets-debt; const dayPnl=rows.reduce((a,r)=>a+r.dayPnl,0);
  const beta = rows.reduce((a,r)=>a + (r.symbol==='00631L'?2:r.symbol==='0050'?1:0.05)*(totalAssets?r.marketValue/totalAssets:0),0);
  const cashRatio = totalAssets ? cash/totalAssets*100 : 0; const leverage = netWorth>0 ? totalAssets/netWorth : 0;
  const realized = state.trades.reduce((a,t)=>a+(t.action==='DIVIDEND'?t.price:0),0);
  return { rows, stocks, cash, debt, totalAssets, netWorth, dayPnl, beta, cashRatio, leverage, realized };
}
function rebalance(state: AppState, quotes: Record<SymbolCode, Quote>) { const m=calculateMetrics(state,quotes); return m.rows.map(r=>{ const target=m.totalAssets*(r.targetWeight/100); const diff=target-r.marketValue; return {symbol:r.symbol,currentWeight:m.totalAssets?r.marketValue/m.totalAssets*100:0,targetWeight:r.targetWeight,diff,shares:Math.round(diff/r.quote.price)}; }); }
function advice(m: ReturnType<typeof calculateMetrics>) { if(m.cashRatio<8 || m.leverage>1.6) return ['風險降溫','現金水位偏低或槓桿偏高，先補現金或降低借款。','bad']; if(m.dayPnl< -m.stocks*.05) return ['小跌加碼','可分批補足低於目標權重的部位，避免一次打滿。','warn']; return ['正常投入','維持定期投入與目標配置；若現金過高，分批投入。','good']; }
function simSeries(state: AppState, start: number) { const months=state.simYears*12; const r=Math.pow(1+(state.simCagr+state.simDividend)/100,1/12)-1; let v=start; return Array.from({length:months+1},(_,i)=>{ if(i>0) v=v*(1+r)+state.monthlyContribution; return {month:i,value:v}; }); }
function maxDrawdown(points:{value:number}[]) { let peak=points[0]?.value||0, mdd=0; points.forEach(p=>{ peak=Math.max(peak,p.value); if(peak) mdd=Math.max(mdd,(peak-p.value)/peak*100); }); return mdd; }

function Donut({ m }: { m: ReturnType<typeof calculateMetrics> }) {
  const parts = [...m.rows.map(r=>({label:r.symbol,value:r.marketValue})), {label:'現金', value:m.cash}];
  const sum = Math.max(1, parts.reduce((a,p)=>a+p.value,0)); let acc=0;
  const colors=['#60a5fa','#34d399','#facc15','#a78bfa'];
  return <svg viewBox="0 0 42 42" className="donut">{parts.map((p,i)=>{ const len=p.value/sum*100; const dash=`${len} ${100-len}`; const off=25-acc; acc+=len; return <circle key={p.label} cx="21" cy="21" r="15.9" fill="transparent" stroke={colors[i]} strokeWidth="6" strokeDasharray={dash} strokeDashoffset={off}/>; })}<circle cx="21" cy="21" r="9" fill="#0b1729"/></svg>;
}
function Growth({ points }: { points:{month:number,value:number}[] }) { const max=Math.max(...points.map(p=>p.value),1); const path=points.map((p,i)=>`${i?'L':'M'} ${20+i*(260/(points.length-1))} ${140-(p.value/max*110)}`).join(' '); return <svg viewBox="0 0 300 160" className="growth"><path d={path} fill="none" stroke="#60a5fa" strokeWidth="4"/><text x="20" y="150">$0</text><text x="210" y="28">{money(points.at(-1)?.value||0)}</text></svg>; }
function Stat({label,value,tone}:{label:string;value:string;tone?:string}){return <div className="stat"><small>{label}</small><b className={tone||''}>{value}</b></div>}
function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="card"><h2>{title}</h2>{children}</section>}

function App(){
  const [tab,setTab]=useState<'dashboard'|'trades'|'sync'>('dashboard');
  const [state,setState]=useState<AppState>(()=>readState());
  const [quotes,setQuotes]=useState<Record<SymbolCode,Quote>>(defaultQuotes);
  const [sync,setSync]=useState('尚未同步');
  const [draft,setDraft]=useState<Trade>({id:uid(),date:new Date().toISOString().slice(0,10),symbol:'00631L',action:'BUY',shares:1,price:defaultQuotes['00631L'].price,fee:20,tax:0,note:''});
  useEffect(()=>writeState(state),[state]);
  const refreshQuotes=async()=>{ const entries=await Promise.all(SYMBOLS.map(async s=>[s,await fetchQuote(s,state.workerUrl)] as const)); setQuotes(Object.fromEntries(entries) as Record<SymbolCode,Quote>); };
  useEffect(()=>{ refreshQuotes(); const id=setInterval(refreshQuotes, Math.max(15,state.refreshSec)*1000); return()=>clearInterval(id); },[state.workerUrl,state.refreshSec]);
  const m=useMemo(()=>calculateMetrics(state,quotes),[state,quotes]); const rb=useMemo(()=>rebalance(state,quotes),[state,quotes]); const [mode,hint,tone]=advice(m); const sim=simSeries(state,m.netWorth);
  const updateHolding=(symbol:SymbolCode,key:keyof Holding,value:number)=>setState(s=>({...s,holdings:s.holdings.map(h=>h.symbol===symbol?{...h,[key]:value}:h)}));
  const addTrade=()=>{ setState(s=>({...s,trades:[draft,...s.trades]})); setDraft({...draft,id:uid()}); };
  const applyTrade=(t:Trade)=>{ setState(s=>{ const holdings=s.holdings.map(h=>{ if(h.symbol!==t.symbol) return h; if(t.action==='BUY'){ const totalCost=h.shares*h.avgCost + t.shares*t.price + t.fee; const shares=h.shares+t.shares; return {...h,shares,avgCost:shares?totalCost/shares:h.avgCost}; } if(t.action==='SELL'){ return {...h,shares:Math.max(0,h.shares-t.shares)}; } return h; }); return {...s,holdings,trades:[t,...s.trades]}; }); };
  const backup=()=>{ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`00631l-pro-v61-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); };
  const restore=async(f?:File)=>{ if(!f)return; setState(JSON.parse(await f.text())); };
  return <main>
    <header className="hero"><div><p className="eyebrow">00631L PRO WEB APP V6.1 ULTIMATE</p><h1>台股槓桿配置儀表板</h1><p>即時股價、交易紀錄、Firebase 雲端同步、再平衡、四部位策略、十年模擬與 PWA。</p></div><button onClick={refreshQuotes}>更新股價</button></header>
    <nav className="tabs"><button className={tab==='dashboard'?'active':''} onClick={()=>setTab('dashboard')}>儀表板</button><button className={tab==='trades'?'active':''} onClick={()=>setTab('trades')}>交易紀錄</button><button className={tab==='sync'?'active':''} onClick={()=>setTab('sync')}>同步設定</button><span>股價更新 {tw(Object.values(quotes)[0].updatedAt)}</span></nav>
    {tab==='dashboard' && <>
      <section className="grid stats"><Stat label="總資產" value={money(m.totalAssets)}/><Stat label="今日損益" value={money(m.dayPnl)} tone={m.dayPnl>=0?'up':'down'}/><Stat label="淨資產" value={money(m.netWorth)}/><Stat label="借款" value={money(m.debt)} tone="warn"/><Stat label="Beta" value={m.beta.toFixed(2)}/><Stat label="現金比例" value={pct(m.cashRatio)}/><Stat label="槓桿比例" value={m.leverage.toFixed(2)+'x'}/><Stat label="策略模式" value={mode} tone={tone}/></section>
      <Card title="AI 分析與加碼建議"><h3>{mode}</h3><p>{hint}</p><p>Beta {m.beta.toFixed(2)}、現金 {pct(m.cashRatio)}、槓桿 {m.leverage.toFixed(2)}x。00631L 若偏離目標超過 5%，優先依再平衡建議處理。</p><small>資料來源：{Object.values(quotes).map(q=>`${q.symbol}=${q.source}`).join(' / ')}</small></Card>
      <Card title="持股配置"><div className="holdings">{m.rows.map(r=><article className="holding" key={r.symbol}><h3>{r.symbol}</h3><p>{r.quote.name}</p><p>來源：{r.quote.source}｜更新：{tw(r.quote.updatedAt)}</p><div className="quote"><b>{r.quote.price.toFixed(2)}</b><span className={r.quote.change>=0?'up':'down'}>{r.quote.change.toFixed(2)} / {pct(r.quote.changePct)}</span></div><label>股數<input type="number" value={r.shares} onChange={e=>updateHolding(r.symbol,'shares',num(e.target.valueAsNumber))}/></label><label>成本<input type="number" value={r.avgCost} onChange={e=>updateHolding(r.symbol,'avgCost',num(e.target.valueAsNumber))}/></label><label>目標配置 %<input type="number" value={r.targetWeight} onChange={e=>updateHolding(r.symbol,'targetWeight',num(e.target.valueAsNumber))}/></label><strong>市值 {money(r.marketValue)}</strong><strong>損益 {money(r.pnl)} / {pct(r.cost? r.pnl/r.cost*100:0)}</strong></article>)}</div></Card>
      <div className="two"><Card title="資產配置"><Donut m={m}/></Card><Card title="十年成長曲線"><Growth points={sim}/><p>預估終值 {money(sim.at(-1)?.value||0)}｜MDD {pct(maxDrawdown(sim))}</p></Card></div>
      <Card title="再平衡建議"><div className="table">{rb.map(r=><div className="row" key={r.symbol}><span>{r.symbol}</span><span>目前 {pct(r.currentWeight)}</span><span>目標 {pct(r.targetWeight)}</span><b className={r.diff>=0?'up':'down'}>{r.diff>=0?'買進':'賣出'} {Math.abs(r.shares)} 股（{money(Math.abs(r.diff))}）</b></div>)}</div></Card>
      <div className="two"><Card title="現金管理"><EditableList items={state.cash} setItems={items=>setState(s=>({...s,cash:items}))} fields={[['name','名稱'],['amount','金額'],['note','備註']]}/></Card><Card title="借款管理"><EditableList items={state.loans} setItems={items=>setState(s=>({...s,loans:items}))} fields={[['name','名稱'],['principal','本金'],['annualRate','利率%'],['monthlyPayment','月付金'],['startDate','起始日']]}/></Card></div>
      <Card title="模擬參數與風險圖"><div className="params"><label>每月投入<input type="number" value={state.monthlyContribution} onChange={e=>setState(s=>({...s,monthlyContribution:num(e.target.valueAsNumber)}))}/></label><label>CAGR %<input type="number" value={state.simCagr} onChange={e=>setState(s=>({...s,simCagr:num(e.target.valueAsNumber)}))}/></label><label>股利 %<input type="number" value={state.simDividend} onChange={e=>setState(s=>({...s,simDividend:num(e.target.valueAsNumber)}))}/></label><label>年數<input type="number" value={state.simYears} onChange={e=>setState(s=>({...s,simYears:num(e.target.valueAsNumber)}))}/></label></div><div className="bars"><Risk label="現金%" value={m.cashRatio}/><Risk label="Beta" value={m.beta*50}/><Risk label="槓桿" value={m.leverage*50}/></div></Card>
    </>}
    {tab==='trades' && <Card title="交易紀錄"><div className="trade-form"><input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/><select value={draft.symbol} onChange={e=>setDraft({...draft,symbol:e.target.value as SymbolCode})}>{SYMBOLS.map(s=><option key={s}>{s}</option>)}</select><select value={draft.action} onChange={e=>setDraft({...draft,action:e.target.value as TradeAction})}><option value="BUY">買進</option><option value="SELL">賣出</option><option value="DIVIDEND">配息</option></select><input type="number" value={draft.shares} onChange={e=>setDraft({...draft,shares:num(e.target.valueAsNumber)})}/><input type="number" value={draft.price} onChange={e=>setDraft({...draft,price:num(e.target.valueAsNumber)})}/><input placeholder="備註" value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/><button onClick={()=>applyTrade(draft)}>新增並套用</button><button onClick={addTrade}>只新增紀錄</button></div><div className="table">{state.trades.map(t=><div className="row" key={t.id}><span>{t.date}</span><span>{t.symbol}</span><span>{t.action}</span><span>{t.shares} 股</span><b>{money(t.price*t.shares+t.fee+t.tax)}</b><button onClick={()=>setState(s=>({...s,trades:s.trades.filter(x=>x.id!==t.id)}))}>刪除</button></div>)}</div></Card>}
    {tab==='sync' && <Card title="Firebase / 備份 / 還原"><div className="params"><input placeholder="Firebase Realtime Database URL" value={state.firebase.databaseURL} onChange={e=>setState(s=>({...s,firebase:{...s.firebase,databaseURL:e.target.value}}))}/><input placeholder="自訂個人密鑰" value={state.firebase.secretPath} onChange={e=>setState(s=>({...s,firebase:{...s.firebase,secretPath:e.target.value}}))}/><input placeholder="Cloudflare Worker URL" value={state.workerUrl} onChange={e=>setState(s=>({...s,workerUrl:e.target.value}))}/><input type="number" value={state.refreshSec} onChange={e=>setState(s=>({...s,refreshSec:num(e.target.valueAsNumber)}))}/></div><div className="actions"><button onClick={()=>syncFirebase(state.firebase,state).then(()=>setSync('已上傳 '+tw(now()))).catch(e=>setSync('上傳失敗 '+e.message))}>上傳雲端</button><button onClick={()=>syncFirebase(state.firebase).then(s=>{if(s)setState(s);setSync('已下載 '+tw(now()))}).catch(e=>setSync('下載失敗 '+e.message))}>下載雲端</button><button onClick={backup}>備份 JSON</button><label className="file">還原 JSON<input type="file" accept="application/json" onChange={e=>restore(e.target.files?.[0])}/></label><button onClick={()=>setState(defaultState)}>重設</button></div><p>{sync}</p><p className="note">若瀏覽器顯示「離線備援 / API 未連線」，請部署 worker/index.js 到 Cloudflare Worker，並把網址填到 Cloudflare Worker URL。</p></Card>}
  </main>
}
function Risk({label,value}:{label:string;value:number}){return <div className="risk"><span>{label}</span><div><i style={{width:`${Math.max(2,Math.min(100,value))}%`}}/></div><b>{(label==='Beta'||label==='槓桿'?value/50:value).toFixed(2)}</b></div>}
function EditableList<T extends {id:string} & Record<string,any>>({items,setItems,fields}:{items:T[];setItems:(v:T[])=>void;fields:[string,string][]}){return <div className="list">{items.map(item=><div className="list-row" key={item.id}>{fields.map(([k,l])=><label key={k}>{l}<input type={typeof item[k]==='number'?'number':'text'} value={item[k]} onChange={e=>setItems(items.map(x=>x.id===item.id?{...x,[k]:typeof item[k]==='number'?num(e.target.valueAsNumber):e.target.value}:x))}/></label>)}<button onClick={()=>setItems(items.filter(x=>x.id!==item.id))}>刪除</button></div>)}<button onClick={()=>setItems([...items,{id:uid(),...Object.fromEntries(fields.map(([k])=>[k,k.toLowerCase().includes('date')?new Date().toISOString().slice(0,10):k==='amount'||k==='principal'||k==='annualRate'||k==='monthlyPayment'?0:'' ]))} as T])}>新增</button></div>}
export default App;
