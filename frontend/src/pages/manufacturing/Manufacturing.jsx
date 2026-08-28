import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Calendar,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  DollarSign,
  Plus,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Gauge,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import {
  pageTitleClass,
  pageSubtitleClass,
  pageHeaderClass,
  statGridClass,
  statCardClass,
  statLabelClass,
  statValueClass,
  statHintClass,
  sectionCardClass,
  sectionEyebrowClass,
  sectionTitleClass,
  planTabsWrapClass,
  salesTabClass,
  ghostActionClass,
  primaryBtnClass,
  secondaryBtnClass,
  softChipClass,
  wipTileClass,
  metricTrackClass,
  metricFillClass,
  listShellClass,
  salesTableClass,
  salesThClass,
  salesTdClass,
  salesTrClass,
  monoCellClass,
  suggestCellClass,
  emptyStateClass,
  dangerActionClass,
} from '../planning/planningUi';

export default function Manufacturing() {
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const { t } = useTranslation(language);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview'); // overview, bom, planning, workorders, qa, costing
  const [selectedBomForDetail, setSelectedBomForDetail] = useState(null);
  const [isNewBomModalOpen, setIsNewBomModalOpen] = useState(false);
  const [isNewWorkOrderModalOpen, setIsNewWorkOrderModalOpen] = useState(false);
  const [isOperatorJobModalOpen, setIsOperatorJobModalOpen] = useState(false);
  const [selectedJobCard, setSelectedJobCard] = useState(null);
  const [isNcrModalOpen, setIsNcrModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

  // ─── DATA QUERIES ───
  const { data: bomsData, isLoading: isBomsLoading } = useQuery({
    queryKey: ['mfg-boms'],
    queryFn: () => api.get('/manufacturing/boms').then((res) => res.data),
  });

  const { data: workOrdersData, isLoading: isWoLoading } = useQuery({
    queryKey: ['mfg-work-orders'],
    queryFn: () => api.get('/manufacturing/work-orders').then((res) => res.data),
  });

  const { data: workCentersData } = useQuery({
    queryKey: ['mfg-work-centers'],
    queryFn: () => api.get('/manufacturing/work-centers').then((res) => res.data),
  });

  const { data: mrpData, refetch: runMrpEngine } = useQuery({
    queryKey: ['mfg-mrp-run'],
    queryFn: () => api.get('/manufacturing/mrp/run').then((res) => res.data),
  });

  const { data: oeeData } = useQuery({
    queryKey: ['mfg-oee-analytics'],
    queryFn: () => api.get('/manufacturing/analytics/oee').then((res) => res.data),
  });

  const { data: wipData } = useQuery({
    queryKey: ['mfg-wip-valuation'],
    queryFn: () => api.get('/manufacturing/analytics/wip-valuation').then((res) => res.data),
  });

  const { data: varianceData } = useQuery({
    queryKey: ['mfg-costing-variance'],
    queryFn: () => api.get('/manufacturing/costing/variance').then((res) => res.data),
  });

  const { data: qaInspectionsData } = useQuery({
    queryKey: ['mfg-qa-inspections'],
    queryFn: () => api.get('/manufacturing/qa/inspections').then((res) => res.data),
  });

  const { data: ncrsData } = useQuery({
    queryKey: ['mfg-qa-ncrs'],
    queryFn: () => api.get('/manufacturing/qa/ncrs').then((res) => res.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-for-mfg'],
    queryFn: () => api.get('/products').then((res) => res.data),
  });

  const boms = bomsData?.boms || [];
  const workOrders = workOrdersData?.workOrders || [];
  const workCenters = workCentersData?.workCenters || [];
  const oee = oeeData?.oee || { overallOEE: 88, availability: 92, performance: 94, quality: 98 };
  const wip = wipData || { totalWIPValue: 0, stageValuation: {} };
  const products = productsData?.products || [];

  // ─── MUTATIONS ───
  const issueMaterialsMutation = useMutation({
    mutationFn: (workOrderId) => api.post(`/manufacturing/work-orders/${workOrderId}/issue-materials`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم صرف وصرف المواد للمصنع بنجاح' : 'Kitting materials issued to shop floor');
      queryClient.invalidateQueries(['mfg-work-orders']);
      queryClient.invalidateQueries(['mfg-wip-valuation']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Material issue failed')
  });

  const startJobMutation = useMutation({
    mutationFn: (jobCardId) => api.post(`/manufacturing/job-cards/${jobCardId}/start`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم بدء تشغيل أمر الشغل' : 'Job card started');
      queryClient.invalidateQueries(['mfg-work-orders']);
    }
  });

  const pauseJobMutation = useMutation({
    mutationFn: (jobCardId) => api.post(`/manufacturing/job-cards/${jobCardId}/pause`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إيقاف مؤقت لأمر الشغل' : 'Job card paused');
      queryClient.invalidateQueries(['mfg-work-orders']);
    }
  });

  const completeJobMutation = useMutation({
    mutationFn: ({ jobCardId, quantityOutput, quantityRejected }) =>
      api.post(`/manufacturing/job-cards/${jobCardId}/complete`, { quantityOutput, quantityRejected }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم اكتمال المرحلة بنجاح' : 'Operation completed successfully');
      setIsOperatorJobModalOpen(false);
      queryClient.invalidateQueries(['mfg-work-orders']);
      queryClient.invalidateQueries(['mfg-wip-valuation']);
    }
  });

  const signQaInspectionMutation = useMutation({
    mutationFn: (payload) => api.post('/manufacturing/qa/inspections', payload),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم اعتماد تقرير فحص الجودة وتمرير البضائع' : 'QA Inspection passed & goods released');
      queryClient.invalidateQueries(['mfg-qa-inspections']);
      queryClient.invalidateQueries(['mfg-work-orders']);
    }
  });

  const ar = language === 'ar';

  return (
    <div className="space-y-5 pb-12">
      <div className={pageHeaderClass}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={pageTitleClass}>
              {ar ? 'التصنيع الصناعي' : 'Manufacturing & MES'}
            </h1>
            <span className={softChipClass}>
              {ar ? 'OEE · WIP · QA' : 'OEE · WIP · QA'}
            </span>
          </div>
          <p className={pageSubtitleClass}>
            {ar
              ? 'شجرة المواد، أوامر الإنتاج، فحص الجودة، وتكاليف WIP — متصلة بمخزون Odoo.'
              : 'BOMs, work orders, quality checks, and WIP costing — connected to inventory.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/app/dashboard/inventory/manufacturing/new" className={primaryBtnClass}>
              {ar ? 'أمر تصنيع جديد' : 'New inventory MO'}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/app/dashboard/mrp" className={ghostActionClass}>
              {ar ? 'تخطيط MRP' : 'MRP planning'}
            </Link>
          </div>
        </div>
        <div className={`${statCardClass} shrink-0 min-w-[12rem]`}>
          <p className={statLabelClass}>{ar ? 'OEE · WIP' : 'OEE · WIP'}</p>
          <p className={statValueClass}>{oee.overallOEE}%</p>
          <p className={statHintClass}>
            {(wip.totalWIPValue || 0).toLocaleString()} SAR {ar ? 'قيد التشغيل' : 'in progress'}
          </p>
        </div>
      </div>

      <div className={planTabsWrapClass}>
        {[
          { id: 'overview', labelEn: 'Overview & OEE', labelAr: 'نظرة عامة', icon: Gauge },
          { id: 'bom', labelEn: 'Bill of Materials', labelAr: 'شجرة المواد', icon: Layers },
          { id: 'planning', labelEn: 'Planning', labelAr: 'التخطيط', icon: Calendar },
          { id: 'workorders', labelEn: 'Work orders', labelAr: 'أوامر الإنتاج', icon: Cpu },
          { id: 'qa', labelEn: 'Quality', labelAr: 'الجودة', icon: ShieldCheck },
          { id: 'costing', labelEn: 'Costing', labelAr: 'التكاليف', icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`${salesTabClass(activeTab === tab.id)} inline-flex items-center gap-2 px-3 py-2.5 whitespace-nowrap`}
            >
              <Icon className="h-4 w-4 opacity-70" />
              {ar ? tab.labelAr : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: OVERVIEW & OEE ANALYTICS
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className={statGridClass}>
            {[
              { label: ar ? 'OEE' : 'Overall OEE', value: `${oee.overallOEE}%`, hint: ar ? 'الهدف 85%+' : 'Target 85%+' , pct: oee.overallOEE },
              { label: ar ? 'الجاهزية' : 'Availability', value: `${oee.availability}%`, hint: `${oee.totalDowntimeMinutes || 0}m ${ar ? 'توقف' : 'downtime'}`, pct: oee.availability },
              { label: ar ? 'الأداء' : 'Performance', value: `${oee.performance}%`, hint: ar ? 'الالتزام بالدورة' : 'Cycle adherence', pct: oee.performance },
              { label: ar ? 'الجودة' : 'Quality', value: `${oee.quality}%`, hint: `${100 - oee.quality}% ${ar ? 'مرفوض' : 'defect'}`, pct: oee.quality },
            ].map((m) => (
              <div key={m.label} className={statCardClass}>
                <p className={statLabelClass}>{m.label}</p>
                <p className={statValueClass}>{m.value}</p>
                <div className={metricTrackClass}>
                  <div className={metricFillClass} style={{ width: `${Math.min(100, m.pct || 0)}%` }} />
                </div>
                <p className={statHintClass}>{m.hint}</p>
              </div>
            ))}
          </div>

          <div className={sectionCardClass}>
            <p className={sectionEyebrowClass}>{ar ? 'WIP' : 'WIP'}</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
              {ar ? 'قيمة العمل قيد التنفيذ حسب المرحلة' : 'Work-in-progress by stage'}
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { stage: 'kitting', nameEn: 'Material kitting', nameAr: 'تجهيز المواد' },
                { stage: 'in_production', nameEn: 'Shop floor', nameAr: 'خط الإنتاج' },
                { stage: 'qa_quarantine', nameEn: 'QA quarantine', nameAr: 'حجر الجودة' },
                { stage: 'packaging', nameEn: 'Packaging', nameAr: 'التغليف' },
              ].map((s) => (
                <div key={s.stage} className={wipTileClass}>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {ar ? s.nameAr : s.nameEn}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950 dark:text-white">
                    {(wip.stageValuation?.[s.stage] || 0).toLocaleString()} SAR
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCardClass}>
            <p className={sectionEyebrowClass}>{ar ? 'المحطات' : 'Work centers'}</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
              {ar ? 'محطات العمل والاستخدام' : 'Work centers & utilization'}
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {workCenters.map((wc) => (
                <div
                  key={wc._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/90 px-4 py-3 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {ar ? wc.nameAr : wc.nameEn}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">{wc.code}</p>
                  </div>
                  <span className={softChipClass}>{wc.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: BILL OF MATERIALS (BOM) & ENGINEERING
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'bom' && (
        <div className="space-y-4">
          <div className={sectionCardClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className={sectionEyebrowClass}>{ar ? 'BOM' : 'BOM'}</p>
                <h2 className={sectionTitleClass}>
                  {ar ? 'شجرة المواد' : 'Bill of materials'}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {ar ? 'مكونات، نسخ، وتكلفة معيارية للوحدة' : 'Components, revisions, and standard unit cost'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button type="button" onClick={() => setIsSwapModalOpen(true)} className={secondaryBtnClass}>
                  <RefreshCw className="h-4 w-4" />
                  {ar ? 'استبدال مكوّن' : 'Swap component'}
                </button>
                <button type="button" onClick={() => setIsNewBomModalOpen(true)} className={primaryBtnClass}>
                  <Plus className="h-4 w-4" />
                  {ar ? 'BOM جديد' : 'New BOM'}
                </button>
              </div>
            </div>
          </div>

          {isBomsLoading ? (
            <div className={emptyStateClass}>
              <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900 dark:border-dark-600 dark:border-t-white" />
            </div>
          ) : boms.length === 0 ? (
            <div className={emptyStateClass}>{ar ? 'لا توجد شجرة مواد' : 'No BOMs yet'}</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {boms.map((bom) => (
                <div key={bom._id} className={statCardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`${monoCellClass} font-semibold`}>{bom.bomNumber}</span>
                        <span className="text-[11px] text-slate-400">v{bom.version}</span>
                        {bom.isMultiLevel && <span className={softChipClass}>{ar ? 'متعدد المستويات' : 'Multi-level'}</span>}
                      </div>
                      <h3 className="mt-2 truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {bom.finishedProductId?.nameEn || bom.finishedProductId?.nameAr || bom.nameEn}
                      </h3>
                    </div>
                    <span className={softChipClass}>{bom.status}</span>
                  </div>

                  <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-dark-700">
                    <div className="flex justify-between text-slate-500">
                      <span>{ar ? 'مواد' : 'Material'}</span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{bom.estimatedMaterialCost} SAR</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>{ar ? 'عمالة · تشغيل' : 'Labor · OH'}</span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                        {(bom.estimatedLaborCost || 0) + (bom.estimatedOverheadCost || 0)} SAR
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 font-semibold text-slate-950 dark:text-white">
                      <span>{ar ? 'معياري / وحدة' : 'Standard / unit'}</span>
                      <span className="tabular-nums">{bom.totalStandardCost} SAR</span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    {bom.components?.slice(0, 3).map((comp, idx) => (
                      <div key={idx} className="flex justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="truncate">{comp.productId?.nameEn || comp.productId?.nameAr || 'Component'}</span>
                        <span className={`${monoCellClass} shrink-0`}>{comp.quantity} {comp.uom}</span>
                      </div>
                    ))}
                    {(bom.components?.length || 0) > 3 && (
                      <p className="text-[11px] text-slate-400">+{bom.components.length - 3} {ar ? 'أخرى' : 'more'}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBomForDetail(bom)}
                    className={`${ghostActionClass} mt-4 w-full justify-center`}
                  >
                    {ar ? 'عرض التفاصيل' : 'View details'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: PLANNING & SCHEDULING (MPS / MRP / CRP / GANTT)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'planning' && (
        <div className="space-y-4">
          <div className={sectionCardClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className={sectionEyebrowClass}>{ar ? 'MRP' : 'MRP'}</p>
                <h2 className={sectionTitleClass}>
                  {ar ? 'تخطيط احتياجات المواد' : 'Material requirements'}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {ar ? 'نقص المواد من انفجار BOM مقابل المخزون' : 'BOM explosion vs. on-hand stock shortages'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link to="/app/dashboard/mrp" className={ghostActionClass}>
                  {ar ? 'MRP كامل' : 'Full MRP module'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <button type="button" onClick={() => runMrpEngine()} className={primaryBtnClass}>
                  <RefreshCw className="h-4 w-4" />
                  {ar ? 'تشغيل MRP' : 'Run MRP'}
                </button>
              </div>
            </div>
          </div>

          <div className={listShellClass}>
            <div className="overflow-x-auto">
              <table className={salesTableClass}>
                <thead>
                  <tr>
                    <th className={salesThClass}>{ar ? 'SKU / صنف' : 'SKU / Item'}</th>
                    <th className={salesThClass}>{ar ? 'مطلوب' : 'Required'}</th>
                    <th className={salesThClass}>{ar ? 'المخزون' : 'On hand'}</th>
                    <th className={salesThClass}>{ar ? 'نقص' : 'Shortage'}</th>
                    <th className={salesThClass}>{ar ? 'تكلفة' : 'Est. cost'}</th>
                    <th className={salesThClass}>{ar ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(mrpData?.purchaseSuggestions || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className={emptyStateClass}>
                        {ar ? 'لا توجد مقترحات — شغّل MRP' : 'No suggestions — run MRP engine'}
                      </td>
                    </tr>
                  ) : (
                    (mrpData?.purchaseSuggestions || []).map((item, idx) => (
                      <tr key={idx} className={salesTrClass}>
                        <td className={salesTdClass}>
                          <p className="font-medium text-slate-900 dark:text-white">{item.nameEn || item.nameAr}</p>
                          <p className={monoCellClass}>{item.sku}</p>
                        </td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{item.grossRequiredQty} {item.uom}</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{item.currentStock} {item.uom}</td>
                        <td className={`${salesTdClass} ${suggestCellClass}`}>{item.shortageQty} {item.uom}</td>
                        <td className={`${salesTdClass} font-semibold tabular-nums`}>{item.estimatedTotalCost} SAR</td>
                        <td className={salesTdClass}>
                          <Link to="/app/dashboard/purchases/orders/new" className={ghostActionClass}>
                            {ar ? 'مسودة PO' : 'Draft PO'}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 4: WORK ORDERS & SHOP FLOOR (MES)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'workorders' && (
        <div className="space-y-4">
          <div className={sectionCardClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className={sectionEyebrowClass}>{ar ? 'MES' : 'MES'}</p>
                <h2 className={sectionTitleClass}>
                  {ar ? 'أوامر الإنتاج' : 'Work orders'}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {ar ? 'تجهيز المواد، بطاقات العمل، وتنفيذ خط الإنتاج' : 'Kitting, job cards, and shop floor execution'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link to="/app/dashboard/inventory/manufacturing/new" className={primaryBtnClass}>
                  <Plus className="h-4 w-4" />
                  {ar ? 'أمر مخزون' : 'Inventory MO'}
                </Link>
                <button type="button" onClick={() => setIsNewWorkOrderModalOpen(true)} className={secondaryBtnClass}>
                  <Plus className="h-4 w-4" />
                  {ar ? 'أمر legacy' : 'Legacy WO'}
                </button>
              </div>
            </div>
          </div>

          {isWoLoading ? (
            <div className={emptyStateClass}>
              <span className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900 dark:border-dark-600 dark:border-t-white" />
            </div>
          ) : workOrders.length === 0 ? (
            <div className={emptyStateClass}>{ar ? 'لا توجد أوامر إنتاج' : 'No work orders'}</div>
          ) : (
            <div className="space-y-3">
              {workOrders.map((wo) => (
                <div key={wo._id} className={sectionCardClass}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`${monoCellClass} font-semibold`}>{wo.orderNumber}</span>
                        {wo.lotNumber && <span className={softChipClass}>{wo.lotNumber}</span>}
                        <span className={softChipClass}>{wo.status}</span>
                      </div>
                      <h4 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {wo.productId?.nameEn || wo.productId?.nameAr || 'Manufactured item'}
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {ar ? `مخطط: ${wo.quantityPlanned}` : `Planned: ${wo.quantityPlanned}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {wo.kittingStatus !== 'fully_issued' && (
                        <button
                          type="button"
                          onClick={() => issueMaterialsMutation.mutate(wo._id)}
                          disabled={issueMaterialsMutation.isPending}
                          className={secondaryBtnClass}
                        >
                          {ar ? 'صرف مواد' : 'Issue materials'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobCard({ workOrderId: wo._id, orderNumber: wo.orderNumber, productName: wo.productId?.nameEn });
                          setIsOperatorJobModalOpen(true);
                        }}
                        className={primaryBtnClass}
                      >
                        <Play className="h-4 w-4" />
                        {ar ? 'المشغّل' : 'Operator'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 5: QA/QC & TRACEABILITY
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'qa' && (
        <div className="space-y-4">
          <div className={sectionCardClass}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className={sectionEyebrowClass}>{ar ? 'QA' : 'QA'}</p>
                <h2 className={sectionTitleClass}>
                  {ar ? 'الجودة والمطابقة' : 'Quality & traceability'}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {ar ? 'فحوصات، حجر، وتقارير عدم المطابقة' : 'Inspections, quarantine, and NCR logging'}
                </p>
              </div>
              <button type="button" onClick={() => setIsNcrModalOpen(true)} className={dangerActionClass}>
                <AlertTriangle className="h-4 w-4" />
                {ar ? 'تسجيل NCR' : 'Log NCR'}
              </button>
            </div>
          </div>

          {(qaInspectionsData?.inspections || []).length === 0 ? (
            <div className={emptyStateClass}>{ar ? 'لا توجد فحوصات' : 'No inspections yet'}</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(qaInspectionsData?.inspections || []).map((qc) => (
                <div key={qc._id} className={statCardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`${monoCellClass} font-semibold`}>{qc.inspectionNumber}</span>
                      <h4 className="mt-2 truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {qc.productId?.nameEn || 'Finished item'}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        Lot {qc.lotNumber} · {qc.inspectorName}
                      </p>
                    </div>
                    <span className={softChipClass}>{qc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 6: COSTING & VARIANCE WATERFALL
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'costing' && (
        <div className="space-y-4">
          <div className={sectionCardClass}>
            <p className={sectionEyebrowClass}>{ar ? 'Costing' : 'Costing'}</p>
            <h2 className={sectionTitleClass}>
              {ar ? 'معياري مقابل فعلي' : 'Standard vs. actual variance'}
            </h2>
          </div>

          <div className={listShellClass}>
            <div className="overflow-x-auto">
              <table className={salesTableClass}>
                <thead>
                  <tr>
                    <th className={salesThClass}>{ar ? 'أمر' : 'Order'}</th>
                    <th className={salesThClass}>{ar ? 'منتج' : 'Product'}</th>
                    <th className={salesThClass}>{ar ? 'معياري' : 'Standard'}</th>
                    <th className={salesThClass}>{ar ? 'مواد فعلية' : 'Actual mat.'}</th>
                    <th className={salesThClass}>{ar ? 'عمالة · OH' : 'Labor · OH'}</th>
                    <th className={salesThClass}>{ar ? 'إجمالي فعلي' : 'Total actual'}</th>
                    <th className={salesThClass}>{ar ? 'انحراف' : 'Variance'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(varianceData?.varianceRecords || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className={emptyStateClass}>{ar ? 'لا توجد بيانات' : 'No variance records'}</td>
                    </tr>
                  ) : (
                    (varianceData?.varianceRecords || []).map((v, idx) => (
                      <tr key={idx} className={salesTrClass}>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{v.orderNumber}</td>
                        <td className={`${salesTdClass} font-medium text-slate-900 dark:text-white`}>{v.productName}</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{v.standardCost} SAR</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{v.actualMaterialCost} SAR</td>
                        <td className={`${salesTdClass} ${monoCellClass}`}>{v.actualLaborCost + v.actualOverheadCost} SAR</td>
                        <td className={`${salesTdClass} font-semibold tabular-nums`}>{v.totalActualCost} SAR</td>
                        <td className={`${salesTdClass} font-semibold tabular-nums ${v.status === 'favorable' ? 'text-teal-700 dark:text-teal-300' : 'text-red-600 dark:text-red-400'}`}>
                          {v.variance > 0 ? `+${v.variance}` : v.variance} SAR ({v.variancePercent}%)
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Operator Touch Execution Station ─── */}
      <AnimatePresence>
        {isOperatorJobModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className={`${sectionCardClass} w-full max-w-lg space-y-5`}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-dark-700">
                <div>
                  <p className={sectionEyebrowClass}>{ar ? 'MES' : 'MES'}</p>
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                    {ar ? 'شاشة المشغّل' : 'Operator station'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedJobCard?.orderNumber} · {selectedJobCard?.productName}
                  </p>
                </div>
                <button type="button" onClick={() => setIsOperatorJobModalOpen(false)} className={ghostActionClass}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => toast.success(ar ? 'تم بدء المؤقت' : 'Timer started')}
                  className={primaryBtnClass}
                >
                  <Play className="h-5 w-5" />
                  {ar ? 'بدء' : 'Start'}
                </button>
                <button
                  type="button"
                  onClick={() => toast.success(ar ? 'تم الإيقاف المؤقت' : 'Paused')}
                  className={secondaryBtnClass}
                >
                  <Pause className="h-5 w-5" />
                  {ar ? 'إيقاف' : 'Pause'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  toast.success(ar ? 'تم الاكتمال' : 'Job completed');
                  setIsOperatorJobModalOpen(false);
                }}
                className={`${primaryBtnClass} w-full`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {ar ? 'اكتمال → الجودة' : 'Complete → QA'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
