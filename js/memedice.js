/* 梗圖產生器：🎲 隨機文案（分類、鎖定上/下、避免重複） */
(function () {
  var L = window.MEMECAPS, top = document.getElementById('top'), bot = document.getElementById('bottom'); if (!L || !top || !bot) return;
  var CN = document.documentElement.lang.indexOf('Hans') > 0;
  var CATS = [['all', '全部'], ['work', '上班'], ['school', CN ? '学生' : '學生'], ['life', '生活'], ['love', CN ? '爱情' : '愛情'], ['pet', CN ? '宠物' : '寵物'], ['nonsense', CN ? '废话' : '幹話']];
  var box = document.createElement('div'); box.className = 'f dice'; box.style.gridColumn = '1/-1';
  box.innerHTML = '<label>' + (CN ? '没灵感？随机文案' : '沒靈感？隨機文案') + '</label><div class="chips" id="dcats">' + CATS.map(function (c, i) { return '<button type="button" class="chip' + (i ? '' : ' on') + '" data-cat="' + c[0] + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + c[1] + '</button>'; }).join('') + '</div>'
    + '<div class="dicerow"><button type="button" id="dice" class="btn">🎲 ' + (CN ? '随机一句' : '隨機一句') + '</button><label class="chk"><input type="checkbox" id="locktop"> ' + (CN ? '锁定上方' : '鎖定上方') + '</label><label class="chk"><input type="checkbox" id="lockbot"> ' + (CN ? '锁定下方' : '鎖定下方') + '</label></div><small class="note" id="dicehint"></small>';
  top.closest('.f').parentNode.insertBefore(box, top.closest('.f'));
  var cat = 'all', recent = [];
  box.querySelector('#dcats').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; cat = b.getAttribute('data-cat'); [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); roll(); });
  function pool() { var out = []; Object.keys(L).forEach(function (k) { if (cat === 'all' || k === cat) L[k].forEach(function (p) { out.push(p); }); }); return out; }
  function roll() {
    var P = pool(); if (!P.length) return; var lt = document.getElementById('locktop').checked, lb = document.getElementById('lockbot').checked, p, key, n = 0;
    do { p = P[Math.floor(Math.random() * P.length)]; key = p.join('|'); n++; } while (recent.indexOf(key) >= 0 && n < 50);
    recent.push(key); if (recent.length > Math.min(30, Math.floor(P.length / 2))) recent.shift();
    if (lt && lb) return; if (lt) { if (!p[1]) return roll(); bot.value = p[1]; } else if (lb) { top.value = p[0] || p[1]; } else { top.value = p[0]; bot.value = p[1]; }
    window.__diceCount = (window.__diceCount || 0) + 1;
    var hasImg = (window.__testFiles && window.__testFiles.length) || ((document.getElementById('files') || {}).files || []).length;
    document.getElementById('dicehint').textContent = hasImg ? '' : (CN ? '先选一张图片，就会立即套用文案。' : '先選一張圖片，就會立即套用文案。');
    if (hasImg) document.getElementById('go').click();
  }
  document.getElementById('dice').addEventListener('click', roll);
  window.__memeRoll = roll;
})();
