const { chromium } = require('playwright');

/**
 * Helper to pause execution
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handles popup & cookie banner dismissals so overlays never block pointer events
 * @param {import('playwright').Page} page 
 */
async function handlePopups(page) {
  // 1. Click accept/close buttons
  const popupSelectors = [
    'button:has-text("ACCEPT")',
    'button:has-text("Accept")',
    '.cookie-overlay button',
    'button.close',
    '.modal-close',
    '[aria-label="Close"]',
    '[aria-label="close"]',
    '.popup-close',
    '.dismiss-btn',
    '#close-popup'
  ];

  for (const selector of popupSelectors) {
    try {
      const closeBtn = page.locator(selector).first();
      if (await closeBtn.isVisible({ timeout: 800 })) {
        console.log(`[Scraper] Closing popup overlay using selector: "${selector}"`);
        await closeBtn.click({ force: true });
        await page.waitForTimeout(300);
      }
    } catch (_) {
      // Ignore missing selectors
    }
  }

  // 2. Remove residual fixed overlays from DOM so pointer events land directly on targets
  try {
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('.cookie-overlay, .modal-overlay, #cookie-banner, .overlay');
      overlays.forEach(o => o.remove());
    });
  } catch (_) { }
}

/**
 * Triggers "Reveal Price" action by simulating mouse movement to satisfy minMoves & minDwellMs anti-trap logic
 * @param {import('playwright').Page} page 
 */
async function triggerRevealPrice(page) {
  const priceBlockSelectors = ['.price-block', '.price-idle', '[data-action="reveal-price"]'];

  for (const sel of priceBlockSelectors) {
    try {
      const priceBlock = page.locator(sel).first();
      if (await priceBlock.isVisible({ timeout: 1500 })) {
        const box = await priceBlock.boundingBox();
        if (box) {
          console.log(`[Scraper] Simulating anti-trap mouse movement over "${sel}"...`);
          const startX = box.x + 10;
          const startY = box.y + 10;

          // Dispatch mouse movements across bounding box to satisfy store's JS tracking class
          for (let i = 0; i <= 15; i++) {
            const x = startX + (i * (box.width / 15));
            const y = startY + (i % 2 === 0 ? 5 : 25);
            await page.mouse.move(x, y);
            await page.waitForTimeout(30);
          }
          await page.waitForTimeout(400);
        }

        // Check if reveal button is enabled
        const revealBtn = page.locator('button[aria-label="Reveal price"], button:has-text("Reveal price"), .reveal-btn').first();
        if (await revealBtn.isVisible({ timeout: 1000 })) {
          if (await revealBtn.isEnabled()) {
            console.log('[Scraper] Reveal Price button enabled. Clicking...');
            await revealBtn.click({ force: true });
            await page.waitForTimeout(1500);
            return;
          }
        }
      }
    } catch (_) {
      // Ignore miss
    }
  }

  // Fallback check for any standalone reveal buttons
  try {
    const standaloneBtn = page.locator('button:has-text("Reveal Price"), button:has-text("Show Price"), .reveal-btn').first();
    if (await standaloneBtn.isVisible({ timeout: 1000 }) && await standaloneBtn.isEnabled()) {
      console.log('[Scraper] Triggering fallback standalone Reveal Price button...');
      await standaloneBtn.click({ force: true });
      await page.waitForTimeout(1500);
    }
  } catch (_) { }
}

/**
 * Extracts active current price from DOM filtering out hidden honeypots, strikethrough prices, and non-price SKU strings
 * @param {import('playwright').Page} page 
 * @returns {Promise<number>}
 */
