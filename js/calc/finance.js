/* 通用金融計算（純函式） */
(function (root) {
  function r2(x) { return Math.round(x * 100) / 100; }
  // 房貸：principal 本金, annualRate %, years, graceYears 寬限期(只繳息), method 'equal'本息均攤 | 'principal'本金均攤
  function mortgage(o) {
    var P = o.principal, i = o.annualRate / 100 / 12, n = Math.round(o.years * 12), g = Math.round((o.graceYears || 0) * 12);
    if (!(P > 0) || !(n > 0) || g >= n || i < 0) return null;
    var rows = [], bal = P, totalInt = 0, m = n - g, pay;
    for (var k = 1; k <= n; k++) {
      var interest = bal * i, princ;
      if (k <= g) { princ = 0; pay = interest; }
      else if (o.method === 'principal') { princ = P / m; pay = princ + interest; }
      else { pay = i === 0 ? P / m : P * i * Math.pow(1 + i, m) / (Math.pow(1 + i, m) - 1); princ = pay - interest; }
      bal -= princ; if (Math.abs(bal) < 1e-6) bal = 0;
      totalInt += interest;
      rows.push({ month: k, payment: pay, principal: princ, interest: interest, balance: bal });
    }
    var after = rows[g] ? rows[g].payment : 0;
    return { rows: rows, totalInterest: totalInt, totalPayment: P + totalInt, gracePayment: g ? rows[0].payment : 0, firstPayment: after, lastPayment: rows[n - 1].payment };
  }
  // 由每期付款反推年利率(APR)：實拿金額 = principal - fee，n 期，每期 payment
  function aprFromInstallments(principal, payment, n, fee) {
    var net = principal - (fee || 0);
    if (!(net > 0) || !(payment > 0) || !(n > 0)) return null;
    if (payment * n < net) return null;
    if (Math.abs(payment * n - net) < 1e-9) return { monthly: 0, apr: 0, totalInterest: 0 };
    var pv = function (r) { return payment * (1 - Math.pow(1 + r, -n)) / r; };
    var lo = 1e-9, hi = 1;
    for (var k = 0; k < 200; k++) { var mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid; }
    var r = (lo + hi) / 2;
    return { monthly: r, apr: r * 12 * 100, effective: (Math.pow(1 + r, 12) - 1) * 100, totalInterest: payment * n - net };
  }
  // 存款/複利：principal, annualRate %, years, freq 每年複利次數(0=單利), monthly 每月定期投入
  function deposit(o) {
    var P = o.principal || 0, r = o.annualRate / 100, t = o.years, f = o.freq, M = o.monthly || 0;
    if (P < 0 || M < 0 || !(t > 0) || r < 0) return null;
    var fv, contrib = P + M * Math.round(t * 12);
    if (!f) { // 單利
      fv = P * (1 + r * t);
      for (var k = 1; k <= Math.round(t * 12); k++) fv += M * (1 + r * (Math.round(t * 12) - k) / 12);
    } else {
      fv = P * Math.pow(1 + r / f, f * t);
      var im = Math.pow(1 + r / f, f / 12) - 1, n = Math.round(t * 12);
      fv += im === 0 ? M * n : M * (Math.pow(1 + im, n) - 1) / im;
    }
    return { total: fv, contributed: contrib, interest: fv - contrib };
  }
  // 提前還款（等額本息）：balance 剩餘本金, annualRate %, months 剩餘月數, prepay, mode 'shorten'|'reduce'
  function prepay(o) {
    var i = o.annualRate / 100 / 12, B = o.balance, n = o.months, X = o.prepay;
    if (!(B > 0) || !(n > 0) || !(X > 0) || X > B || i <= 0) return null;
    var pmt = function (b, m) { return b * i * Math.pow(1 + i, m) / (Math.pow(1 + i, m) - 1); };
    var oldPay = pmt(B, n), oldInt = oldPay * n - B, nb = B - X;
    if (nb === 0) return { oldPayment: oldPay, newPayment: 0, newMonths: 0, interestSaved: oldInt, oldInterest: oldInt, newInterest: 0 };
    var newPay, newMonths;
    if (o.mode === 'reduce') { newMonths = n; newPay = pmt(nb, n); }
    else {
      newPay = oldPay;
      newMonths = Math.ceil(-Math.log(1 - nb * i / oldPay) / Math.log(1 + i));
      // 最後一期不足額，以精確利息計
      var bal = nb, intSum = 0;
      for (var k = 0; k < newMonths; k++) { var it = bal * i; intSum += it; bal = bal + it - Math.min(oldPay, bal + it); }
      return { oldPayment: oldPay, newPayment: oldPay, newMonths: newMonths, oldInterest: oldInt, newInterest: intSum, interestSaved: oldInt - intSum };
    }
    var newInt = newPay * newMonths - nb;
    return { oldPayment: oldPay, newPayment: newPay, newMonths: newMonths, oldInterest: oldInt, newInterest: newInt, interestSaved: oldInt - newInt };
  }
  var api = { mortgage: mortgage, aprFromInstallments: aprFromInstallments, deposit: deposit, prepay: prepay, r2: r2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Calc = root.Calc || {}; for (var k in api) root.Calc[k] = api[k]; }
})(this);
