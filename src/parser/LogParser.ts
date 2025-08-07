import { LogFileReader } from './LogFileReader';
import { LogFormatDetector } from './LogFormatDetector';
import { ErrorExtractor } from './ErrorExtractor';
import { 
  LogEntry, 
  ErrorLogEntry, 
  ParsedLogResult, 
  LogParseOptions, 
  LogFormat 
} from '../types/log';

export class LogParser {
  private fileReader: LogFileReader;
  private options: LogParseOptions;

  constructor(options: LogParseOptions = {}) {
    this.options = options;
    this.fileReader = new LogFileReader(options);
  }

  async parseLogFile(filePath: string): Promise<ParsedLogResult> {
    const parseErrors: string[] = [];
    
    try {
      // 读取文件内容
      const lines = await this.fileReader.readFile(filePath);
      
      if (lines.length === 0) {
        throw new Error('日志文件为空');
      }

      // 检测日志格式
      const format = LogFormatDetector.detectFormat(lines);
      
      // 解析所有日志条目
      const entries: LogEntry[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 跳过空行
        if (!line.trim()) {
          continue;
        }

        try {
          const entry = LogFormatDetector.parseLogEntry(line, i + 1, format);
          entries.push(entry);
        } catch (error: any) {
          parseErrors.push(`行 ${i + 1}: ${error.message}`);
          // 即使解析失败，也添加基本条目
          entries.push({
            message: line,
            lineNumber: i + 1,
            rawLine: line
          });
        }
      }

      // 提取错误条目
      const errorEntries = ErrorExtractor.extractErrorEntries(entries);

      // 分析上下文关系
      this.analyzeContextRelations(errorEntries, entries);

      return {
        entries,
        errorEntries,
        format,
        totalLines: lines.length,
        parseErrors
      };

    } catch (error: any) {
      throw new Error(`解析日志文件失败: ${error.message}`);
    }
  }

  async parseLogFileStream(
    filePath: string, 
    onProgress: (processed: number, total: number, errors: ErrorLogEntry[]) => void
  ): Promise<ParsedLogResult> {
    const parseErrors: string[] = [];
    const entries: LogEntry[] = [];
    const errorEntries: ErrorLogEntry[] = [];
    let format: LogFormat = LogFormat.TEXT;
    let lineNumber = 0;
    let formatDetected = false;

    return new Promise(async (resolve, reject) => {
      try {
        await this.fileReader.readFileStream(filePath, (lines, isComplete) => {
          // 在前几批数据中检测格式
          if (!formatDetected && entries.length + lines.length >= 10) {
            const allProcessedLines = [...entries.map(e => e.rawLine), ...lines];
            format = LogFormatDetector.detectFormat(allProcessedLines);
            formatDetected = true;
          }

          // 处理当前批次的行
          for (const line of lines) {
            lineNumber++;
            
            if (!line.trim()) continue;

            try {
              const entry = LogFormatDetector.parseLogEntry(line, lineNumber, format);
              entries.push(entry);

              // 检查是否为错误行
              if (ErrorExtractor.isErrorLine(entry)) {
                const errorEntry = ErrorExtractor.createErrorEntry(entry, entries, entries.length - 1);
                errorEntries.push(errorEntry);
              }
            } catch (error: any) {
              parseErrors.push(`行 ${lineNumber}: ${error.message}`);
              entries.push({
                message: line,
                lineNumber,
                rawLine: line
              });
            }
          }

          // 报告进度
          if (onProgress) {
            onProgress(lineNumber, -1, errorEntries); // -1 表示总数未知
          }

          if (isComplete) {
            // 分析上下文关系
            this.analyzeContextRelations(errorEntries, entries);

            resolve({
              entries,
              errorEntries,
              format,
              totalLines: lineNumber,
              parseErrors
            });
          }
        });
      } catch (error: any) {
        reject(new Error(`流式解析日志文件失败: ${error.message}`));
      }
    });
  }

  private analyzeContextRelations(errorEntries: ErrorLogEntry[], allEntries: LogEntry[]): void {
    for (const errorEntry of errorEntries) {
      // 分析错误的严重程度
      errorEntry.metadata = {
        ...errorEntry.metadata,
        severity: this.calculateSeverity(errorEntry),
        relatedErrors: this.findRelatedErrors(errorEntry, errorEntries),
        timelinePosition: this.calculateTimelinePosition(errorEntry, allEntries)
      };
    }
  }

  private calculateSeverity(errorEntry: ErrorLogEntry): 'low' | 'medium' | 'high' | 'critical' {
    const message = errorEntry.message.toLowerCase();
    
    if (message.includes('fatal') || message.includes('critical') || message.includes('outofmemory')) {
      return 'critical';
    }
    
    if (message.includes('nullpointer') || message.includes('segmentation') || 
        message.includes('stackoverflow') || errorEntry.stackTrace && errorEntry.stackTrace.length > 10) {
      return 'high';
    }
    
    if (errorEntry.stackTrace && errorEntry.stackTrace.length > 0) {
      return 'medium';
    }
    
    return 'low';
  }

  private findRelatedErrors(targetError: ErrorLogEntry, allErrors: ErrorLogEntry[]): number[] {
    const related: number[] = [];
    const timeThreshold = 5000; // 5秒内的错误可能相关

    for (const error of allErrors) {
      if (error === targetError) continue;

      // 检查时间相关性
      if (targetError.timestamp && error.timestamp) {
        const timeDiff = Math.abs(
          new Date(targetError.timestamp).getTime() - new Date(error.timestamp).getTime()
        );
        
        if (timeDiff <= timeThreshold) {
          related.push(error.lineNumber);
          continue;
        }
      }

      // 检查错误类型相关性
      if (targetError.errorType && error.errorType && 
          targetError.errorType === error.errorType) {
        related.push(error.lineNumber);
        continue;
      }

      // 检查堆栈跟踪相关性
      if (this.hasStackTraceOverlap(targetError, error)) {
        related.push(error.lineNumber);
      }
    }

    return related;
  }

  private hasStackTraceOverlap(error1: ErrorLogEntry, error2: ErrorLogEntry): boolean {
    if (!error1.stackTrace || !error2.stackTrace) return false;

    for (const trace1 of error1.stackTrace) {
      for (const trace2 of error2.stackTrace) {
        if (trace1.className && trace2.className && trace1.className === trace2.className) {
          return true;
        }
        if (trace1.fileName && trace2.fileName && trace1.fileName === trace2.fileName) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateTimelinePosition(errorEntry: ErrorLogEntry, allEntries: LogEntry[]): number {
    return errorEntry.lineNumber / allEntries.length;
  }

  async getFileInfo(filePath: string) {
    return this.fileReader.getFileInfo(filePath);
  }
}