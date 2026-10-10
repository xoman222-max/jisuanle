/* 國際版通用計算機介面（字串鍵為繁中，由 window.I18N 翻譯） */
(function () {
  var C = window.Calc, D = window.I18N || {}, LANG = document.documentElement.lang;
  function t(s) { return D[s] || s; }
  function el(id) { return document.getElementById(id); }
  function v(id) { var e = el(id); if (!e) return undefined; if (e.tagName === 'SELECT' || e.type === 'date') return e.value; return e.value === '' ? NaN : parseFloat(e.value); }
  var num = function (x, d) { return Number(x).toLocaleString(LANG, { maximumFractionDigits: d == null ? 2 : d }); };
  var money = function (x) { return Number(x).toLocaleString(LANG, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  function kv(p) { return '<div class="kv">' + p.map(function (x) { return '<div>' + x[0] + '</div><div>' + x[1] + '</div>'; }).join('') + '</div>'; }
  function big(l, val) { return '<div>' + l + '</div><div class="big">' + val + '</div>'; }
  function table(h, rows) { return '<div class="overflow-auto"><table><thead><tr>' + h.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
  var form = document.querySelector('form[data-tool]'); if (!form) return;
  var id = form.getAttribute('data-tool'), out = el('result');
  var WD = [t('週日'), t('週一'), t('週二'), t('週三'), t('週四'), t('週五'), t('週六')];
  var R = {
    'x-mortgage': function () { var r = C.mortgage({ principal: v('amount'), annualRate: v('rate'), years: v('years'), graceYears: 0, method: v('method') }); if (!r) return null; return big(v('method') === 'principal' ? t('首期月付') : t('每月應繳'), money(r.firstPayment)) + kv([[t('總利息'), money(r.totalInterest)], [t('本息總額'), money(r.totalPayment)], [t('最後一期'), money(r.lastPayment)]]) + '<h3>' + t('攤還表') + '</h3>' + table([t('期數'), t('月付'), t('本金'), t('利息'), t('剩餘本金')], r.rows.map(function (x) { return [x.month, money(x.payment), money(x.principal), money(x.interest), money(x.balance)]; })); },
    'x-apr': function () { var r = C.aprFromInstallments(v('amount'), v('pay'), v('n'), v('fee') || 0); return r && big(t('總費用年百分率（APR）'), num(r.apr, 2) + '%') + kv([[t('月利率'), num(r.monthly * 100, 3) + '%'], [t('實質年利率（複利）'), num(r.effective || 0, 2) + '%'], [t('總利息 + 費用'), money(r.totalInterest + (v('fee') || 0))]]); },
    'x-deposit': function () { var r = C.deposit({ principal: v('principal') || 0, monthly: v('monthly') || 0, annualRate: v('rate'), years: v('years'), freq: +v('freq') }); return r && big(t('到期本利和'), money(r.total)) + kv([[t('累計投入本金'), money(r.contributed)], [t('利息收入'), money(r.interest)]]); },
    'x-bmi': function () { var h = v('h') / 100, w = v('w'); if (!(h > 0 && w > 0)) return null; var b = w / (h * h), c = b < 18.5 ? t('體重過輕') : b < 25 ? t('正常') : b < 30 ? t('過重') : t('肥胖'); return big('BMI', num(b, 1) + ' (' + c + ')') + kv([[t('健康體重範圍') + ' (BMI 18.5–24.9)', num(18.5 * h * h, 1) + ' – ' + num(24.9 * h * h, 1) + ' kg'], [t('理想體重 (BMI 22)'), num(22 * h * h, 1) + ' kg'], [t('標準') , 'WHO']]); },
    'x-tdee': function () { var r = C.tdee({ sex: v('sex'), age: v('age'), height: v('h'), weight: v('w'), activity: +v('act') }); return r && big(t('每日總消耗 TDEE'), num(r.tdee, 0) + ' kcal') + kv([[t('基礎代謝 BMR'), num(r.bmr, 0) + ' kcal'], [t('減重建議攝取（-500）'), num(r.lose, 0) + ' kcal'], [t('增肌建議攝取（+300）'), num(r.gain, 0) + ' kcal']]); },
    'x-date': function () { var a = v('a'), b = v('b'), d = C.daysBetween(a, b); if (d === null) return null; var y = d >= 0 ? C.ymd(a, b) : C.ymd(b, a), n = v('n') || 0, add = C.addDays(a, n); return big(t('相差天數'), num(Math.abs(d), 0) + ' ' + t('天')) + kv([[t('年月日'), y.years + ' ' + t('年') + ' ' + y.months + ' ' + t('個月') + ' ' + y.days + ' ' + t('天')], [t('平日（週一至五，含頭尾）'), C.weekdayCount(d >= 0 ? a : b, d >= 0 ? b : a)], ['<b>' + (n >= 0 ? t('起始日往後') : t('起始日往前')) + ' ' + Math.abs(n) + ' ' + t('天') + '</b>', '<b>' + add + ' (' + WD[new Date(add + 'T00:00:00Z').getUTCDay()] + ')</b>']]); },
    'x-age': function () { var g = C.age(v('birth'), v('on')); if (!g) return null; return big(t('年齡'), g.years) + kv([[t('精確年齡'), g.years + ' ' + t('年') + ' ' + g.months + ' ' + t('個月') + ' ' + g.days + ' ' + t('天')], [t('已出生天數'), num(g.totalDays, 0) + ' ' + t('天')], [t('下次生日'), g.nextBirthday + (g.daysToNext === 0 ? ' 🎂 ' + t('就是今天，生日快樂！') : ' (' + t('還有') + ' ' + g.daysToNext + ' ' + t('天') + ' → ' + g.nextAge + ')')], [t('星座'), t(g.star)], [t('生肖（以西元年概算）'), t(g.zodiac)]]); },
    'x-units': function () { var cat = v('cat'), val = v('val'), u = C.UNITS[cat]; if (!u || isNaN(val)) return null; var from = v('from'); if (!(from in u.u)) return null; return table([t('單位'), t('換算結果')], Object.keys(u.u).map(function (k) { return [t(k), num(C.convert(cat, val, from, k), 6)]; })); }
  };
  var cat = el('cat');
  function fillUnits() { var u = C.UNITS[cat.value].u, f = el('from'), keep = f.value; f.innerHTML = Object.keys(u).map(function (k) { return '<option value="' + k + '">' + t(k) + '</option>'; }).join(''); if (keep in u) f.value = keep; }
  if (cat && id === 'x-units') { cat.addEventListener('change', fillUnits); fillUnits(); }
  function run() {
    var bad = false; [].forEach.call(form.querySelectorAll('input[type=number]'), function (i) { var x = i.value === '' ? (i.required ? NaN : 0) : parseFloat(i.value); var b = isNaN(x) || (i.min !== '' && x < +i.min) || (i.max !== '' && x > +i.max); i.classList.toggle('bad', b); bad = bad || b; });
    var html = null; try { html = bad ? null : R[id](); } catch (e) { html = null; }
    out.innerHTML = html || '<p class="err">' + t('請檢查輸入是否正確（需為有效的正數）') + '</p>';
  }
  (function () { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }, td = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); [].forEach.call(form.querySelectorAll('input[data-def]'), function (i) { i.value = i.getAttribute('data-def') === 'YEAREND' ? d.getFullYear() + '-12-31' : td; }); })();
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-fill]'); if (!b) return; var f = JSON.parse(b.getAttribute('data-fill')), d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }, td = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); Object.keys(f).forEach(function (k) { var i = el(k); if (i) i.value = f[k] === 'TODAY' ? td : f[k]; }); run(); });
  form.addEventListener('input', run); form.addEventListener('change', run); form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  run();
})();
