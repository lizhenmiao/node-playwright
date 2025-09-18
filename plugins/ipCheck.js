// 配置最大重试次数
const maxRetries = 3;
const { logger } = require('../utils/logger');

async function ipCheck(page, context) {
  logger.info(`任务 ${context.taskId}: 开始检查IP地址... (重试次数: ${context.retryCount})`);

  try {
    await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle' });

    const ipInfo = await page.evaluate(() => {
      return document.body.textContent?.trim();
    });

    logger.info(`任务 ${context.taskId}: IP信息 - ${ipInfo}`);

    // 明确通知任务完成
    logger.info(`任务 ${context.taskId}: 任务完成，通知管理器`);

    context.complete();
  } catch (error) {
    logger.info(`任务 ${context.taskId}: 请求失败 - ${error.message}`);

    // 只需要检查是否还有重试机会
    const canRetry = context.retryCount < maxRetries;

    if (canRetry) {
      logger.info(`任务 ${context.taskId}: 将重试 (${context.retryCount + 1}/${maxRetries})`);
    } else {
      logger.info(`任务 ${context.taskId}: 已达到最大重试次数，最终失败`);
    }

    context.failed(error, canRetry);
  }
}

module.exports = ipCheck;