# MotiBuddy - Gamified Task Management Application

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-1.5-blueviolet)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)](https://www.typescriptlang.org)

**MotiBuddy** is a gamified intelligent task management application that integrates virtual pet nurturing mechanisms to enhance emotional attachment and overcome procrastination.

本机最新验收版（2026-10-17）：双击 `Start-MotiBuddy-AI.cmd` 启动 `MotiBuddy-Verify-unified.exe`。本轮统一各模块界面，加入小时天气和可点击月历，修复音乐切换保存，完善音色试听、场景轮播、换一批推荐、树洞确认保存、通用问答和 Windows 提醒。包含上一轮的历史对话、头像与初始手账功能。详见 [本轮功能与手动验收](docs/UNIFIED_V4.md) 和 [构建验证记录](docs/UNIFIED_V4_BUILD.json)。

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

The inline pet assistant supports conversation, daily planning and reviewed text/image task imports, with automatic local connections and pet feedback. See [the development checklist](docs/AGENT_DEVELOPMENT_PLAN.md), [manual acceptance steps](docs/AGENT_MANUAL_VERIFICATION.md), and [private local gateway setup](server/README.md). Supplier credentials belong only in the ignored server environment. Use the latest EXE listed in [the build record](docs/AGENT_EXE_BUILD.json); older executables do not contain the current interface.

Current reliability work uses Node.js 24.x. Run `npm run check:desktop` for TypeScript, Node regression tests, Rust storage tests and desktop compilation. The Tauri release build runs this gate before packaging. Normal task, pet, achievement and interaction-limit changes now commit together in `business_<userId>.json`; legacy source files are retained during migration. Credentials still use the legacy account store.

The current source has not yet passed GUI, installer or upgrade acceptance. Existing EXE/MSI files do not contain these changes. See [the verification guide](MANUAL_VERIFICATION_GUIDE.md) and [the latest implementation record](DESKTOP_RELIABILITY_IMPROVEMENT_PLAN.md#16-第三批实施记录账户原子快照退出等待与小组件权威读取) for current scope and remaining work. Account deletion is temporarily unavailable until backup and cleanup cover the authoritative data.

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **NLP**: Compromise.js

### Prerequisites
- [Node.js](https://nodejs.org/) (24.x; verified runtime for the reliability tests)
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

# Check types and run isolated reliability tests
pnpm run check

# Build for production
pnpm run tauri:build
```

Desktop builds run the frontend checks and build automatically, and embed the project-root `dist/` output. They no longer depend on a manually copied `src-tauri/dist/` directory. See `tests/README.md` for the test scope and `DESKTOP_RELIABILITY_IMPROVEMENT_PLAN.md` for remaining release requirements. Existing EXE/MSI files are not rebuilt by editing the source.

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

## 最新桌面验收版本（2026-10-16）

双击根目录 `Start-MotiBuddy-AI.cmd` 启动 `MotiBuddy-Verify-product.exe`。本轮增加纪念日便利贴、系统提醒、定时助手、可核验成就与宠物经验奖励，并改进专注准备页和助手交互。使用前通过托盘退出旧版本。操作说明与限制见 [本轮功能及验收](docs/PRODUCT_EXPANSION.md)，产物和检查结果见 [构建记录](docs/PRODUCT_BUILD.json)。

提醒与定时任务要求应用运行或隐藏到托盘，完全退出和关机后不执行。通知能否显示还受 Windows 通知权限和勿扰模式影响。AI 依然通过本机私有服务连接，供应商密钥不包含在 EXE 或前端中。
