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
