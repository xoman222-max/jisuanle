/* 瀏覽計數：每頁每 30 分鐘最多計一次；預設不公開顯示（由 Worker 的 SHOW_COUNTER 控制） */
(function () {
  if (location.protocol === 'file:' || !window.fetch) return;
  var el = document.getElementById('stats'); if (!el) return;
  var ROOT = document.body.getAttribute('data-root') || './', path = location.pathname.replace(/index\.html$/, ''), k = 'jv:' + path, now = Date.now(), last = 0;
  try { last = +localStorage.getItem(k) || 0; } catch (e) {}
  var post = now - last > 30 * 60e3;
  fetch(ROOT + 'api/stats', post ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path }), keepalive: true } : {})
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (post && j) try { localStorage.setItem(k, String(now)); } catch (e) {}
      window.__stats = j;
      if (!j || !j.show || typeof j.today !== 'number') return;
      var f = function (n) { return n.toLocaleString(); };
      document.getElementById('st-today').textContent = f(j.today); document.getElementById('st-total').textContent = f(j.total); el.hidden = false;
    }).catch(function () {});
})();
