# 智慧簽單及派工系統 (Electronic-Approval-System)



✅ **Firebase 環境已就緒** - Auth, Firestore, Storage, Emulator 已設定完成  
✅ **資料流程已驗證** - deliveryNotes 能成功寫入 Firestore  
🚧 **開發進行中** - 4 個核心功能正在實作  
## ✨ 主要特色
- **工時計算**：記錄開始/結束時間，自動計算總工時（支援跨日與小數表示）。
- **記錄完整性**：簽單包含日期、客戶、施工地點、作業狀況、車號、司機、金額、備註、客戶簽章等欄位。
- **離線支援**：行動裝置可離線填寫簽單，網路恢復後自動同步。
- Emulator UI 能看到 Firestore/Auth/Storage 服務  
- 填寫表單送出後，`deliveryNotes` collection 出現新資料  
- 能正常在不同頁面間導航  

---


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
4. 檢查 Emulator UI (`http://127.0.0.1:4450`) → Firestore → `deliveryNotes`  
5. 確認新資料出現且格式正確  

### 整合測試
- **登入測試**：使用 `dev@example.com / test123`  
- **工時測試**：測試同日與跨日時間計算  
- **簽名測試**：Canvas 簽名並確認上傳到 Storage  
- **離線測試**：關閉網路填表 → 開啟網路 → 確認同步  


