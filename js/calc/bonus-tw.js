/* 年終獎金實領試算（台灣） */
(function (root) {
  /* 所有門檻與費率集中在這裡。
     ⚠️ 115 年 12 月中旬財政部會公告「116 年度薪資所得扣繳稅額表」，屆時請重新確認 whThreshold（起扣標準）；
        最低工資 116 年 30,900 元為審議會決議、待行政院核定，核定後再確認；健保補充保費費率每年例行確認。 */
  var CONFIG = {
    verified: '2026-10-13',
    whThreshold: 90501,   // 居住者非每月給付薪資起扣標準：單次給付「達」此金額按全額扣 5%（115 年度，財政部稅務入口網 1506）
    whRate: 0.05,
    nhiRate: 0.0211,      // 二代健保補充保費費率（110/1/1 起）
    nhiMultiple: 4,       // 全年累計獎金超過「當月投保金額 × 4」的部分才計收
    nhiCapPerPay: 10000000, // 超過部分單次以 1,000 萬元為限
    minWage: 30900,       // 116 年每月最低工資（審議會決議，待行政院核定）
    nrLowMult: 1.5,       // 非居住者：全月薪資給付總額 ≤ 最低工資 × 1.5 → 6%，否則 18%
    nrLowRate: 0.06,
    nrRate: 0.18
  };

  /* opts: { salary, insured, payments: [金額...], resident: true } */
  function calc(opts, C) {
    C = C || CONFIG;
    var salary = Math.max(0, +opts.salary || 0), insured = +opts.insured > 0 ? +opts.insured : salary, resident = opts.resident !== false;
    var pays = (opts.payments || []).map(function (x) { return Math.max(0, Math.round(+x || 0)); }).filter(function (x) { return x > 0; });
    var nrLine = C.minWage * C.nrLowMult, cum = 0, nhiCum = 0, rows = [];
    pays.forEach(function (amt) {
      var tax, rule;
      if (resident) {
        if (amt >= C.whThreshold) { tax = Math.round(amt * C.whRate); rule = '達 ' + C.whThreshold.toLocaleString() + ' 元 → 全額 × 5%'; }
        else { tax = 0; rule = '未達 ' + C.whThreshold.toLocaleString() + ' 元 → 免預扣'; }
      } else {
        var month = salary + amt, low = month <= nrLine;
        tax = Math.round(amt * (low ? C.nrLowRate : C.nrRate)); rule = '非居住者：當月薪資＋獎金 ' + month.toLocaleString() + ' 元' + (low ? ' ≤ ' : ' > ') + nrLine.toLocaleString() + ' → ' + (low ? '6%' : '18%');
      }
      cum += amt;
      var over = cum - insured * C.nhiMultiple, base = Math.min(Math.max(0, over), amt, C.nhiCapPerPay), nhi = Math.round(base * C.nhiRate);
      nhiCum += nhi;
      rows.push({ amount: amt, tax: tax, rule: rule, nhiBase: base, nhi: nhi, net: amt - tax - nhi });
    });
    var tax = rows.reduce(function (s, r) { return s + r.tax; }, 0);
    return { total: cum, insured: insured, nhiLine: insured * C.nhiMultiple, tax: tax, nhi: nhiCum, net: cum - tax - nhiCum, rows: rows, nrLine: nrLine };
  }

  var api = { CONFIG: CONFIG, calc: calc };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.BONUSTW = api;

  function fmt(n) { return Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 }); }
  function $(id) { return document.getElementById(id); }
  function n(id) { var x = parseFloat(($(id) || {}).value); return isNaN(x) ? 0 : x; }
  var form = document.querySelector('form[data-tool2="bonus-tw"]'); if (!form) return;
  var out = $('result'), insTouched = false;
  $('insured').addEventListener('input', function () { insTouched = true; });
  function sync() {
    var byAmt = $('mode').value === 'amount', split = $('payway').value === 'split';
    $('fMode').hidden = split; $('fMonths').hidden = byAmt || split; $('fAmount').hidden = !byAmt || split; $('fSplit').hidden = !split;
    if (!insTouched) $('insured').value = $('salary').value;
  }
  function render() {
    sync();
    var salary = n('salary'), split = $('payway').value === 'split', pays;
    if (split) pays = [n('p1'), n('p2'), n('p3')];
    else pays = [$('mode').value === 'amount' ? n('amount') : Math.round(salary * n('months'))];
    var r = calc({ salary: salary, insured: n('insured'), payments: pays, resident: $('resident').value !== 'no' });
    if (!r.total) { out.innerHTML = '<p class="note">輸入月薪與年終月數（或金額）就會自動計算。</p>'; return; }
    var rows = [['年終獎金總額', fmt(r.total) + ' 元']];
    r.rows.forEach(function (x, i) { rows.push([(r.rows.length > 1 ? '第 ' + (i + 1) + ' 筆 ' : '') + fmt(x.amount) + ' 元 所得稅預扣', fmt(x.tax) + ' 元（' + x.rule + '）']); });
    rows.push(['所得稅預扣合計', fmt(r.tax) + ' 元']);
    rows.push(['健保補充保費', fmt(r.nhi) + ' 元（全年累計 ' + fmt(r.total) + ' − 投保金額 ' + fmt(r.insured) + ' × 4 ＝ ' + fmt(Math.max(0, r.total - r.nhiLine)) + ' 元 × 2.11%）']);
    if (r.rows.length > 1) r.rows.forEach(function (x, i) { rows.push(['　第 ' + (i + 1) + ' 筆實領', fmt(x.net) + ' 元（扣稅 ' + fmt(x.tax) + '、補充保費 ' + fmt(x.nhi) + '）']); });
    out.innerHTML = '<div>實領金額</div><div class="big">' + fmt(r.net) + ' 元</div><div class="kv">' + rows.map(function (p) { return '<div>' + p[0] + '</div><div>' + p[1] + '</div>'; }).join('') + '</div><p class="note">5% 為預扣，報稅時多退少補；實際以公司申報為準。</p>';
  }
  form.addEventListener('input', render); form.addEventListener('change', render); render();
})(this);
