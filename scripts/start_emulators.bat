@echo off
setlocal
cd /d "c:\My 923\Electronic-Approval-System"
REM 啟動 Firestore/Auth/Storage Emulators，讀 firebase.json，高位埠
npx --yes firebase-tools emulators:start --only firestore,storage,auth --project electronic-approval-dev --config firebase.json
endlocal
