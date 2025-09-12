# Context Manager

通用浏览器上下文管理器，当前基于 Playwright 实现，支持 Context 级隔离、并发控制、任务队列管理，以及代理和 Cookie 配置。支持 Chrome、Firefox、Safari 等多种浏览器。

## 核心特性

- **多浏览器支持**: 支持 Chromium、Firefox、Webkit (Safari) 引擎 (当前基于 Playwright)
- **Context 隔离**: 每个任务使用独立的 BrowserContext，任务完成后立即销毁
- **并发控制**: 可配置最大并发 Context 数量
- **代理支持**: Context 级代理配置，支持 HTTP/HTTPS 代理和认证
- **Cookie 管理**: Context 级 Cookie 隔离设置
- **Chrome User-Agent**: 只生成 Chrome 桌面端 User-Agent
- **任务队列**: 超出并发限制时自动排队处理

## 安装

```bash
npm install
```

## 使用

```javascript
const ContextManager = require('./ContextManager');

const manager = new ContextManager({
    maxConcurrency: 3,
    headless: true,
    useRandomUA: true,
    browserType: 'chromium' // 'chromium', 'firefox', 'webkit'
});

const result = await manager.addTask(async (page, context) => {
    await page.goto('https://example.com');
    return await page.title();
}, {
    proxy: 'http://user:pass@127.0.0.1:8080', // 支持 HTTP/HTTPS 代理认证
    cookies: [{
        name: 'session',
        value: 'abc123',
        domain: '.example.com'
    }]
});

await manager.close();
```

## 配置

| 参数 | 默认值 | 说明 |
|-----|--------|------|
| maxConcurrency | 3 | 最大并发数 |
| headless | true | 无头模式 |  
| useRandomUA | true | 随机Chrome桌面端UA |
| browserType | 'chromium' | 浏览器类型 |
| browserOptions | {} | 浏览器选项 |

## 任务选项

| 参数 | 说明 |
|-----|------|
| proxy | 代理地址 (支持 HTTP/HTTPS 认证) |
| cookies | Context专用cookies |
| userAgent | 自定义User-Agent |
| viewport | 视窗大小 |