import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import * as path from 'path';
import { ConfigManager } from '../config/ConfigManager';
import { LogParser } from '../parser/LogParser';
import { CodeLocator } from '../locator/CodeLocator';
import { AIAnalyzer } from '../analyzer/AIAnalyzer';
import { MarkdownGenerator } from '../analyzer/MarkdownGenerator';
import { AIProvider, AIFeature } from '../types/analysis';

export function createAnalyzeCommand(): Command {
  const analyzeCommand = new Command('analyze');
  analyzeCommand.description('分析日志文件');

  analyzeCommand
    .argument('[logfile]', '日志文件路径')
    .option('-c, --context <lines>', '错误日志上下文行数', '5')
    .option('-s, --max-size <mb>', '最大文件大小限制(MB)', '100')
    .option('-e, --encoding <encoding>', '文件编码', 'utf-8')
    .option('--stream', '使用流式处理大文件')
    .option('-p, --project-root <path>', '项目根目录路径')
    .option('--locate-code', '启用源码定位功能')
    .option('--no-index', '不使用项目索引，直接搜索文件')
    .option('--ai-analysis', '启用AI分析功能')
    .option('--quick-diagnosis', '快速AI诊断模式')
    .option('--max-errors <number>', '最大分析错误数量', '5')
    .option('--save-report [dir]', '保存AI分析报告为markdown文件（可指定输出目录）')
    .option('--report-only', '只生成分析报告，不在控制台显示详细结果')
    .action(async (logfile, options) => {
      try {
        // 检查配置
        const configManager = new ConfigManager();
        const config = await configManager.loadConfig();
        
        if (!config) {
          console.log(chalk.yellow('❌ 未找到配置，请先运行配置向导:'));
          console.log(chalk.cyan('  log-analyzer config setup'));
          process.exit(1);
        }

        const validation = configManager.validateConfig(config);
        if (!validation.isValid) {
          console.log(chalk.red('❌ 配置无效，请重新配置:'));
          validation.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
          console.log(chalk.cyan('\n请运行: log-analyzer config setup'));
          process.exit(1);
        }

        // 获取日志文件路径
        let targetLogFile = logfile;
        if (!targetLogFile) {
          const { filePath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'filePath',
              message: '请输入日志文件路径:',
              validate: (input: string) => {
                if (!input || input.trim() === '') {
                  return '日志文件路径不能为空';
                }
                return true;
              }
            }
          ]);
          targetLogFile = filePath;
        }

        // 解析选项
        const parseOptions = {
          contextLines: parseInt(options.context),
          maxFileSize: parseInt(options.maxSize),
          encoding: options.encoding
        };

        console.log(chalk.blue('\n📂 开始分析日志文件...'));
        console.log(chalk.gray(`文件路径: ${targetLogFile}`));

        // 创建日志解析器
        const parser = new LogParser(parseOptions);
        
        // 显示文件信息
        const spinner = ora('读取文件信息...').start();
        try {
          const fileInfo = await parser.getFileInfo(targetLogFile);
          spinner.succeed(chalk.green('文件信息获取完成'));
          
          console.log(chalk.cyan('\n📊 文件信息:'));
          console.log(`  大小: ${fileInfo.sizeMB} MB (${fileInfo.size.toLocaleString()} 字节)`);
          console.log(`  扩展名: ${fileInfo.extension || '无'}`);
          console.log(`  修改时间: ${fileInfo.modified.toLocaleString()}`);
          
          if (fileInfo.sizeMB > 50 && !options.stream) {
            const { useStream } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'useStream',
                message: '文件较大，是否使用流式处理？(推荐)',
                default: true
              }
            ]);
            
            if (useStream) {
              options.stream = true;
            }
          }
        } catch (error: any) {
          spinner.fail(chalk.red(`获取文件信息失败: ${error.message}`));
          process.exit(1);
        }

        // 解析日志文件
        const parseSpinner = ora('解析日志文件...').start();
        let result;

        try {
          if (options.stream) {
            result = await parser.parseLogFileStream(targetLogFile, (processed, total, errors) => {
              const totalText = total > 0 ? `/${total}` : '';
              parseSpinner.text = `解析中... ${processed}${totalText} 行 (发现 ${errors.length} 个错误)`;
            });
          } else {
            result = await parser.parseLogFile(targetLogFile);
          }
          
          parseSpinner.succeed(chalk.green('日志解析完成'));
        } catch (error: any) {
          parseSpinner.fail(chalk.red(`解析失败: ${error.message}`));
          process.exit(1);
        }

        // 显示解析结果
        console.log(chalk.blue('\n📈 解析结果:'));
        console.log(`  总行数: ${chalk.yellow(result.totalLines.toLocaleString())}`);
        console.log(`  有效日志条目: ${chalk.yellow(result.entries.length.toLocaleString())}`);
        console.log(`  检测到的格式: ${chalk.cyan(result.format.toUpperCase())}`);
        console.log(`  错误条目数: ${chalk.red(result.errorEntries.length.toLocaleString())}`);
        
        if (result.parseErrors.length > 0) {
          console.log(`  解析错误: ${chalk.yellow(result.parseErrors.length)} 行`);
        }

        if (result.errorEntries.length === 0) {
          console.log(chalk.green('\n✅ 未发现错误日志，文件看起来正常！'));
          return;
        }

        // 显示错误摘要
        console.log(chalk.red('\n🚨 发现的错误:'));
        result.errorEntries.slice(0, 10).forEach((error, index) => {
          console.log(chalk.red(`\n${index + 1}. 行 ${error.lineNumber}:`));
          console.log(`   ${chalk.gray('级别:')} ${error.level}`);
          if (error.errorType) {
            console.log(`   ${chalk.gray('类型:')} ${error.errorType}`);
          }
          console.log(`   ${chalk.gray('消息:')} ${error.message.substring(0, 100)}${error.message.length > 100 ? '...' : ''}`);
          
          if (error.stackTrace && error.stackTrace.length > 0) {
            console.log(`   ${chalk.gray('堆栈:')} ${error.stackTrace.length} 层`);
            console.log(`   ${chalk.gray('首层:')} ${error.stackTrace[0].methodName || error.stackTrace[0].fileName}`);
          }
        });

        if (result.errorEntries.length > 10) {
          console.log(chalk.gray(`\n... 还有 ${result.errorEntries.length - 10} 个错误未显示`));
        }

        // 代码定位功能
        let codeLocator: CodeLocator | undefined;
        let projectRoot: string | null = null;
        let locationResults: Map<any, any> | undefined;

        if (options.locateCode && result.errorEntries.length > 0) {
          console.log(chalk.blue('\n🎯 开始代码定位...'));
          
          codeLocator = new CodeLocator();
          projectRoot = options.projectRoot;
          
          if (!projectRoot) {
            projectRoot = await codeLocator.autoDetectProjectRoot(targetLogFile);
          } else {
            await codeLocator.initialize(projectRoot);
          }

          if (projectRoot) {
            const locateSpinner = ora('分析错误源码位置...').start();
            
            try {
              // 只定位前5个错误，避免过长的处理时间
              const errorsToLocate = result.errorEntries.slice(0, 5);
              locationResults = await codeLocator.locateErrorSources(errorsToLocate, {
                maxResults: 3,
                fuzzyMatch: true,
                caseSensitive: false
              });

              locateSpinner.succeed(chalk.green('源码定位完成'));

              // 显示定位结果
              console.log(chalk.blue('\n📍 源码定位结果:'));
              
              let locationFound = false;
              for (const [error, locationResult] of locationResults.entries()) {
                if (locationResult.locations.length > 0) {
                  locationFound = true;
                  console.log(chalk.red(`\n错误 (行 ${error.lineNumber}):`));
                  
                  locationResult.locations.slice(0, 2).forEach((location: any, index: number) => {
                    const relativePath = path.relative(projectRoot!, location.filePath);
                    console.log(`  ${index + 1}. ${chalk.cyan(relativePath)}${location.lineNumber ? `:${location.lineNumber}` : ''}`);
                    console.log(`     ${chalk.gray('置信度:')} ${(location.confidence * 100).toFixed(0)}%`);
                    console.log(`     ${chalk.gray('匹配原因:')} ${location.matchReason}`);
                  });

                  if (locationResult.relatedFiles.length > 0) {
                    console.log(`     ${chalk.gray('相关文件:')} ${locationResult.relatedFiles.length} 个`);
                  }
                }
              }

              if (!locationFound) {
                console.log(chalk.yellow('  未找到匹配的源码位置'));
              }

              // 显示项目统计
              const stats = codeLocator.getProjectStats();
              console.log(chalk.blue(`\n📊 项目统计:`));
              console.log(`  总文件数: ${chalk.yellow(stats.totalFiles)}`);
              console.log(`  支持的语言:`);
              for (const [lang, count] of Object.entries(stats.languages)) {
                console.log(`    ${lang}: ${count} 文件`);
              }
              
            } catch (error: any) {
              locateSpinner.fail(chalk.red(`代码定位失败: ${error.message}`));
            }
          } else {
            console.log(chalk.yellow('⚠️  未找到项目根目录，跳过代码定位'));
          }
        } else if (result.errorEntries.length > 0) {
          console.log(chalk.cyan('\n💡 提示: 使用 --locate-code 参数启用源码定位功能'));
        }

        // AI分析功能
        if (options.aiAnalysis && result.errorEntries.length > 0) {
          await performAIAnalysis(
            targetLogFile,
            result.errorEntries,
            locationResults ? Array.from(locationResults.values()).flatMap(r => r.locations) : [],
            projectRoot,
            config,
            options
          );
        } else if (options.quickDiagnosis && result.errorEntries.length > 0) {
          await performQuickDiagnosis(result.errorEntries.slice(0, 3), config);
        } else if (result.errorEntries.length > 0) {
          console.log(chalk.cyan('\n💡 提示:'));
          console.log('  --ai-analysis     完整AI分析（需要更多token）');
          console.log('  --quick-diagnosis 快速AI诊断（推荐）');
        }
        
      } catch (error: any) {
        console.error(chalk.red(`分析失败: ${error.message}`));
        process.exit(1);
      }
    });

  return analyzeCommand;
}

