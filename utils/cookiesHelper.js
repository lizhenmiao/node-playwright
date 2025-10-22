const { cookiesManager } = require('./cookiesManager');
const { cookiesConfig } = require('./cookiesConfig');
const { logger } = require('./logger');

/**
 * Cookies 辅助工具
 * 提供便捷的 cookies 管理功能
 */

/**
 * 从 URL 中提取域名
 * @param {string} url - 完整的 URL
 * @returns {string} - 域名
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 移除 www. 前缀
    const domain = hostname.replace(/^www\./, '');

    return domain;
  } catch (error) {
    logger.error('提取域名失败:', error.message);
    return null;
  }
}

/**
 * 根据域名获取邮编配置
 * @param {string} domain - 域名
 * @returns {Object} - 包含 zipCode 和 zipSeparator 的配置对象
 */
function getConfigByDomain(domain) {
  const config = cookiesConfig.find(item => item.domain === domain);

  if (!config) {
    logger.warn(`未找到域名 ${domain} 的邮编配置`);
    return null;
  }

  return {
    zipCode: config.zipCode,
    zipSeparator: config.zipSeparator || null
  };
}

/**
 * 准备并检查 cookies（在爬取任务开始前调用）
 * @param {Array} urls - 需要爬取的 URL 列表
 * @returns {Promise<Object>} - 准备结果
 */
async function prepareCookies(urls) {
  try {
    // 提取所有唯一的域名
    const domains = [...new Set(urls.map(url => extractDomain(url)))].filter(Boolean);

    logger.info(`发现 ${domains.length} 个不同的域名: ${domains.join(', ')}`);

    // 为每个域名准备 cookies 配置
    const cookiesConfigs = domains.map(domain => {
      const config = getConfigByDomain(domain);
      if (!config) return null;

      return {
        domain,
        zipCode: config.zipCode,
        zipSeparator: config.zipSeparator
      };
    }).filter(config => config !== null);

    if (cookiesConfigs.length === 0) {
      logger.warn('没有找到需要更新的 cookies 配置');
      return { success: true, updated: [], skipped: [] };
    }

    // 批量检查和更新 cookies
    const results = await cookiesManager.updateCookiesForDomains(cookiesConfigs);

    // 统计结果
    const updated = results.filter(r => r.success && r.message.includes('已更新'));
    const skipped = results.filter(r => r.success && r.message.includes('跳过'));
    const failed = results.filter(r => !r.success);

    logger.info(`Cookies 准备完成: 更新 ${updated.length} 个, 跳过 ${skipped.length} 个, 失败 ${failed.length} 个`);

    if (failed.length > 0) {
      logger.error('以下域名的 cookies 更新失败:');
      failed.forEach(f => logger.error(`- ${f.domain}: ${f.message}`));
    }

    return {
      success: failed.length === 0,
      updated: updated.map(r => r.domain),
      skipped: skipped.map(r => r.domain),
      failed: failed.map(r => ({ domain: r.domain, error: r.message }))
    };

  } catch (error) {
    logger.error('准备 cookies 时出错:', error.message);
    throw error;
  }
}

/**
 * 获取合并后的 cookies 配置
 * 优先使用存储的 cookies，如果不存在则返回空 cookie
 * @returns {Promise<Array>} - cookies 配置数组
 */
async function getMergedCookiesConfig() {
  try {
    // 获取存储的 cookies
    const storedCookies = await cookiesManager.getAllCookiesConfig();

    // 创建域名到存储 cookies 的映射
    const storedMap = new Map();
    storedCookies.forEach(item => {
      storedMap.set(item.domain, item);
    });

    // 合并配置：优先使用存储的 cookies
    const mergedConfig = cookiesConfig.map(originalConfig => {
      const stored = storedMap.get(originalConfig.domain);

      return {
        zipCode: originalConfig.zipCode,
        domain: originalConfig.domain,
        cookie: stored ? stored.cookie : '' // 如果没有存储的 cookie，返回空字符串
      };
    });

    return mergedConfig;

  } catch (error) {
    logger.error('获取合并 cookies 配置失败:', error.message);
    // 如果出错，返回邮编配置（没有 cookie）
    return cookiesConfig.map(config => ({
      ...config,
      cookie: ''
    }));
  }
}

module.exports = {
  extractDomain,
  getConfigByDomain,
  prepareCookies,
  getMergedCookiesConfig
};

