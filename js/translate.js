/* 翻譯：POST /api/translate（Cloudflare Workers AI），顯示今日剩餘次數 */
(function () {
  var D = window.I18N || {}, t = function (s) { return D[s] || s; }, $ = function (id) { return document.getElementById(id); };
  var src = $('trsrc'), tgt = $('trtgt'), inp = $('trin'), out = $('trout'), go = $('trgo'), msg = $('trmsg'), cnt = $('trcnt'), q = $('trq'); if (!inp) return;
  var ED = document.body.getAttribute('data-ed') || 'tw', FILE = location.protocol === 'file:', MAX = 1000, ROOT = document.body.getAttribute('data-root') || '/';
  var QMSG = t('今日翻譯額度已用完，明天再來吧！');
  function count() { var n = [...inp.value].length; cnt.textContent = n + ' / ' + MAX; cnt.classList.toggle('err', n > MAX); }
  function showQ(rem, cap) { if (rem == null || !cap) return; q.hidden = false; q.textContent = t('今日剩餘次數') + '：' + rem + ' / ' + cap; if (rem <= 0) off(); }
  function day() { return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); }
  function off() { go.disabled = true; msg.textContent = QMSG; try { localStorage.setItem('trQuotaDay', day()); } catch (e) {} }
  inp.addEventListener('input', count); count();
  $('trswap').addEventListener('click', function () { if (src.value === 'auto') return; var x = src.value; src.value = tgt.value; tgt.value = x; if (out.value) { inp.value = out.value; out.value = ''; count(); } });
  $('trcopy').addEventListener('click', function () { if (!out.value) return; (navigator.clipboard ? navigator.clipboard.writeText(out.value) : Promise.reject()).catch(function () { out.select(); document.execCommand('copy'); }); $('trcopy').textContent = t('已複製'); setTimeout(function () { $('trcopy').textContent = t('複製'); }, 1500); });
  if (FILE) { go.disabled = true; msg.textContent = t('本機開啟（file://）時無法使用翻譯，請在 jisuanle.com 網站上使用。'); return; }
  try { if (localStorage.getItem('trQuotaDay') === day()) off(); } catch (e) {}
  fetch(ROOT + 'api/translate/quota').then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { if (j.remaining > 0) { try { localStorage.removeItem('trQuotaDay'); } catch (e) {} go.disabled = false; msg.textContent = ''; } showQ(j.remaining, j.cap); } }).catch(function () {});
  go.addEventListener('click', async function () {
    var text = inp.value.trim(); if (!text) { msg.textContent = t('請輸入要翻譯的文字'); return; } if ([...text].length > MAX) { msg.textContent = t('最多 1000 字，請分段翻譯'); return; }
    go.disabled = true; go.setAttribute('aria-busy', 'true'); msg.textContent = t('翻譯中…');
    try {
      var r = await fetch(ROOT + 'api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text, source: src.value, target: tgt.value, ui: ED }) }), j = {};
      try { j = await r.json(); } catch (e) {}
      if (j.cap) showQ(j.remaining, j.cap);
      if (j.code === 'quota' || j.code === 'ai_quota') { off(); window.__trErr = QMSG; go.removeAttribute('aria-busy'); return; }
      if (!r.ok || !j.ok) throw new Error(j.error || t('翻譯暫時無法使用，請稍後再試'));
      out.value = j.text; msg.textContent = ''; window.__trOut = j.text;
    } catch (e) { msg.textContent = e.message; window.__trErr = e.message; }
    go.disabled = false; go.removeAttribute('aria-busy');
  });
})();