// AI分析辅助函数
async function performAIAnalysis(
  logFilePath: string,
  errorEntries: any[],
  codeLocations: any[],
  projectRoot: string | null,
  config: any,
  options: any
): Promise<void> {
  const aiSpinner = ora('准备AI分析...').start();

  try {
    // 创建AI提供商配置
    const aiProvider: AIProvider = {
      name: config.ai.provider,
      type: config.ai.provider as any,
      apiUrl: config.ai.apiUrl,
      apiKey: config.ai.apiKey,
      modelId: config.ai.modelId,
      maxTokens: config.ai.maxTokens || 4000,
      temperature: config.ai.temperature || 0.3,
      supportedFeatures: [AIFeature.CHAT_COMPLETION, AIFeature.CODE_ANALYSIS]
    };

    const analyzer = new AIAnalyzer(aiProvider);

    // 首先检查网络连接
    aiSpinner.text = '检查网络连接...';
    const provider = (analyzer as any).provider;
    if (provider && typeof provider.checkNetworkConnectivity === 'function') {
      const networkCheck = await provider.checkNetworkConnectivity();
      if (!networkCheck.success) {
        aiSpinner.fail(chalk.red(`网络连接失败: ${networkCheck.error}`));
        
        // 提供详细的故障排除建议
        console.log(chalk.yellow('\n🔧 故障排除建议:'));
        console.log(chalk.cyan('  1. 检查网络连接是否正常'));
        console.log(chalk.cyan('  2. 确认API地址是否可访问:'));
        console.log(`     ${config.ai.apiUrl}`);
        console.log(chalk.cyan('  3. 如果是内网地址，确认VPN或内网连接'));
        console.log(chalk.cyan('  4. 尝试在浏览器中访问该地址'));
        console.log(chalk.cyan('  5. 联系API服务提供商确认服务状态'));
        
        // 建议使用其他功能
        console.log(chalk.yellow('\n💡 替代方案:'));
        console.log(chalk.cyan('  • 网络恢复后重试'));
        console.log(chalk.cyan('  • 检查服务器是否正常运行'));
        return;
      }
    }

    aiSpinner.text = '测试AI连接...';
    const connectionOk = await analyzer.testConnection();
    
    if (!connectionOk) {
      aiSpinner.fail(chalk.red('AI服务连接失败'));
      console.log(chalk.yellow('提示: 如果快速诊断功能正常，您仍可以使用 --quick-diagnosis 参数'));
      return;
    }

    aiSpinner.text = '正在进行AI分析...';
    
    const maxErrors = parseInt(options.maxErrors) || 5;
    const analysisResult = await analyzer.analyzeErrors(
      errorEntries,
      codeLocations,
      projectRoot || undefined,
      { maxErrors }
    );

    aiSpinner.succeed(chalk.green('AI分析完成'));

    // 显示分析结果（如果不是只生成报告模式）
    if (!options.reportOnly) {
      displayAnalysisResult(analysisResult, analyzer.getProviderInfo());
    }

    // 保存分析报告
    if (options.saveReport !== undefined) {
      const saveSpinner = ora('保存分析报告...').start();
      
      try {
        const outputDir = typeof options.saveReport === 'string' ? options.saveReport : undefined;
        const reportPath = await MarkdownGenerator.saveReport(
          logFilePath,
          analysisResult,
          errorEntries,
          codeLocations,
          analyzer.getProviderInfo(),
          outputDir
        );
        
        saveSpinner.succeed(chalk.green(`分析报告已保存: ${reportPath}`));
        
        if (options.reportOnly) {
          console.log(chalk.blue('\n📄 分析报告生成完成'));
          console.log(chalk.gray(`文件位置: ${reportPath}`));
          console.log(chalk.gray(`文件大小: ${(await require('fs-extra').stat(reportPath)).size} 字节`));
        }
      } catch (error: any) {
        saveSpinner.fail(chalk.red(`保存报告失败: ${error.message}`));
      }
    }

  } catch (error: any) {
    aiSpinner.fail(chalk.red(`AI分析失败: ${error.message}`));
  }
}

