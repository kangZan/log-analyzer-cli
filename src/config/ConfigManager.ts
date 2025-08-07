import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as CryptoJS from 'crypto-js';
import { AppConfig, AIConfig, DEFAULT_CONFIG, ConfigValidationResult } from '../types/config';

export class ConfigManager {
  private configDir: string;
  private configPath: string;
  private encryptionKey: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.log-analyzer');
    this.configPath = path.join(this.configDir, 'config.json');
    this.encryptionKey = this.generateEncryptionKey();
  }

  private generateEncryptionKey(): string {
    const machineId = os.hostname() + os.userInfo().username;
    return CryptoJS.SHA256(machineId).toString();
  }

  private encrypt(text: string): string {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  private decrypt(encryptedText: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  async ensureConfigDir(): Promise<void> {
    await fs.ensureDir(this.configDir);
  }

  async configExists(): Promise<boolean> {
    return await fs.pathExists(this.configPath);
  }

  async loadConfig(): Promise<AppConfig | null> {
    try {
      if (!await this.configExists()) {
        return null;
      }

      const encryptedData = await fs.readFile(this.configPath, 'utf-8');
      const decryptedData = this.decrypt(encryptedData);
      const config = JSON.parse(decryptedData) as AppConfig;
      
      return this.mergeWithDefaults(config);
    } catch (error) {
      console.error('加载配置文件失败:', error);
      return null;
    }
  }

  async saveConfig(config: AppConfig): Promise<void> {
    try {
      await this.ensureConfigDir();
      
      const configData = {
        ...config,
        lastUpdated: new Date().toISOString()
      };

      const encryptedData = this.encrypt(JSON.stringify(configData, null, 2));
      await fs.writeFile(this.configPath, encryptedData, 'utf-8');
    } catch (error) {
      throw new Error(`保存配置文件失败: ${error}`);
    }
  }

  private mergeWithDefaults(config: Partial<AppConfig>): AppConfig {
    return {
      ...DEFAULT_CONFIG,
      ...config,
      ai: {
        ...DEFAULT_CONFIG.ai!,
        ...config.ai
      }
    } as AppConfig;
  }

  validateConfig(config: AppConfig): ConfigValidationResult {
    const errors: string[] = [];

    // ollama通常不需要API密钥
    if (config.ai.provider !== 'ollama' && (!config.ai.apiKey || config.ai.apiKey.trim() === '')) {
      errors.push('API Key 不能为空');
    }

    if (!config.ai.apiUrl || config.ai.apiUrl.trim() === '') {
      errors.push('API URL 不能为空');
    }

    if (!config.ai.modelId || config.ai.modelId.trim() === '') {
      errors.push('模型ID 不能为空');
    }

    try {
      new URL(config.ai.apiUrl);
    } catch {
      errors.push('API URL 格式不正确');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async resetConfig(): Promise<void> {
    try {
      if (await this.configExists()) {
        await fs.remove(this.configPath);
      }
    } catch (error) {
      throw new Error(`重置配置失败: ${error}`);
    }
  }

  getConfigPath(): string {
    return this.configPath;
  }
}