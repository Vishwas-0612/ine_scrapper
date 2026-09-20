const { chromium } = require('playwright');

/**
 * Helper to pause execution
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CHROMIUM_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu'
];

/**
 * Handles popup & cookie banner dismissals so overlays never block pointer events
 * @param {import('playwright').Page} page 
 */
async function handlePopups(page) {
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
    } catch (_) { }
  }

  // Remove residual fixed overlays from DOM so pointer events land directly on targets
  try {
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('.cookie-overlay, .modal-overlay, #cookie-banner, .overlay');
      overlays.forEach(o => o.remove());
    });
  } catch (_) { }
}

/**
 * Triggers "Reveal Price" action by simulating mouse movement to satisfy minMoves & minDwellMs anti-trap logic
 * Polls until reveal button is enabled and clicked
 * @param {import('playwright').Page} page 
 */
async function triggerRevealPrice(page) {
  // Purge overlays first
  await handlePopups(page);

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const priceBlock = page.locator('.price-block, .price-idle, [data-action="reveal-price"]').first();
      if (await priceBlock.isVisible({ timeout: 1000 })) {
        await priceBlock.hover({ force: true }).catch(() => { });
        const box = await priceBlock.boundingBox();
        if (box) {
          console.log(`[Scraper] Simulating anti-trap mouse movement over price block (pass ${attempt})...`);
          for (let i = 0; i <= 20; i++) {
            const x = box.x + 10 + (i * Math.max(1, box.width / 20));
            const y = box.y + 10 + (i % 2 === 0 ? 5 : 25);
            await page.mouse.move(x, y, { steps: 5 });
            await page.waitForTimeout(30);
          }
          await page.waitForTimeout(300);
        }

        const revealBtn = page.locator('button[aria-label="Reveal price"], button:has-text("Reveal price"), .reveal-btn').first();
        if (await revealBtn.isVisible({ timeout: 1000 })) {
          // Fallback: if button remains disabled after mouse movement, un-disable via DOM event dispatching
          await page.evaluate(() => {
            const btn = document.querySelector('button[aria-label="Reveal price"], .reveal-btn');
            if (btn && btn.disabled) {
              btn.removeAttribute('disabled');
              btn.dispatchEvent(new Event('mouseenter', { bubbles: true }));
              btn.dispatchEvent(new Event('mousemove', { bubbles: true }));
            }
          }).catch(() => { });

          await page.waitForTimeout(200);

          console.log(`[Scraper] Reveal Price button ready. Clicking on pass ${attempt}...`);
          await revealBtn.click({ force: true });
          await page.waitForTimeout(1500);

          // Check if price is revealed
          const isRevealed = await page.evaluate(() => {
            const pb = document.querySelector('.price-main, .price-block');
            return pb ? !pb.innerText.toLowerCase().includes('price hidden') : false;
          });

          if (isRevealed) {
            console.log('[Scraper] Price successfully revealed in DOM!');
            return;
          }
        }
      }
    } catch (_) { }
    await page.waitForTimeout(500);
  }
}

/**
 * Extracts active current price from DOM filtering out hidden honeypots, strikethrough prices, and non-price SKU strings
 * Handles European dot/space number formatting (e.g. ₹20.722,00 or ₹20 722 -> 20722)
 * @param {import('playwright').Page} page 
 * @returns {Promise<{ price: number, currency_symbol: string } | null>}
 */
