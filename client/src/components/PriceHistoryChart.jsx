import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function PriceHistoryChart({ historyData }) {
  if (!historyData || historyData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
        No price history recorded yet. Scrape runs will populate historical data points here.
      </div>
    );
  }

  // Format timestamp for display
  const formattedData = historyData.map((item) => ({
    ...item,
    formattedDate: new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    price: Number(item.price)
  }));

  const prices = formattedData.map(d => d.price);
  const minPrice = Math.max(0, Math.min(...prices) * 0.9);
  const maxPrice = Math.max(...prices) * 1.1;

  return (
    <div className="w-full h-72 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis
            dataKey="formattedDate"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#475569' }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            domain={[minPrice, maxPrice]}
            tickFormatter={(val) => `₹${val.toLocaleString()}`}
            tickLine={false}
            axisLine={{ stroke: '#475569' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                    <p className="font-semibold text-slate-300">{data.formattedDate}</p>
                    <p className="text-cyan-400 font-extrabold text-sm">
                      Price: {data.currency_symbol || '₹'}{data.price.toLocaleString()}
                    </p>
                    <p className="text-slate-400">
                      Stock: <span className={data.in_stock ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                        {data.in_stock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#06b6d4"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#priceGradient)"
            dot={{ r: 4, fill: '#0891b2', stroke: '#06b6d4', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#38bdf8' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
