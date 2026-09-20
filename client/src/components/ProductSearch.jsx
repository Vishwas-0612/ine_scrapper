import React, { useState, useEffect } from 'react';
import { Search, Plus, ExternalLink, Loader2, Sparkles, Link as LinkIcon } from 'lucide-react';
import trackerApi from '../api/trackerApi';

export default function ProductSearch({ onTrackProduct, isTracking }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'custom'

  // Debounced search effect
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await trackerApi.searchProducts(query);
        if (res.success) {
          setResults(res.data);
        }
      } catch (err) {
        console.error('[Search Error]', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    onTrackProduct({
      product_name: 'Custom Target Product',
      product_url: customUrl.trim(),
      image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80'
    });
    setCustomUrl('');
  };

  return (
    <div className="w-full glass-card rounded-2xl p-6 shadow-xl border border-slate-800 mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Track Products from INE Store
          </h2>
          <p className="text-sm text-slate-400">Search live store inventory or submit custom product URLs for Playwright anti-trap scraping</p>
        </div>

        {/* Search Mode Tabs */}
        <div className="flex p-1 bg-slate-800/80 rounded-xl border border-slate-700/60 text-xs font-semibold self-start md:self-auto">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'catalog' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Store Search
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-lg transition-all ${activeTab === 'custom' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Custom URL Input
          </button>
        </div>
      </div>

      {/* Catalog Search Tab */}
      {activeTab === 'catalog' ? (
        <div className="relative">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products (e.g. Headphones, Keyboard, Smart Watch)..."
              className="w-full pl-12 pr-10 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all shadow-inner"
            />
            {isSearching && (
              <Loader2 className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" />
            )}
          </div>

          {/* Search Dropdown Results */}
          {results.length > 0 && (
            <div className="mt-3 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800/80 max-h-80 overflow-y-auto">
              {results.map((prod, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <img
                      src={prod.image_url}
                      alt={prod.product_name}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-800 border border-slate-700/50"
                    />
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                        {prod.product_name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-cyan-400">${prod.current_price.toFixed(2)}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${prod.in_stock ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {prod.in_stock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onTrackProduct(prod)}
                    disabled={isTracking}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 font-medium text-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Track</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Custom URL Input Tab */
        <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <LinkIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              required
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://demo.inelabteamdev.com/products/your-product-slug"
              className="w-full pl-12 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isTracking}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {isTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Track URL</span>
          </button>
        </form>
      )}
    </div>
  );
}
