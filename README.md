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

## 🔄 切換 Mock → Firestore
1. 開啟 `prototype/js/config-flags.js`，將 `window.APP_FLAGS.USE_MOCK_DATA` 改為 `false` 後重新整理頁面。  
2. 確認 Firestore 內已建立以下集合與測試資料：  
   - `machineCategories`

     | 文件 ID | name | isActive | order |
     |---------|------|----------|-------|
     | excavator | 挖土機 | true | 10 |
     | crane | 吊車 | true | 20 |
     | old-machine | 舊機具示例 | false | 90 |

   - `machines`

     | 文件 ID | name | categoryId | isActive |
     |---------|------|------------|----------|
     | m-pc200 | PC200 挖土機 | excavator | true |
     | m-sumito | 住友吊車 S1 | crane | true |
     | m-retire | 報廢示例機 | old-machine | false |

     > 以上欄位請一併填入 `createdAt`、`updatedAt`（Server Timestamp）與 `usageCount`（預設 0），以便驗證簽單與管理頁顯示。
3. `prototype/js/api/index.js` 會依旗標自動切換 Mock 或 Firestore 實作，簽單頁面與管理頁不需修改引用。  
4. 驗證：切換後重新載入「簽單 / 管理」頁面，應能讀到 Firestore 實際資料，且 `listActiveMachines()` 僅回傳 `isActive=true` 的機具。

---

## � 角色授權與 Firestore 規則

- **角色存放位置**：`users/{uid}` 文件中的 `role` 欄位（`manager` 或 `driver`）。
- **前端行為**：
  - 登入後自動載入使用者角色（`js/session-context.js`），並將 `<html data-user-role>` 設為 `manager` 或 `driver`。
  - CSS 會隱藏 `.role-manager-only` 元素，讓司機僅看到「首頁 / 新增簽單 / 歷史 / 簽章」。
  - 新增簽單時自動補上 `createdBy / createdByRole / assignedTo / readableBy`，確保 Firestore 規則可授權離線與線上資料。
- **權限摘要**：
  - `manager`：可讀寫全部 `deliveryNotes`、`users`；可指派/重派司機。
  - `driver`：僅能讀寫 `readableBy` 或 `assignedTo` 含自己、或 `createdBy` 為自己的簽單；不得修改指派陣列。
  - 其他集合預設拒絕。
- **執行自動化規則測試**：
  ```powershell
  npm install
  npm run test:rules
  ```
  測試腳本：`tests/firestore-rules/rules.test.js`（使用 Firebase Emulator + `@firebase/rules-unit-testing`）。
- **手動驗收步驟**：
  1. 啟動 Emulator：`firebase emulators:start`。
  2. 使用 manager 帳號登入 → 可瀏覽所有頁面與簽單。
  3. 使用 driver 帳號登入 → 導覽僅剩首頁/新增/歷史/簽章；嘗試直接開啟 `driver-admin.html` 應無資料；查看 Firestore Console 驗證只讀到自己的簽單。
  4. 於 emulator UI 驗證 `deliveryNotes` 寫入的 `assignedTo/readableBy/createdBy` 欄位。

---

## �📋 當前開發任務（Sprint 1）
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


下面這份「團隊操作指南」你可以直接貼到 README 或傳給隊友，讓大家 5 分鐘內搞懂要做什麼、怎麼做、怎麼不互相踩到。已依你目前情境（已 merge 契約分支、開始實作機具/類別/多選簽單）整理。

---

# 🧭 Sprint 作業指南（多機具 / 多司機 / 啟用停用）

## 🎯 本迭代目標（完成後可 Demo）
1. 後台可維護「機具類別」「機具（含啟用/停用）」  
2. 新增簽單頁可多選機具 & 多選司機（寫入 `machines[]` / `drivers[]`，並保留舊欄位 machine / driverName 過渡）  
3. 停用的機具在新增簽單時不顯示（歷史仍顯示舊資料）  
4. 可在 Mock 與 Firestore 兩種模式切換測試  

---

## 🗂 目錄結構（相關新增區塊）
```
prototype/
  js/
    api/
      machines-api.contract.js
      machines-api.mock.js
      drivers-api.mock.js
      (將新增) machines-api.firestore.js
      (將新增) drivers-api.firestore.js
      (將新增) index.js
    config-flags.js
    category-admin.js        (將新增)
    machine-admin.js         (將新增)
    filter-utils.js          (將新增)
  category-admin.html        (將新增)
  machine-admin.html         (將新增)
  new-delivery.html          (會改：加入多選區)
```

---

## 🔑 穩定資料契約（請勿改名，只能新增欄位）
Machine:
```
{ id, name, categoryId, isActive, usageCount, lastUsedAt }
```
MachineCategory:
```
{ id, name, slug?, isActive, order }
```
DeliveryNote（新增欄位）：
```
machines: [{ machineId, name, categoryId }]
drivers: [{ driverId, name }]
```
過渡保留：machine（單機具時填入 name）、driverName（單司機時填入 name）

---

## 🏁 分工（四人）
| 角色 | 分支建議 | 主要任務 | 依賴 |
|------|----------|----------|------|
| A | `feat/firestore-machines` | Firestore 版本 API + 規則 + 測試資料 | 已有契約 |
| B | `feat/admin-category` → `feat/admin-machine` | 類別管理頁 / 機具管理頁 | 只需契約（初期可 Mock） |
| C | `feat/delivery-multi` | 簽單頁多機具/多司機改造 + 驗證整合 | 契約 |
| D | `feat/integration-filter` | 停用過濾、旗標測試、驗收腳本、文件更新 | 依 B/C |

---

## 🏷 功能旗標（config-flags.js）
```
USE_MOCK_DATA: true | false
ENABLE_MULTI_MACHINE: true
ENABLE_MULTI_DRIVER: true
ENABLE_MACHINE_DEACTIVATE_FILTER: false
```
使用規則：
- 開發前期保持 `USE_MOCK_DATA=true`（除 A 測 Firestore）
- 停用過濾完成才把 `ENABLE_MACHINE_DEACTIVATE_FILTER` 打開
- 不要私自改旗標鍵名稱

