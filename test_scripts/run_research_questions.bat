@echo off
chcp 65001 >nul
echo ========================================
echo   Research Questions Analysis Charts
echo ========================================
echo.

F:
cd F:\MotiBuddy1\test_scripts

set PYTHON=C:\Users\12044\AppData\Local\Programs\Python\Python312\python.exe

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
