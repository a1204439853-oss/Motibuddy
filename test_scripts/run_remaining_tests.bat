@echo off
chcp 65001 >nul
echo ========================================
echo   Running Remaining Tests
echo ========================================
echo.

cd /d "%~dp0"

echo [Test 1] Voice Recognition Accuracy
echo ----------------------------------------
py voice_recognition_test.py
echo.

echo [Test 2] Cross-Window Communication
echo ----------------------------------------
py cross_window_comm_test.py
echo.

echo [Test 3] System Resource Monitor
echo ----------------------------------------
echo Make sure MotiBuddy is running for this test!
pause
py system_resource_monitor.py
echo.

echo ========================================
echo   Checking All Generated Files
echo ========================================
echo.
dir *.png /b
echo.
dir *.json /b
echo.

echo ========================================
echo   All Tests Complete!
echo ========================================
pause
