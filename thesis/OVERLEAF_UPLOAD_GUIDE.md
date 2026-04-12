# Overleaf 上传指南

## ✅ 文件包已准备完成！

压缩包位置：`f:\MotiBuddy1\thesis\MotiBuddy_Thesis_Overleaf.zip`

## 📦 包含的文件

```
MotiBuddy_Thesis_Overleaf.zip
├── main.tex              # 主文档（包含标题页、摘要、致谢、目录）
├── chapter1.tex          # 第1章：引言
├── chapter2.tex          # 第2章：文献综述
├── chapter3.tex          # 第3章：研究方法
├── chapter4.tex          # 第4章：技术设计
├── chapter5.tex          # 第5章：实现
├── chapter6.tex          # 第6章：测试
├── chapter7.tex          # 第7章：结果
├── chapter8.tex          # 第8章：讨论
├── chapter9.tex          # 第9章：结论
└── references.bib        # 65篇参考文献
```

## 🚀 上传到Overleaf的步骤

### 步骤1：访问Overleaf
1. 打开浏览器，访问 https://www.overleaf.com
2. 注册或登录您的账号

### 步骤2：创建新项目
1. 点击左上角的 **"New Project"**
2. 选择 **"Upload Project"**
3. 点击 **"Select a .zip file"**
4. 选择 `MotiBuddy_Thesis_Overleaf.zip` 文件
5. 等待上传完成

### 步骤3：编译项目
1. 上传完成后，Overleaf会自动打开项目
2. 点击 **"Recompile"** 按钮（或按 Ctrl+Enter）
3. 等待编译完成，查看生成的PDF

### 步骤4：填写个人信息
在 `main.tex` 文件中，替换以下占位符：
- `[Author Name]` → 您的姓名
- `[Student ID]` → 学号
- `[Supervisor Name]` → 导师姓名
- `[Department/Institution]` → 院系/学校名称
- `[Degree Name]` → 学位名称（如 Bachelor of Science）
- `[Month, Year]` → 提交日期（如 March 2026）

### 步骤5：导出为Word
1. 点击左上角的 **"Menu"**
2. 在 "Download" 部分，选择 **"Source"** 下载LaTeX源文件（可选）
3. 或使用第三方工具将LaTeX转换为Word

## 📝 替代方案：直接复制粘贴到Word

如果您想直接获得Word文档，可以：

### 方法1：使用Overleaf的Word导出功能
1. 在Overleaf中打开项目
2. 点击 **"Menu"**
3. 选择 **"Word (.docx)"** 导出（需要付费订阅）

### 方法2：使用在线转换工具
1. 在Overleaf中下载PDF
2. 使用在线PDF转Word工具（如 ilovepdf.com）

### 方法3：手动复制（推荐，格式最准确）
1. 在Overleaf中查看PDF
2. 逐章复制文本内容
3. 粘贴到Word文档
4. 应用格式（Times New Roman 12pt, 1.5倍行距）

## 🔧 常见问题

### Q: 编译出现错误怎么办？
A: 检查以下几点：
- 确保所有文件都正确上传
- 检查 `main.tex` 中的文件引用路径
- 查看错误信息，通常是缺少某个包或文件

### Q: 参考文献不显示怎么办？
A: 
1. 确保 `references.bib` 文件已上传
2. 在Overleaf中，编译顺序应为：
   - PdfLaTeX → BibTeX → PdfLaTeX → PdfLaTeX
3. 或点击 **"Recompile from scratch"**

### Q: 如何添加图片？
A:
1. 在Overleaf项目中创建 `figures` 文件夹
2. 上传图片文件
3. 在LaTeX中使用 `\includegraphics{figures/filename.png}`

### Q: 如何修改格式？
A:
- 字体大小：修改 `\documentclass[12pt]` 中的数字
- 页边距：修改 `\geometry{margin=2.5cm}`
- 行距：修改 `\onehalfspacing`

## 📊 论文字数统计

| 章节 | 字数 |
|------|------|
| Abstract | ~300 |
| Chapter 1 | ~1,200 |
| Chapter 2 | ~2,200 |
| Chapter 3 | ~1,500 |
| Chapter 4 | ~2,000 |
| Chapter 5 | ~1,500 |
| Chapter 6 | ~1,000 |
| Chapter 7 | ~1,200 |
| Chapter 8 | ~1,000 |
| Chapter 9 | ~500 |
| **总计** | **~12,000** |

## ✅ 检查清单

上传前请确认：
- [ ] 压缩包 `MotiBuddy_Thesis_Overleaf.zip` 已创建
- [ ] 所有10个 `.tex` 文件和1个 `.bib` 文件都在压缩包中
- [ ] 已准备好填写个人信息
- [ ] 已注册Overleaf账号

## 📞 需要帮助？

如果遇到问题：
1. 检查Overleaf的编译日志
2. 查看错误提示信息
3. 确保所有文件编码为UTF-8
4. 尝试重新上传项目

---

**祝您上传顺利！** 🎉
