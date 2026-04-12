@echo off
chcp 65001 >nul
echo ==========================================
echo    MotiBuddy 桌面端应用启动器
echo ==========================================
echo.
echo 正在启动 MotiBuddy...
echo.

:: 检查可执行文件是否存在
if not exist "motibuddy.exe" (
    echo 错误：找不到 motibuddy.exe
    echo 请确保此文件在正确的位置
    pause
    exit /b 1
)

:: 启动应用
start "" "motibuddy.exe"

echo MotiBuddy 已启动！
echo.
echo 提示：
echo - 应用启动后会在系统托盘显示图标
echo - 右键点击托盘图标可以显示/隐藏窗口
echo - 数据将保存在本地，不会丢失
echo.
timeout /t 3 >nul
