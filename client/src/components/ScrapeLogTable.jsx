import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, XCircle, Clock, FileText } from 'lucide-react';

export default function ScrapeLogTable({ logs }) {
  const [filter, setFilter] = useState('ALL');

  if (!logs || logs.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center border border-slate-800">
        <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No scrape execution audit logs recorded yet.</p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.status === filter;
  });

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 shadow-xl mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Execution Audit Logs
          </h3>
          <p className="text-xs text-slate-400">Real-time Playwright scraping attempt telemetry, anti-trap retries, & fail-safe guardrails</p>
        </div>

        {/* Filter Badges */}
        <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold self-start sm:self-auto">
          {['ALL', 'SUCCESS', 'RETRIED', 'FAILED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === tab
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold bg-slate-950/40">
              <th className="py-3 px-4 rounded-l-xl">Timestamp</th>
              <th className="py-3 px-4">Target Product</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Attempts</th>
              <th className="py-3 px-4 rounded-r-xl">Details & Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.map((log, idx) => {
              const formattedTime = new Date(log.timestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              const prodName = log.tracked_products?.product_name || 'INE Target Product';

              return (
                <tr key={log.id || idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {formattedTime}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-200 max-w-xs truncate">
                    {prodName}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {log.status === 'SUCCESS' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" /> SUCCESS
                      </span>
                    )}
                    {log.status === 'RETRIED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> RETRIED
                      </span>
                    )}
                    {log.status === 'FAILED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                        <XCircle className="w-3.5 h-3.5" /> FAILED
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-300">
                    {log.attempt_count || 1}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 max-w-md truncate">
                    {log.error_message ? (
                      <span className="text-rose-400 font-mono text-[11px]">{log.error_message}</span>
                    ) : (
                      <span className="text-emerald-400/80">Playwright DOM Anti-Trap & Strikethrough Filter Passed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
