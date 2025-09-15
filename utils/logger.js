/**
 * 基于 Winston 的日志管理工具
 * 支持每日日志文件轮转和多种输出格式
 * 支持多参数调用格式
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

// 数据库日志格式
const dbLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, message }) => {
    return `[${timestamp}] ${message}`;
  })
);

// 创建主 Winston logger
const mainLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        })
      )
    }),

    // 每日轮转文件 - 所有日志
    new DailyRotateFile({
      filename: path.join('logs', '%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),

    // 错误日志单独文件
    new DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ]
});

// 创建数据库专用 logger
const dbLogger = winston.createLogger({
  level: 'info',
  format: dbLogFormat,
  transports: [
    // 数据库日志单独文件
    new DailyRotateFile({
      filename: path.join('logs', 'database-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ]
});

// 创建只输出到控制台的 logger
const consoleOnlyLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    // 只有控制台输出
    new winston.transports.Console()
  ]
});

// 创建只输出到文件的 logger
const fileOnlyLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 只有文件输出
    new DailyRotateFile({
      filename: path.join('logs', '%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    })
  ]
});

// 工具函数：处理多参数
function formatArgs(...args) {
  if (args.length === 1) {
    return typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
  }

  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'object' && arg !== null) return JSON.stringify(arg);
    return String(arg);
  }).join(' ');
}

// 封装的 logger 对象
const logger = {
  // 支持多参数的日志方法
  info(...args) {
    const message = formatArgs(...args);
    mainLogger.info(message);
  },

  error(...args) {
    const message = formatArgs(...args);
    mainLogger.error(message);
  },

  warn(...args) {
    const message = formatArgs(...args);
    mainLogger.warn(message);
  },

  debug(...args) {
    const message = formatArgs(...args);
    mainLogger.debug(message);
  },

  success(...args) {
    const message = formatArgs(...args);
    mainLogger.info(message, { level: 'success' });
  },

  // 数据库专用日志方法 - 只写入文件，不显示在终端
  sql(...args) {
    const message = formatArgs(...args);
    dbLogger.info(message);
  },

  // 数据库查询日志（用于 Sequelize logging 配置）
  dbQuery(sql, timing) {
    let timingStr = '';
    if (timing) {
      // Sequelize 可能传递对象或数字
      if (typeof timing === 'object' && timing.duration !== undefined) {
        timingStr = ` [${timing.duration}ms]`;
      } else if (typeof timing === 'number') {
        timingStr = ` [${timing}ms]`;
      } else if (typeof timing === 'string') {
        timingStr = ` [${timing}]`;
      }
    }
    const message = `${sql}${timingStr}`;
    this.sql(message);
  },

  // 只在终端显示
  console(...args) {
    const message = formatArgs(...args);
    consoleOnlyLogger.info(message);
  },

  // 只在日志文件显示
  log(...args) {
    const message = formatArgs(...args);
    fileOnlyLogger.info(message);
  }
};

module.exports = { logger };