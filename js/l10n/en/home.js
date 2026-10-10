/* 首頁拖放區：選圖 → 選工具 → 交給工具頁 */
(function () {
  var dz = document.getElementById('dz'); if (!dz) return;
  var inp = document.getElementById('dzfile'), img = document.getElementById('dzimg'), nm = document.getElementById('dzname'), file = null;
  function set(f) { if (!f || !/^image\/|\.hei[cf]$/i.test(f.type || f.name)) return; file = f; img.src = URL.createObjectURL(f); nm.textContent = (f.name || 'image') + ' | ' + (f.size / 1024).toFixed(0) + ' KB'; dz.classList.add('has'); window.__dzFile = f.name || 'pasted'; }
  dz.addEventListener('click', function (e) { if (e.target.closest('button')) return; inp.click(); });
  dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
  inp.addEventListener('change', function () { set(inp.files[0]); });
  ['dragenter', 'dragover'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
  dz.addEventListener('drop', function (e) { set(e.dataTransfer.files[0]); });
  document.addEventListener('paste', function (e) { var it = [].slice.call((e.clipboardData || {}).items || []).find(function (i) { return i.type.indexOf('image/') === 0; }); if (it) set(it.getAsFile()); });
  window.__dzSet = set;
  [].forEach.call(document.querySelectorAll('.sendto button'), function (b) { b.addEventListener('click', function () { if (!file) return; b.disabled = true; Handoff.put(file).then(function () { location.href = b.getAttribute('data-href'); }); }); });
})();
