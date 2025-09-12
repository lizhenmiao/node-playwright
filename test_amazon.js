const ContextManager = require('./utils/ContextManager');
const amazonScraper = require('./plugins/amazonScraper');
const proxyConfig = require('./utils/proxyConfig');
const CommonUtils = require('./utils/CommonUtils');
const { closeConnection, isConnectionActive } = require('./database/connection');

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
    console.log('开始测试多并发任务...\n');
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
      // console.log(`[${new Date().toLocaleTimeString()}] 活跃Context: ${status.activeContexts}, 队列: ${status.queueLength}`);
    };
    manager.on('statusChange', statusHandler);

    // 等待所有任务完成
    await new Promise((resolve) => {
      const completedHandler = () => {
        const executionTime = Date.now() - startTime;
        console.log('耗时：', `${executionTime}ms - ${CommonUtils.formatMilliseconds(executionTime)}`);

        // 移除所有事件监听器
        manager.removeListener('statusChange', statusHandler);
        manager.removeListener('completed', completedHandler);
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

    console.log('测试完成');

  } catch (error) {
    console.error('测试出错:', error);

    // 清理资源
    await manager.close();
    if (isConnectionActive()) {
      await closeConnection();
    }
  }
})();
