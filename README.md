# MotiBuddy - Gamified Task Management Application

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-1.5-blueviolet)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)](https://www.typescriptlang.org)

**MotiBuddy** is a gamified intelligent task management application that integrates virtual pet nurturing mechanisms to enhance emotional attachment and overcome procrastination.

![MotiBuddy Logo](src-tauri/icons/icon.ico)

## ✨ Features

### 🐾 Virtual Pet Nurturing
- **Four pet types**: Cat, Dog, Panda, Bird
- **Status system**: Health, Happiness, Hunger, Energy, Level, Experience
- **Emotional feedback**: Pet responds to your task completion behavior
- **Growth mechanism**: Level up by completing tasks

### 🎙️ Intelligent Voice Interaction
- **Voice input**: Create tasks using natural speech
- **NLP parsing**: Automatically extract task title, due date, priority
- **Smart date recognition**: Support expressions like "tomorrow", "next Monday"

### 🖥️ Desktop Widget
- **Always-on-top window**: Persistent visibility while working
- **Transparent background**: Non-intrusive design
- **Quick interactions**: Feed, play, and check pet status directly

### 📊 Task Management
- **Priority system**: Urgent, High, Medium, Low
- **Status tracking**: In Progress, Completed, Overdue
- **Smart sorting**: Sort by due date, priority, or creation time
- **Search & Filter**: Quickly find tasks

### 🏆 Achievement System
- Unlock achievements by completing tasks
- Track consecutive completion days
- Monitor task completion rate

## 🚀 Quick Start

### Download
Download the latest release from [GitHub Releases](../../releases).

**System Requirements:**
- Windows 10/11 (64-bit)
- macOS (coming soon)
- Linux (coming soon)

### Installation
1. Download `MotiBuddy_0.1.0_x64_en-US.msi` from the Releases page
2. Double-click the installer and follow the prompts
3. Launch MotiBuddy from the Start Menu or Desktop shortcut

### First Use
1. Register a new account or login
2. Choose your virtual pet (Cat, Dog, Panda, or Bird)
3. Name your pet
4. Start creating and completing tasks!

## 🛠️ Development

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **NLP**: Compromise.js

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (package manager)
- [Rust](https://www.rust-lang.org/) (for Tauri)

### Setup

```bash
# Clone the repository
git clone https://github.com/a1204439853-oss/Motibuddy.git
cd Motibuddy

# Install dependencies
pnpm install

# Run in development mode
pnpm run tauri:dev

# Build for production
pnpm run tauri:build
```

## 📁 Project Structure

```
MotiBuddy/
├── src/                    # Frontend React code
│   ├── components/         # UI components
│   ├── contexts/          # React contexts (state management)
│   ├── pages/             # Page components
│   └── services/          # Business logic & API calls
├── src-tauri/             # Backend Rust code
│   ├── src/               # Rust source files
│   └── icons/             # Application icons
├── test_scripts/          # Performance testing scripts
└── thesis/                # Thesis documentation (LaTeX)
```

## 🎓 Thesis Project

This project is developed as a graduation thesis for exploring the integration of gamification and virtual pet nurturing in task management applications.

### Research Focus
- **Self-Determination Theory**: Addressing autonomy, competence, and relatedness
- **Procrastination Intervention**: Using emotional attachment to motivate task completion
- **Desktop Application Design**: Persistent engagement through widgets and system tray

### Documentation
- [Thesis Outline](Thesis_Outline.md)
- [Performance Testing Guide](test_scripts/README.md)
- [Desktop App README](DESKTOP_APP_README.md)

## 🧪 Testing

Run the test suite:

```bash
cd test_scripts
python startup_time_test.py
python voice_recognition_test.py
python system_resource_monitor.py
```

See [test_scripts/README.md](test_scripts/README.md) for detailed testing instructions.

## 📸 Screenshots

*Coming soon - Add screenshots of the main interface, pet interaction, and desktop widget*

## 🤝 Contributing

This is a thesis project and is currently not accepting external contributions. However, feedback and suggestions are welcome!

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Tauri](https://tauri.app/) - For the lightweight desktop framework
- [React](https://react.dev/) - For the UI library
- [Compromise.js](https://compromise.cool/) - For natural language processing
- [Framer Motion](https://www.framer.com/motion/) - For smooth animations

## 📧 Contact

For questions or feedback about this thesis project, please open an issue on GitHub.

---

**Note**: This application was created as part of an academic thesis project. The virtual pet videos and some assets are for demonstration purposes.
