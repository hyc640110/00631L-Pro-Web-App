const VERSION = '00631L-Pro-Web-App Worker v6.2';
const ALLOWED = ['00631L.TW', '0050.TW', '00865B.TW'];

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 's-maxage=30'
};

function symbolFromRequest(url) {
  const raw = String(url.searchParams.get('symbol') || '00631L').trim().toUpperCase();
  const symbol = raw.includes('.') ? raw : `${raw}.TW`;
  if (!ALLOWED.includes(symbol)) throw new Error(`unsupported symbol: ${symbol}`);
  return symbol;
}

function parseYahoo(symbol, data) {
  const result = data?.chart?.result?.[0];
  const meta = result?.meta || {};
  const q = result?.indicators?.quote?.[0] || {};
  const price = Number(meta.regularMarketPrice);
  const previousClose = Number(meta.previousClose || meta.chartPreviousClose || price);
  if (!Number.isFinite(price)) throw new Error(`empty price: ${symbol}`);
  return {
    ok: true,
    symbol,
    code: symbol.replace('.TW', ''),
    price,
    previousClose,
    change: price - previousClose,
    changePct: previousClose ? (price - previousClose) / previousClose * 100 : 0,
    volume: Number(meta.regularMarketVolume || 0),
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    history: (result?.timestamp || []).map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      close: q.close?.[i] ?? null
    })).filter(x => typeof x.close === 'number'),
    source: 'Yahoo Finance via Cloudflare Worker',
    workerVersion: VERSION,
    updatedAt: new Date().toISOString()
  };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, version: VERSION }), { headers });
    }
    try {
      const symbol = symbolFromRequest(url);
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
      const res = await fetch(yahooUrl, { headers: { 'user-agent': VERSION } });
      if (!res.ok) throw new Error(`Yahoo status ${res.status}`);
      return new Response(JSON.stringify(parseYahoo(symbol, await res.json())), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ ok: false, error: String(error?.message || error), version: VERSION }), { status: 500, headers });
    }
  }
};
