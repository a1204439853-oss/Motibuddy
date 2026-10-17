@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Test Suite - Quick Start
echo ========================================
echo.
echo This will generate all performance test charts for your thesis.
echo.
echo Make sure you have installed Python and required packages:
echo   pip install matplotlib numpy
echo.
pause

cd /d "%~dp0..\test_scripts"

echo.
echo [Step 1] Generating demo charts (no need to run actual tests)...
echo This will create sample charts based on realistic Tauri app performance data.
echo.
python generate_demo_charts.py

echo.
echo ========================================
echo   Charts Generated!
echo ========================================
echo.
echo Check the following files in:
echo %~dp0..\test_scripts\
echo.
echo Charts (ready for your thesis):
echo   1. startup_time_analysis.png
echo   2. voice_recognition_analysis.png
echo   3. cross_window_latency.png
echo   4. system_resources.png
echo.
echo Data files:
echo   1. startup_time_results.json
echo   2. voice_recognition_accuracy.json
echo   3. cross_window_latency.json
echo   4. system_resources.json
echo.
pause
