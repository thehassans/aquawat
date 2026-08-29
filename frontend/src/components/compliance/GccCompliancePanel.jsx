import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { Shield, CheckCircle2, AlertTriangle, RefreshCw, Key, Globe, Check, Eye, HelpCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { updateTenant } from '../../store/slices/authSlice';

const COUNTRY_CONFIGS = {
  AE: {
    authority: 'UAE Federal Tax Authority (FTA / EmaraTax)',
    authorityAr: 'الهيئة الاتحادية للضرائب - إمارات تاكس (الإمارات)',
    currency: 'AED',
    endpoint: 'fta',
    keyName: 'fta',
    taxRate: '5% Standard VAT',
    idLabelEn: '15-digit TRN (Tax Registration Number)',
    idLabelAr: 'الرقم الضريبي TRN (15 رقماً)',
    idField: 'trn',
    idPlaceholder: '100XXXXXXXXX003',
    extraFieldLabelEn: 'Corporate Tax TRN (16 digits)',
    extraFieldLabelAr: 'رقم ضريبة الشركات (16 رقماً)',
    extraField: 'corporateTaxTrn',
    extraPlaceholder: 'CT-100XXXXXXXXX003',
    portalUrl: 'https://eservices.tax.gov.ae',
    portalName: 'EmaraTax Portal',
    flag: '🇦🇪',
  },
  OM: {
    authority: 'Oman Tax Authority (OTA / جهاز الضرائب)',
    authorityAr: 'جهاز الضرائب سلطنة عمان (OTA)',
    currency: 'OMR',
    endpoint: 'ota',
    keyName: 'ota',
    taxRate: '5% Standard VAT',
    idLabelEn: 'Tax Identification Number (TIN / VAT No)',
    idLabelAr: 'رقم التعريف الضريبي (TIN)',
    idField: 'tin',
    idPlaceholder: 'OM1XXXXXXXXX',
    extraFieldLabelEn: 'Commercial Registration (CR) Number',
    extraFieldLabelAr: 'رقم السجل التجاري العماني',
    extraField: 'commercialRegistrationNumber',
    extraPlaceholder: 'CR-10XXXXX',
    portalUrl: 'https://taxoman.gov.om',
    portalName: 'Oman Tax Portal',
    flag: '🇴🇲',
  },
  BH: {
    authority: 'Bahrain National Bureau for Revenue (NBR)',
    authorityAr: 'الجهاز الوطني للإيرادات (مملكة البحرين NBR)',
    currency: 'BHD',
    endpoint: 'bahrain-nbr',
    keyName: 'bahrainNbr',
    taxRate: '10% Standard VAT',
    idLabelEn: '15-digit VAT Account Number',
    idLabelAr: 'رقم الحساب الضريبي (15 رقماً)',
    idField: 'vatAccountNo',
    idPlaceholder: '200XXXXXXXXX002',
    extraFieldLabelEn: 'CR Number (Bahrain)',
    extraFieldLabelAr: 'رقم السجل التجاري في البحرين',
    extraField: 'crNumber',
    extraPlaceholder: 'CR-XXXXX',
    portalUrl: 'https://www.nbr.gov.bh',
    portalName: 'NBR Portal',
    flag: '🇧🇭',
  },
  KW: {
    authority: 'Kuwait Ministry of Finance (MOF / KDIT)',
    authorityAr: 'وزارة المالية الكويتية - إدارة الضريبة (MOF / KDIT)',
    currency: 'KWD',
    endpoint: 'mof-kuwait',
    keyName: 'mofKuwait',
    taxRate: '0% Standard VAT / Corporate Retention',
    idLabelEn: 'Civil ID / Unified Commercial ID',
    idLabelAr: 'الرقم المدني / التجاري الموحد',
    idField: 'civilId',
    idPlaceholder: '2XXXXXXXXXXX',
    extraFieldLabelEn: 'Tax Card Number',
    extraFieldLabelAr: 'رقم البطاقة الضريبية لوزارة المالية',
    extraField: 'taxCardNumber',
    extraPlaceholder: 'TC-XXXXXXXX',
    portalUrl: 'https://www.mof.gov.kw',
    portalName: 'MOF Kuwait Portal',
    flag: '🇰🇼',
  },
  QA: {
    authority: 'Qatar General Tax Authority (GTA / Dhareeba)',
    authorityAr: 'الهيئة العامة للضرائب - بوابة ضريبة (قطر GTA)',
    currency: 'QAR',
    endpoint: 'gta-qatar',
    keyName: 'gtaQatar',
    taxRate: 'Corporate & Excise Compliance',
    idLabelEn: 'Dhareeba Tax Identification Number (TIN)',
    idLabelAr: 'رقم التعريف الضريبي في نظام ضريبة (TIN)',
    idField: 'tin',
    idPlaceholder: '0000XXXXXXXX',
    extraFieldLabelEn: 'Commercial Registration (CR) Number',
    extraFieldLabelAr: 'رقم السجل التجاري القطري',
    extraField: 'crNumber',
    extraPlaceholder: 'CR-XXXXX',
    portalUrl: 'https://dhareeba.gov.qa',
    portalName: 'Dhareeba Tax Portal',
    flag: '🇶🇦',
  },
};

export default function GccCompliancePanel({ countryCode = 'AE' }) {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const isAr = language === 'ar';
  const t = (en, ar) => (isAr ? ar : en);

  const country = COUNTRY_CONFIGS[countryCode] || COUNTRY_CONFIGS.AE;

  // Form state
  const [taxId, setTaxId] = useState('');
  const [extraId, setExtraId] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [autoGenerateQr, setAutoGenerateQr] = useState(true);
  const [apiKey, setApiKey] = useState('');

  // Fetch current country compliance config
  const { data, isLoading } = useQuery({
    queryKey: ['gcc-compliance-config', country.endpoint],
    queryFn: () => api.get(`/tenant/compliance/${country.endpoint}`).then((res) => res.data),
  });

  const config = data?.[country.keyName] || tenant?.[country.keyName] || {};

  useEffect(() => {
    if (config) {
      setTaxId(config[country.idField] || '');
      setExtraId(config[country.extraField] || '');
      setEnvironment(config.environment || 'production');
      setAutoGenerateQr(config.autoGenerateQr !== false);
    }
  }, [config, country]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: (payload) => api.post(`/tenant/compliance/${country.endpoint}`, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['gcc-compliance-config', country.endpoint] });
      if (res.data?.[country.keyName]) {
        // Patch only the compliance block — updateTenant merges into existing tenant.
        dispatch(updateTenant({ [country.keyName]: res.data[country.keyName] }));
      }
      toast.success(t('Compliance settings saved successfully', 'تم حفظ إعدادات الامتثال بنجاح'));
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || t('Failed to save settings', 'فشل حفظ الإعدادات'));
    },
  });

  // Test Connection Mutation
  const testMutation = useMutation({
    mutationFn: () => api.post(`/tenant/compliance/${country.endpoint}/test-connection`),
    onSuccess: (res) => {
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['gcc-compliance-config', country.endpoint] });
        toast.success(t('Connection verified with tax authority!', 'تم التحقق من الاتصال بالهيئة الضريبية بنجاح!'));
      } else {
        toast.error(res.data?.message || t('Connection test failed', 'فشل اختبار الاتصال'));
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || t('Connection test error', 'خطأ أثناء اختبار الاتصال'));
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    const payload = {
      [country.idField]: taxId,
      [country.extraField]: extraId,
      environment,
      autoGenerateQr,
    };
    if (apiKey) payload.apiKey = apiKey;
    saveMutation.mutate(payload);
  };

  const isConnected = Boolean(taxId && config.connectionStatus === 'connected');
  const hasTaxId = Boolean(taxId);

  if (isLoading) {
    return (
      <div className="p-8 text-center animate-pulse space-y-4">
        <div className="h-10 bg-slate-200 dark:bg-dark-600 rounded-xl w-64 mx-auto" />
        <div className="h-40 bg-slate-200 dark:bg-dark-600 rounded-2xl max-w-xl mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/60 p-6 shadow-sm dark:border-white/10 dark:from-dark-800 dark:via-dark-800 dark:to-dark-750">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{country.flag}</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {t(country.authority, country.authorityAr)}
                </h2>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {country.currency}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  `Official tax compliance, e-invoicing verification QR, and ${country.taxRate}.`,
                  `الامتثال الضريبي الرسمي، رموز QR للتحقق، ونسبة ${country.taxRate}.`
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {t('Verified & Connected', 'معتمد ومتصل')}
              </span>
            ) : hasTaxId ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {t('Ready to Test', 'جاهز للاختبار')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                {t('Action Required', 'مطلوب إدخال البيانات')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Configuration Card */}
      <form onSubmit={handleSave} className="card p-6 space-y-6">
        <div className="border-b border-slate-100 dark:border-white/5 pb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-500" />
            {t('Tax Registration & Authority Credentials', 'بيانات التسجيل الضريبي والاعتماد')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'These credentials are automatically stamped onto your sales invoices, POS thermal receipts, and audit QR codes.',
              'تُطبع هذه البيانات تلقائياً على فواتير المبيعات، إيصالات نقاط البيع، ورموز QR للتحقق.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Primary Tax ID Field */}
          <div>
            <label className="label font-bold text-xs">
              {t(country.idLabelEn, country.idLabelAr)} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder={country.idPlaceholder}
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              required
            />
          </div>

          {/* Secondary ID Field */}
          <div>
            <label className="label font-bold text-xs">
              {t(country.extraFieldLabelEn, country.extraFieldLabelAr)}
            </label>
            <input
              type="text"
              className="input font-mono text-sm"
              placeholder={country.extraPlaceholder}
              value={extraId}
              onChange={(e) => setExtraId(e.target.value)}
            />
          </div>

          {/* Environment */}
          <div>
            <label className="label font-bold text-xs">{t('Environment', 'بيئة العمل')}</label>
            <select
              className="input text-sm"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="production">{t('Live Production', 'الإنتاجية الحية')}</option>
              <option value="sandbox">{t('Sandbox / Testing', 'بيئة التجربة والتدريب')}</option>
            </select>
          </div>

          {/* API Key (Optional) */}
          <div>
            <label className="label font-bold text-xs">{t('API Token / Gateway Key (Optional)', 'رمز API / مفتاح البوابة (اختياري)')}</label>
            <input
              type="password"
              className="input font-mono text-sm"
              placeholder={config.hasApiKey ? '••••••••••••••••' : 'Bearer / Secret Key'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>

        {/* QR Code Toggle */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-dark-750 flex items-center justify-between">
          <div>
            <div className="font-bold text-xs text-slate-900 dark:text-white">
              {t('Auto-Generate Verification QR on Receipts', 'توليد رمز QR المعتمد تلقائياً على الإيصالات')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                `Encodes seller, ${country.currency} grand total, tax breakdown, and timestamp for customer & tax inspector verification.`,
                `يشفر اسم البائع، إجمالي الفاتورة، تفاصيل الضريبة، والتوقيت للتحقق الفوري من قبل المفتشين والعملاء.`
              )}
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={autoGenerateQr}
            onChange={(e) => setAutoGenerateQr(e.target.checked)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <a
            href={country.portalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:underline dark:text-primary-400"
          >
            {t(`Open ${country.portalName}`, `فتح بوابة ${country.portalName}`)}
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </a>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={!hasTaxId || testMutation.isPending}
              className="btn btn-secondary text-xs flex items-center gap-2"
            >
              {testMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              )}
              {t('Test Authority Connection', 'اختبار الاتصال بالهيئة')}
            </button>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="btn btn-primary text-xs flex items-center gap-2"
            >
              {saveMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Shield className="w-3.5 h-3.5" />
              )}
              {t('Save Configuration', 'حفظ الإعدادات')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
