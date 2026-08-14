import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Save, Loader2, AlertCircle, CheckCircle, Copy, ChevronDown, Wallet, Globe, Shield, Zap } from 'lucide-react';
import api from '../../lib/api';

const PROVIDERS = [
  {
    key: 'moyasar',
    label: 'Moyasar',
    tagline: 'Saudi-based gateway',
    desc: 'One integration for all Saudi payment methods',
    brand: '#5B2DD3',
    brandLight: '#F0EBFF',
    methods: ['mada', 'Visa', 'Mastercard', 'Apple Pay', 'STC Pay'],
    region: 'Saudi Arabia',
  },
  {
    key: 'tap',
    label: 'Tap Payments',
    tagline: 'Regional gateway',
    desc: 'Kuwait & GCC-focused payment processing',
    brand: '#FFB800',
    brandLight: '#FFF8E6',
    methods: ['KNET', 'mada', 'Visa', 'Mastercard'],
    region: 'GCC / Kuwait',
  },
  {
    key: 'paytabs',
    label: 'PayTabs',
    tagline: 'Multi-currency gateway',
    desc: 'Accept payments across multiple currencies',
    brand: '#0EA5E9',
    brandLight: '#E8F7FE',
    methods: ['Cards', 'Apple Pay', 'STC Pay', 'Mada'],
    region: 'Middle East',
  },
  {
    key: 'stripe',
    label: 'Stripe',
    tagline: 'Global gateway',
    desc: 'Worldwide payment processing with 135+ currencies',
    brand: '#635BFF',
    brandLight: '#EEECFF',
    methods: ['Cards', 'Apple Pay', 'Google Pay'],
    region: 'Global',
  },
  {
    key: 'tabby',
    label: 'Tabby',
    tagline: 'Pay in 4',
    desc: 'Customer splits the bill — Tabby pays you',
    brand: '#0F766E',
    brandLight: '#CCFBF1',
    methods: ['Pay in 4', 'Pay later'],
    region: 'Saudi / UAE',
    publicKeyLabel: 'Public key',
    secretKeyLabel: 'Secret key',
    merchantLabel: 'Merchant code *',
    webhookLabel: 'Webhook uses secret key',
  },
  {
    key: 'tamara',
    label: 'Tamara',
    tagline: 'Pay later',
    desc: 'Installments at checkout — Tamara pays you',
    brand: '#E11D48',
    brandLight: '#FFE4E6',
    methods: ['Pay in 3', 'Pay later'],
    region: 'Saudi / UAE',
    publicKeyLabel: 'Not required',
    secretKeyLabel: 'API token',
    merchantLabel: 'Merchant ID (optional)',
    webhookLabel: 'Notification token',
  },
];

function Toggle({ checked, onChange, brandColor = '#6366F1' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-300 ${checked ? '' : 'bg-gray-200 dark:bg-dark-600'}`}
      style={checked ? { backgroundColor: brandColor } : {}}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function MethodPill({ label, brand }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${brand}14`, color: brand }}
    >
      {label}
    </span>
  );
}

