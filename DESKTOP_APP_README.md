# MotiBuddy 桌面端应用

MotiBuddy 现在已成功转换为桌面端应用程序，使用 Tauri 框架构建。

## 已实现功能

### 第一阶段：桌面应用框架 ✅
- [x] 集成 Tauri 框架
- [x] 配置多窗口支持（主窗口 + 小组件窗口）
- [x] 系统托盘集成
- [x] 应用打包配置

### 第二阶段：本地数据存储 ✅
- [x] 创建本地文件存储服务 (`src/services/storage.ts`)
- [x] 任务数据本地持久化
- [x] 宠物数据本地持久化
- [x] 用户设置本地持久化
- [x] 小组件设置本地持久化
- [x] 数据导出/导入功能
- [x] 从 localStorage 迁移数据

### 第三阶段：语音识别与 NLP ✅
- [x] 集成 Web Speech API (`src/services/voiceRecognition.ts`)
- [x] 实时语音识别
- [x] 自然语言处理解析 (`src/services/nlpParser.ts`)
- [x] 提取任务信息（标题、截止日期、优先级、标签）
- [x] 中文日期时间解析（今天、明天、下周、X天后等）
- [x] 语音输入 UI 优化
- [x] 任务确认对话框

### 第四阶段：桌面小组件 ✅
- [x] 悬浮窗小组件 (`src/pages/WidgetWindow.tsx`)
- [x] 宠物状态实时显示
- [x] 待办任务列表
- [x] 窗口拖拽功能
- [x] 展开/收起功能
- [x] 始终置顶
- [x] 透明背景

## 项目结构

```
MotiBuddy1/
├── src/
│   ├── components/
│   │   └── voice/
│   │       └── VoiceInput.tsx      # 语音输入组件（已集成真实语音识别）
│   ├── contexts/
│   │   ├── taskContext.tsx         # 任务上下文（使用本地存储）
│   │   ├── petContext.tsx          # 宠物上下文（使用本地存储）
│   │   └── widgetContext.tsx       # 小组件上下文（使用本地存储）
│   ├── pages/
│   │   └── WidgetWindow.tsx        # 桌面小组件窗口
│   ├── services/
│   │   ├── storage.ts              # 本地文件存储服务
│   │   ├── voiceRecognition.ts     # 语音识别服务
│   │   ├── nlpParser.ts            # NLP 任务解析服务
│   │   └── tauriCommands.ts        # Tauri 命令封装
│   └── widget-main.tsx             # 小组件入口文件
├── src-tauri/                       # Tauri Rust 后端
│   ├── src/
│   │   └── main.rs                 # Rust 主程序
│   ├── Cargo.toml
│   └── tauri.conf.json             # Tauri 配置
├── widget.html                     # 小组件 HTML 入口
└── vite.config.ts                  # Vite 配置（多入口）
```

## 运行项目

### 开发模式
```bash
# 启动前端开发服务器
npm run dev

# 启动 Tauri 桌面应用（在另一个终端）
npm run tauri:dev
```

### 构建桌面应用
```bash
# 构建生产版本
npm run tauri:build
```

构建完成后，安装包将位于 `src-tauri/target/release/bundle/` 目录。

## 语音输入功能使用说明

1. 点击语音输入按钮（麦克风图标）
2. 说出任务内容，例如：
   - "记得明天下午三点开会"
   - "下周二上午十点去看医生，紧急"
   - "三天后交项目报告，高优先级"
3. 系统自动解析并显示任务信息
4. 确认无误后点击"确认"创建任务

### 支持的日期时间表达

- **相对日期**：今天、明天、后天
- **星期**：本周一、下周二
- **天数**：3天后、一周后、两个月后
- **具体时间**：下午3点、晚上8点半
- **具体日期**：12月25日、3月15号

### 支持的优先级关键词

- **紧急**：紧急、立刻、马上、urgent
- **高优先级**：重要、高优先级、important
- **低优先级**：不急、低优先级、low priority

## 桌面小组件使用说明

1. 右键点击系统托盘图标，选择"显示小组件"
2. 小组件将悬浮在桌面上，显示：
   - 当前时间和日期
   - 宠物状态（心情、饱食、健康、能量）
   - 待办任务列表
3. 拖拽标题栏可移动小组件位置
4. 点击展开按钮查看更多任务
5. 点击最小化按钮将小组件隐藏到托盘

## 数据存储位置

桌面应用的数据存储在系统应用数据目录：

- **Windows**: `%APPDATA%/com.motibuddy.app/MotiBuddyData/`
- **macOS**: `~/Library/Application Support/com.motibuddy.app/MotiBuddyData/`
- **Linux**: `~/.config/com.motibuddy.app/MotiBuddyData/`

数据文件包括：
- `tasks.json` - 任务数据
- `pet.json` - 宠物数据
- `user.json` - 用户数据
- `settings.json` - 应用设置
- `widget.json` - 小组件设置

## 注意事项

1. **语音识别**：需要浏览器支持 Web Speech API，首次使用需要授权麦克风权限
2. **桌面小组件**：需要 Tauri 环境，在 Web 浏览器中无法使用
3. **数据迁移**：首次启动桌面应用时，会自动从 localStorage 迁移数据

## 技术栈

- **前端框架**: React + TypeScript
- **构建工具**: Vite
- **桌面框架**: Tauri (Rust)
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **语音识别**: Web Speech API
- **NLP**: compromise.js + date-fns

## 后续优化建议

1. 添加 SQLite 数据库支持，支持更复杂的查询
2. 实现任务提醒通知（系统通知）
3. 添加开机自启动选项
4. 支持多语言语音识别
5. 优化 NLP 解析准确率
6. 添加任务统计图表到小组件
