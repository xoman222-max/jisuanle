/* reader theme: apply before paint */
(function(){try{var p=JSON.parse(localStorage.getItem("jisuanle.novel.prefs")||"{}")||{};var t=p.theme||(p.night?"night":"white");if(["white","sepia","green","night"].indexOf(t)<0)t="white";document.documentElement.setAttribute("data-theme",t);if(t==="night"&&document.body)document.body.classList.add("night","novel-night");}catch(e){}})();
(function(){
  const KEYS = {
    progress: "jisuanle.novel.progress",
    prefs: "jisuanle.novel.prefs",
    shelf: "jisuanle.novel.shelf",
    lastRead: "jisuanle.novel.lastRead"
  };

  function readJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      return JSON.parse(raw);
    }catch(e){ return fallback; }
  }
  function writeJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  const Novel = {
    getPrefs(){
      return Object.assign({ fontSize: 18, night: false }, readJSON(KEYS.prefs, {}));
    },
    setPrefs(p){ writeJSON(KEYS.prefs, p); },
    applyPrefs(){
      const p = this.getPrefs();
      document.documentElement.style.setProperty("--fs", p.fontSize + "px");
      const theme = this.getTheme(p);
      document.documentElement.setAttribute("data-theme", theme);
      document.body.classList.toggle("night", theme === "night");
      document.body.classList.toggle("novel-night", theme === "night");
      document.querySelectorAll("[data-theme-opt]").forEach(b=>{
        const on = b.getAttribute("data-theme-opt") === theme;
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      const fsLabel = document.querySelector("[data-fs-label]");
      if(fsLabel) fsLabel.textContent = p.fontSize + "px";
    },
    bumpFont(delta){
      const p = this.getPrefs();
      p.fontSize = Math.min(28, Math.max(14, (p.fontSize || 18) + delta));
      this.setPrefs(p);
      this.applyPrefs();
    },
    getTheme(p){
      p = p || this.getPrefs();
      const t = p.theme || (p.night ? "night" : "white");
      return ["white","sepia","green","night"].indexOf(t) < 0 ? "white" : t;
    },
    setTheme(t){
      const p = this.getPrefs();
      p.theme = t; p.night = (t === "night");
      this.setPrefs(p);
      this.applyPrefs();
    },
    toggleNight(){ this.setTheme(this.getTheme() === "night" ? "white" : "night"); },
    buildThemePicker(){
      if(document.querySelector(".theme-picker")) return;
      const night = document.querySelector("[data-night]");
      const bar = night ? night.parentNode : document.querySelector(".toolbar");
      if(!bar) return;
      const wrap = document.createElement("span");
      wrap.className = "theme-picker"; wrap.setAttribute("role","group"); wrap.setAttribute("aria-label","背景顏色");
      [["white","白"],["sepia","米黃"],["green","護眼綠"],["night","夜間"]].forEach(([k,l])=>{
        const b = document.createElement("button");
        b.type = "button"; b.className = "theme-opt"; b.setAttribute("data-theme-opt", k);
        b.setAttribute("title", l);
        b.innerHTML = '<i class="dot dot-' + k + '"></i><span>' + l + '</span>';
        b.addEventListener("click", ()=> this.setTheme(k));
        wrap.appendChild(b);
      });
      if(night){ bar.insertBefore(wrap, night); night.classList.add("hidden"); }
      else bar.appendChild(wrap);
    },
    getShelf(){ return readJSON(KEYS.shelf, {}); },
    setShelf(s){ writeJSON(KEYS.shelf, s); },
    isOnShelf(bookId){
      const s = this.getShelf();
      return !!(s[bookId] && s[bookId].marked);
    },
    touchBook(bookId, meta){
      const s = this.getShelf();
      const cur = s[bookId] || {};
      s[bookId] = Object.assign({}, cur, {
        id: bookId,
        title: meta && meta.title || cur.title || bookId,
        openedAt: new Date().toISOString(),
        marked: cur.marked || false
      });
      this.setShelf(s);
    },
    toggleMark(bookId, meta){
      const s = this.getShelf();
      const cur = s[bookId] || { id: bookId, title: meta && meta.title || bookId };
      cur.marked = !cur.marked;
      cur.title = meta && meta.title || cur.title;
      if(cur.marked) cur.markedAt = new Date().toISOString();
      s[bookId] = cur;
      this.setShelf(s);
      return cur.marked;
    },
    getLastRead(){ return readJSON(KEYS.lastRead, {}); },
    setLastReadBook(bookId, iso){
      const lr = this.getLastRead();
      lr[bookId] = iso || new Date().toISOString();
      writeJSON(KEYS.lastRead, lr);
    },
    getProgress(){ return readJSON(KEYS.progress, {}); },
    saveProgress(bookId, chapterId, scrollPct){
      const all = this.getProgress();
      all[bookId] = {
        bookId, chapterId,
        scrollPct: Math.max(0, Math.min(100, Math.round(scrollPct * 10) / 10)),
        at: new Date().toISOString()
      };
      writeJSON(KEYS.progress, all);
      this.setLastReadBook(bookId, all[bookId].at);
    },
    getBookProgress(bookId){
      return this.getProgress()[bookId] || null;
    },
    hasUpdate(bookUpdatedAt, bookId){
      if(!bookUpdatedAt) return false;
      const lr = this.getLastRead()[bookId];
      if(!lr) return false; // only show after user has read
      try{
        return new Date(bookUpdatedAt).getTime() > new Date(lr).getTime();
      }catch(e){ return false; }
    },
    initToolbar(){
      this.applyPrefs();
      document.querySelectorAll("[data-fs]").forEach(btn=>{
        btn.addEventListener("click", ()=> this.bumpFont(parseInt(btn.getAttribute("data-fs"),10)));
      });
      this.buildThemePicker();
      this.applyPrefs();
    },
    initChapterPage(opts){
      const { bookId, chapterId, title } = opts;
      this.touchBook(bookId, { title });
      this.initToolbar();
      // restore scroll
      const prog = this.getBookProgress(bookId);
      if(prog && prog.chapterId === chapterId && prog.scrollPct > 2){
        requestAnimationFrame(()=>{
          const max = document.documentElement.scrollHeight - window.innerHeight;
          if(max > 0) window.scrollTo(0, max * (prog.scrollPct / 100));
        });
      }
      let ticking = false;
      const save = ()=>{
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max <= 0 ? 0 : (window.scrollY / max) * 100;
        this.saveProgress(bookId, chapterId, pct);
        ticking = false;
      };
      window.addEventListener("scroll", ()=>{
        if(!ticking){ ticking = true; requestAnimationFrame(save); }
      }, { passive: true });
      window.addEventListener("pagehide", save);
      // initial progress touch
      this.saveProgress(bookId, chapterId,
        (()=>{ const max = document.documentElement.scrollHeight - window.innerHeight;
          return max <= 0 ? 0 : (window.scrollY / max) * 100; })()
      );
      // mark button
      const markBtn = document.querySelector("[data-mark]");
      if(markBtn){
        const sync = ()=>{
          const on = this.isOnShelf(bookId);
          markBtn.classList.toggle("on", on);
          markBtn.textContent = on ? "已在書架" : "加入書架";
        };
        sync();
        markBtn.addEventListener("click", ()=>{
          this.toggleMark(bookId, { title });
          sync();
        });
      }
      // ← / → 翻章（輸入框內不觸發）
      document.addEventListener("keydown", (e)=>{
        if(e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const t = e.target;
        if(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        if(e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const nav = document.querySelector(".nav-chapters");
        if(!nav || !nav.children.length) return;
        const go = e.key === "ArrowLeft" ? nav.firstElementChild : nav.lastElementChild;
        if(go && go.tagName === "A" && go.href){
          e.preventDefault();
          location.href = go.href;
        }
      });
    },
    initCatalog(opts){
      const { bookId, title } = opts;
      this.touchBook(bookId, { title });
      this.applyPrefs();
      const markBtn = document.querySelector("[data-mark]");
      if(markBtn){
        const sync = ()=>{
          const on = this.isOnShelf(bookId);
          markBtn.classList.toggle("on", on);
          markBtn.textContent = on ? "已在書架" : "加入書架";
        };
        sync();
        markBtn.addEventListener("click", ()=>{
          this.toggleMark(bookId, { title });
          sync();
        });
      }
      // progress marks on chapter list
      const prog = this.getBookProgress(bookId);
      if(prog){
        document.querySelectorAll("[data-ch]").forEach(a=>{
          if(a.getAttribute("data-ch") === prog.chapterId){
            let mark = a.querySelector(".ch-mark");
            if(!mark){
              mark = document.createElement("span");
              mark.className = "ch-mark";
              a.appendChild(mark);
            }
            mark.textContent = "讀到 " + Math.round(prog.scrollPct) + "%";
          }
        });
      }
    },
    async initHub(){
      this.applyPrefs();
      let books = [];
      try{
        const res = await fetch("./data/books.json", { cache: "no-store" });
        books = await res.json();
      }catch(e){
        console.warn("books.json load failed", e);
      }
      const HUB = window.NOVEL_HUB || {};
      const META = HUB.meta || {};
      const HIDE = HUB.hide || [];
      // 下架／取消的書一律不顯示
      books = (Array.isArray(books) ? books : []).filter(b => b && b.id && !b.hidden && b.status !== "cancelled" && HIDE.indexOf(b.id) < 0);
      const loaded = books.length > 0;

      const shelfEl = document.getElementById("bookshelf");
      const recEl = document.getElementById("recent");
      const listEl = document.getElementById("book-list");
      const heroEl = document.getElementById("hub-hero");
      const searchInput = document.getElementById("novel-search");

      function escapeHtml(s){
        return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
      }
      const esc = escapeHtml;
      // 簡體模式：OpenCC 已載入時，動態內容也要轉換
      function cv(el){
        const f = window.__novelT2S; if(!f || !el) return;
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null); let n;
        while((n = w.nextNode())){ if(n.nodeValue.trim()) n.nodeValue = f(n.nodeValue); }
      }
      const tx = s => window.__novelT2S ? window.__novelT2S(s) : s;
      const chapters = b => (b.volumes || []).reduce((a, v) => a.concat(v.chapters || []), []);
      const chIndex = (b, cid) => { const all = chapters(b); const i = all.findIndex(c => c.id === cid); return i < 0 ? null : { n: i + 1, c: all[i] }; };
      const chHref = (b, c) => "./" + b.id + "/" + (c.path || c.id);
      const md = iso => { try{ const d = new Date(iso); return isNaN(d) ? "" : (d.getMonth() + 1) + "/" + d.getDate(); }catch(e){ return ""; } };
      const bk = id => books.find(b => b.id === id) || { id, title: (Novel.getShelf()[id] || {}).title || id, blurb: "", updatedAt: null, volumes: [] };

      function coverHTML(book, cls){
        const m = META[book.id] || {};
        const src = m.cover || ("./img/" + book.id + ".webp");
        return `<a class="nb-cover ${cls || ""} nb-cv-${esc(book.id)}" href="./${esc(book.id)}/" tabindex="-1" aria-hidden="true">`
          + `<span class="nb-cover-fb"><span class="nb-cover-title">${esc(book.title)}</span><span class="nb-cover-brand">算了小說</span></span>`
          + `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" width="400" height="600" onerror="this.remove()"></a>`;
      }
      function readBtn(book, cls){
        const p = Novel.getBookProgress(book.id);
        const at = p && chIndex(book, p.chapterId);
        if(at) return `<a class="nb-btn nb-btn-primary ${cls || ""}" href="${esc(chHref(book, at.c))}">繼續閱讀 · 第${at.n}章</a>`;
        const first = chapters(book)[0];
        return `<a class="nb-btn nb-btn-primary ${cls || ""}" href="${esc(first ? chHref(book, first) : "./" + book.id + "/")}">開始閱讀</a>`;
      }
      function markBtn(book){
        const on = Novel.isOnShelf(book.id);
        return `<button type="button" class="nb-btn nb-btn-ghost${on ? " on" : ""}" data-mark-book="${esc(book.id)}" aria-pressed="${on}">${on ? "已在書架" : "加入書架"}</button>`;
      }
      function metaLine(book){
        const n = chapters(book).length;
        const d = md(book.updatedAt);
        return `${n ? n + " 章" : ""}${n ? " · " : ""}連載中${d ? " · " + d + " 更新" : ""}`;
      }
      function cardHTML(book){
        const m = META[book.id] || {};
        const upd = Novel.hasUpdate(book.updatedAt, book.id);
        const badge = upd ? '<span class="badge-update">有更新</span>' : '';
        return `<article class="book-card nb-card" data-book-id="${esc(book.id)}">
          ${coverHTML(book)}
          <div class="nb-info">
            <h3 class="nb-title"><a href="./${esc(book.id)}/">${esc(book.title)}</a>${badge}</h3>
            <div class="nb-meta">${m.genre ? `<span class="nb-tag">${esc(m.genre)}</span>` : ""}<span>${metaLine(book)}</span></div>
            <p class="nb-blurb">${esc(book.blurb || "")}</p>
            <div class="nb-actions">${readBtn(book)}${markBtn(book)}</div>
          </div>
        </article>`;
      }
      function shelfCardHTML(book, kind){
        const upd = Novel.hasUpdate(book.updatedAt, book.id);
        const badge = upd ? '<span class="badge-update">有更新</span>' : '';
        const p = Novel.getBookProgress(book.id);
        const at = p && chIndex(book, p.chapterId);
        const total = chapters(book).length;
        const pct = at && total ? Math.round(((at.n - 1) + (p.scrollPct || 0) / 100) / total * 100) : 0;
        const href = at ? chHref(book, at.c) : "./" + book.id + "/";
        const line = at ? `讀到第${at.n}章${total ? " / 共" + total + "章" : ""}` : (total ? "尚未開始 · 共" + total + "章" : "尚未開始");
        return `<div class="shelf-item">
          ${coverHTML(book, "nb-cover-sm")}
          <a class="book-card nb-shelf-card" href="${esc(href)}" data-book-id="${esc(book.id)}">
            <b>${esc(book.title)}${badge}</b>
            <small>${line}</small>
            <span class="nb-progress" aria-hidden="true"><i style="width:${pct}%"></i></span>
          </a>
          <button type="button" class="shelf-del" data-del="${esc(book.id)}" data-kind="${kind}" aria-label="移除">移除</button>
        </div>`;
      }

      // bookshelf (manual only) + recent reading (up to 5)
      function renderShelves(){
        if(!shelfEl && !recEl) return;
        const shelf = Novel.getShelf();
        let ids = Object.keys(shelf).filter(id => shelf[id] && (shelf[id].marked || shelf[id].openedAt));
        if(loaded){
          let changed = false;
          ids = ids.filter(id => { if(books.find(b => b.id === id)) return true; delete shelf[id]; changed = true; return false; });
          if(changed) Novel.setShelf(shelf);
        }
        // prefer marked first, then recent opened
        ids.sort((a, b) => {
          const A = shelf[a], B = shelf[b];
          if(!!A.marked !== !!B.marked) return A.marked ? -1 : 1;
          return String(B.openedAt || "").localeCompare(String(A.openedAt || ""));
        });
        const markIds = ids.filter(id => shelf[id].marked);
        const recIds = ids.filter(id => !shelf[id].marked && shelf[id].openedAt).slice(0, 5);
        const fill = (el, list, emptyId, kind) => {
          if(!el) return;
          el.innerHTML = list.map(id => shelfCardHTML(bk(id), kind)).join("");
          document.getElementById(emptyId)?.classList.toggle("hidden", list.length > 0);
          cv(el);
          el.onclick = (e) => {
            const b = e.target.closest(".shelf-del"); if(!b) return;
            e.preventDefault();
            const id = b.dataset.del; const st = Novel.getShelf();
            if(st[id]){ if(kind === "shelf") st[id].marked = false; else delete st[id]; }
            Novel.setShelf(st);
            renderShelves(); syncMarks();
          };
        };
        fill(shelfEl, markIds, "shelf-empty", "shelf");
        fill(recEl, recIds, "recent-empty", "recent");
      }
      function syncMarks(){
        document.querySelectorAll("[data-mark-book]").forEach(b => {
          const on = Novel.isOnShelf(b.getAttribute("data-mark-book"));
          b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
          b.textContent = tx(on ? "已在書架" : "加入書架");
        });
      }

      function renderHero(){
        if(!heroEl || !loaded) return;
        const fid = HUB.featured;
        const book = books.find(b => b.id === fid) || books.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
        if(!book) return;
        const m = META[book.id] || {};
        heroEl.setAttribute("data-book-id", book.id);
        heroEl.className = "nb-hero nb-cv-" + book.id;
        // 絕對網址：避免 url() 被當成相對於 CSS 檔
        let heroImg = m.cover || ("./img/" + book.id + ".webp");
        try{ heroImg = new URL(heroImg, location.href).href; }catch(e){}
        heroEl.style.setProperty("--hero-img", `url("${heroImg.replace(/["\\]/g, "")}")`);
        heroEl.innerHTML = `<div class="nb-hero-bg" aria-hidden="true"></div>
          <div class="nb-hero-in">
            ${coverHTML(book, "nb-cover-hero")}
            <div class="nb-hero-text">
              <span class="nb-kicker">本週主打</span>
              <h2 class="nb-hero-title"><a href="./${esc(book.id)}/">${esc(book.title)}</a></h2>
              <div class="nb-meta">${m.genre ? `<span class="nb-tag">${esc(m.genre)}</span>` : ""}<span>${metaLine(book)}</span></div>
              <p class="nb-hero-blurb">${esc(m.tagline || book.blurb || "")}</p>
              <div class="nb-actions">${readBtn(book)}${markBtn(book)}</div>
            </div>
          </div>`;
        cv(heroEl);
      }

      function renderList(q){
        if(!listEl) return;
        const qq = (q || "").trim().toLowerCase();
        const filtered = books.filter(b => {
          if(!qq) return true;
          const hay = (b.title + " " + (b.blurb || "") + " " + ((META[b.id] || {}).genre || "")).toLowerCase();
          return hay.includes(qq);
        });
        if(!filtered.length){
          listEl.innerHTML = '<p class="search-empty">' + (loaded ? "沒有符合的書。" : "書單載入失敗，請重新整理。") + '</p>';
          cv(listEl);
          return;
        }
        listEl.innerHTML = filtered.map(b => cardHTML(b)).join("");
        cv(listEl);
      }

      document.addEventListener("click", (e) => {
        const b = e.target.closest && e.target.closest("[data-mark-book]"); if(!b) return;
        e.preventDefault();
        const id = b.getAttribute("data-mark-book");
        const book = bk(id);
        Novel.toggleMark(id, { title: book.title });
        syncMarks(); renderShelves();
      });

      renderShelves();
      renderHero();
      if(loaded || listEl && !listEl.children.length) renderList("");
      if(searchInput){
        searchInput.addEventListener("input", ()=> renderList(searchInput.value));
      }
    }
  };

  window.NovelReader = Novel;
})();

/* swipe: left = next chapter, right = previous; refresh button */
(function(){
  var nav=document.querySelector('.nav-chapters'); if(!nav) return;
  var links=nav.querySelectorAll('a'), prev=null, next=null;
  links.forEach(function(a){ var t=a.textContent; if(t.indexOf('←')===0) prev=a.href; else if(t.indexOf('→')>-1) next=a.href; });
  var x0=0,y0=0,t0=0;
  document.addEventListener('touchstart',function(e){if(e.target&&e.target.closest&&e.target.closest('.novel-comments')){t0=0;return;}var p=e.touches[0];x0=p.clientX;y0=p.clientY;t0=Date.now();},{passive:true});
  document.addEventListener('touchend',function(e){
    var p=e.changedTouches[0],dx=p.clientX-x0,dy=p.clientY-y0;
    if(Date.now()-t0>800||Math.abs(dx)<80||Math.abs(dx)<Math.abs(dy)*2) return;
    if(dx<0&&next) location.href=next; else if(dx>0&&prev) location.href=prev;
  },{passive:true});
  var bar=document.querySelector('.reader-tools')||document.querySelector('[data-night]')&&document.querySelector('[data-night]').parentNode;
  if(bar){var b=document.createElement('button');b.type='button';b.textContent='重整';b.onclick=function(){location.reload();};bar.appendChild(b);}
})();

/* 繁/簡: auto by system language, manual toggle remembered */
(function(){
  var KEY='novel-script';
  var me=document.currentScript||[].slice.call(document.scripts).filter(function(s){return /reader\.js/.test(s.src);})[0];
  var base=me?me.src.replace(/reader\.js.*$/,''):'/novel/js/';
  var saved=null; try{saved=localStorage.getItem(KEY);}catch(e){}
  var langs=(navigator.languages||[navigator.language||'']).join(',').toLowerCase();
  var auto=/zh-(cn|sg|hans)|zh,|^zh$/.test(langs)&&!/zh-(tw|hk|mo|hant)/.test(langs.split(',')[0])?'sc':'tc';
  if(langs.split(',')[0].indexOf('zh-hans')===0||/^zh-(cn|sg)/.test(langs.split(',')[0])) auto='sc';
  var mode=saved||auto;
  function convert(){
    var s=document.createElement('script'); s.src=base+'opencc-t2cn.js';
    s.onload=function(){
      var cv=OpenCC.Converter({from:'t',to:'cn'}); window.__novelT2S=cv;
      var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
      var n; while((n=w.nextNode())){ if(n.nodeValue.trim()) n.nodeValue=cv(n.nodeValue); }
      document.title=cv(document.title); document.documentElement.lang='zh-CN';
    };
    document.head.appendChild(s);
  }
  function btn(){
    var b=document.createElement('button'); b.type='button';
    b.textContent=mode==='sc'?'繁':'简';
    b.setAttribute('aria-label','切換繁簡');
    b.onclick=function(){ try{localStorage.setItem(KEY,mode==='sc'?'tc':'sc');}catch(e){} location.reload(); };
    var bar=document.querySelector('.toolbar');
    if(bar) bar.appendChild(b);
    else { b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99;padding:6px 12px;border-radius:16px;border:1px solid #888;background:inherit;color:inherit;font-size:14px'; document.body.appendChild(b); }
  }
  function go(){ btn(); if(mode==='sc') convert(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
})();

/* 章節留言 */
(function(){
  var m=location.pathname.match(/\/novel\/([a-z0-9-]+)\/(c\d+)(?:\.html)?\/?$/); if(!m) return;
  var ch=m[1]+'/'+m[2], API='/api/novel-comments?ch='+encodeURIComponent(ch);
  var ERR={too_short:'留言至少 2 個字',too_long:'留言最多 500 字',rate_limited:'留言太頻繁，請 30 秒後再試',forbidden:'無法送出',bad_chapter:'章節錯誤'};
  function cv(el){ var f=window.__novelT2S; if(!f) return; var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),n; while((n=w.nextNode())) if(n.nodeValue.trim()) n.nodeValue=f(n.nodeValue); var q=el.querySelectorAll('[placeholder]'); for(var i=0;i<q.length;i++) q[i].placeholder=f(q[i].placeholder); }
  function ago(iso){ var d=(Date.now()-new Date(iso))/1e3; if(d<60) return '剛剛'; if(d<3600) return Math.floor(d/60)+' 分鐘前'; if(d<86400) return Math.floor(d/3600)+' 小時前'; if(d<86400*30) return Math.floor(d/86400)+' 天前'; return iso.slice(0,10); }
  function link(t){ return t.replace(/\b((?:https?:\/\/|www\.)[^\s<&]+)/i,function(u){ var h=/^www\./i.test(u)?'https://'+u:u; return '<a href="'+h+'" rel="nofollow ugc noopener" target="_blank">'+u+'</a>'; }); }
  var TK='novel-comment-tokens';
  function toks(){ try{ return JSON.parse(localStorage.getItem(TK)||'{}')||{}; }catch(e){ return {}; } }
  function setTok(id,t){ var o=toks(); if(t) o[id]=t; else delete o[id]; try{ localStorage.setItem(TK,JSON.stringify(o)); }catch(e){} }
  function go(){
    var nav=document.querySelector('.nav-chapters'), body=document.querySelector('.chapter-body'); var anchor=nav||body; if(!anchor) return;
    var sec=document.createElement('section'); sec.className='novel-comments'; sec.id='comments';
    sec.innerHTML='<h2 class="nc-title">本章留言 <small class="nc-count"></small></h2>'+
      '<form class="nc-form" novalidate><input class="nc-name" name="name" maxlength="20" placeholder="暱稱（可不填，預設「讀者」）" autocomplete="nickname">'+
      '<input name="website" tabindex="-1" autocomplete="off" class="nc-hp" aria-hidden="true">'+
      '<textarea class="nc-text" name="text" maxlength="500" rows="3" placeholder="說說你對這一章的想法…（2–500 字）" required></textarea>'+
      '<div class="nc-row"><span class="nc-len">0/500</span><span class="nc-msg" role="status"></span><button type="submit">送出留言</button></div></form>'+
      '<ol class="nc-list"><li class="nc-empty">載入中…</li></ol>';
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    var form=sec.querySelector('form'), ta=sec.querySelector('.nc-text'), nm=sec.querySelector('.nc-name'), msg=sec.querySelector('.nc-msg'), list=sec.querySelector('.nc-list'), cnt=sec.querySelector('.nc-count'), len=sec.querySelector('.nc-len'), btn=form.querySelector('button');
    try{ nm.value=localStorage.getItem('novel-nick')||''; }catch(e){}
    cv(sec);
    ta.addEventListener('input',function(){ len.textContent=[...ta.value].length+'/500'; });
    function render(arr,total){
      cnt.textContent=total?'（'+total+'）':'';
      var mine=toks();
      function one(c,rep){ return '<div class="nc-meta"><b>'+c.name+'</b>'+(c.au?' <span class="nc-au">作者</span>':'')+' · <time datetime="'+c.at+'">'+ago(c.at)+'</time>'+(mine[c.id]?' <button type="button" class="nc-del" data-id="'+c.id+'">刪除</button>':'')+'</div><div class="nc-body">'+link(c.text).replace(/\n/g,'<br>')+'</div><div class="nc-act"><button type="button" class="nc-rep" data-id="'+c.id+'">回覆</button></div>'; }
      var tops=arr.filter(function(c){return !c.pid;}), kids={};
      arr.forEach(function(c){ if(c.pid){ (kids[c.pid]=kids[c.pid]||[]).push(c); } });
      list.innerHTML=tops.length?tops.map(function(c){ var k=(kids[c.id]||[]).slice().sort(function(a,b){return a.at<b.at?-1:1;}); return '<li data-id="'+c.id+'">'+one(c)+(k.length?'<ol class="nc-replies">'+k.map(function(r){return '<li>'+one(r,1)+'</li>';}).join('')+'</ol>':'')+'</li>'; }).join(''):'<li class="nc-empty">還沒有留言，來搶頭香吧！</li>';
      cv(list); cv(cnt);
    }
    var cur=[],tot=0;
    function load(){ fetch(API,{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){ if(d.ok){cur=d.comments;tot=d.total;render(cur,tot);} }).catch(function(){ list.innerHTML='<li class="nc-empty">留言載入失敗</li>'; cv(list); }); }
    function say(t,ok){ msg.textContent=t; msg.className='nc-msg'+(ok?' ok':' err'); cv(msg); }
    form.addEventListener('submit',function(e){
      e.preventDefault(); var t=ta.value.trim(), n=[...t].length;
      if(n<2) return say(ERR.too_short); if(n>500) return say(ERR.too_long);
      try{ localStorage.setItem('novel-nick',nm.value.trim()); }catch(e){}
      btn.disabled=true; say('送出中…',true);
      fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:nm.value,text:t,website:form.website.value})})
        .then(function(r){return r.json();}).then(function(d){
          if(d.ok&&d.comment){ if(d.token) setTok(d.comment.id,d.token); ta.value=''; len.textContent='0/500'; cur.unshift(d.comment); tot++; render(cur,tot); say('已送出，謝謝！',true); }
          else say(ERR[d.error]||'送出失敗，請稍後再試');
        }).catch(function(){ say('網路錯誤，請稍後再試'); }).then(function(){ btn.disabled=false; });
    });
    list.addEventListener('click',function(e){
      var rb=e.target.closest&&e.target.closest('.nc-rep');
      if(rb){ var top=rb.closest('.nc-list > li'); if(!top) return; var ex=top.querySelector('.nc-rform'); if(ex){ ex.remove(); return; }
        var nmv=''; try{ nmv=localStorage.getItem('novel-nick')||''; }catch(_){}
        var f=document.createElement('form'); f.className='nc-form nc-rform'; f.setAttribute('novalidate','');
        f.innerHTML='<input class="nc-name" maxlength="20" placeholder="暱稱（可不填）"><textarea maxlength="500" rows="2" placeholder="回覆…（2–500 字）"></textarea><div class="nc-row"><span class="nc-msg" role="status"></span><button type="submit">送出回覆</button></div>';
        f.querySelector('input').value=nmv; top.appendChild(f); cv(f); f.querySelector('textarea').focus();
        var pid=rb.getAttribute('data-id');
        f.addEventListener('submit',function(ev){ ev.preventDefault(); var rt=f.querySelector('textarea').value.trim(), rn=[...rt].length, rm=f.querySelector('.nc-msg'), sb=f.querySelector('button');
          function rs(t,ok){ rm.textContent=t; rm.className='nc-msg'+(ok?' ok':' err'); cv(rm); }
          if(rn<2) return rs(ERR.too_short); if(rn>500) return rs(ERR.too_long);
          var rnm=f.querySelector('input').value; try{ localStorage.setItem('novel-nick',rnm.trim()); }catch(_){}
          sb.disabled=true; rs('送出中…',true);
          fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:rnm,text:rt,parent:pid})}).then(function(r){return r.json();}).then(function(d){
            if(d.ok&&d.comment){ if(d.token) setTok(d.comment.id,d.token); cur.push(d.comment); tot++; render(cur,tot); say('回覆已送出',true); }
            else { sb.disabled=false; rs(ERR[d.error]||'送出失敗，請稍後再試'); }
          }).catch(function(){ sb.disabled=false; rs('網路錯誤，請稍後再試'); });
        });
        return; }
      var b=e.target.closest&&e.target.closest('.nc-del'); if(!b) return;
      var id=b.getAttribute('data-id'), t=toks()[id]; if(!t) return;
      var q='確定要刪除這則留言嗎？'; if(window.__novelT2S) q=window.__novelT2S(q);
      if(!confirm(q)) return;
      b.disabled=true;
      fetch(API+'&id='+encodeURIComponent(id)+'&token='+encodeURIComponent(t),{method:'DELETE'}).then(function(r){return r.json();}).then(function(d){
        if(d.ok||d.error==='not_found'){ setTok(id); var n0=cur.length; cur=cur.filter(function(c){return c.id!==id&&c.pid!==id;}); if(d.ok) tot-=(n0-cur.length); render(cur,tot); say('已刪除',true); }
        else { b.disabled=false; say('刪除失敗'); }
      }).catch(function(){ b.disabled=false; say('網路錯誤，請稍後再試'); });
    });
    // 簡體模式：OpenCC 載入後再轉一次
    if(!window.__novelT2S){ var k=0,iv=setInterval(function(){ if(window.__novelT2S){ clearInterval(iv); cv(sec); } else if(++k>40) clearInterval(iv); },250); }
    load();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
})();
