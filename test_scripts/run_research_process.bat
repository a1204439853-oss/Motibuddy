@echo off
chcp 65001 >nul
echo ========================================
echo   Research Process Chart
echo ========================================
echo.

F:
cd F:\MotiBuddy1\test_scripts

set PYTHON=C:\Users\12044\AppData\Local\Programs\Python\Python312\python.exe

echo Generating research process chart...
echo.
"%PYTHON%" research_process_chart.py

echo.
echo Checking generated file...
echo ----------------------------------------
if exist "research_process.png" (
    echo [OK] research_process.png generated
) else (
    echo [ERROR] Chart not generated
)

echo.
pause
