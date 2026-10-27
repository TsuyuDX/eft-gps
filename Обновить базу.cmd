@echo off
cd /d "%~dp0"
echo Downloading public data. Internet required. Keep this window open.
"runtime\node.exe" scripts\refresh.mjs
pause
