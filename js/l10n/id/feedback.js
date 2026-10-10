/* 意見回饋表單：POST /api/feedback（Cloudflare Worker） */
(function () {
  var f = document.getElementById('fb'); if (!f) return;
  var CN = document.documentElement.lang.indexOf('Hans') > 0, ROOT = document.body.getAttribute('data-root') || './';
  var $ = function (id) { return document.getElementById(id); }, msg = $('fbmsg'), btn = $('fbsend');
  var T = CN ? { short: '请填写至少 5 个字的内容', mail: 'Email 格式不正确', sending: 'Mengirim…', ok: '已收到，谢谢你的反馈！', rate: '提交太频繁，请稍后再试', err: '提交失败，请稍后再试或来信联系' }
             : { short: 'Tulis minimal 5 karakter', mail: 'Email Format tidak valid', sending: 'Mengirim…', ok: 'Terima kasih — pesan Anda sudah kami terima!', rate: 'Terlalu sering mengirim, coba lagi nanti', err: 'Gagal mengirim — coba lagi nanti atau kirim email' };
  var q = new URLSearchParams(location.search); if (q.get('tool')) $('tool').value = q.get('tool').slice(0, 100);
  else if (document.referrer && document.referrer.indexOf(location.origin) === 0) $('tool').value = new URL(document.referrer).pathname.slice(0, 100);
  $('ts').value = Date.now();
  if (location.protocol === 'file:') { $('fbfile').hidden = false; btn.disabled = true; }
  f.addEventListener('submit', function (e) {
    e.preventDefault(); var m = $('message').value.trim(), em = $('email').value.trim();
    if (m.length < 5) { msg.textContent = T.short; msg.className = 'note err'; $('message').focus(); return; }
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { msg.textContent = T.mail; msg.className = 'note err'; return; }
    var data = {}; new FormData(f).forEach(function (v, k) { data[k] = String(v); }); data.page = document.referrer || '';
    btn.disabled = true; msg.textContent = T.sending; msg.className = 'note';
    fetch(ROOT + 'api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (x) { if (x.s === 200 && x.j.ok) { msg.textContent = T.ok; msg.className = 'note'; f.reset(); $('ts').value = Date.now(); window.__fbResult = 'ok'; } else { msg.textContent = x.s === 429 ? T.rate : (x.j.error || T.err); msg.className = 'note err'; window.__fbResult = x.s; } })
      .catch(function () { msg.textContent = T.err; msg.className = 'note err'; window.__fbResult = 'neterr'; })
      .finally(function () { btn.disabled = false; });
  });
})();
