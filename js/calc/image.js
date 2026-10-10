/* 圖片放大：尺寸規劃、分塊、銳化（純函式，可在 Node 測試） */
(function (root) {
  // 輸出尺寸；maxOut 限制輸出最長邊，超過則回傳 null
  function outDims(w, h, scale, maxOut) {
    if (!(w > 0 && h > 0) || [2, 3, 4].indexOf(scale) < 0) return null;
    var W = Math.round(w * scale), H = Math.round(h * scale);
    if (maxOut && Math.max(W, H) > maxOut) return null;
    return { width: W, height: H };
  }
  // 多步縮放：每步最多 2 倍，最後一步到目標
  function steps(w, h, W, H) {
    var out = [], cw = w, ch = h;
    while (cw * 2 < W || ch * 2 < H) { cw = Math.min(W, cw * 2); ch = Math.min(H, ch * 2); out.push([cw, ch]); }
    out.push([W, H]); return out;
  }
  // 把大於 maxSide 的輸入等比例縮小
  function fitInput(w, h, maxSide) { var s = Math.min(1, maxSide / Math.max(w, h)); return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)), scaled: s < 1 }; }
  // 分塊：tile 大小、pad 重疊；回傳每塊 {x,y,w,h, px,py,pw,ph}（p* 為含重疊的讀取區）
  function tiles(w, h, tile, pad) {
    var out = [];
    for (var y = 0; y < h; y += tile) for (var x = 0; x < w; x += tile) {
      var tw = Math.min(tile, w - x), th = Math.min(tile, h - y);
      var px = Math.max(0, x - pad), py = Math.max(0, y - pad), pw = Math.min(w, x + tw + pad) - px, ph = Math.min(h, y + th + pad) - py;
      out.push({ x: x, y: y, w: tw, h: th, px: px, py: py, pw: pw, ph: ph });
    }
    return out;
  }
  // 反銳化遮罩（3x3 box blur），amount 0~2；data 為 RGBA Uint8ClampedArray
  function unsharp(data, w, h, amount) {
    var out = new Uint8ClampedArray(data.length); if (!(amount > 0)) { out.set(data); return out; }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      for (var c = 0; c < 3; c++) {
        var s = 0, n = 0;
        for (var dy = -1; dy <= 1; dy++) { var yy = y + dy; if (yy < 0 || yy >= h) continue; for (var dx = -1; dx <= 1; dx++) { var xx = x + dx; if (xx < 0 || xx >= w) continue; s += data[(yy * w + xx) * 4 + c]; n++; } }
        out[i + c] = data[i + c] + amount * (data[i + c] - s / n);
      }
      out[i + 3] = data[i + 3];
    }
    return out;
  }
  // RGBA -> NCHW float32 [0,1]，與反向
  function toCHW(data, w, h) { var n = w * h, f = new Float32Array(3 * n); for (var k = 0; k < n; k++) { f[k] = data[k * 4] / 255; f[n + k] = data[k * 4 + 1] / 255; f[2 * n + k] = data[k * 4 + 2] / 255; } return f; }
  function fromCHW(f, w, h) { var n = w * h, d = new Uint8ClampedArray(n * 4); for (var k = 0; k < n; k++) { d[k * 4] = f[k] * 255; d[k * 4 + 1] = f[n + k] * 255; d[k * 4 + 2] = f[2 * n + k] * 255; d[k * 4 + 3] = 255; } return d; }
  var api = { outDims: outDims, resizeSteps: steps, fitInput: fitInput, tiles: tiles, unsharp: unsharp, toCHW: toCHW, fromCHW: fromCHW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.ImgCalc = api; }
})(this);
