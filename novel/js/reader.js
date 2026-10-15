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
      document.body.classList.toggle("night", !!p.night);
      document.body.classList.toggle("novel-night", !!p.night);
      const nightBtn = document.querySelector("[data-night]");
      if(nightBtn) nightBtn.textContent = p.night ? "日間" : "夜間";
      const fsLabel = document.querySelector("[data-fs-label]");
      if(fsLabel) fsLabel.textContent = p.fontSize + "px";
    },
    bumpFont(delta){
      const p = this.getPrefs();
      p.fontSize = Math.min(28, Math.max(14, (p.fontSize || 18) + delta));
      this.setPrefs(p);
      this.applyPrefs();
    },
    toggleNight(){
      const p = this.getPrefs();
      p.night = !p.night;
      this.setPrefs(p);
      this.applyPrefs();
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
      const night = document.querySelector("[data-night]");
      if(night) night.addEventListener("click", ()=> this.toggleNight());
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
      const shelfEl = document.getElementById("bookshelf");
      const listEl = document.getElementById("book-list");
      const searchInput = document.getElementById("novel-search");
      const shelf = this.getShelf();
      const shelfIds = Object.keys(shelf).filter(id => shelf[id] && (shelf[id].marked || shelf[id].openedAt));
      // prefer marked first, then recent opened
      shelfIds.sort((a,b)=>{
        const A = shelf[a], B = shelf[b];
        if(!!A.marked !== !!B.marked) return A.marked ? -1 : 1;
        return String(B.openedAt||"").localeCompare(String(A.openedAt||""));
      });

      function cardHTML(book, extra){
        const upd = Novel.hasUpdate(book.updatedAt, book.id);
        const badge = upd ? '<span class="badge-update">有更新</span>' : '';
        return `<a class="book-card" href="./${book.id}/" data-book-id="${book.id}">
          <b>${escapeHtml(book.title)}${badge}</b>
          <small>${escapeHtml(book.blurb || "")}${extra||""}</small>
        </a>`;
      }
      function escapeHtml(s){
        return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
      }

      // bookshelf
      if(shelfEl){
        const items = shelfIds.map(id => {
          const book = books.find(b => b.id === id) || { id, title: shelf[id].title || id, blurb: "", updatedAt: null };
          const tag = shelf[id].marked ? " · 已標記" : " · 最近開啟";
          return cardHTML(book, tag);
        }).filter(Boolean);
        if(items.length){
          shelfEl.innerHTML = items.join("");
          document.getElementById("shelf-empty")?.classList.add("hidden");
        }else{
          shelfEl.innerHTML = "";
          document.getElementById("shelf-empty")?.classList.remove("hidden");
        }
      }

      function renderList(q){
        if(!listEl) return;
        const qq = (q||"").trim().toLowerCase();
        const filtered = books.filter(b => {
          if(!qq) return true;
          const hay = (b.title + " " + (b.blurb||"")).toLowerCase();
          return hay.includes(qq);
        });
        if(!filtered.length){
          listEl.innerHTML = '<p class="search-empty">沒有符合的書。</p>';
          return;
        }
        listEl.innerHTML = filtered.map(b => cardHTML(b)).join("");
      }
      renderList("");
      if(searchInput){
        searchInput.addEventListener("input", ()=> renderList(searchInput.value));
      }
    }
  };

  window.NovelReader = Novel;
})();
