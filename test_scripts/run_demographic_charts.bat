@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Demographics Charts
echo ========================================
echo.

cd /d "%~dp0"

set PYTHON=python

echo Generating demographic charts with muted colors...
echo.
"%PYTHON%" demographic_charts.py

echo.
echo Checking generated files...
echo ----------------------------------------
if exist "demographic_profile.png" (
    echo [OK] demographic_profile.png
) else (
    echo [MISSING] demographic_profile.png
)

if exist "demographic_detailed.png" (
    echo [OK] demographic_detailed.png
) else (
    echo [MISSING] demographic_detailed.png
)

echo.
pause
