/**
 * Amazon 产品数据提取 API 服务器
 * 简化版本 - 固定读取HTML文件返回所有产品数据
 */

const express = require('express');
const cors = require('cors');
const { extractAmazonProductsFromHTML } = require('./utils/amazonExtractor');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());

// 固定的HTML文件路径
const HTML_FILE = 'rj45 crimp tool.html';
const HTML_PATH = path.join(__dirname, 'html_cache', HTML_FILE);

// 主要接口 - 获取Amazon产品数据
app.get('/api/products', async (req, res) => {
  try {
    // 读取固定的HTML文件
    const htmlContent = await fs.readFile(HTML_PATH, 'utf-8');

    // 执行数据提取
    const products = await extractAmazonProductsFromHTML(htmlContent);

    // 按类型分类产品
    const organicProducts = products.filter(p => p.positionType === 'organic');
    const sponsoredProducts = products.filter(p => p.isSponsored && p.positionType === 'sp');
    const spRecProducts = products.filter(p => ['sp_rec_top', 'sp_rec_bottom'].includes(p.positionType));
    const sbProducts = products.filter(p => p.positionType.includes('sb'));

    // 返回分类后的数据
    res.json({
      success: true,
      data: {
        // 按类型分组返回
        organic_products: organicProducts.map(p => p.toJSON()),
        sponsored_products: sponsoredProducts.map(p => p.toJSON()),
        sp_rec_products: spRecProducts.map(p => p.toJSON()),
        sb_sbv_products: sbProducts.map(p => p.toJSON())
      },
      message: `成功提取 ${products.length} 个产品数据`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 数据提取失败:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Amazon产品数据提取失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Amazon产品数据提取API服务正常运行',
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    endpoints: [
      'GET /api/products - 获取Amazon产品数据',
      'GET /health - 健康检查'
    ]
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('🚀 Amazon产品数据提取API已启动!');
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log('');
  console.log('💡 使用方法:');
  console.log(`   curl http://localhost:${PORT}/api/products`);
  console.log(`   或在浏览器访问: http://localhost:${PORT}/api/products`);
});

module.exports = app;