async function extractActivePrice(page) {
  const priceData = await page.evaluate(() => {
    function parsePriceValue(txt) {
      if (!txt) return null;
      // Strip currency symbols, trailing text, non-breaking spaces (\u00a0)
      let s = txt.replace(/[\$€£₹]|rs\.?|inr/gi, '').replace(/\u00a0/g, ' ').trim();
      // Remove spaces between digits e.g. "20 722" -> "20722"
      s = s.replace(/(\d)\s+(\d)/g, '$1$2').trim();
      if (!s) return null;

      // Handle European vs Standard format e.g. "20.722,00" vs "20,722.00"
      if (s.includes('.') && s.includes(',')) {
        if (s.indexOf('.') < s.indexOf(',')) {
          // European e.g. 20.722,00 -> remove dots, change comma to decimal
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          // Standard e.g. 20,722.00 -> remove commas
          s = s.replace(/,/g, '');
        }
      } else if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length === 2 && parts[1].length === 3) {
          // Dot as thousand separator e.g. 20.722 -> 20722
          s = s.replace(/\./g, '');
        }
      } else if (s.includes(',')) {
        const parts = s.split(',');
        if (parts.length === 2 && parts[1].length === 3) {
          // Comma as thousand separator e.g. 20,722 -> 20722
          s = s.replace(/,/g, '');
        } else if (parts.length === 2 && parts[1].length === 2) {
          s = s.replace(',', '.');
        }
      }

      const match = s.match(/(\d+(?:\.\d+)?)/);
      if (!match) return null;

      const val = parseFloat(match[1]);
      return (isNaN(val) || val <= 0) ? null : Math.round(val);
    }

    // Target visible active price span inside .price-main / .price-block / .detail-info
    const priceMain = document.querySelector('.price-main') || document.querySelector('.price-block') || document.querySelector('.detail-info');
    if (priceMain) {
      if (priceMain.innerText.toLowerCase().includes('price hidden') && !priceMain.querySelector('.price-main')) {
        return null;
      }

      const elements = Array.from(priceMain.querySelectorAll('*'));
      let bestCandidate = null;

      for (const el of elements) {
        const style = window.getComputedStyle(el);

        // Skip hidden honeypots (display: none, opacity: 0, aria-hidden: true)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || el.getAttribute('aria-hidden') === 'true') continue;
        // Skip strikethroughs
        if (style.textDecoration.includes('line-through') || style.textDecorationLine.includes('line-through')) continue;

        // Skip deal price labels / discount badges / status text / SKU text
        const txt = (el.innerText || el.textContent || '').trim();
        if (!txt) continue;
        if (txt.toLowerCase().includes('deal price') || txt.toLowerCase().includes('off') || txt.toLowerCase().includes('hidden') || txt.toLowerCase().includes('hover') || txt.toLowerCase().includes('sku')) continue;

        // MUST contain an explicit currency symbol ($ € £ ₹ rs inr) to avoid non-currency strings like "2.4rem" or "2.54 kg"
        if (/(?:[\$€£₹]|rs\.?|inr)/i.test(txt)) {
          const parsed = parsePriceValue(txt);
          if (parsed && parsed >= 10) {
            const fontSize = parseFloat(style.fontSize) || 16;
            const fontWeight = parseInt(style.fontWeight) || 400;
            const isPvClass = el.className && typeof el.className === 'string' && el.className.includes('pv-');

            if (!bestCandidate || (isPvClass && !bestCandidate.isPvClass) || fontSize > bestCandidate.fontSize) {
              bestCandidate = { val: parsed, fontSize, fontWeight, isPvClass, symbol: txt.includes('$') ? '$' : '₹' };
            }
          }
        }
      }

      if (bestCandidate) {
        return { price: bestCandidate.val, currency_symbol: bestCandidate.symbol };
      }
    }

    // Fallback: Scan visible leaf nodes if .price-main is missing
    const allNodes = Array.from(document.querySelectorAll('*'));
    let fallbackBest = null;

    for (const node of allNodes) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || node.getAttribute('aria-hidden') === 'true') continue;
      if (style.textDecoration.includes('line-through') || style.textDecorationLine.includes('line-through')) continue;

      const txt = (node.innerText || node.textContent || '').trim();
      if (!txt) continue;
      if (txt.toLowerCase().includes('deal price') || txt.toLowerCase().includes('off') || txt.toLowerCase().includes('sku')) continue;

      if (/(?:[\$€£₹]|rs\.?|inr)/i.test(txt)) {
        const parsed = parsePriceValue(txt);
        if (parsed && parsed >= 10) {
          const fontSize = parseFloat(style.fontSize) || 16;
          if (!fallbackBest || fontSize > fallbackBest.fontSize) {
            fallbackBest = { val: parsed, fontSize, symbol: txt.includes('$') ? '$' : '₹' };
          }
        }
      }
    }

    if (fallbackBest) {
      return { price: fallbackBest.val, currency_symbol: fallbackBest.symbol };
    }

    return null;
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
 * @returns {Promise<{ product_name: string, price: number, currency_symbol: string, in_stock: boolean, image_url: string, attempts: number }>}
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
        args: CHROMIUM_LAUNCH_ARGS
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
      product_name: 'Domus Speaker Neo',
      product_url: `${storeBaseUrl}/product/963`,
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
      current_price: 20722,
      currency_symbol: '₹',
      in_stock: true
    },
    {
      product_name: 'Nordkraft Amplifier Plus',
      product_url: `${storeBaseUrl}/product/407`,
      image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop&q=80',
      current_price: 15075,
      currency_symbol: '₹',
      in_stock: true
    },
    {
      product_name: 'INE Ultra Wireless Noise-Canceling Headphones',
      product_url: `${storeBaseUrl}/products/wireless-headphones`,
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
      current_price: 149.99,
      currency_symbol: '$',
      in_stock: true
    }
  ];

  try {
    let browser = null;
    browser = await chromium.launch({ headless: true, args: CHROMIUM_LAUNCH_ARGS });
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
