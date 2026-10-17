@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Test with Full Output
echo ========================================
echo.

cd /d "%~dp0"

echo [Test 1] Simple Python Test
echo ----------------------------------------
py -u simple_test.py
echo Exit code: %errorlevel%
echo.

echo [Test 2] Startup Time Test (with error output)
echo ----------------------------------------
echo This may take 5 minutes...
echo.
py -u startup_time_test.py 2>&1
echo Exit code: %errorlevel%
echo.

echo [Test 3] Check if files were created
echo ----------------------------------------
dir *.png 2>nul
dir *.json 2>nul
echo.

echo ========================================
echo   Test Complete
echo ========================================
pause
