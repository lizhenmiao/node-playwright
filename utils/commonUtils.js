const UserAgent = require('user-agents');
const { logger } = require('./logger');

/**
 * 通用工具类，供ContextManager和HttpManager共同使用
 * 包含代理解析、Cookie处理、User-Agent生成等公共功能
 */
class CommonUtils {
  /**
   * 解析代理字符串
   * 支持格式: protocol://username:password@host:port
   * @param {string} proxyString - 代理字符串
   * @returns {Object|null} 解析后的代理配置
   */
  static parseProxy(proxyString) {
    if (!proxyString) return null;

    // 支持末尾斜杠的正则表达式，兼容项目规范
    const regex = /^(https?|socks[45]?):\/\/(?:([^:]+):([^@]+)@)?([^:\/]+):(\d+)\/?$/;
    const match = proxyString.match(regex);

    if (!match) {
      throw new Error(`Invalid proxy format: ${proxyString}`);
    }

    const [, protocol, username, password, host, port] = match;

    return {
      protocol,
      host,
      port: parseInt(port),
      username,
      password,
      // 为不同管理器提供不同格式的URL
      url: username ? `${protocol}://${username}:${password}@${host}:${port}` : `${protocol}://${host}:${port}`,
      server: `${protocol}://${host}:${port}` // Playwright格式
    };
  }

  /**
   * 解析Cookie字符串为对象数组（Playwright格式）
   * @param {string} cookieString - Cookie字符串
   * @param {string} domain - Cookie域名
   * @returns {Array} Cookie对象数组
   */
  static parseCookieStringToObjects(cookieString, domain = null) {
    if (!cookieString) return [];

    const cookies = [];
    const pairs = cookieString.split(';');

    for (const pair of pairs) {
      const [name, ...valueParts] = pair.trim().split('=');
      if (name && valueParts.length > 0) {
        const cookie = {
          name: name.trim(),
          value: valueParts.join('=').trim()
        };

        // 只有提供了domain才设置domain和path
        if (domain) {
          cookie.domain = domain.startsWith('.') ? domain : ('.' + domain);
          cookie.path = '/';
        }

        cookies.push(cookie);
      }
    }

    return cookies;
  }

  /**
   * 获取随机桌面版Chrome User-Agent
   * @param {boolean} useRandom - 是否使用随机UA
   * @returns {string} User-Agent字符串
   */
  static getChromeDesktopUA(useRandom = true) {
    if (useRandom) {
      try {
        const userAgent = new UserAgent({ deviceCategory: 'desktop' });
        return userAgent.toString();
      } catch (error) {
        // 如果随机生成失败，回退到默认UA
        return CommonUtils.getDefaultChromeUA();
      }
    }
    return CommonUtils.getDefaultChromeUA();
  }

  /**
   * 获取默认Chrome User-Agent
   * 作为随机UA失败时的备选方案
   * @returns {string} 默认User-Agent字符串
   */
  static getDefaultChromeUA() {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  }

  /**
   * 为Playwright创建代理配置
   * @param {Object} proxyInfo - 解析后的代理信息
   * @returns {Object} Playwright代理配置
   */
  static createPlaywrightProxyConfig(proxyInfo) {
    if (!proxyInfo) return null;

    const proxyConfig = {
      server: proxyInfo.server
    };

    // Playwright 支持 HTTP/HTTPS 代理认证，但不支持 SOCKS 代理认证
    if (proxyInfo.username && proxyInfo.password &&
      (proxyInfo.protocol === 'http' || proxyInfo.protocol === 'https')) {
      proxyConfig.username = proxyInfo.username;
      proxyConfig.password = proxyInfo.password;
    }

    return proxyConfig;
  }

  /**
   * 格式化毫秒为分钟和秒
   * @param {number} ms - 毫秒
   * @returns {string} 格式化后的字符串
   */
  static formatMilliseconds(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) {
      return `${totalSeconds}秒`;
    } else {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}分钟${seconds}秒`;
    }
  }

  /**
   * 获取域名
   * @param {string} url - 网址
   * @returns {string} 域名
   */
  static getDomain(url) {
    try {
      // 获取域名，可能带 www.
      const hostname = new URL(url).hostname;
      // 去掉 www. 前缀（如果有）
      return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    } catch (e) {
      // URL 解析失败，返回空或原字符串
      return '';
    }
  }

  /**
   * 处理验证码
   * @param {Object} page - Playwright 页面对象
   * @param {string} logPrefix - 日志前缀（如 "任务 123:" 或 "域名 amazon.com:"）
   */
  static async handleCaptcha(page, logPrefix) {
    logger.info(`${logPrefix} 检查验证码...`);

    try {
      // 检查是否存在验证码表单
      const captchaForm = await page.$('form[action="/errors/validateCaptcha"]');

      if (captchaForm) {
        logger.info(`${logPrefix} 发现验证码，尝试点击按钮`);

        // 查找按钮并点击
        const button = await captchaForm.$('button, input[type="submit"]');
        if (button) {
          await button.click();
          logger.info(`${logPrefix} 已点击验证码按钮，等待页面刷新...`);

          // 等待页面刷新
          await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

          logger.info(`${logPrefix} 验证码页面刷新完成`);
        } else {
          logger.warn(`${logPrefix} 验证码表单中未找到按钮`);
        }
      } else {
        logger.info(`${logPrefix} 未发现验证码`);
      }
    } catch (error) {
      logger.warn(`${logPrefix} 验证码处理出错: ${error.message}`);
      // 验证码处理失败不抛出错误，继续执行
    }
  }
}

module.exports = CommonUtils;