const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { scrapeProduct, searchProducts } = require('../services/scraper');

// In-memory fallback database for graceful local execution if Supabase credentials are missing
const memoryDb = {
  products: [
    {
      id: 'prod-101',
      product_name: 'INE Ultra Wireless Noise-Canceling Headphones',
      product_url: 'https://demo.inelabteamdev.com/products/wireless-headphones',
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80',
      current_price: 149.99,
      in_stock: true,
      last_scraped_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
      id: 'prod-102',
      product_name: 'INE Pro Mechanical RGB Gaming Keyboard',
      product_url: 'https://demo.inelabteamdev.com/products/mechanical-keyboard',
      image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=80',
      current_price: 89.50,
      in_stock: true,
      last_scraped_at: new Date().toISOString(),
      created_at: new Date(Date.now() - 5 * 86400000).toISOString()
    }
  ],
  price_history: [
    { id: 'h1', product_id: 'prod-101', price: 169.99, in_stock: true, timestamp: new Date(Date.now() - 6 * 86400000).toISOString() },
    { id: 'h2', product_id: 'prod-101', price: 159.99, in_stock: true, timestamp: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: 'h3', product_id: 'prod-101', price: 149.99, in_stock: true, timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
    { id: 'h4', product_id: 'prod-102', price: 99.00, in_stock: true, timestamp: new Date(Date.now() - 3 * 86400000).toISOString() },
    { id: 'h5', product_id: 'prod-102', price: 89.50, in_stock: true, timestamp: new Date(Date.now() - 1 * 86400000).toISOString() }
  ],
  scrape_logs: [
    { id: 'l1', product_id: 'prod-101', status: 'SUCCESS', attempt_count: 1, error_message: null, timestamp: new Date(Date.now() - 1 * 86400000).toISOString() },
    { id: 'l2', product_id: 'prod-102', status: 'RETRIED', attempt_count: 2, error_message: 'Timeout waiting for reveal-btn, resolved on retry 2', timestamp: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'l3', product_id: 'prod-102', status: 'SUCCESS', attempt_count: 1, error_message: null, timestamp: new Date(Date.now() - 1 * 86400000).toISOString() }
  ]
};

const isSupabaseConfigured = () => {
  return process.env.SUPABASE_URL && 
         process.env.SUPABASE_SERVICE_ROLE_KEY && 
         !process.env.SUPABASE_URL.includes('placeholder');
};

/**
 * GET /api/search?q=query
 * Searches products on INE storefront
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const results = await searchProducts(query);
    return res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    console.error('[Route /api/search Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/products
 * Fetches all tracked products
 */
router.get('/products', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return res.json({ success: true, data });
      }
      console.warn('[Supabase Fetch Products Warning]', error);
    }

    // Return in-memory data if Supabase is offline or empty
    return res.json({ success: true, data: memoryDb.products });
  } catch (err) {
    console.error('[Route GET /api/products Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/products/track
 * Saves product and performs immediate initial scrape
 */
router.post('/products/track', async (req, res) => {
  const { product_name, product_url, image_url } = req.body;

  if (!product_url) {
    return res.status(400).json({ success: false, error: 'product_url is required.' });
  }

  let productRecord = null;
  const now = new Date().toISOString();

  try {
    if (isSupabaseConfigured()) {
      // Check existing product
      const { data: existing } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('product_url', product_url)
        .single();

      if (existing) {
        productRecord = existing;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('tracked_products')
          .insert([
            {
              product_name: product_name || 'INE Store Product',
              product_url,
              image_url: image_url || '',
              current_price: 0,
              in_stock: true,
              last_scraped_at: null,
              created_at: now
            }
          ])
          .select()
          .single();

        if (insertErr) throw insertErr;
        productRecord = inserted;
      }
    } else {
      let existing = memoryDb.products.find(p => p.product_url === product_url);
      if (!existing) {
        existing = {
          id: `prod-${Date.now()}`,
          product_name: product_name || 'INE Store Product',
          product_url,
          image_url: image_url || '',
          current_price: 0,
          in_stock: true,
          last_scraped_at: null,
          created_at: now
        };
        memoryDb.products.unshift(existing);
      }
      productRecord = existing;
    }

    // Perform immediate initial scrape
    let scrapeRes = null;
    let scrapeErr = null;

    try {
      scrapeRes = await scrapeProduct(product_url);
    } catch (err) {
      scrapeErr = err;
    }

    if (scrapeRes) {
      // Update product info
      productRecord.current_price = scrapeRes.price;
      productRecord.in_stock = scrapeRes.in_stock;
      productRecord.last_scraped_at = now;
      if (scrapeRes.product_name) productRecord.product_name = scrapeRes.product_name;
      if (scrapeRes.image_url) productRecord.image_url = scrapeRes.image_url;

      if (isSupabaseConfigured()) {
        await supabase
          .from('tracked_products')
          .update({
            current_price: scrapeRes.price,
            in_stock: scrapeRes.in_stock,
            last_scraped_at: now,
            product_name: productRecord.product_name,
            image_url: productRecord.image_url
          })
          .eq('id', productRecord.id);

        // CRITICAL BUG PREVENTION: Order and insert using 'timestamp' column
        await supabase.from('price_history').insert([
          {
            product_id: productRecord.id,
            price: scrapeRes.price,
            in_stock: scrapeRes.in_stock,
            timestamp: now
          }
        ]);

        await supabase.from('scrape_logs').insert([
          {
            product_id: productRecord.id,
            status: scrapeRes.attempts > 1 ? 'RETRIED' : 'SUCCESS',
            attempt_count: scrapeRes.attempts,
            error_message: null,
            timestamp: now
          }
        ]);
      } else {
        memoryDb.price_history.push({
          id: `h-${Date.now()}`,
          product_id: productRecord.id,
          price: scrapeRes.price,
          in_stock: scrapeRes.in_stock,
          timestamp: now
        });
        memoryDb.scrape_logs.push({
          id: `l-${Date.now()}`,
          product_id: productRecord.id,
          status: scrapeRes.attempts > 1 ? 'RETRIED' : 'SUCCESS',
          attempt_count: scrapeRes.attempts,
          error_message: null,
          timestamp: now
        });
      }

      return res.json({ success: true, product: productRecord, scrapeResult: scrapeRes });

    } else {
      // Scrape failed
      const errMsg = scrapeErr ? scrapeErr.message : 'Unknown scraping error';

      if (isSupabaseConfigured()) {
        await supabase.from('scrape_logs').insert([
          {
            product_id: productRecord.id,
            status: 'FAILED',
            attempt_count: 3,
            error_message: errMsg,
            timestamp: now
          }
        ]);
      } else {
        memoryDb.scrape_logs.push({
          id: `l-${Date.now()}`,
          product_id: productRecord.id,
          status: 'FAILED',
          attempt_count: 3,
          error_message: errMsg,
          timestamp: now
        });
      }

      return res.status(500).json({
        success: false,
        error: `Product saved, but initial scrape failed: ${errMsg}`,
        product: productRecord
      });
    }

  } catch (err) {
    console.error('[Route POST /api/products/track Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/products/:id/history
 * Returns price history ordered strictly by timestamp ASC
 */
router.get('/products/:id/history', async (req, res) => {
  const { id } = req.params;

  try {
    if (isSupabaseConfigured()) {
      // CRITICAL BUG PREVENTION: All queries MUST order using 'timestamp' column (NOT 'created_at')
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', id)
        .order('timestamp', { ascending: true });

      if (!error && data) {
        return res.json({ success: true, data });
      }
      console.warn('[Supabase History Fetch Error]', error);
    }

    // In-memory fallback
    const history = memoryDb.price_history
      .filter(h => h.product_id === id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return res.json({ success: true, data: history });

  } catch (err) {
    console.error('[Route GET /api/products/:id/history Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/products/:id/logs
 * Returns scrape logs ordered strictly by timestamp DESC
 */
router.get('/products/:id/logs', async (req, res) => {
  const { id } = req.params;

  try {
    if (isSupabaseConfigured()) {
      // CRITICAL BUG PREVENTION: All queries MUST order using 'timestamp' column (NOT 'created_at')
      const { data, error } = await supabase
        .from('scrape_logs')
        .select('*')
        .eq('product_id', id)
        .order('timestamp', { ascending: false });

      if (!error && data) {
        return res.json({ success: true, data });
      }
      console.warn('[Supabase Logs Fetch Error]', error);
    }

    // In-memory fallback
    const logs = memoryDb.scrape_logs
      .filter(l => l.product_id === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({ success: true, data: logs });

  } catch (err) {
    console.error('[Route GET /api/products/:id/logs Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/logs/all
 * Returns all scrape execution logs across all products
 */
router.get('/logs/all', async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      // CRITICAL BUG PREVENTION: Select and order by timestamp DESC
      const { data, error } = await supabase
        .from('scrape_logs')
        .select('*, tracked_products(product_name, product_url)')
        .order('timestamp', { ascending: false });

      if (!error && data) {
        return res.json({ success: true, data });
      }
    }

    const allLogs = memoryDb.scrape_logs
      .map(log => {
        const prod = memoryDb.products.find(p => p.id === log.product_id);
        return {
          ...log,
          tracked_products: prod ? { product_name: prod.product_name, product_url: prod.product_url } : null
        };
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({ success: true, data: allLogs });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/products/:id
 * Removes product from tracking
 */
router.delete('/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (isSupabaseConfigured()) {
      await supabase.from('price_history').delete().eq('product_id', id);
      await supabase.from('scrape_logs').delete().eq('product_id', id);
      const { error } = await supabase.from('tracked_products').delete().eq('id', id);

      if (error) throw error;
    } else {
      memoryDb.products = memoryDb.products.filter(p => p.id !== id);
      memoryDb.price_history = memoryDb.price_history.filter(h => h.product_id !== id);
      memoryDb.scrape_logs = memoryDb.scrape_logs.filter(l => l.product_id !== id);
    }

    return res.json({ success: true, message: `Product ${id} deleted successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cron/scrape-all
 * Scheduled cron job endpoint protected by X-Cron-Secret header
 */
router.post('/cron/scrape-all', async (req, res) => {
  const secretHeader = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_SECRET_KEY || 'ine_scrapper_secret_cron_token_2026';

  if (secretHeader !== expectedSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid X-Cron-Secret header.' });
  }

  try {
    let productsToScrape = [];

    if (isSupabaseConfigured()) {
      const { data } = await supabase.from('tracked_products').select('*');
      productsToScrape = data || [];
    } else {
      productsToScrape = memoryDb.products;
    }

    console.log(`[Cron Job] Starting scrape run for ${productsToScrape.length} products...`);

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const prod of productsToScrape) {
      const now = new Date().toISOString();
      try {
        const scrapeRes = await scrapeProduct(prod.product_url);
        successCount++;

        // Update product current_price
        prod.current_price = scrapeRes.price;
        prod.in_stock = scrapeRes.in_stock;
        prod.last_scraped_at = now;

        if (isSupabaseConfigured()) {
          await supabase
            .from('tracked_products')
            .update({ current_price: scrapeRes.price, in_stock: scrapeRes.in_stock, last_scraped_at: now })
            .eq('id', prod.id);

          // CRITICAL BUG PREVENTION: Order and insert using 'timestamp' column
          await supabase.from('price_history').insert([
            { product_id: prod.id, price: scrapeRes.price, in_stock: scrapeRes.in_stock, timestamp: now }
          ]);

          await supabase.from('scrape_logs').insert([
            {
              product_id: prod.id,
              status: scrapeRes.attempts > 1 ? 'RETRIED' : 'SUCCESS',
              attempt_count: scrapeRes.attempts,
              error_message: null,
              timestamp: now
            }
          ]);
        } else {
          memoryDb.price_history.push({
            id: `h-${Date.now()}`,
            product_id: prod.id,
            price: scrapeRes.price,
            in_stock: scrapeRes.in_stock,
            timestamp: now
          });
          memoryDb.scrape_logs.push({
            id: `l-${Date.now()}`,
            product_id: prod.id,
            status: scrapeRes.attempts > 1 ? 'RETRIED' : 'SUCCESS',
            attempt_count: scrapeRes.attempts,
            error_message: null,
            timestamp: now
          });
        }

        results.push({ id: prod.id, status: 'SUCCESS', price: scrapeRes.price, attempts: scrapeRes.attempts });

      } catch (err) {
        failedCount++;
        const errMsg = err.message;

        if (isSupabaseConfigured()) {
          await supabase.from('scrape_logs').insert([
            { product_id: prod.id, status: 'FAILED', attempt_count: 3, error_message: errMsg, timestamp: now }
          ]);
        } else {
          memoryDb.scrape_logs.push({
            id: `l-${Date.now()}`,
            product_id: prod.id,
            status: 'FAILED',
            attempt_count: 3,
            error_message: errMsg,
            timestamp: now
          });
        }

        results.push({ id: prod.id, status: 'FAILED', error: errMsg });
      }
    }

    return res.json({
      success: true,
      total: productsToScrape.length,
      successCount,
      failedCount,
      results
    });

  } catch (err) {
    console.error('[Route Cron Scrape-All Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
