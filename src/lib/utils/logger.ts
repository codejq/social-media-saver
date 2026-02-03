/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  enableTimestamp: boolean;
}

/**
 * Logger instance for the extension
 */
class Logger {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    prefix: '[SocialMediaSaver]',
    enableTimestamp: true,
  };

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private formatMessage(level: string, message: string, ...args: unknown[]): string[] {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(this.config.prefix);
    parts.push(`[${level}]`);
    parts.push(message);

    return [parts.join(' '), ...args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    )];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.debug(...this.formatMessage('DEBUG', message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.config.level <= LogLevel.INFO) {
      console.info(...this.formatMessage('INFO', message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.config.level <= LogLevel.WARN) {
      console.warn(...this.formatMessage('WARN', message, ...args));
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.config.level <= LogLevel.ERROR) {
      console.error(...this.formatMessage('ERROR', message, ...args));
    }
  }

  group(label: string): void {
    if (this.config.level < LogLevel.NONE) {
      console.group(`${this.config.prefix} ${label}`);
    }
  }

  groupEnd(): void {
    if (this.config.level < LogLevel.NONE) {
      console.groupEnd();
    }
  }

  time(label: string): void {
    console.time(`${this.config.prefix} ${label}`);
  }

  timeEnd(label: string): void {
    console.timeEnd(`${this.config.prefix} ${label}`);
  }
}

export const logger = new Logger();
export default logger;
