import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigWizard } from '../config/ConfigWizard';
import { ConfigManager } from '../config/ConfigManager';
import { AIAnalyzer } from '../analyzer/AIAnalyzer';
import { AIProvider, AIFeature } from '../types/analysis';

export function createConfigCommand(): Command {
  const configCommand = new Command('config');
  configCommand.description('管理配置设置');

  configCommand
    .command('setup')
    .description('运行配置向导')
    .action(async () => {
      try {
        const wizard = new ConfigWizard();
        await wizard.runSetup();
      } catch (error: any) {
        console.error(chalk.red(`配置失败: ${error.message}`));
        process.exit(1);
      }
    });

  configCommand
    .command('show')
    .description('显示当前配置')
    .action(async () => {
      try {
        const wizard = new ConfigWizard();
        await wizard.showCurrentConfig();
      } catch (error: any) {
        console.error(chalk.red(`显示配置失败: ${error.message}`));
        process.exit(1);
      }
    });

  configCommand
    .command('reset')
    .description('重置配置')
    .action(async () => {
      try {
        const wizard = new ConfigWizard();
        await wizard.resetConfig();
      } catch (error: any) {
        console.error(chalk.red(`重置配置失败: ${error.message}`));
        process.exit(1);
      }
    });

  configCommand
    .command('validate')
    .description('验证配置有效性')
    .action(async () => {
      try {
        const configManager = new ConfigManager();
        const config = await configManager.loadConfig();
        
        if (!config) {
          console.log(chalk.yellow('❌ 未找到配置文件，请先运行 config setup'));
          return;
        }

        const validation = configManager.validateConfig(config);
        
        if (validation.isValid) {
          console.log(chalk.green('✅ 配置验证通过'));
        } else {
          console.log(chalk.red('❌ 配置验证失败:'));
          validation.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
        }
      } catch (error: any) {
        console.error(chalk.red(`验证配置失败: ${error.message}`));
        process.exit(1);
      }
    });

  configCommand
    .command('test')
    .description('测试AI服务连接')
    .action(async () => {
      const spinner = ora('测试AI服务连接...').start();
      
      try {
        const configManager = new ConfigManager();
        const config = await configManager.loadConfig();
        
        if (!config) {
          spinner.fail(chalk.red('未找到配置文件，请先运行 config setup'));
          return;
        }

        // 验证基础配置
        const validation = configManager.validateConfig(config);
        if (!validation.isValid) {
          spinner.fail(chalk.red('配置验证失败'));
          validation.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
          return;
        }

        // 创建AI提供商配置
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

        // 检查网络连接
        spinner.text = '检查网络连接...';
        const provider = (analyzer as any).provider;
        if (provider && typeof provider.checkNetworkConnectivity === 'function') {
          const networkCheck = await provider.checkNetworkConnectivity();
          if (!networkCheck.success) {
            spinner.fail(chalk.red(`网络连接失败: ${networkCheck.error}`));
            
            console.log(chalk.yellow('\n🔧 故障排除建议:'));
            console.log(chalk.cyan(`  1. 检查网络连接是否正常`));
            console.log(chalk.cyan(`  2. 确认API地址是否可访问: ${config.ai.apiUrl}`));
            console.log(chalk.cyan(`  3. 尝试在浏览器中访问该地址`));
            return;
          }
        }

        // 测试AI服务
        spinner.text = '测试AI服务响应...';
        const testResponse = await analyzer.quickDiagnosis(
          '简单测试连接是否正常，请回复"连接测试成功"',
          { language: 'Test', framework: 'Test' }
        );

        if (testResponse && typeof testResponse === 'string' && testResponse.length > 0) {
          spinner.succeed(chalk.green('✅ AI服务连接成功'));
          
          console.log(chalk.blue('\n📊 测试结果:'));
          console.log(chalk.cyan(`  提供商: ${config.ai.provider}`));
          console.log(chalk.cyan(`  模型: ${config.ai.modelId}`));
          console.log(chalk.cyan(`  API地址: ${config.ai.apiUrl}`));
          console.log(chalk.cyan(`  响应长度: ${testResponse.length} 字符`));
          
          if (testResponse.length > 100) {
            console.log(chalk.gray(`\n📝 AI响应预览:`));
            console.log(chalk.gray(`  ${testResponse.substring(0, 100)}...`));
          } else {
            console.log(chalk.gray(`\n📝 AI响应:`));
            console.log(chalk.gray(`  ${testResponse}`));
          }
        } else {
          spinner.fail(chalk.red('AI服务响应异常'));
        }

      } catch (error: any) {
        spinner.fail(chalk.red(`连接测试失败: ${error.message}`));
        
        if (error.message.includes('405')) {
          console.log(chalk.yellow('\n💡 提示: 检测到405错误，API可能不支持当前请求格式'));
        } else if (error.message.includes('timeout')) {
          console.log(chalk.yellow('\n💡 提示: 连接超时，请检查网络连接或尝试增加超时时间'));
        }
      }
    });

  return configCommand;
}