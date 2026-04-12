# Markdown转Word指南

## 问题说明

由于环境限制，无法直接通过Pandoc或Python脚本将Markdown转换为Word文档。

## 替代方案

### 方案1：使用在线Pandoc转换（推荐）⭐

访问 https://pandoc.org/try/ 

步骤：
1. 打开上面的网址
2. 在左侧粘贴 `thesis_outline.md` 的内容
3. 在"From"选择 **Markdown**
4. 在"To"选择 **DOCX**
5. 点击 **Convert** 按钮
6. 下载生成的 `.docx` 文件

### 方案2：使用Typora（推荐）

Typora是优秀的Markdown编辑器，支持直接导出Word：

1. 下载并安装 [Typora](https://typora.io/)
2. 打开 `thesis_outline.md` 文件
3. 文件 → 导出 → Word (.docx)
4. 保存即可

### 方案3：使用VS Code插件

1. 在VS Code中安装插件 **"Markdown to Word"** 或 **"Pandoc Markdown"**
2. 打开 `thesis_outline.md`
3. 右键点击编辑器
4. 选择导出为Word格式

### 方案4：使用在线Markdown转Word工具

- **CloudConvert**: https://cloudconvert.com/md-to-docx
- **Convertio**: https://convertio.co/md-docx/
- **Online Convert**: https://document.online-convert.com/convert/md-to-docx

步骤：
1. 访问上述任一网站
2. 上传 `thesis_outline.md` 文件
3. 选择输出格式为DOCX
4. 开始转换并下载

### 方案5：手动复制粘贴

1. 在VS Code中打开 `thesis_outline.md`
2. 使用预览功能查看格式化内容
3. 全选并复制
4. 粘贴到Microsoft Word
5. 手动调整格式（标题、列表等）

## 文件位置

- **源文件**: `F:\MotiBuddy1\thesis_outline.md`
- **目标文件**: `F:\MotiBuddy1\thesis_outline.docx`（需要您自行转换）

## 格式建议

转换为Word后，建议应用以下格式：

- **字体**: Times New Roman
- **字号**: 12pt（正文），14pt（标题）
- **行距**: 1.5倍行距
- **页边距**: 上下2.5cm，左右3cm

## 推荐方案

最推荐 **方案1（Pandoc Online）** 或 **方案2（Typora）**，因为：
- ✅ 完全免费
- ✅ 保留Markdown格式（标题、列表、表格）
- ✅ 无需安装复杂软件
- ✅ 转换质量高

---

**注意**: 转换后的Word文档中，表格可能需要手动调整格式。
