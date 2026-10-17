@echo off
chcp 65001 >nul
echo ========================================
echo   Testing All Chart Generation
echo ========================================
echo.

cd /d "%~dp0"

echo [Test 1] Voice Recognition Test
echo ----------------------------------------
py -c "import voice_recognition_test; print('Import OK')"
py voice_recognition_test.py
echo Exit code: %errorlevel%
echo.

echo [Test 2] Cross-Window Communication Test
echo ----------------------------------------
py -c "import cross_window_comm_test; print('Import OK')"
py cross_window_comm_test.py
echo Exit code: %errorlevel%
echo.

echo [Test 3] System Resource Monitor
echo ----------------------------------------
echo Please start MotiBuddy now, then press any key...
pause >nul
py system_resource_monitor.py
echo Exit code: %errorlevel%
echo.

echo ========================================
echo   Checking Generated Files
echo ========================================
echo.
dir *.png /b 2>nul
echo.

echo ========================================
echo   Test Complete
echo ========================================
pause
