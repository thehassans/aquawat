import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Layers,
  Sparkles,
  ShieldCheck,
  Cpu,
  ArrowUpRight,
  CheckCircle2,
  Settings2,
  Search,
  Filter,
  DownloadCloud,
  Trash2,
  ExternalLink,
  Sliders,
  Check,
  Star,
  Info,
  Building,
  Zap,
  RefreshCw,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { App3DIcon } from '../../components/ui/App3DIcon';

export default function AppStore() {
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const { t } = useTranslation(language);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedAppForConfig, setSelectedAppForConfig] = useState(null);
  const [configFormState, setConfigFormState] = useState({});

  // Fetch all apps & tenant installation status
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((res) => res.data),
  });

  const apps = data?.apps || [];

  // Mutations
  const installMutation = useMutation({
    mutationFn: (appId) => api.post(`/app-store/apps/${appId}/install`),
    onSuccess: (res, appId) => {
      toast.success(language === 'ar' ? 'تم تثبيت وتفعيل التطبيق بنجاح' : 'App installed and activated successfully');
      queryClient.invalidateQueries(['app-store-apps']);
      queryClient.invalidateQueries(['tenant-settings']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Installation failed')
  });

  const uninstallMutation = useMutation({
    mutationFn: (appId) => api.post(`/app-store/apps/${appId}/uninstall`),
    onSuccess: (res, appId) => {
      toast.success(language === 'ar' ? 'تم إلغاء تثبيت التطبيق' : 'App uninstalled');
      queryClient.invalidateQueries(['app-store-apps']);
      queryClient.invalidateQueries(['tenant-settings']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Uninstall failed')
  });

  const toggleMutation = useMutation({
    mutationFn: ({ appId, isEnabled }) => api.post(`/app-store/apps/${appId}/toggle`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries(['app-store-apps']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Toggle failed')
  });

  const saveSettingsMutation = useMutation({
    mutationFn: ({ appId, config }) => api.put(`/app-store/apps/${appId}/settings`, { config }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حفظ إعدادات التطبيق' : 'App settings saved');
      setSelectedAppForConfig(null);
      queryClient.invalidateQueries(['app-store-apps']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save settings')
  });

  const categories = [
    { id: 'all', labelEn: 'All Apps & Add-ons', labelAr: 'جميع التطبيقات والإضافات' },
    { id: 'manufacturing', labelEn: 'Manufacturing & Industrial', labelAr: 'التصنيع والإنتاج الصناعي' },
    { id: 'saudi_compliance', labelEn: 'Saudi Compliance & ZATCA', labelAr: 'التكاملات والأنظمة السعودية' },
    { id: 'hardware_iot', labelEn: 'Hardware & IoT Drivers', labelAr: 'تعريف الأجهزة والعتاد' },
    { id: 'automation_comm', labelEn: 'Automation & Communication', labelAr: 'الأتمتة وقنوات التواصل' },
    { id: 'ai_intelligence', labelEn: 'AI & Machine Intelligence', labelAr: 'الذكاء الاصطناعي والتحليلات' },
    { id: 'ecommerce_payments', labelEn: 'E-Commerce & Payments', labelAr: 'المتاجر الإلكترونية والمدفوعات' },
  ];

  const appTypes = [
    { id: 'all', labelEn: 'All Types', labelAr: 'جميع الأنواع' },
    { id: 'core_vertical', labelEn: 'Enterprise Verticals', labelAr: 'أنظمة أعمال رئيسية' },
    { id: 'hardware_integration', labelEn: 'Hardware Driver', labelAr: 'تعريف أجهزة POS/IoT' },
    { id: 'saudi_compliance', labelEn: 'Gov Portal Sync', labelAr: 'بوابات حكومية معتمدة' },
    { id: 'automation_comm', labelEn: 'Cloud Automation', labelAr: 'أتمتة سحابية' },
    { id: 'ai_tool', labelEn: 'AI Copilot', labelAr: 'أدوات الذكاء الاصطناعي' },
  ];

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchSearch =
        search === '' ||
        app.nameEn.toLowerCase().includes(search.toLowerCase()) ||
        app.nameAr.includes(search) ||
        app.taglineEn.toLowerCase().includes(search.toLowerCase()) ||
        app.taglineAr.includes(search);

      const matchCategory = selectedCategory === 'all' || app.category === selectedCategory;
      const matchType = selectedType === 'all' || app.appType === selectedType;

      return matchSearch && matchCategory && matchType;
    });
  }, [apps, search, selectedCategory, selectedType]);

  const openConfigDrawer = (app) => {
    setSelectedAppForConfig(app);
    setConfigFormState(app.config || {});
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-8 sm:p-10 text-white shadow-2xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30 backdrop-blur-md shadow-inner">
              <App3DIcon path="/app/dashboard/app-store" label="App Store" className="w-14 h-14" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {language === 'ar' ? 'متجر التطبيقات والإضافات' : 'Maqder App Store & Add-ons'}
                </h1>
                <span className="px-3 py-1 text-xs font-bold bg-indigo-500/30 text-indigo-200 rounded-full border border-indigo-400/30">
                  {language === 'ar' ? 'إصدار المنشآت 2026' : 'Enterprise Hub 2026'}
                </span>
              </div>
              <p className="text-slate-300 text-sm sm:text-base mt-1 max-w-2xl font-light">
                {language === 'ar'
                  ? 'وسع قدرات منشأتك بضغطة واحدة: أنظمة التصنيع المتقدمة، الفوترة الإلكترونية، أجهزة الكاشير، وأتمتة الواتساب والذكاء الاصطناعي.'
                  : 'Supercharge your business in one click: advanced manufacturing, ZATCA Phase 2, POS hardware drivers, and AI automation.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-900/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shadow-lg">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-indigo-400">{apps.length || 9}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {language === 'ar' ? 'التطبيقات المتاحة' : 'Available Apps'}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-extrabold text-emerald-400">
                {apps.filter((a) => a.isInstalled).length || 8}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {language === 'ar' ? 'المثبتة والنشطة' : 'Installed'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Search & Category Filters ─── */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'ar' ? 'ابحث في التطبيقات والإضافات...' : 'Search apps, drivers, integrations...'}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-2xl text-sm focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </div>

          {/* App Type Filter Badges */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
            {appTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedType === type.id
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {language === 'ar' ? type.labelAr : type.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-dark-700">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800'
              }`}
            >
              {language === 'ar' ? cat.labelAr : cat.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Apps Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredApps.map((app) => (
          <motion.div
            key={app.appId}
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative flex flex-col justify-between rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 p-6 shadow-md hover:shadow-2xl transition-all duration-300 hover:border-primary-500/40"
          >
            {/* Top Bar: Icon + Badge + Switch */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-dark-700 dark:to-dark-900 rounded-2xl shadow-inner border border-gray-200/50 dark:border-dark-600">
                    <App3DIcon path={app.defaultRoute || `/app/dashboard/${app.appId}`} label={app.nameEn} className="w-12 h-12" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {app.badge || 'Verified'}
                      </span>
                      <span className="text-xs font-medium text-amber-500 flex items-center gap-0.5">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {app.rating}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base mt-1 group-hover:text-primary-600 transition-colors line-clamp-1">
                      {language === 'ar' ? app.nameAr : app.nameEn}
                    </h3>
                  </div>
                </div>

                {/* Enabled Toggle Switch (if installed) */}
                {app.isInstalled && (
                  <button
                    onClick={() => toggleMutation.mutate({ appId: app.appId, isEnabled: !app.isEnabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      app.isEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-dark-600'
                    }`}
                    title={app.isEnabled ? 'Active' : 'Disabled'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        app.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Tagline */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 line-clamp-2 leading-relaxed">
                {language === 'ar' ? app.taglineAr : app.taglineEn}
              </p>

              {/* Features Pill List */}
              <div className="mt-4 space-y-1.5">
                {(language === 'ar' ? app.featuresAr : app.featuresEn)?.slice(0, 3).map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-dark-700/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {app.isInstalled ? (
                  <>
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      {language === 'ar' ? 'مثبت' : 'Installed'}
                    </span>
                    {app.configSchema?.length > 0 && (
                      <button
                        onClick={() => openConfigDrawer(app)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                        title={language === 'ar' ? 'إعدادات التطبيق' : 'Configure Settings'}
                      >
                        <Sliders className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">v{app.version}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {app.isInstalled ? (
                  <>
                    {app.defaultRoute && (
                      <button
                        onClick={() => navigate(app.defaultRoute)}
                        className="flex items-center gap-1 px-3.5 py-1.5 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/60 rounded-xl text-xs font-bold transition-all"
                      >
                        {language === 'ar' ? 'فتح' : 'Open'}
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => installMutation.mutate(app.appId)}
                    disabled={installMutation.isLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:from-primary-700 hover:to-indigo-700 rounded-xl text-xs font-bold shadow-md shadow-primary-500/20 transition-all active:scale-95"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'تثبيت وتفعيل' : 'Install App'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── App Configuration Drawer / Modal ─── */}
      <AnimatePresence>
        {selectedAppForConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl rounded-3xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 p-6 shadow-2xl overflow-hidden"
            >
              <div className="flex items-start justify-between pb-4 border-b border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 dark:bg-primary-950/50 rounded-xl">
                    <Sliders className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                      {language === 'ar' ? `إعدادات ${selectedAppForConfig.nameAr}` : `${selectedAppForConfig.nameEn} Settings`}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {language === 'ar' ? 'تخصيص المعاملات والخيارات التشغيلية للتطبيق' : 'Configure operational parameters and automated switches'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAppForConfig(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dynamic Config Fields Form */}
              <div className="py-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {selectedAppForConfig.configSchema?.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      {language === 'ar' ? field.labelAr : field.labelEn}
                    </label>

                    {field.type === 'boolean' && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50 border border-gray-200 dark:border-dark-700">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {configFormState[field.key] !== false ? (language === 'ar' ? 'مفعل' : 'Enabled') : (language === 'ar' ? 'معطل' : 'Disabled')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfigFormState((prev) => ({ ...prev, [field.key]: prev[field.key] === false ? true : false }))}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            configFormState[field.key] !== false ? 'bg-primary-600' : 'bg-gray-300 dark:bg-dark-600'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition ${
                              configFormState[field.key] !== false ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    )}

                    {field.type === 'select' && (
                      <select
                        value={configFormState[field.key] || field.defaultValue || ''}
                        onChange={(e) => setConfigFormState((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {language === 'ar' ? opt.labelAr : opt.labelEn}
                          </option>
                        ))}
                      </select>
                    )}

                    {(field.type === 'text' || field.type === 'number' || field.type === 'password') && (
                      <input
                        type={field.type}
                        value={configFormState[field.key] ?? field.defaultValue ?? ''}
                        onChange={(e) => setConfigFormState((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Drawer Footer */}
              <div className="pt-4 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(language === 'ar' ? 'هل أنت متأكد من إلغاء تثبيت هذا التطبيق؟' : 'Are you sure you want to uninstall this app?')) {
                      uninstallMutation.mutate(selectedAppForConfig.appId);
                      setSelectedAppForConfig(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {language === 'ar' ? 'إلغاء التثبيت' : 'Uninstall'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAppForConfig(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-colors"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveSettingsMutation.mutate({ appId: selectedAppForConfig.appId, config: configFormState })}
                    disabled={saveSettingsMutation.isLoading}
                    className="px-5 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-md transition-all active:scale-95"
                  >
                    {language === 'ar' ? 'حفظ التغييرات' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
