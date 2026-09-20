import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const trackerApi = {
  /**
   * Search INE store catalog live
   */
  searchProducts: async (query) => {
    const res = await api.get(`/api/search?q=${encodeURIComponent(query)}`);
    return res.data;
  },

  /**
   * Fetch all tracked products
   */
  getTrackedProducts: async () => {
    const res = await api.get('/api/products');
    return res.data;
  },

  /**
   * Track a new product and perform immediate scrape
   */
  trackProduct: async (productData) => {
    const res = await api.post('/api/products/track', productData);
    return res.data;
  },

  /**
   * Fetch historical price points for product
   */
  getProductHistory: async (id) => {
    const res = await api.get(`/api/products/${id}/history`);
    return res.data;
  },

  /**
   * Fetch execution logs for single product
   */
  getProductLogs: async (id) => {
    const res = await api.get(`/api/products/${id}/logs`);
    return res.data;
  },

  /**
   * Fetch all scrape logs across catalog
   */
  getAllLogs: async () => {
    const res = await api.get('/api/logs/all');
    return res.data;
  },

  /**
   * Delete tracked product
   */
  deleteProduct: async (id) => {
    const res = await api.delete(`/api/products/${id}`);
    return res.data;
  },

  /**
   * Manually trigger scrape-all webhook cron
   */
  triggerCronScrape: async (cronSecret = 'ine_scrapper_secret_cron_token_2026') => {
    const res = await api.post('/api/cron/scrape-all', {}, {
      headers: {
        'X-Cron-Secret': cronSecret
      }
    });
    return res.data;
  }
};

export default trackerApi;
