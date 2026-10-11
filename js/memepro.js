/* 梗圖進階：字型選擇（自架 woff2，選用時才下載）、描邊粗細、貼圖圖層（拖曳／縮放／旋轉／觸控），全部在瀏覽器內處理 */
(function () {
  var box = document.querySelector('[data-imgtool="meme"]'), D = window.MEMEX_DATA; if (!box || !D) return;
  var ED = document.body.getAttribute('data-ed') || 'tw', ROOT = document.body.getAttribute('data-root') || './', S = D.S[ED] || D.S.en;
  var $ = function (id) { return document.getElementById(id); };
  var FB = '"Noto Sans TC","Noto Sans SC","PingFang TC","PingFang SC","Hiragino Sans","Apple SD Gothic Neo","Malgun Gothic","Microsoft JhengHei","Microsoft YaHei",Impact,"Arial Black",sans-serif';
  function el(h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; }
  var kb = function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; };
  // ── 控制項 ──
  var list = D.PER[ED] || D.PER.en, def = D.DEF[ED] || '';
  var fsel = el('<div class="f"><label for="mfont">' + S.font + '</label><select id="mfont"><option value="">' + S.sys + '</option>' + list.map(function (id) { var f = D.FONTS[id]; return '<option value="' + id + '"' + (id === def ? ' selected' : '') + '>' + f[1] + ' · ' + kb(f[2]) + '</option>'; }).join('') + '</select><small id="mfontst" class="note" aria-live="polite"></small></div>');
  var sw = el('<div class="f"><label for="msw">' + S.sw + '：<output>12</output></label><input type="range" id="msw" min="0" max="30" step="1" value="12" oninput="this.previousElementSibling.lastChild.value=this.value"></div>');
  var anchor = $('stroke').closest('.f'); anchor.after(sw); $('size').closest('.f').after(fsel);
  var panel = el('<section class="memex"><h3>' + S.st + '</h3><p class="note">' + S.pv + '</p><div class="stagewrap"><canvas id="mstage" aria-label="preview"></canvas><p id="mpick" class="note">' + S.pick + '</p></div>' +
    '<p><label class="btn ghost" for="stk">' + S.add + '</label><input type="file" id="stk" accept="image/png,image/webp,image/jpeg,image/gif,image/*" multiple hidden></p><ul id="mlayers" class="mlayers"></ul><p class="note">' + S.hint + '</p></section>');
  box.querySelector('.form').after(panel); box.classList.add('memecard');
  // ── 字型載入（含進度） ──
  var loaded = {}, st = $('mfontst');
  function loadFont(id) {
    if (!id || !D.FONTS[id]) return Promise.resolve(false);
    if (loaded[id]) return loaded[id];
    var f = D.FONTS[id];
    loaded[id] = (async function () {
      st.textContent = S.dl + '… 0%';
      var r = await fetch(ROOT + 'fonts/' + id + '.woff2?v=1'); if (!r.ok) throw new Error(r.status);
      var total = +r.headers.get('content-length') || f[2], buf;
      if (r.body && r.body.getReader) {
        var rd = r.body.getReader(), parts = [], n = 0;
        for (;;) { var x = await rd.read(); if (x.done) break; parts.push(x.value); n += x.value.length; st.textContent = S.dl + '… ' + Math.min(99, Math.round(n / total * 100)) + '%（' + kb(n) + ' / ' + kb(total) + '）'; }
        buf = new Uint8Array(n); var o = 0; parts.forEach(function (p) { buf.set(p, o); o += p.length; });
      } else buf = new Uint8Array(await r.arrayBuffer());
      var ff = new FontFace(f[0], buf); await ff.load(); document.fonts.add(ff); st.textContent = '✓ ' + f[1];
      return true;
    })().catch(function (e) { delete loaded[id]; st.textContent = S.ffail; return false; });
    return loaded[id];
  }
  function fontStr(fs, ok) { var id = $('mfont').value; return id && ok !== false && document.fonts.check('12px "' + D.FONTS[id][0] + '"') ? fs + 'px "' + D.FONTS[id][0] + '",' + FB : '900 ' + fs + 'px ' + FB; }
  // ── 貼圖圖層 ──
  var L = [], sel = -1, base = null, uid = 0;
  function addSticker(file) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { var W = base ? base.naturalWidth : 1000, H = base ? base.naturalHeight : 1000, w = W * 0.3; L.push({ id: ++uid, img: im, name: file.name || 'sticker', x: W / 2, y: H / 2, w: w, r: 0, ar: im.naturalHeight / im.naturalWidth }); sel = L.length - 1; ok(); }; im.onerror = function () { ok(); }; im.src = URL.createObjectURL(file); }); }
  $('stk').addEventListener('change', async function () { for (const f of [].slice.call(this.files)) await addSticker(f); this.value = ''; layers(); draw(); });
  function layers() {
    var ul = $('mlayers'); if (!L.length) { ul.innerHTML = '<li class="note">' + S.none + '</li>'; return; }
    ul.innerHTML = L.map(function (s, i) { return '<li data-i="' + i + '"' + (i === sel ? ' class="on"' : '') + '><img src="' + s.img.src + '" alt=""><span>' + (i + 1) + '. ' + s.name.replace(/[<>&"]/g, '') + '</span><button type="button" data-a="up" aria-label="' + S.up + '" title="' + S.up + '">↑</button><button type="button" data-a="down" aria-label="' + S.down + '" title="' + S.down + '">↓</button><button type="button" data-a="rm" aria-label="' + S.rm + '" title="' + S.rm + '">✕</button></li>'; }).reverse().join('');
  }
  $('mlayers').addEventListener('click', function (e) {
    var li = e.target.closest('li[data-i]'); if (!li) return; var i = +li.getAttribute('data-i'), a = e.target.getAttribute('data-a');
    if (a === 'rm') { L.splice(i, 1); sel = -1; } else if (a === 'up' && i < L.length - 1) { L.splice(i + 1, 0, L.splice(i, 1)[0]); sel = i + 1; } else if (a === 'down' && i > 0) { L.splice(i - 1, 0, L.splice(i, 1)[0]); sel = i - 1; } else sel = i;
    layers(); draw();
  });
  // ── 繪製（預覽與輸出共用） ──
  function paintOn(g, W, H, ok) {
    L.forEach(function (s) { var h = s.w * s.ar; g.save(); g.translate(s.x, s.y); g.rotate(s.r); g.drawImage(s.img, -s.w / 2, -h / 2, s.w, h); g.restore(); });
    var fs = W * parseFloat($('size').value) / 100; g.font = fontStr(fs, ok); g.textAlign = 'center'; g.lineJoin = 'round'; g.miterLimit = 2;
    g.lineWidth = fs * parseFloat($('msw').value) / 100; g.strokeStyle = $('stroke').value; g.fillStyle = $('color').value; g.textBaseline = 'alphabetic';
    [[$('top').value, fs * 1.1], [$('bottom').value, H - fs * 0.35]].forEach(function (p) { if (!p[0]) return; if (g.lineWidth > 0) g.strokeText(p[0], W / 2, p[1], W * 0.95); g.fillText(p[0], W / 2, p[1], W * 0.95); });
  }
  var cv = $('mstage'), k = 1;
  function draw() {
    if (!base) { cv.hidden = true; return; } cv.hidden = false; $('mpick').hidden = true;
    var W = base.naturalWidth, H = base.naturalHeight, dpr = window.devicePixelRatio || 1, maxW = (cv.parentNode.clientWidth || 616) - 16, maxH = Math.max(220, Math.min(window.innerHeight * 0.7, window.innerHeight - 190));
    var dw = Math.min(maxW, maxH * W / H), dh = dw * H / W; cv.style.width = dw + 'px'; cv.style.height = dh + 'px';
    cv.width = Math.round(dw * dpr); cv.height = Math.round(dh * dpr); k = cv.width / W;
    var g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.drawImage(base, 0, 0); paintOn(g, W, H);
    if (sel >= 0 && L[sel]) { var s = L[sel], h = s.w * s.ar, u = 1 / k * dpr; g.save(); g.translate(s.x, s.y); g.rotate(s.r); g.strokeStyle = '#3b82f6'; g.lineWidth = 2 * u; g.setLineDash([6 * u, 4 * u]); g.strokeRect(-s.w / 2, -h / 2, s.w, h); g.setLineDash([]);
      g.beginPath(); g.moveTo(0, -h / 2); g.lineTo(0, -h / 2 - 26 * u); g.stroke(); g.fillStyle = '#fff'; [[s.w / 2, h / 2], [0, -h / 2 - 26 * u]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 9 * u, 0, 7); g.fill(); g.stroke(); }); g.fillStyle = '#3b82f6'; g.beginPath(); g.arc(s.w / 2, h / 2, 5 * u, 0, 7); g.fill(); g.restore(); }
  }
  var raf = 0; function redraw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  // ── 指標操作（滑鼠／觸控／觸控筆） ──
  function pt(e) { var r = cv.getBoundingClientRect(), s = base.naturalWidth / r.width; return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s, s: s }; }
  function local(s, p) { var dx = p.x - s.x, dy = p.y - s.y, c = Math.cos(-s.r), n = Math.sin(-s.r); return { x: dx * c - dy * n, y: dx * n + dy * c }; }
  var P = new Map(), act = null;
  cv.addEventListener('pointerdown', function (e) {
    if (!base) return; var p = pt(e); P.set(e.pointerId, p); cv.setPointerCapture(e.pointerId);
    if (P.size === 2 && sel >= 0) { var a = [...P.values()], s = L[sel]; act = { m: 'pinch', d0: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), a0: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x), w0: s.w, r0: s.r }; return; }
    var hr = 16 * p.s;
    if (sel >= 0 && L[sel]) { var s1 = L[sel], q = local(s1, p), h1 = s1.w * s1.ar;
      if (Math.hypot(q.x - s1.w / 2, q.y - h1 / 2) < hr) { act = { m: 'size', w0: s1.w, d0: Math.hypot(p.x - s1.x, p.y - s1.y) }; e.preventDefault(); return; }
      if (Math.hypot(q.x, q.y + h1 / 2 + 26 * p.s) < hr) { act = { m: 'rot' }; e.preventDefault(); return; } }
    sel = -1; for (var i = L.length - 1; i >= 0; i--) { var t = L[i], lq = local(t, p); if (Math.abs(lq.x) <= t.w / 2 && Math.abs(lq.y) <= t.w * t.ar / 2) { sel = i; break; } }
    act = sel >= 0 ? { m: 'move', ox: p.x - L[sel].x, oy: p.y - L[sel].y } : null; layers(); redraw();
  });
  cv.addEventListener('pointermove', function (e) {
    if (!P.has(e.pointerId)) return; var p = pt(e); P.set(e.pointerId, p); if (!act || sel < 0) return; var s = L[sel]; e.preventDefault();
    if (act.m === 'move') { s.x = p.x - act.ox; s.y = p.y - act.oy; }
    else if (act.m === 'size') { s.w = Math.max(10, act.w0 * Math.hypot(p.x - s.x, p.y - s.y) / (act.d0 || 1)); }
    else if (act.m === 'rot') { s.r = Math.atan2(p.y - s.y, p.x - s.x) + Math.PI / 2; if (!e.shiftKey) { var sn = Math.round(s.r / (Math.PI / 4)) * Math.PI / 4; if (Math.abs(s.r - sn) < 0.06) s.r = sn; } }
    else if (act.m === 'pinch' && P.size >= 2) { var a = [...P.values()]; s.w = Math.max(10, act.w0 * Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) / (act.d0 || 1)); s.r = act.r0 + Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) - act.a0; }
    redraw();
  });
  function up(e) { P.delete(e.pointerId); if (P.size < 2 && act && act.m === 'pinch') act = null; if (!P.size) act = null; }
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  document.addEventListener('keydown', function (e) { if (sel >= 0 && (e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) { L.splice(sel, 1); sel = -1; layers(); redraw(); } });
  // ── 底圖、輸入變更 ──
  function loadBase() { var f = (window.__testFiles || [].slice.call($('files').files || []))[0]; if (!f) return; var im = new Image(); im.onload = function () { var old = base; base = im; if (old) { var s = im.naturalWidth / old.naturalWidth; L.forEach(function (t) { t.x *= s; t.y *= im.naturalHeight / old.naturalHeight; t.w *= s; }); } redraw(); }; im.src = URL.createObjectURL(f); }
  $('files').addEventListener('change', loadBase); window.addEventListener('resize', redraw);
  $('mfont').addEventListener('change', function () { var id = this.value; if (!id) { st.textContent = ''; redraw(); return; } loadFont(id).then(redraw); });
  var sig = ''; setInterval(function () { var s = [$('top').value, $('bottom').value, $('size').value, $('color').value, $('stroke').value, $('msw').value].join('|'); if (s !== sig) { sig = s; redraw(); } if (!base && window.__testFiles) loadBase(); }, 250);
  layers(); if (def) loadFont(def).then(redraw);
  // ── 給 imgtools.js 輸出時呼叫：等字型載入後以原始解析度繪製 ──
  window.MemeX = { paint: async function (c) { var ok = await loadFont($('mfont').value); if ($('mfont').value) { try { await document.fonts.load('40px "' + D.FONTS[$('mfont').value][0] + '"', $('top').value + $('bottom').value); } catch (e) {} } paintOn(c.getContext('2d'), c.width, c.height, ok); }, layers: L, loadFont: loadFont };
})();