### 前置條件
- **Node.js 18+** → [下載](https://nodejs.org/)  
- **Firebase CLI** → `npm i -g firebase-tools`  

### 快速啟動（PowerShell）
```powershell
# 1. Clone 專案
git clone https://github.com/Kiwi485/Electronic-Approval-System.git
cd Electronic-Approval-System

# 2. 啟動 Firebase Emulator  
firebase emulators:start
# 🔗 Emulator UI: http://127.0.0.1:4450

# 3. 啟動前端（另開 PowerShell 視窗）
# 推薦：帶旗標以啟用 CORS/GZIP/Brotli 與預設副檔名
npx http-server .\prototype -p 3000 -a 0.0.0.0 -c-1 --cors --gzip --brotli -e html
# 或使用腳本：scripts\start_http_3000.bat
# 🔗 前端: http://localhost:3000/new-delivery.html?emu=1


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

很好 👌 你想要給隊友一個清楚的交代，告訴他們 **現在發生了什麼**、**為什麼會看到 branchLiu**，以及 **他們接下來要怎麼做**。我幫你整理成一份可以直接貼給隊友的訊息（Markdown 格式），方便你放在 README 或群組。

---
## 📝 團隊分支說明

### 📌 發生了什麼

* 我已經把 **branchLiu** 的 PR merge 到 `main`。
* 這代表 **branchLiu 的程式碼已經在 main 裡**，功能不會消失。
* PR merge 後，`branchLiu` 分支已經沒有存在的必要。
* 不過 GitHub 仍然顯示 branchLiu，因為 **遠端分支還沒刪掉**，而且 **大家本地電腦可能還留有 branchLiu**。

---

### ✅ 我做了什麼

* PR merge 完成。
* main 已經是最新版本。
* 準備刪除遠端 `branchLiu` 分支，避免混亂。

---

### 👩‍💻 你們需要做什麼

1. **更新本地 main**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **刪掉本地 branchLiu（如果有的話）**

   ```bash
   git branch -d branchLiu
   ```

   > 如果出錯，可以用 `git branch -D branchLiu` 強制刪除。

3. **之後開發新功能**

   * 不要再用 `branchLiu`。
   * 每個新功能要從最新的 main 開一個新分支：

     ```bash
     git checkout main
     git pull origin main
     git checkout -b feature/your-feature-name
     ```

---

### ⚠️ 注意

* `main` 分支是穩定分支，請不要直接在 `main` 上開發。
* 功能開發 → 新分支 → commit → push → PR → merge → 刪分支。

---

👉 這樣大家都會知道 **為什麼 branchLiu 還在**，以及 **正確的操作方式**。

要不要我幫你做一個 **「Git Flow 圖解」**（流程圖：main → feature branch → PR → merge → 刪分支），給隊友更直覺的視覺版？

非常好 👍
以下是中文版的 **README「退回（Revert）教學段落」模板**，
你可以直接貼到專案的 `README.md` 裡，讓隊友清楚知道：
💡 **什麼情況發生了、為什麼要退、要怎麼操作。**

---

## 🧭 專案回退紀錄（Revert History）

### 🔹 回退分支：`branchAuthentication`

**日期：** 2025/10/05
**回退的 Commit：** `4c161e1`
**對應的 PR 編號：** #13
**原因說明：**
隊友在未經完整審查的情況下，將 `branchAuthentication`（包含 Firebase Email 登入與自動帶入車牌功能）
直接合併（merge）進 `main`。
為了讓專案回到穩定版本，我們執行了 **Revert（撤銷合併）** 操作。

---

## ⚙️ 回退操作步驟（Revert 操作教學）

### 🧩 1️⃣ 切換到 main 分支並更新

```bash
git checkout main
git pull origin main
```

---

### 🧩 2️⃣ 執行 Revert 合併

```bash
git revert -m 1 4c161e1
```

> 💡 `-m 1` 代表保留 main 的內容，只撤銷被合併進來的那個分支 (`branchAuthentication`)。
> Git 會自動開啟編輯視窗，顯示預設訊息：
> `Revert "Merge pull request #13 from Kiwi485/branchAuthentication"`

---

### 🧩 3️⃣ 儲存並離開編輯器（Vim）

在視窗中按：

```
Esc
:wq
```

然後按 Enter。

---

### 🧩 4️⃣ 推送回 GitHub

```bash
git push origin main
```

---

## ✅ 回退完成後結果

* `main` 分支的內容已回到 **合併前的穩定版本**。
* GitHub 上會自動新增一筆紀錄：

  ```
  Revert "Merge pull request #13 from Kiwi485/branchAuthentication"
  ```
* 舊的功能（Firebase 登入、自動帶入車牌）已被完整移除。

---

## 🚫 預防措施

為了避免再發生誤合併，請遵守以下規範：

1. **不得直接 push 到 main。**
   每次修改都必須先開分支（branch）並送出 Pull Request。

2. **建立 main 保護規則（Branch Protection）**

   * 進入 GitHub → `Settings` → `Branches` → `Add rule`
   * 設定保護 `main` 分支，並勾選以下選項：

     * ✅ Require pull request before merging
     * ✅ Require review before merge
     * ✅ Disallow force pushes（禁止強制推送）

---

## 📘 小提醒

如果下次有人誤 merge，也可以照本段步驟執行：

```bash
git revert -m 1 <那次 merge 的 commit ID>
git push origin main
```

---




## 🆕 最新功能更新（2025-10）

### 1. Email / 密碼登入與狀態管理
- 新增登入頁 `login.html`：使用 Firebase Authentication `Email/Password`。
- 保持登入（Remember me）：勾選 → 使用 `browserLocalPersistence`；未勾選 → `browserSessionPersistence`。
- 登出使用 `logout()` 呼叫 Firebase `signOut()`，不再只是跳轉頁面。
- 所有受保護頁面（首頁、歷史、建立簽單、簽章）都需登入後才可瀏覽。

#### 設定步驟
1. Firebase Console → Authentication → Sign-in method → 啟用「Email/Password」。
2. Users → Add user 建立測試帳號（例：`dev@example.com / test123`）。
3. 啟動開發伺服器：
   ```bash
   npx http-server prototype -p 3000
   ```
4. 瀏覽 `http://localhost:3000/login.html` 登入後才會進入首頁。

#### 受保護頁面機制
- 透過 `auth.js` 的 `requireAuth()`：未登入會 redirect → `login.html?r=<原頁>`。
- 為避免「未驗證前內容閃現」，`requireAuth()` 會暫時隱藏整頁 (`html{visibility:hidden;}`) → 驗證後顯示。

#### 共用守門程式碼（auth-guard）
```html
<script type="module" src="js/auth-guard.js"></script>
```
檔案 `js/auth-guard.js` 功能：
- 執行 `requireAuth()`
- 顯示目前使用者 Email
- 綁定登出按鈕 `#logoutBtn`

### 2. 簽章流程外移（簽單建立 → 後補簽章）
原流程：建立簽單當下簽名 → 已移除  
新流程：
1. 在 `new-delivery.html` 建立簽單 → 自動寫入：
   - `signatureStatus: 'pending'`
   - `signatureDataUrl: null`（改採 URL 方案後可為 `signatureUrl`）
2. 簽章頁 `sign-delivery.html`：
   - 左側自動載入「待簽章」清單（`signatureStatus == 'pending'`，優先依 `serverCreatedAt` 排序，有 fallback 查詢）
   - 點一筆 → 右側顯示簽單內容 + 簽名 Canvas
   - 簽名 → 儲存 → `signatureStatus: 'completed'` + `signedAt` + 上傳簽章圖片
   - 可重新簽章（還原為 pending 並刪除舊圖）

### 3. 簽章圖片上傳（Firebase Storage）
- 簽章儲存於 `signatures/<docId>_<timestamp>.png`
- Firestore 文件欄位：
  - `signatureUrl`: Storage 下載 URL
  - `signatureStoragePath`: 檔案路徑（重新簽章時刪除舊檔用）
  - `signedAt`: serverTimestamp()
  - `signatureStatus`: 'pending' | 'completed'

#### Storage 規則（需更新）
```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /signatures/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 2 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    match /{allPaths=**} {
      allow read: if request.auth != null;
    }
  }
}
```

### 4. 表單驗證與自動計算
`form-validation.js` 新增：
- 開始 / 結束時間驗證 + 跨日支援（勾選「跨日」）
- 自動計算總工時（四捨五入至 0.1）
- 金額輸入即時千分位格式化（顯示用 input + 隱藏 raw input）
- 必填欄位：日期 / 客戶 / 地點 / 開始時間 / 結束時間 / 金額
- 選填欄位：機具 / 車號 / 司機姓名 / 備註
- Firestore 寫入前會回傳乾淨 payload（數字金額、工時數值）

### 5. 歷史紀錄頁（`history.html` / `history.js`）
- 顯示簽章狀態徽章：「已簽 / 待簽」
- Modal 詳情加入簽章狀態資訊
- 離線暫存筆數提示與同步事件監聽

### 6. 主要資料欄位（deliveryNotes）
| 欄位 | 型別 | 說明 |
|------|------|------|
| customer | string | 客戶名稱 |
| date | string (YYYY-MM-DD) | 作業日期 |
| location | string | 施工地點 |
| work | string | 作業狀況描述 |
| startTime / endTime | string(HH:mm) | 時間區間 |
| crossDay | boolean | 是否跨日 |
| totalHours | number | 系統計算工時 |
| amount | number | 金額（純數字） |
| machine | string | 機具 |
| vehicleNumber | string | 車號 |
| driverName | string | 司機姓名 |
| remark | string | 備註 |
| signatureStatus | 'pending' | 'completed' |
| signatureUrl | string|null | 簽章圖下載 URL |
| signatureStoragePath | string|null | Storage 路徑 |
| signedAt | timestamp|null | 完成簽章時間 |
| serverCreatedAt | timestamp | 伺服器建立時間 |
| offline | boolean | 是否離線暫存後補上傳 |
| localId | string | 離線暫存用 UUID |

### 7. 使用情境流程（司機視角）
1. 登入 → 進入首頁  
2. 建立簽單 → 狀態為「待簽」  
3. 客戶後補簽：開啟簽章頁 → 點選該筆 → 簽名 → 儲存  
4. 歷史紀錄中顯示「已簽」徽章  

### 8. 常見問題（FAQ）
| 問題 | 原因 | 解法 |
|------|------|------|
| 未登入仍看到內容 | 頁面未引入 `auth-guard.js` | 加 `<script type="module" src="js/auth-guard.js"></script>` |
| 簽章列表永遠載入中 | 查詢需索引或無資料 | 建立 `signatureStatus + serverCreatedAt` 複合索引或確認有 `signatureStatus=pending` |
| 上傳簽章 Forbidden | 未登入 / Storage 規則未更新 | 重新登入 / 套用上方 Storage 規則 |
| 金額不顯示千分位 | 未載入 `form-validation.js` 或使用舊頁 | 確認頁面底部已引入 |
| 簽章後仍顯示 pending | 寫入失敗或 Firestore 延遲 | 重新整理 / 查看 console 錯誤 |

### 9. 建議後續待辦（Backlog）
| 類別 | 項目 | 優先 |
|------|------|------|
| 安全 | Firestore 規則依使用者角色細化 | P0 |
| 體驗 | 待簽章頁搜尋 / 篩選 / 分頁 | P1 |
| 功能 | 忘記密碼 / 註冊流程 | P1 |
| 資料 | 機具清單獨立集合 + 下拉 | P2 |
| 程式碼品質 | 抽離表單欄位設定 → JSON 驅動表單 | P2 |

### 10. 測試清單
- [ ] 未登入直接訪問 `/index.html` → 轉向 `login.html`
- [ ] 正確帳密登入 → 導回原頁
- [ ] 錯誤密碼 → 顯示「密碼錯誤」
- [ ] 建立新簽單 → Firestore `signatureStatus=pending`
- [ ] 簽章 → 產生 `signatureUrl` 並狀態變 completed
- [ ] 重新簽章 → 舊圖刪除（檢查 Storage 路徑）
- [ ] 金額輸入：`12000` → 顯示 `12,000`，Firestore 寫入 `12000`
- [ ] 離線建立再恢復 → 自動同步並出現在歷史列表
- [ ] 登出 → 回 `login.html`，重新訪問受保護頁再被攔截


  

