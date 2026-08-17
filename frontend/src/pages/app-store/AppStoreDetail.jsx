import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { updateTenant } from '../../store/slices/authSlice';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Lock, Star, DownloadCloud, AlertTriangle, ArrowRight, Trash2, Loader2, Sliders, X, ShieldCheck, Edit2, MessageSquare } from 'lucide-react';
import InvoiceLivePreview from '../../components/invoices/InvoiceLivePreview';
import { formatMoneyAmount, resolveAppPrices, yearlySavingsPercent } from '../../lib/appStorePricing';
import { App3DIcon as AppIcon } from '../../components/ui/App3DIcon';

export default function AppStoreDetail() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.ui);
  const { tenant, user } = useSelector((state) => state.auth);
  const queryClient = useQueryClient();
  const isAr = language === 'ar';

  const tenantCurrency = String(tenant?.settings?.currency || 'SAR').trim().toUpperCase();

  const [billingCycle, setBillingCycle] = useState('monthly');
  const [installingState, setInstallingState] = useState(null);
  const [uninstallConfirm, setUninstallConfirm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState({});

  // Reviews and ratings state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');

  const { data: reviewsPayload, isLoading: isReviewsLoading } = useQuery({
    queryKey: ['app-reviews', appId],
    queryFn: () => api.get(`/app-store/apps/${appId}/reviews`).then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['app-store-apps'],
    queryFn: () => api.get('/app-store/apps').then((r) => r.data),
  });

  const apps = useMemo(() => data?.apps || [], [data?.apps]);
  const detailApp = useMemo(() => apps.find((a) => a.appId === appId) || null, [apps, appId]);

  useEffect(() => {
    if (reviewsPayload?.myReview) {
      setReviewRating(reviewsPayload.myReview.rating || 5);
      setReviewTitle(reviewsPayload.myReview.title || '');
      setReviewComment(reviewsPayload.myReview.comment || '');
    }
  }, [reviewsPayload?.myReview]);

  const submitReviewMutation = useMutation({
    mutationFn: ({ rating, title, comment }) =>
      api.post(`/app-store/apps/${appId}/reviews`, { rating, title, comment }),
    onSuccess: () => {
      toast.success(isAr ? 'تم نشر التقييم بنجاح' : 'Rating & review submitted successfully');
      queryClient.invalidateQueries(['app-reviews', appId]);
      queryClient.invalidateQueries(['app-store-apps']);
      setShowReviewModal(false);
    },
    onError: (err) =>
      toast.error(
        err.response?.data?.errorAr ||
          err.response?.data?.error ||
          (isAr ? 'فشل إرسال التقييم' : 'Failed to submit review')
      ),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: () => api.delete(`/app-store/apps/${appId}/reviews`),
    onSuccess: () => {
      toast.success(isAr ? 'تم حذف التقييم' : 'Review deleted');
      queryClient.invalidateQueries(['app-reviews', appId]);
      queryClient.invalidateQueries(['app-store-apps']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete review'),
  });

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
              <span>{reviewsPayload?.stats?.averageRating ? reviewsPayload.stats.averageRating.toFixed(1) : (detailApp.rating || '5.0')}</span>
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
              <span>{(reviewsPayload?.stats?.totalReviews ?? detailApp.reviewsCount ?? 0).toLocaleString()}</span>
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

          {/* RATINGS & REVIEWS SECTION */}
          <div className="space-y-6 pt-4 border-t border-gray-100 dark:border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                  {isAr ? 'التقييمات والمراجعات' : 'Ratings & Customer Reviews'}
                </h3>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1">
                  {isAr
                    ? 'تقييمات موثقة من مسؤولي المنشآت الذين قاموا بتثبيت التطبيق'
                    : 'Verified reviews from organization administrators who installed this app'}
                </p>
              </div>

              {reviewsPayload?.canReview && (
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-500/20 transition active:scale-95"
                >
                  <Star className="w-4 h-4 fill-white text-white" />
                  <span>
                    {reviewsPayload?.myReview
                      ? (isAr ? 'تعديل تقييمي' : 'Edit My Review')
                      : (isAr ? 'تقييم التطبيق' : 'Rate & Review App')}
                  </span>
                </button>
              )}
            </div>

            {/* Rating Breakdown Card */}
            <div className="bg-white dark:bg-dark-800 rounded-3xl p-6 border border-gray-100 dark:border-white/5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Big Score */}
              <div className="flex flex-col items-center justify-center text-center p-2 border-b md:border-b-0 md:border-e border-gray-100 dark:border-white/5">
                <span className="text-5xl font-black text-gray-900 dark:text-white tabular-nums">
                  {(reviewsPayload?.stats?.averageRating ?? 5.0).toFixed(1)}
                </span>
                <div className="flex items-center gap-1 my-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(reviewsPayload?.stats?.averageRating ?? 5)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-gray-200 text-gray-200 dark:fill-dark-700 dark:text-dark-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-400">
                  {isAr
                    ? `بناءً على ${reviewsPayload?.stats?.totalReviews || 0} تقييم`
                    : `Based on ${reviewsPayload?.stats?.totalReviews || 0} reviews`}
                </span>
              </div>

              {/* Distribution Bars */}
              <div className="md:col-span-2 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviewsPayload?.stats?.distribution?.[star] || 0;
                  const total = reviewsPayload?.stats?.totalReviews || 0;
                  const pct = total > 0 ? Math.round((count / total) * 100) : star === 5 ? 100 : 0;

                  return (
                    <div key={star} className="flex items-center gap-3 text-xs font-semibold">
                      <div className="flex items-center gap-1 w-10 text-gray-500 shrink-0">
                        <span>{star}</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-dark-900 overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-end text-gray-400 tabular-nums shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* If not installed and not able to review */}
            {!reviewsPayload?.canReview && !detailApp.isInstalled && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 text-xs font-medium text-amber-900 dark:text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {isAr
                    ? 'التقييمات مقتصرة على المسؤولين الذين قاموا بتثبيت التطبيق لضمان دقة وموثوقية التجارب.'
                    : 'Ratings & reviews are restricted to verified administrators who have installed this application.'}
                </span>
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-4">
              {isReviewsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                </div>
              ) : reviewsPayload?.reviews?.length > 0 ? (
                <div className="space-y-4">
                  {reviewsPayload.reviews.map((rev) => (
                    <div
                      key={rev._id}
                      className={`p-5 rounded-3xl border bg-white dark:bg-dark-800 transition ${
                        rev.isOwnReview
                          ? 'border-primary-300 dark:border-primary-500/40 shadow-md shadow-primary-500/5 ring-1 ring-primary-500/20'
                          : 'border-gray-100 dark:border-white/5 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/30 text-primary-700 dark:text-primary-300 flex items-center justify-center font-black text-sm">
                            {(rev.authorName || rev.tenantName || 'A').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                                {rev.authorName || (isAr ? 'مسؤول منشأة' : 'Administrator')}
                              </h4>
                              {rev.isVerifiedInstaller && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  {isAr ? 'مثبت موثق' : 'Verified Installer'}
                                </span>
                              )}
                              {rev.isOwnReview && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                                  {isAr ? 'تقييمك' : 'Your review'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 font-medium">
                              {rev.tenantName ? `${rev.tenantName} · ` : ''}
                              {new Date(rev.createdAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3.5 h-3.5 ${
                                  s <= rev.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'fill-gray-200 text-gray-200 dark:fill-dark-700 dark:text-dark-700'
                                }`}
                              />
                            ))}
                          </div>

                          {rev.isOwnReview && (
                            <div className="flex items-center gap-1 ms-2">
                              <button
                                type="button"
                                onClick={() => setShowReviewModal(true)}
                                className="p-1 text-gray-400 hover:text-primary-600 transition"
                                title={isAr ? 'تعديل' : 'Edit'}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(isAr ? 'هل أنت متأكد من حذف تقييمك؟' : 'Are you sure you want to delete your review?')) {
                                    deleteReviewMutation.mutate();
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 transition"
                                title={isAr ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {rev.title && (
                        <h5 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">
                          {rev.title}
                        </h5>
                      )}
                      {rev.comment && (
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                          {rev.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 rounded-3xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-white/5 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
                    <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    {isAr ? 'لا توجد مراجعات بعد' : 'No reviews yet'}
                  </h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium">
                    {isAr
                      ? 'كن أول من يقيم هذا التطبيق ويشارك تجربته مع مجتمع الأعمال.'
                      : 'Be the first administrator to rate this app and share your experience with the community.'}
                  </p>
                  {reviewsPayload?.canReview && (
                    <button
                      type="button"
                      onClick={() => setShowReviewModal(true)}
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition"
                    >
                      <Star className="w-3.5 h-3.5 fill-white text-white" />
                      <span>{isAr ? 'كتابة أول مراجعة' : 'Write First Review'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
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

      {/* RATE & REVIEW MODAL */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-dark-850 border border-gray-100 dark:border-white/10 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white">
                      {isAr ? `تقييم ${name}` : `Rate & Review ${name}`}
                    </h3>
                    <p className="text-xs font-medium text-gray-400">
                      {isAr ? 'شارك تجربتك لمساعدة المنشآت الأخرى' : 'Share your feedback to help other organizations'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Star rating selector */}
              <div className="text-center py-3 bg-gray-50 dark:bg-dark-900 rounded-2xl border border-gray-100 dark:border-white/5 space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                  {isAr ? 'اختر تقييمك العام' : 'Select your overall rating'}
                </span>
                <div className="flex justify-center items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || reviewRating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setReviewRating(star)}
                        className="p-1 transition-transform hover:scale-125 focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            active
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]'
                              : 'fill-gray-200 text-gray-200 dark:fill-dark-700 dark:text-dark-700'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-bold text-primary-600 dark:text-primary-400">
                  {(hoverRating || reviewRating) === 5 && (isAr ? '⭐⭐⭐⭐⭐ ممتاز جداً' : '⭐⭐⭐⭐⭐ Excellent')}
                  {(hoverRating || reviewRating) === 4 && (isAr ? '⭐⭐⭐⭐ جيد جداً' : '⭐⭐⭐⭐ Very Good')}
                  {(hoverRating || reviewRating) === 3 && (isAr ? '⭐⭐⭐ جيد' : '⭐⭐⭐ Good')}
                  {(hoverRating || reviewRating) === 2 && (isAr ? '⭐⭐ مقبول' : '⭐⭐ Fair')}
                  {(hoverRating || reviewRating) === 1 && (isAr ? '⭐ يحتاج تحسين' : '⭐ Needs Improvement')}
                </p>
              </div>

              {/* Form inputs */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-500 mb-1">
                    {isAr ? 'عنوان المراجعة (اختياري)' : 'Review Headline (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder={isAr ? 'مثال: تطبيق ممتاز ساهم في تسريع العمل' : 'e.g. Fantastic module, boosted our efficiency'}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900 px-3.5 py-2.5 text-xs font-medium text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase tracking-wider text-gray-500 mb-1">
                    {isAr ? 'تفاصيل المراجعة والتجربة' : 'Detailed Review & Feedback'}
                  </label>
                  <textarea
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={isAr ? 'اكتب ملاحظاتك عن السهولة، الميزات، والأداء...' : 'Describe what you liked, features used, and overall experience...'}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-900 p-3 text-xs font-medium text-gray-900 dark:text-white shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              {/* Verified Author Info */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-dark-900 text-[11px] text-gray-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {isAr
                    ? `سيتم نشر التقييم باسم: ${user?.name || 'Admin'} (${tenant?.business?.legalNameAr || tenant?.business?.legalNameEn || tenant?.name || 'منشأتك'})`
                    : `Posting verified review as: ${user?.name || 'Admin'} (${tenant?.business?.legalNameEn || tenant?.business?.legalNameAr || tenant?.name || 'Your Company'})`}
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    submitReviewMutation.mutate({
                      rating: reviewRating,
                      title: reviewTitle,
                      comment: reviewComment,
                    })
                  }
                  disabled={submitReviewMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-lg shadow-primary-500/20 transition disabled:opacity-50"
                >
                  {submitReviewMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Star className="w-4 h-4 fill-white text-white" />
                  )}
                  <span>{isAr ? 'نشر التقييم' : 'Submit Review'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
