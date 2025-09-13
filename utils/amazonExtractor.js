/**
 * Amazon 产品数据提取器
 * 基于 Cheerio 的高效 HTML 解析和数据提取
 */

const cheerio = require('cheerio');
const { logger } = require('../utils/logger');

// 完整的 Amazon 产品数据结构
class ProductItem {
  constructor() {
    // 基本信息
    this.asin = '';
    this.title = '';
    this.productUrl = '';
    this.bought = '';

    // 价格信息
    this.price = null;
    this.originalPrice = null;

    // 评价信息
    this.rating = null;
    this.reviewCount = null;

    // 图片信息
    this.imageUrl = '';

    // 广告信息
    this.isSponsored = false;
    this.adCampaignId = '';
    this.adId = '';
    this.sku = '';
    this.qualifier = '';
    this.widgetName = '';
    this.adIndex = '';
    this.adTypeText = '';
    this.adSectionTitle = '';

    // SB/SBV 相关字段
    this.videoTitle = '';
    this.videoPosterUrl = '';
    this.videoSourceUrl = '';
    this.brand = '';
    this.brandImage = '';
    this.brandLogo = '';

    // 位置信息
    this.positionOnPage = 0;
    this.positionValue = 0;
    this.positionType = 'organic';
  }

  toJSON() {
    return {
      // 基本信息
      asin: this.asin,
      title: this.title,
      product_url: this.productUrl,
      bought: this.bought,

      // 价格信息
      price: this.price,
      original_price: this.originalPrice,

      // 评价信息
      rating: this.rating,
      review_count: this.reviewCount,

      // 图片信息
      image_url: this.imageUrl,

      // 广告信息
      is_sponsored: this.isSponsored,
      ad_campaign_id: this.adCampaignId,
      ad_id: this.adId,
      sku: this.sku,
      qualifier: this.qualifier,
      widget_name: this.widgetName,
      ad_index: this.adIndex,
      ad_type_text: this.adTypeText,
      ad_section_title: this.adSectionTitle,

      // SB/SBV 相关字段
      video_title: this.videoTitle,
      video_poster_url: this.videoPosterUrl,
      video_source_url: this.videoSourceUrl,
      brand: this.brand,
      brand_image: this.brandImage,
      brand_logo: this.brandLogo,

      // 位置信息
      position_on_page: this.positionOnPage,
      position_value: this.positionValue,
      position_type: this.positionType
    };
  }

  // 验证数据是否有效
  isValid() {
    // SB/SBV容器：有视频源或品牌图片就有效
    if (this.videoSourceUrl || this.brandImage) {
      return true;
    }
    // 普通产品：需要 asin 和 title
    return !!(this.asin && this.title);
  }
}

