import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Store,
  ChevronRight,
  ChevronLeft,
  Filter,
  CheckCheck,
  Layers,
  Award,
  Globe2,
  Lock,
  ArrowUpRight,
  TrendingUp,
  Boxes,
  Truck,
  Building2,
  Plane,
  BadgeCheck,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { updateTenant } from '../../store/slices/authSlice';
import { App3DIcon } from '../../components/ui/App3DIcon';

const PRICING_LABELS = {
  free: {
    en: 'Included',
    ar: 'مشمول',
    color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
  },
  paid: {
    en: 'Pro Add-on',
    ar: 'إضافي Pro',
    color: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/20'
  },
  enterprise: {
    en: 'Enterprise',
    ar: 'مؤسسي',
    color: 'text-purple-700 dark:text-purple-300 bg-purple-500/10 border-purple-500/20'
  },
};

const CATEGORIES = [
  { id: 'all', icon: LayoutGrid, en: 'All Ecosystem', ar: 'كل المنظومة' },
  { id: 'industry_verticals', icon: Store, en: 'Industry Verticals', ar: 'قطاعات الأعمال' },
  { id: 'saudi_compliance', icon: CheckCircle2, en: 'Saudi Gov & ZATCA', ar: 'الامتثال وزاتكا' },
  { id: 'manufacturing', icon: Factory, en: 'Manufacturing & MES', ar: 'التصنيع والإنتاج' },
  { id: 'pos_retail', icon: Zap, en: 'Retail & POS', ar: 'نقاط البيع والمطاعم' },
  { id: 'hr_manpower', icon: Users, en: 'HR & Workforce', ar: 'الموارد البشرية والرواتب' },
  { id: 'hardware_iot', icon: Cpu, en: 'Hardware & IoT', ar: 'الأجهزة وإنترنت الأشياء' },
  { id: 'finance_accounting', icon: Shield, en: 'Finance & Costs', ar: 'المالية والتكاليف' },
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
  const [sortBy, setSortBy] = useState('featured'); // 'featured', 'rating', 'name'
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [selectedConfigAppId, setSelectedConfigAppId] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [uninstallConfirmApp, setUninstallConfirmApp] = useState(null);
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);

  // Animated Installation State: { appId, name, size, progress, stage }
  const [installingState, setInstallingState] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((r) => r.data),
  });

  const apps = useMemo(() => data?.apps || [], [data?.apps]);

  // Spotlight featured showcase apps
  const spotlightApps = useMemo(() => {
    if (!apps.length) return [];
    const spotlightIds = ['zatca_phase2_pro', 'manufacturing_mes', 'bakala_supermarket', 'payment_terminal_integration'];
    const found = spotlightIds.map(id => apps.find(a => a.appId === id)).filter(Boolean);
    return found.length > 0 ? found : apps.slice(0, 3);
  }, [apps]);

  // Auto rotate spotlight
  useEffect(() => {
    if (spotlightApps.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSpotlightIndex((prev) => (prev + 1) % spotlightApps.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [spotlightApps.length]);

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
    onSuccess: (res) => {
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
  const handleStartInstall = useCallback((app) => {
    if (installingState) return;

    setInstallingState({
      appId: app.appId,
      name: isAr ? app.nameAr : app.nameEn,
      size: app.downloadSize || '5.2 MB',
      progress: 15,
      stage: isAr ? 'جاري الاتصال بالسحابة وتحميل الحزمة...' : 'Initiating secure package download...'
    });

    installMutation.mutate(app.appId);
  }, [installingState, installMutation, isAr]);

  // Installation progress simulation ticker
  useEffect(() => {
    if (!installingState) return;

    if (installingState.progress >= 100) {
      const timeout = setTimeout(() => {
        toast.success(isAr ? `تم تثبيت ${installingState.name} بنجاح` : `${installingState.name} installed successfully`);
        setInstallingState(null);
      }, 700);
      return () => clearTimeout(timeout);
    }

    const interval = setInterval(() => {
      setInstallingState((prev) => {
        if (!prev) return null;

        let newProgress = prev.progress;
        let newStage = prev.stage;

        if (prev.progress < 45) {
          newProgress += 18;
          newStage = isAr ? `تحميل الحزم الرقمية (${prev.size})...` : `Downloading binary package (${prev.size})...`;
        } else if (prev.progress < 75) {
          newProgress += 16;
          newStage = isAr ? 'التحقق من التوقيع الرقمي وترخيص ZATCA...' : 'Verifying cryptographic digital signatures...';
        } else if (prev.progress < 95) {
          newProgress += 12;
          newStage = isAr ? 'تهيئة صلاحيات المنشأة وقواعد البيانات...' : 'Provisioning database schemas & permissions...';
        } else {
          newProgress = 100;
          newStage = isAr ? 'اكتمل التثبيت بنجاح!' : 'Integration Ready!';
        }

        return {
          ...prev,
          progress: newProgress,
          stage: newStage
        };
      });
    }, 280);

    return () => clearInterval(interval);
  }, [installingState?.appId, installingState?.progress, isAr]);

  // Filtering & Sorting
  const filtered = useMemo(() => {
    let result = apps.filter((app) => {
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
        matchCat =
          app.category === 'industry_verticals' ||
          app.category === 'industry_vertical' ||
          app.appType === 'core_vertical' ||
          app.appType === 'industry_vertical' ||
          ['manufacturing', 'boutique', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'manpower', 'bakala', 'trading'].some(
            (v) => app.appId.includes(v)
          );
      } else if (activeCategory === 'hr_manpower') {
        matchCat = app.category === 'hr_manpower' || app.appId.includes('hr') || app.appId.includes('fleet') || app.appId.includes('crm') || app.appId.includes('gosi') || app.appId.includes('manpower');
      } else if (activeCategory === 'manufacturing') {
        matchCat = app.category === 'manufacturing' || app.appId.includes('manufacturing');
      } else if (activeCategory === 'finance_accounting') {
        matchCat = app.category === 'finance_accounting' || app.appId.includes('landed') || app.appId.includes('vat');
      } else if (activeCategory === 'hardware_iot') {
        matchCat = app.category === 'hardware_iot' || app.appType === 'hardware_integration' || app.appId.includes('iot') || app.appId.includes('terminal') || app.appId.includes('printer') || app.appId.includes('scale');
      } else if (activeCategory === 'pos_retail') {
        matchCat = app.category === 'pos_retail' || app.appId.includes('delivery') || app.appId.includes('retail') || app.appId.includes('restaurant') || app.appId.includes('bakala');
      } else if (activeCategory === 'saudi_compliance') {
        matchCat =
          app.category === 'saudi_compliance' ||
          app.appId.includes('zatca') ||
          app.appId.includes('gosi') ||
          app.appId.includes('elm') ||
          app.appId.includes('qiwa') ||
          app.appId.includes('balady') ||
          app.appId.includes('saber') ||
          app.appId.includes('etimad') ||
          app.appId.includes('tamm');
      } else if (activeCategory === 'automation_comm') {
        matchCat = app.category === 'automation_comm' || app.category === 'ai_intelligence' || app.appId.includes('whatsapp') || app.appId.includes('ai') || app.appId.includes('shipping') || app.appId.includes('email');
      }

      const matchInstalled = !showInstalledOnly || app.isInstalled;
      return matchSearch && matchCat && matchInstalled;
    });

    if (sortBy === 'rating') {
      result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => (isAr ? a.nameAr.localeCompare(b.nameAr) : a.nameEn.localeCompare(b.nameEn)));
    }

    return result;
  }, [apps, search, activeCategory, showInstalledOnly, sortBy, isAr]);

  const installedCount = useMemo(() => apps.filter((a) => a.isInstalled).length, [apps]);
  const pricing = (tier) => PRICING_LABELS[tier] || PRICING_LABELS.free;

  const currentSpotlight = spotlightApps[activeSpotlightIndex] || null;

  return (
    <div className="min-h-screen pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 font-sans selection:bg-primary-500/20">
      
      {/* ─── Hero Spotlight & Header Section ─── */}
      <section className="pt-8 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAr ? 'منظومة التطبيقات المتكاملة' : 'Enterprise App Ecosystem'}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
              {isAr ? 'متجر التطبيقات والوحدات' : 'App Store & Extensions'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base max-w-2xl font-medium leading-relaxed">
              {isAr
                ? 'قم بتوسيع إمكانيات منشأتك بضغطة زر واحدة. ثبّت وحدات التصنيع، المقاولات، الامتثال الحكومي السعودي، وأجهزة نقاط البيع.'
                : 'Instantly empower your enterprise. One-click deploy specialized modules for MES, Contracting, Saudi Gov Compliance, and Smart IoT.'}
            </p>
          </div>

          {/* Quick Stats Banner */}
          <div className="flex items-center gap-3 self-start lg:self-auto">
            <button
              onClick={() => setShowInstalledOnly(!showInstalledOnly)}
              className={`relative flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-300 shadow-sm ${
                showInstalledOnly
                  ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                  : 'bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-white/10 hover:border-primary-500/40'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${showInstalledOnly ? 'bg-white' : 'bg-emerald-500'} animate-pulse`} />
              <span>{isAr ? 'التطبيقات المثبتة' : 'Installed Modules'}</span>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${showInstalledOnly ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white'}`}>
                {installedCount} / {apps.length}
              </span>
            </button>
          </div>
        </div>

        {/* ─── Featured Spotlight Banner (Apple / Vercel style) ─── */}
        {currentSpotlight && (
          <div className="relative rounded-[2.5rem] p-6 sm:p-10 mb-10 overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-primary-950 text-white shadow-[0_20px_50px_-15px_rgba(0,0,0,0.3)] border border-white/10">
            {/* Ambient Background Glow */}
            <motion.div
              key={`glow-a-${currentSpotlight.appId}`}
              className="absolute -top-24 -right-24 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl pointer-events-none"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
            {/* Subtle premium grid texture */}
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                backgroundSize: '36px 36px',
                maskImage: 'radial-gradient(ellipse 80% 80% at 50% 0%, black 40%, transparent 100%)',
              }}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={currentSpotlight.appId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
              >
                {/* Left Info Column */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/10 border border-white/15 text-primary-300 backdrop-blur-md">
                      ★ {isAr ? 'تطبيق مميز' : 'Featured Spotlight'}
                    </span>
                    {currentSpotlight.badge && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400/30 text-amber-300 backdrop-blur-md">
                        {currentSpotlight.badge}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-medium">
                      v{currentSpotlight.version || '3.2.0'} • {currentSpotlight.downloadSize || '14.8 MB'}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                    {isAr ? currentSpotlight.nameAr : currentSpotlight.nameEn}
                  </h2>

                  <p className="text-gray-300 text-sm sm:text-base leading-relaxed max-w-2xl font-medium">
                    {isAr ? currentSpotlight.taglineAr : currentSpotlight.taglineEn}
                  </p>

                  {/* Key Feature Chips */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {(isAr ? currentSpotlight.featuresAr : currentSpotlight.featuresEn)?.slice(0, 3).map((feat, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-200 font-medium">
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                        {feat}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-4 pt-4">
                    {currentSpotlight.isInstalled ? (
                      <button
                        onClick={() => currentSpotlight.defaultRoute && navigate(currentSpotlight.defaultRoute)}
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-gray-900 font-black text-sm hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl active:scale-95"
                      >
                        <span>{isAr ? 'فتح مساحة العمل' : 'Launch Workspace'}</span>
                        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartInstall(currentSpotlight)}
                        disabled={installMutation.isPending || installingState?.appId === currentSpotlight.appId}
                        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white font-black text-sm transition-all shadow-lg shadow-primary-500/25 active:scale-95 disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        <span>{isAr ? 'تثبيت مجاني' : '1-Click Install'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedAppId(currentSpotlight.appId)}
                      className="px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm transition-all backdrop-blur-md"
                    >
                      {isAr ? 'تفاصيل التطبيق' : 'View Details'}
                    </button>
                  </div>
                </div>

                {/* Right Big 3D Icon Presentation */}
                <div className="lg:col-span-4 flex flex-col items-center justify-center relative">
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 p-6 flex items-center justify-center shadow-2xl shadow-black/40 group">
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 animate-pulse" />
                    <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary-400/20 via-transparent to-purple-400/20 blur-2xl pointer-events-none" />
                    <App3DIcon
                      appId={currentSpotlight.appId}
                      icon={currentSpotlight.icon}
                      path={currentSpotlight.defaultRoute}
                      label={currentSpotlight.nameEn}
                      className="w-full h-full relative z-10 transition-transform duration-500 group-hover:scale-110 drop-shadow-2xl"
                    />
                  </div>

                  {/* Spotlight Navigator Dots */}
                  <div className="flex items-center gap-2 mt-6">
                    {spotlightApps.map((app, idx) => (
                      <button
                        key={app.appId}
                        onClick={() => setActiveSpotlightIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          idx === activeSpotlightIndex ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'
                        }`}
                        aria-label={`Spotlight slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* ─── 4 Pillars of Maqder Ecosystem ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-dark-800/80 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-500/30 transition-all duration-300 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <BadgeCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 dark:text-white">
                {isAr ? 'اعتماد زاتكا 100%' : 'ZATCA Phase 2'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {isAr ? 'فواتير رقمية مشفرة' : 'Saudi compliant'}
              </p>
            </div>
          </div>

          <div className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-dark-800/80 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-500/30 transition-all duration-300 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 dark:text-white">
                {isAr ? 'تثبيت فوري لحظي' : '1-Click Deploy'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {isAr ? 'بدون انقطاع للنظام' : 'Zero downtime'}
              </p>
            </div>
          </div>

          <div className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-dark-800/80 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-purple-500/30 transition-all duration-300 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 dark:text-white">
                {isAr ? '35+ تطبيق متخصص' : '35+ Native Modules'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {isAr ? 'لكافة الأنشطة التجارية' : 'All industries'}
              </p>
            </div>
          </div>

          <div className="group p-4 sm:p-5 rounded-2xl bg-white dark:bg-dark-800/80 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-amber-500/30 transition-all duration-300 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 dark:text-white">
                {isAr ? 'عزل كامل للبيانات' : 'Multi-Tenant Safe'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                {isAr ? 'حماية مشددة للمنشأة' : 'Dedicated tenant'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Search & Category Navigation ─── */}
      <section className="space-y-6 mb-10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Modern Search Bar */}
          <div className="relative flex-1 max-w-xl group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary-500/0 via-primary-500/0 to-primary-500/0 group-focus-within:from-primary-500/30 group-focus-within:via-purple-500/20 group-focus-within:to-primary-500/30 blur-md transition-all duration-500 pointer-events-none" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'ابحث باسم التطبيق، الكلمات المفتاحية، أو الميزات...' : 'Search apps, vertical features, hardware drivers...'}
              className="relative w-full pl-12 pr-10 py-3.5 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-800/90 text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">
              {isAr ? 'الترتيب حسب:' : 'Sort by:'}
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-800 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="featured">{isAr ? 'المميز أولاً' : 'Featured'}</option>
              <option value="rating">{isAr ? 'الأعلى تقييماً' : 'Highest Rated'}</option>
              <option value="name">{isAr ? 'أبجدياً' : 'Alphabetical'}</option>
            </select>
          </div>
        </div>

        {/* Category Pills Navigation */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none snap-x">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap snap-center transition-colors duration-300 ${
                    isActive
                      ? 'text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-800 border border-gray-200/70 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="app-store-category-pill"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      className="absolute inset-0 rounded-2xl bg-gray-900 dark:bg-white shadow-md shadow-gray-900/10"
                    />
                  )}
                  <Icon className={`relative w-4 h-4 ${isActive ? (isAr ? 'text-primary-300' : 'text-primary-400 dark:text-primary-600') : 'text-gray-400'}`} />
                  <span className="relative">{isAr ? cat.ar : cat.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Animated Installation Modal ─── */}
      <AnimatePresence>
        {installingState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-dark-800 border border-gray-100 dark:border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center justify-center shadow-2xl"
            >
              {/* Radial Glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-purple-500/10 rounded-[2.5rem] pointer-events-none" />

              <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    className="text-gray-100 dark:text-dark-700 stroke-current"
                    strokeWidth="7"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                  />
                  <motion.circle
                    className="text-primary-500 stroke-current"
                    strokeWidth="7"
                    strokeLinecap="round"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    initial={{ strokeDasharray: "264", strokeDashoffset: "264" }}
                    animate={{ strokeDashoffset: 264 - (264 * installingState.progress) / 100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {installingState.progress >= 100 ? (
                    <Check className="w-10 h-10 text-emerald-500" />
                  ) : (
                    <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">
                      {installingState.progress}<span className="text-lg font-bold">%</span>
                    </span>
                  )}
                </div>
              </div>

              <h4 className="text-lg font-black text-gray-900 dark:text-white mb-2 text-center tracking-tight">
                {isAr ? `تثبيت ${installingState.name}` : `Installing ${installingState.name}`}
              </h4>

              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 text-center font-bold">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
                <span>{installingState.stage}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Apps Grid ─── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="relative h-72 rounded-[2rem] bg-gray-100 dark:bg-dark-800 border border-gray-200/60 dark:border-white/5 overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-dark-800 rounded-[2.5rem] border border-gray-200/70 dark:border-white/5 p-8 shadow-sm">
          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {isAr ? 'لم يتم العثور على نتائج' : 'No modules found'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {isAr ? 'يرجى تجربة البحث بكلمات أخرى أو تغيير التصنيف.' : 'Try adjusting your search terms or filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((app) => {
            const isInstalled = app.isInstalled;
            const isCurrentlyInstalling = installingState?.appId === app.appId;

            return (
              <motion.div
                key={app.appId}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(0.03 * (filtered.indexOf(app) % 12), 0.3) }}
                className="group relative"
                onClick={() => setSelectedAppId(app.appId)}
              >
                {/* Premium gradient glow ring on hover */}
                <div
                  className={`absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[2px] pointer-events-none ${
                    isInstalled
                      ? 'bg-gradient-to-br from-emerald-400/50 via-emerald-500/20 to-transparent'
                      : 'bg-gradient-to-br from-primary-400/50 via-purple-400/30 to-transparent'
                  }`}
                />
                <div
                  className={`relative bg-white dark:bg-dark-800/90 rounded-[2rem] border transition-all duration-300 flex flex-col p-6 cursor-pointer shadow-sm group-hover:shadow-2xl group-hover:-translate-y-1.5 h-full ${
                    isInstalled
                      ? 'border-emerald-500/30 group-hover:border-emerald-500/60'
                      : 'border-gray-200/80 dark:border-white/5 group-hover:border-primary-500/40'
                  }`}
                >
                {/* Top Row: 3D Icon & Status Badges */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="relative w-16 h-16 rounded-2xl bg-gray-50 dark:bg-dark-700/60 border border-gray-100 dark:border-white/10 p-2.5 shrink-0 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform duration-300">
                    <App3DIcon
                      appId={app.appId}
                      icon={app.icon}
                      path={app.defaultRoute}
                      label={app.nameEn}
                      className="w-full h-full drop-shadow-md"
                    />
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {app.badge && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                        {app.badge}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${pricing(app.pricingTier).color}`}>
                      {isAr ? pricing(app.pricingTier).ar : pricing(app.pricingTier).en}
                    </span>
                  </div>
                </div>

                {/* App Title & Version */}
                <div className="mb-2">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1 tracking-tight">
                    {isAr ? app.nameAr : app.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 font-medium">
                    <span>{app.downloadSize || '4.8 MB'}</span>
                    <span>•</span>
                    <span>v{app.version || '2.5.0'}</span>
                    <span>•</span>
                    <span className="text-gray-500 dark:text-gray-400 font-bold">{app.author || 'Maqder Core'}</span>
                  </div>
                </div>

                {/* Description Tagline */}
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed font-medium flex-1">
                  {isAr ? app.taglineAr : app.taglineEn}
                </p>

                {/* Features Mini Checklist */}
                <div className="space-y-1.5 mb-5 bg-gray-50/70 dark:bg-dark-900/40 p-3 rounded-xl border border-gray-100 dark:border-white/5">
                  {(isAr ? app.featuresAr : app.featuresEn)?.slice(0, 2).map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 font-medium truncate">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between mt-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg" title={`${(app.rating || 4.9).toFixed(1)} / 5`}>
                    <div className="flex items-center -space-x-0.5 rtl:space-x-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${star <= Math.round(app.rating || 4.9) ? 'text-amber-500 fill-amber-500' : 'text-gray-300 dark:text-gray-600 fill-gray-300 dark:fill-gray-600'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-black text-amber-700 dark:text-amber-300">
                      {app.rating?.toFixed(1) || '4.9'}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      ({app.reviewsCount || 48})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isInstalled ? (
                      <>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{isAr ? 'مثبت' : 'Installed'}</span>
                        </span>

                        {app.defaultRoute && (
                          <button
                            onClick={() => navigate(app.defaultRoute)}
                            title={isAr ? 'فتح مساحة العمل' : 'Launch Workspace'}
                            className="p-2 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-500/10 rounded-xl transition-all"
                          >
                            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                          </button>
                        )}

                        <button
                          onClick={() => setUninstallConfirmApp(app)}
                          title={isAr ? 'إلغاء التثبيت' : 'Uninstall'}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStartInstall(app)}
                        disabled={isCurrentlyInstalling || installMutation.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-black shadow-sm transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isCurrentlyInstalling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{isAr ? 'تثبيت...' : 'Installing'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>{isAr ? 'تثبيت' : 'Install'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
              onClick={() => setSelectedAppId(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: isAr ? -450 : 450 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? -450 : 450 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className={`fixed top-0 bottom-0 ${isAr ? 'left-0' : 'right-0'} w-full sm:w-[500px] bg-white dark:bg-dark-800 shadow-2xl z-[80] overflow-hidden flex flex-col border-s border-gray-200 dark:border-white/10`}
            >
              {/* Drawer Top Header */}
              <div className="relative p-6 sm:p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-dark-900/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 p-3 shadow-sm flex items-center justify-center shrink-0">
                      <App3DIcon
                        appId={detailApp.appId}
                        icon={detailApp.icon}
                        path={detailApp.defaultRoute}
                        label={detailApp.nameEn}
                        className="w-full h-full drop-shadow-md"
                      />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                        {isAr ? detailApp.nameAr : detailApp.nameEn}
                      </h2>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">
                        {detailApp.author || 'Maqder Core'} • v{detailApp.version || '2.5.0'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${pricing(detailApp.pricingTier).color}`}>
                          {isAr ? pricing(detailApp.pricingTier).ar : pricing(detailApp.pricingTier).en}
                        </span>
                        {detailApp.badge && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                            {detailApp.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedAppId(null)}
                    className="p-2 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Metrics Bar */}
              <div className="px-6 sm:px-8 py-3 bg-white dark:bg-dark-800 border-b border-gray-100 dark:border-white/5 flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-primary-500" />
                  <span>{detailApp.downloadSize || '4.8 MB'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>{detailApp.rating?.toFixed(1) || '4.9'} ({detailApp.reviewsCount || 48} {isAr ? 'تقييم' : 'reviews'})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe2 className="w-4 h-4 text-blue-500" />
                  <span>{isAr ? 'سحابي' : 'Cloud Sync'}</span>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                    {isAr ? 'نظرة عامة والوصف' : 'Overview & Architecture'}
                  </h4>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
                    {isAr ? detailApp.descriptionAr : detailApp.descriptionEn}
                  </p>
                </div>

                {(isAr ? detailApp.featuresAr : detailApp.featuresEn)?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                      {isAr ? 'القدرات والميزات الرئيسية' : 'Key Capabilities & Workflows'}
                    </h4>
                    <div className="space-y-2.5">
                      {(isAr ? detailApp.featuresAr : detailApp.featuresEn).map((feature, i) => (
                        <div key={i} className="flex items-start gap-3 text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200">
                          <div className="mt-0.5 rounded-full bg-emerald-500/10 p-0.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                          </div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compliance & Security */}
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-900/40 border border-gray-100 dark:border-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                    <Lock className="w-4 h-4 text-primary-500" />
                    <span>{isAr ? 'الأمان والصلاحيات' : 'Security & Tenant Isolation'}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    {isAr
                      ? 'يتم تشغيل هذا التطبيق داخل بيئة العمل الخاصة بمنشأتك مع صلاحيات وصول مشفرة بالكامل ومتوافقة مع المعايير السعودية.'
                      : 'This module executes in strict tenant isolation, encrypted per-tenant access tokens, and complies with official Saudi regulatory standards.'}
                  </p>
                </div>
              </div>

              {/* Drawer Bottom Action Bar */}
              <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-dark-800 space-y-3">
                {detailApp.isInstalled ? (
                  <>
                    <div className="flex items-center gap-3">
                      {detailApp.defaultRoute && (
                        <button
                          onClick={() => {
                            setSelectedAppId(null);
                            navigate(detailApp.defaultRoute);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-sm shadow-md hover:bg-gray-800 transition-all active:scale-95"
                        >
                          <span>{isAr ? 'فتح التطبيق' : 'Launch Workspace'}</span>
                          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                        </button>
                      )}

                      {detailApp.configSchema?.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedConfigAppId(detailApp.appId);
                            setConfigForm(detailApp.config || {});
                          }}
                          className="px-5 py-3.5 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 font-bold text-sm transition-all flex items-center gap-2"
                        >
                          <Sliders className="w-4 h-4" />
                          <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setUninstallConfirmApp(detailApp)}
                      className="w-full py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-black text-sm shadow-lg shadow-primary-500/25 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isAr
                        ? `تثبيت التطبيق (${detailApp.downloadSize || '4.8 MB'})`
                        : `Install Module (${detailApp.downloadSize || '4.8 MB'})`}
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setUninstallConfirmApp(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-white/10 z-10 space-y-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  {isAr ? `إلغاء تثبيت ${uninstallConfirmApp.nameAr}؟` : `Uninstall ${uninstallConfirmApp.nameEn}?`}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                  {isAr
                    ? 'سيتم إلغاء تفعيل الوحدة وإخفاؤها من القائمة ومساحة العمل. يمكنك إعادة تثبيتها في أي وقت بضغطة زر واحدة دون فقدان البيانات السابقة.'
                    : 'This module will be deactivated and hidden from your navigation workspace. You can re-install it anytime without losing transaction history.'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setUninstallConfirmApp(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-bold text-xs hover:bg-gray-50 dark:hover:bg-dark-700 transition-all"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => uninstallMutation.mutate(uninstallConfirmApp.appId)}
                  disabled={uninstallMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-md shadow-red-600/25 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {uninstallMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>{isAr ? 'تأكيد الإلغاء' : 'Confirm'}</span>
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
              onClick={() => setSelectedConfigAppId(null)}
            />
            <motion.div
              initial={{ opacity: 0, x: isAr ? -420 : 420 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? -420 : 420 }}
              className={`fixed top-0 bottom-0 ${isAr ? 'left-0' : 'right-0'} w-full sm:w-[440px] bg-white dark:bg-dark-800 shadow-2xl z-[90] overflow-y-auto border-s border-gray-200 dark:border-white/10 flex flex-col`}
            >
              <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-dark-900/40">
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">
                    {isAr ? 'إعدادات التكامل' : 'Integration Settings'}
                  </h3>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-0.5">
                    {isAr ? configApp.nameAr : configApp.nameEn}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedConfigAppId(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
                {configApp.configSchema?.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-200">
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 outline-none transition-all placeholder-gray-400"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-dark-900/40">
                <button
                  onClick={() => saveSettingsMutation.mutate({ appId: configApp.appId, config: configForm })}
                  disabled={saveSettingsMutation.isPending}
                  className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black shadow-md hover:bg-gray-800 transition-all disabled:opacity-50 active:scale-95"
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : isAr ? (
                    'حفظ الإعدادات والتحديث'
                  ) : (
                    'Save Settings & Apply'
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
