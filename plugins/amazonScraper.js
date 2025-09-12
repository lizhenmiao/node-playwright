const { extractAmazonProductsFromHTML } = require('../utils/amazonExtractor');
const CommonUtils = require('../utils/CommonUtils');
const { TaskOps, ProductOps } = require('../database/operations');
const { initConnection, isConnectionActive } = require('../database/connection');
const fs = require('fs').promises;

// 配置参数 - 增加超时时间以应对网络不稳定
const maxRetries = 30;
const searchTimeout = 60000; // 搜索超时时间增加到60秒
const pageLoadTimeout = 60000; // 页面加载超时时间增加到60秒

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
  const { url, keyword, maxPage = 3 } = pluginOptions;

  // 从 context 中获取 zipCode（Context配置参数）
  const zipCode = String(context.zipCode);

  let crawlTaskId = null;

  // console.log(`任务 ${context.taskId}: 开始Amazon搜索任务`);
  // console.log(`- URL: ${url}`);
  // console.log(`- 关键词: ${keyword}`);
  // console.log(`- 最大页数: ${maxPage}`);
  // console.log(`- 重试次数: ${context.retryCount}`);

  // 验证参数
  if (!url || !keyword) {
    const error = new Error('缺少必要参数: url 和 keyword 是必需的');
    // console.log(`任务 ${context.taskId}: ${error.message}`);
    context.failed(error, false);
    return;
  }

  try {
    const startTime = Date.now();

    // 创建数据库任务记录
    try {
      // 确保数据库连接已建立
      if (!isConnectionActive()) {
        await initConnection();
      }

      const task = await TaskOps.create(keyword, zipCode);
      crawlTaskId = task.id;
      await TaskOps.start(crawlTaskId);
    } catch (dbError) {
      console.error(`任务 ${context.taskId}: 数据库操作失败 - ${dbError.message}`);
    }

    // 存储所有页面的结果
    const allResults = [];

    // 初始化：打开起始页面
    // console.log(`任务 ${context.taskId}: 打开起始页面...`);

    // 使用更宽松的等待策略，不等待networkidle
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // 改为domcontentloaded，更宽松
      timeout: pageLoadTimeout
    });

    // 处理验证码
    await handleCaptcha(page, context);

    // 执行搜索
    await performSearch(page, context, keyword);

    // 循环处理每一页
    for (let currentPage = 1; currentPage <= maxPage; currentPage++) {
      // console.log(`任务 ${context.taskId}: 开始处理第 ${currentPage} 页`);

      // 等待搜索结果加载
      await waitForSearchResults(page, context);

      // 滚动页面到底部
      await scrollToBottom(page, context);

      // 获取并解析页面数据
      const pageResults = await extractPageData(page, context, keyword, url, currentPage);

      if (pageResults) {
        allResults.push(pageResults);
        // console.log(`任务 ${context.taskId}: 第 ${currentPage} 页数据提取成功，包含 ${pageResults.totalProducts} 个产品`);

        // 存储 html 到文件
        await fs.writeFile(`./html_files/${context.taskId}-${zipCode.replace(/\s+/g, '_')}-${currentPage}-${keyword.replace(/\s+/g, '_')}-${Date.now()}.html`, pageResults.html);
      }

      // 如果不是最后一页，尝试翻页
      if (currentPage < maxPage) {
        const hasNextPage = await goToNextPage(page, context);
        if (!hasNextPage) {
          // console.log(`任务 ${context.taskId}: 没有更多页面，停止翻页`);
          break;
        }
      }
    }

    // 任务完成
    const totalProducts = allResults.reduce((sum, result) => sum + result.totalProducts, 0);
    const totalSponsored = allResults.reduce((sum, result) => sum + (result.sponsoredCount || 0), 0);
    const totalOrganic = allResults.reduce((sum, result) => sum + (result.organicCount || 0), 0);

    const executionTime = Date.now() - startTime;
    console.log(`任务 ${context.taskId}: 任务完成，共提取 ${allResults.length} 页，总计 ${totalProducts} 个产品（SP广告: ${totalSponsored}个，自然排名: ${totalOrganic}个），耗时：${executionTime}ms - ${CommonUtils.formatMilliseconds(executionTime)}，重试次数: ${context.retryCount}`);

    const result = {
      success: true,
      totalPages: allResults.length,
      totalProducts: totalProducts,
      totalSponsored: totalSponsored,
      totalOrganic: totalOrganic,
      results: allResults
    };

    // 保存任务完成状态到数据库
    if (crawlTaskId) {
      try {
        await TaskOps.complete(crawlTaskId, allResults.length, totalProducts, totalSponsored);

        // 保存产品数据
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
        console.error(`任务 ${context.taskId}: 保存完成状态失败 - ${dbError.message}`);
      }
    }

    context.complete(result);
  } catch (error) {
    // console.log(`任务 ${context.taskId}: 任务失败 - ${error.message}`);

    // 判断是否可以重试
    const canRetry = context.retryCount < maxRetries;

    if (canRetry) {
      // console.log(`任务 ${context.taskId}: 将重试 (${context.retryCount + 1}/${maxRetries})`);
    } else {
      // console.log(`任务 ${context.taskId}: 不可重试或已达到最大重试次数`);

      // 保存任务失败状态到数据库
      if (crawlTaskId) {
        try {
          await TaskOps.fail(crawlTaskId, error.message);
        } catch (dbError) {
          console.error(`任务 ${context.taskId}: 保存失败状态失败 - ${dbError.message}`);
        }
      }
    }

    context.failed(error, canRetry);
  }
}

