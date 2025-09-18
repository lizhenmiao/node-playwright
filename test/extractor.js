const { extractAmazonProductsFromHTML } = require('../utils/amazonExtractor');
const fs = require('fs').promises;
const path = require('path');

// 固定的HTML文件路径
const HTML_FILE = 'rj45 crimp tool.html';
const HTML_PATH = path.join(__dirname, '../html_cache', HTML_FILE);

async function extractProducts() {
  try {
    // 读取固定的HTML文件
    const htmlContent = await fs.readFile(HTML_PATH, 'utf-8');

    // 执行数据提取
    const products = await extractAmazonProductsFromHTML(htmlContent);

    // 返回数据
    return products
  } catch (error) {
    throw error;
  }
}

// 导出主要函数和类
module.exports = {
  extractProducts
};