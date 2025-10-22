/**
 * Amazon 产品数据提取 API 服务器
 * 简化版本 - 固定读取HTML文件返回所有产品数据
 * 集成日志管理和定时任务功能
 */

const express = require('express');
const cors = require('cors');
const { logger } = require('./utils/logger');
const cron = require('node-cron');
const { extractProducts } = require('./test/extractor');
const runAmazonScraper = require('./test/amazon');
const axios = require('axios');
const { prepareCookies, getMergedCookiesConfig } = require('./utils/cookiesHelper');
const CommonUtils = require('./utils/commonUtils');
const { initConnection, closeConnection } = require('./database/connection');

// 加载环境变量
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());

/**
 * 执行爬取任务的核心逻辑
 */
async function executeScrapeTask() {
  try {
    const response = await axios.get(`${process.env.BASE_API}/api/keywordPositionRule/scrapeParams`);

    const { data } = response || {};
    /* const data = [{
      keywordText: 'keystone cat5e jack',
      amazonUrl: 'https://www.amazon.com',
      countryCode: 'US'
    }, {
      keywordText: 'netzwerk werkzeug',
      amazonUrl: 'https://www.amazon.de',
      countryCode: 'DE'
    }, {
      keywordText: 'hdmi femelle femelle',
      amazonUrl: 'https://www.amazon.ca',
      countryCode: 'CA'
    }] */

    logger.info(`调用接口获取到数据: ${JSON.stringify(data || [])}`);

    // 提取所有需要的 URL
    const urls = (data || []).map(item => item.amazonUrl);

    // 准备和检查 cookies（如果过期则自动更新）
    if (urls.length > 0) {
      const cookiesStartTime = Date.now();

      try {
        const cookiesResult = await prepareCookies(urls);

        if (cookiesResult.updated.length > 0) {
          logger.info(`已更新以下域名的 cookies: ${cookiesResult.updated.join(', ')}`);
        }

        if (cookiesResult.skipped.length > 0) {
          logger.info(`以下域名的 cookies 仍然有效，跳过更新: ${cookiesResult.skipped.join(', ')}`);
        }

        if (cookiesResult.failed.length > 0) {
          logger.error(`以下域名的 cookies 更新失败: ${cookiesResult.failed.map(f => f.domain).join(', ')}`);
          // 即使部分失败，也继续执行任务
        }
      } catch (cookiesError) {
        logger.error('准备 cookies 时出错:', cookiesError.message, '将使用现有 cookies 继续执行任务');
      } finally {
        const cookiesTotalTime = Date.now() - cookiesStartTime;
        const timeStr = CommonUtils.formatMilliseconds(cookiesTotalTime);
        logger.info(`Cookies 准备阶段完成，总耗时: ${cookiesTotalTime}ms - ${timeStr}`);
      }
    }

    // 获取合并后的 cookies 配置（优先使用更新后的 cookies）
    const currentCookiesConfig = await getMergedCookiesConfig();

    const dataList = (data || []).map(item => {
      const { keywordText, amazonUrl, countryCode } = item;

      const domain = CommonUtils.getDomain(amazonUrl);

      // logger.info(`获取到域名: ${domain}`);

      const { zipCode } = currentCookiesConfig.find(cookie => cookie.domain === domain) || {};
      // logger.info(`获取到 zipCode: ${zipCode}`);

      return {
        keyword: keywordText,
        url: amazonUrl,
        countryCode,
        zipCode
      }
    });

    logger.info(`调用接口获取到 ${dataList.length} 条任务`);

    const filteredDataList = dataList.filter(item => item.zipCode);

    // 看看是否有没有匹配到 zipCode 的
    const noZipCodeDataList = dataList.filter(item => !item.zipCode);

    if (noZipCodeDataList.length > 0) {
      logger.warn('以下爬取任务没有匹配到 zipCode: ', JSON.stringify(noZipCodeDataList));

      return;
    }

    if (filteredDataList.length === 0) {
      logger.warn('没有获取到爬取参数，跳过爬取任务');

      return;
    }

    // 启动爬虫任务，立即返回，不等待完成
    runAmazonScraper(filteredDataList, true);
  } catch (error) {
    throw error;
  }
}

/**
 * 测试接口 - 获取Amazon产品数据
 */
app.get('/api/testExtractProducts', async (req, res) => {
  try {
    const products = await extractProducts();

    // 按类型分类产品
    const organicProducts = products.filter(p => p.positionType === 'organic');
    const sponsoredProducts = products.filter(p => p.positionType === 'sp');
    const spRecProducts = products.filter(p => p.positionType.includes('sp_rec'));
    const sbProducts = products.filter(p => p.positionType.includes('sb'));

    logger.info(`✅ 数据提取成功, 提取了 ${products.length} 个产品数据`);

    res.json({
      success: true,
      data: {
        // 按类型分组返回
        organic_products: organicProducts.map(p => p.toJSON()),
        sp_products: sponsoredProducts.map(p => p.toJSON()),
        sp_rec_products: spRecProducts.map(p => p.toJSON()),
        sb_sbv_products: sbProducts.map(p => p.toJSON())
      },
      message: `成功提取 ${products.length} 个产品数据`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ 数据提取失败:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Amazon产品数据提取失败',
      timestamp: new Date().toISOString()
    });
  }
});


/**
 * 手动触发爬取任务接口
 */
app.get('/api/triggerScrapeTask', (req, res) => {
  try {
    executeScrapeTask();

    res.json({
      success: true,
      message: '手动触发爬取任务成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('爬取任务执行失败:', error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      message: '手动触发爬取任务失败',
      timestamp: new Date().toISOString()
    });
  }
})

/**
 * 404处理
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    endpoints: [
      'GET /api/testExtractProducts - 测试Amazon产品数据提取',
      'GET /api/triggerScrapeTask - 手动触发爬取任务'
    ]
  });
});

/**
 * 初始化定时任务
 */
function initScheduledTasks() {
  // 每小时的第0分钟和第30分钟执行任务
  cron.schedule('0,30 * * * *', () => {
    try {
      executeScrapeTask();

      logger.info('定时爬取任务后台开始执行...');
    } catch (error) {
      logger.error('定时爬取任务后台执行失败:', error.message);
    }
  });
}

/**
 * 优雅关闭处理
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    await logger.info(`收到 ${signal} 信号，开始优雅关闭`);

    // 关闭数据库连接
    try {
      await closeConnection();
      logger.info('✅ 数据库连接已关闭');
    } catch (error) {
      logger.error('❌ 关闭数据库连接失败:', error.message);
    }

    // 关闭服务器
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// 启动服务器
app.listen(PORT, async () => {
  logger.info('🚀 Amazon产品数据提取API已启动!');
  logger.info(`📡 服务地址: http://localhost:${PORT}`);

  /* // 初始化数据库连接
  try {
    await initConnection();
    logger.info('✅ 数据库连接初始化成功');
  } catch (error) {
    logger.error('❌ 数据库连接初始化失败:', error.message);
    logger.warn('⚠️ 服务器将继续运行，但数据库相关功能可能无法正常工作');
  } */

  // 初始化定时任务
  initScheduledTasks();

  // 设置优雅关闭
  setupGracefulShutdown();
});

module.exports = app;
