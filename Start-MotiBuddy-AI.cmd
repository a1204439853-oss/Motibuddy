@echo off
cd /d "%~dp0"
node scripts/start-agent-desktop.mjs
if errorlevel 1 pause
