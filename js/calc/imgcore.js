/* 圖片工具核心純函式：ZIP、EXIF、ICO、PDF、調色盤、濾鏡、馬賽克、版面計算（Node 可測） */
(function (root) {
  var enc = function (s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); };
  // ---------- CRC32 / ZIP（STORE，不壓縮；圖片本身已壓縮） ----------
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc(f.name), d = f.data, crc = crc32(d), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, name.length, true);
      var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      parts.push(new Uint8Array(h.buffer), name, d); central.push(new Uint8Array(c.buffer), name); off += 30 + name.length + d.length;
    });
    var cs = central.reduce(function (a, b) { return a + b.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return concat(parts.concat(central, [new Uint8Array(e.buffer)]));
  }
  function concat(arr) { var n = arr.reduce(function (a, b) { return a + b.length; }, 0), o = new Uint8Array(n), p = 0; arr.forEach(function (a) { o.set(a, p); p += a.length; }); return o; }
  // ---------- EXIF（JPEG APP1） ----------
  var TAGS = { 0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation', 0x0131: 'Software', 0x0132: 'DateTime', 0x9003: 'DateTimeOriginal', 0x829A: 'ExposureTime', 0x829D: 'FNumber', 0x8827: 'ISO', 0x920A: 'FocalLength', 0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension', 0xA434: 'LensModel' };
  function parseExif(u8) {
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    var p = 2;
    while (p + 4 < u8.length && u8[p] === 0xFF) {
      var m = u8[p + 1], len = (u8[p + 2] << 8) | u8[p + 3];
      if (m === 0xE1 && u8[p + 4] === 0x45 && u8[p + 5] === 0x78 && u8[p + 6] === 0x69 && u8[p + 7] === 0x66) return readTiff(u8, p + 10);
      if (m === 0xDA) break; p += 2 + len;
    }
    return {};
  }
  function readTiff(u8, t) {
    var dv = new DataView(u8.buffer, u8.byteOffset), le = dv.getUint16(t) === 0x4949, out = {};
    var u16 = function (o) { return dv.getUint16(t + o, le); }, u32 = function (o) { return dv.getUint32(t + o, le); };
    var SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    function val(e) {
      var type = u16(e + 2), cnt = u32(e + 4), size = SZ[type] * cnt, vo = size > 4 ? u32(e + 8) : e + 8;
      if (type === 2) { var s = ''; for (var k = 0; k < cnt - 1; k++) s += String.fromCharCode(u8[t + vo + k]); return s.trim(); }
      var one = function (o) { return type === 3 ? u16(o) : type === 4 ? u32(o) : type === 5 ? u32(o) / u32(o + 4) : type === 10 ? dv.getInt32(t + o, le) / dv.getInt32(t + o + 4, le) : u8[t + o]; };
      if (cnt === 1) return one(vo); var a = []; for (k = 0; k < cnt; k++) a.push(one(vo + k * SZ[type])); return a;
    }
    function ifd(o, gps) {
      var n = u16(o); for (var i = 0; i < n; i++) {
        var e = o + 2 + i * 12, tag = u16(e);
        if (tag === 0x8769) ifd(u32(e + 8)); else if (tag === 0x8825) { out.GPS = {}; ifd2(u32(e + 8)); }
        else if (TAGS[tag]) out[TAGS[tag]] = val(e);
      }
      function ifd2(g) { var m = u16(g); for (var j = 0; j < m; j++) { var e2 = g + 2 + j * 12, tg = u16(e2); out.GPS[tg] = val(e2); } }
    }
    ifd(u32(4));
    if (out.GPS && out.GPS[2] && out.GPS[4]) { var dms = function (a) { return a[0] + a[1] / 60 + a[2] / 3600; }; out.GPSLatitude = dms(out.GPS[2]) * (out.GPS[1] === 'S' ? -1 : 1); out.GPSLongitude = dms(out.GPS[4]) * (out.GPS[3] === 'W' ? -1 : 1); }
    delete out.GPS; return out;
  }
  // 移除 JPEG 的 APP1–APP15 與 COM 區段（無損，保留 APP0/JFIF）
  function stripJpegMeta(u8) {
    if (u8[0] !== 0xFF || u8[1] !== 0xD8) return null;
    var keep = [u8.subarray(0, 2)], p = 2;
    while (p + 4 <= u8.length) {
      if (u8[p] !== 0xFF) return null;
      var m = u8[p + 1];
      if (m === 0xDA) { keep.push(u8.subarray(p)); break; }
      var len = (u8[p + 2] << 8) | u8[p + 3];
      if (!((m >= 0xE1 && m <= 0xEF) || m === 0xFE)) keep.push(u8.subarray(p, p + 2 + len));
      p += 2 + len;
    }
    return concat(keep);
  }
  // ---------- ICO（內嵌 PNG） ----------
  function makeIco(list) { // [{size, data:Uint8Array(PNG)}]
    var h = new DataView(new ArrayBuffer(6 + 16 * list.length)), off = 6 + 16 * list.length;
    h.setUint16(2, 1, true); h.setUint16(4, list.length, true);
    list.forEach(function (it, i) { var b = 6 + i * 16; h.setUint8(b, it.size >= 256 ? 0 : it.size); h.setUint8(b + 1, it.size >= 256 ? 0 : it.size); h.setUint16(b + 4, 1, true); h.setUint16(b + 6, 32, true); h.setUint32(b + 8, it.data.length, true); h.setUint32(b + 12, off, true); off += it.data.length; });
    return concat([new Uint8Array(h.buffer)].concat(list.map(function (x) { return x.data; })));
  }
  // ---------- PDF（每頁一張 JPEG，DCTDecode） ----------
  function makePdf(pages) { // [{jpeg, w, h, pw, ph}] pw/ph 為頁面尺寸(pt)；圖片置中等比縮放
    var objs = [], kids = [], n = 3;
    pages.forEach(function (pg) {
      var mg = pg.m || 0, s = Math.min((pg.pw - 2 * mg) / pg.w, (pg.ph - 2 * mg) / pg.h), dw = pg.w * s, dh = pg.h * s, x = (pg.pw - dw) / 2, y = (pg.ph - dh) / 2;
      var content = 'q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im0 Do Q';
      var pid = n, cid = n + 1, iid = n + 2; n += 3; kids.push(pid + ' 0 R');
      objs.push([pid, enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pg.pw.toFixed(2) + ' ' + pg.ph.toFixed(2) + '] /Resources << /XObject << /Im0 ' + iid + ' 0 R >> >> /Contents ' + cid + ' 0 R >>')]);
      objs.push([cid, enc('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream')]);
      objs.push([iid, concat([enc('<< /Type /XObject /Subtype /Image /Width ' + pg.w + ' /Height ' + pg.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + pg.jpeg.length + ' >>\nstream\n'), pg.jpeg, enc('\nendstream')])]);
    });
    objs.unshift([2, enc('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>')]);
    objs.unshift([1, enc('<< /Type /Catalog /Pages 2 0 R >>')]);
    var out = [enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], pos = out[0].length, xref = [];
    objs.forEach(function (o) { xref[o[0]] = pos; var b = concat([enc(o[0] + ' 0 obj\n'), o[1], enc('\nendobj\n')]); out.push(b); pos += b.length; });
    var x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n'; for (var i = 1; i <= objs.length; i++) x += ('000000000' + xref[i]).slice(-10) + ' 00000 n \n';
    out.push(enc(x + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + pos + '\n%%EOF\n'));
    return concat(out);
  }
  // ---------- 顏色 ----------
  function hex(r, g, b) { return '#' + [r, g, b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('').toUpperCase(); }
  function hsl(r, g, b) { r /= 255; g /= 255; b /= 255; var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) { s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]; }
  // 中位切分調色盤
  function palette(data, k, step) {
    var px = []; step = step || 4;
    for (var i = 0; i < data.length; i += 4 * step) if (data[i + 3] > 127) px.push([data[i], data[i + 1], data[i + 2]]);
    if (!px.length) return [];
    var boxes = [px];
    while (boxes.length < k) {
      var bi = -1, br = -1, bc = 0;
      boxes.forEach(function (b, j) { if (b.length < 2) return; for (var c = 0; c < 3; c++) { var mn = 255, mx = 0; b.forEach(function (p) { if (p[c] < mn) mn = p[c]; if (p[c] > mx) mx = p[c]; }); if (mx - mn > br) { br = mx - mn; bi = j; bc = c; } } });
      if (bi < 0 || br === 0) break;
      var b = boxes[bi].sort(function (x, y) { return x[bc] - y[bc]; }), cut = (b[0][bc] + b[b.length - 1][bc]) / 2, mid = 0; while (mid < b.length && b[mid][bc] <= cut) mid++; if (mid === 0 || mid === b.length) mid = b.length >> 1;
      boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
    }
    return boxes.map(function (b) { var s = [0, 0, 0]; b.forEach(function (p) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }); return { hex: hex(s[0] / b.length, s[1] / b.length, s[2] / b.length), count: b.length }; })
      .sort(function (a, b) { return b.count - a.count; });
  }
  // ---------- 像素濾鏡（不依賴 ctx.filter，Safari 也可用） ----------
  function applyFilters(data, o) { // o: brightness, contrast, saturate (1=原始), grayscale, sepia (0~1), invert(bool)
    var out = new Uint8ClampedArray(data.length), br = o.brightness == null ? 1 : o.brightness, ct = o.contrast == null ? 1 : o.contrast, st = o.saturate == null ? 1 : o.saturate, gs = o.grayscale || 0, sp = o.sepia || 0;
    for (var i = 0; i < data.length; i += 4) {
      var r = data[i] * br, g = data[i + 1] * br, b = data[i + 2] * br;
      r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; b = (b - 128) * ct + 128;
      var L = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = L + (r - L) * st; g = L + (g - L) * st; b = L + (b - L) * st;
      if (gs) { L = 0.2126 * r + 0.7152 * g + 0.0722 * b; r += (L - r) * gs; g += (L - g) * gs; b += (L - b) * gs; }
      if (sp) { var sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b; r += (sr - r) * sp; g += (sg - g) * sp; b += (sb - b) * sp; }
      if (o.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = data[i + 3];
    }
    return out;
  }
  // 馬賽克：在 (x,y,w,h) 區域以 block 大小取平均
  function pixelate(data, W, H, rect, block) {
    var out = new Uint8ClampedArray(data); block = Math.max(2, block | 0);
    var x0 = Math.max(0, rect.x | 0), y0 = Math.max(0, rect.y | 0), x1 = Math.min(W, (rect.x + rect.w) | 0), y1 = Math.min(H, (rect.y + rect.h) | 0);
    for (var by = y0; by < y1; by += block) for (var bx = x0; bx < x1; bx += block) {
      var ex = Math.min(x1, bx + block), ey = Math.min(y1, by + block), s = [0, 0, 0, 0], n = 0;
      for (var y = by; y < ey; y++) for (var x = bx; x < ex; x++) { var i = (y * W + x) * 4; s[0] += data[i]; s[1] += data[i + 1]; s[2] += data[i + 2]; s[3] += data[i + 3]; n++; }
      for (y = by; y < ey; y++) for (x = bx; x < ex; x++) { i = (y * W + x) * 4; out[i] = s[0] / n; out[i + 1] = s[1] / n; out[i + 2] = s[2] / n; out[i + 3] = s[3] / n; }
    }
    return out;
  }
  // ---------- 版面 ----------
  function gridRects(w, h, rows, cols) { var out = [], cw = w / cols, ch = h / rows; for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { var x = Math.round(c * cw), y = Math.round(r * ch); out.push({ row: r + 1, col: c + 1, x: x, y: y, w: Math.round((c + 1) * cw) - x, h: Math.round((r + 1) * ch) - y }); } return out; }
  // 拼接：sizes [{w,h}], dir 'v'|'h'|'grid', gap, cols, target 寬（v）或高（h）
  function stitchLayout(sizes, dir, gap, cols, target) {
    gap = gap || 0; var items = [], W = 0, H = 0;
    if (dir === 'h') { var th = target || Math.min.apply(null, sizes.map(function (s) { return s.h; })), x = 0; sizes.forEach(function (s) { var w = Math.round(s.w * th / s.h); items.push({ x: x, y: 0, w: w, h: th }); x += w + gap; }); W = x - gap; H = th; }
    else if (dir === 'grid') { cols = Math.max(1, cols || 2); var cell = target || Math.min.apply(null, sizes.map(function (s) { return Math.min(s.w, s.h); })); sizes.forEach(function (s, i) { items.push({ x: (i % cols) * (cell + gap), y: Math.floor(i / cols) * (cell + gap), w: cell, h: cell, cover: true }); }); var rows = Math.ceil(sizes.length / cols); W = Math.min(cols, sizes.length) * (cell + gap) - gap; H = rows * (cell + gap) - gap; }
    else { var tw = target || Math.min.apply(null, sizes.map(function (s) { return s.w; })), y = 0; sizes.forEach(function (s) { var h = Math.round(s.h * tw / s.w); items.push({ x: 0, y: y, w: tw, h: h }); y += h + gap; }); W = tw; H = y - gap; }
    return { width: W, height: H, items: items };
  }
  // 依模式計算縮放：cover（裁切填滿）/contain（留白）/stretch
  function fitRect(sw, sh, tw, th, mode) {
    if (mode === 'stretch') return { sx: 0, sy: 0, sw: sw, sh: sh, dx: 0, dy: 0, dw: tw, dh: th };
    var s = mode === 'contain' ? Math.min(tw / sw, th / sh) : Math.max(tw / sw, th / sh);
    if (mode === 'contain') { var dw = sw * s, dh = sh * s; return { sx: 0, sy: 0, sw: sw, sh: sh, dx: (tw - dw) / 2, dy: (th - dh) / 2, dw: dw, dh: dh }; }
    var cw = tw / s, ch = th / s; return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch, dx: 0, dy: 0, dw: tw, dh: th };
  }
  function mmToPx(mm, dpi) { return Math.round(mm / 25.4 * (dpi || 300)); }
  // 裁切框：比例 ratio(w/h)、zoom(1~)、偏移 ox,oy (-1~1)
  function cropBox(W, H, ratio, zoom, ox, oy) {
    var bw = W, bh = W / ratio; if (bh > H) { bh = H; bw = H * ratio; }
    bw /= zoom || 1; bh /= zoom || 1;
    var x = (W - bw) / 2 * (1 + (ox || 0)), y = (H - bh) / 2 * (1 + (oy || 0));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(bw), h: Math.round(bh) };
  }
  function base64Size(b64) { var s = b64.replace(/^data:[^,]*,/, '').replace(/\s/g, ''); var pad = (s.match(/=+$/) || [''])[0].length; return Math.floor(s.length * 3 / 4) - pad; }
  // u2netp：遮罩正規化到 0~255
  function normMask(f) { var mn = Infinity, mx = -Infinity; for (var i = 0; i < f.length; i++) { if (f[i] < mn) mn = f[i]; if (f[i] > mx) mx = f[i]; } var o = new Uint8ClampedArray(f.length), d = mx - mn || 1; for (i = 0; i < f.length; i++) o[i] = (f[i] - mn) / d * 255; return o; }
  // RGBA → NCHW（ImageNet 正規化）
  function toCHWNorm(data, w, h, mean, std) { var n = w * h, f = new Float32Array(3 * n), mx = 0; for (var k = 0; k < n * 4; k++) if ((k & 3) !== 3 && data[k] > mx) mx = data[k]; mx = mx || 1; for (k = 0; k < n; k++) for (var c = 0; c < 3; c++) f[c * n + k] = (data[k * 4 + c] / mx - mean[c]) / std[c]; return f; }
  var api = { crc32: crc32, makeZip: makeZip, concat: concat, parseExif: parseExif, stripJpegMeta: stripJpegMeta, makeIco: makeIco, makePdf: makePdf, hex: hex, hsl: hsl, palette: palette, applyFilters: applyFilters, pixelate: pixelate, gridRects: gridRects, stitchLayout: stitchLayout, fitRect: fitRect, mmToPx: mmToPx, cropBox: cropBox, base64Size: base64Size, normMask: normMask, toCHWNorm: toCHWNorm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ImgCore = api;
})(this);
