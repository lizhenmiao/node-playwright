const ContextManager = require('../utils/contextManager');
const ipCheck = require('../plugins/ipCheck');
const proxyConfig = require('../utils/proxyConfig');
const { logger } = require('../utils/logger');

(async () => {
  const manager = new ContextManager({
    maxConcurrency: 3,  // 测试3个并发
    headless: true,
    useRandomUA: true,
    browserType: 'chromium'
  });

  try {
    logger.info('开始测试多并发任务...');

    manager.addTask(ipCheck, {
      proxy: proxyConfig.getProxyUrl()
    });

    // 事件监听状态变化
    const statusHandler = (status) => {
      logger.info(`[${new Date().toLocaleTimeString()}] 活跃Context: ${status.activeContexts}, 队列: ${status.queueLength}`);
    };
    manager.on('statusChange', statusHandler);

    // 等待所有任务完成
    await new Promise((resolve) => {
      const completedHandler = () => {
        // 移除所有事件监听器
        manager.removeListener('statusChange', statusHandler);
        manager.removeListener('completed', completedHandler);
        resolve();
      };
      manager.on('completed', completedHandler);
    });

    await manager.close();
    logger.info('测试完成');
  } catch (error) {
    logger.error('测试出错:', error.message);
    await manager.close();
  }
})();