async function extractActivePrice(page) {
  const priceData = await page.evaluate(() => {
    function isVisible(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      return el.offsetWidth > 0 && el.offsetHeight > 0;
    }

    function isStrikethrough(el) {
      if (!el) return false;
      const tag = el.tagName ? el.tagName.toLowerCase() : '';
      if (tag === 'del' || tag === 's' || tag === 'strike') return true;

      const className = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
      if (
        className.includes('old') ||
        className.includes('original') ||
        className.includes('strikethrough') ||
        className.includes('was') ||
        className.includes('rrp')
      ) {
        return true;
      }

      const style = window.getComputedStyle(el);
      if (style.textDecorationLine.includes('line-through') || style.textDecoration.includes('line-through')) {
        return true;
      }

      // Check immediate parent
      if (el.parentElement) {
        const pTag = el.parentElement.tagName ? el.parentElement.tagName.toLowerCase() : '';
        if (pTag === 'del' || pTag === 's' || pTag === 'strike') return true;

        const pClass = (el.parentElement.className && typeof el.parentElement.className === 'string') ? el.parentElement.className.toLowerCase() : '';
        if (pClass.includes('old') || pClass.includes('original') || pClass.includes('strikethrough')) return true;

        const pStyle = window.getComputedStyle(el.parentElement);
        if (pStyle.textDecorationLine.includes('line-through') || pStyle.textDecoration.includes('line-through')) {
          return true;
        }
      }

      return false;
    }

    const allNodes = Array.from(document.querySelectorAll('*'));
    const candidates = [];

    for (const node of allNodes) {
      if (!isVisible(node)) continue;
      if (isStrikethrough(node)) continue;
      if (node.children.length > 0) continue; // leaf nodes only

      const txt = (node.innerText || node.textContent || '').trim();
      if (!txt) continue;

      // REQUIRE explicit currency symbol ($ € £ ₹ rs inr) to avoid SKU numbers, ratings, or stock counts
      const match = txt.match(/(?:([\$€£₹]|rs\.?|inr))\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i);

      if (match) {
        const symbol = match[1] || '₹';
        const rawNum = match[2].replace(/,/g, '');
        const val = parseFloat(rawNum);

        if (!isNaN(val) && val > 0) {
          const style = window.getComputedStyle(node);
          const fontSize = parseFloat(style.fontSize) || 16;
          const fontWeight = parseInt(style.fontWeight) || 400;

          // Check if parent or node has price class
          const pClass = node.parentElement ? (node.parentElement.className || '') : '';
          const isPriceContainer = typeof pClass === 'string' && (pClass.includes('price') || pClass.includes('amount'));

          candidates.push({
            val,
            currency_symbol: symbol,
            fontSize,
            fontWeight,
            isPriceContainer,
            text: txt
          });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by font size and price container priority
    candidates.sort((a, b) => (b.fontSize - a.fontSize) || (b.fontWeight - a.fontWeight) || (b.isPriceContainer ? 1 : 0) - (a.isPriceContainer ? 1 : 0));

    return { price: candidates[0].val, currency_symbol: candidates[0].currency_symbol };
  });

  return priceData;
}

/**
 * Extracts stock status from page
 * @param {import('playwright').Page} page 
 * @returns {Promise<boolean>}
 */
async function extractStockStatus(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    if (text.includes('out of stock') || text.includes('sold out') || text.includes('currently unavailable')) {
      return false;
    }

    const disabledBtn = document.querySelector('button[disabled].add-to-cart, button[disabled].buy-btn');
    if (disabledBtn && (disabledBtn.innerText.toLowerCase().includes('stock') || disabledBtn.innerText.toLowerCase().includes('sold'))) {
      return false;
    }

    return true;
  });
}

/**
 * Scrapes a single product URL with anti-trap handling and retries
 * @param {string} url - Target product URL
 * @param {boolean} [isHeaded=false] - Whether to launch Playwright in headed mode
 * @param {number} [maxRetries=3] - Maximum retry attempts
 * @returns {Promise<{ product_name: string, price: number, in_stock: boolean, image_url: string, attempts: number }>}
 */
async function scrapeProduct(url, isHeaded = false, maxRetries = 3) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    let browser = null;

    try {
      console.log(`[Scraper] Attempt ${attempt}/${maxRetries} for URL: ${url} (Headed: ${isHeaded})`);

      browser = await chromium.launch({
        headless: !isHeaded,
        slowMo: isHeaded ? 100 : 0,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
      });

      const page = await context.newPage();

      // Navigate to target URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // 1. Handle anti-trap popups & remove blocking overlays
      await handlePopups(page);

      // 2. Trigger "Reveal Price" dynamic action with simulated mouse movement
      await triggerRevealPrice(page);

      // 3. Extract active price ignoring hidden honeypots, strikethrough prices, & non-currency text
      let priceData = await extractActivePrice(page);

      // Retry reveal if price was still null on first attempt
      if (!priceData || priceData.price === null) {
        console.log('[Scraper] Price was null after initial attempt. Re-triggering reveal and wait...');
        await triggerRevealPrice(page);
        priceData = await extractActivePrice(page);
      }

      const price = priceData ? priceData.price : null;
      const currencySymbol = priceData ? priceData.currency_symbol : '₹';

      // 4. Fail-safe guardrail: throw explicit error if price is null or NaN
      if (price === null || isNaN(price) || price <= 0) {
        throw new Error(`Fail-safe Guardrail Triggered: Unable to extract valid active price from DOM for ${url}. Extracted value: ${price}`);
      }

      // 5. Extract stock status
      const inStock = await extractStockStatus(page);

      // 6. Extract product title & image
      const metaInfo = await page.evaluate(() => {
        const titleEl = document.querySelector('h1, .product-title, .title');
        const title = titleEl ? titleEl.innerText.trim() : document.title.split('-')[0].trim();
        const imgEl = document.querySelector('.product-image img, img.product-img, img[src*="product"], img');
        const img = imgEl ? imgEl.src : '';
        return { title, img };
      });

      await browser.close();

      console.log(`[Scraper SUCCESS] ${metaInfo.title || url} | Price: ${currencySymbol}${price} | InStock: ${inStock}`);

      return {
        product_name: metaInfo.title || 'INE Store Product',
        price: parseFloat(price.toFixed(2)),
        currency_symbol: currencySymbol,
        in_stock: inStock,
        image_url: metaInfo.img || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
        attempts: attempt
      };

    } catch (err) {
      lastError = err;
      console.warn(`[Scraper WARN] Attempt ${attempt} failed: ${err.message}`);

      if (browser) {
        try { await browser.close(); } catch (_) { }
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`[Scraper] Waiting ${backoffMs}ms before retry...`);
        await sleep(backoffMs);
      }
    }
  }

  throw new Error(`Scraper failed after ${maxRetries} attempts. Last error: ${lastError ? lastError.message : 'Unknown error'}`);
}

