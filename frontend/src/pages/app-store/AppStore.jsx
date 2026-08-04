import React, { useState, useMemo, useEffect } from 'react';
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
  Download,
  Trash2,
  Sliders,
  LayoutGrid,
  Cpu,
  Shield,
  Zap,
  Sparkles,
  Users,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Factory
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { updateTenant } from '../../store/slices/authSlice';

const PRICING_LABELS = {
  free: { en: 'Free', ar: 'مجاني', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40' },
  paid: { en: 'Paid', ar: 'مدفوع', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40' },
  enterprise: { en: 'Enterprise', ar: 'مؤسسات', color: 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/40' },
};

const CATEGORIES = [
  { id: 'all', icon: LayoutGrid, en: 'All Apps', ar: 'جميع التطبيقات' },
  { id: 'hr_manpower', icon: Users, en: 'HR & Workforce', ar: 'الموارد البشرية والرواتب' },
  { id: 'manufacturing', icon: Factory, en: 'Manufacturing & MES', ar: 'التصنيع والإنتاج' },
  { id: 'finance_accounting', icon: Shield, en: 'Finance & Costs', ar: 'المالية والتكاليف' },
  { id: 'hardware_iot', icon: Cpu, en: 'Hardware & IoT', ar: 'الأجهزة وإنترنت الأشياء' },
  { id: 'pos_retail', icon: Zap, en: 'Retail & POS', ar: 'نقاط البيع والمطاعم' },
  { id: 'saudi_compliance', icon: CheckCircle2, en: 'Saudi Gov & ZATCA', ar: 'الامتثال وزاتكا' },
  { id: 'automation_comm', icon: Sparkles, en: 'Automation & AI', ar: 'الأتمتة والذكاء الاصطناعي' },
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
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [detailApp, setDetailApp] = useState(null);
  const [configApp, setConfigApp] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [uninstallConfirmApp, setUninstallConfirmApp] = useState(null);

  // Animated Installation State: { appId, name, size, progress, stage }
  const [installingState, setInstallingState] = useState(null);

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
    onSuccess: (data, appId) => {
      queryClient.invalidateQueries(['app-store-apps']);
      refreshTenant();
    },
    onError: (err) => {
      setInstallingState(null);
      toast.error(err.response?.data?.error || (isAr ? 'فشل التثبيت' : 'Installation failed'));
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (appId) => api.post(`/app-store/apps/${appId}/uninstall`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إلغاء تثبيت التطبيق بنجاح' : 'App uninstalled successfully');
      queryClient.invalidateQueries(['app-store-apps']);
      setUninstallConfirmApp(null);
      setDetailApp(null);
      refreshTenant();
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل إلغاء التثبيت' : 'Uninstall failed')),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: ({ appId, config }) => api.put(`/app-store/apps/${appId}/settings`, { config }),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ الإعدادات' : 'Settings saved');
      setConfigApp(null);
      queryClient.invalidateQueries(['app-store-apps']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save settings'),
  });

  // Handle interactive animated installation
  const handleStartInstall = (app) => {
    if (installingState) return;

    setInstallingState({
      appId: app.appId,
      name: isAr ? app.nameAr : app.nameEn,
      size: app.downloadSize || '3.5 MB',
      progress: 5,
      stage: isAr ? 'جاري بدء التحميل...' : 'Initiating download...'
    });

    // Start API mutation in background
    installMutation.mutate(app.appId);
  };

  // Installation progress simulation ticker
  useEffect(() => {
    if (!installingState) return;

    const interval = setInterval(() => {
      setInstallingState((prev) => {
        if (!prev) return null;
        const currentProgress = prev.progress;

        if (currentProgress < 35) {
          return {
            ...prev,
            progress: currentProgress + 12,
            stage: isAr ? `جاري تحميل الحزمة (${prev.size})...` : `Downloading package (${prev.size})...`
          };
        } else if (currentProgress < 75) {
          return {
            ...prev,
            progress: currentProgress + 15,
            stage: isAr ? 'التحقق من التوقيع الرقمي واستخراج الملفات...' : 'Verifying cryptographic signature & extracting...'
          };
        } else if (currentProgress < 95) {
          return {
            ...prev,
            progress: currentProgress + 10,
            stage: isAr ? 'تهيئة الصلاحيات ومسارات القائمة...' : 'Configuring permissions & routes...'
          };
        } else if (currentProgress >= 95 && currentProgress < 100) {
          return {
            ...prev,
            progress: 100,
            stage: isAr ? 'تم التثبيت بنجاح!' : 'Installed successfully!'
          };
        } else {
          // Completed
          clearInterval(interval);
          setTimeout(() => {
            setInstallingState(null);
            toast.success(isAr ? `تم تثبيت ${prev.name} بنجاح` : `${prev.name} installed successfully`);
          }, 600);
          return prev;
        }
      });
    }, 280);

    return () => clearInterval(interval);
  }, [installingState?.appId, isAr]);

  // Robust filtering: matches search query across all name, tags, description and category
  const filtered = useMemo(() => {
    return apps.filter((app) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        app.nameEn?.toLowerCase().includes(q) ||
        app.nameAr?.toLowerCase().includes(q) ||
        app.taglineEn?.toLowerCase().includes(q) ||
        app.taglineAr?.toLowerCase().includes(q) ||
        app.descriptionEn?.toLowerCase().includes(q) ||
        app.descriptionAr?.toLowerCase().includes(q) ||
        app.appId?.toLowerCase().includes(q) ||
        (app.featuresEn || []).some((f) => f.toLowerCase().includes(q)) ||
        (app.featuresAr || []).some((f) => f.toLowerCase().includes(q));

      let matchCat = activeCategory === 'all';
      if (activeCategory === 'hr_manpower') {
        matchCat = app.category === 'hr_manpower' || app.appId.includes('hr') || app.appId.includes('fleet') || app.appId.includes('crm') || app.appId.includes('gosi');
      } else if (activeCategory === 'manufacturing') {
        matchCat = app.category === 'manufacturing' || app.appId.includes('manufacturing');
      } else if (activeCategory === 'finance_accounting') {
        matchCat = app.category === 'finance_accounting' || app.appId.includes('landed') || app.appId.includes('vat');
      } else if (activeCategory === 'hardware_iot') {
        matchCat = app.category === 'hardware_iot' || app.appType === 'hardware_integration' || app.appId.includes('iot') || app.appId.includes('terminal') || app.appId.includes('printer') || app.appId.includes('scale');
      } else if (activeCategory === 'pos_retail') {
        matchCat = app.category === 'pos_retail' || app.appId.includes('delivery') || app.appId.includes('retail');
      } else if (activeCategory === 'saudi_compliance') {
        matchCat = app.category === 'saudi_compliance' || app.appId.includes('zatca') || app.appId.includes('gosi');
      } else if (activeCategory === 'automation_comm') {
        matchCat = app.category === 'automation_comm' || app.category === 'ai_intelligence' || app.appId.includes('whatsapp') || app.appId.includes('ai') || app.appId.includes('shipping');
      }

      const matchInstalled = !showInstalledOnly || app.isInstalled;
      return matchSearch && matchCat && matchInstalled;
    });
  }, [apps, search, activeCategory, showInstalledOnly]);

  const installedCount = apps.filter((a) => a.isInstalled).length;

  const pricing = (tier) => PRICING_LABELS[tier] || PRICING_LABELS.free;

  const renderAppIcon = (iconName) => {
    switch (iconName) {
      case 'factory':
        return '🏭';
      case 'truck':
        return '🚛';
      case 'anchor':
        return '⚓';
      case 'cpu':
        return '📡';
      case 'target':
        return '🎯';
      case 'users':
        return '👥';
      case 'bike':
        return '🛵';
      case 'credit-card':
        return '💳';
      case 'shield':
        return '🛡️';
      case 'printer':
        return '🖨️';
      case 'scale':
        return '⚖️';
      case 'whatsapp':
        return '💬';
      case 'sparkles':
        return '✨';
      case 'briefcase':
        return '💼';
      default:
        return '📦';
    }
  };

  return (
    <div className="min-h-screen pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* ─── Header ─── */}
      <div className="pt-6 pb-8 border-b border-gray-100 dark:border-dark-700 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/40">
                {isAr ? 'سوق التطبيقات والخدمات' : 'Enterprise App Marketplace'}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {isAr ? `${apps.length} تطبيق متاح` : `${apps.length} Apps Available`}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {isAr ? 'متجر التطبيقات' : 'App Store'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-base max-w-2xl">
              {isAr
                ? 'قم بتثبيت التطبيقات الإضافية لتفعيل وحدات التصنيع، الموارد البشرية، الأسطول، وأجهزة الدفع.'
                : 'Install auxiliary apps to unlock Manufacturing, HR, Fleet, Landed Costs, and IoT modules.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInstalledOnly(!showInstalledOnly)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                showInstalledOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isAr ? 'المثبتة' : 'Installed'}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${showInstalledOnly ? 'bg-emerald-700 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300'}`}>
                {installedCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Search & Category Filters ─── */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث عن الموارد البشرية، التصنيع، الأسطول، أجهزة مدى...' : 'Search HR, Manufacturing, Fleet, Landed Costs, Payment Terminal...'}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-sm'
                    : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{isAr ? cat.ar : cat.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Active Installing Banner / Floating Overlay ─── */}
      <AnimatePresence>
        {installingState && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8 p-5 bg-primary-50/80 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/60 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-md animate-spin-slow">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                    {isAr ? `جاري تثبيت: ${installingState.name}` : `Installing: ${installingState.name}`}
                  </h4>
                  <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/60 px-2 py-0.5 rounded-full">
                    {installingState.size}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{installingState.stage}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-64">
              <div className="flex-1 bg-gray-200 dark:bg-dark-700 h-2.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-primary-600 h-full rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${installingState.progress}%` }}
                  transition={{ ease: 'easeInOut', duration: 0.2 }}
                />
              </div>
              <span className="text-xs font-bold text-primary-700 dark:text-primary-300 w-10 text-right">
                {installingState.progress}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Apps Grid ─── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-gray-100 dark:bg-dark-700 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-dark-800 rounded-3xl border border-gray-100 dark:border-dark-700">
          <Sparkles className="w-12 h-12 text-gray-300 dark:text-dark-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {isAr ? 'لم يتم العثور على تطبيقات مطابقة' : 'No apps match your criteria'}
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm mt-1">
            {isAr ? 'جرّب البحث باسم آخر أو اختيار تصنيف "جميع التطبيقات"' : 'Try adjusting your search terms or filter category'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((app) => {
            const isInstalled = app.isInstalled;
            const isCurrentlyInstalling = installingState?.appId === app.appId;

            return (
              <motion.div
                key={app.appId}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group relative bg-white dark:bg-dark-800 rounded-2xl border transition-all duration-200 flex flex-col p-5 cursor-pointer shadow-sm hover:shadow-md ${
                  isInstalled
                    ? 'border-emerald-200/80 dark:border-emerald-900/40 hover:border-emerald-300'
                    : 'border-gray-200/80 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600'
                }`}
                onClick={() => setDetailApp(app)}
              >
                {/* Top Row: Icon + Badges */}
                <div className="flex items-start justify-between mb-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gray-50 dark:bg-dark-700 flex items-center justify-center text-3xl border border-gray-100 dark:border-dark-600 shadow-inner group-hover:scale-105 transition-transform">
                    {renderAppIcon(app.icon)}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {app.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-dark-600">
                        {app.badge}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pricing(app.pricingTier).color}`}>
                      {isAr ? pricing(app.pricingTier).ar : pricing(app.pricingTier).en}
                    </span>
                  </div>
                </div>

                {/* Name & Version */}
                <div className="mb-1.5">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                    {isAr ? app.nameAr : app.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {app.downloadSize || '3.2 MB'}
                    </span>
                    <span>•</span>
                    <span>v{app.version || '2.4.0'}</span>
                  </div>
                </div>

                {/* Tagline */}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed flex-1">
                  {isAr ? app.taglineAr : app.taglineEn}
                </p>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-gray-100 dark:border-dark-700/80 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{app.rating?.toFixed(1) || '4.9'}</span>
                    <span className="text-[10px] text-gray-400">({app.reviewsCount || 85})</span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isInstalled ? (
                      <>
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>{isAr ? 'مثبت' : 'Installed'}</span>
                        </span>

                        <button
                          onClick={() => setUninstallConfirmApp(app)}
                          title={isAr ? 'إلغاء التثبيت' : 'Uninstall'}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStartInstall(app)}
                        disabled={isCurrentlyInstalling || installMutation.isPending}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        {isCurrentlyInstalling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{isAr ? 'جاري التثبيت...' : 'Installing...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>{isAr ? `تثبيت (${app.downloadSize || '3.2 MB'})` : `Install (${app.downloadSize || '3.2 MB'})`}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Detail Slide-over Modal ─── */}
      <AnimatePresence>
        {detailApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setDetailApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: isAr ? -400 : 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? -400 : 400 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className={`fixed top-0 bottom-0 ${isAr ? 'left-0' : 'right-0'} w-full sm:w-[480px] bg-white dark:bg-dark-800 shadow-2xl z-50 overflow-hidden flex flex-col border-s border-gray-200 dark:border-dark-700`}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-dark-700 flex items-center justify-center text-4xl border border-gray-200 dark:border-dark-600 shadow-inner shrink-0">
                    {renderAppIcon(detailApp.icon)}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
                      {isAr ? detailApp.nameAr : detailApp.nameEn}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {detailApp.author || 'Maqder Core'} • v{detailApp.version || '2.4.0'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setDetailApp(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Badges / Metrics Bar */}
              <div className="px-6 py-3.5 bg-gray-50 dark:bg-dark-900/60 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`font-bold px-2.5 py-0.5 rounded-full ${pricing(detailApp.pricingTier).color}`}>
                    {isAr ? pricing(detailApp.pricingTier).ar : pricing(detailApp.pricingTier).en}
                  </span>
                  {detailApp.badge && (
                    <span className="font-semibold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 text-[10px]">
                      {detailApp.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 font-medium">
                  <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                    <HardDrive className="w-3.5 h-3.5 text-primary-500" />
                    {detailApp.downloadSize || '3.5 MB'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    {detailApp.rating?.toFixed(1)} ({detailApp.reviewsCount})
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    {isAr ? 'عن التطبيق' : 'About App'}
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {isAr ? detailApp.descriptionAr : detailApp.descriptionEn}
                  </p>
                </div>

                {/* Features list */}
                {(isAr ? detailApp.featuresAr : detailApp.featuresEn)?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                      {isAr ? 'الميزات والقدرات' : 'Features & Capabilities'}
                    </h4>
                    <div className="space-y-2.5">
                      {(isAr ? detailApp.featuresAr : detailApp.featuresEn).map((feature, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="p-6 border-t border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800 space-y-3">
                {detailApp.isInstalled ? (
                  <>
                    <div className="flex items-center gap-3">
                      {detailApp.defaultRoute && (
                        <button
                          onClick={() => {
                            setDetailApp(null);
                            navigate(detailApp.defaultRoute);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm hover:opacity-90 transition-all shadow-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>{isAr ? 'فتح التطبيق' : 'Open App'}</span>
                        </button>
                      )}

                      {detailApp.configSchema?.length > 0 && (
                        <button
                          onClick={() => {
                            setConfigApp(detailApp);
                            setConfigForm(detailApp.config || {});
                          }}
                          className="px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 font-semibold text-sm transition-colors flex items-center gap-2"
                        >
                          <Sliders className="w-4 h-4" />
                          <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setUninstallConfirmApp(detailApp)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isAr ? 'إلغاء تثبيت التطبيق' : 'Uninstall Application'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      handleStartInstall(detailApp);
                      setDetailApp(null);
                    }}
                    disabled={installMutation.isPending || installingState?.appId === detailApp.appId}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isAr
                        ? `تثبيت التطبيق (${detailApp.downloadSize || '3.5 MB'})`
                        : `Install Application (${detailApp.downloadSize || '3.5 MB'})`}
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Uninstall Confirmation Modal ─── */}
      <AnimatePresence>
        {uninstallConfirmApp && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setUninstallConfirmApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-dark-700 z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isAr ? `إلغاء تثبيت ${uninstallConfirmApp.nameAr}؟` : `Uninstall ${uninstallConfirmApp.nameEn}?`}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
                  {isAr
                    ? 'سيؤدي هذا إلى إخفاء التطبيق من القائمة الجانبية ومشغل التطبيقات. يمكنك إعادة تثبيته في أي وقت مجاناً.'
                    : 'This will remove the application from your sidebar and app launcher. You can reinstall it anytime.'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setUninstallConfirmApp(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => uninstallMutation.mutate(uninstallConfirmApp.appId)}
                  disabled={uninstallMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {uninstallMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{isAr ? 'تأكيد الإلغاء' : 'Uninstall'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Settings Configuration Sheet ─── */}
      <AnimatePresence>
        {configApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setConfigApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: isAr ? -400 : 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? -400 : 400 }}
              className={`fixed top-0 bottom-0 ${isAr ? 'left-0' : 'right-0'} w-full sm:w-[420px] bg-white dark:bg-dark-800 shadow-2xl z-[60] overflow-y-auto border-s border-gray-200 dark:border-dark-700 flex flex-col`}
            >
              <div className="p-6 border-b border-gray-100 dark:border-dark-700 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {isAr ? 'إعدادات التكامل' : 'Integration Settings'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isAr ? configApp.nameAr : configApp.nameEn}
                  </p>
                </div>
                <button
                  onClick={() => setConfigApp(null)}
                  className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {configApp.configSchema?.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAr ? field.labelAr : field.labelEn}
                    </label>

                    {field.type === 'boolean' ? (
                      <label className="relative inline-flex items-center cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={!!configForm[field.key]}
                          onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer dark:bg-dark-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                      </label>
                    ) : field.type === 'select' ? (
                      <select
                        value={configForm[field.key] || field.defaultValue || ''}
                        onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {isAr ? opt.labelAr : opt.labelEn}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                        value={configForm[field.key] || ''}
                        onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/30"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-dark-700 bg-white dark:bg-dark-800">
                <button
                  onClick={() => saveSettingsMutation.mutate({ appId: configApp.appId, config: configForm })}
                  disabled={saveSettingsMutation.isPending}
                  className="w-full py-3 rounded-xl bg-primary-600 text-white text-sm font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : isAr ? (
                    'حفظ التغييرات'
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

