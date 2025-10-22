const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./logger');
const ContextManager = require('./contextManager');
const cookiesGetter = require('../plugins/cookiesGetter');
const proxyConfig = require('./proxyConfig');

// Cookies 存储文件路径
const COOKIES_STORAGE_PATH = path.join(__dirname, '../cookies_storage.json');

// Cookies 有效期（20小时，单位：毫秒）
const COOKIES_EXPIRY_TIME = 20 * 60 * 60 * 1000;

/**
 * Cookies 管理器
 * 负责检查、获取、存储和更新 Amazon cookies
 */
class CookiesManager {
  constructor() {
    this.cookiesData = null;
    this.fileLastModified = null; // 文件最后修改时间
  }

  /**
   * 智能加载存储的 cookies 数据
   * 只有在文件被修改时才重新读取
   */
  async loadCookiesData() {
    try {
      // 检查文件是否存在
      const stats = await fs.stat(COOKIES_STORAGE_PATH).catch(() => null);

      if (!stats) {
        // 文件不存在，创建空数据
        if (!this.cookiesData) {
          logger.warn('Cookies 存储文件不存在，将创建新的');
          this.cookiesData = { cookies: [] };
        }
        return this.cookiesData;
      }

      // 检查文件是否被修改
      const currentModified = stats.mtime.getTime();

      if (this.fileLastModified === currentModified && this.cookiesData) {
        // 文件未修改，使用缓存数据
        return this.cookiesData;
      }

      // 文件被修改或首次加载，重新读取
      const data = await fs.readFile(COOKIES_STORAGE_PATH, 'utf-8');
      this.cookiesData = JSON.parse(data);
      this.fileLastModified = currentModified;

      return this.cookiesData;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn('Cookies 存储文件不存在，将创建新的');
        this.cookiesData = { cookies: [] };
        return this.cookiesData;
      }
      throw error;
    }
  }

  /**
   * 保存 cookies 数据到文件
   */
  async saveCookiesData(domain) {
    try {
      await fs.writeFile(
        COOKIES_STORAGE_PATH,
        JSON.stringify(this.cookiesData, null, 2),
        'utf-8'
      );

      // 更新文件时间戳
      const stats = await fs.stat(COOKIES_STORAGE_PATH);
      this.fileLastModified = stats.mtime.getTime();

      logger.info(`${domain} Cookies 数据已保存到文件`);
    } catch (error) {
      logger.error(`${domain} 保存 cookies 数据失败:`, error.message);
      throw error;
    }
  }

  /**
   * 检查指定域名的 cookies 是否过期
   * @param {string} domain - Amazon 域名
   * @returns {boolean} - true 表示过期需要更新，false 表示有效
   */
  async isCookiesExpired(domain) {
    // 每次都重新加载，确保数据是最新的
    await this.loadCookiesData();

    const cookieItem = this.cookiesData.cookies.find(item => item.domain === domain);

    if (!cookieItem) {
      logger.info(`域名 ${domain} 没有存储的 cookies，需要获取`);
      return true;
    }

    const now = Date.now();
    const timeDiff = now - cookieItem.timestamp;
    const isExpired = timeDiff > COOKIES_EXPIRY_TIME;

    if (isExpired) {
      const hours = Math.floor(timeDiff / (60 * 60 * 1000));
      logger.info(`域名 ${domain} 的 cookies 已过期（已存储 ${hours} 小时）`);
    } else {
      const remainingHours = Math.floor((COOKIES_EXPIRY_TIME - timeDiff) / (60 * 60 * 1000));
      logger.info(`域名 ${domain} 的 cookies 仍然有效（还剩 ${remainingHours} 小时）`);
    }

    return isExpired;
  }

  /**
   * 统一的 cookies 更新流程
   * 根据提供的域名列表，检查并更新需要的 cookies
   * @param {Array} domains - 需要检查的域名列表，格式: [{ domain, zipCode, zipSeparator }]
   * @returns {Array} - 更新结果列表
   */
  async updateCookiesForDomains(domains) {
    logger.info(`开始检查和更新 ${domains.length} 个域名的 cookies`);

    // 每次都重新加载，确保数据是最新的
    await this.loadCookiesData();

    const results = [];
    const domainsToUpdate = [];

    // 检查每个域名的 cookies 状态
    for (const { domain, zipCode, zipSeparator } of domains) {
      const isExpired = await this.isCookiesExpired(domain);

      if (isExpired) {
        domainsToUpdate.push({ domain, zipCode, zipSeparator });
      } else {
        results.push({
          domain,
          success: true,
          message: 'Cookies 仍然有效，跳过更新'
        });
      }
    }

    // 如果没有需要更新的域名，直接返回
    if (domainsToUpdate.length === 0) {
      logger.info('所有域名的 cookies 都有效，无需更新');
      return results;
    }

    // 创建 ContextManager 实例，批量处理
    const manager = new ContextManager({
      maxConcurrency: 5,
      headless: true,
      useRandomUA: true,
      browserType: 'chromium'
    });

    try {
      // 批量添加所有获取 cookies 的任务
      const updatePromises = domainsToUpdate.map(({ domain, zipCode, zipSeparator }) => {
        logger.info(`开始更新域名 ${domain} 的 cookies...`);

        return manager.addTask(
          cookiesGetter,
          {
            proxy: proxyConfig.getProxyUrl()
          },
          {
            domain: domain,
            zipCode: zipCode,
            zipSeparator: zipSeparator
          }
        ).then(result => {
          // 更新成功，保存到存储
          return this.saveCookieData(result);
        }).then(cookieData => {
          return {
            domain,
            success: true,
            message: 'Cookies 已更新',
            data: cookieData
          };
        }).catch(error => {
          logger.error(`域名 ${domain} cookies 更新失败:`, error.message);
          return {
            domain,
            success: false,
            message: error.message
          };
        });
      });

      // 等待所有任务完成
      const updateResults = await Promise.all(updatePromises);
      results.push(...updateResults);

      logger.info(`批量更新完成，成功: ${updateResults.filter(r => r.success).length}，失败: ${updateResults.filter(r => !r.success).length}`);

    } finally {
      // 关闭 ContextManager
      await manager.close();
    }

    return results;
  }

  /**
   * 保存单个域名的 cookie 数据
   * @param {Object} cookieData - cookie 数据
   */
  async saveCookieData(cookieData) {
    const { domain, zipCode, cookie } = cookieData;

    // 每次都重新加载，确保数据是最新的
    await this.loadCookiesData();

    const newCookieData = {
      domain,
      zipCode,
      cookie,
      timestamp: Date.now()
    };

    // 查找是否已存在该域名的 cookies
    const existingIndex = this.cookiesData.cookies.findIndex(
      item => item.domain === domain
    );

    if (existingIndex !== -1) {
      // 更新现有记录
      this.cookiesData.cookies[existingIndex] = newCookieData;
      logger.info(`已更新域名 ${domain} 的 cookies`);
    } else {
      // 添加新记录
      this.cookiesData.cookies.push(newCookieData);
      logger.info(`已添加域名 ${domain} 的 cookies`);
    }

    // 保存到文件
    await this.saveCookiesData(domain);

    return newCookieData;
  }

  /**
   * 获取所有存储的 cookies 配置（用于替代 cookiesConfig）
   * @returns {Array} - cookies 配置数组
   */
  async getAllCookiesConfig() {
    if (!this.cookiesData) {
      await this.loadCookiesData();
    }

    return this.cookiesData.cookies.map(item => ({
      zipCode: item.zipCode,
      domain: item.domain,
      cookie: item.cookie
    }));
  }
}

// 导出单例
const cookiesManager = new CookiesManager();

module.exports = {
  cookiesManager,
  CookiesManager
};

