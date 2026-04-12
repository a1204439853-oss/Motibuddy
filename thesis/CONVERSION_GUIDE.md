# 论文转换为Word文档指南

## 现状

您的论文已完成撰写，包含：
- 9个完整章节（约12,000词）
- 65篇学术参考文献
- LaTeX格式源代码

## 推荐的转换方案

### 方案1：使用Overleaf（推荐）⭐

Overleaf是在线LaTeX编辑器，支持直接导出为Word格式：

1. 访问 https://www.overleaf.com
2. 注册/登录账号
3. 创建新项目 → 上传项目
4. 上传以下文件：
   - `main.tex`
   - `references.bib`
   - `chapters/` 目录下的所有 `.tex` 文件
5. 编译项目确保无误
6. 点击菜单 → 下载 → Microsoft Word (.docx)

**优点**：保留格式、自动处理引用、免费使用

### 方案2：使用Pandoc（本地转换）

Pandoc是强大的文档转换工具：

1. 安装Pandoc：
   ```powershell
   winget install --id JohnMacFarlane.Pandoc
   ```

2. 重启终端后执行：
   ```powershell
   cd f:\MotiBuddy1\thesis
   pandoc main.tex -o thesis.docx --bibliography=references.bib --citeproc
   ```

**优点**：本地处理、批量转换、可自定义样式

### 方案3：在线转换工具

使用在线LaTeX到Word转换器：

1. **TeX2Word**: https://www.tex2word.com/
2. **Pandoc Online**: https://pandoc.org/try/
3. **CloudConvert**: https://cloudconvert.com/tex-to-docx

步骤：
1. 将所有.tex文件内容合并（或逐个转换）
2. 上传到转换网站
3. 下载生成的.docx文件

### 方案4：手动复制（最可靠）

1. 打开每个 `.tex` 文件
2. 复制文本内容（不包括LaTeX命令）
3. 粘贴到Word文档
4. 手动应用格式（标题、段落等）
5. 添加参考文献

## 文件位置

所有论文源文件位于：
```
f:\MotiBuddy1\thesis\
├── main.tex                    # 主文档（第1章、摘要、致谢）
├── references.bib              # 65篇参考文献
├── chapters\
│   ├── chapter2_literature_review.tex    # 第2章：文献综述
│   ├── chapter3_methodology.tex          # 第3章：研究方法
│   ├── chapter4_technical_design.tex     # 第4章：技术设计
│   ├── chapter5_implementation.tex       # 第5章：实现
│   ├── chapter6_testing.tex              # 第6章：测试
│   ├── chapter7_results.tex              # 第7章：结果
│   ├── chapter8_discussion.tex           # 第8章：讨论
│   └── chapter9_conclusion.tex           # 第9章：结论
```

## 需要填写的个人信息

转换后，请在Word文档中替换以下占位符：
- `[Author Name]` → 您的姓名
- `[Student ID]` → 学号
- `[Supervisor Name]` → 导师姓名
- `[Department/Institution]` → 院系/学校
- `[Degree Name]` → 学位名称
- `[Month, Year]` → 提交日期

## 格式建议

转换为Word后，建议检查以下格式：

1. **字体**：Times New Roman 12pt
2. **行距**：1.5倍行距
3. **页边距**：上下2.5cm，左右3cm
4. **标题格式**：
   - 一级标题：14pt 粗体
   - 二级标题：12pt 粗体
   - 三级标题：12pt 斜体
5. **参考文献**：APA格式

## 下一步操作

我强烈推荐使用 **方案1（Overleaf）**，因为：
- ✅ 完全免费
- ✅ 保留学术格式
- ✅ 自动处理引用
- ✅ 无需安装软件
- ✅ 支持协作编辑

如果您需要，我可以帮您：
1. 准备上传到Overleaf的压缩包
2. 创建简化的Word模板
3. 提取纯文本版本便于复制

请告诉我您希望采用哪种方案！
