const ContextManager = require('./utils/ContextManager');
const ipCheck = require('./plugins/ipCheck');
const proxyConfig = require('./utils/proxyConfig');

(async () => {
  const manager = new ContextManager({
    maxConcurrency: 3,  // 测试3个并发
    headless: false,
    useRandomUA: true,
    browserType: 'chromium'
  });

  try {
    console.log('开始测试多并发任务...\n');

    // 创建5个任务测试并发控制
    for (let i = 1; i <= 5; i++) {
      manager.addTask(ipCheck, {
        proxy: proxyConfig.getProxyUrl(),
      });
    }

    // 事件监听状态变化
    const statusHandler = (status) => {
      console.log(`[${new Date().toLocaleTimeString()}] 活跃Context: ${status.activeContexts}, 队列: ${status.queueLength}`);
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
    console.log('测试完成');

  } catch (error) {
    console.error('测试出错:', error);
    await manager.close();
  }
})();
