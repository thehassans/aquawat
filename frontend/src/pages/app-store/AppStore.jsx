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
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { updateTenant } from '../../store/slices/authSlice';
import { App3DIcon } from '../../components/ui/App3DIcon';
import { invoiceTemplateOptions } from '../../lib/invoiceTemplates';
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview';

const PREMIUM_INVOICE_TEMPLATES_APP_ID = 'premium_invoice_templates';

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
  { id: 'all', en: 'All', ar: 'الكل' },
  { id: 'industry_verticals', en: 'Sales / Verticals', ar: 'المبيعات / القطاعات' },
  { id: 'saudi_compliance', en: 'Accounting / Tax', ar: 'المحاسبة / الضريبة', currencies: ['SAR'] },
  { id: 'bangladesh_compliance', en: 'Tax BD', ar: 'ضريبة BD', currencies: ['BDT'] },
  { id: 'manufacturing', en: 'Manufacturing', ar: 'التصنيع' },
  { id: 'pos_retail', en: 'Point of Sale', ar: 'نقاط البيع' },
  { id: 'hr_manpower', en: 'Human Resources', ar: 'الموارد البشرية' },
  { id: 'hardware_iot', en: 'Productivity', ar: 'الإنتاجية' },
  { id: 'finance_accounting', en: 'Accounting', ar: 'المحاسبة' },
  { id: 'automation_comm', en: 'Marketing / Automation', ar: 'التسويق / الأتمتة' },
];