---

## 🧪 每個角色起手式

### A（Firestore 實作）
1. 建立 Firestore 集合：`machineCategories`, `machines`  
2. 加資料（至少 1 類別 + 3 機具，含 1 台 isActive=false）  
3. 新增 `machines-api.firestore.js`：
   - `listActiveMachines()` → where isActive=true  
   - `createMachine()` → addDoc + serverTimestamp  
   - `updateMachine()` → updateDoc + updatedAt  
4. 新增 `drivers-api.firestore.js`（暫硬寫 2 司機或從 users 撈）  
5. 寫 `index.js` 切換：
   ```
   const useMock = window.APP_FLAGS?.USE_MOCK_DATA;
   export * from (useMock ? './machines-api.mock.js' : './machines-api.firestore.js');
   ```
6. 規則（初稿）：
   ```
   allow read: if request.auth != null;
   allow create, update: if request.auth != null; // TODO 之後限制 admin
   ```

### B（類別＋機具管理頁）
1. 新增 `category-admin.html` → 表格 + 新增/編輯 Modal  
2. 新增 `machine-admin.html` → 表格 + 新增/編輯 Modal + 啟用/停用按鈕  
3. 呼叫 API（先用 mock）：
   - 類別：`listCategories()`, `createCategory()`, `updateCategory()`  
   - 機具：`listAllMachines()`, `createMachine()`, `updateMachine()`  
4. 停用機具：`updateMachine(id, { isActive: false })`  

### C（簽單頁多選改造）
1. 在 `new-delivery.html` 加兩個區塊（機具、司機）  
2. CSS/排版簡單即可（fieldset + checkbox list）  
3. form-validation.js 新增：
   ```
   function collectSelectedMachines(){...}
   function collectSelectedDrivers(){...}
   ```
4. 在 `buildValidatedPayload()` 塞：
   ```
   machines: collectSelectedMachines()
   drivers: collectSelectedDrivers()
   machine: machines.length===1 ? machines[0].name : ''
   driverName: drivers.length===1 ? drivers[0].name : ''
   ```
5. 不選機具允許提交  
6. `ENABLE_MULTI_*` 為 false 時隱藏新區塊（加簡單判斷）  

### D（整合 + 過濾 + 驗收）
1. 寫 `filter-utils.js`：
   ```
   export function filterActiveMachines(list){
     if(!window.APP_FLAGS?.ENABLE_MACHINE_DEACTIVATE_FILTER) return list;
     return list.filter(m => m.isActive);
   }
   ```
2. 提供驗收腳本（console 執行）：
   ```
   import('./js/api/index.js')
     .then(api => api.listAllMachines().then(all=>{
        console.log('All:', all);
        console.log('After filter:', filterActiveMachines(all));
     }));
   ```
3. 驗收流程文件化（README 新增「驗收清單」）  
4. 確認切換 `USE_MOCK_DATA` 正常  

---

## 🧪 驗收清單（D 主導）
| 項目 | 條件 | 預期 |
|------|------|------|
| 1 | USE_MOCK_DATA=true | 表單/管理頁可載入 mock |
| 2 | USE_MOCK_DATA=false | Firestore 資料載入成功 |
| 3 | 新增類別 | 管理頁出現；機具表單下拉更新 |
| 4 | 新增機具 | 出現在簽單頁（啟用） |
| 5 | 停用機具 | 簽單頁（filter 開）不顯示 |
| 6 | 簽單選 2 機具 2 司機 | Firestore 內 `machines.length=2` `drivers.length=2` |
| 7 | 只選 1 機具 1 司機 | 有舊欄位 machine / driverName |
| 8 | 不選機具 | `machines=[]` 仍提交成功 |
| 9 | 切 flag (filter off) | 停用機具再度出現 |
| 10 | Console | 無未捕捉錯誤 |

---

## 🧱 修改規則（所有人要遵守）
| 類別 | 規則 | 範例 |
|------|------|------|
| 檔案變更 | 只在自己模組新增，不大改別人檔案 | form-validation 只加區塊註解 |
| 欄位 | 不改既有欄位名稱 | 不把 machine 改成 machinesName |
| 新功能 | 用旗標包起來 | if(!APP_FLAGS.ENABLE_MULTI_MACHINE) hide |
| Firestore 呼叫 | 透過 API 模組，不散落 query | import { listActiveMachines } from './js/api/index.js' |
| console | 不留除錯 log | 移除 console.log('test') |

---

## 🪛 常見錯誤對應
| 症狀 | 可能原因 | 解法 |
|------|----------|------|
| listActiveMachines 空 | Firestore 無資料 / 規則拒絕 | Console 看 error；用 mock 測 |
| Payload 缺 machines | 忘了呼叫 collectSelectedMachines | 檢查 buildValidatedPayload |
| 停用後仍顯示 | 旗標未開 / 未用 filter | 檢查 ENABLE_MACHINE_DEACTIVATE_FILTER |
| drivers 陣列空 | 未勾選、未載入 mock | 確認載入 drivers mock |
| 切 USE_MOCK_DATA=false 爆錯 | index.js 未匯出實作 | 檢查 export * from ... |

---

## 🤝 每日同步格式（群組貼）
```
(完成) 機具新增/停用 API 接好
(進行) 編輯 Modal
(阻礙) 需要 categories 回傳 order 欄位
```

---

## 🧪 本地快速測試指令（DevTools Console）
載入全部機具：
```
import('./js/api/index.js').then(m => m.listAllMachines().then(console.log))
```
切換為 Firestore（修改 flags 後重新整理）：
```
window.APP_FLAGS.USE_MOCK_DATA = false
```

---

## 📝 PR Template 推薦
```
### 內容
- 新增：machine-admin.html
- 新增：machine-admin.js
- 使用 API：listAllMachines / createMachine / updateMachine

### 測試
- [ ] mock 模式 ok
- [ ] firestore 模式 ok
- [ ] 啟用/停用後列表刷新
- [ ] 無 console.error

### 截圖
(貼上)

### 待辦(後續)
- 欄位排序
```

---

