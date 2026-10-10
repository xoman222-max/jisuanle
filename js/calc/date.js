(function (root) {
  function parse(s) { // 'YYYY-MM-DD' -> UTC ms
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d), dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return t;
  }
  function fmt(t) { return new Date(t).toISOString().slice(0, 10); }
  function daysBetween(a, b) { var x = parse(a), y = parse(b); if (x === null || y === null) return null; return Math.round((y - x) / 864e5); }
  function addDays(a, n) { var x = parse(a); if (x === null || !isFinite(n)) return null; return fmt(x + n * 864e5); }
  // 完整年月日差（from <= to）
  function ymd(a, b) {
    var x = parse(a), y = parse(b); if (x === null || y === null || y < x) return null;
    var A = new Date(x), B = new Date(y);
    var yy = B.getUTCFullYear() - A.getUTCFullYear(), mm = B.getUTCMonth() - A.getUTCMonth(), dd = B.getUTCDate() - A.getUTCDate();
    if (dd < 0) { mm--; dd += new Date(Date.UTC(B.getUTCFullYear(), B.getUTCMonth(), 0)).getUTCDate(); }
    if (mm < 0) { yy--; mm += 12; }
    return { years: yy, months: mm, days: dd, totalDays: Math.round((y - x) / 864e5) };
  }
  function toROC(y) { return y - 1911; }
  function fromROC(y) { return y + 1911; }
  function weekdayCount(a, b) { // 含頭含尾的週一~五天數
    var x = parse(a), y = parse(b); if (x === null || y === null || y < x) return null;
    var c = 0; for (var t = x; t <= y; t += 864e5) { var w = new Date(t).getUTCDay(); if (w > 0 && w < 6) c++; } return c;
  }
  var api = { parseDate: parse, fmtDate: fmt, daysBetween: daysBetween, addDays: addDays, ymd: ymd, toROC: toROC, fromROC: fromROC, weekdayCount: weekdayCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Calc = root.Calc || {}; for (var k in api) root.Calc[k] = api[k]; }
})(this);
