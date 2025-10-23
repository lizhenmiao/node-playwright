const { extractAmazonProductsFromHTML } = require('../utils/amazonExtractor');
const CommonUtils = require('../utils/commonUtils');
const { TaskOps, ProductOps } = require('../database/operations');
const { initConnection, isConnectionActive } = require('../database/connection');
const TaskIdManager = require('../utils/taskIdManager');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

// 最大重试次数
const maxRetries = 50;
// 搜索超时时间 - 50秒
const searchTimeout = 50000;
// 页面加载超时时间 - 50秒
const pageLoadTimeout = 50000;

// 确保html_files目录存在
fs.mkdir('./html_files', { recursive: true }).catch(() => {
  // 如果创建失败，静默忽略（目录可能已存在）
});

/**
 * Amazon 搜索并获取产品数据的插件
 * @param {Object} page - Playwright页面对象
 * @param {Object} context - 上下文对象
 * @param {Object} pluginOptions - 插件参数
 * @param {string} pluginOptions.url - 起始URL
 * @param {string} pluginOptions.keyword - 搜索关键词
 * @param {number} pluginOptions.maxPage - 最大页数
 */
async function amazonScraper(page, context, pluginOptions = {}) {
  const { url, keyword, countryCode, maxPage = 3 } = pluginOptions;

  // 从 context 中获取 zipCode（Context配置参数）
  const zipCode = String(context.zipCode);

  let crawlTaskId = null;

  logger.log(`任务 ${context.taskId}: 开始Amazon搜索任务`);
  logger.log(`- URL: ${url}`);
  logger.log(`- 关键词: ${keyword}`);
  logger.log(`- 最大页数: ${maxPage}`);
  logger.log(`- 重试次数: ${context.retryCount}`);

  // 验证参数
  if (!url || !keyword) {
    const error = new Error('缺少必要参数: url 和 keyword 是必需的');
    logger.log(`任务 ${context.taskId}: ${error.message}`);
    context.failed(error, false);
    return;
  }

  try {
    const startTime = Date.now();

    // 确保数据库连接已建立（提前初始化，避免在任务执行中才发现连接问题）
    if (!isConnectionActive()) {
      logger.info(`任务 ${context.taskId}: 初始化数据库连接...`);
      await initConnection();
    }

    // 获取或创建任务ID（使用新的管理器，具有重试机制）
    crawlTaskId = await TaskIdManager.getOrCreateTaskId(context, keyword, zipCode, countryCode);

    // 存储所有页面的结果
    const allResults = [];

    // 初始化：打开起始页面
    logger.log(`任务 ${context.taskId}: 打开起始页面...`);

    // 使用更宽松的等待策略，不等待networkidle
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // 改为domcontentloaded，更宽松
      timeout: pageLoadTimeout
    });

    // 处理验证码
    await CommonUtils.handleCaptcha(page, `任务 ${context.taskId}`);

    // 执行搜索
    await performSearch(page, context, keyword);

    // 循环处理每一页
    for (let currentPage = 1; currentPage <= maxPage; currentPage++) {
      logger.log(`任务 ${context.taskId}: 开始处理第 ${currentPage} 页`);

      // 等待搜索结果加载
      await waitForSearchResults(page, context);

      // 滚动页面到底部
      await scrollToBottom(page, context);

      // 获取并解析页面数据
      const pageResults = await extractPageData(page, context, keyword, url, currentPage);

      if (pageResults) {
        allResults.push(pageResults);
        logger.log(`任务 ${context.taskId}: 第 ${currentPage} 页数据提取成功，包含 ${pageResults.totalProducts} 个产品`);

        const now = new Date();

        const formatted = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
          String(now.getHours()).padStart(2, '0'),
          String(now.getMinutes()).padStart(2, '0'),
          String(now.getSeconds()).padStart(2, '0'),
        ].join('_');

        // 存储 html 到文件
        await fs.writeFile(`./html_files/${crawlTaskId || 'unknown'}-${zipCode.replace(/\s+/g, '_')}-${currentPage}-${keyword.replace(/\s+/g, '_')}-${formatted}.html`, pageResults.html);
      }

      // 如果不是最后一页，尝试翻页
      if (currentPage < maxPage) {
        const hasNextPage = await goToNextPage(page, context);
        if (!hasNextPage) {
          logger.log(`任务 ${context.taskId}: 没有更多页面，停止翻页`);
          break;
        }
      }
    }

    // 任务完成
    const totalProducts = allResults.reduce((sum, result) => sum + result.totalProducts, 0);
    const totalSponsored = allResults.reduce((sum, result) => sum + (result.sponsoredCount || 0), 0);
    const totalOrganic = allResults.reduce((sum, result) => sum + (result.organicCount || 0), 0);

    const executionTime = Date.now() - startTime;
    const perPageRefreshSummary = allResults.length > 0
      ? `，每页刷新次数：${allResults.map(r => `第${r.pageNumber}页${(r.refreshCount ?? 0)}次`).join('，')}`
      : '';

    logger.info(`[任务 ${context.taskId} (数据库: ${crawlTaskId})]: 任务完成，共提取 ${allResults.length} 页，总计 ${totalProducts} 个产品（SP广告: ${totalSponsored}个，自然排名: ${totalOrganic}个），耗时：${executionTime}ms - ${CommonUtils.formatMilliseconds(executionTime)}，重试次数: ${context.retryCount}${perPageRefreshSummary}`);

    const result = {
      success: true,
      crawlTaskId: crawlTaskId, // 添加crawlTaskId到返回结果中
      totalPages: allResults.length,
      totalProducts: totalProducts,
      totalSponsored: totalSponsored,
      totalOrganic: totalOrganic,
      results: allResults
    };

    // 保存任务完成状态到数据库
    await TaskIdManager.saveTaskCompletion(crawlTaskId, allResults.length, totalProducts, totalSponsored, context);

    // 保存产品数据（如果有任务ID）
    if (crawlTaskId) {
      try {
        const allProducts = [];
        for (const pageResult of allResults) {
          if (pageResult.products && Array.isArray(pageResult.products)) {
            allProducts.push(...pageResult.products);
          }
        }
        if (allProducts.length > 0) {
          await ProductOps.batchInsert(allProducts, crawlTaskId);
        }
      } catch (dbError) {
        logger.error(`任务 ${context.taskId}: 保存完成状态失败 - ${dbError.message}`);
      }
    }

    context.complete(result);
  } catch (error) {
    logger.log(`任务 ${context.taskId}: 任务失败 - ${error.message}`);

    // 判断是否可以重试
    const canRetry = context.retryCount < maxRetries;

    if (canRetry) {
      logger.log(`任务 ${context.taskId}: 将重试 (${context.retryCount + 1}/${maxRetries})`);
    } else {
      logger.log(`任务 ${context.taskId}: 不可重试或已达到最大重试次数`);

      // 保存任务失败状态到数据库
      await TaskIdManager.saveTaskFailure(crawlTaskId, error.message, context);
    }

    context.failed(error, canRetry);
  }
}


