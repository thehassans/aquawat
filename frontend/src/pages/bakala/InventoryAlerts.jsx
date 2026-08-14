import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageX, TrendingDown, ShieldAlert, AlertTriangle, RefreshCw, Search,
  ArrowRight, Boxes, CalendarClock, Wallet, FileDown
} from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { hasBusinessType } from '../../lib/businessTypes';

const FILTERS = [
  { id: 'all', label: 'All Alerts' },
  { id: 'outOfStock', label: 'Out of Stock' },
  { id: 'lowStock', label: 'Low Stock' },
  { id: 'expired', label: 'Expired' },
  { id: 'expiringSoon', label: 'Expiring Soon' },
];

const daysUntil = (date) => {
  if (!date) return null;
  const diff = new Date(date) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export default function InventoryAlerts() {
  const tenant = useSelector((state) => state.auth.tenant);
  const catalogBase = hasBusinessType(tenant, 'pharmacy') ? '/app/dashboard/pharmacy' : '/app/dashboard/bakala';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expiryWindow, setExpiryWindow] = useState(30);

  const fetchAlerts = async (windowDays = expiryWindow) => {
    try {
      setLoading(true);
      const res = await api.get('/bakala-products/inventory-alerts', {
        params: { expiryWindowDays: windowDays },
      });
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load inventory alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const tag = (items, type) => (items || []).map((p) => ({ ...p, _alertType: type }));
    let combined = [];
    if (filter === 'all') {
      combined = [
        ...tag(data.outOfStock, 'outOfStock'),
        ...tag(data.expired, 'expired'),
        ...tag(data.lowStock, 'lowStock'),
        ...tag(data.expiringSoon, 'expiringSoon'),
      ];
    } else {
      combined = tag(data[filter], filter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      combined = combined.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.nameAr?.toLowerCase().includes(q) ||
          p.primaryBarcode?.includes(q)
      );
    }
    return combined;
  }, [data, filter, search]);

  const summary = data?.summary || {
    lowStock: 0, outOfStock: 0, expired: 0, expiringSoon: 0, stockValueAtRisk: 0,
  };

  const exportCsv = () => {
    if (!rows.length) return toast.error('Nothing to export');
    const header = ['Type', 'Product', 'Barcode', 'In Stock', 'Alert Level', 'Expiry Date'];
    const body = rows.map((p) => [
      p._alertType,
      (p.name || '').replace(/,/g, ' '),
      p.primaryBarcode || '',
      p.stockQuantity ?? 0,
      p.minimumStockAlertLevel ?? '',
      p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : '',
    ]);
    const csv = [header, ...body].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_alerts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const metricCards = [
    { id: 'outOfStock', label: 'Out of Stock', value: summary.outOfStock, icon: PackageX, accent: 'rose' },
    { id: 'lowStock', label: 'Low Stock', value: summary.lowStock, icon: TrendingDown, accent: 'amber' },
    { id: 'expired', label: 'Expired', value: summary.expired, icon: ShieldAlert, accent: 'rose' },
    { id: 'expiringSoon', label: 'Expiring Soon', value: summary.expiringSoon, icon: CalendarClock, accent: 'blue' },
  ];

  const accentMap = {
    rose: 'bg-rose-50 text-rose-500',
    amber: 'bg-amber-50 text-amber-500',
    blue: 'bg-blue-50 text-blue-500',
    emerald: 'bg-emerald-50 text-emerald-500',
  };

  const typeBadge = (type) => {
    switch (type) {
      case 'outOfStock': return { label: 'Out of Stock', cls: 'bg-rose-100 text-rose-700' };
      case 'lowStock': return { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700' };
      case 'expired': return { label: 'Expired', cls: 'bg-rose-100 text-rose-700' };
      case 'expiringSoon': return { label: 'Expiring Soon', cls: 'bg-blue-100 text-blue-700' };
      default: return { label: type, cls: 'bg-gray-100 text-gray-600' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Inventory Alerts</h1>
          <p className="text-sm font-medium text-gray-400 mt-1 uppercase tracking-widest">Low Stock & Expiry Intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => fetchAlerts()}
            className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-black/20 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => {
          const Icon = m.icon;
          const active = filter === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setFilter(active ? 'all' : m.id)}
              className={`text-left bg-white dark:bg-dark-800 rounded-3xl p-6 border transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 ${
                active ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-100 dark:border-dark-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${accentMap[m.accent]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                {active && <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Filtering</span>}
              </div>
              <h3 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white">{m.value}</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{m.label}</p>
            </button>
          );
        })}
      </div>

      {/* Value at risk + window */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white flex items-center justify-between shadow-lg">
          <div>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Stock Value At Risk</p>
            <h3 className="text-3xl font-black tracking-tighter">SAR {Number(summary.stockValueAtRisk || 0).toFixed(2)}</h3>
            <p className="text-xs text-white/40 mt-1">Cost of low-stock & expired items</p>
          </div>
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 border border-gray-100 dark:border-dark-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Tracked Products</p>
            <h3 className="text-3xl font-black tracking-tighter text-gray-900 dark:text-white">{summary.totalProducts || 0}</h3>
          </div>
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 border border-gray-100 dark:border-dark-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Expiry Window</p>
          <div className="flex gap-2">
            {[7, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => { setExpiryWindow(d); fetchAlerts(d); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  expiryWindow === d ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or barcode..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-gray-900/10 focus:border-gray-200 outline-none font-medium"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                filter === f.id ? 'bg-gray-900 text-white shadow-sm' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {loading ? (
          <div className="flex justify-center p-16"><RefreshCw className="w-8 h-8 animate-spin text-gray-300" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
            <Boxes className="w-16 h-16 mb-4 opacity-40" />
            <p className="font-bold text-lg text-gray-700">All clear</p>
            <p className="text-sm text-gray-400">No alerts match the current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Barcode</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Alert</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">In Stock</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Alert Level</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((p, idx) => {
                  const badge = typeBadge(p._alertType);
                  const d = daysUntil(p.expiryDate);
                  return (
                    <tr key={`${p._id}-${p._alertType}-${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{p.name}</p>
                        {p.nameAr && <p className="text-xs text-gray-400">{p.nameAr}</p>}
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-sm">{p.primaryBarcode || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${badge.cls}`}>
                          <AlertTriangle className="w-3.5 h-3.5" /> {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">{p.stockQuantity ?? 0}</td>
                      <td className="px-6 py-4 text-right text-gray-500">{p.minimumStockAlertLevel ?? '—'}</td>
                      <td className="px-6 py-4 text-sm">
                        {p.expiryDate ? (
                          <span className={d <= 0 ? 'text-rose-600 font-bold' : 'text-gray-600 font-medium'}>
                            {new Date(p.expiryDate).toLocaleDateString()}
                            {d != null && <span className="text-gray-400"> ({d <= 0 ? 'expired' : `${d}d`})</span>}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Link
          to={`${catalogBase}/products`}
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
        >
          Manage products & stock <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
