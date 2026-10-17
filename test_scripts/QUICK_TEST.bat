@echo off
chcp 65001 >nul
echo ========================================
echo   Quick Test - Python Environment
echo ========================================
echo.

cd /d "%~dp0"

echo Current directory: %CD%
echo.

echo [Test 1] Python version:
py --version
echo.

echo [Test 2] Testing imports:
py -c "import matplotlib, numpy, psutil; print('Matplotlib:', matplotlib.__version__); print('NumPy:', numpy.__version__); print('psutil:', psutil.__version__)"
echo.

echo [Test 3] Running simple test:
py simple_test.py
echo.

echo ========================================
echo   Test Complete
echo ========================================
pause
