import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Check,
  Star,
  X,
  ExternalLink,
  ChevronRight,
  Download,
  Trash2,
  Sliders,
  LayoutGrid,
  Layers,
  Cpu,
  Shield,
  Zap,
  Brain,
  Box,
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { updateTenant } from '../../store/slices/authSlice';

const PRICING_LABELS = {
  free: { en: 'Free', ar: 'مجاني', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
  paid: { en: 'Premium', ar: 'مدفوع', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
  enterprise: { en: 'Enterprise', ar: 'مؤسسات', color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20' },
};

const CATEGORIES = [
  { id: 'all', icon: LayoutGrid, en: 'All', ar: 'الكل' },
  { id: 'core_vertical', icon: Layers, en: 'Core', ar: 'أساسي' },
  { id: 'hardware_iot', icon: Cpu, en: 'Hardware', ar: 'أجهزة' },
  { id: 'hr_manpower', icon: Box, en: 'Operations', ar: 'عمليات' },
  { id: 'finance_accounting', icon: Shield, en: 'Finance', ar: 'مالية' },
  { id: 'pos_retail', icon: Zap, en: 'Retail', ar: 'تجزئة' },
  { id: 'automation_comm', icon: Brain, en: 'Automation', ar: 'أتمتة' },
];

export default function AppStore() {
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const { t } = useTranslation(language);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAr = language === 'ar';

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showInstalled, setShowInstalled] = useState(false);
  const [detailApp, setDetailApp] = useState(null);
  const [configApp, setConfigApp] = useState(null);
  const [configForm, setConfigForm] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((r) => r.data),
  });

  const apps = data?.apps || [];

  const refreshTenant = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.tenant) dispatch(updateTenant(res.data.tenant));
    } catch {}
  };

  const installMutation = useMutation({
    mutationFn: (appId) => api.post(`/app-store/apps/${appId}/install`),
    onSuccess: () => {
      toast.success(isAr ? 'تم تثبيت التطبيق بنجاح' : 'App installed successfully');
      queryClient.invalidateQueries(['app-store-apps']);
      refreshTenant();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Installation failed'),
  });

  const uninstallMutation = useMutation({
    mutationFn: (appId) => api.post(`/app-store/apps/${appId}/uninstall`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إلغاء تثبيت التطبيق' : 'App uninstalled');
      queryClient.invalidateQueries(['app-store-apps']);
      setDetailApp(null);
      refreshTenant();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Uninstall failed'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ appId, isEnabled }) => api.post(`/app-store/apps/${appId}/toggle`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries(['app-store-apps']);
      refreshTenant();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Toggle failed'),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: ({ appId, config }) => api.put(`/app-store/apps/${appId}/settings`, { config }),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ الإعدادات' : 'Settings saved');
      setConfigApp(null);
      queryClient.invalidateQueries(['app-store-apps']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save'),
  });

  const filtered = useMemo(() => {
    return apps.filter((app) => {
      const q = search.toLowerCase();
      const matchSearch = !q || app.nameEn?.toLowerCase().includes(q) || app.nameAr?.includes(search) || app.taglineEn?.toLowerCase().includes(q);
      const matchCat = activeCategory === 'all' || app.category === activeCategory || app.appType === activeCategory;
      const matchInstalled = !showInstalled || app.isInstalled;
      return matchSearch && matchCat && matchInstalled;
    });
  }, [apps, search, activeCategory, showInstalled]);

  const installedCount = apps.filter((a) => a.isInstalled).length;

  const pricing = (tier) => PRICING_LABELS[tier] || PRICING_LABELS.free;

  // ─── Render ───
  return (
    <div className="min-h-screen pb-20">
      {/* ─── Clean Header ─── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          {isAr ? 'متجر التطبيقات' : 'App Store'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
          {isAr ? 'ثبّت التطبيقات لتفعيل ميزات إضافية في نظامك' : 'Install apps to unlock additional features in your system'}
        </p>
      </div>

      {/* ─── Search + Filters ─── */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث عن تطبيق...' : 'Search apps...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all"
          />
        </div>
        <button
          onClick={() => setShowInstalled(!showInstalled)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
            showInstalled
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-dark-600 hover:border-gray-300'
          }`}
        >
          <Check className="w-4 h-4" />
          {isAr ? `مثبتة (${installedCount})` : `Installed (${installedCount})`}
        </button>
      </div>

      {/* ─── Category Pills ─── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-600 hover:border-gray-300 dark:hover:border-dark-500'
            }`}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {isAr ? cat.ar : cat.en}
          </button>
        ))}
      </div>

      {/* ─── Apps Grid ─── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-100 dark:bg-dark-700 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="w-10 h-10 text-gray-300 dark:text-dark-500 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">{isAr ? 'لا توجد تطبيقات مطابقة' : 'No apps match your search'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((app) => (
            <motion.div
              key={app.appId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 p-5 hover:shadow-lg hover:border-gray-200 dark:hover:border-dark-600 transition-all duration-200 cursor-pointer"
              onClick={() => setDetailApp(app)}
            >
              {/* Top Row: Icon + Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-2xl border border-gray-100 dark:border-dark-600">
                  {app.icon === 'factory' ? '🏭' : app.icon === 'truck' ? '🚛' : app.icon === 'anchor' ? '⚓' : app.icon === 'cpu' ? '📡' : app.icon === 'target' ? '🎯' : app.icon === 'users' ? '👥' : app.icon === 'bike' ? '🛵' : app.icon === 'credit-card' ? '💳' : app.icon === 'shield' ? '🛡️' : app.icon === 'printer' ? '🖨️' : app.icon === 'scale' ? '⚖️' : app.icon === 'message-circle' ? '💬' : app.icon === 'brain' ? '🧠' : app.icon === 'file-check' ? '📋' : app.icon === 'ship' ? '🚢' : '📦'}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pricing(app.pricingTier).color}`}>
                  {isAr ? pricing(app.pricingTier).ar : pricing(app.pricingTier).en}
                </span>
              </div>

              {/* Name */}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                {isAr ? app.nameAr : app.nameEn}
              </h3>

              {/* Tagline */}
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                {isAr ? app.taglineAr : app.taglineEn}
              </p>

              {/* Bottom Row */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-dark-700">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{app.rating?.toFixed(1)}</span>
                </div>

                {app.isInstalled ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="w-3 h-3" /> {isAr ? 'مثبت' : 'Installed'}
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); installMutation.mutate(app.appId); }}
                    disabled={installMutation.isPending}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
                  >
                    {isAr ? 'تثبيت' : 'Install'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ─── App Detail Sheet ─── */}
      <AnimatePresence>
        {detailApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setDetailApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 bottom-4 top-16 sm:inset-x-auto sm:right-6 sm:top-6 sm:bottom-6 sm:w-[440px] bg-white dark:bg-dark-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col border border-gray-100 dark:border-dark-700"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-600 flex items-center justify-center text-3xl border border-gray-100 dark:border-dark-600 shrink-0">
                    {detailApp.icon === 'factory' ? '🏭' : detailApp.icon === 'truck' ? '🚛' : detailApp.icon === 'anchor' ? '⚓' : detailApp.icon === 'cpu' ? '📡' : detailApp.icon === 'target' ? '🎯' : detailApp.icon === 'users' ? '👥' : detailApp.icon === 'bike' ? '🛵' : detailApp.icon === 'credit-card' ? '💳' : detailApp.icon === 'shield' ? '🛡️' : detailApp.icon === 'printer' ? '🖨️' : detailApp.icon === 'scale' ? '⚖️' : detailApp.icon === 'message-circle' ? '💬' : detailApp.icon === 'brain' ? '🧠' : detailApp.icon === 'file-check' ? '📋' : '📦'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                      {isAr ? detailApp.nameAr : detailApp.nameEn}
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">{detailApp.author || 'Maqder'} · v{detailApp.version}</p>
                  </div>
                </div>
                <button onClick={() => setDetailApp(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Meta */}
              <div className="px-6 pb-4 flex items-center gap-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pricing(detailApp.pricingTier).color}`}>
                  {isAr ? pricing(detailApp.pricingTier).ar : pricing(detailApp.pricingTier).en}
                </span>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{detailApp.rating?.toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({detailApp.reviewsCount})</span>
                </div>
                {detailApp.badge && (
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded-full">{detailApp.badge}</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar">
                {/* Description */}
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {isAr ? detailApp.descriptionAr : detailApp.descriptionEn}
                  </p>
                </div>

                {/* Features */}
                {(isAr ? detailApp.featuresAr : detailApp.featuresEn)?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                      {isAr ? 'المميزات' : 'Features'}
                    </h4>
                    <ul className="space-y-2">
                      {(isAr ? detailApp.featuresAr : detailApp.featuresEn).map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-6 pt-4 border-t border-gray-100 dark:border-dark-700 space-y-3">
                {detailApp.isInstalled ? (
                  <>
                    <div className="flex gap-2">
                      {detailApp.defaultRoute && (
                        <button
                          onClick={() => { setDetailApp(null); navigate(detailApp.defaultRoute); }}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                          <ExternalLink className="w-4 h-4" /> {isAr ? 'فتح' : 'Open'}
                        </button>
                      )}
                      {detailApp.configSchema?.length > 0 && (
                        <button
                          onClick={() => { setConfigApp(detailApp); setConfigForm(detailApp.config || {}); }}
                          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => uninstallMutation.mutate(detailApp.appId)}
                      disabled={uninstallMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {isAr ? 'إلغاء التثبيت' : 'Uninstall'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { installMutation.mutate(detailApp.appId); setDetailApp(null); }}
                    disabled={installMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {installMutation.isPending ? (isAr ? 'جاري التثبيت...' : 'Installing...') : (isAr ? 'تثبيت التطبيق' : 'Install App')}
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Config Sheet ─── */}
      <AnimatePresence>
        {configApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
              onClick={() => setConfigApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-white dark:bg-dark-800 shadow-2xl z-[60] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {isAr ? 'إعدادات التطبيق' : 'App Settings'}
                </h3>
                <button onClick={() => setConfigApp(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {configApp.configSchema?.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {isAr ? field.labelAr : field.labelEn}
                    </label>
                    {field.type === 'boolean' ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!configForm[field.key]}
                          onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                      </label>
                    ) : field.type === 'select' ? (
                      <select
                        value={configForm[field.key] || field.defaultValue || ''}
                        onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.value }))}
                        className="select w-full text-sm"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>{isAr ? opt.labelAr : opt.labelEn}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                        value={configForm[field.key] || ''}
                        onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.value }))}
                        className="input w-full text-sm"
                      />
                    )}
                  </div>
                ))}

                <button
                  onClick={() => saveSettingsMutation.mutate({ appId: configApp.appId, config: configForm })}
                  disabled={saveSettingsMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saveSettingsMutation.isPending ? '...' : (isAr ? 'حفظ الإعدادات' : 'Save Settings')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
