import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, Save, Loader2, AlertCircle, CheckCircle, Printer } from 'lucide-react';
import api from '../../lib/api';
import { App3DIcon } from '../../components/ui/App3DIcon';

const CREDENTIAL_HINTS = {
  fedex: { accountNumber: 'FedEx account number', apiKey: 'API Key (Client ID)', apiSecret: 'Secret Key' },
  dhl: { accountNumber: 'DHL account number', apiKey: 'API site ID / username', apiSecret: 'API password' },
  ups: { accountNumber: 'UPS shipper number', apiKey: 'Client ID', apiSecret: 'Client secret' },
  tnt: { accountNumber: 'TNT account number', apiKey: 'TNT username', apiSecret: 'TNT password' },
};

const COURIERS = [
  { key: 'smsa', label: 'SMSA Express', desc: 'Saudi domestic and international express — AWB + COD', icon: 'smsa', appId: 'smsa_express' },
  { key: 'aramex', label: 'Aramex', desc: 'Regional and global logistics — express, freight, labels', icon: 'aramex', appId: 'aramex_shipping' },
  { key: 'jnt', label: 'J&T Express', desc: 'Last-mile waybills, pickup booking, and tracking', icon: 'jnt', appId: 'jnt_express' },
  { key: 'naqel', label: 'Naqel Express', desc: 'Saudi-based domestic and GCC shipping', icon: 'naqel', appId: 'naqel_express' },
  { key: 'imile', label: 'iMile', desc: 'Cross-border e-commerce delivery — MENA focus', icon: 'imile', appId: 'imile_courier' },
  { key: 'spl', label: 'Saudi Post (SPL)', desc: 'Nationwide SPL labels and barcode tracking', icon: 'spl', appId: 'spl_saudi_post' },
  { key: 'fedex', label: 'FedEx', desc: 'FedEx Express / International Priority — OAuth ship + tracking', icon: 'fedex', appId: 'fedex_shipping' },
  { key: 'dhl', label: 'DHL Express', desc: 'MyDHL API — 4×6 labels, checkpoints, worldwide express', icon: 'dhl', appId: 'dhl_express' },
  { key: 'ups', label: 'UPS', desc: 'UPS Shipments API — Saver/Expedited, labels, Quantum View', icon: 'ups', appId: 'ups_shipping' },
  { key: 'tnt', label: 'TNT Express', desc: 'TNT Express Connect — consignment booking and tracking', icon: 'tnt', appId: 'tnt_express' },
];