/**
 * 处理验证码
 */
async function handleCaptcha(page, context) {
  // console.log(`任务 ${context.taskId}: 检查验证码...`);

  try {
    // 检查是否存在验证码表单
    const captchaForm = await page.$('form[action="/errors/validateCaptcha"]');

    if (captchaForm) {
      // console.log(`任务 ${context.taskId}: 发现验证码，尝试点击按钮`);

      // 查找按钮并点击
      const button = await captchaForm.$('button, input[type="submit"]');
      if (button) {
        await button.click();
        // console.log(`任务 ${context.taskId}: 已点击验证码按钮，等待页面刷新...`);

        // 等待页面刷新
        await page.waitForLoadState('domcontentloaded', { timeout: pageLoadTimeout });

        // console.log(`任务 ${context.taskId}: 验证码页面刷新完成`);
      } else {
        // console.log(`任务 ${context.taskId}: 验证码表单中未找到按钮`);
      }
    } else {
      // console.log(`任务 ${context.taskId}: 未发现验证码`);
    }
  } catch (error) {
    // console.log(`任务 ${context.taskId}: 验证码处理出错: ${error.message}`);
    // 验证码处理失败不抛出错误，继续执行
  }
}

/**
 * 执行搜索
 */
async function performSearch(page, context, keyword) {
  // console.log(`任务 ${context.taskId}: 开始搜索关键词: ${keyword}`);

  // 查找搜索框
  const searchSelectors = [
    '#twotabsearchtextbox',
    '#nav-bb-search'
  ];

  let searchBox = null;
  for (const selector of searchSelectors) {
    searchBox = await page.$(selector);
    if (searchBox) {
      // console.log(`任务 ${context.taskId}: 找到搜索框: ${selector}`);
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
      // console.log(`任务 ${context.taskId}: 找到搜索按钮: ${selector}`);
      break;
    }
  }

  if (!searchButton) {
    throw new Error('未找到搜索按钮');
  }

  // 点击搜索
  await searchButton.click();
  // console.log(`任务 ${context.taskId}: 已点击搜索按钮，等待页面跳转...`);

  // 等待页面跳转到搜索结果页 - 只等待DOM加载
  try {
    await page.waitForLoadState('domcontentloaded', { timeout: searchTimeout });
  } catch (loadError) {
    // console.log(`任务 ${context.taskId}: 页面加载超时，尝试继续...`);
  }

  // console.log(`任务 ${context.taskId}: 搜索完成，已跳转到搜索结果页`);
}

/**
 * 等待搜索结果加载
 */
async function waitForSearchResults(page, context) {
  // console.log(`任务 ${context.taskId}: 等待搜索结果加载...`);

  try {
    // 直接等待产品项出现，不管占位符是否还存在
    await page.waitForFunction(() => {
      const products = document.querySelectorAll('.s-result-item[role="listitem"]');
      return products.length > 0;
    }, { timeout: pageLoadTimeout });

    // console.log(`任务 ${context.taskId}: 搜索结果加载完成，发现产品`);

  } catch (error) {
    // console.log(`任务 ${context.taskId}: 等待搜索结果超时: ${error.message}`);
    throw new Error('搜索结果加载超时');
  }
}

/**
 * 滚动页面到底部
 */
