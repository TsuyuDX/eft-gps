@echo off
cd /d "%~dp0"
"runtime\node.exe" "scripts\prepare-portable.mjs" --launch
if errorlevel 1 pause
