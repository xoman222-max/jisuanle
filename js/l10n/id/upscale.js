/* 圖片放大頁：全部在瀏覽器內處理，不上傳 */
(function () {
  var I = window.ImgCalc, CN = document.documentElement.lang.indexOf('Hans') > 0, ROOT = document.body.getAttribute('data-root') || '/';
  var t = CN ? { pick: '请先选择图片', big: '图片太大，已缩小输入', dl: '下载模型约 4.9 MB（ONNX Runtime 约 11–22 MB），首次使用需下载，之后浏览器会缓存。继续？', load: '加载模型中…', run: '处理中', done: 'Selesai', err: 'AI 处理失败：', fail: '输出尺寸太大，请降低倍数或缩小图片', backend: '运算引擎' }
             : { pick: 'Pilih gambar terlebih dahulu', big: 'Gambar terlalu besar — input diperkecil', dl: 'Perlu mengunduh model AI (~4,9 MB) dan ONNX Runtime (~11–22 MB) pertama kali; browser akan menyimpannya. Lanjutkan?', load: 'Memuat model…', run: 'Memproses', done: 'Selesai', err: 'AI Gagal memproses: ', fail: 'Hasil terlalu besar — kecilkan skala atau pakai gambar lebih kecil', backend: 'Engine' };
  var $ = function (id) { return document.getElementById(id); };
  var mobile = Math.min(screen.width, screen.height) < 820 || /Mobi|Android|iPad|iPhone/.test(navigator.userAgent);
  var MAX_OUT = mobile ? 4096 : 8192, AI_MAX_IN = mobile ? 512 : 1024;
  var src = null, session = null, backend = '';
  function msg(s) { $('status').textContent = s; }
  function prog(p) { $('prog').value = p; }
  $('file').addEventListener('change', function () { var f = this.files[0]; if (!f) return; var img = new Image(); img.onload = function () { src = img; msg(img.naturalWidth + ' × ' + img.naturalHeight); }; img.src = URL.createObjectURL(f); });
  function canvasOf(img, w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h); return c; }
  function basic(img, scale, sharp) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, d = I.outDims(w, h, scale, MAX_OUT); if (!d) throw new Error(t.fail);
    var cur = img; I.resizeSteps(w, h, d.width, d.height).forEach(function (s) { cur = canvasOf(cur, s[0], s[1]); });
    if (sharp > 0) { var g = cur.getContext('2d'), id = g.getImageData(0, 0, d.width, d.height); id.data.set(I.unsharp(id.data, d.width, d.height, sharp)); g.putImageData(id, 0, 0); }
    return cur;
  }
  function loadScript(u) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = u; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  async function getSession() {
    if (session) return session;
    msg(t.load); await loadScript(ROOT + 'vendor/ort/ort.all.min.js');
    ort.env.wasm.wasmPaths = new URL(ROOT + 'vendor/ort/', location.href).href; ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    var eps = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
    session = await ort.InferenceSession.create(new URL(ROOT + 'models/realesr-general-x4v3.onnx', location.href).href, { executionProviders: eps });
    backend = navigator.gpu ? 'WebGPU/WASM' : 'WASM';
    return session;
  }
  async function ai(img) {
    var f = I.fitInput(img.naturalWidth || img.width, img.naturalHeight || img.height, AI_MAX_IN); if (f.scaled) msg(t.big);
    var inC = canvasOf(img, f.width, f.height), g = inC.getContext('2d'), S = 4, s = await getSession();
    var out = document.createElement('canvas'); out.width = f.width * S; out.height = f.height * S; var og = out.getContext('2d');
    var list = I.tiles(f.width, f.height, 128, 8);
    for (var k = 0; k < list.length; k++) {
      var tl = list[k], id = g.getImageData(tl.px, tl.py, tl.pw, tl.ph);
      var input = new ort.Tensor('float32', I.toCHW(id.data, tl.pw, tl.ph), [1, 3, tl.ph, tl.pw]);
      var res = await s.run({ [s.inputNames[0]]: input }), o = res[s.outputNames[0]];
      var W = tl.pw * S, H = tl.ph * S, rgba = I.fromCHW(o.data, W, H), tmp = new ImageData(rgba, W, H);
      og.putImageData(tmp, (tl.px - tl.x) * S + tl.x * S, (tl.py - tl.y) * S + tl.y * S, (tl.x - tl.px) * S, (tl.y - tl.py) * S, tl.w * S, tl.h * S);
      prog((k + 1) / list.length * 100); msg(t.run + ' ' + (k + 1) + '/' + list.length + ' (' + t.backend + ': ' + backend + ')');
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    return out;
  }
  function show(c) {
    var url = c.toDataURL('image/png'); $('after').src = url; $('before').src = canvasOf(src, c.width, c.height).toDataURL('image/jpeg', 0.9);
    $('cmp').hidden = false; c.toBlob(function (b) { $('full').href = URL.createObjectURL(b); }); $('dlpng').href = url; $('dljpg').href = c.toDataURL('image/jpeg', 0.92);
    msg(t.done + ': ' + c.width + ' × ' + c.height + (backend && $('mode').value === 'ai' ? ' (' + backend + ')' : '')); window.__upscaleResult = { width: c.width, height: c.height };
  }
  $('mode').addEventListener('change', function () { $('basicOpts').style.display = this.value === 'ai' ? 'none' : 'contents'; });
  $('go').addEventListener('click', async function () {
    if (!src) { msg(t.pick); return; } prog(0);
    try {
      if ($('mode').value === 'ai' && location.protocol === 'file:') { msg(CN ? 'AI 模式需要通过网站（http/https）打开才能加载模型；直接双击本地文件时请使用快速模式，或打开已部署的网站。' : 'AI  harus dibuka dari situs web (http/https) agar model bisa dimuat. Jika membuka file lokal, gunakan mode cepat atau buka situs resmi.'); return; }
      if ($('mode').value === 'ai') { if (!session && !window.__skipConfirm && !confirm(t.dl)) return; show(await ai(src)); }
      else { show(basic(src, +$('scale').value, +$('sharp').value)); prog(100); }
    } catch (e) { msg(t.err + (e.message || e)); window.__upscaleError = String(e); }
  });
  $('slider').addEventListener('input', function () { $('afterWrap').style.clipPath = 'inset(0 0 0 ' + this.value + '%)'; });
  window.__setSource = function (img) { src = img; };
})();