async function scrollToBottom(page, context) {
  // console.log(`任务 ${context.taskId}: 开始滚动页面到底部...`);

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

    // console.log(`任务 ${context.taskId}: 页面滚动完成`);

  } catch (error) {
    // console.log(`任务 ${context.taskId}: 页面滚动出错: ${error.message}`);
    // 滚动失败不抛出错误，继续执行
  }
}

/**
 * 提取页面数据
 */
async function extractPageData(page, context, keyword, url, pageNumber) {
  // console.log(`任务 ${context.taskId}: 开始提取第 ${pageNumber} 页数据...`);

  let refreshCount = 0;

  while (refreshCount <= maxRetries) {
    try {
      // 获取页面HTML
      const html = await page.content();

      // 使用amazonExtractor解析数据
      const products = await extractAmazonProductsFromHTML(html);

      // 检查是否有SP广告信息
      const hasSPAds = products.some(product => product.positionType === 'sp');

      if (hasSPAds || refreshCount >= maxRetries) {
        if (hasSPAds) {
          // console.log(`任务 ${context.taskId}: 第 ${pageNumber} 页发现SP广告信息`);
        } else {
          // console.log(`任务 ${context.taskId}: 第 ${pageNumber} 页未发现SP广告信息，但已达到最大重试次数，继续执行`);
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

        // console.log(`任务 ${context.taskId}: 第 ${pageNumber} 页数据提取成功，共 ${enrichedProducts.length} 个产品（SP广告: ${sponsoredCount}个，自然排名: ${organicCount}个）`);

        return {
          pageNumber: pageNumber,
          keyword: keyword,
          url: url,
          totalProducts: enrichedProducts.length,
          sponsoredCount: sponsoredCount,
          organicCount: organicCount,
          hasSPAds: hasSPAds,
          products: enrichedProducts,
          html: html
        };
      } else {
        refreshCount++;
        // console.log(`任务 ${context.taskId}: 第 ${pageNumber} 页未发现SP广告信息，刷新页面重试 (${refreshCount}/${maxRetries})`);

        // 刷新页面 - 只等待DOM内容加载
        try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (reloadError) {
          // console.log(`任务 ${context.taskId}: 页面刷新失败，尝试继续: ${reloadError.message}`);
        }

        // 重新等待搜索结果
        await waitForSearchResults(page, context);

        // 重新滚动
        await scrollToBottom(page, context);
      }
    } catch (error) {
      // console.log(`任务 ${context.taskId}: 第 ${pageNumber} 页数据提取失败: ${error.message}`);

      if (refreshCount >= maxRetries) {
        throw error;
      }

      refreshCount++;
      // console.log(`任务 ${context.taskId}: 刷新页面重试 (${refreshCount}/${maxRetries})`);

      // 刷新页面 - 只等待DOM内容加载
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (reloadError) {
        // console.log(`任务 ${context.taskId}: 页面刷新失败，尝试继续: ${reloadError.message}`);
      }

      await waitForSearchResults(page, context);
      await scrollToBottom(page, context);
    }
  }

  throw new Error(`第 ${pageNumber} 页在${maxRetries}次刷新后仍无法获取有效数据`);
}

/**
 * 翻到下一页
 */
async function goToNextPage(page, context) {
  // console.log(`任务 ${context.taskId}: 尝试翻到下一页...`);

  try {
    // 查找下一页按钮
    const nextButton = await page.$('.s-pagination-next');

    if (!nextButton) {
      // console.log(`任务 ${context.taskId}: 未找到下一页按钮`);
      return false;
    }

    // 检查按钮是否可点击（不是disabled状态）
    const isDisabled = await nextButton.evaluate(el =>
      el.hasAttribute('aria-disabled') && el.getAttribute('aria-disabled') === 'true'
    );

    if (isDisabled) {
      // console.log(`任务 ${context.taskId}: 下一页按钮已禁用，已到最后一页`);
      return false;
    }

    // 点击下一页
    await nextButton.click();
    // console.log(`任务 ${context.taskId}: 已点击下一页按钮，等待页面加载...`);

    // 使用更简单的等待策略
    try {
      // 只等待 DOM 内容加载
      await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
    } catch (loadError) {
      // console.log(`任务 ${context.taskId}: 翻页后页面加载超时，尝试继续...`);
    }

    // console.log(`任务 ${context.taskId}: 下一页加载完成`);
    return true;

  } catch (error) {
    // console.log(`任务 ${context.taskId}: 翻页失败: ${error.message}`);
    return false;
  }
}

module.exports = amazonScraper;