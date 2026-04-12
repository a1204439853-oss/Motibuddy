@echo off
chcp 65001 >nul
echo ========================================
echo   Python Installation Checker
echo ========================================
echo.

echo [1] Checking common Python commands...
echo ----------------------------------------
echo.

echo Trying: python --version
python --version 2>nul
if %errorlevel% == 0 (
    echo   ^✓ python command works
echo.
) else (
    echo   ^✗ python command not found
echo.
)

echo Trying: py --version
py --version 2>nul
if %errorlevel% == 0 (
    echo   ^✓ py command works
echo.
) else (
    echo   ^✗ py command not found
echo.
)

echo Trying: python3 --version
python3 --version 2>nul
if %errorlevel% == 0 (
    echo   ^✓ python3 command works
echo.
) else (
    echo   ^✗ python3 command not found
echo.
)

echo [2] Checking PATH environment variable...
echo ----------------------------------------
echo Current PATH contains:
echo %PATH:;=&echo.% | findstr /i "python"
echo.

echo [3] Checking common installation locations...
echo ----------------------------------------
if exist "C:\Python311\python.exe" (
    echo   ^✓ Found: C:\Python311\python.exe
    "C:\Python311\python.exe" --version
) else (
    echo   ^✗ Not found: C:\Python311\python.exe
)

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" (
    echo   ^✓ Found: C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe
    "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" --version
) else (
    echo   ^✗ Not found in AppData\Local\Programs\Python\Python311
)

if exist "C:\Program Files\Python311\python.exe" (
    echo   ^✓ Found: C:\Program Files\Python311\python.exe
    "C:\Program Files\Python311\python.exe" --version
) else (
    echo   ^✗ Not found in Program Files\Python311
)

echo.
echo [4] Checking Windows Registry...
echo ----------------------------------------
reg query "HKLM\SOFTWARE\Python\PythonCore" 2>nul
if %errorlevel% == 0 (
    echo   ^✓ Python found in registry (HKLM)
) else (
    reg query "HKCU\SOFTWARE\Python\PythonCore" 2>nul
    if %errorlevel% == 0 (
        echo   ^✓ Python found in registry (HKCU)
    ) else (
        echo   ^✗ Python not found in registry
    )
)

echo.
echo ========================================
echo   Check Complete
echo ========================================
echo.
echo If Python is installed but not in PATH:
echo   1. Find python.exe location above
echo   2. Add that folder to your PATH
echo   OR
echo   3. Use the full path to run scripts:
echo      C:\Path\To\python.exe startup_time_test.py
echo.
pause
