/* 中国大陆个税、五险一金、劳动法相关计算（纯函数） */
(function (root) {
  var R = (typeof module !== 'undefined' && module.exports) ? require('../rates-cn.js') : root.RATES_CN;
  function r2(x) { return Math.round(x * 100) / 100; }
  function bt(x, list) { for (var k = 0; k < list.length; k++) if (x <= list[k][0]) return list[k]; }
  // 五险一金：city, salary 月工资, hfRate 公积金比例(0.05~0.12)
  function social(city, salary, hfRate) {
    var c = R.cities[city]; if (!c || !(salary > 0)) return null;
    var base = Math.min(Math.max(salary, c.min), c.max), hf = hfRate == null ? c.hfDefault : hfRate;
    var p = { pension: r2(base * c.pension), medical: r2(base * c.medical + c.medicalFixed), unemployment: r2(base * c.unemployment), housingFund: Math.round(base * hf) };
    var e = { pension: r2(base * c.er.pension), medical: r2(base * c.er.medical), unemployment: r2(base * c.er.unemployment), injury: r2(base * c.er.injury), housingFund: Math.round(base * hf) };
    var sum = function (o) { var s = 0; for (var k in o) s += o[k]; return r2(s); };
    return { base: base, personal: p, employer: e, personalTotal: sum(p), employerTotal: sum(e) };
  }
  // 累计预扣法：逐月 salary 税前, insurance 每月个人五险一金, special 每月专项附加扣除
  function cumulativeTax(salary, insurance, special) {
    if (!(salary >= 0)) return null;
    var rows = [], paid = 0;
    for (var m = 1; m <= 12; m++) {
      var taxable = Math.max(0, (salary - insurance - special - R.threshold) * m);
      var b = bt(taxable, R.annualBrackets), cum = Math.max(0, r2(taxable * b[1] - b[2]));
      var t = r2(cum - paid); paid = cum;
      rows.push({ month: m, taxable: taxable, rate: b[1], tax: t, net: r2(salary - insurance - t) });
    }
    return { rows: rows, annualTax: paid };
  }
  function annualTax(taxable) { var b = bt(Math.max(0, taxable), R.annualBrackets); return Math.max(0, r2(taxable * b[1] - b[2])); }
  // 年终奖：单独计税 vs 并入综合所得；annualTaxable 不含奖金的全年应纳税所得额
  function bonusTax(bonus, annualTaxable) {
    if (!(bonus >= 0)) return null;
    var b = bt(bonus / 12, R.monthlyBrackets), sep = Math.max(0, r2(bonus * b[1] - b[2]));
    var base = Math.max(0, annualTaxable || 0);
    var separateTotal = r2(sep + annualTax(base)), combinedTotal = annualTax(base + bonus);
    return { separate: sep, rate: b[1], separateTotal: separateTotal, combinedTotal: combinedTotal, better: separateTotal <= combinedTotal ? 'separate' : 'combined' };
  }
  function overtimeCN(monthly, hours, type) {
    var mult = R.overtime[type]; if (!(monthly > 0) || !(hours >= 0) || !mult) return null;
    var hourly = monthly / R.payDaysPerMonth / 8;
    return { hourly: hourly, pay: r2(hourly * hours * mult) };
  }
  function annualLeaveCN(years) {
    if (!(years >= 0)) return null;
    if (years < 1) return 0; if (years < 10) return 5; if (years < 20) return 10; return 15;
  }
  // 经济补偿金：wage 月平均工资, years 整年, months 零头月数, cap 当地上年度职工月平均工资×3（0=不封顶）, type 'N'|'N+1'|'2N'
  function compensation(o) {
    if (!(o.wage > 0) || !(o.years >= 0)) return null;
    var extra = o.months || 0, n = o.years + (extra >= 6 ? 1 : extra > 0 ? 0.5 : 0);
    var w = o.wage, capped = false;
    if (o.avgWage > 0 && w > o.avgWage * 3) { w = o.avgWage * 3; n = Math.min(n, 12); capped = true; }
    var base = w * n, amt = o.type === '2N' ? base * 2 : o.type === 'N+1' ? base + o.wage : base;
    return { n: n, monthWage: w, capped: capped, amount: r2(amt) };
  }
  var api = { socialCN: social, cumulativeTaxCN: cumulativeTax, annualTaxCN: annualTax, bonusTaxCN: bonusTax, overtimeCN: overtimeCN, annualLeaveCN: annualLeaveCN, compensationCN: compensation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Calc = root.Calc || {}; for (var k in api) root.Calc[k] = api[k]; }
})(this);