/**
 * 执行搜索
 */
async function performSearch(page, context, keyword) {
  logger.log(`任务 ${context.taskId}: 开始搜索关键词: ${keyword}`);

  // 查找搜索框
  const searchSelectors = [
    '#twotabsearchtextbox',
    '#nav-bb-search'
  ];

  let searchBox = null;
  for (const selector of searchSelectors) {
    searchBox = await page.$(selector);
    if (searchBox) {
      logger.log(`任务 ${context.taskId}: 找到搜索框: ${selector}`);
      break;
    }
  }

  if (!searchBox) {
    throw new Error('未找到搜索框');
  }

  // 清空并填入关键词
  await searchBox.fill('');
  await searchBox.fill(keyword);

  // 查找并点击搜索按钮
  const searchButtonSelectors = [
    '#nav-search-submit-button',
    'input.nav-bb-button[type="submit"]',
    '.nav-search-submit input'
  ];

  let searchButton = null;
  for (const selector of searchButtonSelectors) {
    searchButton = await page.$(selector);
    if (searchButton) {
      logger.log(`任务 ${context.taskId}: 找到搜索按钮: ${selector}`);
      break;
    }
  }

  if (!searchButton) {
    throw new Error('未找到搜索按钮');
  }

  // 点击搜索
  await searchButton.click();
  logger.log(`任务 ${context.taskId}: 已点击搜索按钮，等待页面跳转...`);

  // 等待页面跳转到搜索结果页 - 只等待DOM加载
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: searchTimeout });
  } catch (loadError) {
    logger.log(`任务 ${context.taskId}: 页面加载超时，尝试继续...`);
  }

  logger.log(`任务 ${context.taskId}: 搜索完成，已跳转到搜索结果页`);
}

