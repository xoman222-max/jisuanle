/* 發票 QR 解碼 Web Worker：BarcodeDetector（若 Worker 支援）＋ jsQR，全部離開主執行緒，避免畫面卡住變黑 */
importScripts(new URL('../../vendor/jsqr/jsQR.js', self.location).href, new URL('invoice-scan.js', self.location).href);
var S = self.INVSCAN, oc = null, ox = null, det = null;
function detector() {
  if (det !== null) return Promise.resolve(det);
  if (!('BarcodeDetector' in self)) { det = false; return Promise.resolve(false); }
  return BarcodeDetector.getSupportedFormats().then(function (f) { det = f.indexOf('qr_code') >= 0 ? new BarcodeDetector({ formats: ['qr_code', 'code_39'].filter(function (x) { return f.indexOf(x) >= 0; }) }) : false; return det; }).catch(function () { det = false; return false; });
}
function isLeft(t) { var p = S.parseScan(t); return p && !p.ignore; }
// 重複使用同一個 OffscreenCanvas，不每格新建
function grab(src, p) {
  var sc = Math.min(1, p[4] / Math.max(p[2], p[3])), cw = Math.max(1, Math.round(p[2] * sc)), ch = Math.max(1, Math.round(p[3] * sc));
  if (!oc) { oc = new OffscreenCanvas(cw, ch); ox = oc.getContext('2d', { willReadFrequently: true }); }
  if (oc.width !== cw || oc.height !== ch) { oc.width = cw; oc.height = ch; }
  ox.imageSmoothingEnabled = true; ox.imageSmoothingQuality = 'high'; ox.drawImage(src, p[0], p[1], p[2], p[3], 0, 0, cw, ch);
  return [ox.getImageData(0, 0, cw, ch).data, cw, ch];
}
self.onmessage = function (e) {
  var m = e.data, bmp = m.bmp, out = [];
  var fin = function () { try { if (bmp && bmp.close) bmp.close(); } catch (x) {} self.postMessage({ id: m.id, texts: out, native: !!det }); };
  (m.native ? detector() : Promise.resolve(false)).then(function (d) {
    if (!d || !bmp) return [];
    return d.detect(bmp).then(function (r) { return r.map(function (x) { return x.rawValue; }); }).catch(function () { return []; });
  }).then(function (nat) {
    out = nat;
    if (nat.some(isLeft) || (m.skipJs && det)) return;
    var plans = m.plans;
    for (var i = 0; i < plans.length && !out.some(isLeft); i++) {
      var g;
      if (bmp) g = grab(bmp, plans[i]); else g = [new Uint8ClampedArray(m.buf), m.w, m.h];
      out = out.concat(S.jsqrMulti(self.jsQR, g[0], g[1], g[2]));
      if (!bmp) break;
    }
  }).catch(function () {}).then(fin);
};
