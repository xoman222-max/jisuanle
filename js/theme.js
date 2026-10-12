/* 深色模式切換：預設跟隨系統（prefers-color-scheme），手動選擇存在 localStorage */
(function () { var b = document.getElementById('theme'); if (!b) return; b.addEventListener('click', function () {
  var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), nx = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nx); try { localStorage.setItem('theme', nx); } catch (e) {} }); })();

(function () { var b = document.getElementById('totop'); if (!b) return; var t = 0;
  function u() { t = 0; var on = (window.scrollY || document.documentElement.scrollTop) > 600; if (b.hidden === on) b.hidden = !on; }
  window.addEventListener('scroll', function () { if (!t) t = requestAnimationFrame(u); }, { passive: true }); u();
  b.addEventListener('click', function () { var r = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; window.scrollTo({ top: 0, behavior: r ? 'auto' : 'smooth' }); var h = document.querySelector('header a.logo'); if (h) h.focus({ preventScroll: true }); });
})();

(function () { var a = document.querySelector('a[data-back]'); if (!a) return;
  a.addEventListener('click', function (e) { try { if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin && location.origin !== 'null') { e.preventDefault(); history.back(); } } catch (x) {} });
})();

/* 語言選單：記住使用者選的語言（首頁自動導向會尊重這個 cookie） */
(function () { var M = { 'zh-Hant-TW': 'tw', 'zh-Hans-CN': 'cn' };
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[hreflang]'); if (!a) return; var h = a.getAttribute('hreflang'), v = M[h] || h;
    if (/^[a-z]{2}$/.test(v)) document.cookie = 'jsl_lang=' + v + '; path=/; max-age=31536000; samesite=lax; secure'; }, true); })();