/**
 * 等待搜索结果加载
 */
async function waitForSearchResults(page, context) {
  logger.log(`任务 ${context.taskId}: 等待搜索结果加载...`);

  try {
    // 直接等待产品项出现，不管占位符是否还存在
    await page.waitForFunction(() => {
      const products = document.querySelectorAll('.s-result-item[role="listitem"]');
      return products.length > 0;
    }, { timeout: pageLoadTimeout });

    logger.log(`任务 ${context.taskId}: 搜索结果加载完成，发现产品`);

  } catch (error) {
    logger.log(`任务 ${context.taskId}: 等待搜索结果超时: ${error.message}`);
    throw new Error('搜索结果加载超时');
  }
}

/**
 * 滚动页面到底部
 */
async function scrollToBottom(page, context) {
  logger.log(`任务 ${context.taskId}: 开始滚动页面到底部...`);
  const startTime = Date.now();

  try {
    await page.evaluate(async () => {
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

      const totalHeight = () => document.body.scrollHeight;
      const viewportHeight = () => window.innerHeight;
      let currentHeight = 0;

      while (currentHeight < totalHeight()) {
        const previousHeight = totalHeight();
        window.scrollBy(0, viewportHeight());
        currentHeight += viewportHeight();

        await delay(1000); // 每次滚动后等待1秒

        // 如果页面高度没有变化，说明已经到底部
        if (totalHeight() === previousHeight) {
          break;
        }
      }

      // 最后滚动到最底部
      window.scrollTo(0, document.body.scrollHeight);
    });

    const executionTime = Date.now() - startTime;
    logger.log(`任务 ${context.taskId}: 页面滚动完成，耗时：${executionTime}ms - ${CommonUtils.formatMilliseconds(executionTime)}`);
  } catch (error) {
    logger.log(`任务 ${context.taskId}: 页面滚动出错: ${error.message}`);
    // 滚动失败不抛出错误，继续执行
  }
}

/**
 * 提取页面数据
 */
