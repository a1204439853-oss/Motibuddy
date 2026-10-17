@echo off
chcp 65001 >nul
echo ========================================
echo   Questionnaire Structure Chart
echo ========================================
echo.

cd /d "%~dp0"

set PYTHON=python

echo Generating questionnaire structure chart...
echo.
"%PYTHON%" questionnaire_structure_chart.py

echo.
echo Checking generated file...
echo ----------------------------------------
if exist "questionnaire_structure.png" (
    echo [OK] questionnaire_structure.png generated
) else (
    echo [ERROR] Chart not generated
)

echo.
pause