export default function EcommerceCouriers() {
  const [searchParams] = useSearchParams();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [labelResult, setLabelResult] = useState(null);
  const [expandedCourier, setExpandedCourier] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/ecommerce/settings');
      setConfig(res.data.ecommerce?.couriers || { flatRate: { enabled: true, price: 25, freeShippingThreshold: 0 } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load courier settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  useEffect(() => {
    const courier = searchParams.get('courier');
    if (courier && COURIERS.some((c) => c.key === courier)) setExpandedCourier(courier);
  }, [searchParams]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/ecommerce/couriers', config);
      setSuccess('Courier settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateCourier = (key, field, value) => {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  };

  const updateFlatRate = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      flatRate: { ...(prev.flatRate || {}), [field]: value },
    }));
  };

  const testLabel = async (key) => {
    setTesting(key);
    setError('');
    setLabelResult(null);
    try {
      const res = await api.post(`/ecommerce/couriers/${key}/test-label`);
      setLabelResult({ provider: key, ...res.data });
      setSuccess(`${COURIERS.find((c) => c.key === key)?.label || key} waybill ${res.data.trackingNumber}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create test label');
    } finally {
      setTesting('');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = "block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider";
  const enabledCount = COURIERS.filter((c) => config?.[c.key]?.enabled).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 p-6 md:p-8 text-white shadow-2xl">
        <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <Truck className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">Logistics hub</p>
              <h1 className="text-3xl font-black tracking-tight">Couriers & shipping labels</h1>
              <p className="text-sm text-white/60 mt-1">SMSA, Aramex, J&T, Naqel, iMile, SPL, FedEx, DHL, UPS, and TNT — AWB, COD, tracking.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-2 text-center ring-1 ring-white/15">
              <p className="text-[10px] uppercase tracking-widest text-white/50">Live carriers</p>
              <p className="text-xl font-black">{enabledCount}/{COURIERS.length}</p>
            </div>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-full font-bold hover:bg-emerald-400 disabled:opacity-50 text-sm shadow-lg shadow-emerald-500/30">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle className="w-4 h-4 flex-shrink-0" />{success}</div>}
      {labelResult?.trackingNumber && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
          <p className="font-bold">Waybill {labelResult.trackingNumber}</p>
          <p className="text-emerald-700/80 mt-1">{labelResult.sandbox ? 'Sandbox label — add live API keys for production print.' : 'Live shipment booked.'}</p>
        </div>
      )}

      <div className="bg-white dark:bg-dark-800 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white">Flat rate fallback</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config?.flatRate?.enabled ?? true} onChange={(e) => updateFlatRate('enabled', e.target.checked)} className="w-4 h-4 rounded" />
            Enabled
          </label>
        </div>
        {config?.flatRate?.enabled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Flat rate (SAR)</label>
              <input type="number" step="0.01" min="0" className={inputCls} value={config?.flatRate?.price || 0} onChange={(e) => updateFlatRate('price', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={labelCls}>Free shipping threshold (SAR)</label>
              <input type="number" step="0.01" min="0" className={inputCls} value={config?.flatRate?.freeShippingThreshold || 0} onChange={(e) => updateFlatRate('freeShippingThreshold', parseFloat(e.target.value) || 0)} placeholder="0 = no free shipping" />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {COURIERS.map((courier) => {
          const cConfig = config?.[courier.key] || {};
          const isExpanded = expandedCourier === courier.key;
          const isEnabled = cConfig.enabled;
          return (
            <div key={courier.key} className={`bg-white dark:bg-dark-800 rounded-3xl shadow-sm border overflow-hidden transition-all ${isEnabled ? 'border-emerald-200 dark:border-emerald-900/40' : 'border-slate-100 dark:border-dark-700'}`}>
              <div className="px-5 py-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedCourier(isExpanded ? null : courier.key)}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12">
                    <App3DIcon appId={courier.appId} icon={courier.icon} label={courier.label} className="w-12 h-12" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{courier.label}</p>
                    <p className="text-xs text-slate-400">{courier.desc}</p>
                  </div>
                </div>
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {isEnabled ? 'Connected' : 'Off'}
                </span>
              </div>
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-dark-700 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cConfig.enabled || false} onChange={(e) => updateCourier(courier.key, 'enabled', e.target.checked)} className="w-4 h-4 rounded" />
                    Enable {courier.label}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Environment</label>
                      <select className={inputCls} value={cConfig.environment || 'sandbox'} onChange={(e) => updateCourier(courier.key, 'environment', e.target.value)}>
                        <option value="sandbox">Sandbox / Test</option>
                        <option value="production">Production / Live</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{CREDENTIAL_HINTS[courier.key]?.accountNumber || 'Account number'}</label>
                      <input className={inputCls} value={cConfig.accountNumber || ''} onChange={(e) => updateCourier(courier.key, 'accountNumber', e.target.value)} placeholder="Account / customer number" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{CREDENTIAL_HINTS[courier.key]?.apiKey || 'API key'}</label>
                      <input className={inputCls} type="password" value={cConfig.apiKey || ''} onChange={(e) => updateCourier(courier.key, 'apiKey', e.target.value)} placeholder="••••••••" />
                    </div>
                    <div>
                      <label className={labelCls}>{CREDENTIAL_HINTS[courier.key]?.apiSecret || 'API secret'}</label>
                      <input className={inputCls} type="password" value={cConfig.apiSecret || ''} onChange={(e) => updateCourier(courier.key, 'apiSecret', e.target.value)} placeholder="••••••••" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => testLabel(courier.key)}
                    disabled={testing === courier.key}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                  >
                    {testing === courier.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    Create test AWB
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
