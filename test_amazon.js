const ContextManager = require('./utils/contextManager');
const amazonScraper = require('./plugins/amazonScraper');
const proxyConfig = require('./utils/proxyConfig');
const CommonUtils = require('./utils/commonUtils');
const { closeConnection, isConnectionActive } = require('./database/connection');
const { logger } = require('./utils/logger');
const axios = require('axios');

(async () => {
  const manager = new ContextManager({
    maxConcurrency: 5,
    headless: true,
    useRandomUA: true,
    browserType: 'chromium'
  });

  const keywords = [{
    zipCode: 10008,
    keyword: 'rj45 coupler keystone',
    url: 'https://www.amazon.com'
  }, {
    zipCode: 'W1B 4DG',
    keyword: 'ethernet socket cat6',
    url: 'https://www.amazon.co.uk'
  }, {
    zipCode: 'K1A 0A9',
    keyword: 'keystone cat5e jack',
    url: 'https://www.amazon.ca'
  }]

  try {
    logger.info('开始测试多并发任务...');
    const startTime = Date.now();

    for (const item of keywords) {
      manager.addTask(amazonScraper, {
        // Context配置参数
        proxy: proxyConfig.getProxyUrl(),
        cookieDomain: item.url.replace('https://www', ''),
        zipCode: item.zipCode
      }, {
        // 插件参数
        keyword: item.keyword,
        url: item.url
      });
    }

    // 事件监听状态变化
    const statusHandler = (status) => {
      logger.log(`[${new Date().toLocaleTimeString()}] 活跃Context: ${status.activeContexts}, 队列: ${status.queueLength}`);
    };
    manager.on('statusChange', statusHandler);

    // 等待所有任务完成
    await new Promise((resolve) => {
      const completedHandler = async (results) => {
        const executionTime = Date.now() - startTime;
        logger.info('耗时：', `${executionTime}ms - ${CommonUtils.formatMilliseconds(executionTime)}`);

        // 移除所有事件监听器
        manager.removeListener('statusChange', statusHandler);
        manager.removeListener('completed', completedHandler);

        // 收集所有的crawlTaskId
        const crawlTaskIds = results.map(result => result.crawlTaskId).filter(Boolean);

        logger.info(`收集到 ${crawlTaskIds.length} 个任务ID, 完成顺序为: ${crawlTaskIds.join(', ')}, 排序后为: ${crawlTaskIds.sort((a, b) => a - b).join(', ')}`);

        // 调用接口传递任务ID数组
        if (crawlTaskIds.length > 0) {
          await callApiWithTaskIds(crawlTaskIds);
        } else {
          logger.warn('没有成功的任务，跳过API调用');
        }

        resolve();
      };
      manager.on('completed', completedHandler);
    });

    // 关闭浏览器
    await manager.close();

    // 关闭数据库连接
    if (isConnectionActive()) {
      await closeConnection();
    }

    logger.info('测试完成');

  } catch (error) {
    logger.error('测试出错:', error);

    // 清理资源
    await manager.close();
    if (isConnectionActive()) {
      await closeConnection();
    }
  }
})();

/**
 * 调用接口传递任务ID数组
 * @param {Array} crawlTaskIds - 任务ID数组
 */
async function callApiWithTaskIds(crawlTaskIds) {
  try {
    // 接口调用配置 - 请根据实际情况修改
    const apiUrl = 'https://your-api-endpoint.com/tasks/batch'; // 请替换为实际的API端点
    const payload = {
      taskIds: crawlTaskIds,
      timestamp: new Date().toISOString(),
      source: 'amazon-scraper'
    };

    /* const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        // 如果需要认证，请添加相应的headers
        // 'Authorization': 'Bearer your-token'
      },
      timeout: 30000 // 30秒超时
    }); */

    logger.info(`接口调用成功！`);
  } catch (error) {
    logger.error('接口调用失败:', error.message);
  }
}
