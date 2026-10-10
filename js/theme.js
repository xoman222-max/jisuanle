/* 深色模式切換：預設跟隨系統（prefers-color-scheme），手動選擇存在 localStorage */
(function () { var b = document.getElementById('theme'); if (!b) return; b.addEventListener('click', function () {
  var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), nx = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nx); try { localStorage.setItem('theme', nx); } catch (e) {} }); })();
