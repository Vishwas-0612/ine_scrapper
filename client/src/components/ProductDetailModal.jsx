import React, { useState, useEffect } from 'react';
import { X, ExternalLink, RefreshCw, LineChart, ShieldCheck, AlertTriangle, XCircle, Clock } from 'lucide-react';
import trackerApi from '../api/trackerApi';
import PriceHistoryChart from './PriceHistoryChart';

export default function ProductDetailModal({ product, onClose, onRefreshSingle }) {
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);

  useEffect(() => {
    if (!product) return;
    fetchDetails();
  }, [product]);

  const fetchDetails = async () => {
    setIsLoading(true);
    try {
      const [histRes, logsRes] = await Promise.all([
        trackerApi.getProductHistory(product.id),
        trackerApi.getProductLogs(product.id)
      ]);
      if (histRes.success) setHistory(histRes.data);
      if (logsRes.success) setLogs(logsRes.data);
    } catch (err) {
      console.error('[Detail Modal Fetch Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrapeNow = async () => {
    setIsScraping(true);
    await onRefreshSingle(product);
    await fetchDetails();
    setIsScraping(false);
  };

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl glass-card rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl my-8">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product Overview Header */}
        <div className="flex flex-col sm:flex-row gap-6 items-start pb-6 border-b border-slate-800">
          <img
            src={product.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80'}
            alt={product.product_name}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover bg-slate-900 border border-slate-800 shrink-0"
          />

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${product.in_stock ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                {product.in_stock ? 'In Stock' : 'Out of Stock'}
              </span>
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1"
              >
                Store Link <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {product.product_name}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Active Scraped Price</span>
                <p className="text-3xl font-black text-cyan-400 tracking-tight">
                  {product.currency_symbol || '₹'}{typeof product.current_price === 'number' ? product.current_price.toLocaleString() : '0.00'}
                </p>
              </div>

              <button
                onClick={handleScrapeNow}
                disabled={isScraping}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-md shadow-cyan-600/20 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isScraping ? 'animate-spin' : ''}`} />
                <span>{isScraping ? 'Scraping Live...' : 'Trigger Playwright Scrape'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section: Historical Price Chart */}
        <div className="mt-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3">
            <LineChart className="w-5 h-5 text-cyan-400" />
            Historical Price Trend (Timestamp ASC)
          </h3>
          <PriceHistoryChart historyData={history} />
        </div>

        {/* Section: Product Logs */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-cyan-400" />
            Product Scrape Telemetry Logs (Timestamp DESC)
          </h3>

          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold bg-slate-950/40">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Attempts</th>
                  <th className="py-2.5 px-3">Error Trace / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((l, idx) => (
                  <tr key={l.id || idx} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      {l.status === 'SUCCESS' && <span className="text-emerald-400 font-bold">SUCCESS</span>}
                      {l.status === 'RETRIED' && <span className="text-amber-400 font-bold">RETRIED</span>}
                      {l.status === 'FAILED' && <span className="text-rose-400 font-bold">FAILED</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold">{l.attempt_count || 1}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {l.error_message || 'OK: Dynamic DOM price reveal successful'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
