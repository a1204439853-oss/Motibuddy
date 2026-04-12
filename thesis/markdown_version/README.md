# MotiBuddy Thesis - Markdown Version

## 文件说明

此目录包含论文的Markdown格式版本，便于查看、编辑和转换为其他格式（如Word）。

## 论文信息

- **标题**: Design and Implementation of a Gamified Task Management Application Integrating Virtual Pet Nurturing and Intelligent Interaction
- **总字数**: 约12,000词
- **章节数**: 9章 + 摘要 + 参考文献
- **参考文献**: 65篇

## 文件列表

- `MotiBuddy_Thesis_Complete.md` - 完整论文（所有章节合并）
- `chapter1.md` - 第1章：引言
- `chapter2.md` - 第2章：文献综述
- `chapter3.md` - 第3章：研究方法
- `chapter4.md` - 第4章：技术设计
- `chapter5.md` - 第5章：实现
- `chapter6.md` - 第6章：测试
- `chapter7.md` - 第7章：结果
- `chapter8.md` - 第8章：讨论
- `chapter9.md` - 第9章：结论
- `references.md` - 参考文献列表

## 如何转换为Word

### 方法1：使用Pandoc（推荐）
```bash
pandoc MotiBuddy_Thesis_Complete.md -o thesis.docx
```

### 方法2：使用VS Code插件
1. 安装 "Markdown to Word" 插件
2. 右键点击Markdown文件
3. 选择 "Export to Word"

### 方法3：在线转换
1. 访问 https://pandoc.org/try/
2. 粘贴Markdown内容
3. 选择输出格式为DOCX

### 方法4：手动复制
1. 在Markdown预览中查看
2. 复制内容到Word
3. 应用格式：Times New Roman 12pt, 1.5倍行距

## 格式说明

- 标题使用Markdown标题语法（# ## ###）
- 引用使用APA格式（作者, 年份）
- 表格使用Markdown表格语法
- 代码块使用```包裹

## 注意事项

1. 请替换所有占位符：
   - `[Author Name]` → 您的姓名
   - `[Supervisor Name]` → 导师姓名
   - `[Student ID]` → 学号
   - `[Department/Institution]` → 院系/学校
   - `[Degree Name]` → 学位名称
   - `[Month, Year]` → 提交日期

2. 图表需要手动添加（Markdown中标记为[Figure X]）

3. 参考文献在转换后需要检查格式

---

**生成日期**: 2026年3月4日
