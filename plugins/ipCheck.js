// 配置最大重试次数
const maxRetries = 3;
const { sleepSeconds } = require('../utils/sleep');

async function ipCheck(page, context) {
  console.log(`任务 ${context.taskId}: 开始检查IP地址... (重试次数: ${context.retryCount})`);

  try {
    await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle' });

    const ipInfo = await page.evaluate(() => {
      return document.body.textContent?.trim();
    });

    console.log(`任务 ${context.taskId}: IP信息 - ${ipInfo}`);
    
    // 模拟一些处理时间
    console.log(`任务 ${context.taskId}: 等待 3 秒...`);
    await sleepSeconds(3);

    // 明确通知任务完成
    console.log(`任务 ${context.taskId}: 任务完成，通知管理器`);
    context.complete();
    
    return { ip: ipInfo, taskId: context.taskId, retryCount: context.retryCount };
  } catch (error) {
    console.log(`任务 ${context.taskId}: 请求失败 - ${error.message}`);
    
    // 只需要检查是否还有重试机会
    const canRetry = context.retryCount < maxRetries;
    
    if (canRetry) {
      console.log(`任务 ${context.taskId}: 将重试 (${context.retryCount + 1}/${maxRetries})`);
    } else {
      console.log(`任务 ${context.taskId}: 已达到最大重试次数，最终失败`);
    }
    
    context.failed(error, canRetry);
  }
}

module.exports = ipCheck;