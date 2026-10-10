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
    this.recent = new Map(); // 30 分鐘去重（記憶體；DO 休眠後重置，可接受）
  }
  read(day) {
    const t = this.sql.exec('SELECT n FROM days WHERE day = ?', day).toArray()[0];
    const all = this.sql.exec("SELECT n FROM meta WHERE k = 'total'").toArray()[0];
    return { today: t ? t.n : 0, total: all ? all.n : 0 };
  }
  hit(hash, day, now = Date.now()) {
    const last = this.recent.get(hash);
    if (!(last && now - last < 30 * 60e3)) {
      this.recent.set(hash, now);
      if (this.recent.size > 50000) { for (const [k, v] of this.recent) if (now - v > 30 * 60e3) this.recent.delete(k); }
      this.sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', day);
      this.sql.exec("INSERT INTO meta (k, n) VALUES ('total', 1) ON CONFLICT(k) DO UPDATE SET n = n + 1");
      return { ...this.read(day), counted: true };
    }
    return { ...this.read(day), counted: false };
  }
  aiTake(day, cap) { // 原子：今日 AI 用量 +1（未超過上限才計）
    const k = 'ai:' + day, row = this.sql.exec('SELECT n FROM meta WHERE k = ?', k).toArray()[0], used = row ? row.n : 0;
    if (used >= cap) return { ok: false, used };
    this.sql.exec('INSERT INTO meta (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1', k);
    return { ok: true, used: used + 1 };
  }
  aiUsed(day) { const r = this.sql.exec('SELECT n FROM meta WHERE k = ?', 'ai:' + day).toArray()[0]; return r ? r.n : 0; }
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
      return json({ ok: true, day, ...(await stub.read(day)), aiToday: await stub.aiUsed(day), history: await stub.history(60) });
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
  const r = await stub.hit(hash, day);
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

const QUOTA_ERR = /quota|neuron|limit exceeded|daily|4006|capacity|exceeded/i;

// ---------- AI 看圖配梗（Workers AI 視覺模型） ----------
const AI_MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-4-scout-17b-16e-instruct'];
const UNSAFE = /色情|做愛|性愛|裸|胸部|奶子|屌|幹你|操你|肏|婊|妓|強姦|强奸|殺人|杀人|自殺|自杀|砍死|炸彈|炸弹|毒品|吸毒|槍|枪|血腥|屍|尸|納粹|纳粹|種族|种族|黑鬼|支那|台獨|台独|共匪|習近平|习近平|川普|特朗普|拜登|蔡英文|賴清德|赖清德|毛澤東|毛泽东|政府|政黨|政党|總統|总统|主席|共產|共产|民進黨|民进党|國民黨|国民党|宗教|阿拉|耶穌|耶稣|fuck|shit|sex|nude|porn|nazi|kill/i;
const AIMSG = {
  tw: { quota: '今日 AI 額度已用完，明天再來吧！（骰子隨機梗仍可使用）', rate: '太快了，請稍等一分鐘再試', bad: '圖片格式不正確，請重新選擇圖片', fail: 'AI 暫時無法回應，請稍後再試，或先用 🎲 隨機文案', unsafe: '這張圖片無法產生合適的文案，換一張試試' },
  cn: { quota: '今日 AI 额度已用完，明天再来吧！（骰子随机梗仍可使用）', rate: '太快了，请稍等一分钟再试', bad: '图片格式不正确，请重新选择图片', fail: 'AI 暂时无法响应，请稍后再试，或先用 🎲 随机文案', unsafe: '这张图片无法生成合适的文案，换一张试试' }
};
function aiPrompt(lang) {
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
  const clean = s => String(s || '').replace(/[\u0000-\u001f<>"“”「」`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const out = [];
  for (const c of arr) { if (!c) continue; const t = clean(c.top), b = clean(c.bottom); if (!t && !b) continue; if (UNSAFE.test(t + b)) continue; out.push({ top: t, bottom: b }); if (out.length === 3) break; }
  return out;
}
async function memeQuota(env) {
  const cap = Number(env.AI_DAILY_CAP || 500), used = env.STATS ? await env.STATS.get(env.STATS.idFromName('global')).aiUsed(taipeiDay()) : 0;
  return json({ ok: true, cap, used: Math.min(used, cap), remaining: Math.max(0, cap - used) }, 200, { 'cache-control': 'public, max-age=15' });
}
async function memeCaption(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== 'null' && new URL(origin).host !== url.host) return json({ ok: false, error: 'forbidden' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 300000) return json({ ok: false, error: AIMSG.tw.bad, code: 'too_large' }, 413);
  let d; try { d = await request.json(); } catch (e) { return json({ ok: false, error: AIMSG.tw.bad, code: 'bad_request' }, 400); }
  const lang = d && d.lang === 'cn' ? 'cn' : 'tw', M = AIMSG[lang], img = String((d && d.image) || '');
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 290000) return json({ ok: false, error: M.bad, code: 'bad_image' }, 400);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (env.AI_RL && typeof env.AI_RL.limit === 'function') { try { const { success } = await env.AI_RL.limit({ key: 'ai:' + ip }); if (!success) return json({ ok: false, error: M.rate, code: 'rate_limited' }, 429, { 'retry-after': '60' }); } catch (e) {} }
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/feedback') return feedback(request, env);
    if (url.pathname === '/api/stats') return stats(request, env);
    if (url.pathname === '/api/meme-caption/quota') return memeQuota(env);
    if (url.pathname === '/api/meme-caption') return memeCaption(request, env, ctx);
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'not_found' }, 404);
    return env.ASSETS.fetch(request); // run_worker_first 只匹配 /api/*，其他路徑通常不會到這裡
  }
};
