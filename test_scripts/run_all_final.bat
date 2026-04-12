@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Complete Test Suite
echo ========================================
echo.

F:
cd F:\MotiBuddy1\test_scripts

set PYTHON=C:\Users\12044\AppData\Local\Programs\Python\Python312\python.exe

echo Using Python: %PYTHON%
echo.

echo [Test 1] Voice Recognition Test
echo ----------------------------------------
"%PYTHON%" voice_recognition_test.py
echo Exit code: %errorlevel%
echo.

echo [Test 2] Cross-Window Communication Test
echo ----------------------------------------
"%PYTHON%" cross_window_comm_test.py
echo Exit code: %errorlevel%
echo.

echo [Test 3] System Resource Monitor
echo ----------------------------------------
echo Please start MotiBuddy now, then press any key...
pause >nul
"%PYTHON%" system_resource_monitor.py
echo Exit code: %errorlevel%
echo.

echo ========================================
echo   Checking All Generated Files
echo ========================================
echo.
dir *.png /b 2>nul
echo.

echo ========================================
echo   Test Complete
echo ========================================
pause
