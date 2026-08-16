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
  Trash2,
  Sliders,
  HardDrive,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Globe2,
  Lock,
  Sparkles,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { updateTenant } from '../../store/slices/authSlice';
import { App3DIcon } from '../../components/ui/App3DIcon';
import { invoiceTemplateOptions } from '../../lib/invoiceTemplates';
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview';
import {
  getAppStoreMarketCopy,
  pickRecommendedApps,
  sortAppsForMarket,
} from '../../lib/appStoreMarket';
import {
  formatMoneyAmount,
  resolveAppPrices,
  yearlySavingsPercent,
} from '../../lib/appStorePricing';

const PREFERRED_TABBY_APP_ID = 'tabby_bnpl';
const PREFERRED_TAMARA_APP_ID = 'tamara_bnpl';

const PRICING_LABELS = {
  free: {
    en: 'Included',
    ar: 'مشمول',
    color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
  },
  paid: {
    en: 'Pro Add-on',
    ar: 'إضافي Pro',
    color: 'text-amber-800 dark:text-amber-300 bg-amber-500/10 border-amber-500/20'
  },
  enterprise: {
    en: 'Enterprise',
    ar: 'مؤسسي',
    color: 'text-slate-700 dark:text-slate-300 bg-slate-500/10 border-slate-500/20'
  },
};

