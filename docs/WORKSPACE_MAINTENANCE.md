# 工作区空间维护

主要占用来自 Rust 的 `src-tauri/target`：审计时约 9.2 GB，包含调试库、编译缓存、发布库及资源副本。`dist`、`dist-main`、`dist-widget`、旧前端验证目录各有一份视频等构建副本；隔离浏览器的多个测试配置也占用数百 MB。这些是磁盘空间，不等同于应用运行时的内存。

清理前已经提交快照 `dec82e8`。源码、原始图片和报告脚本已保存到 Git；受忽略规则影响，原始视频和 Word／PDF 文件不在此提交内，故本次保留它们。

## 可以清理

- Rust 的 `src-tauri/target`，以及 `dist`、`dist-main`、`dist-widget` 和独立前端验证构建目录：全部可从源码重新生成。
- 自动测试创建的 `node_modules/.cache/motibuddy-i18n/browser-*` 独立浏览器配置，以及 Vite 缓存：测试账号均为模拟数据，测试结束后可删除。
- 已替换的验证 EXE、旧路径测试二进制与调试符号、WiX 下载压缩包：最新验证 EXE 先在根目录保留并核对哈希。

## 本次保留

`src`、`src-tauri/src`、Rust／前端配置及锁文件、`public`、原始视频和图片、论文／调查资料、所有 Git 历史、node_modules 安装依赖、最新测试截图与报告。旧 `motibuddy.exe` 被 `start_motibuddy.bat` 引用，本次也保留，避免破坏旧启动器。它不包含本次更新，验收请直接运行本次新 EXE。

不处理真实 AppData、账号、任务和伙伴存档。本次不是通用数据恢复或完整备份功能。

## 操作及代价

```powershell
# 默认只预览
.\scripts\clean-generated.ps1
# 先完成验证、构建并复制 MotiBuddy-Verify-onboarding.exe，再执行
.\scripts\clean-generated.ps1 -Apply
```

脚本只处理固定清单，并拒绝工作区以外、链接、Git 跟踪文件及仍在运行的目标。实际释放空间及路径见 `WORKSPACE_CLEANUP_REPORT.json`。遇到占用或权限问题会记录失败，不会终止无关应用。

清理后可继续编辑源码和使用现有依赖。下一次 Rust 检查／构建会重建 target，耗时和占用会增加；被清理的 WiX 工具可能需要重新下载。`npm run dev` 会重新生成 Vite 缓存，`npm run tauri:build -- --config src-tauri\tauri.verify.conf.json --bundles none --ci` 可重新生成验证 EXE。

## 本轮执行结果

2026-10-15：清理脚本处理 21 个可重新生成的目标，无失败；删除文件逻辑大小约 10.551 GiB。实际释放空间受文件系统分配与硬链接影响。

清理后目录逻辑大小约 1.308 GiB，保留 15,171 个文件；已核实源视频、开发依赖及本轮示例任务截图存在，所有删除目标均不存在。最新 EXE 的 SHA-256 仍为 `6B4FA3061B029D98E5313D42A1E2A8C6B79E3504045B6FE3924BD56612EB58A1`，Git 未出现源码或素材被删除的变更。详细路径见 `WORKSPACE_CLEANUP_REPORT.json`。
