import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ProductSearch from './components/ProductSearch';
import TrackedProductsList from './components/TrackedProductsList';
import ScrapeLogTable from './components/ScrapeLogTable';
import ProductDetailModal from './components/ProductDetailModal';
import trackerApi from './api/trackerApi';
import { ShoppingBag, CheckCircle2, ShieldCheck, Activity, AlertCircle } from 'lucide-react';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [scrapingMap, setScrapingMap] = useState({});
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const showToast = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, logsRes] = await Promise.all([
        trackerApi.getTrackedProducts(),
        trackerApi.getAllLogs()
      ]);

      if (prodRes.success) setProducts(prodRes.data);
      if (logsRes.success) setLogs(logsRes.data);
    } catch (err) {
      console.error('[App Fetch Error]', err);
      showToast('Failed to load tracker dashboard data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrackProduct = async (productData) => {
    setIsTracking(true);
    showToast(`Adding and scraping "${productData.product_name}"...`, 'info');
    try {
      const res = await trackerApi.trackProduct(productData);
      if (res.success) {
        showToast(`Successfully tracked "${res.product.product_name}" at $${res.scrapeResult?.price || res.product.current_price}`, 'success');
        await fetchDashboardData();
      } else {
        showToast(res.error || 'Failed to track product', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Scrape execution error', 'error');
    } finally {
      setIsTracking(false);
    }
  };

  const handleScrapeSingle = async (product) => {
    setScrapingMap(prev => ({ ...prev, [product.id]: true }));
    showToast(`Scraping "${product.product_name}" live with Playwright...`, 'info');
    try {
      const res = await trackerApi.trackProduct({
        product_name: product.product_name,
        product_url: product.product_url,
        image_url: product.image_url
      });
      if (res.success) {
        showToast(`Scrape finished for "${product.product_name}". Current price: $${res.scrapeResult?.price}`, 'success');
        await fetchDashboardData();
      }
    } catch (err) {
      showToast(`Scrape failed: ${err.message}`, 'error');
    } finally {
      setScrapingMap(prev => ({ ...prev, [product.id]: false }));
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to stop tracking this product?')) return;
    try {
      const res = await trackerApi.deleteProduct(id);
      if (res.success) {
        showToast('Product removed from tracking list', 'info');
        await fetchDashboardData();
      }
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const handleRefreshAll = async () => {
    setIsScrapingAll(true);
    showToast('Executing webhook cron scrape across all tracked products...', 'info');
    try {
      const res = await trackerApi.triggerCronScrape();
      if (res.success) {
        showToast(`Cron scrape complete! Success: ${res.successCount}, Failed: ${res.failedCount}`, 'success');
        await fetchDashboardData();
      }
    } catch (err) {
      showToast(`Cron scrape failed: ${err.message}`, 'error');
    } finally {
      setIsScrapingAll(false);
    }
  };

  // Metrics calculation
  const totalTracked = products.length;
  const inStockCount = products.filter(p => p.in_stock).length;
  const totalLogs = logs.length;
  const successLogs = logs.filter(l => l.status === 'SUCCESS' || l.status === 'RETRIED').length;
  const successRate = totalLogs > 0 ? ((successLogs / totalLogs) * 100).toFixed(0) : 100;

  return (
    <div className={isDarkMode ? 'dark bg-slate-950 text-slate-100 min-h-screen' : 'light bg-slate-100 text-slate-900 min-h-screen'}>
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl animate-bounce">
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Navigation Header */}
      <Navbar
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onRefreshAll={handleRefreshAll}
        isScrapingAll={isScrapingAll}
      />

      {/* Main Dashboard Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* KPI Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          <div className="glass-card rounded-2xl p-5 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Total Tracked</p>
              <h3 className="text-2xl font-black text-white mt-0.5">{totalTracked}</h3>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">In Stock Available</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-0.5">{inStockCount}</h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Scrape Success Rate</p>
              <h3 className="text-2xl font-black text-cyan-400 mt-0.5">{successRate}%</h3>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Total Audit Scrapes</p>
              <h3 className="text-2xl font-black text-purple-400 mt-0.5">{totalLogs}</h3>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Activity className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* Product Live Search & URL Input */}
        <ProductSearch onTrackProduct={handleTrackProduct} isTracking={isTracking} />

        {/* Tracked Products Grid */}
        <TrackedProductsList
          products={products}
          onSelectProduct={(prod) => setSelectedProduct(prod)}
          onDeleteProduct={handleDeleteProduct}
          onScrapeSingle={handleScrapeSingle}
          scrapingMap={scrapingMap}
        />

        {/* Execution Audit Log Table */}
        <ScrapeLogTable logs={logs} />

      </main>

      {/* Product Detail & Historical Chart Drawer Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onRefreshSingle={handleScrapeSingle}
        />
      )}

    </div>
  );
}