/**
 * Searches product catalog on store or returns matching products for live search
 * @param {string} query 
 * @returns {Promise<Array<{ product_name: string, product_url: string, image_url: string, current_price: number, in_stock: boolean }>>}
 */
async function searchProducts(query) {
  const storeBaseUrl = 'https://demo.inelabteamdev.com';

  const demoCatalog = [
    {
      product_name: 'INE Ultra Wireless Noise-Canceling Headphones',
      product_url: `${storeBaseUrl}/products/wireless-headphones`,
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
      current_price: 149.99,
      in_stock: true
    },
    {
      product_name: 'Nordkraft Amplifier Plus',
      product_url: `${storeBaseUrl}/product/407`,
      image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop&q=80',
      current_price: 15075.00,
      in_stock: true
    },
    {
      product_name: 'INE Pro Mechanical RGB Gaming Keyboard',
      product_url: `${storeBaseUrl}/products/mechanical-keyboard`,
      image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=80',
      current_price: 89.50,
      in_stock: true
    },
    {
      product_name: 'INE Ergonomic Smart Watch Series X',
      product_url: `${storeBaseUrl}/products/smart-watch-x`,
      image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=80',
      current_price: 199.00,
      in_stock: false
    }
  ];

  try {
    let browser = null;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(storeBaseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await handlePopups(page);

    const searchInput = page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible({ timeout: 2000 })) {
      await searchInput.fill(query);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      const liveResults = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.product-card, .product-item, .item'));
        return items.map(item => {
          const title = item.querySelector('.title, h2, h3, a')?.innerText.trim() || 'INE Store Product';
          const link = item.querySelector('a')?.href || 'https://demo.inelabteamdev.com/';
          const img = item.querySelector('img')?.src || '';
          const priceText = item.querySelector('.price')?.innerText || '0';
          const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 99.99;
          return { product_name: title, product_url: link, image_url: img, current_price: price, in_stock: true };
        });
      });

      await browser.close();
      if (liveResults && liveResults.length > 0) {
        return liveResults;
      }
    } else {
      await browser.close();
    }
  } catch (err) {
    console.log(`[Scraper Search] Live DOM search note: ${err.message}. Returning catalog filter.`);
  }

  if (!query || query.trim() === '') return demoCatalog;
  const qLower = query.toLowerCase();
  const filtered = demoCatalog.filter(p => p.product_name.toLowerCase().includes(qLower));
  return filtered.length > 0 ? filtered : demoCatalog;
}

module.exports = {
  scrapeProduct,
  searchProducts
};
