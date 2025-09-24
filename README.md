# 智慧簽單及派工系統 (Electronic-Approval-System)

簡短說明：智慧簽單及派工系統，支援精準工時計算、彈性機具管理、多平台離線/同步功能，前端採用 Blazor WebAssembly，後端採用 Firebase（Authentication, Firestore, Storage, Functions, Hosting, Messaging）。

## 主要特色
- 工時計算：記錄開始/結束時間，自動計算總工時（支援跨日與小數表示）。
- 機具管理：支援多選機具、臨時新增機具、後台維護與使用率統計。
- 記錄完整性：簽單包含日期、客戶、施工地點、作業狀況、車號、司機、金額、備註、客戶簽章等欄位。
- 離線支援：行動裝置可離線填寫簽單，網路恢復後自動同步。
- 即時通知：結合 Firebase Cloud Messaging 發送新工作與狀態更新通知。

## 主要使用者
- 司機：戶外作業者，使用行動裝置完成簽單與簽名。
- 客戶：在現場進行簽名確認。
- 後台管理人員：管理客戶、機具、檢視報表與財務整合。

## 核心功能摘要

1. 簽單管理
	- 欄位：日期、客戶名稱、施工地點、作業狀況、開始/結束時間、總工時、機具、車號、司機、金額、備註、客戶簽章。
	- 功能：PDF 匯出、列印、郵件寄送、歷史紀錄查詢。

2. 機具管理
	- 多選機具、快速選單、臨時新增機具。
	- 後台可新增/編輯/停用機具，系統記錄使用頻率與時數，支援報表篩選。

3. 時間與報表
	- 自動工時計算、跨日支援、工時分析（依客戶/機具/期間）。

4. 身分驗證與安全
	- Firebase Authentication（支援 LINE、Email、手機驗證）。
	- Firestore 安全規則、HTTPS 傳輸、操作日誌、資料備份。

## 技術架構
- 前端：Blazor WebAssembly（.NET 7+）、PWA 支援、選用 UI 元件庫（Blazorise / MudBlazor）。
- 後端：Firebase（Authentication, Cloud Firestore, Cloud Storage, Cloud Functions, Hosting, Cloud Messaging）。
- 離線儲存：IndexedDB / LocalStorage（同步策略與衝突解決）。

## prototype（原型）
- 位置：`prototype/` 資料夾。包含 `index.html`, `new-delivery.html`, `history.html` 等頁面，可在瀏覽器中開啟預覽。

## 如何開始（快速）
1. 開啟 `prototype/index.html` 在瀏覽器查看 UI 原型。
2. 若要以 Blazor 實作前端，請建立 Blazor WebAssembly 專案，並安裝 Firebase .NET SDK 進行整合。

## 後續建議
- 實作用户測試以驗證司機在戶外環境之操作流暢度。
- 設計離線同步優先策略，避免資料衝突。
- 建立機具資料匯入機制，方便大量上傳既有機具資料。

---

如需我把某段內容放到 `spec.md` 或產生更詳細的開發任務清單，我可以接著幫您產出。

了解 ✅
我幫你把 **常見問題 (FAQ)** 也寫進 `README.md`，這樣 teammate 碰到你之前遇到的狀況，就不用再一個一個問你。

---

以下是完整的 `README.md` 範本，你可以直接 copy ⬇️

````markdown
# 智慧簽單系統 (Firebase Prototype)

這是我們團隊的 Firebase Demo 專案，包含以下功能：
- Firestore：儲存簽單資料
- Authentication：登入 (目前先測試用)
- Storage：存照片檔案 (預留)

---

## 🚀 開發環境安裝

1. **安裝 Node.js**
   - [Node.js LTS 版本](https://nodejs.org/en/) (建議 v18 以上)
   - 安裝完後檢查：
     ```bash
     node -v
     npm -v
     ```

2. **安裝 Firebase CLI**
   ```bash
   npm install -g firebase-tools
````

檢查版本：

```bash
firebase --version
```

3. **安裝本地伺服器**

   ```bash
   npm install -g http-server
   ```

---

## ⚡ 本地測試步驟

1. 啟動 Firebase Emulator (Firestore + Auth + Storage)

   ```bash
   firebase emulators:start
   ```

   預設埠口：

   * Firestore → 8080
   * Auth → 9099
   * Storage → 9199
   * Emulator UI → 4000 → [http://127.0.0.1:4000](http://127.0.0.1:4000)

2. 開啟本地伺服器 (另外開一個終端機)

   ```bash
   npx http-server ./prototype -p 3000
   ```

   網址 → [http://127.0.0.1:3000](http://127.0.0.1:3000)

3. 開啟 `new-delivery.html`
   填寫表單 → 送出 → 確認 Firestore 有出現新資料。

---

## 👥 分工 (可調整)

* `index.html` → XXX 負責
* `history.html` → XXX 負責
* `new-delivery.html` → XXX 負責
* `firebase-init.js` → 已設定好，不要亂動

---

## ❓ 常見問題 (FAQ)

### 1. 為什麼跑 `firebase` 指令說找不到？

➡ 代表 **npm 沒有裝好或 PATH 沒設定**。請重新安裝 Node.js (記得勾選 *Add to PATH*)，再跑：

```bash
npm install -g firebase-tools
```

### 2. 為什麼 `firebase emulators:start` 一直說 "port 被佔用"？

➡ 有可能 emulator 沒關乾淨。解決方法：

* 把之前的 emulator 視窗關掉 (CTRL + C)
* 或是重新開機再跑

### 3. 為什麼瀏覽器開啟 `new-delivery.html` 沒有顯示資料？

➡ 請確認：

* Emulator 有啟動 (`http://127.0.0.1:4000`)
* Console 有印出「📌 即將送出的資料」
* Firestore → `deliveryNotes` collection 有新文件

### 4. 為什麼 `npm` 或 `firebase` 說 **因為 PowerShell 禁止執行**？

➡ 請在 PowerShell 輸入：

```bash
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

然後重新開機。

### 5. teammate 需要裝什麼？

➡ 需要自己安裝：

* Node.js
* Firebase CLI
* http-server (建議)
  ➡ 其他東西直接 `git pull` 專案即可。

---

## ✅ 完成驗收方式

* 本地開 `http://127.0.0.1:3000/new-delivery.html`
* 填寫簽單 → 點「完成簽單」
* Firestore (Emulator UI 4000) 看到新文件

```

---

要不要我幫你把 **圖片 (螢幕截圖)** 的操作路徑也加進 README？這樣 teammate 就算沒經驗，也能跟著點。
```
da