// 完整的 Amazon 产品数据提取函数
function extractProductData($, $element) {
  const product = new ProductItem();

  try {
    // 产品 url
    const productUrlSelectors = [
      'h2 a',
      '.a-link-normal',
      'a.a-text-normal'
    ]
    for (const selector of productUrlSelectors) {
      const link = $element.find(selector).first();
      if (link.length > 0 && link.attr('href')) {
        product.productUrl = link.attr('href');
        break;
      }
    }

    // 提取 ASIN
    const dataAsin = $element.attr('data-asin');
    if (dataAsin) {
      product.asin = dataAsin;
    } else {
      // 从链接中提取
      const asinMatch = product.url ? product.url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/) : null;
      if (asinMatch) {
        product.asin = asinMatch[1];
      }
    }

    // 提取标题
    const titleSelectors = [
      'h2',
      'a[data-type="productTitle"]',
      'span.a-truncate-full'
    ]

    for (const selector of titleSelectors) {
      const titleElement = $element.find(selector).first();
      if (titleElement.length > 0) {
        product.title = titleElement.text().trim();
        break;
      }
    }

    // 提取销量信息
    const bought = $element.find('[data-cy="reviews-block"] .a-size-base.a-color-secondary').first().text().trim();
    if (bought) {
      product.bought = bought;
    }

    // 提取当前价格
    const priceRecipe = $element.find('[data-cy="price-recipe"]').first();
    if (priceRecipe.length > 0) {
      const priceSelectors = [
        '.a-price-current .a-offscreen',
        '.a-price .a-offscreen',
        '.a-price-whole'
      ];

      for (const selector of priceSelectors) {
        const priceElement = priceRecipe.find(selector).first();
        if (priceElement.length > 0) {
          const priceText = priceElement.text().trim();
          if (priceText) {
            const priceClean = priceText.replace(/[^\d.]/g, '');
            if (priceClean) {
              try {
                product.price = parseFloat(priceClean);
                break;
              } catch (e) {
                continue;
              }
            }
          }
        }
      }

      const originalPriceSelectors = [
        '.a-price ~ .a-offscreen',
        'span[data-a-strike="true"] .a-offscreen'
      ];

      for (const selector of originalPriceSelectors) {
        const priceElement = priceRecipe.find(selector).first();
        if (priceElement.length > 0) {
          const priceText = priceElement.text().trim();
          if (priceText) {
            const priceClean = priceText.replace(/[^\d.]/g, '');
            if (priceClean) {
              try {
                product.originalPrice = parseFloat(priceClean);
                break;
              } catch (e) {
                continue;
              }
            }
          }
        }
      }
    }

    // 标准产品评分
    const ratingElement = $element.find('.a-icon-alt').first();
    if (ratingElement.length > 0) {
      const text = ratingElement.text().trim();
      if (text.includes('out of') || text.includes('stars')) {
        const match = text.match(/(\d+\.?\d*)/);
        if (match) {
          try {
            product.rating = parseFloat(match[1]);
          } catch (e) {
            // 忽略转换错误
          }
        }
      }
    }

    // SBV产品评分
    if (!product.rating) {
      const reviewElement = $element.find('a[data-type="productReviews"]').first();
      if (reviewElement.length > 0) {
        const ariaLabel = reviewElement.attr('aria-label') || '';
        if (ariaLabel.includes('Rated') && ariaLabel.includes('out of')) {
          const match = ariaLabel.match(/Rated (\d+\.?\d*) out of/);
          if (match) {
            try {
              product.rating = parseFloat(match[1]);
            } catch (e) {
              // 忽略转换错误
            }
          }
        }
      }
    }

    // 标准产品评论数
    const reviewsBlock = $element.find('[data-cy="reviews-block"]').first();
    if (reviewsBlock.length > 0) {
      const reviewElements = reviewsBlock.find('.a-size-base.a-color-base, .a-size-base.s-underline-text');
      for (let i = 0; i < reviewElements.length; i++) {
        const text = $(reviewElements[i]).text().trim();
        if (text && /\d/.test(text)) {
          const textClean = text.replace(/,/g, '');
          const match = textClean.match(/([\d,]+)/);
          if (match) {
            try {
              product.reviewCount = parseInt(match[1]);
              break;
            } catch (e) {
              continue;
            }
          }
        }
      }
    }

    // SBV产品评论数
    if (!product.reviewCount) {
      const reviewElement = $element.find('a[data-type="productReviews"]').first();
      if (reviewElement.length > 0) {
        // 从aria-label中提取评论数量
        const ariaLabel = reviewElement.attr('aria-label') || '';
        const match = ariaLabel.match(/from ([\d,]+) reviews/);
        if (match) {
          try {
            product.reviewCount = parseInt(match[1].replace(/,/g, ''));
          } catch (e) {
            // 忽略转换错误
          }
        } else {
          // 从元素文本中提取（如"4.51,478"）
          const text = reviewElement.text().trim();
          if (text && text.includes(',')) {
            const parts = text.split(',');
            if (parts.length >= 2) {
              try {
                product.reviewCount = parseInt(parts[parts.length - 1].replace(/,/g, ''));
              } catch (e) {
                // 忽略转换错误
              }
            }
          }
        }
      }
    }

    // 提取图片URLs
    const imgSelectors = [
      'img.s-image',           // 标准产品图片
      '[data-type="productImage"]',
      'img._c2Itd_image_pQREQ' // SBV产品图片
    ];

    for (const selector of imgSelectors) {
      const img = $element.find(selector).first();
      if (img.length > 0 && img.attr('src')) {
        const src = img.attr('src');
        if (src.startsWith('http')) {
          product.imageUrl = src;
          break;
        }
      }
    }

    // 是否是广告产品
    product.isSponsored = $element.hasClass('AdHolder');

    // 设置position_type
    product.positionType = product.isSponsored ? 'sp' : 'organic';

    // 如果是广告产品，提取广告参数
    if (product.isSponsored) {
      // 提取广告类型文本
      const adTypeTextSelectors = [
        'span.puis-label-popover-default',
        'a.puis-sponsored-label-text > .puis-label-popover-default > span',
        'a.puis-sponsored-label-text .puis-label-popover-default span',
        '.s-sponsored-label-text'
      ];

      for (const selector of adTypeTextSelectors) {
        const adTypeText = $element.find(selector).first();
        if (adTypeText.length > 0) {
          product.adTypeText = adTypeText.text().trim();
          break;
        }
      }

      // 提取广告参数
      const adParams = extractAdParams($element);
      product.adCampaignId = adParams.adCampaignId;
      product.adId = adParams.adId;
      product.sku = adParams.sku;

      const adOtherParams = extractAdParamFromImpressionLogger($element);
      product.qualifier = adOtherParams.qualifier;
      product.adIndex = adOtherParams.adIndex;
      product.widgetName = adOtherParams.widgetName;
    }
  } catch (error) {
    logger.info('❌ 提取产品数据时出错:', error.message);
  }

  return product;
}

