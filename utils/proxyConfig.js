/**
 * 代理配置模块
 * 提供统一的代理信息获取接口
 */

// 加载环境变量
require('dotenv').config();

class ProxyConfig {
  constructor() {
    this._config = this._loadConfig();
  }

  _loadConfig() {
    return {
      // 支持多种格式的代理配置
      server: process.env.PROXY_SERVER,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    };
  }

  /**
   * 获取完整的代理URL
   */
  getProxyUrl() {
    if (!this._config.server) return null;
    
    // 确保server有协议前缀
    let serverUrl = this._config.server;
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      serverUrl = 'http://' + serverUrl;
    }
    
    // 如果有用户名密码，手动构建带认证的URL（避免使用URL构造函数添加末尾斜杠）
    if (this._config.username && this._config.password) {
      // 解析原始URL
      const urlMatch = serverUrl.match(/^(https?):\/\/([^:\/]+):(\d+)$/);
      if (urlMatch) {
        const [, protocol, host, port] = urlMatch;
        return `${protocol}://${this._config.username}:${this._config.password}@${host}:${port}`;
      }
    }
    
    return serverUrl;
  }

  /**
   * 获取代理服务器地址
   */
  getServer() {
    return this._config.server;
  }

  /**
   * 获取代理用户名
   */
  getUsername() {
    return this._config.username;
  }

  /**
   * 获取代理密码
   */
  getPassword() {
    return this._config.password;
  }

  /**
   * 检查是否启用代理
   */
  isEnabled() {
    return !!(this._config.server && (process.env.USE_PROXY !== 'false'));
  }

  /**
   * 获取所有配置信息
   */
  getConfig() {
    return {
      enabled: this.isEnabled(),
      server: this._config.server,
      username: this._config.username,
      hasPassword: !!this._config.password,
      proxyUrl: this.getProxyUrl()
    };
  }

  /**
   * 获取用于HTTP请求的代理配置
   */
  getHttpProxyConfig() {
    if (!this.isEnabled()) return null;

    const proxyUrl = this.getProxyUrl();
    if (!proxyUrl) return null;

    return {
      proxy: proxyUrl,
      // 或者分别返回各个部分
      host: this._config.server?.split(':')[0],
      port: parseInt(this._config.server?.split(':')[1]) || 8080,
      auth: this._config.username && this._config.password ? {
        username: this._config.username,
        password: this._config.password
      } : null
    };
  }

  /**
   * 获取用于浏览器的代理配置
   */
  getBrowserProxyConfig() {
    if (!this.isEnabled()) return null;

    const proxyUrl = this.getProxyUrl();
    if (!proxyUrl) return null;

    return {
      server: proxyUrl,
      username: this._config.username,
      password: this._config.password
    };
  }
}

// 创建单例实例
const proxyConfig = new ProxyConfig();

module.exports = proxyConfig;