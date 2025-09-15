/**
 * 数据库操作文件
 * 包含任务和产品数据的增删改查
 */

const { initConnection, getConnection, isConnectionActive } = require('./connection');
const { defineModels } = require('./init');
const { logger } = require('../utils/logger');

// 模型缓存
let models = null;

// 获取模型实例
async function getModels() {
  if (!models) {
    if (!isConnectionActive()) {
      await initConnection();
    }
    const sequelize = getConnection();
    models = defineModels(sequelize);
  }
  return models;
}

// 任务操作
const TaskOps = {
  // 创建任务
  async create(keyword, zipCode = null) {
    const { CrawlTask } = await getModels();
    const task = await CrawlTask.create({
      keyword,
      crawl_start_time: new Date(),
      zipCode
    });
    logger.log(`📝 创建任务: ID=${task.id}, 关键词="${keyword}"`);
    return task;
  },

  // 开始任务
  async start(taskId) {
    const { CrawlTask } = await getModels();
    await CrawlTask.update({ status: 'running' }, { where: { id: taskId } });
    logger.log(`🚀 任务 ${taskId} 开始运行`);
  },

  // 完成任务
  async complete(taskId, totalPages, totalProducts, totalSponsored) {
    const { CrawlTask } = await getModels();
    const task = await CrawlTask.findByPk(taskId);
    const durationSeconds = Math.floor((Date.now() - new Date(task.crawl_start_time).getTime()) / 1000);

    await CrawlTask.update({
      status: 'completed',
      pages_crawled: totalPages,
      products_found: totalProducts,
      ads_found: totalSponsored,
      duration_seconds: durationSeconds
    }, { where: { id: taskId } });

    logger.log(`✅ 任务 ${taskId} 完成: ${totalProducts}个产品, ${totalSponsored}个广告`);
  },

  // 失败任务
  async fail(taskId, errorMessage) {
    const { CrawlTask } = await getModels();
    const task = await CrawlTask.findByPk(taskId);
    const durationSeconds = Math.floor((Date.now() - new Date(task.crawl_start_time).getTime()) / 1000);

    await CrawlTask.update({
      status: 'failed',
      duration_seconds: durationSeconds,
      error_message: errorMessage
    }, { where: { id: taskId } });

    logger.log(`❌ 任务 ${taskId} 失败: ${errorMessage}`);
  }
};

// 产品操作
const ProductOps = {
  // 批量插入产品
  async batchInsert(products, taskId) {
    if (!products || products.length === 0) return;

    const { ProductRanking } = await getModels();

    const productData = products.map(product => ({
      crawl_task_id: taskId,
      asin: product.asin,
      page_number: product.pageNumber || 1,
      position_on_page: product.position_on_page,
      position_value: product.position_value,
      position_type: product.position_type,
      title: product.title,
      product_url: product.product_url,
      image_url: product.image_url,
      price: product.price,
      original_price: product.original_price,
      bought: product.bought,
      rating: product.rating,
      review_count: product.review_count,
      is_sponsored: product.is_sponsored,
      ad_campaign_id: product.ad_campaign_id,
      ad_id: product.ad_id,
      sku: product.sku,
      qualifier: product.qualifier,
      widget_name: product.widget_name,
      ad_index: product.ad_index,
      ad_type_text: product.ad_type_text,
      ad_section_title: product.ad_section_title,
      video_title: product.video_title,
      video_poster_url: product.video_poster_url,
      video_source_url: product.video_source_url,
      brand: product.brand,
      brand_image: product.brand_image,
      brand_logo: product.brand_logo,
      crawl_time: product.extractTime ? new Date(product.extractTime) : new Date()
    }));

    await ProductRanking.bulkCreate(productData);
    logger.log(`💾 保存了 ${productData.length} 个产品数据`);
  }
};

module.exports = { TaskOps, ProductOps };