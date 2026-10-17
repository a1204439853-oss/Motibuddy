@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Interface Responsiveness Test
echo ========================================
echo.

cd /d "%~dp0"

set PYTHON=python

echo Running interface responsiveness test...
echo.
"%PYTHON%" measure_interface_responsiveness.py

echo.
echo Exit code: %errorlevel%
echo.

if exist "interface_responsiveness.png" (
    echo [OK] Chart generated: interface_responsiveness.png
) else (
    echo [ERROR] Chart not generated
)

echo.
pause
