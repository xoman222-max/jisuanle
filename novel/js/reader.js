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
      list.innerHTML=arr.length?arr.map(function(c){ return '<li><div class="nc-meta"><b>'+c.name+'</b> · <time datetime="'+c.at+'">'+ago(c.at)+'</time></div><div class="nc-body">'+link(c.text).replace(/\n/g,'<br>')+'</div></li>'; }).join(''):'<li class="nc-empty">還沒有留言，來搶頭香吧！</li>';
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
          if(d.ok&&d.comment){ ta.value=''; len.textContent='0/500'; cur.unshift(d.comment); tot++; render(cur,tot); say('已送出，謝謝！',true); }
          else say(ERR[d.error]||'送出失敗，請稍後再試');
        }).catch(function(){ say('網路錯誤，請稍後再試'); }).then(function(){ btn.disabled=false; });
    });
    // 簡體模式：OpenCC 載入後再轉一次
    if(!window.__novelT2S){ var k=0,iv=setInterval(function(){ if(window.__novelT2S){ clearInterval(iv); cv(sec); } else if(++k>40) clearInterval(iv); },250); }
    load();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',go); else go();
})();
