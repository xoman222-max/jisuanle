/* 匯率換算：/api/rates（Worker 快取 open.er-api.com）→ 失敗時用建置快照 */
(function () {
  var D = window.I18N || {}, LANG = document.documentElement.lang, t = function (s) { return D[s] || s; };
  var $ = function (id) { return document.getElementById(id); }, amt = $('fxamt'); if (!amt) return;
  var LIST = ['TWD', 'USD', 'CNY', 'JPY', 'KRW', 'HKD', 'EUR', 'GBP', 'VND', 'THB', 'IDR', 'SGD', 'MYR', 'PHP', 'AUD', 'CAD', 'NZD', 'CHF', 'INR', 'MXN'];
  var dn = null; try { dn = new Intl.DisplayNames([LANG], { type: 'currency' }); } catch (e) {}
  var name = function (c) { var n = dn ? dn.of(c) : ''; return c + (n && n !== c ? ' — ' + n : ''); };
  var from = $('fxfrom'), to = $('fxto'), out = $('fxout'), meta = $('fxmeta'), data = window.FX_FALLBACK, live = false;
  [from, to].forEach(function (s) { s.innerHTML = LIST.map(function (c) { return '<option value="' + c + '">' + name(c) + '</option>'; }).join(''); });
  var b = document.body.getAttribute('data-fx') || 'TWD-USD', q = new URLSearchParams(location.search);
  from.value = q.get('from') || b.split('-')[0]; to.value = q.get('to') || b.split('-')[1];
  function fmt(x, c) { var d = ['JPY', 'KRW', 'VND', 'IDR'].indexOf(c) >= 0 ? 0 : (x < 1 ? 4 : 2); return Number(x).toLocaleString(LANG, { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function run() {
    var a = parseFloat(amt.value), f = from.value, tt = to.value, R = data && data.rates;
    if (!R || !R[f] || !R[tt] || !(a >= 0)) { out.innerHTML = '<p class="err">' + t('請輸入金額') + '</p>'; return; }
    var rate = R[tt] / R[f], res = a * rate;
    out.innerHTML = '<div>' + fmt(a, f) + ' ' + f + ' =</div><div class="big">' + fmt(res, tt) + ' ' + tt + '</div><div class="kv"><div>1 ' + f + '</div><div>' + fmt(rate, tt) + ' ' + tt + '</div><div>1 ' + tt + '</div><div>' + fmt(1 / rate, f) + ' ' + f + '</div></div>';
    var when = new Date(data.time * 1000).toLocaleString(LANG, { dateStyle: 'medium', timeStyle: 'short' });
    meta.innerHTML = t('匯率更新時間') + '：' + when + '｜' + t('來源') + '：<a href="https://www.exchangerate-api.com" rel="noopener" target="_blank">ExchangeRate-API</a>' + (live ? '' : '（' + t('離線備援資料') + '）');
    window.__fx = { rate: rate, res: res, live: live };
  }
  $('fxswap').addEventListener('click', function () { var x = from.value; from.value = to.value; to.value = x; run(); });
  document.getElementById('fxquick').addEventListener('click', function (e) { var b = e.target.closest('[data-amt]'); if (b) { amt.value = b.getAttribute('data-amt'); run(); } });
  [amt, from, to].forEach(function (x) { x.addEventListener('input', run); x.addEventListener('change', run); });
  run();
  if (location.protocol !== 'file:') fetch((document.body.getAttribute('data-root') || '/') + 'api/rates').then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok && j.rates && j.rates.USD) { data = j; live = true; run(); } }).catch(function () {});
})();
