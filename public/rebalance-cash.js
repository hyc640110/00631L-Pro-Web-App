(() => {
  const STORAGE_KEYS = ['00631l-pro-v62-state', '00631l-pro-v61-state'];
  const SYMBOLS = ['00631L', '0050', '00865B'];
  const defaultPrices = { '00631L': 38.42, '0050': 107.8, '00865B': 48.52 };
  const money = (n) => Number(n || 0).toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
  const pct = (n) => `${Number(n || 0).toFixed(2)}%`;
  const num = (n) => Number.isFinite(Number(n)) ? Number(n) : 0;

  function readState() {
    for (const key of STORAGE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
    }
    return {};
  }

  function parseMoney(text) {
    const cleaned = String(text || '').replace(/[,$NT\s]/g, '').replace(/[^-\d.]/g, '');
    return Number(cleaned) || 0;
  }

  function parsePriceFromHolding(symbol) {
    const card = Array.from(document.querySelectorAll('.holding')).find((el) => el.textContent?.includes(symbol));
    if (!card) return defaultPrices[symbol] || 0;
    const text = card.textContent || '';
    const match = text.match(/現價[^\d]*(\d+(?:\.\d+)?)/) || text.match(/價格[^\d]*(\d+(?:\.\d+)?)/) || text.match(/NT\$\s*(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : (defaultPrices[symbol] || 0);
  }

  function getCurrentSharesFromDom(symbol) {
    const card = Array.from(document.querySelectorAll('.holding')).find((el) => el.textContent?.includes(symbol));
    if (!card) return null;
    const text = card.textContent || '';
    const match = text.match(/目前股數[^\d]*(\d[\d,]*)/);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }

  function derivedHoldings(state) {
    const base = Array.isArray(state.holdings) ? state.holdings : [];
    return base.map((h) => ({ ...h }));
  }

  function cashAmount(state) {
    return Array.isArray(state.cash) ? state.cash.reduce((sum, x) => sum + num(x.amount), 0) : 0;
  }

  function buildRows() {
    const state = readState();
    const holdings = derivedHoldings(state);
    const rows = SYMBOLS.map((symbol) => {
      const h = holdings.find((x) => x.symbol === symbol) || { symbol, shares: 0, targetWeight: 0 };
      const domShares = getCurrentSharesFromDom(symbol);
      const shares = domShares ?? num(h.shares);
      const price = parsePriceFromHolding(symbol);
      const value = shares * price;
      return { symbol, shares, price, value, target: num(h.targetWeight) };
    });
    const cash = cashAmount(state);
    const total = rows.reduce((sum, r) => sum + r.value, 0) + cash;
    const stockTarget = rows.reduce((sum, r) => sum + r.target, 0);
    const cashTarget = Math.max(0, 100 - stockTarget);
    const normalizedTotalTarget = stockTarget + cashTarget;
    const withCash = [
      ...rows.map((r) => ({ ...r, current: total ? (r.value / total) * 100 : 0, targetValue: total * r.target / 100, diff: total * r.target / 100 - r.value })),
      { symbol: '現金', shares: 0, price: 1, value: cash, target: cashTarget, current: total ? (cash / total) * 100 : 0, targetValue: total * cashTarget / 100, diff: total * cashTarget / 100 - cash }
    ];
    return { total, stockTarget, cashTarget, normalizedTotalTarget, rows: withCash };
  }

  function advice(row) {
    const diff = row.diff;
    if (Math.abs(diff) < 1000) return { text: '維持', cls: 'hold' };
    if (row.symbol === '現金') {
      return diff > 0 ? { text: `建議保留 / 增加現金 ${money(diff)}`, cls: 'buy' } : { text: `可動用現金 ${money(Math.abs(diff))}`, cls: 'sell' };
    }
    return diff > 0 ? { text: `建議買進 ${money(diff)}`, cls: 'buy' } : { text: `建議減碼 ${money(Math.abs(diff))}`, cls: 'sell' };
  }

  function injectStyle() {
    if (document.getElementById('rebalance-cash-style')) return;
    const style = document.createElement('style');
    style.id = 'rebalance-cash-style';
    style.textContent = `
      .cash-rebalance{margin-top:14px;background:#09182a;border:1px solid #38bdf866;border-radius:16px;padding:14px;display:grid;gap:12px}
      .cash-rebalance h3{margin:0;color:#eaf3ff;font-size:16px}
      .cash-rebalance-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .cash-rebalance-summary div{background:#102033;border:1px solid #1d3d66;border-radius:12px;padding:10px;color:#dbeafe}
      .cash-rebalance-summary small{display:block;color:#9fb3c8;margin-bottom:4px}.cash-rebalance-summary b{color:#facc15}
      .cash-rebalance-table{display:grid;gap:8px}.cash-rebalance-row{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr 1.7fr;gap:8px;align-items:center;background:#102033;border-radius:12px;padding:10px;color:#dbeafe}
      .cash-rebalance-row.head{background:#0f2f4f;color:#93c5fd;font-weight:900}.cash-rebalance-row b{color:#eaf3ff}.cash-rebalance-row .buy{color:#69f0a6;font-weight:900}.cash-rebalance-row .sell{color:#ffb86b;font-weight:900}.cash-rebalance-row .hold{color:#9fb3c8;font-weight:900}
      .cash-rebalance-note{color:#9fb3c8;line-height:1.6;margin:0}
      @media(max-width:900px){.cash-rebalance-summary{grid-template-columns:1fr}.cash-rebalance-row{grid-template-columns:1fr 1fr}.cash-rebalance-row.head{display:none}.cash-rebalance-row span::before{display:block;color:#93c5fd;font-size:12px;margin-bottom:2px}.cash-rebalance-row span:nth-child(1)::before{content:'項目'}.cash-rebalance-row span:nth-child(2)::before{content:'目前'}.cash-rebalance-row span:nth-child(3)::before{content:'目標'}.cash-rebalance-row span:nth-child(4)::before{content:'差額'}.cash-rebalance-row span:nth-child(5)::before{content:'建議'}}
    `;
    document.head.appendChild(style);
  }

  function findRebalanceCard() {
    return Array.from(document.querySelectorAll('.card')).find((el) => el.querySelector('h2')?.textContent?.includes('再平衡'));
  }

  function render() {
    injectStyle();
    const card = findRebalanceCard();
    if (!card) return;
    const data = buildRows();
    let box = card.querySelector('.cash-rebalance');
    if (!box) {
      box = document.createElement('div');
      box.className = 'cash-rebalance';
      card.appendChild(box);
    }
    box.innerHTML = `
      <h3>含現金再平衡建議</h3>
      <div class="cash-rebalance-summary">
        <div><small>股票目標合計</small><b>${pct(data.stockTarget)}</b></div>
        <div><small>現金目標</small><b>${pct(data.cashTarget)}</b></div>
        <div><small>總目標配置</small><b>${pct(data.normalizedTotalTarget)}</b></div>
      </div>
      <div class="cash-rebalance-table">
        <div class="cash-rebalance-row head"><span>項目</span><span>目前比例</span><span>目標比例</span><span>差額</span><span>建議</span></div>
        ${data.rows.map((row) => {
          const a = advice(row);
          return `<div class="cash-rebalance-row"><span><b>${row.symbol}</b></span><span>${pct(row.current)}</span><span>${pct(row.target)}</span><span>${money(row.diff)}</span><span class="${a.cls}">${a.text}</span></div>`;
        }).join('')}
      </div>
      <p class="cash-rebalance-note">計算方式：00631L、0050、00865B 與現金合計 100%。若股票目標合計為 ${pct(data.stockTarget)}，現金目標會自動補成 ${pct(data.cashTarget)}。</p>
    `;
  }

  window.addEventListener('load', render);
  window.addEventListener('storage', render);
  setInterval(render, 2000);
  new MutationObserver(() => requestAnimationFrame(render)).observe(document.documentElement, { childList: true, subtree: true });
})();
