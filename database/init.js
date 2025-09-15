/**
 * 数据库初始化文件
 * 一次性运行，创建数据库表结构
 */

const { DataTypes } = require('sequelize');
const { initConnection, closeConnection } = require('./connection');
const { logger } = require('../utils/logger');

// 定义模型函数
function defineModels(sequelize) {
  // 爬取任务表
  const CrawlTask = sequelize.define('CrawlTask', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    keyword: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '关键词'
    },
    crawl_start_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '爬取开始时间'
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
      comment: '爬取状态'
    },
    pages_crawled: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '实际爬取页数'
    },
    products_found: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '发现产品数'
    },
    ads_found: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '发现广告数, 只包含 SP 的产品数'
    },
    duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '耗时（秒）'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '错误信息'
    },
    zipCode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '使用的Cookie的邮编地址, 可能是 数值 或 字符串'
    }
  }, {
    tableName: 'crawl_tasks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // 产品排名表
  const ProductRanking = sequelize.define('ProductRanking', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    crawl_task_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: CrawlTask, key: 'id' },
      comment: '爬取任务ID'
    },
    asin: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'ASIN（SB/SBV容器记录可为空）'
    },
    page_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '页码'
    },
    position_on_page: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '页面内位置（原始位置）'
    },
    position_value: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '排名位置值（每页内每种类型独立计数）'
    },
    position_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '排名类型: organic=自然排名, sp=SP广告, sp_rec_top=SP推荐专栏上部, sp_rec_bottom=SP推荐专栏下部, sb_*=SB/SBV广告(统一使用sb_前缀)'
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '产品标题'
    },
    product_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '产品详情页URL'
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '产品图片URL'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: '当前价格'
    },
    original_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: '原价'
    },
    bought: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '近期销量信息, 可能为空'
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      comment: '评分'
    },
    review_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '评论数'
    },
    is_sponsored: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '是否为广告'
    },
    ad_campaign_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '广告活动ID'
    },
    ad_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '广告ID'
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'SKU'
    },
    qualifier: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '广告限定词'
    },
    widget_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '组件名称'
    },
    ad_index: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '广告索引'
    },
    ad_type_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '广告类型文本'
    },
    ad_section_title: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '广告区域标题（如"4 stars & above"、"Sponsored products"等）'
    },
    video_title: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'SBV视频标题'
    },
    video_poster_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'SBV视频预览图URL'
    },
    video_source_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'SBV视频源地址URL'
    },
    brand: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'SB/SBV品牌名称'
    },
    brand_image: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'SB品牌封面图URL'
    },
    brand_logo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'SB品牌logo URL'
    },
    crawl_time: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: '爬取时间'
    }
  }, {
    tableName: 'product_rankings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  // 关联关系
  CrawlTask.hasMany(ProductRanking, { foreignKey: 'crawl_task_id', onDelete: 'CASCADE' });
  ProductRanking.belongsTo(CrawlTask, { foreignKey: 'crawl_task_id' });

  return { CrawlTask, ProductRanking };
}

// 初始化函数
async function initDatabase() {
  try {
    // 初始化连接
    const sequelize = await initConnection();

    // 定义模型
    const { CrawlTask, ProductRanking } = defineModels(sequelize);

    // 创建表结构（强制重建）
    await sequelize.sync({ force: true });
    logger.info('✅ 数据库表创建完成');

    return { sequelize, CrawlTask, ProductRanking };
  } catch (error) {
    logger.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  initDatabase().then(async () => {
    logger.info('🎉 数据库初始化完成！');
    await closeConnection();
    process.exit(0);
  }).catch(async () => {
    await closeConnection();
    process.exit(1);
  });
}

module.exports = { initDatabase, defineModels };