// SB/SBV位置类型映射
function getSBPositionOnPage(positionType) {
  const positionMapping = {
    'sb_top': 9990,
    'sb_middle': 9991,
    'sb_bottom': 9992,
    'sb_footer': 9993,
    // 容器内产品使用相同的值
    'sb_top_product': 9990,
    'sb_middle_product': 9991,
    'sb_bottom_product': 9992,
    'sb_footer_product': 9993,
    // 未知位置默认使用9999
    'sb_unknown': 9999,
    'sb_unknown_product': 9999
  };

  return positionMapping[positionType] || 9999;
}

// 确定SB/SBV位置类型
function determineSBPositionType($container) {
  try {
    // 获取容器HTML内容用于位置识别
    const containerHtml = $container.html() || '';

    // 直接在HTML内容中查找位置标识字符串
    const hasTopIdentifier = containerHtml.includes('top-slot');
    const hasMiddleIdentifier = containerHtml.includes('inline-slot');
    const hasBottomIdentifier = containerHtml.includes('bottom-slot');
    const hasFooterIdentifier = containerHtml.includes('footer-slot');

    // 按优先级判断位置类型
    if (hasTopIdentifier) {
      return 'sb_top';
    } else if (hasMiddleIdentifier) {
      return 'sb_middle';
    } else if (hasBottomIdentifier) {
      return 'sb_bottom';
    } else if (hasFooterIdentifier) {
      return 'sb_footer';
    }

    return 'sb_unknown';
  } catch (error) {
    logger.info('❌ 确定SB位置类型失败:', error.message);
    return 'sb_unknown';
  }
}

// 提取广告参数的通用函数
function extractAdParams($element) {
  const adParams = {
    adCampaignId: '',
    adId: '',
    sku: '',
  };

  try {
    const adAsinParent = $element.find('.a-popover-preload .a-declarative').first();

    if (adAsinParent) {
      const sSafeAjaxModalTrigger = adAsinParent.attr('data-s-safe-ajax-modal-trigger');
      const { ajaxUrl } = JSON.parse(sSafeAjaxModalTrigger || '{}') || {};

      if (ajaxUrl) {
        const decodedData = decodeURIComponent(ajaxUrl);

        const dataJsonString = decodedData.match(/{.+}/);

        if (dataJsonString) {
          const { adCreativeMetaData } = JSON.parse(dataJsonString[0]) || {};
          const { adCreativeDetails } = adCreativeMetaData || {};
          const adDetail = adCreativeDetails && adCreativeDetails.length > 0 ? adCreativeDetails[0] : null;

          if (adDetail) {
            adParams.adCampaignId = adDetail.campaignId || '';
            adParams.adId = adDetail.adId || '';
            adParams.sku = adDetail.sku || '';
          }
        }
      }
    }
  } catch (error) {
    logger.info('❌ 提取广告参数时出错:', error.message);
  }

  return adParams;
}