function BillingCycleToggle({ value, onChange, isAr, size = 'md' }) {
  const compact = size === 'sm';
  return (
    <div
      className={`inline-flex items-center rounded-2xl border border-slate-200/90 bg-white/90 shadow-[0_10px_32px_-20px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-dark-800 ${
        compact ? 'p-0.5' : 'p-1'
      }`}
    >
      {['monthly', 'yearly'].map((cycle) => {
        const active = value === cycle;
        return (
          <button
            key={cycle}
            type="button"
            onClick={() => onChange(cycle)}
            className={`relative inline-flex items-center gap-1.5 rounded-xl font-bold tracking-wide transition ${
              compact ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
            } ${
              active
                ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {cycle === 'monthly' ? (isAr ? 'شهري' : 'Monthly') : (isAr ? 'سنوي' : 'Yearly')}
            {cycle === 'yearly' && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  active
                    ? 'bg-emerald-400/20 text-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-800'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                }`}
              >
                {isAr ? 'شهرين مجاناً' : '2 mo free'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const CATEGORIES = [
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'industry_verticals', en: 'Verticals', ar: 'القطاعات' },
  { id: 'saudi_compliance', en: 'Saudi Tax', ar: 'ضريبة السعودية', currencies: ['SAR'] },
  { id: 'bangladesh_compliance', en: 'BD Tax', ar: 'ضريبة BD', currencies: ['BDT'] },
  { id: 'pakistan_compliance', en: 'Pakistan Tax', ar: 'ضريبة باكستان', currencies: ['PKR'] },
  { id: 'manufacturing', en: 'Manufacturing', ar: 'التصنيع' },
  { id: 'pos_retail', en: 'Point of Sale', ar: 'نقاط البيع' },
  { id: 'hr_manpower', en: 'Human Resources', ar: 'الموارد البشرية' },
  { id: 'hardware_iot', en: 'Hardware', ar: 'الأجهزة' },
  { id: 'logistics', en: 'Logistics', ar: 'الشحن' },
  { id: 'delivery_platforms', en: 'Delivery Platforms', ar: 'منصات التوصيل' },
  { id: 'finance_accounting', en: 'Finance', ar: 'المالية' },
  { id: 'automation_comm', en: 'Marketing', ar: 'التسويق' },
  { id: 'invoice_templates', en: 'Invoice Templates', ar: 'قوالب الفواتير' },
];

function appMatchesCategory(app, categoryId) {
  if (categoryId === 'all') return true;
  if (categoryId === 'industry_verticals') {
    return (
      app.category === 'industry_verticals' ||
      app.category === 'industry_vertical' ||
      app.appType === 'core_vertical' ||
      app.appType === 'industry_vertical' ||
      ['manufacturing', 'boutique', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'manpower', 'bakala', 'pharmacy', 'trading'].some(
        (v) => app.appId.includes(v)
      )
    );
  }
  if (categoryId === 'hr_manpower') {
    return app.category === 'hr_manpower' || app.appId.includes('hr') || app.appId.includes('fleet') || app.appId.includes('crm') || app.appId.includes('gosi') || app.appId.includes('manpower');
  }
  if (categoryId === 'manufacturing') {
    return app.category === 'manufacturing' || app.appId.includes('manufacturing');
  }
  if (categoryId === 'finance_accounting') {
    return app.category === 'finance_accounting' || app.appId.includes('vat') || app.appId.includes('tabby') || app.appId.includes('tamara') || app.appId.includes('bnpl');
  }
  if (categoryId === 'hardware_iot') {
    return app.category === 'hardware_iot' || app.appType === 'hardware_integration' || app.appId.includes('iot') || app.appId.includes('terminal') || app.appId.includes('printer') || app.appId.includes('scale');
  }
  if (categoryId === 'pos_retail') {
    if (app.category === 'delivery_platforms' || app.category === 'logistics') return false
    return app.category === 'pos_retail' || app.appId.includes('retail') || app.appId.includes('restaurant') || app.appId.includes('bakala') || app.appId.includes('pharmacy')
  }
  if (categoryId === 'logistics') {
    return app.category === 'logistics' || app.appId.includes('shipping') || app.appId.includes('smsa') || app.appId.includes('aramex') || app.appId.includes('jnt') || app.appId.includes('naqel') || app.appId.includes('imile') || app.appId.includes('spl') || app.appId.includes('fedex') || app.appId.includes('dhl') || app.appId.includes('ups') || app.appId.includes('tnt')
  }
  if (categoryId === 'delivery_platforms') {
    return app.category === 'delivery_platforms' || app.appId.includes('_delivery') || app.appId === 'delivery_platforms'
  }
  if (categoryId === 'saudi_compliance') {
    return (
      app.category === 'saudi_compliance' ||
      app.appId.includes('zatca') ||
      app.appId.includes('gosi') ||
      app.appId.includes('elm') ||
      app.appId.includes('qiwa') ||
      app.appId.includes('balady') ||
      app.appId.includes('saber') ||
      app.appId.includes('etimad') ||
      app.appId.includes('tamm')
    );
  }
  if (categoryId === 'bangladesh_compliance') {
    return (
      app.category === 'bangladesh_compliance' ||
      app.appId.includes('nbr') ||
      app.appId.includes('bangladesh') ||
      app.appId.includes('mushak')
    );
  }
  if (categoryId === 'pakistan_compliance') {
    return (
      app.category === 'pakistan_compliance' ||
      app.appId.includes('fbr') ||
      app.appId.includes('pakistan')
    );
  }
  if (categoryId === 'automation_comm') {
    if (app.category === 'logistics' || app.category === 'delivery_platforms') return false
    return app.category === 'automation_comm' || app.category === 'ai_intelligence' || app.appId.includes('whatsapp') || app.appId.includes('ai') || app.appId.includes('email')
  }
  if (categoryId === 'invoice_templates') {
    return app.category === 'invoice_templates' || app.appType === 'invoice_template'
  }
  return false;
}

export default function AppStore() {
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const tenantCurrency = String(tenant?.settings?.currency || 'SAR').trim().toUpperCase();
  const visibleCategories = useMemo(
    () => CATEGORIES.filter((cat) => !cat.currencies || cat.currencies.includes(tenantCurrency)),
    [tenantCurrency]
  );

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [sortBy, setSortBy] = useState('featured'); // 'featured', 'rating', 'name'
  const [selectedConfigAppId, setSelectedConfigAppId] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [uninstallConfirmApp, setUninstallConfirmApp] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly'); // for paid app pricing display / checkout

  // Animated Installation State: { appId, name, size, progress, stage }
  const [installingState, setInstallingState] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((r) => r.data),
  });

  const paymentsMeta = data?.payments || {};
  const storeCurrency = String(paymentsMeta.currency || tenantCurrency || 'SAR').toUpperCase();

  const formatAppPrice = useCallback((app, cycle = billingCycle) => {
    const { monthly, yearly } = resolveAppPrices(app);
    const amount = cycle === 'yearly' ? yearly : monthly;
    const money = formatMoneyAmount(amount, storeCurrency);
    if (!money) return null;
    return `${money}${cycle === 'yearly' ? (isAr ? '/سنة' : '/yr') : (isAr ? '/شهر' : '/mo')}`;
  }, [billingCycle, storeCurrency, isAr]);

  const appNeedsPayment = useCallback((app) => {
    if (!app || app.isInstalled) return false;
    if (app.includedInCurrentPlan) return false;
    if (app.trialEligible) return false;
    if (app.trialActive) return false;
    if (app.requiresPayment === false) return false;
    if (app.requiresPayment) return true;
    const tier = String(app.pricingTier || 'free').toLowerCase();
    if (tier === 'free') return false;
    const { monthly, yearly } = resolveAppPrices(app);
    return (billingCycle === 'yearly' ? yearly : monthly) > 0;
  }, [billingCycle]);

  const apps = useMemo(() => data?.apps || [], [data?.apps]);

  // We don't need detailApp anymore, we use a separate route

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
    mutationFn: (appId) => api.post(`/app-store/apps/${appId}/install`, { billingCycle }),
    onSuccess: (res) => {
      const updatedTenant = res.data?.tenant || res.data;
      if (updatedTenant?.settings) {
        dispatch(updateTenant(updatedTenant));
      }
      queryClient.invalidateQueries(['app-store-apps']);
      refreshTenant();
    },
    onError: async (err) => {
      const payload = err.response?.data;
      if (err.response?.status === 402 || payload?.requiresPayment) {
        try {
          const checkout = await api.post(`/app-store/apps/${payload.appId || installingState?.appId}/checkout`, { billingCycle });
          if (checkout.data?.url) {
            window.location.href = checkout.data.url;
            return;
          }
        } catch (checkoutErr) {
          setInstallingState(null);
          toast.error(checkoutErr.response?.data?.error || (isAr ? 'تعذر بدء الدفع عبر Stripe' : 'Could not start Stripe checkout'));
          return;
        }
      }
      setInstallingState(null);
      toast.error(payload?.error || (isAr ? 'فشل التثبيت' : 'Installation failed'));
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ appId, cycle }) => api.post(`/app-store/apps/${appId}/checkout`, { billingCycle: cycle || billingCycle }),
    onSuccess: (res) => {
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error(isAr ? 'لم يتم إرجاع رابط الدفع' : 'No checkout URL returned');
      setInstallingState(null);
    },
    onError: (err) => {
      setInstallingState(null);
      toast.error(err.response?.data?.error || (isAr ? 'فشل الدفع' : 'Checkout failed'));
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
      stage: app.trialEligible
        ? (isAr ? 'جاري بدء الفترة التجريبية…' : 'Starting your free trial…')
        : appNeedsPayment(app)
        ? (isAr ? 'جاري فتح بوابة Stripe…' : 'Opening Stripe checkout…')
        : (isAr ? 'جاري الاتصال بالسحابة وتحميل الحزمة...' : 'Initiating secure package download...')
    });

    if (appNeedsPayment(app)) {
      checkoutMutation.mutate({ appId: app.appId, cycle: billingCycle });
      return;
    }

    installMutation.mutate(app.appId);
  }, [installingState, installMutation, checkoutMutation, isAr, appNeedsPayment, billingCycle]);

  // Confirm Stripe return from App Store paid install
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get('paid');
    const sessionId = params.get('session_id');
    const appId = params.get('appId');
    const canceled = params.get('canceled');
    if (canceled === '1') {
      toast.error(isAr ? 'تم إلغاء الدفع' : 'Payment canceled');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    if (paid !== '1' || !sessionId || !appId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.post(`/app-store/apps/${appId}/confirm-payment`, { sessionId });
        if (cancelled) return;
        if (res.data?.tenant) dispatch(updateTenant(res.data.tenant));
        queryClient.invalidateQueries(['app-store-apps']);
        toast.success(isAr ? 'تم الدفع وتثبيت التطبيق بنجاح' : 'Payment successful — app installed');
      } catch (err) {
        if (!cancelled) {
          toast.error(err.response?.data?.error || (isAr ? 'تعذر تأكيد الدفع' : 'Could not confirm payment'));
        }
      } finally {
        window.history.replaceState({}, '', window.location.pathname);
      }
    })();

    return () => { cancelled = true };
  }, [dispatch, isAr, queryClient]);

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
          newStage = isAr ? 'التحقق من الحزم والترخيص...' : 'Verifying packages and license...';
        } else if (prev.progress < 95) {
          newProgress += 12;
          newStage = isAr ? 'تهيئة صلاحيات المنشأة وقواعد البيانات...' : 'Provisioning database schemas & permissions...';
        } else {
          newProgress = 100;
          newStage = isAr ? 'اكتمل التثبيت بنجاح!' : 'Ready to use';
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

  // Filtering & Sorting — market preference first (ZATCA not for PK/BD)
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

      const matchCat = appMatchesCategory(app, activeCategory);
      const matchInstalled = !showInstalledOnly || app.isInstalled;
      return matchSearch && matchCat && matchInstalled;
    });

    if (sortBy === 'rating') {
      result = sortAppsForMarket(result, tenant, 'rating');
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => (isAr ? a.nameAr.localeCompare(b.nameAr) : a.nameEn.localeCompare(b.nameEn)));
    } else {
      result = sortAppsForMarket(result, tenant, 'featured');
    }

    return result;
  }, [apps, search, activeCategory, showInstalledOnly, sortBy, isAr, tenant]);

  const marketCopy = useMemo(() => getAppStoreMarketCopy(tenant, language), [tenant, language]);

  const recommendedApps = useMemo(() => {
    if (search.trim() || showInstalledOnly || activeCategory !== 'all') return [];
    return pickRecommendedApps(apps, tenant, 6);
  }, [apps, tenant, search, showInstalledOnly, activeCategory]);

  const catalogApps = useMemo(() => {
    if (!recommendedApps.length) return filtered;
    const preferredIds = new Set(recommendedApps.map((a) => a.appId));
    return filtered.filter((a) => !preferredIds.has(a.appId));
  }, [filtered, recommendedApps]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const cat of visibleCategories) {
      counts[cat.id] = apps.filter((app) => appMatchesCategory(app, cat.id)).length;
    }
    return counts;
  }, [apps, visibleCategories]);

  const installedCount = useMemo(() => apps.filter((a) => a.isInstalled).length, [apps]);
  const pricing = (tier) => PRICING_LABELS[tier] || PRICING_LABELS.free;

  // Reset category if currency-hidden category was active
  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === activeCategory)) {
      setActiveCategory('all');
    }
  }, [visibleCategories, activeCategory]);

  const renderAppCard = (app, { featured = false } = {}) => {
    const isInstalled = app.isInstalled;
    const isCurrentlyInstalling = installingState?.appId === app.appId;
    const { monthly, yearly } = resolveAppPrices(app);
    const paid = appNeedsPayment(app);
    const activeAmount = billingCycle === 'yearly' ? yearly : monthly;
    const money = formatMoneyAmount(activeAmount, storeCurrency);
    const savings = yearlySavingsPercent(monthly, yearly);
    const yearlyMonthly = yearly > 0 ? yearly / 12 : 0;

    return (
      <motion.div
        key={app.appId}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group flex flex-col gap-4 rounded-[1.35rem] border bg-white/90 p-4 backdrop-blur-sm transition-all duration-300 dark:bg-dark-800/90 ${
          featured
            ? 'border-emerald-200/80 shadow-[0_22px_50px_-28px_rgba(5,150,105,0.5)] dark:border-emerald-500/25'
            : 'border-slate-200/80 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:hover:border-white/20'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-dark-700">
            <App3DIcon
              appId={app.appId}
              icon={app.icon}
              path={app.defaultRoute}
              label={app.nameEn}
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {isAr ? app.nameAr : app.nameEn}
              </h3>
              {featured && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {isAr ? 'موصى' : 'For you'}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              {isAr ? app.taglineAr : app.taglineEn}
            </p>
          </div>
        </div>

        <div className="mt-auto border-t border-slate-100 pt-3 dark:border-white/5">
          {isInstalled ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Check className="h-3 w-3" />
                {isAr ? 'مثبت' : 'Installed'}
              </span>
              {app.trialActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  <Clock className="h-3 w-3" />
                  {isAr ? `تجربة · ${app.trialDaysRemaining} يوم` : `Trial · ${app.trialDaysRemaining}d left`}
                </span>
              )}
              {app.defaultRoute && (
                <button
                  type="button"
                  onClick={() => navigate(app.defaultRoute)}
                  className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                >
                  {isAr ? 'فتح' : 'Open'}
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setUninstallConfirmApp(app)}
                disabled={uninstallMutation.isPending}
                className="inline-flex items-center gap-0.5 text-[12px] font-medium text-red-600 hover:underline dark:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
                {isAr ? 'إلغاء' : 'Remove'}
              </button>
              <button
                onClick={() => navigate(`/app/dashboard/app-store/${app.appId}`)}
                className="ms-auto text-[12px] text-slate-400 transition hover:text-emerald-700 dark:hover:text-emerald-300"
              >
                {isAr ? 'التفاصيل' : 'Details'}
              </button>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                {app.includedInCurrentPlan ? (
                  <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {isAr ? 'مشمول في باقتك' : 'Included in plan'}
                  </p>
                ) : paid && money ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[22px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {money}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {billingCycle === 'yearly' ? (isAr ? '/سنة' : '/yr') : (isAr ? '/شهر' : '/mo')}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && savings > 0 ? (
                      <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {formatMoneyAmount(yearlyMonthly, storeCurrency)}{isAr ? '/شهر' : '/mo'} · {isAr ? `وفّر ${savings}%` : `Save ${savings}%`}
                      </p>
                    ) : billingCycle === 'monthly' && yearly > 0 ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {isAr ? `أو ${formatMoneyAmount(yearly, storeCurrency)}/سنة` : `or ${formatMoneyAmount(yearly, storeCurrency)}/yr`}
                      </p>
                    ) : null}
                    {app.trialEligible ? (
                      <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {isAr ? `تجربة مجانية ${app.trialDays || 7} أيام` : `${app.trialDays || 7}-day free trial`}
                      </p>
                    ) : (app.trialUsed || app.trialExpired) ? (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                        {isAr ? 'التجربة مستخدمة — يلزم التفعيل' : 'Trial used — payment required'}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                    {isAr ? 'مشمول' : 'Included'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => navigate(`/app/dashboard/app-store/${app.appId}`)}
                  className="text-[12px] text-slate-400 transition hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  {isAr ? 'التفاصيل' : 'Details'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartInstall(app)}
                  disabled={isCurrentlyInstalling || installMutation.isPending}
                  className="inline-flex items-center rounded-xl bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-emerald-300"
                >
                  {isCurrentlyInstalling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : app.trialEligible ? (isAr ? 'بدء التجربة' : 'Start trial') : (isAr ? 'تفعيل' : 'Activate')}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
        background: 'linear-gradient(165deg, #f7faf8 0%, #eef4f1 45%, #f8fafc 100%)',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-12%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-300/15 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)', backgroundSize: '28px 28px' }} />
      </div>

      <div className="relative mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-6">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {isAr ? 'التصنيفات' : 'Categories'}
            </p>
            <nav className="space-y-1">
              {visibleCategories.map((cat) => {
                const isActive = activeCategory === cat.id;
                const count = categoryCounts[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] transition ${
                      isActive
                        ? 'bg-slate-900 font-semibold text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate text-start">{isAr ? cat.ar : cat.en}</span>
                    <span className={`tabular-nums text-[11px] ${isActive ? 'opacity-70' : 'text-slate-400'}`}>{count}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-8 flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-400/80">
                  {isAr ? 'متجر التطبيقات' : 'App Store'}
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {isAr ? 'تطبيقاتك' : 'Your apps'}
                </h1>
                <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                  {marketCopy.subtitle}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {marketCopy.badge}
                </span>
                <button
                  type="button"
                  onClick={() => setShowInstalledOnly(!showInstalledOnly)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    showInstalledOnly
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'border-slate-200/90 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  {isAr ? 'المثبتة' : 'Installed'}
                  <span className="tabular-nums text-slate-400">{installedCount}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث عن تطبيق…' : 'Search apps…'}
                  className="w-full rounded-2xl border border-slate-200/90 bg-white/80 py-2.5 ps-10 pe-9 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-dark-800 dark:text-white"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <BillingCycleToggle value={billingCycle} onChange={setBillingCycle} isAr={isAr} />
                <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
                  {billingCycle === 'yearly'
                    ? (isAr ? 'ادفع سنوياً واحصل على شهرين مجاناً.' : 'Pay yearly and get 2 months free.')
                    : (isAr ? 'بدّل إلى السنوي لتوفير 17%.' : 'Switch to yearly to save 17%.')}
                </p>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-2xl border border-slate-200/90 bg-white/80 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-dark-800 dark:text-slate-200"
              >
                <option value="featured">{isAr ? 'الموصى به لسوقك' : 'Preferred for you'}</option>
                <option value="rating">{isAr ? 'التقييم' : 'Rating'}</option>
                <option value="name">{isAr ? 'الاسم' : 'Name'}</option>
              </select>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
              {visibleCategories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                      isActive
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                        : 'border-slate-200 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300'
                    }`}
                  >
                    {isAr ? cat.ar : cat.en}
                  </button>
                );
              })}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-slate-200/70 bg-white/70 dark:border-white/5 dark:bg-dark-800" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 py-16 text-center dark:border-white/10 dark:bg-dark-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{isAr ? 'لم يتم العثور على نتائج' : 'No apps found'}</p>
              <p className="mt-1 text-xs text-slate-500">{isAr ? 'جرّب كلمات بحث أخرى أو غيّر التصنيف.' : 'Try another search or category.'}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {recommendedApps.length > 0 && (
                <section>
                  <div className="mb-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700/80 dark:text-emerald-400/80">
                        {marketCopy.eyebrow}
                      </p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {marketCopy.title}
                      </h2>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {recommendedApps.map((app) => renderAppCard(app, { featured: true }))}
                  </div>
                </section>
              )}

              <section>
                {recommendedApps.length > 0 && (
                  <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-400">
                    {isAr ? 'كل التطبيقات' : 'All apps'}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {(recommendedApps.length ? catalogApps : filtered).map((app) => renderAppCard(app))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

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
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-[2.5rem] pointer-events-none" />

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
