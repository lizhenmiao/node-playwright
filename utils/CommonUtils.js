const UserAgent = require('user-agents');

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
          cookie.domain = domain;
          cookie.path = '/';
        }

        cookies.push(cookie);
      }
    }

    return cookies;
  }

  /**
   * 将Cookie对象数组转换为HTTP请求格式字符串
   * @param {Array} cookieObjects - Cookie对象数组
   * @returns {string} Cookie字符串
   */
  static cookieObjectsToHttpString(cookieObjects) {
    if (!Array.isArray(cookieObjects) || cookieObjects.length === 0) return '';
    
    return cookieObjects.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
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
   * 处理混合Cookie输入（字符串或对象数组）
   * @param {string|Array} cookies - Cookie输入
   * @param {string} domain - Cookie域名
   * @param {string} format - 输出格式 ('objects' | 'http')
   * @returns {Array|string} 处理后的Cookie
   */
  static processCookies(cookies, domain = null, format = 'objects') {
    if (!cookies) return format === 'objects' ? [] : '';

    let cookieObjects = [];

    if (typeof cookies === 'string') {
      cookieObjects = CommonUtils.parseCookieStringToObjects(cookies, domain);
    } else if (Array.isArray(cookies)) {
      cookieObjects = cookies.map(cookie => {
        if (typeof cookie === 'string') {
          // 如果数组中包含字符串，解析它
          return CommonUtils.parseCookieStringToObjects(cookie, domain)[0];
        }
        return cookie;
      }).filter(Boolean);
    }

    if (format === 'http') {
      return CommonUtils.cookieObjectsToHttpString(cookieObjects);
    }

    return cookieObjects;
  }

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
}

module.exports = CommonUtils;