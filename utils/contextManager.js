const { chromium, firefox, webkit } = require('playwright');
const EventEmitter = require('events');
const CommonUtils = require('./commonUtils');
const { logger } = require('./logger');

/**
 * 基于 Playwright 的浏览器上下文管理器
 * 支持并发控制、代理、Cookie、User-Agent 等功能
 */
class ContextManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // 并发控制配置
    this.maxConcurrency = options.maxConcurrency || 3;
    this.browser = null;
    this.initPromise = null; // 浏览器初始化Promise缓存，防止并发创建
    this.activeContexts = new Set(); // 当前活跃的浏览器上下文
    this.taskQueue = []; // 任务队列
    this.isProcessing = false; // 是否正在处理队列
    this.taskIdCounter = 0; // 任务ID计数器
    this.taskResults = []; // 收集所有任务的结果

    // 浏览器类型选择 (Playwright 支持三种浏览器引擎)
    this.browserType = options.browserType || 'chromium'; // 'chromium', 'firefox', 'webkit'

    // 浏览器启动配置
    this.browserOptions = {
      headless: options.headless !== false, // 默认无头模式
      args: this.buildBrowserArgs(), // 构建浏览器启动参数
      ...options.browserOptions
    };

    // 是否使用随机 User-Agent
    this.useRandomUA = options.useRandomUA !== false;
  }

  /**
   * 构建浏览器启动参数
   */
  buildBrowserArgs() {
    const args = [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--no-sandbox',
      '--start-maximized',
      '--start-fullscreen'
    ];

    return args;
  }

  /**
   * 初始化浏览器实例
   * Playwright 与 Puppeteer 的主要区别：支持多种浏览器引擎
   * 使用 Promise 缓存防止并发创建多个浏览器实例
   */
  async init() {
    // 如果已经有浏览器实例，直接返回
    if (this.browser) return;

    // 如果正在初始化中，等待初始化完成
    if (this.initPromise) {
      return await this.initPromise;
    }

    // 创建初始化Promise并缓存，防止并发创建
    this.initPromise = this.createBrowser();

    try {
      await this.initPromise;
    } finally {
      // 初始化完成后清除Promise缓存
      this.initPromise = null;
    }
  }

  /**
   * 实际创建浏览器实例的方法
   * 从 init() 中分离出来，便于 Promise 缓存管理
   */
  async createBrowser() {
    try {
      let browserEngine;
      switch (this.browserType) {
        case 'firefox':
          browserEngine = firefox;
          break;
        case 'webkit':
          browserEngine = webkit;
          break;
        default:
          browserEngine = chromium;
      }

      this.browser = await browserEngine.launch(this.browserOptions);
      logger.info(`${this.browserType} browser launched successfully`);
    } catch (error) {
      // 创建失败时重置状态
      this.browser = null;
      throw new Error(`Failed to launch ${this.browserType} browser: ${error.message}`);
    }
  }

  /**
   * 发送状态变化事件
   * 用于监控并发任务的执行状态
   */
  emitStatusChange() {
    const status = {
      activeContexts: this.activeContexts.size,
      queueLength: this.taskQueue.length,
      maxConcurrency: this.maxConcurrency,
      browserType: this.browserType,
      timestamp: new Date().toISOString()
    };
    this.emit('statusChange', status);
  }

  /**
   * 创建浏览器上下文 (Context)
   * 每个 Context 都是独立的，有自己的 cookies、localStorage 等
   */
  async createBrowserContext(options = {}) {
    if (!this.browser) {
      await this.init();
    }

    const contextOptions = {
      locale: 'en-US',
    };

    // 设置代理 - Playwright 在 Context 级别设置代理
    if (options.proxy) {
      const proxyInfo = CommonUtils.parseProxy(options.proxy);
      const proxyConfig = CommonUtils.createPlaywrightProxyConfig(proxyInfo);
      if (proxyConfig) {
        contextOptions.proxy = proxyConfig;
      }
    }

    // 设置 User-Agent
    const userAgent = options.userAgent ||
      CommonUtils.getChromeDesktopUA(this.useRandomUA);
    if (userAgent) {
      contextOptions.userAgent = userAgent;
    }

    // 设置视窗大小 - Playwright 支持在 Context 级别设置
    if (options.viewport) {
      contextOptions.viewport = options.viewport || null;
    }

    // 创建浏览器上下文 - 每个 Context 都是完全独立的无痕环境
    const context = await this.browser.newContext(contextOptions);

    return context;
  }

  /**
   * 从上下文创建页面并配置资源拦截和 Cookies
   * Playwright 的路由拦截比 Puppeteer 更强大和简洁
   */
  async createPageFromContext(context, options = {}, pluginOptions = {}) {
    // 创建页面
    const page = await context.newPage();

    // 资源拦截 - 提升加载速度，减少带宽消耗
    // Playwright 的 route 方法比 Puppeteer 的 setRequestInterception 更高效
    await page.route('**/*', (route, request) => {
      const resourceType = request.resourceType();
      const url = request.url();

      // 拦截静态资源以提升性能
      if (resourceType === 'stylesheet' ||
        resourceType === 'image' ||
        resourceType === 'font' ||
        resourceType === 'media' ||
        url.endsWith('.css') ||
        url.endsWith('.png') ||
        url.endsWith('.jpg') ||
        url.endsWith('.jpeg') ||
        url.endsWith('.gif') ||
        url.endsWith('.svg') ||
        url.endsWith('.webp') ||
        url.endsWith('.ico') ||
        url.endsWith('.woff') ||
        url.endsWith('.woff2') ||
        url.endsWith('.ttf')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // 设置 Cookies - Playwright 在 Context 级别管理 Cookies
    // 只有爬取任务（有 url 参数）才需要设置 cookies，获取 cookies 的任务不需要
    if (pluginOptions.url && options.zipCode) {
      // 动态引入避免循环依赖
      const { getMergedCookiesConfig } = require('./cookiesHelper');
      const cookiesConfig = await getMergedCookiesConfig();
      const { cookie } = cookiesConfig.find(item => String(item.zipCode) === String(options.zipCode) && pluginOptions.url.indexOf(item.domain) > -1) || {}

      if (cookie) {
        if (typeof cookie === 'string') {
          if (!options.cookieDomain) {
            throw new Error('当使用 cookie string 时，cookie domain 是必需的');
          }
          const parsedCookies = CommonUtils.parseCookieStringToObjects(cookie, options.cookieDomain);
          await context.addCookies(parsedCookies);
        } else if (Array.isArray(cookie)) {
          for (const cookie of cookie) {
            if (typeof cookie === 'string') {
              if (!options.cookieDomain) {
                throw new Error('当使用 cookie string 时，cookie domain 是必需的');
              }
              const parsedCookies = CommonUtils.parseCookieStringToObjects(cookie, options.cookieDomain);
              await context.addCookies(parsedCookies);
            } else {
              await context.addCookies([cookie]);
            }
          }
        }
      }
    }

    return page;
  }

  /**
   * 添加任务到队列
   * 延迟创建 Context，只在任务开始执行时才创建，提升性能
   * @param {Function} taskFunction - 插件函数
   * @param {Object} options - Context配置参数 (cookies, proxy, userAgent等)
   * @param {Object} pluginOptions - 插件参数 (url, keyword, maxPage等)
   */
  addTask(taskFunction, options = {}, pluginOptions = {}) {
    return new Promise((resolve, reject) => {
      // 生成唯一 taskId
      const taskId = ++this.taskIdCounter;

      // 只存储任务信息，不提前创建 context
      // context 将在 executeTask 中延迟创建
      this.taskQueue.push({
        taskFunction,
        taskId,
        options, // Context配置参数
        pluginOptions, // 插件参数
        resolve,
        reject,
        retryCount: 0, // 当前重试次数
        originalTaskFunction: taskFunction // 保存原始任务函数
      });

      // 立即尝试处理队列
      this.processQueue();
    });
  }

  /**
   * 处理任务队列 - 并发控制核心逻辑
   * 确保同时运行的任务数不超过 maxConcurrency
   */
  processQueue() {
    // 防止重复处理和无任务处理
    if (this.isProcessing || this.taskQueue.length === 0) return;
    // 并发限制检查
    if (this.activeContexts.size >= this.maxConcurrency) return;

    this.isProcessing = true;

    // 批量启动任务直到达到并发限制
    while (this.taskQueue.length > 0 && this.activeContexts.size < this.maxConcurrency) {
      const task = this.taskQueue.shift();

      // activeContexts 只存储 taskId，保持一致性
      this.activeContexts.add(task.taskId);

      // 发送状态更新事件
      this.emitStatusChange();

      // 异步执行任务 - 不等待完成，实现真正的并发
      this.executeTask(task);
    }

    this.isProcessing = false;
  }

  /**
   * 检查所有任务是否完成
   * 当队列为空且没有活跃上下文时，发送完成事件
   */
  checkAllTasksCompleted() {
    // 使用 setImmediate 延迟检查，避免并发完成时的重复调用
    setImmediate(() => {
      if (this.taskQueue.length === 0 && this.activeContexts.size === 0) {
        logger.info('=== 所有任务完成 ===');
        // 将所有任务结果传递给completed事件
        this.emit('completed', this.taskResults);
      }
    });
  }

  /**
   * 执行单个任务
   * 在任务开始执行时才创建 context，实现延迟创建优化
   */
  async executeTask(task) {
    let page = null;
    let context = null;

    try {
      // 在任务开始执行时才创建 context（延迟创建）
      context = await this.createBrowserContext(task.options);

      // 保存 context 到任务对象中，供后续清理使用
      task.context = context;

      // 从已创建的 context 创建 page
      page = await this.createPageFromContext(context, task.options, task.pluginOptions);

      // 为插件提供的管理器接口
      // 包含任务ID、上下文引用和完成/失败回调
      const contextManager = {
        taskId: task.taskId,
        context: context,
        retryCount: task.retryCount,
        crawlTaskId: task.crawlTaskId,
        complete: (result) => {
          if (result) {
            task.result = result;
          }

          if (contextManager.crawlTaskId) {
            task.crawlTaskId = contextManager.crawlTaskId;
          }

          this.completeTask(task, page);
        },
        failed: (error, canRetry = false) => {
          if (contextManager.crawlTaskId) {
            task.crawlTaskId = contextManager.crawlTaskId;
          }

          this.failedTask(task, page, error, canRetry);
        },
        ...task.options
      };

      // 执行插件函数
      await task.taskFunction(page, contextManager, task.pluginOptions);
    } catch (error) {
      logger.error(`Task ${task.taskId} execution failed:`, error.message);

      // 自动失败处理：如果插件没有调用 failed()，自动处理失败（不重试）
      if (!task.completed) {
        this.failedTask(task, page, error, false);
      }
    }
  }

  /**
   * 处理任务失败
   * 支持重试机制和最终失败处理
   */
  async failedTask(task, page, error, canRetry = false) {
    if (task.completed) return; // 防止重复处理

    logger.error(`Task ${task.taskId} failed (attempt ${task.retryCount + 1}):`, error.message);

    // 关闭当前的 page 和 context，但不从 activeContexts 中移除 taskId
    await this.cleanupTaskResources(task, page, false)

    // 检查是否应该重试（完全由插件决定）
    if (canRetry) {
      task.retryCount++;

      logger.info(`Task ${task.taskId} will retry (${task.retryCount})`);

      // 重置一些状态，但保持 taskId 在 activeContexts 中
      task.completed = false;
      task.context = null;

      // 直接重试，避免使用 setImmediate 导致的竞态条件
      // 保持任务在 activeContexts 中，表示任务仍在进行中
      this.executeTask(task);
    } else {
      // 最终失败，不再重试
      task.completed = true;

      // 从 activeContexts 中移除 taskId
      this.activeContexts.delete(task.taskId);

      const finalError = new Error(`Task ${task.taskId} failed after ${task.retryCount} retries: ${error.message}`);
      finalError.originalError = error;
      finalError.retryCount = task.retryCount;

      logger.error(`Task ${task.taskId} final failure:`, finalError.message);

      // 在任务失败时再 reject addTask 返回的 Promise
      if (typeof task.reject === 'function') {
        try {
          task.reject(finalError);
        } catch (e) {
          // ignore reject errors
        }
      }

      // 发送状态更新事件
      this.emitStatusChange();

      // 检查是否所有任务都完成了
      this.checkAllTasksCompleted();

      // 处理下一个任务
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * 清理任务资源
   * 抽取公共的资源清理逻辑
   */
  async cleanupTaskResources(task, page, shouldDelete = true) {
    // 关闭页面
    if (page) {
      try {
        await page.close();
      } catch (error) {
        logger.warn(`Failed to close page for task ${task.taskId}:`, error.message);
      }
    }

    // 关闭上下文
    if (task.context) {
      try {
        await task.context.close();
      } catch (error) {
        logger.warn(`Failed to close context for task ${task.taskId}:`, error.message);
      }
    }

    // 从 activeContexts 中移除 taskId（一致性存储）
    if (shouldDelete) this.activeContexts.delete(task.taskId);
  }
  /**
   * 完成任务并清理资源
   * 这是资源管理的关键方法，确保没有内存泄漏
   */
  async completeTask(task, page) {
    if (task.completed) return; // 防止重复完成
    task.completed = true;

    logger.log(`Task ${task.taskId}: Completed successfully`);

    // 将任务结果添加到结果数组中
    if (task.result) {
      this.taskResults.push(task.result);
    }

    // 清理资源
    await this.cleanupTaskResources(task, page);

    this.emitStatusChange();

    // 检查是否所有任务都完成了
    this.checkAllTasksCompleted();

    // 使用 setImmediate 确保在下一个事件循环中处理队列
    // 避免递归调用栈过深
    setImmediate(() => this.processQueue());

    // 在任务真正完成时再 resolve addTask 返回的 Promise
    if (typeof task.resolve === 'function') {
      try {
        task.resolve(task.result);
      } catch (e) {
        // ignore resolve errors
      }
    }
  }



  /**
   * 关闭管理器并清理所有资源
   * 确保优雅关闭，避免僵尸进程
   */
  async close() {
    logger.info('Closing context manager...');

    // 清空任务队列，拒绝所有等待的任务
    this.taskQueue.forEach(task => {
      task.reject(new Error('Context manager is closing'));
    });
    this.taskQueue = [];
    this.taskResults = []; // 清空结果数组

    // 等待活跃上下文完成（最多等待10秒）
    // 给正在执行的任务一些时间来完成
    let waitTime = 0;
    while (this.activeContexts.size > 0 && waitTime < 10000) {
      await new Promise(resolve => setTimeout(resolve, 100));
      waitTime += 100;
    }

    // 强制关闭所有剩余的上下文
    // activeContexts 现在只包含 taskId，需要从对应的任务中找到 context
    // 但由于关闭时所有正在执行的任务都应该已经完成，这里只需要清空集合

    this.activeContexts.clear();

    // 关闭浏览器实例
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    // 清理所有事件监听器，防止内存泄漏
    this.removeAllListeners();

    logger.info(`${this.browserType} browser closed`);
  }
}

module.exports = ContextManager;