async function performQuickDiagnosis(errorEntries: any[], config: any): Promise<void> {
  const diagnosisSpinner = ora('进行快速AI诊断...').start();

  try {
    const aiProvider: AIProvider = {
      name: config.ai.provider,
      type: config.ai.provider as any,
      apiUrl: config.ai.apiUrl,
      apiKey: config.ai.apiKey,
      modelId: config.ai.modelId,
      maxTokens: config.ai.maxTokens || 2000,
      temperature: config.ai.temperature || 0.2,
      supportedFeatures: [AIFeature.CHAT_COMPLETION]
    };

    const analyzer = new AIAnalyzer(aiProvider);

    // 首先检查网络连接
    diagnosisSpinner.text = '检查网络连接...';
    const provider = (analyzer as any).provider;
    if (provider && typeof provider.checkNetworkConnectivity === 'function') {
      const networkCheck = await provider.checkNetworkConnectivity();
      if (!networkCheck.success) {
        diagnosisSpinner.fail(chalk.red(`网络连接失败: ${networkCheck.error}`));
        
        // 提供详细的故障排除建议
        console.log(chalk.yellow('\n🔧 故障排除建议:'));
        console.log(chalk.cyan('  1. 检查网络连接是否正常'));
        console.log(chalk.cyan('  2. 确认API地址是否可访问:'));
        console.log(`     ${config.ai.apiUrl}`);
        console.log(chalk.cyan('  3. 如果是内网地址，确认VPN或内网连接'));
        console.log(chalk.cyan('  4. 尝试在浏览器中访问该地址'));
        console.log(chalk.cyan('  5. 联系API服务提供商确认服务状态'));
        return;
      }
    }

    for (let i = 0; i < Math.min(errorEntries.length, 3); i++) {
      const error = errorEntries[i];
      diagnosisSpinner.text = `诊断错误 ${i + 1}/${Math.min(errorEntries.length, 3)}...`;

      const diagnosis = await analyzer.quickDiagnosis(
        error.message,
        { language: 'Java', framework: 'Spring Boot' }
      );

      if (i === 0) {
        diagnosisSpinner.succeed(chalk.green('快速诊断完成'));
      }

      console.log(chalk.blue(`\n🔍 错误 ${i + 1} 诊断 (行 ${error.lineNumber}):`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(diagnosis);
      console.log(chalk.gray('─'.repeat(50)));
    }

  } catch (error: any) {
    diagnosisSpinner.fail(chalk.red(`快速诊断失败: ${error.message}`));
  }
}

function displayAnalysisResult(result: any, providerInfo: any): void {
  console.log(chalk.blue('\n🤖 AI分析报告'));
  console.log(chalk.gray(`模型: ${providerInfo.name} (${providerInfo.model})`));
  console.log(chalk.gray(`分析时间: ${result.analysisTime}ms | 置信度: ${(result.confidence * 100).toFixed(0)}%`));
  console.log(chalk.gray('═'.repeat(60)));

  // 问题摘要
  if (result.summary) {
    console.log(chalk.yellow('\n📋 问题摘要:'));
    console.log(result.summary);
  }

  // 根本原因
  if (result.rootCause) {
    console.log(chalk.red('\n🔍 根本原因:'));
    console.log(result.rootCause);
  }

  // 错误分析
  if (result.errorAnalysis && result.errorAnalysis.length > 0) {
    console.log(chalk.magenta('\n📊 详细错误分析:'));
    result.errorAnalysis.forEach((analysis: any, index: number) => {
      console.log(chalk.cyan(`\n${index + 1}. ${analysis.errorType} (${analysis.severity})`));
      console.log(`   ${analysis.description}`);
      if (analysis.likelyCause) {
        console.log(chalk.dim(`   原因: ${analysis.likelyCause}`));
      }
    });
  }

  // 解决建议
  if (result.recommendations && result.recommendations.length > 0) {
    console.log(chalk.green('\n💡 解决建议:'));
    result.recommendations.forEach((rec: any, index: number) => {
      const typeIcon = rec.type === 'immediate' ? '🚨' : rec.type === 'short-term' ? '⏱️' : '🔮';
      console.log(chalk.green(`\n${typeIcon} ${index + 1}. ${rec.title}`));
      console.log(`   ${rec.description}`);
      
      if (rec.actionItems && rec.actionItems.length > 0) {
        console.log(chalk.dim('   行动项:'));
        rec.actionItems.forEach((item: string) => {
          console.log(chalk.dim(`     • ${item}`));
        });
      }
    });
  }

  // 代码改进
  if (result.codeImprovements && result.codeImprovements.length > 0) {
    console.log(chalk.cyan('\n⚡ 代码改进建议:'));
    result.codeImprovements.forEach((improvement: any, index: number) => {
      console.log(chalk.cyan(`\n${index + 1}. ${path.basename(improvement.filePath)}${improvement.lineNumber ? `:${improvement.lineNumber}` : ''}`));
      console.log(`   ${improvement.description}`);
      if (improvement.explanation) {
        console.log(chalk.dim(`   ${improvement.explanation}`));
      }
    });
  }

  console.log(chalk.gray('\n═'.repeat(60)));
}