function extractAdParamFromImpressionLogger($element) {
  const adParams = {
    qualifier: '',
    adIndex: '',
    widgetName: ''
  };

  try {
    const impressionLogger = $element.find('[data-component-type="s-impression-logger"]').first();

    if (impressionLogger.length) {
      const propsStr = impressionLogger.attr('data-component-props');

      if (propsStr) {
        const props = JSON.parse(propsStr);
        const url = props.url || '';

        const getParam = (paramName) => {
          if (url && url.includes(`${paramName}=`)) {
            const regex = new RegExp(`${paramName}=([^&]+)`);
            const match = url.match(regex);

            if (match) {
              return match[1]
            }
          }

          return '';
        }

        adParams.qualifier = getParam('qualifier') || '';
        adParams.adIndex = getParam('adIndex') || '';
        adParams.widgetName = getParam('widgetName') || '';
      }
    }
  } catch (error) {
    logger.info('❌ 提取广告参数时出错:', error.message);
  }

  return adParams;
}

// 提取SP推荐专栏所有产品的广告参数
function extractAdParamFromMultiFeedback($container) {
  try {
    const multiFeedbackElement = $container.find('[data-multi-ad-feedback-form-trigger]').first();

    if (multiFeedbackElement.length > 0) {
      const multiTriggerStr = multiFeedbackElement.attr('data-multi-ad-feedback-form-trigger');

      if (multiTriggerStr) {
        // 解析JSON数据
        const multiData = JSON.parse(multiTriggerStr);

        // 解析嵌套的JSON
        const payloadStr = multiData.multiAdfPayload || '';

        if (payloadStr) {
          const payloadData = JSON.parse(payloadStr);
          const adCreativeMeta = payloadData.adCreativeMetaData || {};
          const adCreativeDetails = adCreativeMeta.adCreativeDetails || [];

          // 构建以ASIN为key的字典，方便查找
          const adDataByAsin = {};

          adCreativeDetails.forEach(detail => {
            const asin = detail.asin;

            if (asin) {
              adDataByAsin[asin] = {
                campaignId: detail.campaignId,
                adId: detail.adId,
                sku: detail.sku,
                title: detail.title,
                asin: asin
              };
            }
          });

          return adDataByAsin;
        }
      }
    }
  } catch (error) {
    logger.info('从multi feedback提取广告参数失败:', error.message);
  }

  return {};
}

