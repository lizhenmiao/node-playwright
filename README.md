# 通用数据抓取 API 服务

基于 Express.js 构建的通用数据抓取 API 服务，采用插件化架构设计，支持多种数据源的抓取和处理。通过可扩展的插件系统，可以轻松添加新的抓取功能，提供结构化的 JSON 数据输出。

## 核心特性

- **插件化架构**: 支持自定义插件，轻松扩展新的抓取功能
- **浏览器自动化**: 集成 Playwright，支持动态页面抓取
- **多并发支持**: 支持多任务并发执行，提高抓取效率
- **数据库支持**: 集成 MySQL 数据库和 Sequelize ORM
- **代理支持**: 支持隧道代理配置
- **日志管理**: 集成 Winston 日志系统，支持日志轮转

## 当前支持的插件

- **Amazon 抓取器**: 支持 Amazon 产品信息抓取和分类
- **IP 检查器**: 网络 IP 状态检查功能

## 本地开发

### 1. 安装依赖

```bash
# 克隆仓库
git clone <repository-url>
cd node-playwright

# 安装项目依赖
npm install

# 安装所有 Playwright 浏览器
npx playwright install

# 安装 Playwright 浏览器 (必须)
npx playwright install chromium

# Linux 系统需要安装系统依赖
npx playwright install-deps
```

### 2. 环境配置

```bash
# 复制环境配置模板
cp .env.example .env

# 编辑配置文件，修改为你的实际配置
nano .env
```

### 3. 数据库配置

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE scraper_data CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 初始化数据库表结构
node database/init.js
```

### 4. 启动开发服务

```bash
# 普通启动
node server.js

# 或使用 nodemon 自动重启
npm install -g nodemon
nodemon server.js
```

### 5. 测试功能

```bash
# 运行测试文件
node test/amazon.js
node test/ip.js
```

## PM2 生产环境部署

### 1. 安装 PM2

```bash
npm install -g pm2
```

### 2. 启动应用

```bash
# 启动单实例
pm2 start server.js --name "scraper-api"
```

### 3. 设置开机自启

```bash
pm2 startup
pm2 save
```

### 4. 常用 PM2 管理命令

```bash
pm2 list                    # 查看所有进程
pm2 restart scraper-api     # 重启服务
pm2 reload scraper-api      # 无宕机重载
pm2 stop scraper-api        # 停止服务
pm2 delete scraper-api      # 删除进程
pm2 logs scraper-api        # 查看日志
pm2 monit                   # 监控面板
```

## 项目结构

```
├── server.js              # 主服务文件
├── package.json           # 项目配置
├── .env                   # 环境配置
├── database/              # 数据库相关
├── utils/                 # 工具函数
├── test/                  # 测试文件
├── logs/                  # 日志文件目录
├── html_files/            # 抓取的HTML源文件
└── plugins/               # 插件模块
    ├── amazonScraper.js   # Amazon抓取插件
    └── ipCheck.js         # IP检查插件
```

## API 接口

### 测试接口 - Amazon 数据提取
```http
GET /api/testExtractProducts
```

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
  "timestamp": "2025-09-17T02:18:17.000Z"
}
```
