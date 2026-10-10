/* 首頁拖放圖片 → 傳給工具頁（IndexedDB，失敗時改用 sessionStorage；file:// 也可用） */
(function (root) {
  var DB = 'jisuanle', ST = 'h', KEY = 'img';
  function db() { return new Promise(function (ok, no) { try { var r = indexedDB.open(DB, 1); r.onupgradeneeded = function () { r.result.createObjectStore(ST); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; } catch (e) { no(e); } }); }
  function put(file) {
    return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction(ST, 'readwrite'); t.objectStore(ST).put({ blob: file, name: file.name || 'image.png', type: file.type, t: Date.now() }, KEY); t.oncomplete = ok; t.onerror = function () { no(t.error); }; }); })
      .catch(function () { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { try { sessionStorage.setItem('jisuanle-img', JSON.stringify({ url: r.result, name: file.name || 'image.png' })); } catch (e) {} ok(); }; r.readAsDataURL(file); }); });
  }
  function take() {
    return db().then(function (d) { return new Promise(function (ok) { var t = d.transaction(ST, 'readwrite'), s = t.objectStore(ST), g = s.get(KEY); g.onsuccess = function () { var v = g.result; s.delete(KEY); ok(v && Date.now() - v.t < 10 * 60e3 ? new File([v.blob], v.name, { type: v.type || v.blob.type }) : null); }; g.onerror = function () { ok(null); }; }); })
      .catch(function () { return null; })
      .then(function (f) { if (f) return f; var j = null; try { j = JSON.parse(sessionStorage.getItem('jisuanle-img') || 'null'); sessionStorage.removeItem('jisuanle-img'); } catch (e) {} if (!j) return null; return fetch(j.url).then(function (r) { return r.blob(); }).then(function (b) { return new File([b], j.name, { type: b.type }); }); });
  }
  root.Handoff = { put: put, take: take };
  // 工具頁：自動接收首頁傳來的圖片
  document.addEventListener('DOMContentLoaded', function () {
    var inp = document.getElementById('files') || document.getElementById('file'); if (!inp || document.getElementById('dz')) return;
    take().then(function (f) {
      if (!f) return; var CN = document.documentElement.lang.indexOf('Hans') > 0;
      var q = document.getElementById('qmode'); if (q) { q.value = 'read'; q.dispatchEvent(new Event('change', { bubbles: true })); }
      try { var dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; } catch (e) { root.__testFiles = [f]; }
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      var st = document.getElementById('status'); if (st) st.textContent = (CN ? '已载入首页的图片：' : 'Image loaded from the homepage: ') + f.name + (CN ? '，调整选项后按开始。' : '. Adjust the options and press Start.');
      root.__handoff = f.name;
    });
  });
})(this);
