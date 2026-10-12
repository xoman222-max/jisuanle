/* 統一發票對獎、電費試算、請假扣薪試算（台灣） */
(function (root) {
  function fmt(n, d) { return Number(n).toLocaleString('zh-TW', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function kv(pairs) { return '<div class="kv">' + pairs.map(function (p) { return '<div>' + p[0] + '</div><div>' + p[1] + '</div>'; }).join('') + '</div>'; }
  function big(label, val) { return '<div>' + label + '</div><div class="big">' + val + '</div>'; }

  /* ---------- 統一發票 ---------- */
  var PRIZES = [['特別獎', 10000000], ['特獎', 2000000], ['頭獎', 200000], ['二獎', 40000], ['三獎', 10000], ['四獎', 4000], ['五獎', 1000], ['六獎', 200]];
  function checkInvoice(num, p) {
    if (p.special.indexOf(num) >= 0) return PRIZES[0];
    if (p.grand.indexOf(num) >= 0) return PRIZES[1];
    for (var k = 8; k >= 3; k--) for (var i = 0; i < p.first.length; i++) if (num.slice(-k) === p.first[i].slice(-k)) return PRIZES[2 + (8 - k)];
    if ((p.extra6 || []).indexOf(num.slice(-3)) >= 0) return ['增開六獎', 200];
    return null;
  }
  function parseNums(text) { return (String(text).toUpperCase().match(/(?:[A-Z]{2}[-\s]?)?\d{8}/g) || []).map(function (s) { return s.slice(-8); }); }

  /* ---------- 電費（台電表燈非時間電價・住宅用，114/10/1 起實施） ---------- */
  var TIERS = [120, 330, 500, 700, 1000, Infinity];
  var RATE = { summer: [1.78, 2.55, 3.80, 5.14, 6.44, 8.86], non: [1.78, 2.26, 3.13, 4.24, 5.27, 7.03] };
  function power(kwh, months, summer) {
    var r = RATE[summer ? 'summer' : 'non'], prev = 0, total = 0, rows = [];
    for (var i = 0; i < TIERS.length; i++) {
      var cap = TIERS[i] * months, use = Math.max(0, Math.min(kwh, cap) - prev);
      if (use > 0) { total += use * r[i]; rows.push([prev + 1 + '–' + (cap === Infinity ? '以上' : cap) + ' 度', fmt(use) + ' 度 × ' + r[i].toFixed(2) + ' = ' + fmt(use * r[i], 2) + ' 元']); }
      prev = cap; if (kwh <= cap) break;
    }
    return { total: total, rows: rows };
  }

  /* ---------- 請假扣薪 ---------- */
  // pay：請假期間工資給付比例（1 全薪、0.5 半薪、0 不給薪）
  var LEAVE = {
    sick: { name: '普通傷病假（未住院）', pay: 0.5, cap: 30, law: '勞工請假規則第4條：一年內未超過30日部分，工資折半發給' },
    personal: { name: '事假', pay: 0, law: '勞工請假規則第7條：一年內合計不得超過14日，不給工資' },
    family: { name: '家庭照顧假', pay: 0, law: '性別平等工作法第20條：全年7日，併入事假計算，可不給薪；不得影響全勤獎金' },
    menstrual: { name: '生理假', pay: 0.5, law: '性別平等工作法第14條：每月1日，工資減半發給；不得影響全勤獎金' },
    marriage: { name: '婚假', pay: 1, law: '勞工請假規則第2條：8日，工資照給' },
    funeral: { name: '喪假', pay: 1, law: '勞工請假規則第3條：依親等3–8日，工資照給' },
    official: { name: '公假', pay: 1, law: '勞工請假規則第8條：依法令規定應給公假者，工資照給' }
  };
  function leave(monthly, type, days, hours, usedSick) {
    var L = LEAVE[type], daily = monthly / 30, hourly = daily / 8, units = days + hours / 8, ded = 0, note = '';
    if (type === 'sick') {
      var half = Math.max(0, Math.min(units, L.cap - usedSick)), none = units - half;
      ded = half * daily * 0.5 + none * daily;
      if (none > 0) note = '今年病假已超過 30 日，超過部分 ' + fmt(none, 2) + ' 日雇主可不給薪（住院或另有特休／事假可抵）';
    } else ded = units * daily * (1 - L.pay);
    return { L: L, daily: daily, hourly: hourly, units: units, ded: Math.round(ded), net: monthly - Math.round(ded), note: note };
  }

  var api = { checkInvoice: checkInvoice, parseNums: parseNums, power: power, leave: leave, LEAVE: LEAVE };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.TWLIFE = api;

  function $(id) { return document.getElementById(id); }
  function n(id) { var x = parseFloat(($(id) || {}).value); return isNaN(x) ? 0 : x; }
  var form = document.querySelector('form[data-tool2]'); if (!form) return;
  var tool = form.getAttribute('data-tool2'), out = $('result');

  if (tool === 'invoice') {
    var data = root.INVOICE_FALLBACK || { periods: [] }, sel = $('period'), src = $('invsrc');
    function fill(d, live) {
      data = d; var cur = sel.value; sel.innerHTML = d.periods.map(function (p) { return '<option value="' + p.id + '">' + esc(p.title) + '</option>'; }).join('');
      if (cur && d.periods.some(function (p) { return p.id === cur; })) sel.value = cur;
      if (src) src.innerHTML = live ? '號碼即時取自 <a href="https://invoice.etax.nat.gov.tw/" target="_blank" rel="noopener">財政部稅務入口網</a> 官方公告' : '號碼來源：<a href="https://invoice.etax.nat.gov.tw/" target="_blank" rel="noopener">財政部稅務入口網</a>（備援資料，核對日 ' + esc(d.verified || '') + '）';
      run();
    }
    function run() {
      var p = data.periods.filter(function (x) { return x.id === sel.value; })[0]; if (!p) { out.innerHTML = ''; return; }
      var w = '<div class="kv"><div>特別獎</div><div><b>' + p.special.join('、') + '</b></div><div>特獎</div><div><b>' + p.grand.join('、') + '</b></div><div>頭獎</div><div><b>' + p.first.join('、') + '</b></div>' + (p.extra6 && p.extra6.length ? '<div>增開六獎</div><div><b>' + p.extra6.join('、') + '</b></div>' : '') + '</div>';
      var nums = parseNums($('nums').value), html = '', won = 0, sum = 0;
      if (!nums.length) { out.innerHTML = '<p>' + esc(p.title) + ' 中獎號碼（<a href="' + esc(p.link) + '" target="_blank" rel="noopener">官方公告</a>）</p>' + w + '<p class="note">在上方貼上發票號碼就會自動對獎。</p>'; return; }
      var rows = nums.map(function (x) { var r = checkInvoice(x, p); if (r) { won++; sum += r[1]; } return '<div>' + x + '</div><div>' + (r ? '🎉 <b>' + r[0] + '</b> ' + fmt(r[1]) + ' 元' : '沒中') + '</div>'; });
      html = big(won ? '恭喜！中獎 ' + won + ' 張' : '共 ' + nums.length + ' 張，這期沒有中獎', won ? '合計 ' + fmt(sum) + ' 元' : '再接再厲') + '<div class="kv">' + rows.join('') + '</div><h3 style="font-size:1rem;margin-top:1rem">' + esc(p.title) + ' 中獎號碼（<a href="' + esc(p.link) + '" target="_blank" rel="noopener">官方公告</a>）</h3>' + w;
      out.innerHTML = html;
    }
    sel.addEventListener('change', run); $('nums').addEventListener('input', run);
    fill(data, false);
    if (location.protocol.indexOf('http') === 0) fetch('/api/invoice').then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok && j.periods && j.periods.length) fill(j, true); }).catch(function () {});
    return;
  }

  function render() {
    if (tool === 'power') {
      var kwh = n('kwh'), months = $('billing').value === '2' ? 2 : 1, summer = $('season').value === 'summer';
      if (!(kwh > 0)) { out.innerHTML = ''; return; }
      var r = power(kwh, months, summer), other = power(kwh, months, !summer);
      out.innerHTML = big('應繳電費（約）', fmt(Math.round(r.total)) + ' 元') + kv([['計費方式', (months === 2 ? '2 個月一期（各段度數加倍）' : '單月') + '｜' + (summer ? '夏月 6/1–9/30' : '非夏月')], ['平均每度', fmt(r.total / kwh, 2) + ' 元'], ['若在' + (summer ? '非夏月' : '夏月'), fmt(Math.round(other.total)) + ' 元']].concat(r.rows));
    } else if (tool === 'leave2') {
      var m = n('monthly'); if (!(m > 0)) { out.innerHTML = ''; return; }
      var r2 = leave(m, $('ltype').value, n('days'), n('hours'), n('used'));
      out.innerHTML = big('這次請假扣薪（約）', fmt(r2.ded) + ' 元') + kv([['假別', r2.L.name], ['給薪規定', r2.L.law], ['日薪（月薪 ÷ 30）', fmt(r2.daily, 2) + ' 元'], ['時薪（日薪 ÷ 8）', fmt(r2.hourly, 2) + ' 元'], ['請假合計', fmt(r2.units, 3).replace(/\.?0+$/, '') + ' 日'], ['扣薪後當月薪資', fmt(r2.net) + ' 元']]) + (r2.note ? '<p class="note">' + r2.note + '</p>' : '');
    }
  }
  form.addEventListener('input', render); form.addEventListener('change', render); render();
})(this);
