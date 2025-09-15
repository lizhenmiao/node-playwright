# 通用数据抓取 API 服务

基于 Express.js 构建的通用数据抓取 API 服务，采用插件化架构设计，支持多种数据源的抓取和处理。通过可扩展的插件系统，可以轻松添加新的抓取功能，提供结构化的 JSON 数据输出。

## 核心特性

- **插件化架构**: 支持自定义插件，轻松扩展新的抓取功能
- **多数据源支持**: 可配置不同的数据源和抓取策略
- **浏览器自动化**: 集成 Playwright，支持动态页面抓取
- **HTML 解析**: 基于 Cheerio 的高效 HTML 数据提取
- **RESTful API**: 提供简洁的 REST API 接口
- **日志管理**: 集成 Winston 日志系统，支持日志轮转
- **定时任务**: 内置 cron 定时任务支持
- **数据库支持**: 集成 MySQL 数据库和 Sequelize ORM
- **代理支持**: 支持代理配置和 IP 轮换
- **健康检查**: 提供服务健康状态监控接口

## 当前支持的插件

- **Amazon 抓取器**: 支持 Amazon 产品信息抓取和分类
- **IP 检查器**: 网络 IP 状态检查功能
- **更多插件**: 可根据需求自定义开发

## 部署步骤

### 1. 环境准备

确保系统已安装：
- Node.js (版本 >= 16.0.0)
- MySQL 数据库 (可选，如需数据库功能)

### 2. 项目安装

```bash
# 克隆项目
git clone <repository-url>
cd universal-data-scraper-api

# 安装依赖
npm install
```

### 3. 环境配置

```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

配置说明：
```env
# 服务端口
PORT=3008

# 代理配置（可选）
PROXY_SERVER=proxy.example.com:8080
PROXY_USERNAME=your_username
PROXY_PASSWORD=your_password

# 数据库配置（可选）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=scraper_data
DB_USER=root
DB_PASSWORD=your_password
```

### 4. 数据库初始化（可选）

如果需要使用数据库功能：

```bash
# 初始化数据库
npm run db:init
```

### 5. 启动服务

```bash
# 开发环境
npm start

# 生产环境（推荐使用 PM2）
npm install -g pm2

# 启动服务
pm2 start server.js --name "scraper-api"

# 设置开机自启
pm2 startup
pm2 save

# 其他 PM2 管理命令
pm2 list                    # 查看所有进程
pm2 restart scraper-api     # 重启服务
pm2 stop scraper-api        # 停止服务
pm2 delete scraper-api      # 删除服务
pm2 logs scraper-api        # 查看日志
pm2 monit                   # 监控面板
```

### 6. 验证部署

```bash
# 健康检查
curl http://localhost:3008/health

# 测试 Amazon 数据提取功能（测试接口）
curl http://localhost:3008/api/products
```

## API 接口

### 健康检查
```http
GET /health
```

响应示例：
```json
{
  "status": "OK",
  "message": "数据抓取API服务正常运行",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 测试接口 - Amazon 数据提取
```http
GET /api/products
```

**注意**: 此接口仅用于测试 Amazon 页面数据提取功能是否正常工作。

响应示例：
```json
{
  "success": true,
  "data": {
    "organic_products": [...],
    "sponsored_products": [...],
    "sp_rec_products": [...],
    "sb_sbv_products": [...]
  },
  "message": "成功提取 X 个产品数据",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 插件开发

### 创建新插件

在 `plugins/` 目录下创建新的插件文件：

```javascript
// plugins/yourPlugin.js
const { logger } = require('../utils/logger');

/**
 * 自定义插件函数
 * @param {Object} page - Playwright页面对象
 * @param {Object} context - 上下文对象，包含任务ID、重试次数等
 * @param {Object} pluginOptions - 插件参数
 */
async function yourPlugin(page, context, pluginOptions = {}) {
  const { param1, param2 } = pluginOptions;
  
  logger.info(`任务 ${context.taskId}: 开始执行自定义插件...`);
  
  try {
    // 实现你的抓取逻辑
    await page.goto('https://example.com');
    
    const result = await page.evaluate(() => {
      // 页面数据提取逻辑
      return document.title;
    });
    
    // 方式1: 调用 context.complete() 完成任务（推荐）
    logger.info(`任务 ${context.taskId}: 插件执行成功`);
    context.complete({ success: true, data: result });
    
    // 方式2: 直接返回结果（可选，如果没有调用 complete() 会自动完成）
    // return { success: true, data: result };
    
  } catch (error) {
    logger.error(`任务 ${context.taskId}: 插件执行失败 - ${error.message}`);
    
    // 判断是否可以重试
    const canRetry = context.retryCount < 3;
    context.failed(error, canRetry);
  }
}

module.exports = yourPlugin;
```

### 插件使用

在 ContextManager 中使用你的插件：

```javascript
const yourPlugin = require('./plugins/yourPlugin');

// 添加任务
const result = await manager.addTask(yourPlugin, {
  // Context 配置参数
  proxy: 'http://proxy:8080',
  zipCode: '10001'
}, {
  // 插件参数
  param1: 'value1',
  param2: 'value2'
});
```

### 返回值说明

插件函数的返回值是**可选的**：

1. **推荐方式**: 使用 `context.complete(result)` 显式完成任务
2. **自动方式**: 直接 `return result`，系统会自动完成任务
3. **混合方式**: 既调用 `complete()` 又有返回值时，返回值会被使用

```javascript
// 示例：ipCheck 插件的返回值
return { 
  ip: ipInfo, 
  taskId: context.taskId, 
  retryCount: context.retryCount 
};
```

## 项目结构

```
├── server.js              # 主服务文件
├── package.json           # 项目配置
├── .env                   # 环境配置
├── database/              # 数据库相关
│   ├── connection.js      # 数据库连接
│   ├── init.js           # 数据库初始化
│   └── operations.js     # 数据库操作
├── utils/                 # 工具函数
│   ├── AmazonExtractor.js # Amazon数据提取器
│   ├── Logger.js         # 日志管理
│   └── ...
├── html_cache/           # HTML缓存文件
├── html_files/           # HTML源文件
└── plugins/              # 插件模块
    ├── amazonScraper.js  # Amazon抓取插件
    ├── ipCheck.js        # IP检查插件
    └── ...               # 其他自定义插件
```

## 测试

```bash
# 测试 Amazon 数据提取
npm run test:amazon

# 测试 IP 检查功能
node test_ip.js

# 测试其他插件功能
node test_<plugin_name>.js
```

## 扩展性

该服务采用模块化设计，你可以：

1. **添加新的抓取插件**: 在 `plugins/` 目录下创建新插件
2. **自定义数据处理**: 修改 `utils/` 中的处理逻辑
3. **扩展 API 接口**: 在 `server.js` 中添加新的路由
4. **集成其他数据库**: 通过 Sequelize 支持多种数据库
5. **配置定时任务**: 使用 node-cron 添加定时抓取任务