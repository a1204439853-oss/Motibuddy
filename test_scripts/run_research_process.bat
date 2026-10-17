@echo off
chcp 65001 >nul
echo ========================================
echo   Research Process Chart
echo ========================================
echo.

cd /d "%~dp0"

set PYTHON=python

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
