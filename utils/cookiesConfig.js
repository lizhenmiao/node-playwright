// Amazon 站点邮编配置
// 注意: cookie 将由系统自动获取和管理，存储在 cookies_storage.json 中
const cookiesConfig = [{
  zipCode: 10008,
  domain: 'amazon.com',  // 美国
  zipSeparator: null  // 单个输入框
}, {
  zipCode: 'W1B 4DG',
  domain: 'amazon.co.uk',  // 英国
  zipSeparator: null  // 单个输入框
}, {
  zipCode: 'K1A 0A9',
  domain: 'amazon.ca',  // 加拿大
  zipSeparator: ' '  // 两个输入框，用空格分隔
}, {
  zipCode: '110-0008',
  domain: 'amazon.co.jp',  // 日本
  zipSeparator: '-'  // 两个输入框，用连字符分隔
}, {
  zipCode: 20099,
  domain: 'amazon.de',  // 德国
  zipSeparator: null  // 单个输入框
}, {
  zipCode: 75000,
  domain: 'amazon.fr',  // 法国
  zipSeparator: null  // 单个输入框
}, {
  zipCode: 20123,
  domain: 'amazon.it',  // 意大利
  zipSeparator: null  // 单个输入框
}, {
  zipCode: 28028,
  domain: 'amazon.es',  // 西班牙
  zipSeparator: null  // 单个输入框
}]

module.exports = {
  cookiesConfig
}