import inquirer from 'inquirer';
import chalk from 'chalk';
import axios from 'axios';
import { AIConfig, AppConfig } from '../types/config';
import { ConfigManager } from './ConfigManager';

export class ConfigWizard {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async runSetup(): Promise<AppConfig> {
    console.log(chalk.blue.bold('\n🔧 欢迎使用日志分析工具配置向导\n'));
    
    const existingConfig = await this.configManager.loadConfig();
    
    if (existingConfig) {
      const { shouldUpdate } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldUpdate',
          message: '检测到现有配置，是否要更新？',
          default: false
        }
      ]);

      if (!shouldUpdate) {
        return existingConfig;
      }
    }

    const aiConfig = await this.configureAI(existingConfig?.ai);
    
    const newConfig: AppConfig = {
      ai: aiConfig,
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    };

    await this.testConnection(aiConfig);
    await this.configManager.saveConfig(newConfig);
    
    console.log(chalk.green('\n✅ 配置保存成功！'));
    console.log(chalk.gray(`配置文件位置: ${this.configManager.getConfigPath()}`));
    
    return newConfig;
  }

  private async configureAI(existingAI?: AIConfig): Promise<AIConfig> {
    console.log(chalk.yellow('\n📡 配置AI服务提供商'));

    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: '选择AI服务提供商:',
        choices: [
          { name: 'OpenAI (ChatGPT)', value: 'openai' },
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'Ollama (本地模型)', value: 'ollama' },
          { name: '自定义API', value: 'custom' }
        ],
        default: existingAI?.provider || 'openai'
      }
    ]);

    let defaultUrl: string;
    let defaultModel: string;

    switch (provider) {
      case 'openai':
        defaultUrl = 'https://api.openai.com/v1';
        defaultModel = 'gpt-3.5-turbo';
        break;
      case 'anthropic':
        defaultUrl = 'https://api.anthropic.com';
        defaultModel = 'claude-3-haiku-20240307';
        break;
      case 'ollama':
        defaultUrl = 'http://localhost:11434/v1';
        defaultModel = 'llama3.2:latest';
        break;
      default:
        defaultUrl = existingAI?.apiUrl || 'https://api.example.com/v1';
        defaultModel = existingAI?.modelId || 'your-model';
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiUrl',
        message: 'API地址:',
        default: existingAI?.apiUrl || defaultUrl,
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return '请输入有效的URL';
          }
        }
      },
      {
        type: 'password',
        name: 'apiKey',
        message: provider === 'ollama' ? 'API密钥 (ollama通常不需要，可留空):' : 'API密钥:',
        mask: '*',
        validate: (input: string) => {
          if (provider === 'ollama') {
            return true; // ollama不需要API密钥
          }
          if (!input || input.trim() === '') {
            return 'API密钥不能为空';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'modelId',
        message: '模型ID:',
        default: existingAI?.modelId || defaultModel
      },
      {
        type: 'number',
        name: 'maxTokens',
        message: '最大Token数 (可选):',
        default: existingAI?.maxTokens || 4000
      },
      {
        type: 'number',
        name: 'temperature',
        message: '温度参数 (0-2, 可选):',
        default: existingAI?.temperature || 0.7,
        validate: (input: string) => {
          const num = parseFloat(input);
          if (isNaN(num) || num < 0 || num > 2) {
            return '温度参数必须在0-2之间';
          }
          return true;
        }
      }
    ]);

    return {
      provider,
      ...answers
    };
  }

  private async testConnection(aiConfig: AIConfig): Promise<void> {
    console.log(chalk.yellow('\n🔍 测试API连接...'));

    try {
      let testRequest;

      if (aiConfig.provider === 'openai') {
        testRequest = axios.post(
          `${aiConfig.apiUrl}/chat/completions`,
          {
            model: aiConfig.modelId,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          },
          {
            headers: {
              'Authorization': `Bearer ${aiConfig.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
      } else if (aiConfig.provider === 'anthropic') {
        testRequest = axios.post(
          `${aiConfig.apiUrl}/v1/messages`,
          {
            model: aiConfig.modelId,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          },
          {
            headers: {
              'x-api-key': aiConfig.apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            timeout: 10000
          }
        );
      } else if (aiConfig.provider === 'ollama') {
        // 测试ollama的/api/tags端点
        testRequest = axios.get(
          `${aiConfig.apiUrl}/api/tags`,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
      } else {
        console.log(chalk.yellow('⚠️  自定义API，跳过连接测试'));
        return;
      }

      await testRequest;
      console.log(chalk.green('✅ API连接测试成功！'));
      
    } catch (error: any) {
      if (error.response) {
        if (error.response.status === 401) {
          throw new Error('API密钥无效，请检查密钥是否正确');
        } else if (error.response.status === 403) {
          throw new Error('API访问被拒绝，请检查账户权限');
        } else {
          console.log(chalk.yellow(`⚠️  API连接测试返回状态码: ${error.response.status}`));
          console.log(chalk.yellow('配置已保存，请确保API服务正常'));
        }
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('无法连接到API服务，请检查网络连接和API地址');
      } else {
        console.log(chalk.yellow('⚠️  API连接测试失败，但配置已保存'));
        console.log(chalk.gray(`错误: ${error.message}`));
      }
    }
  }

  async showCurrentConfig(): Promise<void> {
    const config = await this.configManager.loadConfig();
    
    if (!config) {
      console.log(chalk.yellow('❌ 未找到配置文件'));
      return;
    }

    console.log(chalk.blue.bold('\n📋 当前配置信息:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.cyan('提供商:')} ${config.ai.provider}`);
    console.log(`${chalk.cyan('API地址:')} ${config.ai.apiUrl}`);
    console.log(`${chalk.cyan('模型ID:')} ${config.ai.modelId}`);
    console.log(`${chalk.cyan('API密钥:')} ${'*'.repeat(8)}${config.ai.apiKey.slice(-4)}`);
    console.log(`${chalk.cyan('最大Token:')} ${config.ai.maxTokens || '未设置'}`);
    console.log(`${chalk.cyan('温度参数:')} ${config.ai.temperature || '未设置'}`);
    console.log(`${chalk.cyan('最后更新:')} ${new Date(config.lastUpdated).toLocaleString()}`);
    console.log(chalk.gray('─'.repeat(40)));
  }

  async resetConfig(): Promise<void> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确定要重置所有配置吗？此操作不可撤销。',
        default: false
      }
    ]);

    if (confirm) {
      await this.configManager.resetConfig();
      console.log(chalk.green('✅ 配置已重置'));
    } else {
      console.log(chalk.yellow('已取消重置操作'));
    }
  }
}