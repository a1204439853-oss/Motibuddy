@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Memory Test
echo ========================================
echo.

F:
cd F:\MotiBuddy1\test_scripts

set PYTHON=C:\Users\12044\AppData\Local\Programs\Python\Python312\python.exe

echo Using Python: %PYTHON%
echo.

echo Running memory measurement script...
echo Make sure MotiBuddy is running!
echo.
"%PYTHON%" measure_motibuddy_memory.py

echo.
echo Exit code: %errorlevel%
echo.

if exist "motibuddy_memory_usage.png" (
    echo [OK] Chart generated: motibuddy_memory_usage.png
) else (
    echo [ERROR] Chart not generated
)

echo.
pause
