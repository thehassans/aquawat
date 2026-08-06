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
  Factory,
  ArrowRight,
  Store
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { updateTenant } from '../../store/slices/authSlice';
import { App3DIcon } from '../../components/ui/App3DIcon';

const PRICING_LABELS = {
  free: { en: 'Free', ar: 'مجاني', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20' },
  paid: { en: 'Paid', ar: 'مدفوع', color: 'text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-500/10 border-amber-200/50 dark:border-amber-500/20' },
  enterprise: { en: 'Enterprise', ar: 'مؤسسات', color: 'text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-500/10 border-violet-200/50 dark:border-violet-500/20' },
};

const CATEGORIES = [
  { id: 'all', icon: LayoutGrid, en: 'All Apps', ar: 'جميع التطبيقات' },
  { id: 'industry_verticals', icon: Store, en: 'Industry Verticals', ar: 'قطاعات الأعمال والأنشطة' },
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
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [selectedConfigAppId, setSelectedConfigAppId] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [uninstallConfirmApp, setUninstallConfirmApp] = useState(null);

  // Animated Installation State: { appId, name, size, progress, stage }
  const [installingState, setInstallingState] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((r) => r.data),
  });

  const apps = data?.apps || [];

  const detailApp = useMemo(
    () => apps.find((a) => a.appId === selectedAppId) || null,
    [apps, selectedAppId]
  );

  const configApp = useMemo(
    () => apps.find((a) => a.appId === selectedConfigAppId) || null,
    [apps, selectedConfigAppId]
  );

  const refreshTenant = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.tenant) {
        dispatch(updateTenant(res.data.tenant));
      }
    } catch {}
  };

  const installMutation = useMutation({
    mutationFn: (appId) => api.post(`/app-store/apps/${appId}/install`),
    onSuccess: (res, appId) => {
      const updatedTenant = res.data?.tenant || res.data;
      if (updatedTenant?.settings) {
        dispatch(updateTenant(updatedTenant));
      }
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
    onSuccess: (res) => {
      const updatedTenant = res.data?.tenant || res.data;
      if (updatedTenant?.settings) {
        dispatch(updateTenant(updatedTenant));
      }
      toast.success(isAr ? 'تم إلغاء تثبيت التطبيق بنجاح' : 'App uninstalled successfully');
      queryClient.invalidateQueries(['app-store-apps']);
      setUninstallConfirmApp(null);
      refreshTenant();
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل إلغاء التثبيت' : 'Uninstall failed')),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: ({ appId, config }) => api.put(`/app-store/apps/${appId}/settings`, { config }),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ الإعدادات' : 'Settings saved');
      setSelectedConfigAppId(null);
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
      size: app.downloadSize || '4.5 MB',
      progress: 10,
      stage: isAr ? 'جاري بدء التحميل...' : 'Initiating download...'
    });

    // Start API mutation in background
    installMutation.mutate(app.appId);
  };

  // Installation progress simulation ticker
  useEffect(() => {
    if (!installingState) return;

    if (installingState.progress >= 100) {
      const timeout = setTimeout(() => {
        toast.success(isAr ? `تم تثبيت ${installingState.name} بنجاح` : `${installingState.name} installed successfully`);
        setInstallingState(null);
      }, 800);
      return () => clearTimeout(timeout);
    }

    const interval = setInterval(() => {
      setInstallingState((prev) => {
        if (!prev) return null;
        
        let newProgress = prev.progress;
        let newStage = prev.stage;
        
        if (prev.progress < 40) {
          newProgress += 15;
          newStage = isAr ? `جاري تحميل الحزمة (${prev.size})...` : `Downloading package (${prev.size})...`;
        } else if (prev.progress < 75) {
          newProgress += 15;
          newStage = isAr ? 'التحقق من التوقيع الرقمي واستخراج الملفات...' : 'Verifying integrity...';
        } else if (prev.progress < 95) {
          newProgress += 10;
          newStage = isAr ? 'تهيئة الصلاحيات...' : 'Configuring modules...';
        } else {
          newProgress = 100;
          newStage = isAr ? 'اكتمل التثبيت!' : 'Complete!';
        }

        return {
          ...prev,
          progress: newProgress,
          stage: newStage
        };
      });
    }, 300);

    return () => clearInterval(interval);
  }, [installingState?.appId, installingState?.progress, isAr]);

  // Robust filtering
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
      if (activeCategory === 'industry_verticals') {
        matchCat = app.category === 'industry_vertical' ||
          app.appType === 'industry_vertical' ||
          ['manufacturing', 'boutique', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'manpower', 'bakala', 'trading'].some(
            (v) => app.appId.includes(v)
          );
      } else if (activeCategory === 'hr_manpower') {
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
        matchCat = app.category === 'saudi_compliance' ||
          app.appId.includes('zatca') ||
          app.appId.includes('gosi') ||
          app.appId.includes('elm') ||
          app.appId.includes('qiwa') ||
          app.appId.includes('balady') ||
          app.appId.includes('saber') ||
          app.appId.includes('etimad') ||
          app.appId.includes('tamm');
      } else if (activeCategory === 'automation_comm') {
        matchCat = app.category === 'automation_comm' || app.category === 'ai_intelligence' || app.appId.includes('whatsapp') || app.appId.includes('ai') || app.appId.includes('shipping');
      }

      const matchInstalled = !showInstalledOnly || app.isInstalled;
      return matchSearch && matchCat && matchInstalled;
    });
  }, [apps, search, activeCategory, showInstalledOnly]);

  const installedCount = apps.filter((a) => a.isInstalled).length;
  const pricing = (tier) => PRICING_LABELS[tier] || PRICING_LABELS.free;

  const renderAppIcon = (appObj, className = 'w-10 h-10') => {
    if (!appObj) return null;
    return (
      <App3DIcon
        appId={appObj.appId}
        icon={appObj.icon}
        path={appObj.defaultRoute}
        label={appObj.nameEn}
        className={className}
      />
    );
  };

  return (
    <div className="min-h-screen pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* ─── Premium Header ─── */}
      <div className="pt-10 pb-12 mb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="w-12 h-1 bg-gradient-to-r from-primary-500 to-primary-300 rounded-full mb-6"></div>
            <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tighter">
              {isAr ? 'متجر التطبيقات' : 'App Store'}
            </h1>
            <p className="text-gray-400 dark:text-gray-500 mt-3 text-sm sm:text-base max-w-2xl font-medium tracking-wide">
              {isAr
                ? 'قم بتثبيت التطبيقات الإضافية لتفعيل وحدات التصنيع، الموارد البشرية، الأسطول، وأجهزة الدفع.'
                : 'Install auxiliary apps to unlock Manufacturing, HR, Fleet, Landed Costs, and IoT modules.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInstalledOnly(!showInstalledOnly)}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ease-out ${
                showInstalledOnly
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-[0_8px_30px_rgb(0,0,0,0.12)]'
                  : 'bg-white/50 dark:bg-dark-800/50 text-gray-600 dark:text-gray-300 backdrop-blur-md border border-gray-200/50 dark:border-white/5 hover:bg-white dark:hover:bg-dark-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${showInstalledOnly ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
              <span>{isAr ? 'التطبيقات المثبتة' : 'Installed Apps'}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ml-1 ${showInstalledOnly ? 'bg-white/20 dark:bg-black/10' : 'bg-gray-100 dark:bg-dark-700'}`}>
                {installedCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Search & Categories ─── */}
      <div className="space-y-6 mb-12">
        <div className="relative group max-w-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-purple-500/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'ابحث عن التطبيقات، التصنيفات، أو الميزات...' : 'Search apps, categories, or features...'}
              className="w-full pl-12 pr-10 py-4 rounded-2xl border border-gray-100/60 dark:border-white/10 bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-400/80 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none snap-x">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`relative flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ease-out snap-center whitespace-nowrap overflow-hidden ${
                    isActive
                      ? 'text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCategoryBg"
                      className="absolute inset-0 bg-primary-50 dark:bg-primary-900/20 border border-primary-100/50 dark:border-primary-500/20 rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary-500' : 'opacity-70'}`} />
                    <span>{isAr ? cat.ar : cat.en}</span>
                  </div>
                  {isActive && (
                    <motion.div 
                      layoutId="activeCategoryDot"
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary-500"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Premium Installation Overlay ─── */}
      <AnimatePresence>
        {installingState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/40 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-80 bg-white/80 dark:bg-dark-800/80 backdrop-blur-3xl border border-gray-100 dark:border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center justify-center shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-purple-500/5 rounded-[2.5rem] pointer-events-none" />
              
              <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                {/* Particle ring dots */}
                <div className="absolute inset-0 animate-spin-slow opacity-50">
                  <div className="w-2 h-2 rounded-full bg-primary-400 absolute top-0 left-1/2 -translate-x-1/2"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 absolute bottom-4 left-4"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 absolute bottom-4 right-4"></div>
                </div>

                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    className="text-gray-100 dark:text-dark-700 stroke-current"
                    strokeWidth="6"
                    cx="50"
                    cy="50"
                    r="44"
                    fill="transparent"
                  />
                  <motion.circle
                    className="text-primary-500 stroke-current"
                    strokeWidth="6"
                    strokeLinecap="round"
                    cx="50"
                    cy="50"
                    r="44"
                    fill="transparent"
                    initial={{ strokeDasharray: "276", strokeDashoffset: "276" }}
                    animate={{ strokeDashoffset: 276 - (276 * installingState.progress) / 100 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {installingState.progress >= 100 ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                    >
                      <Check className="w-10 h-10 text-primary-500" />
                    </motion.div>
                  ) : (
                    <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">
                      {installingState.progress}<span className="text-xl">%</span>
                    </span>
                  )}
                </div>
              </div>

              <h4 className="text-lg font-black text-gray-900 dark:text-white mb-3 text-center tracking-tight">
                {isAr ? `تثبيت ${installingState.name}` : `Installing ${installingState.name}`}
              </h4>
              <motion.div
                key={installingState.stage}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 text-center font-medium"
              >
                {installingState.progress < 40 ? <Download className="w-4 h-4 animate-bounce" /> :
                 installingState.progress < 75 ? <Shield className="w-4 h-4 animate-pulse text-blue-500" /> :
                 installingState.progress < 95 ? <Sliders className="w-4 h-4 animate-spin text-purple-500" /> :
                 installingState.progress < 100 ? <Zap className="w-4 h-4 text-amber-500 animate-pulse" /> :
                 null}
                <span>{installingState.stage}</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Apps Grid ─── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-3xl bg-gray-100/50 dark:bg-dark-800/50 relative overflow-hidden">
               <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24 bg-white/40 dark:bg-dark-800/40 rounded-[2.5rem] border border-gray-100/50 dark:border-white/5 backdrop-blur-xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-500/5 via-transparent to-transparent"></div>
          <Sparkles className="w-14 h-14 text-gray-300 dark:text-dark-500 mx-auto mb-4 relative z-10" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight relative z-10">
            {isAr ? 'لم يتم العثور على تطبيقات' : 'No apps found'}
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2 relative z-10">
            {isAr ? 'جرّب البحث باسم آخر أو اختيار تصنيف مختلف' : 'Try adjusting your search or filter category'}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((app) => {
            const isInstalled = app.isInstalled;
            const isCurrentlyInstalling = installingState?.appId === app.appId;

            return (
              <motion.div
                key={app.appId}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group relative bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl rounded-3xl border transition-all duration-300 ease-out flex flex-col p-6 cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] overflow-hidden ${
                  isInstalled
                    ? 'border-emerald-200/50 dark:border-emerald-500/20 hover:border-emerald-300/80 dark:hover:border-emerald-500/40'
                    : 'border-gray-100/60 dark:border-white/5 hover:border-gray-300/60 dark:hover:border-white/20'
                }`}
                onClick={() => setSelectedAppId(app.appId)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                
                <div className="relative flex items-start justify-between mb-5 z-10">
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-800 flex items-center justify-center border border-white/40 dark:border-white/10 shadow-inner group-hover:scale-[1.03] transition-transform duration-300 p-2.5 shrink-0 overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5 z-0 rounded-2xl"></div>
                     <div className="relative z-10">
                       {renderAppIcon(app, 'w-11 h-11')}
                     </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5">
                    {app.badge && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-purple-600 dark:text-purple-300 border border-purple-100/50 dark:border-purple-800/30 backdrop-blur-md">
                        {app.badge}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${pricing(app.pricingTier).color}`}>
                      {isAr ? pricing(app.pricingTier).ar : pricing(app.pricingTier).en}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 mb-2">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1 tracking-tight">
                    {isAr ? app.nameAr : app.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1 opacity-80">
                      {app.downloadSize || '4.5 MB'}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    <span className="opacity-80">v{app.version || '2.4.0'}</span>
                  </div>
                </div>

                <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-6 leading-relaxed flex-1 font-medium">
                  {isAr ? app.taglineAr : app.taglineEn}
                </p>

                <div className="relative z-10 pt-4 border-t border-gray-100/60 dark:border-white/5 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1.5 bg-gray-50/50 dark:bg-dark-700/50 px-2 py-1 rounded-lg backdrop-blur-sm">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.5)]" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{app.rating?.toFixed(1) || '4.9'}</span>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isInstalled ? (
                      <>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-200/50 dark:border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          <span>{isAr ? 'مثبت' : 'Installed'}</span>
                        </span>

                        {app.defaultRoute && (
                          <button
                            onClick={() => navigate(app.defaultRoute)}
                            title={isAr ? 'فتح التطبيق' : 'Open App'}
                            className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-full transition-all duration-300"
                          >
                            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                          </button>
                        )}
                        <button
                          onClick={() => setUninstallConfirmApp(app)}
                          title={isAr ? 'إلغاء التثبيت' : 'Uninstall'}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-all duration-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStartInstall(app)}
                        disabled={isCurrentlyInstalling || installMutation.isPending}
                        className="group/btn flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300 active:scale-95 disabled:opacity-50 overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                        {isCurrentlyInstalling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{isAr ? 'جاري التثبيت...' : 'Installing'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                            <span>{isAr ? 'تثبيت' : 'Install'}</span>
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
              className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-md z-[80]"
              onClick={() => setSelectedAppId(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: isAr ? -400 : 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? -400 : 400 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className={`fixed top-0 bottom-0 ${isAr ? 'left-0' : 'right-0'} w-full sm:w-[480px] bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl shadow-[0_0_80px_rgba(0,0,0,0.2)] z-[80] overflow-hidden flex flex-col border-s border-gray-100/50 dark:border-white/10`}
            >
              <div className="relative p-8 border-b border-gray-100/60 dark:border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent pointer-events-none"></div>
                <div className="relative flex items-start justify-between gap-4 z-10">
                  <div className="flex items-start gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-800 flex items-center justify-center border border-white/40 dark:border-white/10 shadow-lg shrink-0 p-3 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent dark:from-white/5 z-0"></div>
                      <div className="relative z-10">
                        {renderAppIcon(detailApp, 'w-14 h-14')}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                        {isAr ? detailApp.nameAr : detailApp.nameEn}
                      </h2>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                        {detailApp.author || 'Maqder Core'} • v{detailApp.version || '2.4.0'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedAppId(null)}
                    className="p-2.5 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/10 transition-all duration-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="px-8 py-4 bg-gray-50/50 dark:bg-dark-900/30 border-b border-gray-100/60 dark:border-white/5 flex items-center justify-between text-xs backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className={`font-bold px-3 py-1 rounded-full border ${pricing(detailApp.pricingTier).color}`}>
                    {isAr ? pricing(detailApp.pricingTier).ar : pricing(detailApp.pricingTier).en}
                  </span>
                  {detailApp.badge && (
                    <span className="font-bold px-3 py-1 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 uppercase tracking-wider text-[10px]">
                      {detailApp.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-primary-500" />
                    {detailApp.downloadSize || '4.5 MB'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                  <span className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    {detailApp.rating?.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                    {isAr ? 'نظرة عامة' : 'Overview'}
                  </h4>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 leading-relaxed">
                    {isAr ? detailApp.descriptionAr : detailApp.descriptionEn}
                  </p>
                </div>

                {(isAr ? detailApp.featuresAr : detailApp.featuresEn)?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                      {isAr ? 'القدرات والميزات' : 'Capabilities'}
                    </h4>
                    <div className="space-y-3">
                      {(isAr ? detailApp.featuresAr : detailApp.featuresEn).map((feature, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                          <div className="mt-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 p-0.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                          </div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-gray-100/60 dark:border-white/5 bg-white/50 dark:bg-dark-800/50 backdrop-blur-md space-y-4">
                {detailApp.isInstalled ? (
                  <>
                    <div className="flex items-center gap-3">
                      {detailApp.defaultRoute && (
                        <button
                          onClick={() => {
                            setSelectedAppId(null);
                            navigate(detailApp.defaultRoute);
                          }}
                          className="group/open flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm shadow-[0_8px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.15)] transition-all duration-300"
                        >
                          <span>{isAr ? 'فتح التطبيق' : 'Open App'}</span>
                          <ArrowRight className="w-4 h-4 group-hover/open:translate-x-1 transition-transform rtl:rotate-180" />
                        </button>
                      )}

                      {detailApp.configSchema?.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedConfigAppId(detailApp.appId);
                            setConfigForm(detailApp.config || {});
                          }}
                          className="px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 font-bold text-sm transition-all flex items-center gap-2"
                        >
                          <Sliders className="w-4 h-4" />
                          <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setUninstallConfirmApp(detailApp)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-bold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isAr ? 'إلغاء تثبيت التطبيق' : 'Uninstall Application'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      handleStartInstall(detailApp);
                      setSelectedAppId(null);
                    }}
                    disabled={installMutation.isPending || installingState?.appId === detailApp.appId}
                    className="group/install w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-bold text-sm shadow-[0_10px_30px_-10px_rgba(var(--color-primary-600),0.5)] transition-all duration-300 active:scale-[0.98] disabled:opacity-50 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/install:translate-y-0 transition-transform duration-300 ease-out"></div>
                    <Download className="w-4 h-4 relative z-10 group-hover/install:-translate-y-0.5 transition-transform" />
                    <span className="relative z-10">
                      {isAr
                        ? `تثبيت التطبيق (${detailApp.downloadSize || '4.5 MB'})`
                        : `Install Application (${detailApp.downloadSize || '4.5 MB'})`}
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-md"
              onClick={() => setUninstallConfirmApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white/90 dark:bg-dark-800/90 backdrop-blur-xl rounded-[2rem] p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-white/10 z-10 space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-red-500/20 blur-xl"></div>
                <AlertTriangle className="w-8 h-8 relative z-10" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                  {isAr ? `إلغاء تثبيت ${uninstallConfirmApp.nameAr}؟` : `Uninstall ${uninstallConfirmApp.nameEn}?`}
                </h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                  {isAr
                    ? 'سيؤدي هذا إلى إخفاء التطبيق من القائمة الجانبية. يمكنك إعادة تثبيته في أي وقت.'
                    : 'This will remove the application from your workspace. You can reinstall it anytime.'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setUninstallConfirmApp(null)}
                  className="flex-1 py-3.5 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-300"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => uninstallMutation.mutate(uninstallConfirmApp.appId)}
                  disabled={uninstallMutation.isPending}
                  className="flex-1 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all duration-300 shadow-[0_8px_20px_-8px_rgba(220,38,38,0.5)] disabled:opacity-50 flex items-center justify-center gap-2"
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
              className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-md z-[90]"
              onClick={() => setSelectedConfigAppId(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: isAr ? -400 : 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? -400 : 400 }}
              className={`fixed top-0 bottom-0 ${isAr ? 'left-0' : 'right-0'} w-full sm:w-[420px] bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl shadow-[0_0_80px_rgba(0,0,0,0.2)] z-[90] overflow-y-auto border-s border-gray-100/50 dark:border-white/10 flex flex-col`}
            >
              <div className="p-8 border-b border-gray-100/60 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                    {isAr ? 'إعدادات التكامل' : 'Settings'}
                  </h3>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                    {isAr ? configApp.nameAr : configApp.nameEn}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedConfigAppId(null)}
                  className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                {configApp.configSchema?.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
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
                        <div className="w-12 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer dark:bg-dark-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 shadow-inner" />
                      </label>
                    ) : field.type === 'select' ? (
                      <select
                        value={configForm[field.key] || field.defaultValue || ''}
                        onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.value }))}
                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-dark-900/50 backdrop-blur-sm text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
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
                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-dark-900/50 backdrop-blur-sm text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 outline-none transition-all placeholder-gray-400"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-8 border-t border-gray-100/60 dark:border-white/5 bg-gray-50/50 dark:bg-dark-900/30 backdrop-blur-md">
                <button
                  onClick={() => saveSettingsMutation.mutate({ appId: configApp.appId, config: configForm })}
                  disabled={saveSettingsMutation.isPending}
                  className="w-full py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold shadow-[0_8px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_25px_rgba(0,0,0,0.15)] transition-all duration-300 disabled:opacity-50 active:scale-95"
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
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
