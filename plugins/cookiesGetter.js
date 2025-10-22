const { logger } = require('../utils/logger');
const CommonUtils = require('../utils/commonUtils');

// 最大重试次数
const maxRetries = 50;
// 选择器超时时间
const selectorTimeout = 10000;
// 页面加载超时时间
const pageLoadTimeout = 30000;

/**
 * Amazon Cookies 获取插件
 * 负责启动浏览器、设置邮编并获取 cookies
 * 
 * @param {Object} page - Playwright 页面对象
 * @param {Object} context - 上下文对象
 * @param {Object} pluginOptions - 插件参数
 * @param {string} pluginOptions.domain - Amazon 域名
 * @param {string|number} pluginOptions.zipCode - 邮编
 */
async function cookiesGetter(page, context, pluginOptions = {}) {
  const { domain, zipCode, zipSeparator } = pluginOptions;

  const logPrefix = `域名 ${domain}`;

  logger.info(`${logPrefix} 开始获取 cookies（邮编: ${zipCode}）`);

  try {
    // 访问 Amazon 站点
    const url = `https://www.${domain}`;
    logger.info(`${logPrefix} 正在访问 ${url}`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: pageLoadTimeout
    });

    // 等待页面主要内容加载完成
    await page.waitForLoadState('networkidle', { timeout: pageLoadTimeout }).catch(() => {
      logger.info(`${logPrefix} 页面加载超时，继续执行...`);
    });

    // 处理可能出现的验证码
    await CommonUtils.handleCaptcha(page, logPrefix);

    // 等待顶部导航栏出现，确保页面完全加载
    try {
      await page.waitForSelector('header#navbar-main', { timeout: selectorTimeout, state: 'visible' });
      logger.info(`${logPrefix} 顶部导航栏已加载，可以设置邮编`);
    } catch (error) {
      throw new Error(`${logPrefix} 顶部导航栏未出现，页面可能加载失败`);
    }

    // 尝试多个可能的邮编设置按钮选择器
    const locationButtonSelectors = [
      '#nav-global-location-popover-link',
      '#glow-ingress-block'
    ];

    let locationButton = null;
    for (const selector of locationButtonSelectors) {
      try {
        locationButton = await page.waitForSelector(selector, { timeout: selectorTimeout, state: 'visible' });
        if (locationButton) {
          logger.info(`${logPrefix} 找到邮编设置按钮: ${selector}`);
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
      }
    }

    if (!locationButton) {
      throw new Error(`${logPrefix} 未找到邮编设置按钮，请检查页面结构`);
    }

    // 点击邮编设置按钮
    logger.info(`${logPrefix} 正在点击邮编设置按钮...`);
    await locationButton.click();

    // 等待邮编输入框出现
    logger.info(`${logPrefix} 正在等待邮编输入框出现...`);

    if (zipSeparator) {
      // 多输入框模式：等待第一个输入框
      await page.waitForSelector('#GLUXZipInputSection', { timeout: selectorTimeout, state: 'visible' });

      logger.info(`${logPrefix} 根据配置的 zipSeparator "${zipSeparator}" 判断为多个输入框模式`);

      // 多个输入框的情况（如加拿大：K1A 0A9，日本：110-0008）
      const zipInput0 = await page.$('#GLUXZipUpdateInput_0');
      const zipInput1 = await page.$('#GLUXZipUpdateInput_1');

      if (!zipInput0 || !zipInput1) {
        throw new Error(`${logPrefix} 未找到完整的邮编输入框`);
      }

      // 根据配置的分隔符分割邮编
      const zipParts = String(zipCode).split(zipSeparator);

      logger.info(`${logPrefix} 正在输入邮编第一部分: ${zipParts[0]}`);
      await zipInput0.fill(zipParts[0]);

      logger.info(`${logPrefix} 正在输入邮编第二部分: ${zipParts[1]}`);
      await zipInput1.fill(zipParts[1]);
    } else {
      // 单输入框模式：等待单个输入框
      await page.waitForSelector('#GLUXZipUpdateInput', { timeout: selectorTimeout, state: 'visible' });

      logger.info(`${logPrefix} 根据配置判断为单个输入框模式`);

      // 单个输入框的情况
      const zipInputSelectors = [
        '#GLUXZipUpdateInput'
      ];

      let zipInput = null;
      for (const selector of zipInputSelectors) {
        try {
          zipInput = await page.waitForSelector(selector, { timeout: selectorTimeout, state: 'visible' });
          if (zipInput) {
            logger.info(`${logPrefix} 找到邮编输入框: ${selector}`);
            break;
          }
        } catch (error) {
          // 继续尝试下一个选择器
        }
      }

      if (!zipInput) {
        throw new Error(`${logPrefix} 未找到邮编输入框，弹窗可能未正确打开`);
      }

      // 输入邮编
      logger.info(`${logPrefix} 正在输入邮编 ${zipCode}...`);
      await zipInput.fill(String(zipCode));
    }

    // 等待确认按钮出现
    const confirmButtonSelectors = [
      '#GLUXZipUpdate',
    ];

    let confirmButton = null;
    for (const selector of confirmButtonSelectors) {
      try {
        confirmButton = await page.waitForSelector(selector, { timeout: selectorTimeout, state: 'visible' });
        if (confirmButton) {
          logger.info(`${logPrefix} 找到确认按钮: ${selector}`);
          break;
        }
      } catch (error) {
        // 继续尝试下一个选择器
      }
    }

    if (!confirmButton) {
      throw new Error(`${logPrefix} 未找到确认按钮`);
    }

    // 点击确认按钮
    logger.info(`${logPrefix} 正在点击确认按钮...`);
    await confirmButton.click();

    // 等待页面更新完成
    await page.waitForLoadState('networkidle', { timeout: selectorTimeout }).catch(() => {
      logger.info(`${logPrefix} 页面更新超时，继续获取 cookies...`);
    });

    // 获取 cookies
    logger.info(`${logPrefix} 正在获取 cookies...`);
    const cookies = await context.context.cookies();

    // 将 cookies 转换为字符串格式
    const cookieString = cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');

    logger.info(`${logPrefix} 成功获取 cookies（共 ${cookies.length} 个）`);

    // 调用 complete 返回结果
    context.complete({
      success: true,
      domain,
      zipCode,
      cookie: cookieString,
      cookieCount: cookies.length
    });
  } catch (error) {
    logger.error(`${logPrefix} 获取 cookies 失败:`, error.message);

    // 判断是否可以重试
    const canRetry = context.retryCount < maxRetries;

    if (canRetry) {
      logger.info(`${logPrefix} 将重试 (${context.retryCount + 1}/${maxRetries})`);
    } else {
      logger.error(`${logPrefix} 已达到最大重试次数，获取失败`);
    }

    context.failed(error, canRetry);
  }
}


module.exports = cookiesGetter;

