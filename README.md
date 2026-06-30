# 00631L Pro Web App v6.1 Ultimate

可在本機執行的台股槓桿配置儀表板。

## 本機啟動

```cmd
npm.cmd install
npm.cmd run dev
```

若 PowerShell 擋住 `npm`，請使用 `npm.cmd`。

## v6.1 更新

- 新增完整交易紀錄頁：買進、賣出、配息、手續費、證交稅、套用到持股。
- 改良 Cloudflare Worker 股價 Proxy。
- 改良 Firebase 上傳 / 下載同步。
- 改良 JSON 備份與還原。
- 改良資產配置、十年成長曲線與風險條。
- 保留離線備援資料，API 失敗時仍可使用模擬與配置功能。

## Cloudflare Worker

將 `worker/index.js` 部署到 Cloudflare Worker，取得網址後填入網頁的「Cloudflare Worker URL」。

## GitHub Pages

`.github/workflows/deploy.yml` 已包含 GitHub Pages 部署流程。
