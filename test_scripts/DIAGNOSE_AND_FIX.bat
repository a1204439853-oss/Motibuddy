@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Test - Diagnose and Fix
echo ========================================
echo.
echo This script will diagnose issues and attempt to fix them.
echo.
pause

cd /d "%~dp0..\test_scripts"

echo.
echo [Step 1] Checking Python installation...
echo ----------------------------------------
python --version
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.8 or higher from https://python.org
    pause
    exit /b 1
)
echo [OK] Python is installed
echo.

echo [Step 2] Installing/Updating required packages...
echo ----------------------------------------
echo This may take a few minutes...
pip install --upgrade matplotlib numpy psutil
echo.

echo [Step 3] Running diagnostic test...
echo ----------------------------------------
python test_debug.py
if errorlevel 1 (
    echo.
    echo [ERROR] Diagnostic test failed!
    echo Please check the error messages above.
    pause
    exit /b 1
)
echo.

echo [Step 4] Checking MotiBuddy executable...
echo ----------------------------------------
if exist "%~dp0..\src-tauri\target\release\MotiBuddy.exe" (
    echo [OK] MotiBuddy executable found
    for %%I in ("%~dp0..\src-tauri\target\release\MotiBuddy.exe") do (
        echo Size: %%~zI bytes
    )
) else (
    echo [WARNING] MotiBuddy executable not found!
    echo Expected location: %~dp0..\src-tauri\target\release\MotiBuddy.exe
    echo.
    echo Please build MotiBuddy first:
    echo   cd F:\MotiBuddy1
    echo   pnpm tauri build
    echo.
    pause
    exit /b 1
)
echo.

echo ========================================
echo   Diagnosis Complete!
echo ========================================
echo.
echo Your system is ready for testing.
echo.
echo Next steps:
echo   1. Close all running MotiBuddy instances
echo   2. Run: python startup_time_test.py
echo   3. Run: python voice_recognition_test.py
echo   4. Run: python cross_window_comm_test.py
echo   5. Start MotiBuddy, then run: python system_resource_monitor.py
echo.
pause
