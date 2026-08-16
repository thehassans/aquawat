import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { updateTenant } from '../../store/slices/authSlice';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Lock, Star, DownloadCloud, AlertTriangle, ArrowRight, Trash2, Loader2, Sliders, X } from 'lucide-react';
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview';
import { formatMoneyAmount, resolveAppPrices, yearlySavingsPercent } from '../../lib/appStorePricing';
import { App3DIcon as AppIcon } from '../../components/ui/App3DIcon';

export default function AppStoreDetail() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const queryClient = useQueryClient();
  const isAr = language === 'ar';

  const tenantCurrency = String(tenant?.settings?.currency || 'SAR').trim().toUpperCase();

  const [billingCycle, setBillingCycle] = useState('monthly');
  const [installingState, setInstallingState] = useState(null);
  const [uninstallConfirm, setUninstallConfirm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((r) => r.data),
  });

  const apps = useMemo(() => data?.apps || [], [data?.apps]);
  const detailApp = useMemo(() => apps.find((a) => a.appId === appId) || null, [apps, appId]);

  const paymentsMeta = data?.payments || {};
  const storeCurrency = String(paymentsMeta.currency || tenantCurrency || 'SAR').toUpperCase();

  useEffect(() => {
    if (detailApp && detailApp.config) {
      setConfigForm(detailApp.config);
    }
  }, [detailApp]);

  const refreshTenant = useCallback(async () => {
    try {
      const { data: updatedTenant } = await api.get('/auth/me');
      dispatch(updateTenant(updatedTenant));
    } catch (error) {
      console.error('Failed to refresh tenant details', error);
    }
  }, [dispatch]);

  const installMutation = useMutation({
    mutationFn: async ({ billing, skipPayment }) => {
      const res = await api.post(`/app-store/apps/${detailApp.appId}/install`, { billingCycle: billing, skipPayment });
      return res.data;
    },
    onSuccess: (resData) => {
      toast.success(isAr ? `تم تثبيت ${detailApp.nameAr} بنجاح` : `${detailApp.nameEn} installed successfully`);
      queryClient.invalidateQueries(['app-store-apps']);
      refreshTenant();
    },
    onError: (err) => {
      setInstallingState(null);
      toast.error(err.response?.data?.error || (isAr ? 'فشل التثبيت' : 'Installation failed'));
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (billing) => {
      const res = await api.post(`/app-store/apps/${detailApp.appId}/checkout`, { billingCycle: billing });
      return res.data;
    },
    onSuccess: (resData) => {
      if (resData.requiresPayment && resData.url) {
        window.location.href = resData.url;
      }
    },
    onError: (err) => {
      setInstallingState(null);
      toast.error(err.response?.data?.error || 'Checkout failed');
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: () => api.post(`/app-store/apps/${detailApp.appId}/uninstall`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إلغاء التثبيت بنجاح' : 'Uninstalled successfully');
      queryClient.invalidateQueries(['app-store-apps']);
      refreshTenant();
      setUninstallConfirm(false);
    },
    onError: (err) => toast.error(err.response?.data?.error || (isAr ? 'فشل الإلغاء' : 'Failed to uninstall')),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (cfg) => api.put(`/app-store/apps/${detailApp.appId}/config`, { config: cfg }),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ إعدادات التكامل' : 'Integration settings saved');
      queryClient.invalidateQueries(['app-store-apps']);
      refreshTenant();
      setShowConfig(false);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save settings'),
  });

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

  const handleStartInstall = useCallback(async () => {
    if (installingState || !detailApp) return;

    if (appNeedsPayment(detailApp)) {
      setInstallingState({ stage: 'redirecting', progress: 50 });
      checkoutMutation.mutate(billingCycle);
      return;
    }

    setInstallingState({ stage: 'downloading', progress: 15 });
    
    // Simulate premium animated installation
    let p = 15;
    const int = setInterval(() => {
      p += Math.random() * 20;
      if (p >= 90) {
        clearInterval(int);
        setInstallingState({ stage: 'configuring', progress: 95 });
        installMutation.mutate({ billing: billingCycle });
      } else {
        setInstallingState((s) => (s ? { ...s, progress: p } : null));
      }
    }, 400);
  }, [installingState, detailApp, appNeedsPayment, billingCycle, checkoutMutation, installMutation]);


  if (isLoading || !detailApp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const name = isAr ? detailApp.nameAr : detailApp.nameEn;
  const tagline = isAr ? detailApp.taglineAr : detailApp.taglineEn;
  const description = isAr ? detailApp.descriptionAr : detailApp.descriptionEn;
  const features = isAr ? detailApp.featuresAr : detailApp.featuresEn;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-950 text-gray-900 dark:text-white pb-32">
      {/* Hero Header */}
      <div className="relative pt-12 pb-24 overflow-hidden border-b border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-transparent dark:from-primary-900/10 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <button 
            onClick={() => navigate('/app/dashboard/app-store')}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1 rtl:rotate-180" />
            {isAr ? 'العودة للمتجر' : 'Back to App Store'}
          </button>

          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-[2rem] shadow-2xl flex items-center justify-center bg-white dark:bg-dark-800 border border-gray-100 dark:border-white/5 relative overflow-hidden">
              <AppIcon icon={detailApp.icon} className="w-12 h-12 sm:w-16 sm:h-16 text-primary-600 dark:text-primary-400" />
              <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-transparent pointer-events-none" />
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                {detailApp.badge && (
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary-600 bg-primary-100 dark:text-primary-400 dark:bg-primary-900/40 rounded-full">
                    {detailApp.badge}
                  </span>
                )}
                {detailApp.isInstalled && (
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/40 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    {isAr ? 'مثبت' : 'Installed'}
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
                {name}
              </h1>
              <p className="text-sm sm:text-lg text-gray-500 dark:text-gray-400 max-w-3xl leading-relaxed font-medium">
                {tagline}
              </p>
              <div className="text-xs font-bold text-gray-400 pt-1">
                {detailApp.author || 'Maqder Core'} • v{detailApp.version || '1.0.0'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="max-w-6xl mx-auto px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white dark:border-white/10 rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center gap-2">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{isAr ? 'التقييم' : 'Rating'}</span>
            <div className="flex items-center gap-1.5 text-lg font-black text-gray-900 dark:text-white">
              <span>{detailApp.rating || '5.0'}</span>
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white dark:border-white/10 rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center gap-2">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{isAr ? 'الحجم' : 'Size'}</span>
            <div className="flex items-center gap-1.5 text-lg font-black text-gray-900 dark:text-white">
              <span>{detailApp.downloadSize || '5.2 MB'}</span>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white dark:border-white/10 rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center gap-2">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{isAr ? 'المراجعات' : 'Reviews'}</span>
            <div className="flex items-center gap-1.5 text-lg font-black text-gray-900 dark:text-white">
              <span>{(detailApp.reviewsCount || 124).toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-white dark:border-white/10 rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center gap-2">
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{isAr ? 'مزامنة سحابية' : 'Cloud Sync'}</span>
            <div className="flex items-center gap-1.5 text-lg font-black text-emerald-600 dark:text-emerald-400">
              <DownloadCloud className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          
          {detailApp.appType === 'invoice_template' && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                {isAr ? 'معاينة مباشرة' : 'Live Preview'}
              </h3>
              <div className="rounded-[2rem] border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-dark-950 p-6 flex justify-center overflow-x-auto overflow-y-hidden relative custom-scrollbar shadow-inner">
                <div className="origin-top transition-all" style={{ width: '800px', transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                  <div className="pointer-events-none shadow-2xl bg-white rounded-xl overflow-hidden">
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
                        settings: { ...tenant?.settings, invoicePdfTemplate: detailApp.templateId || 1 },
                      }}
                      templateId={detailApp.templateId || 1}
                      language={language}
                      bilingual={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
              {isAr ? 'نظرة عامة والوصف' : 'Overview & Architecture'}
            </h3>
            <p className="text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
              {description}
            </p>
          </div>

          {features?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                {isAr ? 'القدرات والميزات الرئيسية' : 'Key Capabilities & Workflows'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-4 text-sm font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-dark-800 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                    <div className="shrink-0 mt-0.5 rounded-full bg-emerald-500/10 p-1">
                      <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                    </div>
                    <span className="leading-relaxed">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6 rounded-3xl bg-gray-50 dark:bg-dark-900/40 border border-gray-100 dark:border-white/5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Lock className="w-5 h-5 text-primary-500" />
              <span>{isAr ? 'الأمان والصلاحيات' : 'Security & Tenant Isolation'}</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
              {isAr
                ? 'يتم تشغيل هذا التطبيق داخل بيئة العمل الخاصة بمنشأتك مع صلاحيات وصول مشفرة بالكامل ومتوافقة مع المعايير السعودية.'
                : 'This module executes in strict tenant isolation, encrypted per-tenant access tokens, and complies with official regulatory standards.'}
            </p>
          </div>
        </div>

        {/* Sidebar / Sticky Actions */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            
            <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-white/10 space-y-6">
              
              {!detailApp.isInstalled && appNeedsPayment(detailApp) && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'monthly', label: isAr ? 'شهري' : 'Monthly', period: isAr ? 'يُدفع شهرياً' : 'Billed monthly' },
                    { id: 'yearly', label: isAr ? 'سنوي' : 'Yearly', period: isAr ? 'يُدفع سنوياً' : 'Billed yearly' },
                  ].map((plan) => {
                    const active = billingCycle === plan.id;
                    const { monthly, yearly } = resolveAppPrices(detailApp);
                    const amount = plan.id === 'yearly' ? yearly : monthly;
                    const savings = plan.id === 'yearly' ? yearlySavingsPercent(monthly, yearly) : 0;
                    const money = formatMoneyAmount(amount, storeCurrency);

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setBillingCycle(plan.id)}
                        className={`relative rounded-2xl border p-4 text-start transition ${
                          active
                            ? 'border-emerald-400 bg-emerald-50/80 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-dark-900/40'
                        }`}
                      >
                        {plan.id === 'yearly' && savings > 0 && (
                          <span className="absolute -top-2.5 end-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                            {isAr ? `وفّر ${savings}%` : `Save ${savings}%`}
                          </span>
                        )}
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{plan.label}</p>
                        <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 tabular-nums dark:text-white">
                          {money}
                          <span className="ms-1 text-[11px] font-semibold text-slate-400">
                            {plan.id === 'yearly' ? (isAr ? '/سنة' : '/yr') : (isAr ? '/شهر' : '/mo')}
                          </span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {detailApp.isInstalled ? (
                <div className="space-y-3">
                  {detailApp.defaultRoute && (
                    <button
                      onClick={() => navigate(detailApp.defaultRoute)}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-sm shadow-md hover:bg-gray-800 transition-all active:scale-95"
                    >
                      <span>{isAr ? 'فتح مساحة العمل' : 'Launch Workspace'}</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </button>
                  )}
                  {detailApp.configSchema?.length > 0 && (
                    <button
                      onClick={() => setShowConfig(true)}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-700 font-bold text-sm transition-all flex justify-center items-center gap-2"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setUninstallConfirm(true)}
                    className="w-full py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إلغاء تثبيت التطبيق' : 'Uninstall Application'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={handleStartInstall}
                    disabled={installMutation.isPending || installingState !== null}
                    className="w-full relative overflow-hidden group flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-black text-sm shadow-xl shadow-primary-500/25 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {installingState ? (
                      <>
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute inset-y-0 left-0 bg-black/20 transition-all duration-300" style={{ width: `${installingState.progress}%` }} />
                        <span className="relative z-10 font-mono tracking-wider">{installingState.progress.toFixed(0)}%</span>
                      </>
                    ) : (
                      <span>
                        {appNeedsPayment(detailApp)
                          ? (isAr
                            ? `تفعيل ${formatAppPrice(detailApp) ? `— ${formatAppPrice(detailApp)}` : ''}`
                            : `Activate ${formatAppPrice(detailApp) ? `— ${formatAppPrice(detailApp)}` : ''}`)
                          : detailApp.trialEligible
                            ? (isAr ? `بدء تجربة ${detailApp.trialDays || 7} أيام` : `Start ${detailApp.trialDays || 7}-day trial`)
                            : (isAr ? 'تثبيت التطبيق' : 'Install Application')}
                      </span>
                    )}
                  </button>

                  {detailApp.trialEligible && (
                    <p className="text-center text-xs font-medium text-emerald-700 dark:text-emerald-300 px-4">
                      {isAr
                        ? `يشمل تجربة مجانية ${detailApp.trialDays || 7} أيام. تجربة واحدة لكل منشأة.`
                        : `Includes a ${detailApp.trialDays || 7}-day free trial.`}
                    </p>
                  )}
                  {(detailApp.trialUsed || detailApp.trialExpired) && !detailApp.isInstalled && (
                    <p className="text-center text-xs font-medium text-amber-700 dark:text-amber-300">
                      {isAr ? 'تم استخدام التجربة المجانية. التفعيل يتطلب الدفع.' : 'Free trial already used. Activation requires payment.'}
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Settings Config Modal */}
      <AnimatePresence>
        {showConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowConfig(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-[2rem] p-6 shadow-2xl border border-gray-100 dark:border-white/10 z-10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black">{isAr ? 'إعدادات التكامل' : 'Integration Settings'}</h3>
                <button onClick={() => setShowConfig(false)} className="p-2 bg-gray-100 dark:bg-dark-700 rounded-full hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar pb-6 pr-2">
                {detailApp.configSchema?.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-200">
                      {isAr ? field.labelAr : field.labelEn}
                    </label>
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={configForm[field.key] || ''}
                      onChange={(e) => setConfigForm((s) => ({ ...s, [field.key]: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 outline-none transition-all placeholder-gray-400"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => saveSettingsMutation.mutate(configForm)}
                disabled={saveSettingsMutation.isPending}
                className="w-full mt-4 py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black shadow-md hover:bg-gray-800 transition-all disabled:opacity-50 active:scale-95"
              >
                {saveSettingsMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isAr ? 'حفظ' : 'Save Settings')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Uninstall Modal */}
      <AnimatePresence>
        {uninstallConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setUninstallConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-[2rem] p-8 shadow-2xl border border-gray-100 dark:border-white/10 z-10 space-y-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-black">{isAr ? `إلغاء تثبيت ${detailApp.nameAr}؟` : `Uninstall ${detailApp.nameEn}?`}</h3>
                <p className="text-xs sm:text-sm font-medium text-gray-500">{isAr ? 'سيتم إلغاء تفعيل الوحدة.' : 'This module will be deactivated.'}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setUninstallConfirm(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-xs font-bold hover:bg-gray-50 dark:border-white/10 dark:hover:bg-dark-700">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={() => uninstallMutation.mutate()} disabled={uninstallMutation.isPending} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50">
                  {isAr ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
