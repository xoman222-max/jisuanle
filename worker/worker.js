/* jisuanle.com Worker：靜態資產＋意見回饋 API（POST /api/feedback → Email） */
import { EmailMessage } from 'cloudflare:email';
import { DurableObject } from 'cloudflare:workers';

const TO = 'ai2chuio@mail.grokbot.com';
const FROM = 'feedback@jisuanle.com';
const CATS = { bug: '錯誤回報', suggest: '功能建議', newtool: '新工具', data: '費率法規更新', other: '其他' };
const LIMITS = { name: 50, email: 100, tool: 100, page: 300, message: 3000 };
const mem = new Map(); // 備援：單一 isolate 內的簡易限流

const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } });

async function limited(env, ip) {
  if (env.FEEDBACK_RL && typeof env.FEEDBACK_RL.limit === 'function') {
    try { const { success } = await env.FEEDBACK_RL.limit({ key: ip }); return !success; } catch (e) { /* 改用備援 */ }
  }
  const now = Date.now(), arr = (mem.get(ip) || []).filter(t => now - t < 60_000);
  arr.push(now); mem.set(ip, arr); if (mem.size > 5000) mem.clear();
  return arr.length > 5;
}

export function validate(d, now = Date.now()) {
  if (!d || typeof d !== 'object') return { error: 'bad_request' };
  const s = k => (typeof d[k] === 'string' ? d[k] : '').trim();
  const v = { name: s('name'), email: s('email'), category: s('category') || 'other', tool: s('tool'), page: s('page'), message: s('message'), lang: s('lang') === 'cn' ? 'cn' : 'tw' };
  if (s('website')) return { spam: 'honeypot' };
  const ts = Number(d.ts);
  if (!ts || now - ts < 3000) return { spam: 'too_fast' };
  if (now - ts > 24 * 3600e3) return { error: 'expired' };
  for (const k in LIMITS) if (v[k].length > LIMITS[k]) return { error: 'too_long:' + k };
  if (v.message.length < 5) return { error: 'message_required' };
  if (v.email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v.email)) return { error: 'bad_email' };
  if (!CATS[v.category]) return { error: 'bad_category' };
  return { ok: v };
}

const ERR = {
  tw: { message_required: '請填寫至少 5 個字的內容', bad_email: 'Email 格式不正確', expired: '頁面開啟太久，請重新整理後再送出', bad_category: '類別不正確', bad_request: '格式錯誤', too_long: '內容太長' },
  cn: { message_required: '请填写至少 5 个字的内容', bad_email: 'Email 格式不正确', expired: '页面打开太久，请刷新后再提交', bad_category: '类别不正确', bad_request: '格式错误', too_long: '内容太长' }
};

