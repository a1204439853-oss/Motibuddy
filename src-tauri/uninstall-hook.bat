@echo off
chcp 65001 >nul
echo 正在关闭 MotiBuddy...

:: 创建退出标志文件，通知应用退出
if exist "%LOCALAPPDATA%\com.motibuddy.app\.exit_flag" (
    del "%LOCALAPPDATA%\com.motibuddy.app\.exit_flag"
)
echo. > "%LOCALAPPDATA%\com.motibuddy.app\.exit_flag"

:: 等待应用关闭
timeout /t 2 /nobreak >nul

:: 强制结束进程（如果还在运行）
taskkill /F /IM motibuddy.exe 2>nul

echo MotiBuddy 已关闭
exit 0
