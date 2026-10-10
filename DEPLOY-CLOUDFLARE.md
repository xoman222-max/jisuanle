# 部署到 Cloudflare Pages（jisuanle.com）

> 介面文字以 2026 年 10 月 Cloudflare 官方文件為準；Cloudflare 偶爾改版，按鈕名稱可能略有不同（例如「Upload assets」或「Drag and drop your files」）。
> 官方說明：https://developers.cloudflare.com/pages/get-started/direct-upload/

## 一、第一次上傳

1. 登入 https://dash.cloudflare.com ，左側選單點 **Workers & Pages**（中文介面為「Workers 和 Pages」）。
2. 按 **Create application**（建立應用程式）→ 選 **Pages** 分頁 → **Upload assets**（上傳資產）。
   - 新版介面可能顯示為 **Get started** → **Drag and drop your files**，功能相同。
3. **Project name** 填 `jisuanle`（只能小寫英數與 -，會成為 `jisuanle.pages.dev`）→ **Create project**。
4. 把 `tw-calc-site.zip` 整個拖進上傳框（或選解壓後的資料夾，資料夾最上層要直接是 `index.html`）。
5. 上傳完成後按 **Deploy site**（部署網站）。約 1 分鐘後打開 `https://jisuanle.pages.dev/` 確認正常。

> 限制：直接上傳每個檔案最大 25 MiB、最多 20,000 個檔案。本站最大檔案 20.7 MiB、共約 120 個檔案，符合限制。

## 二、綁定 jisuanle.com 與 www

1. 進入 `jisuanle` 專案 → **Custom domains**（自訂網域）→ **Set up a custom domain**。
2. 輸入 `jisuanle.com` → **Continue** → **Activate domain**。因為網域本來就在 Cloudflare，DNS 記錄會自動建立。
3. 再做一次，輸入 `www.jisuanle.com`。
4. 等狀態變成 **Active**（通常幾分鐘，最多 24 小時），HTTPS 憑證會自動簽發。
5. 讓 www 轉到主網域（避免 Google 視為兩個網站）：左側回到網域 **jisuanle.com** → **Rules（規則）** → **Redirect Rules（重新導向規則）** → **Create rule**，可直接選範本「Redirect from WWW to root」，狀態碼 301，儲存。

## 三、之後更新網站

專案頁 → **Deployments**（部署）→ **Create deployment**（建立新部署）→ 選 Production → 再上傳一次最新的 zip。舊版本會保留，可隨時 **Rollback**。

## 四、Google Search Console（DNS TXT 驗證）

1. 打開 https://search.google.com/search-console → **新增資源** → 選左邊「**網域**」→ 輸入 `jisuanle.com` → 繼續。
2. Google 會給一串 `google-site-verification=xxxx`，按「複製」。
3. 回 Cloudflare → 網域 **jisuanle.com** → **DNS** → **Records** → **Add record**：
   - Type：`TXT`　Name：`@`　Content：貼上剛才那串　TTL：Auto → **Save**。
4. 回 Search Console 按 **驗證**（DNS 生效可能要幾分鐘到幾小時，失敗就稍後再按）。
5. 驗證成功後，左側 **Sitemap** → 輸入 `https://jisuanle.com/sitemap.xml` → **提交**。

## 五、網站已內建的 Cloudflare 設定

- `_headers`：安全標頭；`/vendor`、`/models` 長期快取，`/css`、`/js` 快取 1 天；AI 工具頁（圖片放大、AI 去背）加上 `Cross-Origin-Opener-Policy: same-origin` 與 `Cross-Origin-Embedder-Policy: credentialless`，讓 AI 用多執行緒加速。用 credentialless 是為了日後放 AdSense 也不會被擋。
- `_redirects`：幾個常見簡短網址的轉址。
- `404.html`：找不到頁面時自動顯示。
- 修改聯絡信箱：改 `build/gen.js` 裡的 `CONTACT_EMAIL` 一行，執行 `node build/gen.js` 後重新上傳。