async function extractPageData(page, context, keyword, url, pageNumber) {
  logger.log(`任务 ${context.taskId}: 开始提取第 ${pageNumber} 页数据...`);

  let refreshCount = 0;

  while (refreshCount <= maxRetries) {
    try {
      // 获取页面HTML
      const html = await page.content();

      // 使用amazonExtractor解析数据
      const products = await extractAmazonProductsFromHTML(html);

      // 检查是否有SP广告信息
      const hasSPAds = products.some(product => product.positionType === 'sp');

      // 检查自然排名产品数量是否超过 8 个
      const organicProducts = products.filter(product => product.positionType === 'organic');
      const hasEnoughOrganic = organicProducts.length > 8;

      if ((hasSPAds && hasEnoughOrganic) || refreshCount >= maxRetries) {
        if (hasSPAds && hasEnoughOrganic) {
          logger.log(`任务 ${context.taskId}: 第 ${pageNumber} 页发现SP广告信息且自然排名产品数量为 ${organicProducts.length} 个(超过 8 个)，满足停止条件`);
        } else if (refreshCount >= maxRetries) {
          logger.log(`任务 ${context.taskId}: 第 ${pageNumber} 页已达到最大重试次数，继续执行 (SP广告: ${hasSPAds ? '有' : '无'}, 自然排名: ${organicProducts.length}个)`);
        }

        // 为所有产品添加元数据
        const enrichedProducts = products.map(product => ({
          ...product.toJSON(),
          keyword: keyword,
          url: url,
          pageNumber: pageNumber,
          extractTime: new Date().toISOString()
        }));

        // 统计产品类型
        const sponsoredCount = enrichedProducts.filter(p => p.position_type === 'sp').length;
        const organicCount = enrichedProducts.filter(p => p.position_type === 'organic').length;

        logger.log(`任务 ${context.taskId}: 第 ${pageNumber} 页数据提取成功，共 ${enrichedProducts.length} 个产品（SP广告: ${sponsoredCount}个，自然排名: ${organicCount}个）`);

        return {
          pageNumber: pageNumber,
          keyword: keyword,
          url: url,
          totalProducts: enrichedProducts.length,
          sponsoredCount: sponsoredCount,
          organicCount: organicCount,
          hasSPAds: hasSPAds,
          hasEnoughOrganic: hasEnoughOrganic,
          satisfiesStopCondition: hasSPAds && hasEnoughOrganic,
          products: enrichedProducts,
          html: html,
          refreshCount: refreshCount
        };
      } else {
        refreshCount++;
        const reasonMsg = [];
        if (!hasSPAds) reasonMsg.push('无SP广告');
        if (!hasEnoughOrganic) reasonMsg.push(`自然排名仅${organicProducts.length}个`);

        logger.log(`任务 ${context.taskId}: 第 ${pageNumber} 页不满足停止条件 (${reasonMsg.join('，')})，刷新页面重试 (${refreshCount}/${maxRetries})`);

        // 刷新页面 - 只等待DOM内容加载
        try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: pageLoadTimeout });
        } catch (reloadError) {
          logger.log(`任务 ${context.taskId}: 页面刷新失败，尝试继续: ${reloadError.message}`);
        }

        // 重新等待搜索结果
        await waitForSearchResults(page, context);

        // 重新滚动
        await scrollToBottom(page, context);
      }
    } catch (error) {
      logger.log(`任务 ${context.taskId}: 第 ${pageNumber} 页数据提取失败: ${error.message}`);

      if (refreshCount >= maxRetries) {
        throw error;
      }

      refreshCount++;
      logger.log(`任务 ${context.taskId}: 刷新页面重试 (${refreshCount}/${maxRetries})`);

      // 刷新页面 - 只等待DOM内容加载
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: pageLoadTimeout });
      } catch (reloadError) {
        logger.log(`任务 ${context.taskId}: 页面刷新失败，尝试继续: ${reloadError.message}`);
      }

      await waitForSearchResults(page, context);
      await scrollToBottom(page, context);
    }
  }

  throw new Error(`第 ${pageNumber} 页在${maxRetries}次刷新后仍无法同时满足SP广告信息和自然排名产品数量超过5个的条件`);
}

/**
 * 翻到下一页
 */
async function goToNextPage(page, context) {
  logger.log(`任务 ${context.taskId}: 尝试翻到下一页...`);

  try {
    // 查找下一页按钮
    const nextButton = await page.$('.s-pagination-next');

    if (!nextButton) {
      logger.log(`任务 ${context.taskId}: 未找到下一页按钮`);
      return false;
    }

    // 检查按钮是否可点击（不是disabled状态）
    const isDisabled = await nextButton.evaluate(el =>
      el.hasAttribute('aria-disabled') && el.getAttribute('aria-disabled') === 'true'
    );

    if (isDisabled) {
      logger.log(`任务 ${context.taskId}: 下一页按钮已禁用，已到最后一页`);
      return false;
    }

    // 点击下一页
    await nextButton.click();
    logger.log(`任务 ${context.taskId}: 已点击下一页按钮，等待页面加载...`);

    // 使用更简单的等待策略
    try {
      // 只等待 DOM 内容加载
      await page.waitForLoadState('domcontentloaded', { timeout: pageLoadTimeout });
    } catch (loadError) {
      logger.log(`任务 ${context.taskId}: 翻页后页面加载超时，尝试继续...`);
    }

    logger.log(`任务 ${context.taskId}: 下一页加载完成`);
    return true;

  } catch (error) {
    logger.log(`任务 ${context.taskId}: 翻页失败: ${error.message}`);
    return false;
  }
}

module.exports = amazonScraper;