// 处理SB容器内产品的函数
function processSBContainerProducts($, $container, sbPositionType, containerProduct = null) {
  const products = [];

  try {
    // 确定产品位置类型
    let productPositionType;
    switch (sbPositionType) {
      case 'sb_top':
        productPositionType = 'sb_top_product';
        break;
      case 'sb_middle':
        productPositionType = 'sb_middle_product';
        break;
      case 'sb_bottom':
        productPositionType = 'sb_bottom_product';
        break;
      case 'sb_footer':
        productPositionType = 'sb_footer_product';
        break;
      default:
        productPositionType = 'sb_unknown_product';
    }

    // 检查是否为 sb-video-creative 容器
    const isSBVideoCreative = $container.hasClass('sb-video-creative');

    // 查找容器下的产品 - 支持多种选择器
    let productsInContainer = $container.find('[data-asin]');

    // 如果没有找到，并且是 sb-video-creative 容器，尝试 declarative 选择器
    if (productsInContainer.length === 0 && isSBVideoCreative) {
      productsInContainer = $container.find('.a-declarative[data-csa-c-type="item"]');
    }

    // 提取容器的广告信息，供产品继承
    const containerAdCampaignId = containerProduct ? containerProduct.adCampaignId : '';
    const containerAdId = containerProduct ? containerProduct.adId : '';

    // 处理容器内的每个产品
    productsInContainer.each((productIndex, productContainer) => {
      try {
        const $productContainer = $(productContainer);
        const product = extractProductData($, $productContainer);

        // 如果原有方法没有获取到 ASIN，尝试 declarative 方式
        if (product && !product.asin && isSBVideoCreative) {
          const dataCsaCType = $productContainer.attr('data-csa-c-type');
          if (dataCsaCType === 'item') {
            const itemId = $productContainer.attr('data-csa-c-item-id');
            if (itemId) {
              // 清洗 ASIN 数据：提取真正的 ASIN
              product.asin = cleanAsinData(itemId);
            }
          }
        }

        // 如果仍然没有产品或ASIN，尝试手动创建产品对象
        if (!product || !product.asin) {
          const manualProduct = new ProductItem();
          manualProduct.asin = $productContainer.attr('data-asin');
          manualProduct.positionType = productPositionType;
          manualProduct.isSponsored = true;

          // 处理 declarative 类型的 ASIN
          if (!manualProduct.asin && isSBVideoCreative) {
            const dataCsaCType = $productContainer.attr('data-csa-c-type');
            if (dataCsaCType === 'item') {
              const itemId = $productContainer.attr('data-csa-c-item-id');
              if (itemId) {
                manualProduct.asin = cleanAsinData(itemId);
              }
            }
          }

          if (manualProduct.asin) {
            Object.assign(product || {}, manualProduct);
          }
        }

        if (product && (product.asin || product.title)) {
          // 设置位置信息
          product.positionOnPage = getSBPositionOnPage(productPositionType);
          product.positionValue = productIndex + 1;
          product.positionType = productPositionType;

          // 继承容器的广告信息（如果没有自己的广告信息）
          if (!product.adCampaignId && containerAdCampaignId) {
            product.adCampaignId = containerAdCampaignId;
          }
          if (!product.adId && containerAdId) {
            product.adId = containerAdId;
          }

          // 如果没有图片，尝试获取
          if (!product.imageUrl) {
            const productImage = $productContainer.find('img').first();
            if (productImage.length > 0 && productImage.attr('src')) {
              product.imageUrl = productImage.attr('src');
              if (!product.title) {
                product.title = productImage.attr('alt') || '';
              }
            }
          }

          // SB 容器内的产品都应该是广告
          product.isSponsored = true;

          products.push(product);
        }
      } catch (error) {
        logger.info(`❌ 提取SB容器第 ${productIndex + 1} 个产品失败: ${error.message}`);
      }
    });
  } catch (error) {
    logger.info('❌ 处理SB容器产品时出错:', error.message);
  }

  return products;
}

// 处理SB容器内品牌图片的函数
function processSBContainerBrandImages($, $container, sbPositionType) {
  const brandProducts = [];

  try {
    // 查找没有 data-asin 的元素（品牌图片）
    const brandElements = $container.find('.s-result-item:not([data-asin])');

    brandElements.each((brandIndex, brandElement) => {
      try {
        const $brandElement = $(brandElement);

        // 检查是否真的是品牌图片（包含品牌相关属性）
        if (!$brandElement.find('img[alt], [data-brand], [data-ad-id]').length) {
          return;
        }

        const product = new ProductItem();

        // 设置基本信息
        product.positionOnPage = getSBPositionOnPage(sbPositionType);
        product.positionValue = brandIndex + 1;
        product.positionType = sbPositionType;
        product.isSponsored = true;
        product.asin = null; // 品牌图片没有ASIN

        // 提取品牌信息
        const imgElement = $brandElement.find('img[alt]').first();
        if (imgElement.length > 0) {
          product.brand = imgElement.attr('alt') || '';
          product.title = product.brand;
          if (imgElement.attr('src')) {
            product.imageUrl = imgElement.attr('src');
          }
        }

        // 尝试从data属性提取广告信息
        const dataAdId = $brandElement.attr('data-ad-id');
        const dataCampaignId = $brandElement.attr('data-campaign-id');

        if (dataAdId) {
          product.adId = dataAdId;
        }
        if (dataCampaignId) {
          product.adCampaignId = dataCampaignId;
        }

        if (product.isValid()) {
          brandProducts.push(product);
        }
      } catch (error) {
        logger.info(`❌ 提取SB容器品牌图片第 ${brandIndex + 1} 个失败: ${error.message}`);
      }
    });
  } catch (error) {
    logger.info('❌ 处理SB容器品牌图片时出错:', error.message);
  }

  return brandProducts;
}

