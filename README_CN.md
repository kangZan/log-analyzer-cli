# 日志分析器 CLI

> 一个功能强大的CLI工具，用于分析日志文件并提供AI驱动的错误诊断和代码定位功能。

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 功能特色

### 📊 **多格式日志解析**
- 自动识别日志格式（JSON、Spring Boot、Log4j、Apache等）
- 支持大文件流式处理
- 智能错误提取和堆栈跟踪分析

### 🤖 **AI驱动的智能分析**  
- 支持多种AI提供商（OpenAI、Anthropic、Ollama、自定义API）
- 智能错误诊断和根本原因分析
- 结构化解决建议和代码改进建议
- 完整的Markdown报告生成

### 🎯 **精确代码定位**
- 基于堆栈跟踪的源码定位
- 支持多种编程语言（Java、JavaScript、Python、C#等）
- 项目结构自动识别
- 置信度评分和匹配原因

### 🔧 **企业级功能**
- 加密配置管理
- 详细的错误诊断和故障排除
- 专业的分析报告导出
- 多模式操作（快速诊断/完整分析）

## 🚀 快速开始

### 安装

```bash
# 全局安装
npm install -g log-analyzer-cli

# 或者克隆仓库本地使用
git clone https://github.com/kangZan/log-analyzer-cli.git
cd log-analyzer-cli
npm install
npm run build
```

### 配置AI服务

```bash
# 运行配置向导
log-analyzer config setup

# 测试配置
log-analyzer config test
```

### 基本使用

```bash
# 快速分析日志文件
log-analyzer analyze app.log

# AI快速诊断
log-analyzer analyze app.log --quick-diagnosis

# 完整AI分析
log-analyzer analyze app.log --ai-analysis

# 带代码定位的综合分析
log-analyzer analyze app.log --ai-analysis --locate-code

# 生成分析报告
log-analyzer analyze app.log --ai-analysis --save-report
```

## 📖 详细使用指南

### 1. 配置管理

#### 初始化配置
```bash
log-analyzer config setup
```

系统将引导您选择AI提供商并配置相关参数：

- **OpenAI**: 需要API密钥
- **Anthropic**: 需要API密钥  
- **Ollama**: 本地部署，通常无需API密钥
- **自定义**: 支持任何兼容的API端点

#### 配置验证
```bash
# 验证配置有效性
log-analyzer config validate

# 测试AI服务连接
log-analyzer config test

# 查看当前配置
log-analyzer config show

# 重置配置
log-analyzer config reset
```

### 2. 日志分析

#### 基础分析
```bash
# 分析指定日志文件
log-analyzer analyze /path/to/app.log

# 指定编码格式
log-analyzer analyze app.log --encoding utf-8

# 流式处理大文件
log-analyzer analyze large.log --stream
```

#### AI智能分析
```bash
# 快速AI诊断（推荐）
log-analyzer analyze app.log --quick-diagnosis

# 完整AI分析
log-analyzer analyze app.log --ai-analysis

# 限制分析的错误数量
log-analyzer analyze app.log --ai-analysis --max-errors 3
```

#### 代码定位
```bash
# 启用源码定位
log-analyzer analyze app.log --locate-code

# 指定项目根目录
log-analyzer analyze app.log --locate-code -p /path/to/project

# 综合分析
log-analyzer analyze app.log --ai-analysis --locate-code
```

#### 报告生成
```bash
# 保存分析报告
log-analyzer analyze app.log --ai-analysis --save-report

# 指定报告输出目录
log-analyzer analyze app.log --ai-analysis --save-report reports/

# 只生成报告，不显示控制台输出
log-analyzer analyze app.log --ai-analysis --save-report --report-only
```

### 3. 支持的AI提供商配置

#### OpenAI
```
提供商: openai
API地址: https://api.openai.com
模型: gpt-3.5-turbo 或 gpt-4
API密钥: sk-...
```

#### Anthropic Claude
```
提供商: anthropic  
API地址: https://api.anthropic.com
模型: claude-3-sonnet-20240229
API密钥: sk-ant-...
```

#### 本地Ollama
```
提供商: ollama
API地址: http://localhost:11434
模型: llama2, codellama, qwen等
API密钥: (可选)
```

#### 自定义API
```
提供商: custom
API地址: https://your-api-endpoint.com
模型: your-model-name
API密钥: your-api-key
```

## 📋 命令参考

### 配置命令 (`config`)