function b64(str) { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
const encWord = s => '=?UTF-8?B?' + b64(s) + '?=';

async function send(env, v, meta) {
  const subject = `[jisuanle 回饋] ${CATS[v.category]}｜${(v.tool || v.message).slice(0, 40).replace(/[\r\n]+/g, ' ')}`;
  const text = [`類別：${CATS[v.category]}`, `工具/頁面：${v.tool || '-'}`, `來源頁：${v.page || '-'}`, `稱呼：${v.name || '-'}`, `Email：${v.email || '-'}`, `版本：${v.lang}`, '', v.message, '', '---', `時間：${new Date().toISOString()}`, `國家：${meta.country || '-'}`, `UA：${meta.ua.slice(0, 200)}`].join('\n');
  if (!env.FEEDBACK_EMAIL) throw Object.assign(new Error('email binding missing'), { code: 'NO_BINDING' });
  try {
    const msg = { to: TO, from: { email: FROM, name: 'jisuanle feedback' }, subject, text };
    if (v.email) msg.replyTo = v.email;
    return await env.FEEDBACK_EMAIL.send(msg);
  } catch (e) {
    // 舊版 Email Routing 只接受原始 MIME（EmailMessage）
    if (e && e.code && e.code !== 'E_VALIDATION_ERROR' && e.code !== 'E_FIELD_MISSING') throw e;
    const id = `<${crypto.randomUUID()}@jisuanle.com>`;
    const raw = [`From: ${encWord('jisuanle feedback')} <${FROM}>`, `To: <${TO}>`, v.email ? `Reply-To: <${v.email}>` : null, `Subject: ${encWord(subject)}`, `Message-ID: ${id}`, `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(text).replace(/.{76}/g, '$&\r\n')].filter(x => x !== null).join('\r\n');
    return await env.FEEDBACK_EMAIL.send(new EmailMessage(FROM, TO, raw));
  }
}


// ---------- 瀏覽計數（Durable Object + SQLite，強一致、原子遞增） ----------
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pagespeed|preview|monitor|curl|wget|python|httpclient|java\/|go-http|axios|node-fetch|scrapy/i;
export const taipeiDay = (t = Date.now()) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10);

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS paths (path TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, today TEXT, t INTEGER NOT NULL DEFAULT 0)'); // 每頁匿名瀏覽數（只有路徑，無個資）
    this.sql.exec('CREATE TABLE IF NOT EXISTS ipq (k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL)'); // 每 IP 每日 AI 次數（只存雜湊，約 2 天後清除）
    this.recent = new Map(); // 30 分鐘去重（記憶體；DO 休眠後重置，可接受）
  }
  read(day) {
    const t = this.sql.exec('SELECT n FROM days WHERE day = ?', day).toArray()[0];
    const all = this.sql.exec("SELECT n FROM meta WHERE k = 'total'").toArray()[0];
    return { today: t ? t.n : 0, total: all ? all.n : 0 };
  }
  pathHit(path, day) {
    if (!/^\/[a-z0-9\/-]{0,80}$/.test(path)) return;
    const ex = this.sql.exec('SELECT 1 FROM paths WHERE path = ?', path).toArray()[0];
    if (!ex) { const c = this.sql.exec('SELECT COUNT(*) AS c FROM paths').toArray()[0].c; if (c >= 2000) return; }
    this.sql.exec('INSERT INTO paths (path, n, today, t) VALUES (?, 1, ?, 1) ON CONFLICT(path) DO UPDATE SET n = n + 1, t = CASE WHEN today = excluded.today THEN t + 1 ELSE 1 END, today = excluded.today', path, day);
  }
  topPaths(limit = 100) { return this.sql.exec('SELECT path, n, today, t FROM paths ORDER BY n DESC LIMIT ?', limit).toArray(); }
  hit(hash, day, now = Date.now(), path = null) {
    const last = this.recent.get(hash);
    if (!(last && now - last < 30 * 60e3)) {
      this.recent.set(hash, now);
      if (this.recent.size > 50000) { for (const [k, v] of this.recent) if (now - v > 30 * 60e3) this.recent.delete(k); }
      this.sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', day);
      this.sql.exec("INSERT INTO meta (k, n) VALUES ('total', 1) ON CONFLICT(k) DO UPDATE SET n = n + 1");
      if (path) this.pathHit(path, day);
      return { ...this.read(day), counted: true };
    }
    return { ...this.read(day), counted: false };
  }
  aiTake(day, cap, kind = 'ai') { // 原子：今日 AI 用量 +1（未超過上限才計）
    const k = kind + ':' + day, row = this.sql.exec('SELECT n FROM meta WHERE k = ?', k).toArray()[0], used = row ? row.n : 0;
    if (used >= cap) return { ok: false, used };
    this.sql.exec('INSERT INTO meta (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1', k);
    return { ok: true, used: used + 1 };
  }
  ipTake(hash, day, cap, kind) { // 原子：此 IP（雜湊）今日次數 +1，超過上限拒絕
    const k = kind + ':' + day + ':' + hash, row = this.sql.exec('SELECT n FROM ipq WHERE k = ?', k).toArray()[0], n = row ? row.n : 0;
    if (n >= cap) return { ok: false, n };
    this.sql.exec('INSERT INTO ipq (k, n, day) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1', k, day);
    if (Math.random() < 0.02) this.sql.exec('DELETE FROM ipq WHERE day < ?', taipeiDay(Date.now() - 2 * 86400e3));
    return { ok: true, n: n + 1 };
  }
  aiUsed(day, kind = 'ai') { const r = this.sql.exec('SELECT n FROM meta WHERE k = ?', kind + ':' + day).toArray()[0]; return r ? r.n : 0; }
  history(limit = 30) { return this.sql.exec('SELECT day, n FROM days ORDER BY day DESC LIMIT ?', limit).toArray(); }
}

async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); }

async function stats(request, env) {
  const url = new URL(request.url), show = String(env.SHOW_COUNTER || 'false') === 'true';
  if (!env.STATS) return json({ ok: false, show: false }, 503);
  const stub = env.STATS.get(env.STATS.idFromName('global')), day = taipeiDay();
  if (request.method === 'GET') {
    const key = url.searchParams.get('key');
    if (key) { // 站長私人查看：/api/stats?key=<STATS_KEY>
      if (!env.STATS_KEY || key !== env.STATS_KEY) return json({ ok: false, error: 'forbidden' }, 403);
      return json({ ok: true, day, ...(await stub.read(day)), aiToday: await stub.aiUsed(day), history: await stub.history(60), paths: await stub.topPaths(Number(url.searchParams.get('n')) || 100) });
    }
    return json(show ? { ok: true, show, ...(await stub.read(day)) } : { ok: true, show: false });
  }
  if (request.method !== 'POST') return json({ ok: false }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null' && new URL(origin).host !== url.host) return json({ ok: false }, 403);
  const ua = request.headers.get('user-agent') || '';
  let path = '/'; try { const b = await request.json(); path = String(b.path || '/').slice(0, 200); } catch (e) {}
  if (BOT.test(ua) || !ua) return json(show ? { ok: true, show, counted: false, ...(await stub.read(day)) } : { ok: true, show: false, counted: false });
  const hash = await sha((request.headers.get('cf-connecting-ip') || 'local') + '|' + ua + '|' + path);
  const r = await stub.hit(hash, day, Date.now(), path.replace(/index\.html$/, '').toLowerCase());
  return json(show ? { ok: true, show, ...r } : { ok: true, show: false, counted: r.counted });
}

async function feedback(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null' && new URL(origin).host !== url.host) return json({ ok: false, error: 'forbidden' }, 403);
  const len = Number(request.headers.get('content-length') || 0); if (len > 20000) return json({ ok: false, error: 'too_large' }, 413);
  let data;
  try { const ct = request.headers.get('content-type') || ''; data = ct.includes('application/json') ? await request.json() : Object.fromEntries(await request.formData()); }
  catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (await limited(env, ip)) return json({ ok: false, error: 'rate_limited' }, 429, { 'retry-after': '60' });
  const r = validate(data);
  if (r.spam) return json({ ok: true }); // 機器人：假裝成功，不寄信
  if (r.error) { const lang = data && data.lang === 'cn' ? 'cn' : 'tw', k = r.error.split(':')[0]; return json({ ok: false, error: ERR[lang][k] || r.error, code: r.error }, 400); }
  try { await send(env, r.ok, { country: request.cf && request.cf.country, ua: request.headers.get('user-agent') || '' }); return json({ ok: true }); }
  catch (e) { console.error('feedback email failed', e && e.code, e && e.message); return json({ ok: false, error: r.ok.lang === 'cn' ? '暂时无法发送，请稍后再试或来信联系' : '暫時無法寄出，請稍後再試或來信聯絡', code: (e && e.code) || 'send_failed' }, 502); }
}

// AI 端點只接受本站頁面發出的請求（Origin 或 Referer 必須是本站）
const SITE_HOSTS = new Set(['jisuanle.com', 'www.jisuanle.com']);
export function fromSite(request) {
  const self = new URL(request.url).host, h = request.headers.get('origin') || request.headers.get('referer') || '';
  if (!h || h === 'null') return false;
  try { const host = new URL(h).host; return host === self || SITE_HOSTS.has(host); } catch (e) { return false; }
}
const IPMSG = { tw: '今天次數用完了，明天再來', cn: '今天次数用完了，明天再来', x: "You've used today's limit — please come back tomorrow." };
async function ipCap(env, request, kind, cap, ui) {
  if (!env.STATS) return null;
  const hash = await sha((request.headers.get('cf-connecting-ip') || 'local') + '|' + kind);
  const q = await env.STATS.get(env.STATS.idFromName('global')).ipTake(hash, taipeiDay(), cap, kind);
  return q.ok ? null : json({ ok: false, error: IPMSG[ui === 'tw' || ui === 'cn' ? ui : 'x'], code: 'ip_quota' }, 429, { 'retry-after': '3600' });
}

const QUOTA_ERR = /quota|neuron|limit exceeded|daily|4006|capacity|exceeded/i;

// ---------- AI 看圖配梗（Workers AI 視覺模型） ----------
const AI_MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-4-scout-17b-16e-instruct'];
const UNSAFE = /色情|做愛|性愛|裸|胸部|奶子|屌|幹你|操你|肏|婊|妓|強姦|强奸|殺人|杀人|自殺|自杀|砍死|炸彈|炸弹|毒品|吸毒|槍|枪|血腥|屍|尸|納粹|纳粹|種族|种族|黑鬼|支那|台獨|台独|共匪|習近平|习近平|川普|特朗普|拜登|蔡英文|賴清德|赖清德|毛澤東|毛泽东|政府|政黨|政党|總統|总统|主席|共產|共产|民進黨|民进党|國民黨|国民党|宗教|阿拉|耶穌|耶稣|fuck|shit|sex|nude|porn|nazi|kill/i;
const AIMSG = {
  tw: { quota: '今日 AI 額度已用完，明天再來吧！（骰子隨機梗仍可使用）', rate: '太快了，請稍等一分鐘再試', bad: '圖片格式不正確，請重新選擇圖片', fail: 'AI 暫時無法回應，請稍後再試，或先用 🎲 隨機文案', unsafe: '這張圖片無法產生合適的文案，換一張試試' },
  en: { quota: "Today's AI quota is used up — come back tomorrow! (Random captions still work.)", rate: 'Too fast — please wait a minute.', bad: 'Unsupported image, please pick another one.', fail: 'AI is unavailable right now, please try again later.', unsafe: "Couldn't write suitable captions for this image — try another one." },
  cn: { quota: '今日 AI 额度已用完，明天再来吧！（骰子随机梗仍可使用）', rate: '太快了，请稍等一分钟再试', bad: '图片格式不正确，请重新选择图片', fail: 'AI 暂时无法响应，请稍后再试，或先用 🎲 随机文案', unsafe: '这张图片无法生成合适的文案，换一张试试' }
};
const LANGN = { en: 'English', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', es: 'Spanish' };
function aiPrompt(lang) {
  if (LANGN[lang]) return `You are a witty meme caption writer. Look at this image and write 3 short, funny, family-friendly meme captions in natural, idiomatic ${LANGN[lang]} using everyday internet slang where it fits. Rules: top and bottom lines max 40 characters each; describe only the situation, expressions, animals or objects in the image; never identify or name any real person; no politics, religion, sexual content, violence, discrimination or swearing; no quotes or emoji. Output JSON only: {"captions":[{"top":"...","bottom":"..."},{"top":"...","bottom":"..."},{"top":"...","bottom":"..."}]}`;
  return lang === 'cn'
    ? '你是中国大陆的梗图文案高手。看这张图片，写 3 组简短、好笑、适合所有年龄的梗图文案，使用简体中文和自然的大陆网络用语（例如打工人、摸鱼、破防、内卷、emo、绝绝子等，自然就好）。规则：上方 top 和下方 bottom 各不超过 14 个字；内容只描述图中的情境、表情、动物或物品；不要辨认或说出任何真实人物的姓名或身份；不要涉及政治、宗教、色情、暴力、歧视、脏话；不要使用引号或表情符号。只输出 JSON：{"captions":[{"top":"...","bottom":"..."},{"top":"...","bottom":"..."},{"top":"...","bottom":"..."}]}'
    : '你是台灣的梗圖文案高手。看這張圖片，寫 3 組簡短、好笑、適合所有年齡的梗圖文案，使用繁體中文和自然的台灣口語與網路用語（例如：好累、厭世、下班、我就爛、真的會謝、傻眼貓咪等，自然就好）。規則：上方 top 和下方 bottom 各不超過 14 個字；內容只描述圖中的情境、表情、動物或物品；不要辨認或說出任何真實人物的姓名或身分；不要涉及政治、宗教、色情、暴力、歧視、髒話；不要使用引號或表情符號。只輸出 JSON：{"captions":[{"top":"...","bottom":"..."},{"top":"...","bottom":"..."},{"top":"...","bottom":"..."}]}';
}
export function parseCaptions(text) {
  if (typeof text !== 'string') text = JSON.stringify(text || '');
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const m = text.match(/\{[\s\S]*\}/); if (!m) return [];
  let o; try { o = JSON.parse(m[0]); } catch (e) { return []; }
  const arr = Array.isArray(o) ? o : (o.captions || []);
  const clean = s => String(s || '').replace(/[\u0000-\u001f<>"“”「」`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  const out = [];
  for (const c of arr) { if (!c) continue; const t = clean(c.top), b = clean(c.bottom); if (!t && !b) continue; if (UNSAFE.test(t + b)) continue; out.push({ top: t, bottom: b }); if (out.length === 3) break; }
  return out;
}
async function memeQuota(env, kind = 'ai', cap = Number(env.AI_DAILY_CAP || 500)) {
  const used = env.STATS ? await env.STATS.get(env.STATS.idFromName('global')).aiUsed(taipeiDay(), kind) : 0;
  return json({ ok: true, cap, used: Math.min(used, cap), remaining: Math.max(0, cap - used) }, 200, { 'cache-control': 'public, max-age=15' });
}
async function memeCaption(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  if (!fromSite(request)) return json({ ok: false, error: 'forbidden' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 300000) return json({ ok: false, error: AIMSG.tw.bad, code: 'too_large' }, 413);
  let d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: AIMSG.tw.bad, code: 'bad_request' }, 400); }
  const lang = d && (d.lang === 'cn' || LANGN[d.lang]) ? d.lang : 'tw', M = AIMSG[lang] || AIMSG.en, img = String((d && d.image) || '');
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 290000) return json({ ok: false, error: M.bad, code: 'bad_image' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (env.AI_RL && typeof env.AI_RL.limit === 'function') { try { const { success } = await env.AI_RL.limit({ key: 'ai:' + ip }); if (!success) return json({ ok: false, error: M.rate, code: 'rate_limited' }, 429, { 'retry-after': '60' }); } catch (e) {} }
  { const r = await ipCap(env, request, 'ai', Number(env.AI_IP_DAILY_CAP || 20), lang === 'cn' ? 'cn' : LANGN[lang] ? 'x' : 'tw'); if (r) return r; }
  const cap = Number(env.AI_DAILY_CAP || 500);
  const day = taipeiDay(); let used = 0;
  if (env.STATS) {
    const q = await env.STATS.get(env.STATS.idFromName('global')).aiTake(day, cap); used = q.used;
    if (!q.ok) return json({ ok: false, error: M.quota, code: 'quota', cap, remaining: 0 }, 429);
  }
  if (String(env.AI_MOCK || '') === 'quota') return json({ ok: false, error: M.quota, code: 'ai_quota' }, 429); // 測試：模擬 Workers AI 額度用完
  if (String(env.AI_MOCK || '') === '1') { // 本機測試用（wrangler dev 無 Cloudflare 帳號時）
    return json({ ok: true, model: 'mock', cap, remaining: Math.max(0, cap - used), captions: parseCaptions(JSON.stringify({ captions: lang === 'cn' ? [{ top: '老板说今天不加班', bottom: '我信了' }, { top: '周一的我', bottom: '电量 1%' }, { top: '摸鱼被抓', bottom: '鱼也很尴尬' }] : [{ top: '老闆說今天不加班', bottom: '我信了' }, { top: '星期一的我', bottom: '電量剩 1%' }, { top: '偷懶被抓到', bottom: '真的會謝' }] })) });
  }
  if (!env.AI) return json({ ok: false, error: M.fail, code: 'no_binding' }, 503);
  const t0 = Date.now();
  for (const model of AI_MODELS) {
    try {
      const r = await env.AI.run(model, { messages: [{ role: 'user', content: [{ type: 'text', text: aiPrompt(lang) }, { type: 'image_url', image_url: { url: img } }] }], max_tokens: 400, temperature: 0.9, chat_template_kwargs: { enable_thinking: false } });
      const text = r && (r.response !== undefined ? r.response : (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content));
      const caps = parseCaptions(text);
      if (caps.length) return json({ ok: true, model: model.split('/').pop(), ms: Date.now() - t0, captions: caps, cap, remaining: Math.max(0, cap - used) });
      console.warn('ai empty/unsafe output', model, String(text).slice(0, 200));
    } catch (e) {
      console.error('ai error', model, e && e.message);
      if (QUOTA_ERR.test(String(e && e.message))) { return json({ ok: false, error: M.quota, code: 'ai_quota' }, 429); }
    }
  }
  return json({ ok: false, error: M.unsafe, code: 'no_captions' }, 502);
}

// ---------- 翻譯（Workers AI LLM，明確指定繁體／簡體） ----------
const TLANG = { auto: 'the detected source language', 'zh-TW': 'Traditional Chinese as used in Taiwan (繁體中文，台灣用語)', 'zh-CN': 'Simplified Chinese as used in mainland China (简体中文)', en: 'English', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', ru: 'Russian', it: 'Italian', ms: 'Malay', fil: 'Filipino' };
const TMSG = { quota: { tw: '今日翻譯額度已用完，明天再來吧！', cn: '今日翻译额度已用完，明天再来吧！', x: "Today's translation quota is used up — please come back tomorrow!" }, rate: { tw: '太快了，請稍等一分鐘再試', cn: '太快了，请稍等一分钟再试', x: 'Too many requests — please wait a minute.' }, bad: { tw: '請輸入 1–1000 字的文字', cn: '请输入 1–1000 字的文字', x: 'Please enter 1–1000 characters.' }, fail: { tw: '翻譯暫時無法使用，請稍後再試', cn: '翻译暂时无法使用，请稍后再试', x: 'Translation is unavailable right now, please try again later.' } };
const tm = (k, ui) => TMSG[k][ui === 'tw' || ui === 'cn' ? ui : 'x'];
const TCAP = env => Number(env.TRANSLATE_DAILY_CAP || 300);
async function translate(request, env) {
  const url = new URL(request.url);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  if (!fromSite(request)) return json({ ok: false, error: 'forbidden' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 12000) return json({ ok: false, error: 'too_large' }, 413);
  let d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_request' }, 400); }
  const ui = String((d && d.ui) || 'tw'), text = String((d && d.text) || '').trim(), src = TLANG[d && d.source] ? d.source : 'auto', tgt = TLANG[d && d.target] && d.target !== 'auto' ? d.target : 'en';
  if (!text || [...text].length > 1000) return json({ ok: false, error: tm('bad', ui), code: 'bad_text' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (env.AI_RL && typeof env.AI_RL.limit === 'function') { try { const { success } = await env.AI_RL.limit({ key: 'tr:' + ip }); if (!success) return json({ ok: false, error: tm('rate', ui), code: 'rate_limited' }, 429, { 'retry-after': '60' }); } catch (e) {} }
  { const r = await ipCap(env, request, 'tr', Number(env.TR_IP_DAILY_CAP || 30), ui); if (r) return r; }
  const cap = TCAP(env); let used = 0;
  if (env.STATS) { const q = await env.STATS.get(env.STATS.idFromName('global')).aiTake(taipeiDay(), cap, 'tr'); used = q.used; if (!q.ok) return json({ ok: false, error: tm('quota', ui), code: 'quota', cap, remaining: 0 }, 429); }
  const rem = Math.max(0, cap - used);
  if (String(env.AI_MOCK || '') === 'quota') return json({ ok: false, error: tm('quota', ui), code: 'ai_quota', cap, remaining: 0 }, 429);
  if (String(env.AI_MOCK || '') === '1') return json({ ok: true, model: 'mock', text: '[' + tgt + '] ' + text, cap, remaining: rem });
  if (!env.AI) return json({ ok: false, error: tm('fail', ui), code: 'no_binding' }, 503);
  const sys = `You are a professional translator. Translate the user's text from ${TLANG[src]} into ${TLANG[tgt]}. Keep the meaning, tone, line breaks, numbers, names and formatting. Use natural, idiomatic wording for native readers. Output ONLY the translation — no explanations, no quotes, no notes. If the text is already in the target language, return it with only minimal corrections.`;
  const t0 = Date.now();
  for (const model of ['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-4-scout-17b-16e-instruct']) {
    try {
      const r = await env.AI.run(model, { messages: [{ role: 'system', content: sys }, { role: 'user', content: text }], max_tokens: 1500, temperature: 0.2, chat_template_kwargs: { enable_thinking: false } });
      let out = r && (r.response !== undefined ? r.response : (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content));
      if (typeof out !== 'string') out = out == null ? '' : String(out);
      out = out.replace(/<think>[\s\S]*?<\/think>/g, '').trim().slice(0, 6000);
      if (out) return json({ ok: true, model: model.split('/').pop(), ms: Date.now() - t0, text: out, cap, remaining: rem });
    } catch (e) { console.error('translate error', model, e && e.message); if (QUOTA_ERR.test(String(e && e.message))) return json({ ok: false, error: tm('quota', ui), code: 'ai_quota', cap, remaining: 0 }, 429); }
  }
  return json({ ok: false, error: tm('fail', ui), code: 'failed' }, 502);
}

// ---------- 匯率（open.er-api.com，Cache API 快取 6 小時） ----------
async function rates(request, env, ctx) {
  const cache = caches.default, key = new Request('https://jisuanle.com/__rates_cache_v1');
  let hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800', 'x-cache': 'HIT' } });
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { cf: { cacheTtl: 21600 } }); const j = await r.json();
    if (j.result !== 'success') throw new Error('bad source');
    const body = JSON.stringify({ ok: true, base: 'USD', time: j.time_last_update_unix, source: 'open.er-api.com', rates: j.rates });
    const resp = new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=21600' } });
    ctx && ctx.waitUntil ? ctx.waitUntil(cache.put(key, resp.clone())) : await cache.put(key, resp.clone());
    return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800', 'x-cache': 'MISS' } });
  } catch (e) { return json({ ok: false, error: 'rates_unavailable' }, 502); }
}

// ---------- 統一發票中獎號碼（財政部稅務入口網官方 RSS，Cache API 快取 6 小時） ----------
function parseInvoiceRss(xml) {
  const out = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1], cd = (tag) => { const x = it.match(new RegExp('<' + tag + '>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</' + tag + '>')); return x ? x[1].trim() : ''; };
    const title = cd('title'), desc = cd('description'), link = cd('link');
    const t = title.match(/(\d+)年\s*(\d+)~(\d+)月/); if (!t) continue;
    const get = (k) => { const x = desc.match(new RegExp(k + '：([0-9、,\\s]+)')); return x ? x[1].split(/[、,\s]+/).filter((n) => /^\d{8}$/.test(n)) : []; };
    const p = { id: t[1] + t[2].padStart(2, '0'), title: title, link: link, special: get('特別獎'), grand: get('特獎'), first: get('頭獎'), extra6: get('增開六獎').length ? get('增開六獎') : (desc.match(/增開六獎：([0-9、,\s]+)/) || ['', ''])[1].split(/[、,\s]+/).filter((n) => /^\d{3}$/.test(n)) };
    if (p.special.length === 1 && p.grand.length === 1 && p.first.length >= 3) out.push(p);
  }
  return out;
}
async function invoice(request, env, ctx) {
  const cache = caches.default, key = new Request('https://jisuanle.com/__invoice_cache_v1');
  const hit = await cache.match(key);
  if (hit) return new Response(hit.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800', 'x-cache': 'HIT' } });
  try {
    const r = await fetch('https://invoice.etax.nat.gov.tw/invoice.xml', { cf: { cacheTtl: 21600 } });
    const periods = parseInvoiceRss(await r.text());
    if (!periods.length) throw new Error('bad source');
    const body = JSON.stringify({ ok: true, source: 'https://invoice.etax.nat.gov.tw/invoice.xml', fetched: Date.now(), periods });
    const resp = new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=21600' } });
    ctx && ctx.waitUntil ? ctx.waitUntil(cache.put(key, resp.clone())) : await cache.put(key, resp.clone());
    return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800', 'x-cache': 'MISS' } });
  } catch (e) { return json({ ok: false, error: 'invoice_unavailable' }, 502); }
}

// ---------- 首頁依瀏覽器語言自動導向（只限根目錄 /，第一次造訪、無 jsl_lang cookie、非機器人） ----------
const LANG_EDS = ['en', 'ja', 'ko', 'vi', 'th', 'id', 'es'];
const LANG_BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|monitor|curl|wget|python|httpclient|java\/|go-http|axios|node-fetch|scrapy|embedly|whatsapp|telegram|discord|line\//i;
export function pickEdition(al) {
  const items = String(al || '').split(',').map((p, i) => { const [tag, ...ps] = p.trim().split(';'); const q = ps.map(x => x.trim()).find(x => x.startsWith('q=')); return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1, i }; })
    .filter(x => x.tag && x.tag !== '*' && x.q > 0 && !isNaN(x.q)).sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of items) {
    const [base, ...rest] = tag.split('-');
    if (base === 'zh') { if (rest.some(r => r === 'tw' || r === 'hk' || r === 'mo' || r === 'hant')) return 'tw'; return 'cn'; }
    if (LANG_EDS.includes(base)) return base;
  }
  return items.length ? 'en' : null;
}
async function home(request, env) {
  const ua = request.headers.get('user-agent') || '', al = request.headers.get('accept-language') || '', ck = request.headers.get('cookie') || '';
  const pass = () => env.ASSETS.fetch(request);
  if (request.method !== 'GET' || /(?:^|;\s*)jsl_lang=/.test(ck) || !ua || LANG_BOT.test(ua) || !al) return pass();
  const ed = pickEdition(al); if (!ed) return pass();
  const cookie = `jsl_lang=${ed}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`, vary = 'Accept-Language, Cookie';
  if (ed === 'tw') { const r = await pass(), h = new Headers(r.headers); h.append('set-cookie', cookie); h.set('vary', vary); h.set('cache-control', 'private, no-store'); return new Response(r.body, { status: r.status, headers: h }); }
  const u = new URL(request.url); u.pathname = '/' + ed + '/';
  return new Response(null, { status: 302, headers: { location: u.pathname + u.search, 'set-cookie': cookie, vary, 'cache-control': 'private, no-store' } });
}

/* 小說章節留言：GET/POST /api/novel-comments?ch=fridge/c02（KV） */
const CH_RE = /^[a-z0-9-]{1,40}\/c\d{1,4}$/;
const MAX_KEEP = 300;
const lastPost = new Map();
const pub = ({ th, ...c }) => c; // 刪除權杖只存雜湊，不對外
async function sha256(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function cleanComment(name, text) {
  name = String(name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 20) || '讀者';
  text = String(text || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  let n = 0; // 只保留第一個連結
  text = text.replace(/\b(?:https?:\/\/|www\.)\S+/gi, m => (++n === 1 ? m : '[連結已移除]'));
  if (/(?:https?:\/\/|www\.)/i.test(name)) name = '讀者';
  const len = [...text].length;
  if (len < 2) return { error: 'too_short' };
  if (len > 500) return { error: 'too_long' };
  return { name: esc(name), text: esc(text) };
}
async function novelComments(request, env) {
  const kv = env.NOVEL_COMMENTS;
  if (!kv) return json({ ok: false, error: 'unavailable' }, 503);
  const ch = new URL(request.url).searchParams.get('ch') || '';
  if (!CH_RE.test(ch)) return json({ ok: false, error: 'bad_chapter' }, 400);
  const key = 'c:' + ch;
  if (request.method === 'GET') {
    const list = (await kv.get(key, 'json')) || [];
    const tops = list.filter(c => !c.pid).slice(0, 100), ids = new Set(tops.map(c => c.id));
    const reps = list.filter(c => c.pid && ids.has(c.pid));
    return json({ ok: true, ch, comments: tops.concat(reps).map(pub), total: list.filter(c => !c.pid || list.some(p => p.id === c.pid)).length });
  }
  if (request.method === 'DELETE') {
    const u = new URL(request.url).searchParams, id = u.get('id') || '', tok = u.get('token') || '';
    if (!/^[a-z0-9]{6,20}$/.test(id) || !/^[a-f0-9]{32}$/.test(tok)) return json({ ok: false, error: 'bad_request' }, 400);
    const list = (await kv.get(key, 'json')) || [], i = list.findIndex(c => c.id === id);
    if (i < 0) return json({ ok: false, error: 'not_found' }, 404);
    if (!list[i].th || list[i].th !== await sha256(tok)) return json({ ok: false, error: 'forbidden' }, 403);
    const left = list.filter(c => c.id !== id && c.pid !== id); // 刪主留言時一併刪除其回覆
    await kv.put(key, JSON.stringify(left));
    return json({ ok: true, deleted: id, removed: list.length - left.length });
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  const ak = request.headers.get('x-admin-key') || '';
  const admin = !!(env.COMMENT_ADMIN_KEY && ak && ak === env.COMMENT_ADMIN_KEY);
  if (ak && !admin) return json({ ok: false, error: 'forbidden' }, 403);
  if (!admin && !fromSite(request)) return json({ ok: false, error: 'forbidden' }, 403);
  let d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400); }
  if (d && d.website) return json({ ok: true, ignored: true }); // 蜜罐
  const c = cleanComment(d && d.name, d && d.text);
  if (c.error) return json({ ok: false, error: c.error }, 400);
  let pid = '';
  if (d && d.parent) {
    if (!/^[a-z0-9]{6,20}$/.test(String(d.parent))) return json({ ok: false, error: 'bad_request' }, 400);
    const cur = (await kv.get(key, 'json')) || [], p = cur.find(x => x.id === d.parent);
    if (!p) return json({ ok: false, error: 'not_found' }, 404);
    pid = p.pid || p.id; // 回覆的回覆掛在同一則主留言下（只一層）
  }
  let ip = request.headers.get('cf-connecting-ip') || 'x', now = Date.now();
  if (!admin) {
  if (ip.includes(':')) ip = ip.split(':').slice(0, 4).join(':') + '::/64'; // IPv6 以 /64 計
  if (now - (lastPost.get(ip) || 0) < 30_000) return json({ ok: false, error: 'rate_limited' }, 429);
  if (env.COMMENT_RL) { try { const { success } = await env.COMMENT_RL.limit({ key: ip }); if (!success) return json({ ok: false, error: 'rate_limited' }, 429); } catch (e) {} }
  if (env.COMMENT_GATE) { try { if (!(await env.COMMENT_GATE.get(env.COMMENT_GATE.idFromName('ip:' + ip)).take(30_000))) return json({ ok: false, error: 'rate_limited' }, 429); } catch (e) {} }
  lastPost.set(ip, now); if (lastPost.size > 5000) lastPost.clear();
  }
  const token = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  const item = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), name: c.name, text: c.text, at: new Date(now).toISOString(), th: await sha256(token) };
  if (pid) item.pid = pid;
  if (admin) { item.au = true; if (!d.name) item.name = '作者'; }
  const list = (await kv.get(key, 'json')) || [];
  list.unshift(item);
  await kv.put(key, JSON.stringify(list.slice(0, MAX_KEEP)));
  return json({ ok: true, comment: pub(item), token });
}

// 每 IP 一個 Durable Object：強一致的 30 秒留言冷卻
export class CommentGate extends DurableObject {
  async take(ms) {
    const now = Date.now(), last = (await this.ctx.storage.get('t')) || 0;
    if (now - last < ms) return false;
    await this.ctx.storage.put('t', now);
    await this.ctx.storage.setAlarm(now + 3600e3);
    return true;
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/') return home(request, env);
    if (url.pathname === '/api/feedback') return feedback(request, env);
    if (url.pathname === '/api/stats') return stats(request, env);
    if (url.pathname === '/api/meme-caption/quota') return memeQuota(env);
    if (url.pathname === '/api/translate/quota') return memeQuota(env, 'tr', TCAP(env));
    if (url.pathname === '/api/translate') return translate(request, env);
    if (url.pathname === '/api/invoice') return invoice(request, env, ctx);
    if (url.pathname === '/api/rates') return rates(request, env, ctx);
    if (url.pathname === '/api/meme-caption') return memeCaption(request, env, ctx);
    if (url.pathname === '/api/novel-comments') return novelComments(request, env);
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not_found' }, 404);
    return env.ASSETS.fetch(request); // run_worker_first 只匹配 /api/*，其他路徑通常不會到這裡
  }
};
