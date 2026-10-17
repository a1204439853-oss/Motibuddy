@echo off
chcp 65001 >nul
echo ========================================
echo   Research Questions Analysis Charts
echo ========================================
echo.

cd /d "%~dp0"

set PYTHON=python

echo Generating research questions analysis charts...
echo.
"%PYTHON%" research_questions_charts.py

echo.
echo Checking generated file...
echo ----------------------------------------
if exist "research_questions_analysis.png" (
    echo [OK] research_questions_analysis.png generated
) else (
    echo [ERROR] Chart not generated
)

echo.
pause
