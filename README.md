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

## 🌱 測試資料種子 (Seed)
為了避免手動逐筆新增，已提供 `dev-seed.js`。在任何已載入 Firebase 的頁面 (例如 `new-delivery.html`) 打開瀏覽器 Console：

```javascript
import('./js/dev-seed.js').then(m => m.seedAll());
```

預期輸出：
```
[Seed] 完成： { categories:3, machines:3, drivers:3, force:false }
```
再次執行若文件已存在會顯示 0。要強制覆蓋：
```javascript
import('./js/dev-seed.js').then(m => m.seedAll({ force:true }));
```

種子內容：
- machineCategories: excavator / crane / old-machine
- machines: m-pc200 / m-sumito / m-retire
- users (drivers): u-wang / u-lee / u-retire

快速驗證：
```javascript
import('./js/api/index.js').then(api => {
  api.listCategories().then(c=>console.table(c));
  api.listAllMachines().then(m=>console.table(m));
  api.listAllDrivers().then(d=>console.table(d));
});
```

若 `import('./js/dev-seed.js')` 一直載入舊版本，附加 query 參數清快取：
```javascript
import(`./js/dev-seed.js?t=${Date.now()}`).then(m => m.seedAll());
```

---

## 🧪 核心驗收步驟 (縮寫版)
| # | 操作 | 期待結果 |
|---|------|----------|
| 1 | 啟動 emulators + http-server | Console 顯示 Connected / 站台可開 |
| 2 | 執行 seedAll | 三類三機三司機寫入 |
| 3 | `api.getApiSource()` | 顯示 firestore |
| 4 | `createMachine()` | Firestore 新文件含 createdAt/updatedAt |
| 5 | `updateMachine()` 停用 | updatedAt 更新且 active 列表排除 |
| 6 | 建立簽單 (多機具/司機) | deliveryNotes 出現 machines[] / drivers[] |
| 7 | 切 `ENABLE_MACHINE_DEACTIVATE_FILTER=true` | 停用機具不出現在表單 |
| 8 | 離線建立後恢復網路 | 暫存同步，歷史可見 |
| 9 | 未登入訪問受保護頁 | 被導向登入或規則拒絕 |
| 10 | Console | 無未捕捉錯誤 |

---

## 🔥 Smoke Script (一次跑)
```javascript
(async () => {
  const api = await import('./js/api/index.js');
  console.log('SOURCE=', api.getApiSource?.());
  await import('./js/dev-seed.js').then(m=>m.seedAll());
  const m = await api.createMachine({ name:'SmokeTest 機具', categoryId:null });
  console.log('Created', m.id, m.createdAt);
  const mu = await api.updateMachine(m.id, { isActive:false });
  console.log('Updated active', mu.isActive, mu.updatedAt);
  const activeIds = (await api.listActiveMachines()).map(x=>x.id);
  if (activeIds.includes(m.id)) console.warn('❌ 停用機具仍在 active 列表'); else console.log('✅ 停用過濾 OK');
})();
```

---

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


