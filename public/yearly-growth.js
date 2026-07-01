(() => {
  const STORAGE_KEYS = ['00631l-pro-v62-state', '00631l-pro-v61-state'];
  const money = (n) => Number(n || 0).toLocaleString('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
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

  function findNetWorthFromStats() {
    const stats = Array.from(document.querySelectorAll('.stat'));
    const net = stats.find((el) => el.querySelector('small')?.textContent?.trim() === '淨資產');
    return parseMoney(net?.querySelector('b')?.textContent || '0');
  }

  function buildYearRows(start, state) {
    const years = Math.min(10, Math.max(1, num(state.simYears || 10)));
    const monthlyContribution = num(state.monthlyContribution || 0);
    const annualReturn = (num(state.simCagr || 0) + num(state.simDividend || 0)) / 100;
    const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
    let value = start;
    const rows = [];
    for (let month = 1; month <= years * 12; month++) {
      value = value * (1 + monthlyReturn) + monthlyContribution;
      if (month % 12 === 0) {
        const year = month / 12;
        const gain = start ? ((value - start) / start) * 100 : 0;
        rows.push({ year, value, gain });
      }
    }
    return rows;
  }

  function injectStyle() {
    if (document.getElementById('yearly-growth-style')) return;
    const style = document.createElement('style');
    style.id = 'yearly-growth-style';
    style.textContent = `
      .year-projection{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
      .year-projection div{background:#09182a;border:1px solid #1d3d66;border-radius:12px;padding:10px;display:flex;justify-content:space-between;gap:8px;align-items:center}
      .year-projection span{color:#9fb3c8;font-size:13px;white-space:nowrap}
      .year-projection b{color:#ff7b7b;font-size:14px;text-align:right}
      .year-projection small{color:#69f0a6;display:block;font-size:12px;margin-top:2px;text-align:right}
      @media(max-width:900px){.year-projection{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function updateYearlyGrowth() {
    injectStyle();
    const card = Array.from(document.querySelectorAll('.card')).find((el) => el.querySelector('h2')?.textContent?.includes('十年成長曲線'));
    if (!card) return;
    const state = readState();
    const start = findNetWorthFromStats();
    if (!start) return;
    const rows = buildYearRows(start, state);
    let box = card.querySelector('.year-projection');
    if (!box) {
      box = document.createElement('div');
      box.className = 'year-projection';
      card.appendChild(box);
    }
    box.innerHTML = rows.map((r) => `
      <div>
        <span>第 ${r.year} 年</span>
        <b>${money(r.value)}<small>約 +${r.gain.toFixed(1)}%</small></b>
      </div>
    `).join('');
  }

  const schedule = () => window.requestAnimationFrame(updateYearlyGrowth);
  window.addEventListener('load', schedule);
  window.addEventListener('storage', schedule);
  setInterval(updateYearlyGrowth, 1500);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
