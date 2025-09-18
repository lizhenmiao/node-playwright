/**
 * 数据库连接池封装
 * 统一管理数据库连接，使用连接池提升性能
 */

const { Sequelize } = require('sequelize');
const { logger } = require('../utils/logger');

// 加载环境变量
require('dotenv').config();

// 数据库连接配置
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'amazon_crawler',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  dialect: 'mysql',
  timezone: '+08:00',
  logging: (sql, timing) => {
    logger.dbQuery(sql, timing);
  },

  // 连接池配置
  pool: {
    max: 20,        // 最大连接数
    min: 5,         // 最小连接数
    acquire: 30000, // 获取连接超时时间(ms)
    idle: 1800000,  // 连接空闲超时时间(ms) - 30分钟
    evict: 3600000, // 连接回收时间(ms) - 1小时
    handleDisconnects: true
  },

  // 重连配置
  retry: {
    max: 3,
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /TIMEOUT/,
      /ESOCKETTIMEDOUT/,
      /EHOSTUNREACH/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ]
  }
};

// 创建 Sequelize 实例
const sequelize = new Sequelize(config);

// 连接状态管理
let isConnected = false;
let initPromise = null; // 初始化Promise缓存，防止并发重复初始化

/**
 * 初始化数据库连接
 */
async function initConnection() {
  // 如果已经连接，直接返回
  if (isConnected) {
    return sequelize;
  }

  // 如果正在初始化中，等待初始化完成
  if (initPromise) {
    return await initPromise;
  }

  // 创建初始化Promise并缓存
  initPromise = performInit();

  try {
    const result = await initPromise;
    return result;
  } finally {
    // 初始化完成后清除Promise缓存
    initPromise = null;
  }
}

/**
 * 实际执行初始化的内部函数
 */
async function performInit() {
  try {
    await sequelize.authenticate();
    isConnected = true;
    logger.info('✅ 数据库连接池初始化成功');

    // 监听连接事件
    sequelize.addHook('beforeConnect', () => {
      logger.info('🔗 正在建立数据库连接...');
    });

    sequelize.addHook('afterConnect', () => {
      logger.info('✅ 数据库连接建立成功');
    });

    sequelize.addHook('beforeDisconnect', () => {
      logger.info('🔌 正在断开数据库连接...');
    });

    return sequelize;
  } catch (error) {
    isConnected = false;
    logger.error('❌ 数据库连接失败:', error.message);
    throw error;
  }
}

/**
 * 获取数据库连接实例
 */
function getConnection() {
  if (!isConnected) {
    throw new Error('数据库未连接，请先调用 initConnection()');
  }
  return sequelize;
}

/**
 * 关闭数据库连接池
 */
async function closeConnection() {
  try {
    await sequelize.close();
    isConnected = false;
    logger.info('✅ 数据库连接池已关闭');
  } catch (error) {
    logger.error('❌ 关闭数据库连接失败:', error.message);
    throw error;
  }
}

/**
 * 检查连接状态
 */
function isConnectionActive() {
  return isConnected;
}

/**
 * 重新连接数据库
 */
async function reconnect() {
  try {
    if (isConnected) {
      await closeConnection();
    }
    await initConnection();
    logger.info('✅ 数据库重连成功');
  } catch (error) {
    logger.error('❌ 数据库重连失败:', error.message);
    throw error;
  }
}

module.exports = {
  sequelize,
  initConnection,
  getConnection,
  closeConnection,
  isConnectionActive,
  reconnect
};