## 🧯 緊急回復（出錯時）
| 問題 | 回復步驟 |
|------|----------|
| Firestore 規則擋住全部 | 回滾到上個規則 commit / emulator 測試 | 
| 欄位填錯導致前端壞 | Firestore console 手動補欄位 / 用遷移腳本 |

---

## 🧾 後續（下個迭代可做）
- 司機指派（machineAssignments）  
- usageCount 自動遞增（Cloud Function）  
- 角色權限（Custom Claims）  
- 歷史查詢篩選（依機具 / 司機 / 狀態）  

---

## 📌 TL;DR（1 行給趕時間的人）
大家各自開分支 → 用 API 模組 → 不改欄位名稱 → 多機具/司機寫入陣列但保留舊欄位 → 停用過濾用旗標控制。

---



---

# ✅ Firestore 與 Mock 全面驗收測試指引

> 本指南為「從零到驗收」的完整測試流程。
> 依照順序執行可驗證 machines / drivers Firestore + Mock 切換、
> `updatedAt` 更新、啟用/停用篩選、多機具、多司機、離線同步與權限控制。

---

## 🧩 0. 前置快速檢查 (30 秒)

```javascript
import('./js/api/index.js').then(api => console.log('API_SOURCE=', api.getApiSource?.() || api.API_SOURCE));
```

**預期：**
`firestore`
（若顯示 mock → 檢查以下三項）

* `config-flags.js` 是否先載入
* `USE_MOCK_DATA=false`
* 強制重新整理 (`Ctrl + Shift + R`)

---

## ⚙️ 1. 啟動環境

在 PowerShell（專案根目錄）執行：

```powershell
firebase emulators:start
```

另開新視窗（同樣根目錄）：

```powershell
npx http-server .\prototype -p 3000
```

**確認：**

