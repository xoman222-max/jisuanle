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
  // 年齡：週歲、虛歲、已活天數、下次生日、生肖（以西元年概算，農曆年前出生者可能差一年）、星座
  var ZOD = ['鼠', '牛', '虎', '兔', '龍', '蛇', '馬', '羊', '猴', '雞', '狗', '豬'];
  var STAR = [[120, '摩羯座'], [219, '水瓶座'], [321, '雙魚座'], [420, '牡羊座'], [521, '金牛座'], [622, '雙子座'], [723, '巨蟹座'], [823, '獅子座'], [923, '處女座'], [1024, '天秤座'], [1123, '天蠍座'], [1222, '射手座'], [1232, '摩羯座']];
  function bdayIn(y, m, d) { if (m === 2 && d === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) d = 28; return fmt(Date.UTC(y, m - 1, d)); }
  function age(birth, on) {
    var x = parse(birth), y = parse(on); if (x === null || y === null || y < x) return null;
    var r = ymd(birth, on), by = +birth.slice(0, 4), bm = +birth.slice(5, 7), bd = +birth.slice(8, 10), oy = +on.slice(0, 4);
    var next = bdayIn(oy, bm, bd); if (parse(next) < y) next = bdayIn(oy + 1, bm, bd);
    var md = bm * 100 + bd, star = ''; for (var i = 0; i < STAR.length; i++) if (md < STAR[i][0]) { star = STAR[i][1]; break; }
    return { years: r.years, months: r.months, days: r.days, totalDays: r.totalDays, nominal: oy - by + 1, nextBirthday: next, daysToNext: daysBetween(on, next), nextAge: +next.slice(0, 4) - by, zodiac: ZOD[((by - 4) % 12 + 12) % 12], star: star, rocYear: by - 1911 };
  }
  var api = { age: age, parseDate: parse, fmtDate: fmt, daysBetween: daysBetween, addDays: addDays, ymd: ymd, toROC: toROC, fromROC: fromROC, weekdayCount: weekdayCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Calc = root.Calc || {}; for (var k in api) root.Calc[k] = api[k]; }
})(this);
