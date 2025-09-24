# 智慧簽單及派工系統 (Electronic-Approval-System)

智慧簽單及派工系統，支援精準工時計算、彈性機具管理、多平台離線/同步功能。  
前端採用 **Firebase Web SDK**，後端採用 **Firebase**（Authentication, Firestore, Storage, Functions, Hosting, Messaging）。

---

## 🎯 專案狀態
✅ **Firebase 環境已就緒** - Auth, Firestore, Storage, Emulator 已設定完成  
✅ **資料流程已驗證** - deliveryNotes 能成功寫入 Firestore  
🚧 **開發進行中** - 4 個核心功能正在實作  

---

## ✨ 主要特色
- **工時計算**：記錄開始/結束時間，自動計算總工時（支援跨日與小數表示）。
- **機具管理**：支援多選機具、臨時新增機具、後台維護與使用率統計。
- **記錄完整性**：簽單包含日期、客戶、施工地點、作業狀況、車號、司機、金額、備註、客戶簽章等欄位。
- **離線支援**：行動裝置可離線填寫簽單，網路恢復後自動同步。
- **即時通知**：整合 Firebase Cloud Messaging，發送新工作與狀態更新通知。

---

## ✅ 環境驗收標準
- Emulator UI 能看到 Firestore/Auth/Storage 服務  
- 填寫表單送出後，`deliveryNotes` collection 出現新資料  
- Browser Console 沒有 Firebase 連接錯誤  
- 能正常在不同頁面間導航  

---

## 📋 當前開發任務（Sprint 1）
🎯 **目標**：完成端到端 Demo  
⏳ **時程**：3–5 天  
🏆 **成功標準**：能錄製 1 分鐘影片展示「登入 → 填表 → 簽名 → 送出 → History 查看」  

| Issue | 功能                 | 負責人 | 狀態       | 檔案                          |
|-------|----------------------|--------|------------|-------------------------------|
| #1    | 工時計算 & 表單驗證  | 待分配 | 🔄 進行中  | `js/form-validation.js`       |
| #2    | 簽名 Canvas & Storage | 待分配 | 🔄 進行中  | `js/signature.js`             |
| #3    | Firebase Auth 整合   | 待分配 | 🔄 進行中  | `js/auth.js`                  |
| #4    | History & 離線同步   | 待分配 | 🔄 進行中  | `js/history.js, js/offline.js`|

---

## 🧪 測試流程
### 基礎測試
1. 開啟 `http://localhost:3000/new-delivery.html`  
2. 填寫表單各欄位  
3. 點擊「完成簽單」  
4. 檢查 Emulator UI (`http://localhost:4000`) → Firestore → `deliveryNotes`  
5. 確認新資料出現且格式正確  

### 整合測試
- **登入測試**：使用 `dev@example.com / test123`  
- **工時測試**：測試同日與跨日時間計算  
- **簽名測試**：Canvas 簽名並確認上傳到 Storage  
- **離線測試**：關閉網路填表 → 開啟網路 → 確認同步  


## 🚀 開發環境設定（已驗證可用）

### 前置條件
- **Node.js 18+** → [下載](https://nodejs.org/)  
- **Firebase CLI** → `npm i -g firebase-tools`  
- **http-server** → `npm i -g http-server`  

### 快速啟動（PowerShell）
```powershell
# 1. Clone 專案
git clone https://github.com/Kiwi485/Electronic-Approval-System.git
cd Electronic-Approval-System

# 2. 啟動 Firebase Emulator  
firebase emulators:start
# 🔗 Emulator UI: http://localhost:4000

# 3. 啟動前端（另開 PowerShell 視窗）
npx http-server .\prototype -p 3000
# 🔗 前端: http://localhost:3000/new-delivery.html


了解 👍 你要的是把 **所有 FAQ 的問題與答案** 完整收錄成 **Markdown Q\&A 文件**。以下是整理好的版本：

````markdown
## ❓ 常見問題 (FAQ)

### 1. 為什麼 `firebase` 指令找不到？
- **問題**：PowerShell 顯示「firebase 不是內部或外部命令」  
- **解決方案**：確認已安裝 Firebase CLI →  
  ```powershell
  npm i -g firebase-tools
````

並重新啟動終端機

---

### 2. Emulator 說 port 被佔用？

* **問題**：`firebase emulators:start` 顯示 port 4000/8080 被佔用
* **解決方案**：關閉已佔用的程式，或在 `firebase.json` 中修改 port

---

### 3. 表單送出後沒有資料？

* **問題**：點擊送出後 Firestore 沒有新資料
* **檢查清單**：

  * Emulator 有啟動且 UI 可訪問 ([http://localhost:4000](http://localhost:4000))
  * Browser Console 有印出「📌 即將送出的資料」
  * 沒有 JavaScript 錯誤
  * 表單所有必填欄位都有填寫

---

### 4. PowerShell 執行政策問題

* **問題**：「因為這個系統上已停用指令碼執行」
* **解決方案**：執行

  ```powershell
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

### 5. 團隊成員需要安裝什麼？

* **問題**：新成員加入時，需要安裝哪些環境？
* **解決方案**：

  * **最小需求**：

    * Node.js（自行安裝）
    * Firebase CLI（自行安裝）
    * http-server（自行安裝）
  * **其他檔案**：透過 `git pull` 取得即可

```

這樣所有 FAQ 的 **問題 + 答案** 都完整收錄了 ✅  
要不要我幫你把這份 FAQ **單獨存成 `FAQ.md` 檔案**，方便團隊成員快速查看？
```
