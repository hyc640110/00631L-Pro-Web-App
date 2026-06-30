# 00631L Pro Web App v6.2 Ultimate

本版重點：Firebase 自動同步、跨裝置資料共享、JSON 備份還原、GitHub Pages 部署、Cloudflare Worker 股價代理。

## 本機啟動

```cmd
npm.cmd install
npm.cmd run dev
```

## 建置

```cmd
npm.cmd run build
```

## Firebase 同步使用方式

1. 建立 Firebase Realtime Database。
2. 複製 Database URL，例如 `https://xxx-default-rtdb.firebaseio.com`。
3. 在 App 的「同步設定」輸入 Firebase URL。
4. 輸入自訂個人密鑰，例如 `my-00631l`。
5. Windows 先按「上傳雲端」。
6. iPhone 使用同一個網址與密鑰後按「下載雲端」。
7. 確認資料一致後啟用「自動同步」。

## GitHub Pages

本專案使用 Vite base：`/00631L-Pro-Web-App/`。
若 Repository 名稱不同，請修改 `vite.config.ts` 的 base。
