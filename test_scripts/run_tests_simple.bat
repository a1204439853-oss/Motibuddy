@echo off
chcp 65001 >nul
echo ========================================
echo   MotiBuddy Test Runner
echo ========================================
echo.

cd /d "%~dp0..\test_scripts"

echo [1/5] Testing environment...
echo ----------------------------------------
py -c "import matplotlib, numpy, psutil; print('Matplotlib:', matplotlib.__version__); print('NumPy:', numpy.__version__); print('psutil:', psutil.__version__); print('All packages OK!')"
if errorlevel 1 (
    echo [ERROR] Package check failed!
    pause
    exit /b 1
)
echo.

echo [2/5] Running startup time test...
echo ----------------------------------------
echo This will launch MotiBuddy 20 times. Please wait...
echo.
py startup_time_test.py
echo.

echo [3/5] Running voice recognition test...
echo ----------------------------------------
py voice_recognition_test.py
echo.

echo [4/5] Running cross-window communication test...
echo ----------------------------------------
py cross_window_comm_test.py
echo.

echo [5/5] Checking generated files...
echo ----------------------------------------
if exist "startup_time_analysis.png" (
    echo [OK] startup_time_analysis.png generated
) else (
    echo [WARNING] startup_time_analysis.png not found
)

if exist "voice_recognition_analysis.png" (
    echo [OK] voice_recognition_analysis.png generated
) else (
    echo [WARNING] voice_recognition_analysis.png not found
)

if exist "cross_window_latency.png" (
    echo [OK] cross_window_latency.png generated
) else (
    echo [WARNING] cross_window_latency.png not found
)

echo.
echo ========================================
echo   Tests Complete!
echo ========================================
echo.
echo Check the PNG files in:
echo %~dp0..\test_scripts\
echo.
pause
