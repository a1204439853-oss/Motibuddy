@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Memory Test
echo ========================================
echo.

cd /d "%~dp0"

set PYTHON=python

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
