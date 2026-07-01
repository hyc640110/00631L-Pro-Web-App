# 00631L Pro Web App

## 專案資訊

Repository：
https://github.com/hyc640110/00631L-Pro-Web-App

GitHub Pages：
https://hyc640110.github.io/00631L-Pro-Web-App/

目前版本：
v6.2 Sync Fix 開發中

---

## 目前狀態

GitHub Pages 已可正常開啟畫面。

本機 localhost 可正常執行。

Firebase Realtime Database 可看到雲端資料路徑 `/portfolio/631128`。

目前正在修正手機與電腦下載後狀態提示不清楚、雲端資料套用不明確的問題。

---

## 已完成

- Vite
- React
- TypeScript
- Firebase Realtime Database
- GitHub Pages
- PWA / Service Worker
- 離線模式
- JSON 備份 / 還原
- Firebase 上傳 / 下載
- Firebase 自動同步設定
- 持股管理
- 現金管理
- 借款管理
- 交易紀錄
- 再平衡建議
- AI 加碼建議
- 十年成長模擬
- Cloudflare Worker URL 設定欄位
- 股價自動更新間隔設定

---

## Firebase

Realtime Database：已完成。

資料路徑格式：

```txt
/portfolio/{自訂個人密鑰}
```

目前已統一使用：

```txt
/portfolio/631128
```

注意：手機與電腦必須輸入同一組 Database URL 與同一組個人密鑰，才會讀寫同一份雲端資料。

---

## GitHub Pages

目前已部署完成，可從 GitHub Pages 網址開啟。

若畫面異常，優先檢查：

1. GitHub Pages 是否使用 Actions 部署。
2. Vite base 是否符合 `/00631L-Pro-Web-App/`。
3. 瀏覽器是否載入舊快取，可先重新整理或清除網站資料。

---

## Cloudflare Worker

目前 App 已提供 Cloudflare Worker URL 欄位。

若未填 Worker URL，瀏覽器可能因 CORS 無法直接抓 Yahoo 股價，會顯示「離線備援 / API 未連線」。

下一步要完成的是部署 `worker/index.js` 到 Cloudflare Worker，並把 Worker URL 填回 App。

---

## 下一步

1. 修正同步診斷：顯示下載中、下載成功、下載失敗、同步路徑與資料筆數。
2. 確認手機下載雲端後可套用電腦上傳的股數。
3. 完成 Cloudflare Worker 股價 Proxy 部署。
4. 新增技術指標：KD、MA5、MA20、RSI、MACD。
5. 強化 AI 加碼 / 再平衡邏輯。
