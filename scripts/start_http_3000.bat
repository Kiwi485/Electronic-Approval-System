@echo off
setlocal
cd /d "c:\My 923\Electronic-Approval-System\prototype"
REM 使用 npx.cmd 啟動 3000 埠的靜態伺服器，綁定 0.0.0.0 以供區網/手機存取
npx.cmd --yes http-server -p 3000 -a 0.0.0.0 -c-1
endlocal