function appMatchesCategory(app, categoryId) {
  if (categoryId === 'all') return true;
  if (categoryId === 'industry_verticals') {
    return (
      app.category === 'industry_verticals' ||
      app.category === 'industry_vertical' ||
      app.appType === 'core_vertical' ||
      app.appType === 'industry_vertical' ||
      ['manufacturing', 'boutique', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'manpower', 'bakala', 'trading'].some(
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
    return app.category === 'finance_accounting' || app.appId.includes('landed') || app.appId.includes('vat');
  }
  if (categoryId === 'hardware_iot') {
    return app.category === 'hardware_iot' || app.appType === 'hardware_integration' || app.appId.includes('iot') || app.appId.includes('terminal') || app.appId.includes('printer') || app.appId.includes('scale');
  }
  if (categoryId === 'pos_retail') {
    return app.category === 'pos_retail' || app.appId.includes('delivery') || app.appId.includes('retail') || app.appId.includes('restaurant') || app.appId.includes('bakala');
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
  if (categoryId === 'automation_comm') {
    return app.category === 'automation_comm' || app.category === 'ai_intelligence' || app.appId.includes('whatsapp') || app.appId.includes('ai') || app.appId.includes('shipping') || app.appId.includes('email');
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
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [selectedConfigAppId, setSelectedConfigAppId] = useState(null);
  const [configForm, setConfigForm] = useState({});
  const [uninstallConfirmApp, setUninstallConfirmApp] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(() => Number(tenant?.settings?.invoicePdfTemplate) || 1);
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
    const amount = cycle === 'yearly' ? Number(app?.yearlyPrice || 0) : Number(app?.monthlyPrice || 0);
    if (!amount) return null;
    return `${storeCurrency} ${amount.toFixed(amount % 1 ? 2 : 0)}${cycle === 'yearly' ? (isAr ? '/سنة' : '/yr') : (isAr ? '/شهر' : '/mo')}`;
  }, [billingCycle, storeCurrency, isAr]);

  const appNeedsPayment = useCallback((app) => {
    if (!app || app.isInstalled) return false;
    if (app.includedInCurrentPlan) return false;
    if (app.requiresPayment === false) return false;
    if (app.requiresPayment) return true;
    const tier = String(app.pricingTier || 'free').toLowerCase();
    if (tier === 'free') return false;
    const amount = billingCycle === 'yearly' ? Number(app.yearlyPrice || 0) : Number(app.monthlyPrice || 0);
    return amount > 0;
  }, [billingCycle]);

  const apps = useMemo(() => data?.apps || [], [data?.apps]);

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

  const saveTemplateMutation = useMutation({
    mutationFn: (templateId) => api.put('/tenants/current', {
      settings: { ...(tenant?.settings || {}), invoicePdfTemplate: templateId },
    }),
    onSuccess: (res) => {
      const updatedTenant = res.data;
      if (updatedTenant?.settings) dispatch(updateTenant(updatedTenant));
      toast.success(isAr ? 'تم تحديث القالب الافتراضي' : 'Default template updated');
      queryClient.invalidateQueries(['tenant-settings']);
      refreshTenant();
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل حفظ القالب' : 'Failed to save template')),
  });

  // Keep the picker in sync with the tenant's current default whenever the
  // templates app detail drawer is (re)opened.
  useEffect(() => {
    if (selectedAppId === PREMIUM_INVOICE_TEMPLATES_APP_ID) {
      setSelectedTemplateId(Number(tenant?.settings?.invoicePdfTemplate) || 1);
    }
  }, [selectedAppId, tenant?.settings?.invoicePdfTemplate]);

  // Handle interactive animated installation
  const handleStartInstall = useCallback((app) => {
    if (installingState) return;

    setInstallingState({
      appId: app.appId,
      name: isAr ? app.nameAr : app.nameEn,
      size: app.downloadSize || '5.2 MB',
      progress: 15,
      stage: appNeedsPayment(app)
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

      const matchCat = appMatchesCategory(app, activeCategory);
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

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-950 font-sans selection:bg-primary-500/20">
      {/* ─── Categories Sidebar ─── */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-e border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900">
        <div className="px-4 py-5 border-b border-gray-100 dark:border-white/5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {isAr ? 'التصنيفات' : 'Categories'}
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {visibleCategories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = categoryCounts[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 font-semibold'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <span className="truncate text-start">{isAr ? cat.ar : cat.en}</span>
                <span className={`text-xs tabular-nums shrink-0 ${isActive ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── Main ─── */}
      <main className="flex-1 min-w-0 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
              {isAr ? 'التطبيقات' : 'Apps'}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-2.5 py-1.5 ${billingCycle === 'monthly' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300'}`}
                >
                  {isAr ? 'شهري' : 'Monthly'}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-2.5 py-1.5 ${billingCycle === 'yearly' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300'}`}
                >
                  {isAr ? 'سنوي' : 'Yearly'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowInstalledOnly(!showInstalledOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  showInstalledOnly
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                {isAr ? 'المثبتة' : 'Installed'}
                <span className="text-gray-400 dark:text-gray-500 tabular-nums">{installedCount}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'بحث…' : 'Search…'}
                className="w-full ps-9 pe-9 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-800 text-xs font-medium text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-primary-500/20 self-start sm:self-auto"
            >
              <option value="featured">{isAr ? 'المميز' : 'Featured'}</option>
              <option value="rating">{isAr ? 'التقييم' : 'Rating'}</option>
              <option value="name">{isAr ? 'الاسم' : 'Name'}</option>
            </select>
          </div>

          {/* Mobile category chips */}
          <div className="flex md:hidden gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {visibleCategories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
                    isActive
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10'
                  }`}
                >
                  {isAr ? cat.ar : cat.en}
                  <span className="ms-1.5 opacity-70">{categoryCounts[cat.id] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Apps Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/5">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {isAr ? 'لم يتم العثور على نتائج' : 'No apps found'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {isAr ? 'جرّب كلمات بحث أخرى أو غيّر التصنيف.' : 'Try another search or category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((app) => {
              const isInstalled = app.isInstalled;
              const isCurrentlyInstalling = installingState?.appId === app.appId;
              const priceHint = formatAppPrice(app);

              return (
                <div
                  key={app.appId}
                  className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-white/10 p-4 flex flex-col gap-3 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-white/10 p-1.5 shrink-0 flex items-center justify-center">
                      <App3DIcon
                        appId={app.appId}
                        icon={app.icon}
                        path={app.defaultRoute}
                        label={app.nameEn}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {isAr ? app.nameAr : app.nameEn}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {isAr ? app.taglineAr : app.taglineEn}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    {isInstalled ? (
                      <>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {isAr ? 'مثبت' : 'Installed'}
                        </span>
                        {app.defaultRoute && (
                          <button
                            type="button"
                            onClick={() => navigate(app.defaultRoute)}
                            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-0.5"
                          >
                            {isAr ? 'فتح' : 'Open'}
                            <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setUninstallConfirmApp(app)}
                          disabled={uninstallMutation.isPending}
                          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          {isAr ? 'إلغاء التثبيت' : 'Uninstall'}
                        </button>
                      </>
                    ) : (
                      <>
                        {app.includedInCurrentPlan ? (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {isAr ? 'مشمول في باقتك' : 'Included in your plan'}
                          </span>
                        ) : (
                          priceHint && appNeedsPayment(app) && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                              {priceHint}
                            </span>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartInstall(app)}
                          disabled={isCurrentlyInstalling || installMutation.isPending}
                          className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50"
                        >
                          {isCurrentlyInstalling ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            isAr ? 'تفعيل' : 'Activate'
                          )}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedAppId(app.appId)}
                      className="ms-auto text-xs text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      {isAr ? 'معلومات الوحدة' : 'Module info'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

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

                {detailApp.appId === PREMIUM_INVOICE_TEMPLATES_APP_ID && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                      {isAr ? 'اختر القالب الافتراضي' : 'Choose Your Default Template'}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {invoiceTemplateOptions.map((tpl) => {
                        const isLocked = tpl.id > 1 && !detailApp.isInstalled;
                        const isSelected = selectedTemplateId === tpl.id;
                        return (
                          <button
                            type="button"
                            key={tpl.id}
                            onClick={() => {
                              if (isLocked) {
                                toast.error(isAr
                                  ? 'ثبّت هذه الإضافة لاستخدام هذا القالب'
                                  : 'Install this add-on to use this template');
                                return;
                              }
                              setSelectedTemplateId(tpl.id);
                            }}
                            className={`relative text-start rounded-2xl border-2 transition-all p-3 ${isSelected ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'} ${isLocked ? 'opacity-60' : ''}`}
                          >
                            {isLocked && (
                              <span className="absolute top-2 end-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-900/80 text-white dark:bg-white/10">
                                <Lock className="w-2.5 h-2.5" />
                              </span>
                            )}
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-gray-900 dark:text-white">{isAr ? tpl.nameAr : tpl.nameEn}</span>
                              {!isLocked && (
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary-500' : 'border-gray-300 dark:border-white/20'}`}>
                                  {isSelected && <div className="w-2 h-2 bg-primary-500 rounded-full" />}
                                </div>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{isAr ? tpl.descriptionAr : tpl.descriptionEn}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="border border-gray-200 dark:border-white/10 rounded-2xl p-3 bg-gray-50/50 dark:bg-dark-900/40 mb-4">
                      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2">{isAr ? 'معاينة مباشرة' : 'Live Preview'}</p>
                      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-dark-950 p-3 flex justify-center h-[360px] overflow-y-auto relative custom-scrollbar">
                        <div className="origin-top scale-[0.32] transition-all" style={{ width: '1000px' }}>
                          <div className="pointer-events-none shadow-2xl bg-white">
                            <InvoiceLivePreview
                              invoice={{
                                invoiceNumber: 'INV-2026-001',
                                issueDate: new Date(),
                                grandTotal: 1150,
                                totalTax: 150,
                                subtotal: 1000,
                                totalDiscount: 0,
                                currency: tenant?.settings?.currency || 'SAR',
                                buyer: { name: 'Acme Corp', nameAr: 'شركة أكامي', vatNumber: '310000000000003' },
                                seller: { name: tenant?.business?.legalNameEn || 'My Company', nameAr: tenant?.business?.legalNameAr || 'شركتي', vatNumber: tenant?.business?.vatNumber || '300000000000003' },
                                lines: [
                                  { raw: { productName: 'Professional Services', productNameAr: 'خدمات احترافية' }, quantity: 1, unitPrice: 1000, lineTotalWithTax: 1150, taxAmount: 150 }
                                ]
                              }}
                              tenant={{
                                ...tenant,
                                settings: { ...tenant?.settings, invoicePdfTemplate: selectedTemplateId },
                              }}
                              templateId={selectedTemplateId}
                              language={language}
                              bilingual={true}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={saveTemplateMutation.isPending || selectedTemplateId === Number(tenant?.settings?.invoicePdfTemplate || 1)}
                      onClick={() => saveTemplateMutation.mutate(selectedTemplateId)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-sm shadow-md hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {saveTemplateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>{isAr ? 'تطبيق كقالب افتراضي' : 'Apply as Default Template'}</span>
                    </button>
                  </div>
                )}

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
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-black text-sm shadow-lg shadow-primary-500/25 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span>
                      {appNeedsPayment(detailApp)
                        ? (isAr
                          ? `تفعيل ${formatAppPrice(detailApp) ? `(${formatAppPrice(detailApp)})` : ''}`
                          : `Activate ${formatAppPrice(detailApp) ? `(${formatAppPrice(detailApp)})` : ''}`)
                        : (isAr ? 'تفعيل' : 'Activate')}
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
