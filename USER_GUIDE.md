# MotiBuddy Desktop Application User Guide

## File Description

| File | Description |
|------|-------------|
| `motibuddy.exe` | Main desktop application file (approx. 212 MB) |
| `启动MotiBuddy.bat` | One-click launch script |
| `dist/static/` | Frontend static resource files |

## System Requirements

- Windows 10/11 64-bit operating system
- At least 500 MB available disk space
- Recommended 4GB or more RAM

## Launch Methods

### Method 1: Using Launch Script (Recommended)
Double-click the `启动MotiBuddy.bat` file to run

### Method 2: Direct Run
Double-click the `motibuddy.exe` file to run

## Features

### 1. Task Management
- ✅ Create, edit, and delete tasks
- ✅ Set due dates and priorities
- ✅ Task completion status tracking
- ✅ Overdue task reminders

### 2. Voice Input
- ✅ Click the microphone icon to start voice recognition
- ✅ Automatically parse task information (title, time, priority)
- ✅ Support for Chinese natural language input
- Examples:
  - "Have a meeting tomorrow afternoon at 3 o'clock"
  - "Go to the doctor next Tuesday morning at 10, urgent"
  - "Submit project report in three days"

### 3. Virtual Pet
- ✅ Adopt your exclusive pet companion
- ✅ Feed your pet by completing tasks
- ✅ Real-time pet status display (mood, hunger, health, energy)
- ✅ Interact with your pet to increase intimacy

### 4. Desktop Widget
- ✅ Right-click system tray icon → "Show Widget"
- ✅ Floating window displays pet status and to-do tasks
- ✅ Draggable to move position
- ✅ Always on top display

### 5. Data Storage
- ✅ All data stored locally, no internet required
- ✅ Data saved at: `%APPDATA%/com.motibuddy.app/MotiBuddyData/`
- ✅ Support data export/import

## System Tray Functions

After the application starts, the MotiBuddy icon will appear in the system tray (bottom right corner):

- **Left-click**: Show/Hide main window
- **Right-click**: Show menu
  - Show main window
  - Show widget
  - Exit application

## Keyboard Shortcuts

| Shortcut | Function |
|----------|----------|
| `Ctrl + N` | New task |
| `Ctrl + F` | Search tasks |
| `Ctrl + ,` | Open settings |

## FAQ

### Q: No window appears after application launch?
A: The application will minimize to the system tray after startup. Click the tray icon to display the window.

### Q: Voice input not working?
A: Please ensure:
1. System microphone is working properly
2. Browser/application has microphone permissions
3. Internet connection is active (voice recognition requires network)

### Q: Where is data stored?
A: Data is stored locally:
- Windows: `C:\Users\[Username]\AppData\Roaming\com.motibuddy.app\MotiBuddyData\`

### Q: How to backup data?
A: Copy all files in the above data directory to backup.

### Q: How to uninstall the application?
A: Simply delete the `motibuddy.exe` file. Data files will not be automatically deleted.

## Notes

1. First launch may take a few seconds to load
2. Do not delete or move application files while running
3. Regularly backup important data is recommended
4. If you encounter issues, try restarting the application

## Technical Support

If you have problems, please check:
1. Whether the system meets minimum requirements
2. Whether there is sufficient disk space
3. Whether antivirus software is falsely blocking

---

**Version**: v0.1.0  
**Build Time**: 2026-02-18  
**Tech Stack**: Tauri + React + Rust
