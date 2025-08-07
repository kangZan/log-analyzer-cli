# Log Analyzer CLI

> A powerful CLI tool for analyzing log files with AI-driven error diagnosis and code location capabilities.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2016.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

### 📊 **Multi-format Log Parsing**
- Automatic log format detection (JSON, Spring Boot, Log4j, Apache, etc.)
- Stream processing for large files
- Smart error extraction and stack trace analysis

### 🤖 **AI-Powered Intelligent Analysis**  
- Support for multiple AI providers (OpenAI, Anthropic, Ollama, Custom APIs)
- Intelligent error diagnosis and root cause analysis
- Structured recommendations and code improvement suggestions
- Complete Markdown report generation

### 🎯 **Precise Code Location**
- Source code location based on stack traces
- Multi-language support (Java, JavaScript, Python, C#, etc.)
- Automatic project structure recognition
- Confidence scoring and matching reasons

### 🔧 **Enterprise Features**
- Encrypted configuration management
- Detailed error diagnosis and troubleshooting
- Professional analysis report export
- Multi-mode operation (quick diagnosis/full analysis)

## 🚀 Quick Start

### Installation

```bash
# Global installation
npm install -g log-analyzer-cli

# Or clone the repository for local use
git clone https://github.com/kangZan/log-analyzer-cli.git
cd log-analyzer-cli
npm install
npm run build
```

### Configure AI Service

```bash
# Run configuration wizard
log-analyzer config setup

# Test configuration
log-analyzer config test
```

### Basic Usage

```bash
# Quick log file analysis
log-analyzer analyze app.log

# AI quick diagnosis
log-analyzer analyze app.log --quick-diagnosis

# Full AI analysis
log-analyzer analyze app.log --ai-analysis

# Comprehensive analysis with code location
log-analyzer analyze app.log --ai-analysis --locate-code

# Generate analysis report
log-analyzer analyze app.log --ai-analysis --save-report
```

## 📖 Detailed Usage Guide

### 1. Configuration Management

#### Initialize Configuration
```bash
log-analyzer config setup
```

The system will guide you to select an AI provider and configure parameters:

- **OpenAI**: Requires API key
- **Anthropic**: Requires API key  
- **Ollama**: Local deployment, usually no API key needed
- **Custom**: Supports any compatible API endpoint

#### Configuration Validation
```bash
# Validate configuration
log-analyzer config validate

# Test AI service connection
log-analyzer config test

# Show current configuration
log-analyzer config show

# Reset configuration
log-analyzer config reset
```

### 2. Log Analysis

#### Basic Analysis
```bash
# Analyze specified log file
log-analyzer analyze /path/to/app.log

# Specify encoding format
log-analyzer analyze app.log --encoding utf-8

# Stream processing for large files
log-analyzer analyze large.log --stream
```

#### AI-Powered Analysis
```bash
# Quick AI diagnosis (recommended)
log-analyzer analyze app.log --quick-diagnosis

# Full AI analysis
log-analyzer analyze app.log --ai-analysis

# Limit number of errors to analyze
log-analyzer analyze app.log --ai-analysis --max-errors 3
```

#### Code Location
```bash
# Enable source code location
log-analyzer analyze app.log --locate-code

# Specify project root directory
log-analyzer analyze app.log --locate-code -p /path/to/project

# Comprehensive analysis
log-analyzer analyze app.log --ai-analysis --locate-code
```

#### Report Generation
```bash
# Save analysis report
log-analyzer analyze app.log --ai-analysis --save-report

# Specify report output directory
log-analyzer analyze app.log --ai-analysis --save-report reports/

# Generate report only, no console output
log-analyzer analyze app.log --ai-analysis --save-report --report-only
```

### 3. Supported AI Provider Configuration

#### OpenAI
```
Provider: openai
API URL: https://api.openai.com
Model: gpt-3.5-turbo or gpt-4
API Key: sk-...
```

#### Anthropic Claude
```
Provider: anthropic  
API URL: https://api.anthropic.com
Model: claude-3-sonnet-20240229
API Key: sk-ant-...
```

#### Local Ollama
```
Provider: ollama
API URL: http://localhost:11434
Model: llama2, codellama, qwen, etc.
API Key: (optional)
```

#### Custom API
```
Provider: custom
API URL: https://your-api-endpoint.com
Model: your-model-name
API Key: your-api-key
```

## 📋 Command Reference

### Configuration Commands (`config`)

| Command | Description | Example |
|---------|-------------|---------|
| `setup` | Run configuration wizard | `log-analyzer config setup` |
| `show` | Display current configuration | `log-analyzer config show` |  
| `validate` | Validate configuration | `log-analyzer config validate` |
| `test` | Test AI service connection | `log-analyzer config test` |
| `reset` | Reset configuration | `log-analyzer config reset` |

### Analysis Commands (`analyze`)

| Option | Description | Example |
|--------|-------------|---------|
| `-c, --context <lines>` | Error context lines | `--context 10` |
| `-s, --max-size <mb>` | Max file size limit | `--max-size 200` |
| `-e, --encoding <encoding>` | File encoding | `--encoding utf-8` |
| `--stream` | Stream processing for large files | `--stream` |
| `-p, --project-root <path>` | Project root directory | `-p /path/to/project` |
| `--locate-code` | Enable source code location | `--locate-code` |
| `--ai-analysis` | Full AI analysis | `--ai-analysis` |
| `--quick-diagnosis` | Quick AI diagnosis | `--quick-diagnosis` |
| `--max-errors <number>` | Max errors to analyze | `--max-errors 5` |
| `--save-report [dir]` | Save analysis report | `--save-report reports/` |
| `--report-only` | Generate report only | `--report-only` |

## 🔧 Supported Log Formats

### Auto-detected Formats
- **JSON Logs**: Structured JSON format
- **Spring Boot**: Spring Boot application logs
- **Log4j**: Log4j format Java application logs  
- **Apache Access Logs**: Web server access logs
- **Generic Text Logs**: Other text format logs

### Supported Error Types
- Java exceptions (NullPointerException, IOException, etc.)
- JavaScript errors (TypeError, ReferenceError, etc.)
- Python exceptions (ValueError, AttributeError, etc.)
- C# exceptions (NullReferenceException, ArgumentException, etc.)
- Generic error patterns

## 📊 Sample Analysis Report

Generated Markdown reports include the following sections:

```markdown
# Log Analysis Report

**Analysis File**: `app.log`
**Generated Time**: 2024-01-15 14:30:00
**AI Model**: ollama (qwen2:7b)
**Analysis Duration**: 5247ms
**Confidence**: 89%

## 📊 Error Summary
Found 3 error entries...

## 📍 Code Location Results  
### Location 1
- **File**: `UserController.java`
- **Line**: 45
- **Confidence**: 95%

## 🤖 AI Analysis Results
### 📋 Problem Summary
The main issue is a null pointer exception...

### 🔍 Root Cause
The root cause of the error is...

### 💡 Solution Recommendations
1. Immediate fixes...
2. Short-term improvements...
```

## 🛠️ Development Guide

### Project Structure
```
src/
├── analyzer/          # AI analysis modules
│   ├── providers/     # AI provider adapters
│   ├── AIAnalyzer.ts  # Main analyzer
│   └── MarkdownGenerator.ts # Report generator
├── commands/          # CLI commands
├── config/           # Configuration management
├── locator/          # Code location
├── parser/           # Log parsing
└── types/            # Type definitions
```

### Local Development
```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build project  
npm run build

# Run tests
npm test
```

### Adding New AI Providers

1. Create a provider class extending `BaseAIProvider`
2. Implement required abstract methods
3. Register the new provider in `AIAnalyzer`
4. Update configuration wizard

## ❓ FAQ

### Q: How to handle large log files?
A: Use the `--stream` option to enable stream processing, which can handle GB-level log files.

### Q: What to do when AI analysis returns 405 error?
A: Run `log-analyzer config test` to check connections. The system will provide detailed troubleshooting suggestions.

### Q: Which programming languages are supported for code location?
A: Supports mainstream languages including Java, JavaScript, TypeScript, Python, C#, Go, Rust, etc.

### Q: How to customize analysis templates?
A: Modify templates in `src/analyzer/PromptTemplates.ts` or create custom providers.

### Q: Can generated reports be customized?
A: Yes, modify the `MarkdownGenerator` class to customize report format and content.

## 🤝 Contributing

We welcome contributions of all kinds!

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all AI providers for API support
- Thanks to the open source community for contributions
- Special thanks to Claude AI for assistance during development

## 📞 Support & Feedback

- 🐛 [Report Issues](https://github.com/your-username/log-analyzer-cli/issues)
- 💡 [Feature Requests](https://github.com/your-username/log-analyzer-cli/issues)
- 📧 Contact us: your-email@example.com

---

⭐ If this project helps you, please give it a Star!

## 🌐 Language

- [中文文档](README_CN.md)
- [English](README.md)