* 前端：[http://127.0.0.1:3000/new-delivery.html](http://127.0.0.1:3000/new-delivery.html) 可開啟
* Emulator UI：[http://localhost:4000](http://localhost:4000) 有資料樹
* Console 出現：`✅ Connected to Firebase Emulators`

---

## 🌱 2. 種入測試資料 (自動種子)

在瀏覽器 Console（例如 `index.html` 或 `new-delivery.html`）執行：

```javascript
// 推薦開發時用 cache-bust 以確保載入最新模組，並可加上 force 驗證覆蓋行為
import(`/js/dev-seed.js?t=${Date.now()}`)
  .then(m => m.seedAll({ force: true }))
  .then(res => console.log('[Seed result]', res));
```

預期 Console：

```
[Seed] seedAll start { force: true, seedData: { ... } }
[Seed] queue set users/u-manager uid= u-manager
[Seed] queue set users/u-wang uid= u-wang
[Seed] queue set users/u-lee uid= u-lee
[Seed] queue set users/u-retire uid= u-retire
[Seed] 完成： { categories:3, machines:3, drivers:3, managers:1, force: true }
```

驗證（在同一頁面或 emulator UI）：

```javascript
// 檢查 Firestore users collection 是否包含 manager 與 drivers（包含 email 欄位）
db.collection('users').get().then(snap => console.table(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

// 或使用 API helper 檢視 categories/machines/drivers
import('./js/api/index.js').then(api => {
  api.listCategories().then(console.table);
  api.listAllMachines().then(console.table);
  api.listAllDrivers().then(console.table);
  api.listAllManagers().then(console.table);
});
```

預期結果：
- 3 筆類別、3 台機具（含 1 停用）、3 位司機
- `users` collection 包含 `u-manager`（role: "manager"）及 `u-wang`、`u-lee`、`u-retire`（role: "driver"），driver 文件包含 `email` 欄位

備註：
- Seeder 只會建立/更新 Firestore 文件（`users/{uid}`），不會自動建立 Firebase Authentication 帳號；如需讓測試帳號能登入，請在 Firebase Console → Authentication 建立對應的測試使用者（相同 email），或使用 `firebase-admin` 的腳本建立 Auth 帳號。
- 若要在開發期間避免每次使用 timestamp，請在 DevTools → Network 勾選「Disable cache」並重新整理頁面。

---

## 🔀 3. Firestore / Mock 切換測試

```javascript
// 查看目前來源
import('./js/api/index.js').then(api => console.log('SOURCE=', api.getApiSource()));

// 切換到 Mock
window.APP_FLAGS.USE_MOCK_DATA = true;
import('./js/api/index.js').then(api => api.listAllMachines().then(m => console.log('After switch SOURCE=', api.getApiSource(), 'Count=', m.length)));

// 切回 Firestore
window.APP_FLAGS.USE_MOCK_DATA = false;
import('./js/api/index.js').then(api => console.log('Back SOURCE=', api.getApiSource()));
```

若筆數或資料內容不同 → 切換成功。
（測完建議重新整理恢復預設）

---

## 🧮 4. listActiveMachines() / 停用過濾

```javascript
import('./js/api/index.js').then(api => {
  api.listAllMachines().then(all => console.table(all));
  api.listActiveMachines().then(active => console.table(active));
});
```

**預期：**
`listActiveMachines()` 不包含 `isActive=false` 的機具。
（若啟用 `ENABLE_MACHINE_DEACTIVATE_FILTER` → UI 也會隱藏）

---

## ⚙️ 5. 建立機具 + 驗證 createdAt / updatedAt

```javascript
import('./js/api/index.js').then(api =>
  api.createMachine({ name:'測試新增機具 X', categoryId:null }).then(doc => {
    console.log('Created Machine:', doc);
    window.__TEST_MACHINE_ID = doc.id;
  })
);
```

**預期：**
回傳物件含：

* `id`
* `isActive:true`
* `createdAt`
* `updatedAt`

Emulator UI 中應可看到該文件與時間戳記。

---

## 🔧 6. 更新機具 + 驗證 updatedAt

```javascript
import('./js/api/index.js').then(api =>
  api.updateMachine(window.__TEST_MACHINE_ID, { isActive:false }).then(doc => {
    console.log('Updated Machine:', doc);
  })
);
```

**驗證：**

* `isActive=false`
* `updatedAt` > `createdAt`
* active 列表不含此 ID

---

## 🗂️ 7. 類別 CRUD 測試

```javascript
import('./js/api/index.js').then(api =>
  api.createCategory({ name:'臨時測試類別', order:30 }).then(c => {
    console.log('Created Category:', c);
    window.__TEST_CAT_ID = c.id;
  })
);
```

更新類別：

```javascript
import('./js/api/index.js').then(api =>
  api.updateCategory(window.__TEST_CAT_ID, { name:'臨時測試類別-改', order:35 }).then(console.log)
);
```

列出：

```javascript
import('./js/api/index.js').then(api => api.listCategories().then(console.table));
```

---

## 🚗 8. 司機 (Drivers) 測試

```javascript
import('./js/api/index.js').then(api => api.listAllDrivers().then(console.table));
import('./js/api/index.js').then(api => api.listActiveDrivers().then(console.table));
```

若支援更新：

```javascript
import('./js/api/index.js').then(api =>
  api.updateDriver && api.updateDriver('<driver id>', { isActive:false }).then(console.log)
);
```

---

## 🧾 9. 簽單建立（多機具 / 多司機）

1. 開啟 `new-delivery.html`
2. 填寫客戶、地點、金額等必填欄位
3. 勾選 ≥2 台啟用機具、≥2 位司機
4. 提交後 Firestore `deliveryNotes` 應包含：

   * `machines[]`、`drivers[]`
   * 若僅 1 筆 → 仍保留 `machine`、`driverName`
   * `signatureStatus: "pending"`
   * `serverCreatedAt` (Timestamp)

---

## ⚙️ 10. 停用機具對 UI 影響

```javascript
import('./js/api/index.js').then(api =>
  api.listActiveMachines().then(list => api.updateMachine(list[0].id, { isActive:false }))
);
```

打開 `config-flags.js` 或在 Console：

```javascript
window.APP_FLAGS.ENABLE_MACHINE_DEACTIVATE_FILTER = true;
```

重新載入頁面 → 該台機具應消失。
改回 `false` → 應重新出現。

---

## 🔌 11. 離線同步測試

1. DevTools → Network → Offline
2. 建立一筆簽單 → Console 顯示暫存訊息
3. 查看暫存：

   ```javascript
   offlineManager.getOfflineData()
   ```
4. 恢復網路 → 出現 `[Offline] 開始同步` → Firestore 新增該筆資料
5. 確認暫存清空：

   ```javascript
   offlineManager.getOfflineData()
   ```

---

## 🔐 12. 權限測試 (未登入阻擋)

登出：

```javascript
import('./js/auth.js').then(m => m.logout && m.logout());
```

嘗試建立資料：

```javascript
import('./js/api/index.js').then(api =>
  api.createMachine({ name:'不應成功', categoryId:null }).catch(console.error)
);
```

**預期：** `permission denied`（若規則尚未加嚴，請加上 TODO）

---



## 🧩 13. 常見錯誤排查

| 症狀                    | 解法                                      |
| --------------------- | --------------------------------------- |
| Firestore 不更新         | 檢查 `api.getApiSource()` 是否仍為 mock       |
| `updatedAt` 沒變        | Emulator UI 未刷新，或更新失敗                   |
| createMachine 被拒      | 未登入或 Firestore 規則限制                     |
| listActiveMachines 為空 | 無 isActive=true 文件或種子未執行                |
| 離線不同步                 | 手動呼叫 `offlineManager.syncOfflineData()` |
| drivers 為空            | Firestore 未 seed 或仍在 mock 模式            |

---

## ⚡ 14. 快速指令合集

```javascript
// 顯示來源
import('./js/api/index.js').then(api => console.log(api.getApiSource()));

// 種子 (若已存在不覆蓋)
import('./js/dev-seed.js').then(m => m.seedAll());

// 建立 + 更新機具
import('./js/api/index.js').then(api =>
  api.createMachine({ name:'Temp 機具', categoryId:null })
  .then(r => api.updateMachine(r.id,{ isActive:false }))
);

// 啟用機具列表
import('./js/api/index.js').then(api => api.listActiveMachines().then(console.table));

// 類別與司機
import('./js/api/index.js').then(api => { api.listCategories().then(console.table); api.listAllDrivers().then(console.table); });

// 離線同步手動觸發
offlineManager.syncOfflineData();

// 切換 Mock
window.APP_FLAGS.USE_MOCK_DATA = true;
```

---

## 🧪 15. 自動化冒煙測試腳本

```javascript
(async () => {
  const api = await import('./js/api/index.js');
  console.log('SOURCE=', api.getApiSource());
  const catBefore = await api.listCategories();
  console.log('Categories count=', catBefore.length);
  const m = await api.createMachine({ name:'SmokeTest M', categoryId:null });
  console.log('Created machine id=', m.id, 'active=', m.isActive, 'createdAt=', m.createdAt);
  const mu = await api.updateMachine(m.id, { isActive:false });
  console.log('Updated active should be false =>', mu.isActive);
  const activeList = await api.listActiveMachines();
  if (activeList.find(x => x.id === m.id)) console.warn('❌ 停用機具仍出現在 active 列表');
  else console.log('✅ 停用過濾正常');
})();
```

---

## 🆕 簽單頁多機具 / 多司機（Issue #4）

此功能讓新簽單支援同時選擇多個機具與多位司機，同時保持舊欄位用法不變（相容）。預設由 Feature Flags 控制，關閉時頁面不顯示新區塊、行為完全不變。

### 功能旗標（`prototype/js/config-flags.js`）
- `USE_MOCK_DATA: boolean` → 切換 Mock / Firestore 資料來源
- `ENABLE_MULTI_MACHINE: boolean` → 顯示「機具多選」區塊並輸出 `machines[]`
- `ENABLE_MULTI_DRIVER: boolean` → 顯示「司機多選」區塊並輸出 `drivers[]`
- `ENABLE_MACHINE_DEACTIVATE_FILTER: boolean` → 啟用時，建立簽單頁只顯示 `isActive !== false` 的機具

> 建議：開發/自動化驗收時開啟三個旗標，便於測試；切換到 Firestore 時請確認有實際資料。

### UI 與檔案
- `prototype/new-delivery.html`
  - 當旗標開啟時顯示兩個新區塊：
    - 選擇機具（可多選）：資料來源 `listActiveMachines()`（或 `listAllMachines()` 視旗標而定）
    - 選擇司機（可多選）：資料來源 `listActiveDrivers()`
  - 旗標關閉時，新區塊不顯示，頁面維持既有欄位（`machine`、`driverName`）

### 表單收集與 Payload（`prototype/js/form-validation.js`）
- 新增：
  - `collectSelectedMachines()` → 回傳 `[{ id, name }]`
  - `collectSelectedDrivers()` → 回傳 `[{ id, name }]`
- 在 `buildValidatedPayload()` 中：
  - 旗標開啟時：
    - 會加入 `machines: []` 與/或 `drivers: []` 欄位（可為空陣列）
    - 單一選擇時，若舊欄位為空，會自動將 `machine = machines[0].name`、`driverName = drivers[0].name`
    - 多於 1 項選擇時，為避免誤導，舊欄位 `machine`/`driverName` 會保留空字串
  - 旗標關閉時：不輸出陣列欄位，行為與 UI 完全維持原樣

範例 Payload：

單一選擇（1 機具 + 1 司機）：
```json
{
  "customer":"台北營造公司",
  "date":"2025-10-10",
  "location":"內湖",
  "work":"...",
  "startTime":"09:00",
  "endTime":"12:00",
  "totalHours":3,
  "amount":12000,
  "machine":"挖土機",
  "driverName":"王小明",
  "machines":[{"id":"m1","name":"挖土機"}],
  "drivers":[{"id":"d1","name":"王小明"}],
  "signatureStatus":"pending"
}
```

多選（≥2 機具 + ≥2 司機）：
```json
{
  "customer":"台北營造公司",
  "date":"2025-10-10",
  "location":"內湖",
  "work":"...",
  "startTime":"09:00",
  "endTime":"12:00",
  "totalHours":3,
  "amount":12000,
  "machine":"",
  "driverName":"",
  "machines":[{"id":"m1","name":"挖土機"},{"id":"m2","name":"吊車"}],
  "drivers":[{"id":"d1","name":"王小明"},{"id":"d2","name":"李小華"}],
  "signatureStatus":"pending"
}
```

### 簽章頁顯示（`prototype/js/sign-delivery.js`）
- 顯示邏輯：
  - 若文件含 `machines[]` / `drivers[]`，將 `name`/`displayName` 以「、」串接顯示
  - 否則回退顯示舊欄位 `machine` / `driverName`
  - 例：`機具：挖土機、吊車`；`司機：王小明、李小華`

### 過濾策略
- 旗標 `ENABLE_MACHINE_DEACTIVATE_FILTER=true` 時：
  - 建立簽單頁載入機具改用 `listActiveMachines()`（僅 `isActive !== false`）
- 旗標關閉時：
  - 建立簽單頁載入機具改用 `listAllMachines()`（全部顯示）

### 離線相容
- `offline_delivery_notes` 會完整保存 payload（包含 `machines[]`、`drivers[]`）
- 回線自動同步流程不受影響；簽章後 PNG 亦會自動上傳到 Storage 並更新文件 URL

### 驗收清單（對照需求圖）
- [x] UI 新增兩個區塊（機具/司機，多選）
- [x] 收集函式 `collectSelectedMachines()`/`collectSelectedDrivers()`
- [x] Payload 加入 `machines[]`/`drivers[]`；單一選擇自動寫回舊欄位；多選時舊欄位留空
- [x] 機具列表過濾 `isActive=false`（旗標控制）
- [x] 資料來源可切 Mock / Firestore（不改使用方式）
- [x] 離線模式可暫存與回線同步
- [x] 簽章頁可顯示多機具/多司機名稱（以「、」串接）
- [x] `ENABLE_MULTI_MACHINE=false` 時，頁面仍可正常（隱藏新區塊、行為一致）
- [x] Console 無未捕捉的錯誤（僅保留必要提示）

---



---


## 🧩 使用 VS Code + Copilot 解決 Merge Conflict 指南

在團隊開發中，如果 main 分支已更新，而你在自己的分支也有修改，  
當你進行 `git pull`、`git merge` 或 `git rebase` 時，可能會出現 **merge conflict（合併衝突）**。

以下是標準解法與建議流程 👇

---

### ⚙️ 一、更新並切回自己的分支
```bash
# 1️⃣ 更新 main 分支
git checkout main
git pull origin main

# 2️⃣ 回到自己的分支
git checkout feature/your-branch-name

# 3️⃣ 把最新 main 合併進來
git rebase main        #（推薦，歷史乾淨）
# 或者：
git merge main         #（操作簡單）
````

---

### 💥 二、發生 Conflict 時會看到

在 VS Code 裡會自動顯示類似：

```text
<<<<<<< HEAD
// 你目前分支的內容
=======
// main 分支的內容
>>>>>>> main
```

同時上方會出現工具列按鈕：

* `Accept Current Change`（保留你自己的）
* `Accept Incoming Change`（保留 main 的）
* `Accept Both Changes`（保留兩邊）
* `Compare Changes`（對比查看）

---

### 🤖 三、使用 Copilot 協助整合

> **需要安裝 VS Code Insiders + GitHub Copilot Chat 插件**

1️⃣ 開啟衝突檔案
2️⃣ 打開 Copilot Chat 視窗（快捷鍵：`Ctrl + I` 或 `Ctrl + /`）
3️⃣ 輸入提示（中英文都可以）：

```
Explain this merge conflict and suggest a merged version that keeps both changes.
```

或

```
幫我整合這段衝突，保留新 main 的修改但不要刪掉我原本的功能。
```

4️⃣ Copilot 會生成建議合併結果，你可以：

* 點 **Apply Suggestion** 套用
* 或手動複製貼上覆蓋衝突區塊

---

### 🧪 四、確認與繼續

修完衝突後執行：

```bash
git add .
git rebase --continue    # 若你是 rebase
# 或
git commit               # 若你是 merge
```

最後重新測試：

```bash
npm run dev
```

確定功能正常後推回遠端：

```bash
git push origin feature/your-branch-name --force
```

---

### 💡 五、Tips

| 狀況           | 建議                           |
| ------------ | ---------------------------- |
| 衝突只是註解或空格    | 直接用「Accept Both Changes」     |
| 同一函式邏輯不同     | 用 Copilot 幫你合併後，再自己檢查邏輯      |
| rebase 太亂、搞錯 | 可用 `git rebase --abort` 回復原狀 |
| 不想改歷史        | 改用 `git merge main` 即可       |

---

### ✅ 總結

> 每次 main 更新後，記得先拉最新版本、rebase 一次、
> 用 Copilot 幫忙整合衝突，
> 測試沒問題再 push，這樣團隊協作會最順。

---

我會給你一份可直接複製給隊友的「How to use（怎麼使用）」指南（Markdown），包含一步步命令、驗證與常見故障排除，讓隊友能在本機 Emulator 上啟動並執行 seeder 建立 Auth 與 Firestore `users`。下面先列出主要步驟，接著是完整可貼上的內容。

主要步驟（簡短）
- 啟動 Firebase Emulator（使用 repo 預設 project `electronic-approval-dev`）
- 在新的 PowerShell 視窗設定環境變數並執行 admin seeder
- 用 list-users.js 驗證 Auth 使用者
- 在 Emulator UI 檢查 Auth 與 Firestore
- 常見問題與解法

--- 以下為可直接複製給隊友的 Markdown 指南 ---

## 本機 Emulator 使用指南（給隊友）

說明：這份指南示範如何在本機 Firebase Emulator 上使用 repo 預設 project（`electronic-approval-dev`），並執行 admin seeder 建立 Authentication 帳號與對應的 Firestore `users/{uid}` 文件。

### 先備條件
- 安裝 Firebase CLI（支援 emulators）
- Node.js 可執行 `node`
- 在專案根目錄（含 .firebaserc 與 firebase.json）

參考檔案：
- dev-seed-users.js（admin seeder：會 建立 Auth 帳號並寫入 Firestore users）
- list-users.js（檢視 emulator Auth 使用者的 helper）
- dev-seed.js（前端 seeder，可用於 browser console）

---

### 1) 啟動 Emulator（使用 repo 預設 project）
在專案根目錄，執行（PowerShell）：
```powershell
firebase emulators:start 

若 emulator 已在執行，請先在該 terminal 按 Ctrl+C 停止，再以上述指令重啟。

---

### 2) 在新的 PowerShell 視窗設定環境變數並執行 seeder
在新的 PowerShell 視窗設定 env 並執行 seeder（`--force` 可覆寫既有角色）：
```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
$env:GCLOUD_PROJECT="electronic-approval-dev"
npm install firebase-admin
node .\prototype\js\tools\dev-seed-users.js --force
```
檢查 seeder 輸出，確認有列出 `[Env] GCLOUD_PROJECT: electronic-approval-dev` 與每位使用者的建立/略過訊息。

---

### 3) 驗證 Auth 使用者（CLI）
Seeder 完成後，使用同一個環境執行：
```powershell
node .\list-users.js
```
輸出會列出 emulator 裡的 Auth 使用者（uid、email、customClaims 等）。若有結果代表 seeder 成功建立帳號。

---

### 4) 在 Emulator UI 檢查
打開並刷新 Emulator UI：
- URL: http://127.0.0.1:4000

檢查項目：
- Auth -> 使用者清單：應看到 seeder 建立的帳號
- Firestore -> users collection：檢查 `users/{uid}` 是否存在，並包含 `role`, `email`, `displayName` 等欄位

若 UI 沒顯示但 list-users.js 有內容，請在瀏覽器做硬性重新整理（Ctrl+F5）。

---

### 常見故障與解法
- UI 顯示的 project 名稱不是 `electronic-approval-dev`：
  - 停止 emulator 並以 `-P electronic-approval-dev` 重新啟動。
- Seeder 日誌顯示不同的 `GCLOUD_PROJECT`：
  - 檢查執行 seeder 的 PowerShell 是否有正確設定 `$env:GCLOUD_PROJECT="electronic-approval-dev"`。
- list-users.js 沒列出使用者：
  - 確認 `FIREBASE_AUTH_EMULATOR_HOST` 與 `FIRESTORE_EMULATOR_HOST` 指向 `localhost:9099` 與 `localhost:8080`。
- 要覆寫已存在的角色或資料：
  - 用 `--force` 參數重新執行 seeder，或手動在 seeder 中調整合併/覆寫邏輯。
- 若想把 repo 預設 project alias 改成別名（例如 `iew`）：
```powershell
firebase use --add electronic-approval-dev
# 互動式時輸入 alias，例如：iew
```

---

### 一句話快速檢查表（給隊友）
1. 啟動 emulator：`firebase emulators:start -P electronic-approval-dev --only auth,firestore`  
2. 在新視窗設定 env 並執行 seeder：設定 three env（Auth/Firestore/GCLOUD_PROJECT）→ `node dev-seed-users.js --force`  
3. 驗證：`node list-users.js` → 打開 http://127.0.0.1:4000 檢查 Auth / Firestore

---







---


## 🧩 使用 VS Code + Copilot 解決 Merge Conflict 指南

在團隊開發中，如果 main 分支已更新，而你在自己的分支也有修改，  
當你進行 `git pull`、`git merge` 或 `git rebase` 時，可能會出現 **merge conflict（合併衝突）**。

以下是標準解法與建議流程 👇

---

### ⚙️ 一、更新並切回自己的分支
```bash
# 1️⃣ 更新 main 分支
git checkout main
git pull origin main

# 2️⃣ 回到自己的分支
git checkout feature/your-branch-name

# 3️⃣ 把最新 main 合併進來
git rebase main        #（推薦，歷史乾淨）
# 或者：
git merge main         #（操作簡單）
````

---

### 💥 二、發生 Conflict 時會看到

在 VS Code 裡會自動顯示類似：

```text
<<<<<<< HEAD
// 你目前分支的內容
=======
// main 分支的內容
>>>>>>> main
```

同時上方會出現工具列按鈕：

* `Accept Current Change`（保留你自己的）
* `Accept Incoming Change`（保留 main 的）
* `Accept Both Changes`（保留兩邊）
* `Compare Changes`（對比查看）

---

### 🤖 三、使用 Copilot 協助整合

> **需要安裝 VS Code Insiders + GitHub Copilot Chat 插件**

1️⃣ 開啟衝突檔案
2️⃣ 打開 Copilot Chat 視窗（快捷鍵：`Ctrl + I` 或 `Ctrl + /`）
3️⃣ 輸入提示（中英文都可以）：

```
Explain this merge conflict and suggest a merged version that keeps both changes.
```

或

```
幫我整合這段衝突，保留新 main 的修改但不要刪掉我原本的功能。
```

4️⃣ Copilot 會生成建議合併結果，你可以：

* 點 **Apply Suggestion** 套用
* 或手動複製貼上覆蓋衝突區塊

---

### 🧪 四、確認與繼續

修完衝突後執行：

```bash
git add .
git rebase --continue    # 若你是 rebase
# 或
git commit               # 若你是 merge
```

最後重新測試：

```bash
npm run dev
```

確定功能正常後推回遠端：

```bash
git push origin feature/your-branch-name --force
```

---

### 💡 五、Tips

| 狀況           | 建議                           |
| ------------ | ---------------------------- |
| 衝突只是註解或空格    | 直接用「Accept Both Changes」     |
| 同一函式邏輯不同     | 用 Copilot 幫你合併後，再自己檢查邏輯      |
| rebase 太亂、搞錯 | 可用 `git rebase --abort` 回復原狀 |
| 不想改歷史        | 改用 `git merge main` 即可       |

---

### ✅ 總結

> 每次 main 更新後，記得先拉最新版本、rebase 一次、
> 用 Copilot 幫忙整合衝突，
> 測試沒問題再 push，這樣團隊協作會最順。

---

我會給你一份可直接複製給隊友的「How to use（怎麼使用）」指南（Markdown），包含一步步命令、驗證與常見故障排除，讓隊友能在本機 Emulator 上啟動並執行 seeder 建立 Auth 與 Firestore `users`。下面先列出主要步驟，接著是完整可貼上的內容。

主要步驟（簡短）
- 啟動 Firebase Emulator（使用 repo 預設 project `electronic-approval-dev`）
- 在新的 PowerShell 視窗設定環境變數並執行 admin seeder
- 用 list-users.js 驗證 Auth 使用者
- 在 Emulator UI 檢查 Auth 與 Firestore
- 常見問題與解法

--- 以下為可直接複製給隊友的 Markdown 指南 ---

## 本機 Emulator 使用指南（給隊友）

說明：這份指南示範如何在本機 Firebase Emulator 上使用 repo 預設 project（`electronic-approval-dev`），並執行 admin seeder 建立 Authentication 帳號與對應的 Firestore `users/{uid}` 文件。

### 先備條件
- 安裝 Firebase CLI（支援 emulators）
- Node.js 可執行 `node`
- 在專案根目錄（含 .firebaserc 與 firebase.json）

參考檔案：
- dev-seed-users.js（admin seeder：會 建立 Auth 帳號並寫入 Firestore users）
- list-users.js（檢視 emulator Auth 使用者的 helper）
- dev-seed.js（前端 seeder，可用於 browser console）

---

### 1) 啟動 Emulator（使用 repo 預設 project）
在專案根目錄，執行（PowerShell）：
```powershell
firebase emulators:start 

若 emulator 已在執行，請先在該 terminal 按 Ctrl+C 停止，再以上述指令重啟。

---

### 2) 在新的 PowerShell 視窗設定環境變數並執行 seeder
在新的 PowerShell 視窗設定 env 並執行 seeder（`--force` 可覆寫既有角色）：
```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
$env:GCLOUD_PROJECT="electronic-approval-dev"
npm install firebase-admin
node .\prototype\js\tools\dev-seed-users.js --force
```
檢查 seeder 輸出，確認有列出 `[Env] GCLOUD_PROJECT: electronic-approval-dev` 與每位使用者的建立/略過訊息。

---

### 3) 驗證 Auth 使用者（CLI）
Seeder 完成後，使用同一個環境執行：
```powershell
node .\list-users.js
```
輸出會列出 emulator 裡的 Auth 使用者（uid、email、customClaims 等）。若有結果代表 seeder 成功建立帳號。

---

### 4) 在 Emulator UI 檢查
打開並刷新 Emulator UI：
- URL: http://127.0.0.1:4000

檢查項目：
- Auth -> 使用者清單：應看到 seeder 建立的帳號
- Firestore -> users collection：檢查 `users/{uid}` 是否存在，並包含 `role`, `email`, `displayName` 等欄位

若 UI 沒顯示但 list-users.js 有內容，請在瀏覽器做硬性重新整理（Ctrl+F5）。

---

### 常見故障與解法
- UI 顯示的 project 名稱不是 `electronic-approval-dev`：
  - 停止 emulator 並以 `-P electronic-approval-dev` 重新啟動。
- Seeder 日誌顯示不同的 `GCLOUD_PROJECT`：
  - 檢查執行 seeder 的 PowerShell 是否有正確設定 `$env:GCLOUD_PROJECT="electronic-approval-dev"`。
- list-users.js 沒列出使用者：
  - 確認 `FIREBASE_AUTH_EMULATOR_HOST` 與 `FIRESTORE_EMULATOR_HOST` 指向 `localhost:9099` 與 `localhost:8080`。
- 要覆寫已存在的角色或資料：
  - 用 `--force` 參數重新執行 seeder，或手動在 seeder 中調整合併/覆寫邏輯。
- 若想把 repo 預設 project alias 改成別名（例如 `iew`）：
```powershell
firebase use --add electronic-approval-dev
# 互動式時輸入 alias，例如：iew
```

---

### 一句話快速檢查表（給隊友）
1. 啟動 emulator：`firebase emulators:start -P electronic-approval-dev --only auth,firestore`  
2. 在新視窗設定 env 並執行 seeder：設定 three env（Auth/Firestore/GCLOUD_PROJECT）→ `node dev-seed-users.js --force`  
3. 驗證：`node list-users.js` → 打開 http://127.0.0.1:4000 檢查 Auth / Firestore

---

## 版本與環境需求 10/28更新日誌

- Node.js：20.x（建議 20.17.0）
- Firebase CLI：v14.x（與 Node 20 相容）
- Functions 執行環境：package.json 內 `engines.node=20`
- 套件
  - 根目錄：已存在 `firebase-admin` 用於工具腳本
  - functions：`firebase-functions@^4.9.0`、`firebase-admin@^12.7.0`

## 同仁更新指南（Windows PowerShell）

1) 拉最新程式碼
```powershell
cd "c:\path\to\your\workspace"
git fetch
git checkout test2
git pull
```

2) 切換 Node 版本

 ⚙️ 二、安裝與設定流程
