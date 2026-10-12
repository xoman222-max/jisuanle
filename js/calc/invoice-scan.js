/* 統一發票 QR Code／條碼掃描對獎：全部在瀏覽器內處理，影像不上傳 */
(function (root) {
  // 由掃描內容取出發票號碼與期別 id（例如 11507 = 115 年 7–8 月）
  function parseScan(t) {
    t = String(t || '').trim();
    if (t.indexOf('**') === 0) return { ignore: true };
    var m = t.match(/^([A-Z]{2})(\d{8})(\d{3})(\d{2})(\d{2})/);
    if (m) { var mo = +m[4]; if (mo >= 1 && mo <= 12) return { num: m[2], track: m[1], date: m[3] + '/' + m[4] + '/' + m[5], pid: m[3] + String(mo % 2 ? mo : mo - 1).padStart(2, '0') }; }
    m = t.match(/^(\d{3})(\d{2})([A-Z]{2})(\d{8})\d{4}$/); // 一維條碼：yyyMM + 字軌號碼 + 隨機碼
    if (m) { var mm = +m[2]; if (mm >= 1 && mm <= 12) return { num: m[4], track: m[3], date: m[1] + '/' + m[2], pid: m[1] + String(mm % 2 ? mm : mm - 1).padStart(2, '0') }; }
    return null;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { parseScan: parseScan }; return; }
  root.INVSCAN = { parseScan: parseScan };
  var box = document.getElementById('scanbox'); if (!box || !root.TWLIFE) return;
  var T = root.TWLIFE, $ = function (id) { return document.getElementById(id); };
  var video = $('scanvid'), list = $('scanlist'), msg = $('scanmsg'), torchBtn = $('scantorch'), stream = null, timer = null, seen = {}, total = 0, count = 0, det = null, jsqrP = null, flip = 0;
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
  // 回傳畫面中所有可讀的碼（原生偵測可一次讀到兩個 QR；jsQR 一次一個，所以輪流掃左半邊與全畫面）
  function decode(src, w, h, full) {
    return detector().then(function (d) {
      if (d) return d.detect(src).then(function (r) { return r.map(function (x) { return x.rawValue; }); });
      return loadJsQR().then(function () {
        var regions = full ? [[0, 0, w / 2 + w / 10, h], [0, 0, w, h], [w / 2, 0, w / 2, h]] : [flip++ % 2 ? [0, 0, w, h] : [0, 0, w / 2 + w / 10, h]], out = [];
        var sc = Math.min(1, 1000 / Math.max(w, h));
        regions.forEach(function (g) {
          var cw = Math.round(g[2] * sc), ch = Math.round(g[3] * sc); cvs.width = cw; cvs.height = ch;
          ctx.drawImage(src, g[0], g[1], g[2], g[3], 0, 0, cw, ch);
          var r = root.jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'dontInvert' });
          if (r && r.data) out.push(r.data);
        });
        return out;
      });
    });
  }
  function beep(ok) {
    try { var A = root.AudioContext || root.webkitAudioContext, a = beep.a || (beep.a = new A()), o = a.createOscillator(), g = a.createGain(); o.frequency.value = ok ? 1320 : 880; g.gain.value = 0.15; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + (ok ? 0.35 : 0.12)); } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(ok ? [80, 60, 80, 60, 200] : 60);
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
      if (per) { var r = T.checkInvoice(p.num, per); if (r) { res = '🎉 ' + r[0] + ' ' + fmt(r[1]) + ' 元'; total += r[1]; cls = 'win'; } else res = '沒中'; beep(!!r); }
      else if (p.pid > latest) { res = '⏳ 尚未開獎'; beep(false); }
      else { res = '超過網站保存期數，請到財政部網站查詢'; beep(false); }
      var row = document.createElement('div'); row.className = 'scanrow ' + cls; row.innerHTML = '<span><b>' + p.track + '-' + p.num + '</b><small>' + ptxt + '（' + p.date + '）</small></span><span>' + res + '</span>';
      list.insertBefore(row, list.firstChild);
      $('scansum').textContent = '已掃 ' + count + ' 張，中獎合計 ' + fmt(total) + ' 元';
      msg.textContent = p.track + '-' + p.num + '：' + res;
    });
    return hit;
  }
  function loop() {
    if (!stream) return;
    if (video.readyState >= 2 && video.videoWidth) decode(video, video.videoWidth, video.videoHeight, false).then(handle).catch(function () {}).then(function () { timer = setTimeout(loop, 250); });
    else timer = setTimeout(loop, 250);
  }
  function stop() { clearTimeout(timer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; video.hidden = true; $('scanstart').hidden = false; $('scanstop').hidden = true; torchBtn.hidden = true; }
  $('scanstart').addEventListener('click', function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = '這個瀏覽器無法開啟相機，請改用「選擇照片」。'; return; }
    msg.textContent = '開啟相機中…';
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
      stream = s; video.srcObject = s; video.hidden = false; video.play(); $('scanstart').hidden = true; $('scanstop').hidden = false;
      msg.textContent = '把發票「左邊」的 QR Code 對準畫面，可連續掃多張';
      var tr = s.getVideoTracks()[0], cap = tr.getCapabilities ? tr.getCapabilities() : {};
      if (cap.torch) { torchBtn.hidden = false; torchBtn.onclick = function () { torchBtn.on = !torchBtn.on; tr.applyConstraints({ advanced: [{ torch: torchBtn.on }] }).catch(function () {}); torchBtn.textContent = torchBtn.on ? '🔦 關閉手電筒' : '🔦 開啟手電筒'; }; }
      loop();
    }).catch(function () { msg.textContent = '無法開啟相機（可能未允許相機權限），請到瀏覽器設定允許，或改用「選擇照片」。'; });
  });
  $('scanstop').addEventListener('click', stop);
  $('scanfile').addEventListener('change', function () {
    var files = [].slice.call(this.files || []); this.value = '';
    files.reduce(function (pr, f) {
      return pr.then(function () {
        return new Promise(function (ok) {
          var img = new Image(); img.onload = function () { decode(img, img.naturalWidth, img.naturalHeight, true).then(function (t) { if (!handle(t)) msg.textContent = (f.name || '照片') + '：找不到發票 QR Code，請拍清楚左邊的 QR Code 再試一次'; }).catch(function () {}).then(function () { URL.revokeObjectURL(img.src); ok(); }); };
          img.onerror = function () { msg.textContent = '無法讀取這張照片'; ok(); }; img.src = URL.createObjectURL(f);
        });
      });
    }, Promise.resolve());
  });
  $('scanclear').addEventListener('click', function () { seen = {}; total = 0; count = 0; list.innerHTML = ''; $('scansum').textContent = ''; msg.textContent = ''; });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
})(this);
