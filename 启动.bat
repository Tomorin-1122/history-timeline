@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   考研古代史时间轴 · 本地编辑服务
echo   页面: http://localhost:3099
echo   关闭本窗口即停止服务
echo   （日常只读查看仍可双击 index.html）
echo ============================================
start "" http://localhost:3099
node server.js
pause