export default function EcommercePayments() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedProvider, setExpandedProvider] = useState(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.get('/ecommerce/settings');
      setConfig(res.data.ecommerce?.payments || { defaultProvider: '', codEnabled: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/ecommerce/payments', config);
      setSuccess('Payment settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateProvider = (key, field, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [field]: value },
    }));
  };

  const copyWebhookUrl = (provider) => {
    const url = `${window.location.origin}/api/ecommerce/fulfillment/webhook/${provider}`;
    navigator.clipboard.writeText(url);
    setSuccess(`Webhook URL copied`);
    setTimeout(() => setSuccess(''), 3000);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
      <p className="text-sm text-gray-400">Loading payment settings…</p>
    </div>
  );

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all";
  const labelCls = "block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wider";

  const enabledCount = PROVIDERS.filter(p => config?.[p.key]?.enabled).length;
  const activeProvider = PROVIDERS.find(p => p.key === config?.defaultProvider);

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Payment Gateways</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {enabledCount > 0
              ? `${enabledCount} provider${enabledCount > 1 ? 's' : ''} active${activeProvider ? ` · Default: ${activeProvider.label}` : ''}`
              : 'No providers configured yet'}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-full font-semibold hover:opacity-80 disabled:opacity-40 text-sm transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2.5 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-xl px-4 py-3 border border-red-100 dark:border-red-900/50">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-xl px-4 py-3 border border-emerald-100 dark:border-emerald-900/50">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{success}
        </div>
      )}

      {/* Default provider + COD */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Checkout Settings</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Default Provider</label>
            <select
              className={inputCls}
              value={config?.defaultProvider || ''}
              onChange={e => setConfig(prev => ({ ...prev, defaultProvider: e.target.value }))}
            >
              <option value="">None</option>
              <option value="cod">Cash on Delivery</option>
              {PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between sm:flex-col sm:items-start sm:justify-end gap-2">
            <div>
              <label className={labelCls}>Cash on Delivery</label>
              <p className="text-sm text-gray-600 dark:text-gray-400">Allow customers to pay with cash</p>
            </div>
            <div className="sm:self-end">
              <Toggle
                checked={config?.codEnabled ?? true}
                onChange={() => setConfig(prev => ({ ...prev, codEnabled: !(prev?.codEnabled ?? true) }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map(provider => {
          const pConfig = config?.[provider.key] || {};
          const isExpanded = expandedProvider === provider.key;
          const isEnabled = pConfig.enabled;
          return (
            <div
              key={provider.key}
              className={`bg-white dark:bg-dark-800 rounded-2xl border transition-all duration-300 overflow-hidden ${
                isEnabled
                  ? 'border-transparent shadow-[0_0_0_1.5px_var(--brand-color),0_2px_8px_rgba(0,0,0,0.04)]'
                  : 'border-gray-100 dark:border-dark-700'
              }`}
              style={isEnabled ? { '--brand-color': provider.brand } : {}}
            >
              {/* Card header */}
              <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors"
                onClick={() => setExpandedProvider(isExpanded ? null : provider.key)}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Brand icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                    style={{
                      backgroundColor: isEnabled ? provider.brand : provider.brandLight,
                      color: isEnabled ? '#fff' : provider.brand,
                    }}
                  >
                    {provider.label.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{provider.label}</p>
                      <span className="text-[10px] font-medium text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                        <Globe className="w-3 h-3" />{provider.region}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{provider.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Toggle
                    checked={!!isEnabled}
                    onChange={() => updateProvider(provider.key, 'enabled', !isEnabled)}
                    brandColor={provider.brand}
                  />
                  <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Payment methods row */}
              <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                {provider.methods.map(m => (
                  <MethodPill key={m} label={m} brand={provider.brand} />
                ))}
              </div>

              {/* Expanded config */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-3 border-t border-gray-50 dark:border-dark-700 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Environment</label>
                      <select
                        className={inputCls}
                        value={pConfig.environment === 'production' || pConfig.environment === 'live' ? 'live' : 'test'}
                        onChange={e => updateProvider(provider.key, 'environment', e.target.value)}
                      >
                        <option value="test">Sandbox / Test</option>
                        <option value="live">Production / Live</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>
                        {provider.merchantLabel || (provider.key === 'paytabs' ? 'Merchant ID *' : 'Merchant ID (optional)')}
                      </label>
                      <input
                        className={inputCls}
                        value={pConfig.merchantId || ''}
                        onChange={e => updateProvider(provider.key, 'merchantId', e.target.value)}
                        placeholder="Merchant / Profile ID"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {provider.key !== 'tamara' && (
                    <div>
                      <label className={labelCls}>{provider.publicKeyLabel || 'Publishable Key'}</label>
                      <input
                        className={inputCls}
                        value={pConfig.publishableKey || ''}
                        onChange={e => updateProvider(provider.key, 'publishableKey', e.target.value)}
                        placeholder="pk_••••••••"
                      />
                    </div>
                    )}
                    <div>
                      <label className={labelCls}>{provider.secretKeyLabel || 'Secret Key'}</label>
                      <input
                        className={inputCls}
                        type="password"
                        value={pConfig.secretKey || ''}
                        onChange={e => updateProvider(provider.key, 'secretKey', e.target.value)}
                        placeholder="sk_••••••••"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{provider.webhookLabel || 'Webhook Secret'}</label>
                    <input
                      className={inputCls}
                      type="password"
                      value={pConfig.webhookSecret || ''}
                      onChange={e => updateProvider(provider.key, 'webhookSecret', e.target.value)}
                      placeholder="whsec_••••••••"
                    />
                  </div>
                  {/* Webhook URL */}
                  <div className="flex items-center gap-2 pt-1 bg-gray-50 dark:bg-dark-900 rounded-xl px-3 py-2.5">
                    <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-[11px] text-gray-400 font-medium">Webhook</span>
                    <code className="text-[11px] text-gray-600 dark:text-gray-300 truncate flex-1">
                      {window.location.origin}/api/ecommerce/fulfillment/webhook/{provider.key}
                    </code>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyWebhookUrl(provider.key); }}
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="flex items-start gap-2.5 px-1 pt-2">
        <Zap className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Tip: Moyasar gives you Apple Pay, STC Pay, mada, and cards in one integration — no separate setup needed.
        </p>
      </div>
    </div>
  );
}