// 清洗 ASIN 数据的辅助函数
function cleanAsinData(rawAsin) {
  if (!rawAsin) {
    return '';
  }

  try {
    // 如果包含 "amzn1.asin."，提取其后的部分
    if (rawAsin.includes('amzn1.asin.')) {
      // 找到 "amzn1.asin." 后的部分
      let asinPart = rawAsin.split('amzn1.asin.')[1];

      // 如果包含冒号，取冒号前的部分
      if (asinPart.includes(':')) {
        asinPart = asinPart.split(':')[0];
      }

      return asinPart.trim();
    }

    // 如果不包含特殊前缀，直接返回（可能已经是清洗后的格式）
    return rawAsin.trim();
  } catch (error) {
    logger.info('❌ 清洗 ASIN 数据失败:', error.message);
    return rawAsin;
  }
}

// 提取 SB/SBV 容器信息的辅助函数
function extractSBContainerInfo($container, positionType) {
  const product = new ProductItem();

  try {
    // 设置位置类型和广告标识
    product.positionType = positionType;
    product.isSponsored = true; // SB/SBV都是广告

    // 检查是否为 sbv-video-single-product 类型
    const componentType = $container.attr('data-component-type');
    if (componentType === 'sbv-video-single-product') {
      // 从 data-component-props 中提取广告信息
      const componentProps = $container.attr('data-component-props');
      if (componentProps) {
        try {
          const props = JSON.parse(componentProps);

          // 提取广告参数
          product.adCampaignId = props.campaignId || '';
          product.adId = props.adId || '';

          // 提取视频信息
          product.videoSourceUrl = props.videoSrc || '';
          product.videoPosterUrl = props.videoPreviewImageSrc || '';
        } catch (e) {
          logger.info('❌ 解析 data-component-props 失败:', e.message);
        }
      }
    }

    // 提取视频信息 (SBV类型) - 更新选择器支持更多video元素
    if (!product.videoSourceUrl) {
      const videoElement = $container.find('video.sbv-video-player, video, [data-type="videoContainer"] video').first();

      if (videoElement.length > 0) {
        // 提取视频源URL
        product.videoSourceUrl = videoElement.attr('src') || videoElement.attr('data-video-source') || '';
        // 提取视频预览图URL
        product.videoPosterUrl = videoElement.attr('poster') || videoElement.attr('data-poster') || '';
        // 提取视频标题/aria-label
        const videoAriaLabel = videoElement.attr('aria-label') || '';
        if (videoAriaLabel.trim()) {
          product.videoTitle = videoAriaLabel.trim();
        }
      }
    }

    // 从data-properties中提取品牌信息（原有逻辑保留）
    if (!product.adCampaignId) {
      const dataProperties = $container.attr('data-properties');
      if (dataProperties) {
        try {
          const props = JSON.parse(dataProperties);
          // 提取广告参数
          product.adCampaignId = props.campaignId || '';
          product.adId = props.adId || '';
          // 提取品牌信息
          product.brand = props.headline || '';

          // 提取其他可能的视频信息
          if (!product.videoSourceUrl) {
            product.videoSourceUrl = props.videoSrc || '';
          }
          if (!product.videoPosterUrl) {
            product.videoPosterUrl = props.videoPreviewImageSrc || '';
          }
        } catch (e) {
          logger.info('❌ 解析data-properties JSON失败:', e.message);
        }
      }
    }

    // 查找品牌logo
    const brandLogoImg = $container.find('[data-type="brandLogo"] img').first();
    if (brandLogoImg.length > 0 && brandLogoImg.attr('src')) {
      product.brandLogo = brandLogoImg.attr('src');
    }

    // 如果没有视频，可能是SB图片类型，查找品牌封面图
    if (!product.videoSourceUrl) {
      // 首先查找品牌封面图（通常是较大的宣传图片）
      const brandCoverImg = $container.find('img:not([data-type="brandLogo"])').first();
      if (brandCoverImg.length > 0 && brandCoverImg.attr('src')) {
        product.brandImage = brandCoverImg.attr('src');
      }
    }
  } catch (error) {
    logger.info('❌ 提取SB容器信息时出错:', error.message);
  }

  return product;
}

/**
 * 从 HTML 字符串直接提取 Amazon 产品数据
 * @param {string} htmlContent - HTML 字符串内容
 * @returns {Array<ProductItem>} 提取的产品数据列表
 */