| 命令 | 描述 | 示例 |
|------|------|------|
| `setup` | 运行配置向导 | `log-analyzer config setup` |
| `show` | 显示当前配置 | `log-analyzer config show` |  
| `validate` | 验证配置有效性 | `log-analyzer config validate` |
| `test` | 测试AI服务连接 | `log-analyzer config test` |
| `reset` | 重置配置 | `log-analyzer config reset` |

### 分析命令 (`analyze`)

| 选项 | 描述 | 示例 |
|------|------|------|
| `-c, --context <lines>` | 错误上下文行数 | `--context 10` |
| `-s, --max-size <mb>` | 最大文件大小限制 | `--max-size 200` |
| `-e, --encoding <encoding>` | 文件编码 | `--encoding utf-8` |
| `--stream` | 流式处理大文件 | `--stream` |
| `-p, --project-root <path>` | 项目根目录 | `-p /path/to/project` |
| `--locate-code` | 启用源码定位 | `--locate-code` |
| `--ai-analysis` | 完整AI分析 | `--ai-analysis` |
| `--quick-diagnosis` | 快速AI诊断 | `--quick-diagnosis` |
| `--max-errors <number>` | 最大分析错误数 | `--max-errors 5` |
| `--save-report [dir]` | 保存分析报告 | `--save-report reports/` |
| `--report-only` | 仅生成报告 | `--report-only` |

## 🔧 支持的日志格式

### 自动检测的格式
- **JSON日志**: 结构化JSON格式
- **Spring Boot**: Spring Boot应用日志
- **Log4j**: Log4j格式的Java应用日志  
- **Apache访问日志**: Web服务器访问日志
- **通用文本日志**: 其他格式的文本日志

### 支持的错误类型
- Java异常（NullPointerException、IOException等）
- JavaScript错误（TypeError、ReferenceError等）
- Python异常（ValueError、AttributeError等）
- C#异常（NullReferenceException、ArgumentException等）
- 通用错误模式

## 📊 分析报告示例

生成的Markdown报告包含以下章节：

```markdown
# 日志分析报告

**分析文件**: `app.log`
**生成时间**: 2024-01-15 14:30:00
**AI模型**: ollama (qwen2:7b)
**分析时长**: 5247ms
**置信度**: 89%

## 📊 错误摘要
发现 3 个错误条目...

## 📍 代码定位结果  
### 位置 1
- **文件**: `UserController.java`
- **行号**: 45
- **置信度**: 95%

## 🤖 AI分析结果
### 📋 问题摘要
主要问题是空指针异常...

### 🔍 根本原因
错误发生的根本原因是...

### 💡 解决建议
1. 立即修复措施...
2. 短期改进建议...
```

## 🛠️ 开发指南

### 项目结构
```
src/
├── analyzer/          # AI分析模块
│   ├── providers/     # AI提供商适配器
│   ├── AIAnalyzer.ts  # 主分析器
│   └── MarkdownGenerator.ts # 报告生成器
├── commands/          # CLI命令
├── config/           # 配置管理
├── locator/          # 代码定位
├── parser/           # 日志解析
└── types/            # 类型定义
```

### 本地开发
```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建项目  
npm run build

# 运行测试
npm test
```

### 添加新的AI提供商

1. 创建提供商类继承`BaseAIProvider`
2. 实现必要的抽象方法
3. 在`AIAnalyzer`中注册新提供商
4. 更新配置向导

## ❓ 常见问题

### Q: 如何处理大型日志文件？
A: 使用`--stream`选项启用流式处理，可以处理GB级别的日志文件。

### Q: AI分析返回405错误怎么办？
A: 运行`log-analyzer config test`检查连接，系统会提供详细的故障排除建议。

### Q: 支持哪些编程语言的代码定位？
A: 支持Java、JavaScript、TypeScript、Python、C#、Go、Rust等主流语言。

### Q: 如何自定义分析模板？
A: 修改`src/analyzer/PromptTemplates.ts`中的模板或创建自定义提供商。

### Q: 生成的报告可以自定义格式吗？
A: 可以修改`MarkdownGenerator`类来自定义报告格式和内容。

## 🤝 贡献指南

我们欢迎各种形式的贡献！

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- 感谢所有AI提供商的API支持
- 感谢开源社区的贡献
- 特别感谢Claude AI在开发过程中的协助

## 📞 支持与反馈

- 🐛 [报告问题](https://github.com/your-username/log-analyzer-cli/issues)
- 💡 [功能建议](https://github.com/your-username/log-analyzer-cli/issues)
- 📧 联系我们: your-email@example.com

---

⭐ 如果这个项目对您有帮助，请给它一个Star！