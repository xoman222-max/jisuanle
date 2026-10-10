/* 台灣勞健保、所得稅、勞基法相關計算（純函式） */
(function (root) {
  var R = (typeof module !== 'undefined' && module.exports) ? require('../rates.js') : root.RATES;
  var round = Math.round;
  function grade(list, salary, cap) {
    for (var k = 0; k < list.length; k++) if (list[k] >= salary && (!cap || list[k] <= cap)) return list[k];
    var last = list[list.length - 1]; if (cap) { for (k = list.length - 1; k >= 0; k--) if (list[k] <= cap) return list[k]; } return last;
  }
  function laborGrade(s) { return grade(R.laborGrades, s); }
  function healthGrade(s) { return grade(R.healthGrades, s); }
  function pensionWage(s) { return Math.min(grade(R.healthGrades, s), R.pensionMaxWage); }
  function occWage(s) { return Math.min(grade(R.healthGrades, s), R.occMaxWage); }
  // 勞健保費：salary 月薪, dependents 健保眷屬人數, selfRate 勞退自提 %(0-6)
  function insurance(salary, dependents, selfRate) {
    if (!(salary > 0)) return null;
    dependents = Math.max(0, Math.min(R.healthMaxDependents, Math.floor(dependents || 0)));
    selfRate = Math.max(0, Math.min(6, selfRate || 0));
    var lg = laborGrade(salary), hg = healthGrade(salary), pw = pensionWage(salary), ow = occWage(salary);
    var part = function (share) { return round(lg * R.laborRateOrdinary * share) + round(lg * R.laborRateEmployment * share); };
    var hPer = round(hg * R.healthRate * R.healthShare.employee);
    var res = {
      laborGrade: lg, healthGrade: hg, pensionWage: pw,
      labor: { employee: part(R.laborShare.employee), employer: part(R.laborShare.employer), gov: part(R.laborShare.gov) },
      health: { employee: hPer * (1 + dependents), employer: round(hg * R.healthRate * R.healthShare.employer * (1 + R.healthAvgDependents)), gov: round(hg * R.healthRate * R.healthShare.gov * (1 + R.healthAvgDependents)) },
      occ: round(ow * R.occRate),
      pension: { employer: round(pw * R.pensionEmployerRate), self: round(pw * selfRate / 100) }
    };
    res.employeeTotal = res.labor.employee + res.health.employee + res.pension.self;
    res.employerTotal = res.labor.employer + res.health.employer + res.occ + res.pension.employer;
    return res;
  }
  function takeHome(salary, dependents, selfRate) {
    var ins = insurance(salary, dependents, selfRate); if (!ins) return null;
    ins.net = salary - ins.employeeTotal; return ins;
  }
  function bracketTax(net, brackets) {
    for (var k = 0; k < brackets.length; k++) if (net <= brackets[k][0]) return { tax: Math.max(0, round(net * brackets[k][1] - brackets[k][2])), rate: brackets[k][1] };
  }
  // 綜所稅（簡化）：year, salary 本人年薪, spouseSalary, married, dependents 一般扶養人數, elderly 70歲以上人數(含本人/配偶/扶養), otherIncome, itemized 列舉扣除額
  function incomeTax(o) {
    var T = R.tax[o.year || '115']; if (!T) return null;
    var s = Math.max(0, o.salary || 0), sp = o.married ? Math.max(0, o.spouseSalary || 0) : 0;
    var salaryIncome = s - Math.min(s, T.salaryDeduction) + sp - Math.min(sp, T.salaryDeduction);
    var gross = salaryIncome + Math.max(0, o.otherIncome || 0);
    var people = 1 + (o.married ? 1 : 0) + Math.max(0, o.dependents || 0);
    var elderly = Math.min(Math.max(0, o.elderly || 0), people);
    var exemption = (people - elderly) * T.exemption + elderly * T.exemption70;
    var std = o.married ? T.standardMarried : T.standard;
    var general = Math.max(std, o.itemized || 0);
    var net = Math.max(0, gross - exemption - general);
    var b = bracketTax(net, T.brackets);
    return { salaryIncome: salaryIncome, gross: gross, exemption: exemption, general: general, usedItemized: (o.itemized || 0) > std, net: net, tax: b.tax, rate: b.rate };
  }
  // 平日加班費：monthly 月薪, hours 加班時數(≤4)
  function hourlyWage(monthly) { return monthly / 240; }
  function overtime(o) {
    var h = o.hours, w = o.hourly || hourlyWage(o.monthly), OT = R.overtime, pay = 0;
    if (!(w > 0) || !(h >= 0) || h > 12) return null;
    if (o.type === 'weekday') { if (h > 4) return null; pay = Math.min(h, 2) * w * OT.first2 + Math.max(0, h - 2) * w * OT.next2; }
    else if (o.type === 'rest') { pay = Math.min(h, 2) * w * OT.first2 + Math.max(0, Math.min(h, 8) - 2) * w * OT.next2 + Math.max(0, h - 8) * w * OT.rest9to12; }
    else if (o.type === 'holiday') { // 國定假日/特休：8 小時內加給一日工資，超過部分依平日延長工時
      pay = (h > 0 ? 8 * w : 0) + Math.min(Math.max(0, h - 8), 2) * w * OT.first2 + Math.max(0, h - 10) * w * OT.next2;
      if (h > 12) return null;
    } else return null;
    return { hourly: w, pay: round(pay) };
  }
  // 特休天數（勞基法第38條）：依年資（月）
  function annualLeaveTW(months) {
    if (!(months >= 0)) return null;
    if (months < 6) return 0; if (months < 12) return 3; if (months < 24) return 7; if (months < 36) return 10;
    if (months < 60) return 14; if (months < 120) return 15;
    return Math.min(30, 15 + Math.floor(months / 12) - 9);
  }
  // 資遣費新制：avgWage 平均工資, years/months/days 年資
  function severance(avgWage, years, months, days) {
    if (!(avgWage > 0)) return null;
    var y = (years || 0) + (months || 0) / 12 + (days || 0) / 365;
    var m = Math.min(R.severanceMaxMonths, y * R.severancePerYear);
    return { seniority: y, months: m, amount: round(avgWage * m) };
  }
  // 勞退個人專戶推估
  function pensionProjection(o) {
    var years = o.years, r = (o.returnRate || 0) / 100 / 12, g = (o.growth || 0) / 100;
    if (!(o.salary > 0) || !(years > 0) || years > 60) return null;
    var bal = o.balance || 0, contrib = 0, sal = o.salary;
    for (var y = 0; y < years; y++) {
      var w = pensionWage(sal), m = round(w * R.pensionEmployerRate) + round(w * Math.min(6, o.selfRate || 0) / 100);
      for (var k = 0; k < 12; k++) { bal = bal * (1 + r) + m; contrib += m; }
      sal *= 1 + g;
    }
    var payMonths = (o.payoutYears || 24) * 12, monthly = r === 0 ? bal / payMonths : bal * r / (1 - Math.pow(1 + r, -payMonths));
    return { balance: bal, contributed: contrib, monthly: monthly };
  }
  var api = { laborGrade: laborGrade, healthGrade: healthGrade, pensionWage: pensionWage, insuranceTW: insurance, takeHomeTW: takeHome, incomeTaxTW: incomeTax,
    hourlyWageTW: hourlyWage, overtimeTW: overtime, annualLeaveTW: annualLeaveTW, severanceTW: severance, pensionProjectionTW: pensionProjection };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Calc = root.Calc || {}; for (var k in api) root.Calc[k] = api[k]; }
})(this);
