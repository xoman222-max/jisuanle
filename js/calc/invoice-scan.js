/* 統一發票 QR Code／條碼掃描對獎：全部在瀏覽器內處理，影像不上傳 */
(function (root) {
  // 由掃描內容取出發票號碼與期別 id（例如 11507 = 115 年 7–8 月）
  function parseScan(t) {
    t = String(t || '').replace(/[\s\u0000]+/g, '').toUpperCase();
    if (t.indexOf('**') === 0) return { ignore: true };
    var m = t.match(/^([A-Z]{2})(\d{8})(\d{3})(\d{2})(\d{2})/);
    if (m) { var mo = +m[4]; if (mo >= 1 && mo <= 12) return { num: m[2], track: m[1], date: m[3] + '/' + m[4] + '/' + m[5], pid: m[3] + String(mo % 2 ? mo : mo - 1).padStart(2, '0') }; }
    m = t.match(/^(\d{3})(\d{2})([A-Z]{2})(\d{8})\d{4}$/); // 一維條碼：yyyMM + 字軌號碼 + 隨機碼
    if (m) { var mm = +m[2]; if (mm >= 1 && mm <= 12) return { num: m[4], track: m[3], date: m[1] + '/' + m[2], pid: m[1] + String(mm % 2 ? mm : mm - 1).padStart(2, '0') }; }
    return null;
  }
function plans(w, h, photo) {
  var P = [], cx = function (fx, fy, fw, fh, m) { P.push([Math.round(w * fx), Math.round(h * fy), Math.round(w * fw), Math.round(h * fh), m]); };
  if (!photo) { cx(.3, .1, .4, .8, 1200); cx(.2, .15, .6, .7, 1400); cx(0, 0, .55, 1, 1400); cx(0, 0, 1, 1, 1400); return P; }
  cx(0, 0, 1, 1, 1600); cx(0, 0, 1, 1, 800); cx(.2, .2, .6, .6, 1400); for (var gy = 0; gy <= .6; gy += .2) for (var gx = 0; gx <= .6; gx += .2) cx(gx, gy, .4, .4, 800);
  for (var ty = 0; ty <= .71; ty += .175) for (var tx = 0; tx <= .71; tx += .175) cx(tx, ty, .3, .3, 700);
  [[0, 0], [.4, 0], [0, .4], [.4, .4], [.2, .2]].forEach(function (o) { cx(o[0], o[1], .6, .6, 1000); });
  [[0, 0], [.5, 0], [0, .5], [.5, .5], [.25, .25]].forEach(function (o) { cx(o[0], o[1], .5, .5, 900); });
  return P;
}
// jsQR 一次只回傳一個碼：讀到後把該碼塗白再讀一次，最多 3 個
function jsqrMulti(jsQR, d, W, H) {
  var out = [];
  for (var n = 0; n < 3; n++) {
    var r = jsQR(d, W, H, { inversionAttempts: 'attemptBoth' }); if (!r || !r.data && !(r.binaryData && r.binaryData.length)) break;
    out.push(r.data); var L = r.location, xs = [L.topLeftCorner.x, L.topRightCorner.x, L.bottomLeftCorner.x, L.bottomRightCorner.x], ys = [L.topLeftCorner.y, L.topRightCorner.y, L.bottomLeftCorner.y, L.bottomRightCorner.y];
    var pad = (Math.max.apply(0, xs) - Math.min.apply(0, xs)) * 0.12, x0 = Math.max(0, Math.floor(Math.min.apply(0, xs) - pad)), x1 = Math.min(W, Math.ceil(Math.max.apply(0, xs) + pad)), y0 = Math.max(0, Math.floor(Math.min.apply(0, ys) - pad)), y1 = Math.min(H, Math.ceil(Math.max.apply(0, ys) + pad));
    for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) { var k = (y * W + x) * 4; d[k] = d[k + 1] = d[k + 2] = 255; }
  }
  return out;
}
  if (typeof module !== 'undefined' && module.exports) { module.exports = { parseScan: parseScan, plans: plans, jsqrMulti: jsqrMulti }; return; }
  root.INVSCAN = { parseScan: parseScan };
  var box = document.getElementById('scanbox'); if (!box || !root.TWLIFE) return;
  var T = root.TWLIFE, $ = function (id) { return document.getElementById(id); };
  var lastHit = 0, hintAt = 0, video = $('scanvid'), list = $('scanlist'), msg = $('scanmsg'), torchBtn = $('scantorch'), stream = null, timer = null, seen = {}, total = 0, count = 0, det = null, jsqrP = null, flip = 0;
  var cvs = document.createElement('canvas'), ctx = cvs.getContext('2d', { willReadFrequently: true });
  function fmt(n) { return Number(n).toLocaleString('zh-TW'); }
  function loadJsQR() {
    if (root.jsQR) return Promise.resolve(); if (jsqrP) return jsqrP;
    jsqrP = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = (document.body.getAttribute('data-root') || '../') + 'vendor/jsqr/jsQR.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    return jsqrP;
  }
  function detector() {
    if (det !== null) return Promise.resolve(det);
    if (!('BarcodeDetector' in root)) { det = false; return Promise.resolve(false); }
    return BarcodeDetector.getSupportedFormats().then(function (f) { var want = ['qr_code', 'code_39'].filter(function (x) { return f.indexOf(x) >= 0; }); det = f.indexOf('qr_code') >= 0 ? new BarcodeDetector({ formats: want }) : false; return det; }).catch(function () { det = false; return false; });
  }
  function grab(src, p) {
    var sc = Math.min(1, p[4] / Math.max(p[2], p[3])), cw = Math.round(p[2] * sc), ch = Math.round(p[3] * sc); cvs.width = cw; cvs.height = ch;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, p[0], p[1], p[2], p[3], 0, 0, cw, ch);
    return [ctx.getImageData(0, 0, cw, ch).data, cw, ch];
  }
  function isLeft(t) { var p = parseScan(t); return p && !p.ignore; }
  function viaJsQR(src, list) { return loadJsQR().then(function () { var out = []; list.forEach(function (p) { if (out.some(isLeft)) return; var g = grab(src, p); out = out.concat(jsqrMulti(root.jsQR, g[0], g[1], g[2])); }); return out; }); }
  // 原生 BarcodeDetector（全解析度）＋ jsQR（中央裁切／左半／全畫面輪流；照片另試多倍率與分塊）
  function decode(src, w, h, full) {
    var P = plans(w, h, full), jl = full ? P : [P[flip++ % P.length]];
    return detector().then(function (d) {
      if (!d) return [];
      return d.detect(src).then(function (r) { return r.map(function (x) { return x.rawValue; }); }).catch(function () { return []; });
    }).then(function (nat) {
      if (nat.some(isLeft)) return nat;
      return viaJsQR(src, jl).then(function (j) { return nat.concat(j); }, function () { return nat; });
    });
  }
  function handle(texts) {
    var hit = false;
    texts.forEach(function (t) {
      var p = parseScan(t); if (!p || p.ignore) return; hit = true;
      var key = p.track + p.num; if (seen[key]) { msg.textContent = p.track + '-' + p.num + ' 已經掃過了'; return; }
      seen[key] = 1; count++;
      var periods = T.getPeriods(), per = periods.filter(function (x) { return x.id === p.pid; })[0], res, cls = '';
      var latest = periods.reduce(function (a, x) { return x.id > a ? x.id : a; }, '');
      var ptxt = p.pid.slice(0, 3) + '年 ' + p.pid.slice(3) + '~' + String(+p.pid.slice(3) + 1).padStart(2, '0') + '月';
      if (per) { var r = T.checkInvoice(p.num, per); if (r) { res = '🎉 ' + r[0] + ' ' + fmt(r[1]) + ' 元'; total += r[1]; cls = 'win'; } else res = '沒中'; }
      else if (p.pid > latest) { res = '⏳ 尚未開獎'; }
      else { res = '超過網站保存期數，請到財政部網站查詢'; }
      var row = document.createElement('div'); row.className = 'scanrow ' + cls; row.innerHTML = '<span><b>' + p.track + '-' + p.num + '</b><small>' + ptxt + '（' + p.date + '）</small></span><span>' + res + '</span>';
      list.insertBefore(row, list.firstChild);
      $('scansum').textContent = '已掃 ' + count + ' 張，中獎合計 ' + fmt(total) + ' 元';
      msg.textContent = '✅ 已讀取 ' + p.track + p.num + '：' + res; lastHit = Date.now();
    });
    if (!hit && texts.length) { var only = texts.every(function (t) { var q = parseScan(t); return q && q.ignore; }); msg.textContent = only ? '讀到右邊的 QR（品項明細），請改對準發票「左邊」的 QR Code' : '讀到 QR Code，但不是電子發票的格式'; lastHit = Date.now(); }
    return hit;
  }
  function loop() {
    if (!stream) return;
    if (Date.now() - lastHit > 8000 && Date.now() - hintAt > 8000) { hintAt = Date.now(); msg.textContent = '還沒讀到：試著把手機拉遠或靠近一點（約 10–15 公分）、避免反光' + (torchBtn.hidden ? '' : '、開手電筒') + '；或改按「📸 拍照掃描」'; }
    if (video.readyState >= 2 && video.videoWidth) decode(video, video.videoWidth, video.videoHeight, false).then(handle).catch(function () {}).then(function () { timer = setTimeout(loop, 120); });
    else timer = setTimeout(loop, 200);
  }
  function stop() { clearTimeout(timer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; video.hidden = true; $('scanwrap').hidden = true; $('scanstart').hidden = false; $('scanstop').hidden = true; torchBtn.hidden = true; if (ctl) ctl.hidden = true; }
  var ua = navigator.userAgent || '', inApp = /Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|; wv\)/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1), isAnd = /Android/i.test(ua);
  var STEPS = {
    app: ['LINE／FB／IG 內建瀏覽器', '內建瀏覽器常常不能開相機。請點右上角「⋯」或「分享」→ 選「用預設瀏覽器開啟」（Safari 或 Chrome），再按一次「開啟相機掃描」。'],
    ios: ['iPhone／iPad（Safari）', '① 點網址列左側的「大小」或「aA」圖示 → ② 點「網站設定」→ ③「相機」選「允許」→ ④ 回來按「重新嘗試」。<br>若沒有這個選項：打開手機「設定」App → Safari → 相機 → 選「詢問」或「允許」。'],
    and: ['Android（Chrome）', '① 點網址列左邊的「鎖頭」或「設定」圖示 → ② 點「權限」→ ③「相機」選「允許」→ ④ 回來按「重新嘗試」。'],
    pc: ['電腦（Chrome／Edge）', '① 點網址列左邊的圖示（鎖頭或相機）→ ② 「相機」改成「允許」→ ③ 重新整理網頁，再按「開啟相機掃描」。']
  };
  function help(reason) {
    var order = inApp ? ['app', isIOS ? 'ios' : isAnd ? 'and' : 'pc'] : isIOS ? ['ios', 'and', 'pc'] : isAnd ? ['and', 'ios', 'pc'] : ['pc', 'ios', 'and'];
    var h = $('scanhelp'), html = '<p><b>' + reason + '</b></p><p>最簡單的方法：按下方「📸 改用拍照」，用手機拍一張發票左邊的 QR Code 就能對獎，<b>不需要開相機權限</b>。</p>';
    if (reason.indexOf('沒有偵測到相機') < 0) html += order.map(function (k, i) { return i ? '<details><summary>' + STEPS[k][0] + '</summary><p>' + STEPS[k][1] + '</p></details>' : '<p><b>想用即時掃描，請照這樣開啟相機（' + STEPS[k][0] + '）：</b><br>' + STEPS[k][1] + '</p>'; }).join('');
    html += '<div class="scanbtns"><label class="scanpick" role="button">📸 改用拍照<input type="file" class="scanalt" accept="image/*" capture="environment" hidden></label><button type="button" class="secondary scanretry">🔄 重新嘗試</button><button type="button" class="secondary outline scanclose">關閉</button></div>';
    h.innerHTML = html; h.hidden = false; h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    h.querySelector('.scanretry').onclick = function () { h.hidden = true; start(); };
    h.querySelector('.scanclose').onclick = function () { h.hidden = true; };
    h.querySelector('.scanalt').onchange = function () { h.hidden = true; pick(this); };
    msg.textContent = '';
  }
  var BAD = /wide|ultra|tele|depth|macro|超廣|廣角|長焦|望遠|微距|景深/i, rear = [], ctl = null;
  function open(v) { v.width = { ideal: 1920 }; v.height = { ideal: 1080 }; return navigator.mediaDevices.getUserMedia({ video: v, audio: false }); }
  function curId() { var t = stream && stream.getVideoTracks()[0], st = t && t.getSettings ? t.getSettings() : {}; return st.deviceId; }
  function listRear() {
    if (!navigator.mediaDevices.enumerateDevices) return Promise.resolve([]);
    return navigator.mediaDevices.enumerateDevices().then(function (d) {
      var v = d.filter(function (x) { return x.kind === 'videoinput'; }), r = v.filter(function (x) { return /back|rear|environment|後/i.test(x.label); });
      rear = (r.length ? r : v).slice().sort(function (a, b) { return BAD.test(a.label) - BAD.test(b.label); });
      var lb = $('scanlens'); if (lb) lb.hidden = rear.length < 2;
      return rear;
    }).catch(function () { return []; });
  }
  function useCam(id) {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    return open({ deviceId: { exact: id } }).then(setup).catch(function () { msg.textContent = '這個鏡頭無法開啟，請再按一次「切換鏡頭」'; });
  }
  function controls() {
    if (ctl) return ctl;
    ctl = document.createElement('div'); ctl.id = 'scanctl';
    ctl.innerHTML = '<p class="note" id="scanfocushint">點一下畫面可重新對焦</p><button type="button" class="secondary" id="scanlens" hidden>🔄 切換鏡頭</button><label id="scanzoomL" hidden>放大 <input type="range" id="scanzoom"></label><label id="scanfdL" hidden>對焦距離 <input type="range" id="scanfd"></label>';
    $('scanwrap').parentNode.insertBefore(ctl, $('scanwrap').nextSibling);
    $('scanlens').onclick = function () { if (rear.length < 2) return; var i = rear.map(function (c) { return c.deviceId; }).indexOf(curId()); var c = rear[(i + 1) % rear.length]; msg.textContent = '切換到：' + (c.label || '鏡頭 ' + ((i + 1) % rear.length + 1)); useCam(c.deviceId); };
    return ctl;
  }
  function slider(id, lab, c, val, fn) {
    var el = $(id); $(lab).hidden = false; el.min = c.min; el.max = c.max; el.step = c.step || (c.max - c.min) / 100; el.value = val; el.oninput = function () { fn(+el.value); };
  }
  function setup(s) {
    stream = s; video.srcObject = s; video.hidden = false; $('scanwrap').hidden = false; lastHit = hintAt = Date.now(); video.play(); $('scanstart').hidden = true; $('scanstop').hidden = false;
    msg.textContent = '掃描中…請把發票左邊的 QR 對準框內，距離約 10–15 公分';
    controls(); ctl.hidden = false; $('scanzoomL').hidden = $('scanfdL').hidden = true; torchBtn.hidden = true; torchBtn.on = false; torchBtn.textContent = '🔦 開啟手電筒';
    var tr = s.getVideoTracks()[0], cap = tr.getCapabilities ? tr.getCapabilities() : {}, st = tr.getSettings ? tr.getSettings() : {}, fm = cap.focusMode || [];
    var ap = function (o) { return tr.applyConstraints({ advanced: [o] }).catch(function () {}); };
    // 有些手機會忽略初始條件裡的 focusMode，所以串流開始後再套一次
    var cont = function () { if (fm.indexOf('continuous') >= 0) return ap({ focusMode: 'continuous' }); return Promise.resolve(); };
    setTimeout(cont, 300);
    if (cap.zoom && cap.zoom.max > cap.zoom.min) { var z0 = Math.min(cap.zoom.max, Math.max(cap.zoom.min, st.zoom || 1)); slider('scanzoom', 'scanzoomL', cap.zoom, z0, function (v) { ap({ zoom: v }); }); }
    if (cap.focusDistance && fm.indexOf('continuous') < 0 && cap.focusDistance.max > cap.focusDistance.min) slider('scanfd', 'scanfdL', cap.focusDistance, st.focusDistance || cap.focusDistance.min, function (v) { ap({ focusMode: 'manual', focusDistance: v }); });
    video.onclick = function (ev) {
      var r = video.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      msg.textContent = '重新對焦中…';
      if (fm.indexOf('single-shot') >= 0) {
        var o = { focusMode: 'single-shot' }; if (cap.pointsOfInterest || 'pointsOfInterest' in st) o.pointsOfInterest = [{ x: x, y: y }];
        ap(o).then(function () { setTimeout(cont, 1500); });
      } else if (fm.indexOf('continuous') >= 0) {
        ap({ focusMode: fm.indexOf('manual') >= 0 ? 'manual' : 'continuous' }).then(function () { setTimeout(cont, 150); });
      } else msg.textContent = '這個鏡頭不支援自動對焦，試試「切換鏡頭」或把手機拉遠並放大';
      setTimeout(function () { if (msg.textContent === '重新對焦中…') msg.textContent = '掃描中…請把發票左邊的 QR 對準框內，距離約 10–15 公分'; }, 1600);
    };
    if (cap.torch) { torchBtn.hidden = false; torchBtn.onclick = function () { torchBtn.on = !torchBtn.on; ap({ torch: torchBtn.on }); torchBtn.textContent = torchBtn.on ? '🔦 關閉手電筒' : '🔦 開啟手電筒'; }; }
    clearTimeout(timer); loop();
  }
  function start() {
    $('scanhelp').hidden = true;
    if (inApp && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return help('你正在 App 內建瀏覽器中，無法開啟相機。');
    if (!root.isSecureContext) return help('目前網址不是安全連線（https），瀏覽器不允許開相機。');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return help(inApp ? '你正在 App 內建瀏覽器中，無法開啟相機。' : '這個瀏覽器不支援開啟相機。');
    msg.textContent = '開啟相機中…若跳出詢問視窗，請按「允許」';
    // 直接在點擊當下呼叫 getUserMedia，不先 await，確保瀏覽器會跳出權限詢問
    open({ facingMode: { ideal: 'environment' } }).then(function (s) {
      setup(s);
      // Android 常預設超廣角鏡頭（近距離無法對焦）：取得權限後列出後鏡頭，改用主鏡頭
      listRear().then(function (cams) {
        var cur = curId(), bad = /wide|ultra|tele|depth|macro|超廣|廣角|長焦|望遠|微距|景深/i, good = cams.filter(function (c) { return !bad.test(c.label); });
        var curCam = cams.filter(function (c) { return c.deviceId === cur; })[0];
        if (isAnd && curCam && bad.test(curCam.label) && good.length) useCam(good[0].deviceId);
      });
    }).catch(function (e) {
      var n = e && e.name;
      if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') help('沒有偵測到相機。');
      else if (n === 'NotReadableError' || n === 'TrackStartError') help('相機正被其他 App 使用中，請先關掉其他用到相機的 App 再重新嘗試。');
      else if (inApp) help('你正在 App 內建瀏覽器中，相機被擋住了。');
      else help('相機權限被拒絕或被封鎖了。');
    });
  }
  $('scanstart').addEventListener('click', start);
  $('scanstop').addEventListener('click', stop);
  function pick(inp) {
    var files = [].slice.call(inp.files || []); inp.value = '';
    files.reduce(function (pr, f) {
      return pr.then(function () {
        return new Promise(function (ok) {
          var img = new Image(); img.onload = function () { decode(img, img.naturalWidth, img.naturalHeight, true).then(function (t) { if (!handle(t)) msg.textContent = (f.name || '照片') + '：找不到發票 QR Code，請拍清楚左邊的 QR Code 再試一次'; }).catch(function () {}).then(function () { URL.revokeObjectURL(img.src); ok(); }); };
          img.onerror = function () { msg.textContent = '無法讀取這張照片'; ok(); }; img.src = URL.createObjectURL(f);
        });
      });
    }, Promise.resolve());
  }
  $('scanfile').addEventListener('change', function () { pick(this); });
  if ($('scancap')) $('scancap').addEventListener('change', function () { pick(this); });
  $('scanclear').addEventListener('click', function () { seen = {}; total = 0; count = 0; list.innerHTML = ''; $('scansum').textContent = ''; msg.textContent = ''; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
})(this);