- 未安裝:
1. 前往官方頁面：  
   🔗 [https://github.com/coreybutler/nvm-windows/releases/latest](https://github.com/coreybutler/nvm-windows/releases/latest)
2. 下載並執行 `nvm-setup.exe`
   - NVM 安裝路徑：`C:\nvm`  
   - Node.js symlink 路徑：`C:\Program Files\nodejs`
3. 完成後關閉 PowerShell → 重新開啟 → 驗證：
   ```bash
   nvm version
- 若已安裝 nvm-windows：
```powershell
nvm install 20.17.0
nvm use 20.17.0
node -v
firebase --version
```
- 期望：node v20.x，firebase CLI v14.x

3) 安裝相依套件
- functions 目錄（雲端 函式）
```powershell
cd "c:\Users\kiwib\OneDrive\桌面\簽單系統\functions"
npm install
```
- 根目錄（工具腳本會用到）
```powershell
cd "c:\Users\kiwib\OneDrive\桌面\簽單系統"
npm install
```

4) 啟動 Firebase Emulators（Functions/Firestore/Auth/Storage）
```powershell
cd "c:\Users\kiwib\OneDrive\桌面\簽單系統"
firebase emulators:start --only functions,firestore,auth,storage
```
- 開啟 Emulator UI：http://localhost:4000
- Functions 面板應看到：
  - createDriverAccount
  - updateDriverAccount
  - deleteDriverAccount

5) 啟動前端（避免快取）
```powershell
cd "c:\Users\kiwib\OneDrive\桌面\簽單系統\prototype"
npx http-server -p 3000 -c-1
```
- 登入頁：http://localhost:3000/login.html?emu=1
- 管理頁：http://localhost:3000/driver-admin.html?emu=1
- 新增簽單：http://localhost:3000/new-delivery.html?emu=1

6) 匯入測試帳號（可選，若還沒有 manager）
```powershell
cd "c:\Users\kiwib\OneDrive\桌面\簽單系統"
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099"
$env:GCLOUD_PROJECT = "electronic-approval-dev"
node .\prototype\js\tools\dev-seed-users.js --force
```
- 預設會建立 `manager@example.test / Test1234!` 並賦予 `role=manager`

## 驗證場景（端到端）

- 新增司機
  - 以管理者登入 `login.html?emu=1`
  - 到 `driver-admin.html?emu=1` 點「新增司機」
  - 輸入姓名與 Email（Email 必填）
  - 成功後會顯示「初始密碼」；Auth Emulator 出現新使用者；Firestore `users/{uid}` 有文件
  - 用新司機在登入頁用初始密碼登入，應可進入

- 停用司機
  - 在管理頁切換 isActive=false
  - Auth 使用者 Disabled=true；司機帳號再登入會顯示「此帳號已被停用」

- 新增簽單頁司機下拉
  - `new-delivery.html?emu=1` 只會列出 `isActive=true` 的司機可選

## 常見錯誤與排查

- HttpsCallable UNAVAILABLE / ECONNREFUSED
  - Functions Emulator 沒啟動或 5001 連不到
  - 解法：重啟 emulator；確認 firebase-init.js 已連 `localhost:5001`（網址加 `?emu=1`）

- permission-denied / unauthenticated
  - 你不是 manager 或未登入
  - 解法：用 `manager@example.test / Test1234!`；若剛改 claims，請登出再登入

- 新增司機顯示「儲存失敗」但 Auth 有建立
  - 舊版本 UI 把「儲存」與「刷新清單」綁一起；現在已拆開
  - 若仍發生：按 F12 看 Network 裡 `createDriverAccount` 的 Response，貼錯誤碼給我們

- 無限轉圈或載入不到清單
  - 請確保用 http 伺服器開啟 prototype（不要用 file://）
  - 使用 `npx http-server -p 3000 -c-1` 並強制重整（Ctrl+F5）

## 佈署到正式環境（可選）

- 佈署 函式（Asia-East1）
```powershell
cd "c:\Users\kiwib\OneDrive\桌面\簽單系統\functions"
npm install

cd "c:\Users\kiwib\OneDrive\桌面\簽單系統"
firebase deploy --only functions
```
- 前端切換到正式服務：網址改用 `?prod=1` 或直接移除 `?emu=1`（firebase-init.js 會自動分流）

## 風險與相容性

- Node 版本必須統一到 20.x；若有人留在 18 或 22，可能導致 emulator 啟不動或 callable 行為異常
- 新增司機 Email 必填；若漏填，雲端 函式 會回 `invalid-argument`
- 權限模型基於 `customClaims.role`；變更 claims 後需重新登入讓 Token 更新

## 後續建議

- 對齊 `firebase-admin` 到 ^13.x（functions 與根目錄同版），降低雙版本混用風險
- 加上最小化自動化驗證腳本（用 `httpsCallable` 直接跑 create/update/delete 並斷言 Auth 與 Firestore 狀態一致）
- 在 UI 對非 manager 身分完全隱藏操作列（目前是 disabled，可再優化）

## 品質檢查

- Build：PASS（本專案前端為靜態頁＋ V9 模組；functions 可在 emulator 啟動代表可執行）
- Lint/Typecheck：未設定（N/A）
- Tests：有 Firestore 規則測試腳本，可選執行
```powershell
npm run test:rules
```
