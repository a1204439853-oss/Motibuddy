@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Interface Responsiveness Test
echo ========================================
echo.

F:
cd F:\MotiBuddy1\test_scripts

set PYTHON=C:\Users\12044\AppData\Local\Programs\Python\Python312\python.exe

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