async function extractAmazonProductsFromHTML(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    throw new Error('HTML内容不能为空且必须是字符串');
  }

  try {
    const $ = cheerio.load(htmlContent);

    // 初始化产品列表和位置计数器
    const products = [];
    let positionCounter = 0;
    let sponsoredPosition = 1;
    let organicPosition = 1;

    // 1. 处理常规产品容器
    const regularContainers = $('.s-result-item[role="listitem"]');

    regularContainers.each((i, element) => {
      try {
        const product = extractProductData($, $(element));

        if (product && product.isValid()) {
          positionCounter++;
          product.positionOnPage = positionCounter;

          if (product.isSponsored) {
            product.positionValue = sponsoredPosition;
            sponsoredPosition++;
          } else {
            product.positionValue = organicPosition;
            organicPosition++;
          }

          products.push(product);
        }
      } catch (error) {
        logger.info(`❌ 提取第 ${i + 1} 个常规产品失败: ${error.message}`);
      }
    });


    // 2. 查找 SP-推荐专栏 容器并直接处理
    const spContainers = $('.s-include-content-margin.s-widget-padding-bottom');

    spContainers.each((i, container) => {
      const $container = $(container);

      // 查找 h2 标题元素
      const titleElement = $container.find('.a-section.a-spacing-none.a-text-bold h2').first();
      const titleText = titleElement.text()?.trim() || '';

      // 根据 h2 的 id 准确判断是上部还是下部
      let positionType = null;

      if (titleElement.length > 0) {
        const titleId = titleElement.attr('id') || '';

        if (titleId === 'loom-desktop-inline-slot_featuredasins-heading') {
          positionType = 'sp_rec_top';
        } else if (titleId === 'loom-desktop-bottom-slot_featuredasins-heading') {
          positionType = 'sp_rec_bottom';
        }
      }

      // 获取当前 SP 推荐专栏容器的 ad_type_text
      const adTypeElement = $container.find('.s-widget-sponsored-label-text').first();
      const spAdTypeText = adTypeElement.text()?.trim() || '';

      // 一次性获取整个SP推荐专栏的广告数据
      const spAdData = extractAdParamFromMultiFeedback($container);

      // 查找该容器内的产品并直接处理
      const productsInContainer = $container.find('.s-result-item');

      productsInContainer.each((productIndex, productContainer) => {
        try {
          const product = extractProductData($, $(productContainer));

          if (product && product.isValid()) {
            product.positionType = positionType;
            product.positionOnPage = 9999; // SP 推荐专栏的特殊标识
            product.positionValue = productIndex + 1;
            product.adSectionTitle = titleText;
            product.adTypeText = spAdTypeText;
            product.isSponsored = true; // SP推荐专栏都是广告

            const adOtherParams = extractAdParamFromImpressionLogger($(productContainer));
            product.qualifier = adOtherParams.qualifier;
            product.adIndex = adOtherParams.adIndex;
            product.widgetName = adOtherParams.widgetName;

            // SP推荐专栏产品 - 从预先提取的sp_ad_data中获取广告参数
            if (spAdData && product.asin && spAdData[product.asin]) {
              const adInfo = spAdData[product.asin];

              product.adCampaignId = adInfo.campaignId || product.adCampaignId;
              product.adId = adInfo.adId || product.adId;
              product.sku = adInfo.sku || product.sku;
            }

            products.push(product);
          }
        } catch (error) {
          logger.info(`❌ 提取SP推荐专栏第 ${productIndex + 1} 个产品失败: ${error.message}`);
        }
      });
    });

    // 3. 查找并处理所有类型的 SB/SBV 容器

    // 3.1 处理 sb-video-creative 容器 (品牌视频+产品组合)
    const sbVideoContainers = $('.sb-video-creative');

    sbVideoContainers.each((i, container) => {
      const $container = $(container);

      try {
        // 确定 SB/SBV 的位置类型
        const sbPositionType = determineSBPositionType($container);

        // 提取 SB/SBV 容器信息并创建容器记录
        const containerProduct = extractSBContainerInfo($container, sbPositionType);

        if (containerProduct && containerProduct.isValid()) {
          containerProduct.positionOnPage = getSBPositionOnPage(sbPositionType);
          products.push(containerProduct);
        }

        // 处理容器内的产品
        const containerProducts = processSBContainerProducts($, $container, sbPositionType, containerProduct);
        products.push(...containerProducts);

        // 处理容器内的品牌图片
        const brandImages = processSBContainerBrandImages($, $container, sbPositionType);
        products.push(...brandImages);
      } catch (error) {
        logger.info(`❌ 处理SB/SBV视频容器 ${i + 1} 失败: ${error.message}`);
      }
    });

    // 3.2 处理 lifestyle-image-v4-creative-desktop-cards 容器 (品牌图片+产品组合)
    const sbLifestyleContainers = $('[data-csa-c-painter="lifestyle-image-v4-creative-desktop-cards"]');

    sbLifestyleContainers.each((i, container) => {
      const $container = $(container);

      try {
        // 确定 SB 的位置类型
        const sbPositionType = determineSBPositionType($container);

        // 提取 SB lifestyle 容器信息并创建容器记录
        const containerProduct = extractSBContainerInfo($container, sbPositionType);

        if (containerProduct && containerProduct.isValid()) {
          containerProduct.positionOnPage = getSBPositionOnPage(sbPositionType);
          products.push(containerProduct);
        }

        // 处理容器内的产品
        const containerProducts = processSBContainerProducts($, $container, sbPositionType, containerProduct);
        products.push(...containerProducts);

        // 处理容器内的品牌图片
        const brandImages = processSBContainerBrandImages($, $container, sbPositionType);
        products.push(...brandImages);
      } catch (error) {
        logger.info(`❌ 处理SB lifestyle容器 ${i + 1} 失败: ${error.message}`);
      }
    });

    // 3.3 处理 multi-brand-creative-desktop-cards 容器 (品牌组合)
    const sbBrandContainers = $('[data-csa-c-painter="multi-brand-creative-desktop-cards"]');

    sbBrandContainers.each((i, container) => {
      const $container = $(container);

      try {
        // 确定 SB 的位置类型
        const sbPositionType = determineSBPositionType($container);

        // 提取品牌容器
        const brandContainers = $container.find('.sbx-desktop');

        brandContainers.each((brandIndex, brandContainer) => {
          try {
            const product = new ProductItem();

            // 设置基本信息
            product.positionOnPage = getSBPositionOnPage(sbPositionType);
            product.positionValue = brandIndex + 1;
            product.positionType = sbPositionType;
            product.isSponsored = true;

            // 提取广告参数
            const adParams = extractAdParams($(brandContainer));
            product.adCampaignId = adParams.adCampaignId;
            product.adId = adParams.adId;
            product.sku = adParams.sku;

            const adOtherParams = extractAdParamFromImpressionLogger($(brandContainer));
            product.qualifier = adOtherParams.qualifier;
            product.adIndex = adOtherParams.adIndex;
            product.widgetName = adOtherParams.widgetName;

            // 提取品牌图片
            const imgElement = $(brandContainer).find('a.a-spacing-none.a-link-normal > img').first();
            if (imgElement.length > 0 && imgElement.attr('data-src')) {
              product.brandImage = imgElement.attr('data-src');
            }

            // 提取品牌 logo
            const logoImg = $(brandContainer).find('div.a-section.a-spacing-none > img').first();
            if (logoImg.length > 0 && logoImg.attr('data-src')) {
              product.brandLogo = logoImg.attr('data-src');
            }

            // 提取品牌链接
            const linkElement = $(brandContainer).find('a.a-spacing-none.a-link-normal[href]').first();
            if (linkElement.length > 0) {
              product.productUrl = linkElement.attr('href') || '';
            }

            if (product.isValid()) {
              products.push(product);
            }
          } catch (error) {
            logger.info(`❌ 提取SB品牌组合第 ${brandIndex + 1} 个品牌失败: ${error.message}`);
          }
        });

      } catch (error) {
        logger.info(`❌ 处理SB品牌组合容器 ${i + 1} 失败: ${error.message}`);
      }
    });

    return products;
  } catch (error) {
    logger.error('❌ HTML解析失败:', error.message);

    throw error;
  }
}

// 导出主要函数和类
module.exports = {
  extractAmazonProductsFromHTML
};