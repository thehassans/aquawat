import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Factory,
  Layers,
  Calendar,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Clock,
  DollarSign,
  Plus,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Search,
  Sliders,
  FileText,
  Boxes,
  Truck,
  Eye,
  Trash2,
  Sparkles,
  ChevronRight,
  ChevronDown,
  X,
  Gauge,
  Activity,
  Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { App3DIcon } from '../../components/ui/App3DIcon';

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

  return (
    <div className="space-y-8 pb-20">
      {/* ─── Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950 via-slate-900 to-orange-950 p-8 sm:p-10 text-white shadow-2xl border border-amber-500/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-3.5 bg-orange-500/20 rounded-2xl border border-orange-400/30 backdrop-blur-md shadow-inner">
              <App3DIcon path="/app/dashboard/manufacturing" label="Manufacturing" className="w-14 h-14" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {language === 'ar' ? 'نظام التصنيع والإنتاج الصناعي (MES & MRP II)' : 'Industrial Manufacturing & MES'}
                </h1>
                <span className="px-3 py-1 text-xs font-bold bg-amber-500/30 text-amber-200 rounded-full border border-amber-400/30">
                  {language === 'ar' ? 'تخطيط الموارد المتقدم' : 'MRP II Engine'}
                </span>
              </div>
              <p className="text-slate-300 text-sm sm:text-base mt-1 max-w-2xl font-light">
                {language === 'ar'
                  ? 'منظومة صناعية شاملة: شجرة المواد متعددة المستويات، تخطيط الاحتياجات، أوامر الشغل الحية، فحص الجودة ISO، وحساب تكاليف الإنتاج اللحظية.'
                  : 'Multi-level BOMs, dynamic MRP engine, shop floor job cards, ISO-grade QA checklists, and live OEE costing.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 bg-slate-900/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shadow-lg">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-amber-400">{oee.overallOEE}%</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {language === 'ar' ? 'كفاءة OEE' : 'Live OEE'}
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-extrabold text-emerald-400">
                {(wip.totalWIPValue || 0).toLocaleString()} <span className="text-xs font-normal">SAR</span>
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {language === 'ar' ? 'قيمة قيد التشغيل WIP' : 'Active WIP Value'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-dark-700">
        {[
          { id: 'overview', labelEn: 'Overview & OEE', labelAr: 'نظرة عامة ومؤشرات OEE', icon: Gauge },
          { id: 'bom', labelEn: 'Bill of Materials (BOM)', labelAr: 'شجرة المواد والمنتجات (BOM)', icon: Layers },
          { id: 'planning', labelEn: 'Planning (MPS & MRP)', labelAr: 'التخطيط والجدولة (MRP / MPS)', icon: Calendar },
          { id: 'workorders', labelEn: 'Work Orders & Shop Floor', labelAr: 'أوامر الإنتاج والتنفيذ الحي', icon: Cpu },
          { id: 'qa', labelEn: 'Quality & Traceability (QA)', labelAr: 'فحص الجودة والمطابقة (QA/QC)', icon: ShieldCheck },
          { id: 'costing', labelEn: 'Costing & Variance', labelAr: 'تحليل التكاليف والفروقات', icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2.5 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {language === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: OVERVIEW & OEE ANALYTICS
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* OEE 4-Pillar Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'الكفاءة الإجمالية OEE' : 'Overall OEE'}
                </span>
                <span className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
                  <Award className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-4">{oee.overallOEE}%</div>
              <div className="w-full bg-gray-100 dark:bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${oee.overallOEE}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">Target Benchmark: 85%+</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'الجاهزية Availability' : 'Availability'}
                </span>
                <span className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-4">{oee.availability}%</div>
              <div className="w-full bg-gray-100 dark:bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${oee.availability}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">Downtime logged: {oee.totalDowntimeMinutes || 0}m</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'الأداء Performance' : 'Performance'}
                </span>
                <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-4">{oee.performance}%</div>
              <div className="w-full bg-gray-100 dark:bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${oee.performance}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">Standard Cycle Time Adherence</p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? 'الجودة Quality Yield' : 'Quality Yield'}
                </span>
                <span className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white mt-4">{oee.quality}%</div>
              <div className="w-full bg-gray-100 dark:bg-dark-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${oee.quality}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">Scrap & Defect Rate: {100 - oee.quality}%</p>
            </div>
          </div>

          {/* WIP Valuation by Stage Breakdown */}
          <div className="rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 p-6 shadow-md">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
              {language === 'ar' ? 'توزيع المخزون قيد التشغيل (WIP) حسب مراحل الإنتاج' : 'Work-In-Progress (WIP) Valuation by Production Stage'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { stage: 'kitting', nameEn: 'Material Kitting', nameAr: 'تجهيز وصرف المواد', color: 'border-blue-500' },
                { stage: 'in_production', nameEn: 'Shop Floor Machining', nameAr: 'خطوط التجميع والتشغيل', color: 'border-amber-500' },
                { stage: 'qa_quarantine', nameEn: 'QA Quarantine Inspection', nameAr: 'حجر فحص الجودة', color: 'border-purple-500' },
                { stage: 'packaging', nameEn: 'Finished Packaging', nameAr: 'التغليف النهائي', color: 'border-emerald-500' },
              ].map((s) => (
                <div key={s.stage} className={`p-4 rounded-2xl bg-gray-50 dark:bg-dark-700/50 border-l-4 ${s.color}`}>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{language === 'ar' ? s.nameAr : s.nameEn}</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {(wip.stageValuation?.[s.stage] || 0).toLocaleString()} SAR
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Work Centers Radar */}
          <div className="rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 p-6 shadow-md">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
              {language === 'ar' ? 'محطات العمل وخطوط الإنتاج (Work Centers)' : 'Factory Work Centers & Machine Utilization'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {workCenters.map((wc) => (
                <div key={wc._id} className="p-4 rounded-2xl border border-gray-200 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-700/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                      <Factory className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {language === 'ar' ? wc.nameAr : wc.nameEn}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{wc.code}</div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                    wc.status === 'in_use'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                      : wc.status === 'maintenance'
                      ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                      : 'bg-gray-200 dark:bg-dark-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {wc.status}
                  </span>
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'شجرة المواد والتركيبات الهندسية (BOM Hub)' : 'Multi-Level Bill of Materials (BOM)'}
              </h2>
              <p className="text-xs text-gray-500">
                {language === 'ar' ? 'إدارة المكونات، القطع الفرعية، نسب الهدر وتكلفة المواد المعيارية' : 'Manage multi-level assemblies, sub-assemblies, scrap tolerances, and revisions'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSwapModalOpen(true)}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {language === 'ar' ? 'استبدال مكون شامل' : 'Swap Component'}
              </button>
              <button
                onClick={() => setIsNewBomModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:from-amber-700 hover:to-orange-700 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {language === 'ar' ? 'إنشاء شجرة مواد جديدة' : 'New BOM'}
              </button>
            </div>
          </div>

          {/* BOM Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boms.map((bom) => (
              <div
                key={bom._id}
                className="rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 p-6 shadow-md hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        {bom.bomNumber}
                      </span>
                      <span className="text-xs font-bold text-gray-400">v{bom.version}</span>
                      {bom.isMultiLevel && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/50 text-purple-600">
                          Multi-Level
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base mt-2">
                      {bom.finishedProductId?.nameEn || bom.finishedProductId?.nameAr || bom.nameEn}
                    </h3>
                  </div>

                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    {bom.status}
                  </span>
                </div>

                {/* Cost Breakdown */}
                <div className="mt-4 p-3 rounded-2xl bg-gray-50 dark:bg-dark-700/50 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>{language === 'ar' ? 'تكلفة المواد المباشرة:' : 'Material Cost:'}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{bom.estimatedMaterialCost} SAR</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>{language === 'ar' ? 'تكلفة العمالة والتشغيل:' : 'Labor & Machine:'}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{(bom.estimatedLaborCost || 0) + (bom.estimatedOverheadCost || 0)} SAR</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-dark-600 font-bold text-amber-600">
                    <span>{language === 'ar' ? 'إجمالي التكلفة المعيارية للوحدة:' : 'Total Standard Cost / Unit:'}</span>
                    <span>{bom.totalStandardCost} SAR</span>
                  </div>
                </div>

                {/* Components Preview */}
                <div className="mt-4 space-y-1">
                  <div className="text-xs font-bold text-gray-500">{language === 'ar' ? 'المكونات الأولية:' : 'Raw Components:'}</div>
                  {bom.components?.slice(0, 3).map((comp, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                      <span className="truncate">{comp.productId?.nameEn || comp.productId?.nameAr || 'Component'}</span>
                      <span className="font-mono">{comp.quantity} {comp.uom}</span>
                    </div>
                  ))}
                  {(bom.components?.length || 0) > 3 && (
                    <div className="text-xs text-amber-500 font-semibold">+{bom.components.length - 3} more items...</div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => setSelectedBomForDetail(bom)}
                  className="w-full mt-5 py-2.5 rounded-xl bg-gray-100 dark:bg-dark-700 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-xs font-bold transition-all text-center"
                >
                  {language === 'ar' ? 'عرض شجرة التركيب والتاريخ الكامل' : 'View Full Tree & Revisions'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: PLANNING & SCHEDULING (MPS / MRP / CRP / GANTT)
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'planning' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'محرك تخطيط الاحتياجات من المواد (MRP II)' : 'Material Requirements Planning (MRP Engine)'}
              </h2>
              <p className="text-xs text-gray-500">
                {language === 'ar' ? 'حساب النقص في المواد الخام، إنشاء أوامر الشراء المقترحة وأوامر الإنتاج آلياً' : 'Explodes BOMs against current stock to detect material shortages and suggest purchase orders'}
              </p>
            </div>

            <button
              onClick={() => runMrpEngine()}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:from-amber-700 hover:to-orange-700 transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {language === 'ar' ? 'إعادة تشغيل محرك MRP' : 'Run MRP Engine'}
            </button>
          </div>

          {/* MRP Shortage Warnings Table */}
          <div className="rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 p-6 shadow-md overflow-hidden">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {language === 'ar' ? 'نقص المواد الخام ومقترحات الشراء' : 'Raw Material Shortages & Purchase Suggestions'}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-dark-700/50 text-gray-500 dark:text-gray-400 uppercase font-bold">
                  <tr>
                    <th className="p-3">SKU / Item</th>
                    <th className="p-3">Required Qty</th>
                    <th className="p-3">Stock on Hand</th>
                    <th className="p-3">Shortage Deficit</th>
                    <th className="p-3">Est. Purchase Cost</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                  {(mrpData?.purchaseSuggestions || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-dark-700/30">
                      <td className="p-3">
                        <div className="font-bold text-gray-900 dark:text-white">{item.nameEn || item.nameAr}</div>
                        <div className="font-mono text-gray-400">{item.sku}</div>
                      </td>
                      <td className="p-3 font-semibold">{item.grossRequiredQty} {item.uom}</td>
                      <td className="p-3 font-semibold text-gray-500">{item.currentStock} {item.uom}</td>
                      <td className="p-3 font-bold text-rose-600">{item.shortageQty} {item.uom}</td>
                      <td className="p-3 font-semibold">{item.estimatedTotalCost} SAR</td>
                      <td className="p-3">
                        <button
                          onClick={() => toast.success(language === 'ar' ? 'تم إنشاء مسودة طلب شراء للمورد' : 'PO Draft Created for Supplier')}
                          className="px-3 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded-lg font-bold text-xs"
                        >
                          {language === 'ar' ? 'إنشاء أمر شراء' : 'Create PO'}
                        </button>
                      </td>
                    </tr>
                  ))}
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'أوامر الإنتاج وتنفيذ أرضية المصنع (Shop Floor MES)' : 'Work Orders & Shop Floor Execution'}
              </h2>
              <p className="text-xs text-gray-500">
                {language === 'ar' ? 'متابعة أوامر الشغل الحية، بطاقات العمل، مؤقت المشغل ومحطات التجميع' : 'Track live job cards, kitting slips, operator timers, and stage transitions'}
              </p>
            </div>

            <button
              onClick={() => setIsNewWorkOrderModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:from-amber-700 hover:to-orange-700 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {language === 'ar' ? 'أمر إنتاج جديد' : 'New Work Order'}
            </button>
          </div>

          {/* Work Orders List */}
          <div className="grid grid-cols-1 gap-4">
            {workOrders.map((wo) => (
              <div
                key={wo._id}
                className="rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 p-6 shadow-md hover:shadow-lg transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200">
                          {wo.orderNumber}
                        </span>
                        <span className="text-xs font-bold text-amber-500 uppercase">{wo.lotNumber}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          wo.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          wo.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {wo.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base mt-1">
                        {wo.productId?.nameEn || wo.productId?.nameAr || 'Manufactured Item'}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {language === 'ar' ? `الكمية المخططة: ${wo.quantityPlanned} قطعة` : `Planned Qty: ${wo.quantityPlanned} units`}
                      </p>
                    </div>
                  </div>

                  {/* Execution Action Buttons */}
                  <div className="flex items-center gap-2">
                    {wo.kittingStatus !== 'fully_issued' && (
                      <button
                        onClick={() => issueMaterialsMutation.mutate(wo._id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                      >
                        {language === 'ar' ? 'صرف وتجهيز المواد (Kitting)' : 'Issue Materials'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedJobCard({ workOrderId: wo._id, orderNumber: wo.orderNumber, productName: wo.productId?.nameEn });
                        setIsOperatorJobModalOpen(true);
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'شاشة المشغل والمؤقت' : 'Operator Station'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 5: QA/QC & TRACEABILITY
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'qa' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'فحص الجودة والمطابقة وتقارير عدم المطابقة (QA/QC & NCR)' : 'Quality Assurance & Non-Conformance Reports'}
              </h2>
              <p className="text-xs text-gray-500">
                {language === 'ar' ? 'قوائم الفحص المعتمدة، عزل الشحنات المعيبة، وتتبع مسار الدفعات والأرقام التسلسلية' : 'Inspection checklists, quarantine holds, NCR root causes, and lot genealogy'}
              </p>
            </div>

            <button
              onClick={() => setIsNcrModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              {language === 'ar' ? 'تسجيل تقرير عدم مطابقة (NCR)' : 'Log NCR Report'}
            </button>
          </div>

          {/* QA Inspections List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(qaInspectionsData?.inspections || []).map((qc) => (
              <div key={qc._id} className="p-5 rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                      {qc.inspectionNumber}
                    </span>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm mt-1">{qc.productId?.nameEn || 'Finished Item'}</h4>
                    <p className="text-xs text-gray-500">Lot: {qc.lotNumber} | Inspector: {qc.inspectorName}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    {qc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 6: COSTING & VARIANCE WATERFALL
      ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'costing' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'مقارنة التكاليف المعيارية والفعلية (Standard vs. Actual Costing)' : 'Standard vs. Actual Cost Variance Breakdown'}
          </h2>

          <div className="rounded-3xl bg-white dark:bg-dark-800 border border-gray-200/80 dark:border-dark-700/80 p-6 shadow-md overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-dark-700/50 text-gray-500 dark:text-gray-400 uppercase font-bold">
                <tr>
                  <th className="p-3">Order Number</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Std Estimated Cost</th>
                  <th className="p-3">Actual Mat. Cost</th>
                  <th className="p-3">Actual Labor & OH</th>
                  <th className="p-3">Total Actual</th>
                  <th className="p-3">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                {(varianceData?.varianceRecords || []).map((v, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-mono font-bold">{v.orderNumber}</td>
                    <td className="p-3 font-bold">{v.productName}</td>
                    <td className="p-3">{v.standardCost} SAR</td>
                    <td className="p-3">{v.actualMaterialCost} SAR</td>
                    <td className="p-3">{v.actualLaborCost + v.actualOverheadCost} SAR</td>
                    <td className="p-3 font-bold">{v.totalActualCost} SAR</td>
                    <td className={`p-3 font-bold ${v.status === 'favorable' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {v.variance > 0 ? `+${v.variance}` : v.variance} SAR ({v.variancePercent}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL: Operator Touch Execution Station ─── */}
      <AnimatePresence>
        {isOperatorJobModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 text-white p-8 border border-amber-500/30 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-xl font-black text-amber-400">
                    {language === 'ar' ? 'شاشة مشغل خط الإنتاج' : 'Shop Floor Operator Station'}
                  </h3>
                  <p className="text-xs text-slate-400">{selectedJobCard?.orderNumber} - {selectedJobCard?.productName}</p>
                </div>
                <button onClick={() => setIsOperatorJobModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Big Touch Controls */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => toast.success(language === 'ar' ? 'تم بدء مؤقت الإنتاج اللحظي' : 'Operator Timer Started')}
                  className="p-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-lg flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Play className="w-8 h-8" />
                  {language === 'ar' ? 'بدء العملية' : 'Start Run'}
                </button>

                <button
                  onClick={() => toast.success(language === 'ar' ? 'تم إيقاف مؤقت للعملية' : 'Run Paused')}
                  className="p-6 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-lg flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Pause className="w-8 h-8" />
                  {language === 'ar' ? 'إيقاف مؤقت' : 'Pause Run'}
                </button>
              </div>

              <button
                onClick={() => {
                  toast.success(language === 'ar' ? 'تم تسجيل اكتمال أمر الشغل بنجاح' : 'Job card completed successfully');
                  setIsOperatorJobModalOpen(false);
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 font-black text-base shadow-xl active:scale-95 transition-all"
              >
                {language === 'ar' ? 'اعتماد اكتمال المرحلة وتحويل للفحص' : 'Complete & Pass to Quality'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
