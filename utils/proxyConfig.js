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
}

// 创建单例实例
const proxyConfig = new ProxyConfig();

module.exports = proxyConfig;