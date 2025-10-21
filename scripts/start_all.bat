@echo off
setlocal
REM 啟動 Emulator 視窗
start "Emulators" cmd /k "cd /d c:\My 923\Electronic-Approval-System && npx --yes firebase-tools emulators:start --only firestore,storage,auth --project electronic-approval-dev --config firebase.json"

REM 等候幾秒讓 emulators 起來
timeout /t 4 /nobreak >nul

REM 啟動本機 3000 伺服器視窗
start "HTTP-3000" cmd /k "cd /d c:\My 923\Electronic-Approval-System\prototype && npx --yes http-server -p 3000 -a 0.0.0.0 -c-1 --cors --gzip --brotli -e html"

REM 自動打開 Emulator UI 與測試頁
start "" "http://127.0.0.1:4450/"
start "" "http://localhost:3000/new-delivery.html?emu=1"
endlocal
