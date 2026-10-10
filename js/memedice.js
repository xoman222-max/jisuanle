/* 梗圖產生器：🎲 隨機文案（分類、鎖定上/下、避免重複） */
(function () {
  var L = window.MEMECAPS, top = document.getElementById('top'), bot = document.getElementById('bottom'); if (!L || !top || !bot) return;
  var CN = document.documentElement.lang.indexOf('Hans') > 0;
  var CATS = [['all', '全部'], ['work', '上班'], ['school', CN ? '学生' : '學生'], ['life', '生活'], ['love', CN ? '爱情' : '愛情'], ['pet', CN ? '宠物' : '寵物'], ['nonsense', CN ? '废话' : '幹話']];
  var box = document.createElement('div'); box.className = 'f dice'; box.style.gridColumn = '1/-1';
  box.innerHTML = '<label>' + (CN ? '没灵感？随机文案' : '沒靈感？隨機文案') + '</label><div class="chips" id="dcats">' + CATS.map(function (c, i) { return '<button type="button" class="chip' + (i ? '' : ' on') + '" data-cat="' + c[0] + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + c[1] + '</button>'; }).join('') + '</div>'
    + '<div class="dicerow"><button type="button" id="dice" class="btn">🎲 ' + (CN ? '随机一句' : '隨機一句') + '</button><label class="chk"><input type="checkbox" id="locktop"> ' + (CN ? '锁定上方' : '鎖定上方') + '</label><label class="chk"><input type="checkbox" id="lockbot"> ' + (CN ? '锁定下方' : '鎖定下方') + '</label></div><small class="note" id="dicehint"></small>';
  top.closest('.f').parentNode.insertBefore(box, top.closest('.f'));
  var cat = 'all', recent = [];
  box.querySelector('#dcats').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; cat = b.getAttribute('data-cat'); [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); roll(); });
  function pool() { var out = []; Object.keys(L).forEach(function (k) { if (cat === 'all' || k === cat) L[k].forEach(function (p) { out.push(p); }); }); return out; }
  function roll() {
    var P = pool(); if (!P.length) return; var lt = document.getElementById('locktop').checked, lb = document.getElementById('lockbot').checked, p, key, n = 0;
    do { p = P[Math.floor(Math.random() * P.length)]; key = p.join('|'); n++; } while (recent.indexOf(key) >= 0 && n < 50);
    recent.push(key); if (recent.length > Math.min(30, Math.floor(P.length / 2))) recent.shift();
    if (lt && lb) return; if (lt) { if (!p[1]) return roll(); bot.value = p[1]; } else if (lb) { top.value = p[0] || p[1]; } else { top.value = p[0]; bot.value = p[1]; }
    window.__diceCount = (window.__diceCount || 0) + 1;
    var hasImg = (window.__testFiles && window.__testFiles.length) || ((document.getElementById('files') || {}).files || []).length;
    document.getElementById('dicehint').textContent = hasImg ? '' : (CN ? '先选一张图片，就会立即套用文案。' : '先選一張圖片，就會立即套用文案。');
    if (hasImg) document.getElementById('go').click();
  }
  document.getElementById('dice').addEventListener('click', roll);
  window.__memeRoll = roll;
})();
/* 🤖 AI 看圖配梗：縮圖（≤512px、≤200KB JPEG）→ POST /api/meme-caption → 3 組文案 */
(function () {
  var top = document.getElementById('top'), bot = document.getElementById('bottom'), dice = document.querySelector('.dice'); if (!top) return;
  if (!dice) { dice = document.createElement('div'); dice.className = 'f dice'; dice.style.gridColumn = '1/-1'; top.closest('.f').parentNode.insertBefore(dice, top.closest('.f')); }
  var CN = document.documentElement.lang.indexOf('Hans') > 0, FILE = location.protocol === 'file:';
  var box = document.createElement('div'); box.className = 'aicap';
  box.innerHTML = '<button type="button" id="aicap" class="btn secondary"' + (FILE ? ' disabled' : '') + '>🤖 ' + (CN ? 'AI 看图配梗' : 'AI 看圖配梗') + '</button> <small class="note" id="aimsg">'
    + (FILE ? (CN ? '本地打开（file://）时无法使用 AI，请在 jisuanle.com 网站上使用。' : '本機開啟（file://）時無法使用 AI，請在 jisuanle.com 網站上使用。')
      : (CN ? '会把缩小后的图片上传到 Cloudflare Workers AI 分析，仅用于生成文案、不会保存。' : '會把縮小後的圖片上傳到 Cloudflare Workers AI 分析，只用來產生文案、不會保存。')) + '</small> <small class="aiq" id="aiq" hidden></small><div class="chips" id="aichips"></div>';
  dice.appendChild(box);
  var msg = box.querySelector('#aimsg'), chips = box.querySelector('#aichips'), btn = box.querySelector('#aicap');
  var QMSG = CN ? '今日 AI 额度已用完，明天再来吧！（骰子随机梗仍可使用）' : '今日 AI 額度已用完，明天再來吧！（骰子隨機梗仍可使用）';
  function tpeDay() { return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); }
  function quotaOut() { btn.disabled = true; btn.setAttribute('data-quota', '1'); msg.textContent = QMSG; }
  var qel = box.querySelector('#aiq');
  function showQ(rem, cap) { if (rem == null || !cap) return; qel.hidden = false; qel.textContent = (CN ? '今日剩余 AI 次数：' : '今日剩餘 AI 次數：') + rem + ' / ' + cap; window.__aiRemain = rem; if (rem <= 0) { try { localStorage.setItem('aiQuotaDay', tpeDay()); } catch (e) {} quotaOut(); } }
  try { if (!FILE && localStorage.getItem('aiQuotaDay') === tpeDay()) quotaOut(); } catch (e) {}
  if (!FILE) fetch((document.body.getAttribute('data-root') || '/') + 'api/meme-caption/quota').then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { if (j.remaining > 0) { try { localStorage.removeItem('aiQuotaDay'); } catch (e) {} if (btn.getAttribute('data-quota')) { btn.disabled = false; btn.removeAttribute('data-quota'); } } showQ(j.remaining, j.cap); } }).catch(function () {});
  function file() { var f = (window.__testFiles && window.__testFiles[0]) || ((document.getElementById('files') || {}).files || [])[0]; return f; }
  function shrink(f) {
    return new Promise(function (ok, no) { var u = URL.createObjectURL(f), im = new Image(); im.onload = function () { URL.revokeObjectURL(u); var s = Math.min(1, 512 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * s)); c.height = Math.max(1, Math.round(im.naturalHeight * s)); var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); var q = 0.82, d; do { d = c.toDataURL('image/jpeg', q); q -= 0.12; } while (d.length > 270000 && q > 0.3); ok(d); }; im.onerror = no; im.src = u; });
  }
  function apply(c) { top.value = c.top; bot.value = c.bottom; if (file()) document.getElementById('go').click(); }
  btn.addEventListener('click', async function () {
    var f = file(); if (!f) { msg.textContent = CN ? '请先选择一张图片。' : '請先選擇一張圖片。'; return; }
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); chips.innerHTML = ''; msg.textContent = CN ? 'AI 正在看图想梗…（约 3–10 秒）' : 'AI 正在看圖想梗…（約 3–10 秒）';
    try {
      var img = await shrink(f), r = await fetch((document.body.getAttribute('data-root') || '/') + 'api/meme-caption', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: img, lang: document.body.getAttribute('data-ed') || (CN ? 'cn' : 'tw') }) });
      var j = {}; try { j = await r.json(); } catch (e) {}
      if (j.cap) showQ(j.remaining, j.cap);
      if (j.code === 'quota' || j.code === 'ai_quota') { try { localStorage.setItem('aiQuotaDay', tpeDay()); } catch (e) {} quotaOut(); window.__aiErr = QMSG; btn.removeAttribute('aria-busy'); return; }
      if (!r.ok || !j.ok || !j.captions || !j.captions.length) throw new Error(j.error || (CN ? 'AI 暂时无法响应，请稍后再试' : 'AI 暫時無法回應，請稍後再試'));
      chips.innerHTML = ''; j.captions.forEach(function (c) { var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = (c.top ? c.top + ' ／ ' : '') + c.bottom; b.onclick = function () { apply(c); }; chips.appendChild(b); });
      apply(j.captions[0]); msg.textContent = CN ? '点下面任一组文案即可套用：' : '點下面任一組文案即可套用：'; window.__aiCaps = j.captions;
    } catch (e) { msg.textContent = e.message; window.__aiErr = e.message; }
    btn.disabled = false; btn.removeAttribute('aria-busy');
  });
})();
