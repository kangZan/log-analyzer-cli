import * as fs from 'fs-extra';
import * as path from 'path';
import { LogParseOptions } from '../types/log';

export class LogFileReader {
  private options: Required<LogParseOptions>;

  constructor(options: LogParseOptions = {}) {
    this.options = {
      contextLines: options.contextLines || 5,
      maxFileSize: options.maxFileSize || 100, // 100MB
      encoding: options.encoding || 'utf-8'
    };
  }

  async validateFile(filePath: string): Promise<void> {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`日志文件不存在: ${filePath}`);
    }

    const stats = await fs.stat(filePath);
    
    if (!stats.isFile()) {
      throw new Error(`指定路径不是文件: ${filePath}`);
    }

    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > this.options.maxFileSize) {
      throw new Error(`文件过大 (${fileSizeMB.toFixed(2)}MB)，超过限制 ${this.options.maxFileSize}MB`);
    }
  }

  async readFile(filePath: string): Promise<string[]> {
    await this.validateFile(filePath);

    try {
      const content = await fs.readFile(filePath, { encoding: this.options.encoding as BufferEncoding });
      return content.split(/\r?\n/);
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`没有权限读取文件: ${filePath}`);
      } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
        throw new Error(`系统打开文件数量达到限制`);
      } else {
        throw new Error(`读取文件失败: ${error.message}`);
      }
    }
  }

  async readFileStream(filePath: string, callback: (lines: string[], isComplete: boolean) => void): Promise<void> {
    await this.validateFile(filePath);

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath, { 
        encoding: this.options.encoding as BufferEncoding,
        highWaterMark: 64 * 1024 // 64KB chunks
      });

      let buffer = '';
      let lineNumber = 0;

      stream.on('data', (chunk: string | Buffer) => {
        const chunkStr = typeof chunk === 'string' ? chunk : chunk.toString();
        buffer += chunkStr;
        const lines = buffer.split(/\r?\n/);
        
        // 保留最后一行（可能不完整）
        buffer = lines.pop() || '';
        
        if (lines.length > 0) {
          callback(lines, false);
          lineNumber += lines.length;
        }
      });

      stream.on('end', () => {
        // 处理最后一行
        if (buffer.length > 0) {
          callback([buffer], true);
        } else {
          callback([], true);
        }
        resolve();
      });

      stream.on('error', (error) => {
        reject(new Error(`流式读取文件失败: ${error.message}`));
      });
    });
  }

  getFileInfo(filePath: string): Promise<{
    size: number;
    sizeMB: number;
    created: Date;
    modified: Date;
    extension: string;
  }> {
    return fs.stat(filePath).then(stats => ({
      size: stats.size,
      sizeMB: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
      created: stats.birthtime,
      modified: stats.mtime,
      extension: path.extname(filePath).toLowerCase()
    }));
  }
}