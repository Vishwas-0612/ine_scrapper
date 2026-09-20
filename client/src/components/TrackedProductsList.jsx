import React from 'react';
import { ExternalLink, RefreshCw, Trash2, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, LineChart } from 'lucide-react';

export default function TrackedProductsList({ products, onSelectProduct, onDeleteProduct, onScrapeSingle, scrapingMap }) {
  if (!products || products.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center border border-slate-800 my-6">
        <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
          <LineChart className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">No Tracked Products Yet</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Use the search bar above to select products from the INE storefront or enter a target URL to start automated price tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span>Tracked Products</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {products.length} Items
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((prod) => {
          const isScraping = scrapingMap[prod.id] || false;
          const formattedDate = prod.last_scraped_at 
            ? new Date(prod.last_scraped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : 'Never';

          return (
            <div
              key={prod.id}
              className="glass-card rounded-2xl p-5 border border-slate-800 hover:border-slate-700 transition-all duration-300 flex flex-col justify-between group hover:shadow-xl hover:shadow-cyan-500/5"
            >
              <div>
                {/* Header Row: Stock status & External link */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      prod.in_stock
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {prod.in_stock ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> Out of Stock
                      </>
                    )}
                  </span>

                  <a
                    href={prod.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 transition-colors"
                    title="Open Store Link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Product Image & Title */}
                <div className="flex gap-4 items-start mb-4">
                  <img
                    src={prod.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=80'}
                    alt={prod.product_name}
                    className="w-20 h-20 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm line-clamp-2 group-hover:text-cyan-400 transition-colors">
                      {prod.product_name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Scraped: {formattedDate}
                    </p>
                  </div>
                </div>

                {/* Price Metric */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 mb-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-semibold">Active Price</span>
                    <div className="text-2xl font-black text-white tracking-tight">
                      {prod.currency_symbol || '₹'}{typeof prod.current_price === 'number' ? prod.current_price.toLocaleString() : '0.00'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => onSelectProduct(prod)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <LineChart className="w-3.5 h-3.5 text-cyan-400" />
                  <span>History & Logs</span>
                </button>

                <button
                  onClick={() => onScrapeSingle(prod)}
                  disabled={isScraping}
                  className="p-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 transition-all text-xs disabled:opacity-50"
                  title="Trigger Immediate Scrape"
                >
                  <RefreshCw className={`w-4 h-4 ${isScraping ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={() => onDeleteProduct(prod.id)}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 transition-all text-xs"
                  title="Stop Tracking Product"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
