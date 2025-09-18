const ContextManager = require('../utils/contextManager');
const amazonScraper = require('../plugins/amazonScraper');
const proxyConfig = require('../utils/proxyConfig');
const CommonUtils = require('../utils/commonUtils');
const { closeConnection, isConnectionActive } = require('../database/connection');
const { logger } = require('../utils/logger');
const axios = require('axios');

// 加载环境变量
require('dotenv').config();

/**
 * Amazon爬虫测试主函数
 * @param {Array} keywords - 关键词配置数组
 * @param {boolean} shouldCallApi - 是否在完成后调用接口，默认为false
 */
async function runAmazonScraper(keywords, shouldCallApi = false) {
  const manager = new ContextManager({
    maxConcurrency: 5,
    headless: true,
    useRandomUA: true,
    browserType: 'chromium'
  });

  const isDirectRun = require.main === module;
  let resolvePromise = null;
  let rejectPromise = null;

  try {
    const startTime = Date.now();

    for (const item of keywords) {
      manager.addTask(amazonScraper, {
        // Context配置参数
        proxy: proxyConfig.getProxyUrl(),
        cookieDomain: CommonUtils.getDomain(item.url),
        zipCode: item.zipCode
      }, {
        // 插件参数
        keyword: item.keyword,
        url: item.url,
        countryCode: item.countryCode
      });
    }

    // 事件监听状态变化
    const statusHandler = (status) => {
      logger.log(`[${new Date().toLocaleTimeString()}] 活跃Context: ${status.activeContexts}, 队列: ${status.queueLength}`);
    };
    manager.on('statusChange', statusHandler);

    const completedHandler = async (results) => {
      try {
        const executionTime = Date.now() - startTime;
        logger.info('耗时：', `${executionTime}ms - ${CommonUtils.formatMilliseconds(executionTime)}`);

        // 移除所有事件监听器
        manager.removeListener('statusChange', statusHandler);
        manager.removeListener('completed', completedHandler);

        // 收集所有的crawlTaskId
        const crawlTaskIds = results.map(result => result.crawlTaskId).filter(Boolean);

        logger.info(`收集到 ${crawlTaskIds.length} 个任务ID, 完成顺序为: ${crawlTaskIds.join(', ')}, 排序后为: ${crawlTaskIds.sort((a, b) => a - b).join(', ')}`);

        // 根据参数决定是否调用接口传递任务ID数组
        if (shouldCallApi && crawlTaskIds.length > 0) {
          await callApiWithTaskIds(crawlTaskIds);
        } else if (shouldCallApi && crawlTaskIds.length === 0) {
          logger.warn('没有成功的任务，跳过API调用');
        } else if (!shouldCallApi) {
          logger.info('根据配置跳过API调用');
        }

        // 关闭浏览器
        await manager.close();

        // 关闭数据库连接
        if (isConnectionActive()) {
          await closeConnection();
        }

        // 如果是直接运行，解决Promise
        if (isDirectRun && resolvePromise) {
          resolvePromise();
        }
      } catch (error) {
        logger.error('后台任务处理出错:', error.message);
        // 清理资源
        try {
          await manager.close();
          if (isConnectionActive()) {
            await closeConnection();
          }
        } catch (cleanupError) {
          logger.error('资源清理出错:', cleanupError.message);
        }

        // 如果是直接运行，拒绝Promise
        if (isDirectRun && rejectPromise) {
          rejectPromise(error);
        }
      }
    };

    manager.on('completed', completedHandler);

    // 如果是直接运行，返回Promise等待完成；如果是被引入，立即返回
    if (isDirectRun) {
      return new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
    }
  } catch (error) {
    logger.error('启动任务出错:', error.message);

    // 清理资源
    await manager.close();
    if (isConnectionActive()) {
      await closeConnection();
    }

    throw error;
  }
}

/**
 * 调用接口传递任务ID数组
 * @param {Array} crawlTaskIds - 任务ID数组
 */
async function callApiWithTaskIds(crawlTaskIds) {
  try {
    const response = await axios.get(`${process.env.BASE_API}/api/keywordPositionRule/executionRules`, {
      params: {
        crawlTaskIdList: crawlTaskIds
      }
    });

    logger.info(`接口调用成功！`, response.data);
  } catch (error) {
    logger.error('接口调用失败:', error.message);
  }
}

// 默认关键词配置（直接运行时使用）
const defaultKeywords = [{
  zipCode: 10008,
  keyword: 'hdmi 90 degree',
  url: 'https://www.amazon.com',
  countryCode: 'US'
}/* {
  zipCode: 10008,
  keyword: 'rj45 coupler keystone',
  url: 'https://www.amazon.com',
  countryCode: 'US'
}, {
  zipCode: 'W1B 4DG',
  keyword: 'ethernet socket cat6',
  url: 'https://www.amazon.co.uk',
  countryCode: 'GB'
}, {
  zipCode: 'K1A 0A9',
  keyword: 'keystone cat5e jack',
  url: 'https://www.amazon.ca',
  countryCode: 'CA'
}, {
  zipCode: '110-0008',
  keyword: 'usb c ケーブル 充電',
  url: 'https://www.amazon.co.jp',
  countryCode: 'JP'
}, {
  zipCode: 20099,
  keyword: 'netzwerk werkzeug',
  url: 'https://www.amazon.de',
  countryCode: 'DE'
}, {
  zipCode: 75000,
  keyword: 'hdmi femelle femelle',
  url: 'https://www.amazon.fr',
  countryCode: 'FR'
}, {
  zipCode: 20123,
  keyword: 'rca angolo',
  url: 'https://www.amazon.it',
  countryCode: 'IT'
}, {
  zipCode: 28028,
  keyword: 'cable displayport a hdmi',
  url: 'https://www.amazon.es',
  countryCode: 'ES'
} */];

// 检查是否是直接运行此文件
if (require.main === module) {
  // 直接运行时使用默认配置：不调用接口
  logger.info('开始测试多并发任务...');

  runAmazonScraper(defaultKeywords, false)
    .then(() => {
      logger.info('测试运行完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('测试运行出错:', error.message);
      process.exit(1);
    });
}

// 导出主函数供其他文件引用
module.exports = runAmazonScraper;
