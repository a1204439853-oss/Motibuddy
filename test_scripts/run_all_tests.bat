@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Performance Tests
echo ========================================
echo.
echo This will run all performance tests.
echo Make sure MotiBuddy is built at:
echo %~dp0..\src-tauri\target\release\MotiBuddy.exe
echo.
pause

cd /d "%~dp0"

echo.
echo [Step 1] Checking Python environment...
echo ----------------------------------------
py --version
echo.

echo [Step 2] Installing dependencies (if needed)...
echo ----------------------------------------
py -m pip install matplotlib numpy psutil -q
echo Dependencies OK
echo.

echo [Step 3] Running Startup Time Test (20 iterations)...
echo ----------------------------------------
echo This will take about 5 minutes...
echo Each iteration launches MotiBuddy, waits 3 seconds, then closes it.
echo.
timeout /t 3 /nobreak >nul
py startup_time_test.py
echo.

echo [Step 4] Running Voice Recognition Test...
echo ----------------------------------------
py voice_recognition_test.py
echo.

echo [Step 5] Running Cross-Window Communication Test...
echo ----------------------------------------
py cross_window_comm_test.py
echo.

echo [Step 6] Checking generated files...
echo ----------------------------------------
set FILE_COUNT=0

if exist "startup_time_analysis.png" (
    echo [OK] startup_time_analysis.png
    set /a FILE_COUNT+=1
) else (
    echo [MISSING] startup_time_analysis.png
)

if exist "voice_recognition_analysis.png" (
    echo [OK] voice_recognition_analysis.png
    set /a FILE_COUNT+=1
) else (
    echo [MISSING] voice_recognition_analysis.png
)

if exist "cross_window_latency.png" (
    echo [OK] cross_window_latency.png
    set /a FILE_COUNT+=1
) else (
    echo [MISSING] cross_window_latency.png
)

echo.
echo ========================================
echo   Tests Complete!
echo ========================================
echo.
echo Generated %FILE_COUNT% chart files.
echo.
echo Location: %~dp0..\test_scripts\
echo.
echo Files ready for your thesis:
echo   - startup_time_analysis.png
echo   - voice_recognition_analysis.png
echo   - cross_window_latency.png
echo.
pause
