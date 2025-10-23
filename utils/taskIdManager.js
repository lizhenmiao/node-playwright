const { TaskOps } = require('../database/operations');
const { logger } = require('./logger');

/**
 * 任务ID管理器
 * 负责创建和管理爬虫任务的数据库记录
 * 提供重试机制确保任务ID的获取
 */
class TaskIdManager {
  /**
   * 通用重试函数
   * @param {Function} operation - 要执行的操作
   * @param {string} operationName - 操作名称（用于日志）
   * @param {Object} context - 上下文信息（用于日志）
   * @param {number} maxRetries - 最大重试次数
   * @returns {*} - 操作返回的结果
   */
  static async withRetry(operation, operationName, context = {}, maxRetries = 5) {
    let retries = 0;
    let lastError = null;

    while (retries < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        retries++;

        const contextInfo = context.taskId ? `任务 ${context.taskId}: ` : '';
        logger.warn(`${contextInfo}${operationName}失败 (${retries}/${maxRetries}): ${error.message}`);

        if (retries < maxRetries) {
          // 指数退避：1秒、2秒、3秒...
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }

    // 记录最终失败但不抛出错误
    const contextInfo = context.taskId ? `任务 ${context.taskId}: ` : '';
    logger.error(`${contextInfo}${operationName}最终失败: ${lastError.message}`);
    return null;
  }

  /**
   * 获取或创建任务ID
   * @param {Object} context - 上下文对象
   * @param {string} keyword - 搜索关键词
   * @param {string} zipCode - 邮编
   * @param {string} countryCode - 国家代码
   * @param {number} maxRetries - 最大重试次数
   * @returns {number} - 任务ID
   */
  static async getOrCreateTaskId(context, keyword, zipCode, countryCode, maxRetries = 5) {
    // 如果是重试且已有任务ID，直接使用
    if (context.retryCount > 0 && context.crawlTaskId) {
      logger.info(`任务 ${context.taskId}: 使用已有任务ID ${context.crawlTaskId}`);
      await this.updateTaskStatus(context.crawlTaskId, 'running', {}, context, maxRetries);
      return context.crawlTaskId;
    }

    // 创建新任务
    const taskId = await this.withRetry(
      async () => {
        const task = await TaskOps.create(keyword, zipCode, countryCode);
        context.crawlTaskId = task.id; // 保存到context
        await TaskOps.start(task.id);
        logger.info(`任务 ${context.taskId}: 创建新任务ID ${task.id}`);
        return task.id;
      },
      '创建任务ID',
      context,
      maxRetries
    );

    if (!taskId) {
      logger.error(`任务 ${context.taskId}: 创建任务ID失败，将继续执行但不记录到数据库`);
    }

    return taskId;
  }

  /**
   * 更新任务状态（通用方法）
   * @param {number} taskId - 任务ID
   * @param {string} status - 状态 ('running', 'completed', 'failed')
   * @param {Object} options - 额外参数
   * @param {Object} context - 上下文对象
   * @param {number} maxRetries - 最大重试次数
   */
  static async updateTaskStatus(taskId, status, options = {}, context = {}, maxRetries = 5) {
    if (!taskId) return;

    await this.withRetry(
      async () => {
        if (status === 'running') {
          await TaskOps.start(taskId);
        } else if (status === 'completed') {
          const { totalPages, totalProducts, totalSponsored } = options;
          await TaskOps.complete(taskId, totalPages, totalProducts, totalSponsored);
        } else if (status === 'failed') {
          const { errorMessage } = options;
          await TaskOps.fail(taskId, errorMessage);
        }
      },
      `更新任务状态为${status}`,
      context,
      maxRetries
    );
  }

  /**
   * 保存任务完成状态
   * @param {number} taskId - 任务ID
   * @param {number} totalPages - 总页数
   * @param {number} totalProducts - 总产品数
   * @param {number} totalSponsored - SP广告数
   * @param {Object} context - 上下文对象
   * @param {number} maxRetries - 最大重试次数
   */
  static async saveTaskCompletion(taskId, totalPages, totalProducts, totalSponsored, context = {}, maxRetries = 5) {
    await this.updateTaskStatus(
      taskId,
      'completed',
      { totalPages, totalProducts, totalSponsored },
      context,
      maxRetries
    );
  }

  /**
   * 保存任务失败状态
   * @param {number} taskId - 任务ID
   * @param {string} errorMessage - 错误信息
   * @param {Object} context - 上下文对象
   * @param {number} maxRetries - 最大重试次数
   */
  static async saveTaskFailure(taskId, errorMessage, context = {}, maxRetries = 5) {
    await this.updateTaskStatus(
      taskId,
      'failed',
      { errorMessage },
      context,
      maxRetries
    );
  }
}

module.exports = TaskIdManager;
