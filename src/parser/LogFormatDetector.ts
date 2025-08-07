import { LogFormat, LogLevel, LogEntry } from '../types/log';

export class LogFormatDetector {
  private static readonly FORMAT_PATTERNS = {
    // JSON格式: 每行都是一个完整的JSON对象
    [LogFormat.JSON]: /^\s*\{.*\}\s*$/,
    
    // Spring Boot格式: 2024-01-01 10:00:00.123  INFO 12345 --- [main] c.e.Application : Message
    [LogFormat.SPRING]: /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+[A-Z]+\s+\d+\s+---\s+\[.*?\]\s+[\w.]+\s*:\s*/,
    
    // Log4j格式: 2024-01-01 10:00:00,123 [INFO] com.example.Class - Message
    [LogFormat.LOG4J]: /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3}\s+\[?[A-Z]+\]?\s+[\w.]+\s*[-:]\s*/,
    
    // Apache Common Log格式
    [LogFormat.COMMON]: /^\d+\.\d+\.\d+\.\d+\s+.*?\s+.*?\s+\[.*?\]\s+/,
    
    // Apache Combined Log格式
    [LogFormat.COMBINED]: /^\d+\.\d+\.\d+\.\d+\s+.*?\s+.*?\s+\[.*?\]\s+".*?"\s+\d+\s+\d+/
  };

  private static readonly LEVEL_PATTERNS = {
    [LogLevel.TRACE]: /\b(TRACE|trace)\b/i,
    [LogLevel.DEBUG]: /\b(DEBUG|debug)\b/i,
    [LogLevel.INFO]: /\b(INFO|info|information)\b/i,
    [LogLevel.WARN]: /\b(WARN|warning|warn)\b/i,
    [LogLevel.ERROR]: /\b(ERROR|error|err)\b/i,
    [LogLevel.FATAL]: /\b(FATAL|fatal|critical)\b/i
  };

  static detectFormat(lines: string[]): LogFormat {
    const sampleSize = Math.min(lines.length, 50); // 检查前50行
    const formatScores: Record<LogFormat, number> = {
      [LogFormat.JSON]: 0,
      [LogFormat.SPRING]: 0,
      [LogFormat.LOG4J]: 0,
      [LogFormat.COMMON]: 0,
      [LogFormat.COMBINED]: 0,
      [LogFormat.TEXT]: 0
    };

    for (let i = 0; i < sampleSize; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // 检查每种格式的匹配度
      for (const [format, pattern] of Object.entries(this.FORMAT_PATTERNS)) {
        if (pattern.test(line)) {
          formatScores[format as LogFormat]++;
        }
      }
    }

    // 找到得分最高的格式
    let bestFormat = LogFormat.TEXT;
    let maxScore = 0;

    for (const [format, score] of Object.entries(formatScores)) {
      if (score > maxScore) {
        maxScore = score;
        bestFormat = format as LogFormat;
      }
    }

    // 如果没有明确的格式匹配，默认为文本格式
    return maxScore > 0 ? bestFormat : LogFormat.TEXT;
  }

  static extractLogLevel(line: string): LogLevel | undefined {
    for (const [level, pattern] of Object.entries(this.LEVEL_PATTERNS)) {
      if (pattern.test(line)) {
        return level as LogLevel;
      }
    }
    return undefined;
  }

  static extractTimestamp(line: string, format: LogFormat): string | undefined {
    let timestampPattern: RegExp;

    switch (format) {
      case LogFormat.SPRING:
        timestampPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/;
        break;
      case LogFormat.LOG4J:
        timestampPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})/;
        break;
      case LogFormat.COMMON:
      case LogFormat.COMBINED:
        timestampPattern = /\[([^\]]+)\]/;
        break;
      case LogFormat.JSON:
        try {
          const jsonObj = JSON.parse(line);
          return jsonObj.timestamp || jsonObj.time || jsonObj['@timestamp'];
        } catch {
          return undefined;
        }
      default:
        // 通用时间戳模式
        timestampPattern = /(\d{4}-\d{2}-\d{2}[\s|T]\d{2}:\d{2}:\d{2}(?:\.\d{3})?)/;
    }

    const match = line.match(timestampPattern);
    return match ? match[1] : undefined;
  }

  static parseLogEntry(line: string, lineNumber: number, format: LogFormat): LogEntry {
    const entry: LogEntry = {
      message: line,
      lineNumber,
      rawLine: line
    };

    if (format === LogFormat.JSON) {
      try {
        const jsonObj = JSON.parse(line);
        entry.timestamp = jsonObj.timestamp || jsonObj.time || jsonObj['@timestamp'];
        entry.level = this.extractLogLevel(jsonObj.level || jsonObj.severity || '');
        entry.message = jsonObj.message || jsonObj.msg || line;
        entry.metadata = jsonObj;
      } catch {
        // JSON解析失败，作为普通文本处理
        entry.level = this.extractLogLevel(line);
      }
    } else {
      entry.timestamp = this.extractTimestamp(line, format);
      entry.level = this.extractLogLevel(line);
      
      // 提取消息部分（去除时间戳和级别）
      let message = line;
      
      if (format === LogFormat.SPRING) {
        const match = line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+[A-Z]+\s+\d+\s+---\s+\[.*?\]\s+[\w.]+\s*:\s*(.*)$/);
        if (match) message = match[1];
      } else if (format === LogFormat.LOG4J) {
        const match = line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3}\s+\[?[A-Z]+\]?\s+[\w.]+\s*[-:]\s*(.*)$/);
        if (match) message = match[1];
      }
      
      entry.message = message.trim() || line;
    }

    return entry;
  }
}