import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
const t = (key, opts) => opts?.defaultValue || key;

import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { StatusBadge } from './components/ui/Badge';
import { Modal } from './components/ui/Modal';
import { ConfirmModal } from './components/ui/ConfirmModal';
import DemoBlockedModal from './components/ui/DemoBlockedModal';
import { Table, Thead, Tbody, Tr, Th, Td } from './components/ui/Table';
import { Plus, Search, UserPlus, Trash2, Printer, X, Eye, Send, MessageCircle, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import SARIcon from './components/ui/SARIcon';
import toast from 'react-hot-toast';
import { formatSaudiRiyal } from './utils/saudi';
import ThermalReceipt from '../../components/ui/ThermalReceipt';
import { printThermalElement, getThermalPrinterSettings } from '../../lib/thermalPrinter';

const Stitchings = () => {
  
  const { user, tenant } = useSelector(state => state.auth);
  const { language } = useSelector(state => state.ui);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [stitchings, setStitchings] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignModal, setAssignModal] = useState({ open: false, stitching: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, stitching: null, loading: false });
  const [demoBlockedOpen, setDemoBlockedOpen] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState({ open: false, stitching: null, loading: false });
  const tutorialInvoiceOpenedRef = React.useRef(false);
  const searchDebounceRef = useRef(null);
  const fetchRequestIdRef = useRef(0);
  const printRef = useRef(null);
  const [printOrder, setPrintOrder] = useState(null);


  const [waModalInvoice, setWaModalInvoice] = useState(null);
  const [waPhone, setWaPhone] = useState('');
  const [waLoadingId, setWaLoadingId] = useState(null);
  const [waMessageLang, setWaMessageLang] = useState('both');
  const [waMessage, setWaMessage] = useState('');
  const [sendingWaModal, setSendingWaModal] = useState(false);
  const waPrintRef = useRef(null);

  const isDemo = !!user?.isDemoSession;
  const langKey = (language || 'en').split('-')[0];

  const resolveUploadsUrl = (src) => {
    if (!src) return src;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    if (!src.startsWith('/uploads/')) return src;
    const baseUrl = api?.defaults?.baseURL;
    if (!baseUrl || typeof baseUrl !== 'string') return src;
    try {
      if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
        return `${new URL(baseUrl).origin}${src}`;
      }
    } catch (error) {
      return src;
    }
    return src;
  };

  const buildUploadedImageSrc = (src, updatedAt) => {
    const resolved = resolveUploadsUrl(src);
    if (!resolved) return '';
    const separator = resolved.includes('?') ? '&' : '?';
    return updatedAt ? `${resolved}${separator}v=${updatedAt}` : resolved;
  };

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearchInput((prev) => (prev === q ? prev : q));
    setSearch((prev) => (prev === q ? prev : q));
  }, [searchParams]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        return prev === next ? prev : next;
      });
    }, 120);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchInput]);

  useEffect(() => {
    const isTutorial = (searchParams.get('tutorial') || '') === '1';
    const shouldOpen = (searchParams.get('invoice') || '') === '1';
    const orderId = String(searchParams.get('orderId') || '').trim();
    if (!isTutorial) return;
    if (!shouldOpen) return;
    if (!orderId) return;
    if (tutorialInvoiceOpenedRef.current) return;
    tutorialInvoiceOpenedRef.current = true;

    const openInvoice = async () => {
      setInvoiceModal({ open: true, stitching: null, loading: true });
      try {
        const resp = await api.get(`/khayyat/stitchings/${orderId}`);
        const s = resp.data?.stitching || resp.data;
        setInvoiceModal({ open: true, stitching: s || null, loading: false });
      } catch (e) {
        setInvoiceModal({ open: false, stitching: null, loading: false });
      }
    };

    openInvoice();
  }, [api, searchParams]);

  useEffect(() => {
    if (location.state?.autoPrintOrder) {
      setPrintOrder(location.state.autoPrintOrder);
      window.history.replaceState({}, document.title);
      setTimeout(() => {
        if (printRef.current) {
          window.print();
        }
      }, 500);
    }
  }, [location]);

  const fetchData = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    try {
      setLoading(true);
      const params = new window.URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      
      const [stitchRes, workersRes] = await Promise.all([
        api.get(`/khayyat/stitchings?${params}`),
        api.get('/khayyat/worker')
      ]);
      if (requestId !== fetchRequestIdRef.current) {
        return;
      }
      const stitchData = stitchRes.data;
      const workerData = workersRes.data;
      setStitchings(Array.isArray(stitchData) ? stitchData : stitchData.stitchings || []);
      setWorkers(Array.isArray(workerData) ? workerData : workerData.workers || []);
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) {
        return;
      }
      console.error('Error:', error);
      setStitchings([]);
      setWorkers([]);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [api, search, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async (workerId) => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    try {
      await api.put(`/khayyat/stitchings/${assignModal.stitching._id}/assign`, { workerId });
      toast.success('Worker assigned');
      setAssignModal({ open: false, stitching: null });
      fetchData();
    } catch (error) {
      toast.error('Failed to assign');
    }
  };

  const requestDelete = (stitching) => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    setDeleteModal({ open: true, stitching, loading: false });
  };

  const closeDelete = () => {
    setDeleteModal({ open: false, stitching: null, loading: false });
  };

  const confirmDelete = async () => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      closeDelete();
      return;
    }
    const id = deleteModal?.stitching?._id;
    if (!id) {
      closeDelete();
      return;
    }
    setDeleteModal((p) => ({ ...p, loading: true }));
    try {
      await api.delete(`/khayyat/stitchings/${id}`);
      toast.success('Deleted');
      closeDelete();
      fetchData();
    } catch (error) {
      toast.error('Failed to delete');
      setDeleteModal((p) => ({ ...p, loading: false }));
    }
  };

  const handleStatusChange = async (id, status) => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    try {
      await api.put(`/khayyat/stitchings/${id}`, { status });
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handlePrintLabel = async (stitch) => {
    setPrintOrder(stitch);
  };

  const [sendingWa, setSendingWa] = useState(false);
  const handleSendWhatsApp = async () => {
    if (!printOrder || !printRef.current) return;
    try {
      const status = await api.get('/whatsapp/client/status').then(r => r.data);
      if (status?.status !== 'READY') {
        toast.error(language === 'ar' ? 'الرجاء ربط واتساب أولاً من صفحة واتساب' : 'Please connect WhatsApp first from the WhatsApp page');
        return;
      }

      const phone = printOrder.customerPhone || printOrder.customerId?.phone;
      if (!phone) {
        toast.error(language === 'ar' ? 'رقم هاتف العميل غير موجود' : 'Customer phone number missing');
        return;
      }
      
      setSendingWa(true);
      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2, width: element.offsetWidth || 300, windowWidth: 300 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, (canvas.height * 80) / canvas.width]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 80, (canvas.height * 80) / canvas.width);
      
      const orderNum = printOrder.receiptNumber || printOrder.orderNumber || printOrder._id?.slice(-6) || '';
      const pdfBlob = pdf.output('blob');
      
      const formData = new window.FormData();
      formData.append('pdf', pdfBlob, `Invoice-${orderNum}.pdf`);
      formData.append('phoneNumber', phone);
      
      const customerName = printOrder.customerId?.nameI18n?.ar || printOrder.customerName || printOrder.customerId?.name || '';
      const paid = Number(printOrder.paidAmount || 0).toFixed(2);
      const price = Number(printOrder.price || 0).toFixed(2);
      const pending = Math.max(0, price - paid).toFixed(2);
      
      const tNameAr = tenant?.nameAr || tenant?.name || '';
      const tNameEn = tenant?.name || tenant?.nameAr || '';
      
      const captionText = language === 'ar' 
        ? `شكرًا لك، ${customerName}، لاختيارك ${tNameAr}.\n\nالإجمالي: ${price} SAR\n\nالمدفوع: ${paid} SAR\n\nالمتبقي: ${pending} SAR\n\nيسعدنا دائمًا طهيك بجميل اختيارك.`
        : `Thank you, ${customerName}, for choosing ${tNameEn}.\n\nTotal: ${price} SAR\n\nPaid: ${paid} SAR\n\nBalance: ${pending} SAR\n\nWe appreciate your patronage.`;
      
      formData.append('caption', captionText);
      
      await api.post('/whatsapp/client/send-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(language === 'ar' ? 'تم الإرسال بنجاح' : 'Sent successfully');
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error sending'));
    }
    setSendingWa(false);
  };

  const handleWaClick = async (stitch) => {
    try {
      setWaLoadingId(stitch._id);
      const status = await api.get('/whatsapp/client/status').then(r => r.data);
      if (status?.status !== 'READY') {
        toast.error(language === 'ar' ? 'الرجاء ربط واتساب أولاً من صفحة واتساب' : 'Please connect WhatsApp first from the WhatsApp page');
        return;
      }
      
      const phone = stitch.customerPhone || stitch.customerId?.phone || '';
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
        cleanPhone = '966' + cleanPhone.substring(1);
      }
      setWaPhone(cleanPhone);
      
      const customerName = stitch.customerId?.nameI18n?.ar || stitch.customerName || stitch.customerId?.name || '';
      const paid = Number(stitch.paidAmount || 0).toFixed(2);
      const price = Number(stitch.price || 0).toFixed(2);
      const pending = Math.max(0, price - paid).toFixed(2);
      const tNameAr = tenant?.nameAr || tenant?.name || '';
      const tNameEn = tenant?.name || tenant?.nameAr || '';
      
      let initialLang = language === 'ar' ? 'ar' : 'en';
      setWaMessageLang(initialLang);
      
      const msgAr = `شكرًا لك، ${customerName}، لاختيارك ${tNameAr}.\n\nالإجمالي: ${price} SAR\n\nالمدفوع: ${paid} SAR\n\nالمتبقي: ${pending} SAR\n\nيسعدنا دائمًا طهيك بجميل اختيارك.`;
      const msgEn = `Thank you, ${customerName}, for choosing ${tNameEn}.\n\nTotal: ${price} SAR\n\nPaid: ${paid} SAR\n\nBalance: ${pending} SAR\n\nWe appreciate your patronage.`;
      
      if (initialLang === 'ar') {
        setWaMessage(msgAr);
      } else {
        setWaMessage(msgEn);
      }
      
      setWaModalInvoice(stitch);
    } catch (e) {
      toast.error(language === 'ar' ? 'الرجاء ربط واتساب أولاً من صفحة واتساب' : 'Please connect WhatsApp first from the WhatsApp page');
    } finally {
      setWaLoadingId(null);
    }
  };

  const sendWaMutation = async () => {
    if (!waModalInvoice || !waPhone || !waPrintRef.current) return;
    setSendingWaModal(true);
    try {
      const element = waPrintRef.current;
      const canvas = await html2canvas(element, { scale: 2, width: element.offsetWidth || 300, windowWidth: 300 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, (canvas.height * 80) / canvas.width]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 80, (canvas.height * 80) / canvas.width);
      
      const orderNum = waModalInvoice.receiptNumber || waModalInvoice.orderNumber || waModalInvoice._id?.slice(-6) || '';
      const pdfBlob = pdf.output('blob');
      
      const formData = new window.FormData();
      formData.append('pdf', pdfBlob, `Invoice-${orderNum}.pdf`);
      formData.append('phoneNumber', waPhone);
      formData.append('caption', waMessage);
      
      await api.post('/whatsapp/client/send-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(language === 'ar' ? 'تم الإرسال بنجاح' : 'Sent successfully');
      setWaModalInvoice(null);
    } catch (e) {
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'حدث خطأ في الإرسال' : 'Error sending'));
    }
    setSendingWaModal(false);
  };


  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">{(language === 'ar' ? 'الخياطة' : 'Stitchings')}</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="secondary" onClick={() => navigate('/app/dashboard/khayyat/complete-order')} icon={CheckCircle} className="w-full sm:w-auto">
            {(language === 'ar' ? 'إكمال طلب' : 'Complete Order')}
          </Button>
          <Button data-tutorial="stitchings-create-button" variant="success" onClick={() => (isDemo ? setDemoBlockedOpen(true) : navigate('/app/dashboard/khayyat/stitchings/new'))} icon={Plus} className="w-full sm:w-auto">
            {(language === 'ar' ? 'إنشاء طلب' : 'Create Order')}
          </Button>
        </div>
      </div>

      <Card className="p-4">

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by invoice, customer, or phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div className="flex overflow-x-auto gap-2 pb-1 custom-scrollbar mt-4">
          {[
            { value: '', label: (language === 'ar' ? 'الكل' : 'All') },
            { value: 'pending', label: (language === 'ar' ? 'قيد الانتظار' : 'Pending') },
            { value: 'assigned', label: (language === 'ar' ? 'معين' : 'Assigned') },
            { value: 'in_progress', label: (language === 'ar' ? 'قيد التنفيذ' : 'In Progress') },
            { value: 'completed', label: (language === 'ar' ? 'مكتمل' : 'Completed') },
            { value: 'delivered', label: (language === 'ar' ? 'مُسلَّم' : 'Delivered') }
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      <Modal
        isOpen={invoiceModal.open}
        onClose={() => setInvoiceModal({ open: false, stitching: null, loading: false })}
        title={(language === 'ar' ? 'stitchings.invoice' : 'stitchings.invoice')}
        size="lg"
      >
        <div data-tutorial="invoice-preview-modal" className="space-y-4">
          {invoiceModal.loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : invoiceModal.stitching ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'رقم الإيصال' : 'Receipt Number')}</div>
                    <div className="text-lg font-bold text-gray-900 dark:text-slate-100">#{invoiceModal.stitching.receiptNumber || invoiceModal.stitching._id?.slice(-6)}</div>
                    {invoiceModal.stitching.oldInvoiceNumber ? (
                      <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">Old invoice: {invoiceModal.stitching.oldInvoiceNumber}</div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'الحالة' : 'Status')}</div>
                    <div className="mt-1 inline-block">
                      <StatusBadge status={invoiceModal.stitching.status} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'العميل' : 'Customer')}</div>
                  <div className="mt-1 font-semibold text-gray-900 dark:text-slate-100">
                    {invoiceModal.stitching.customerId?.nameI18n?.[langKey] || invoiceModal.stitching.customerName || invoiceModal.stitching.customerId?.name || '-'}
                  </div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                    {invoiceModal.stitching.customerPhone || invoiceModal.stitching.customerId?.phone || '-'}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date')}</div>
                  <div className="mt-1 font-semibold text-gray-900 dark:text-slate-100">
                    {invoiceModal.stitching.dueDate ? new Date(invoiceModal.stitching.dueDate).toLocaleDateString() : '-'}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'الكمية' : 'Quantity')}</div>
                  <div className="mt-1 font-semibold text-gray-900 dark:text-slate-100">
                    {invoiceModal.stitching.quantity || 1}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'السعر' : 'Price')}</div>
                    <div className="mt-1 font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1">
                      {formatSaudiRiyal(invoiceModal.stitching.price || 0)} <SARIcon className="w-3 h-3" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'stitchings.paid' : 'stitchings.paid')}</div>
                    <div className="mt-1 font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1">
                      {formatSaudiRiyal(invoiceModal.stitching.paidAmount || 0)} <SARIcon className="w-3 h-3" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'stitchings.pending' : 'stitchings.pending')}</div>
                    <div className="mt-1 font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1">
                      {formatSaudiRiyal(Math.max(0, (Number(invoiceModal.stitching.price) || 0) - (Number(invoiceModal.stitching.paidAmount) || 0)))} <SARIcon className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>

              {invoiceModal.stitching.notes ? (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-4">
                  <div className="text-xs text-amber-700 dark:text-amber-300">Notes</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm text-amber-950 dark:text-amber-100">
                    {invoiceModal.stitching.notes}
                  </div>
                </div>
              ) : null}

              {invoiceModal.stitching.measurementImage ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <img
                    src={buildUploadedImageSrc(invoiceModal.stitching.measurementImage, invoiceModal.stitching.measurementImageUpdatedAt)}
                    alt="Measurement"
                    className="h-64 w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setInvoiceModal({ open: false, stitching: null, loading: false })}>
                  {(language === 'ar' ? 'إغلاق' : 'Close')}
                </Button>
                <Button onClick={() => handlePrintLabel(invoiceModal.stitching)} icon={Printer}>
                  {(language === 'ar' ? 'stitchings.printLabel' : 'stitchings.printLabel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'لا توجد بيانات' : 'No data available')}</div>
          )}
        </div>
      </Modal>

      {/* Hidden ThermalReceipt for WhatsApp Modal */}
      {waModalInvoice && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '302px' }}>
          <div className="bg-white w-[302px] flex justify-center">
            <ThermalReceipt ref={waPrintRef} order={waModalInvoice} type="khayyat" />
          </div>
        </div>
      )}

      <Modal
        isOpen={!!waModalInvoice}
        onClose={() => setWaModalInvoice(null)}
        title={language === 'ar' ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
      >
        <div className="space-y-4 p-2">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-slate-300 block mb-1">
              {language === 'ar' ? 'رقم الهاتف (مع رمز الدولة)' : 'Phone Number (with country code)'}
            </label>
            <input
              type="text"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="9665XXXXXXXX"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              dir="ltr"
            />
            <p className="text-xs text-gray-500 mt-1">
              {language === 'ar' ? 'مثال: 9665XXXXXXXX' : 'Example: 9665XXXXXXXX'}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                {language === 'ar' ? 'رسالة الفاتورة' : 'Invoice Message'}
              </label>
              <select
                value={waMessageLang}
                onChange={(e) => {
                  const newLang = e.target.value;
                  setWaMessageLang(newLang);
                  const customerName = waModalInvoice?.customerId?.nameI18n?.ar || waModalInvoice?.customerName || waModalInvoice?.customerId?.name || '';
                  const paid = Number(waModalInvoice?.paidAmount || 0).toFixed(2);
                  const price = Number(waModalInvoice?.price || 0).toFixed(2);
                  const pending = Math.max(0, price - paid).toFixed(2);
                  const tNameAr = tenant?.nameAr || tenant?.name || '';
                  const tNameEn = tenant?.name || tenant?.nameAr || '';
                  
                  const msgAr = `شكرًا لك، ${customerName}، لاختيارك ${tNameAr}.\n\nالإجمالي: ${price} SAR\n\nالمدفوع: ${paid} SAR\n\nالمتبقي: ${pending} SAR\n\nيسعدنا دائمًا طهيك بجميل اختيارك.`;
                  const msgEn = `Thank you, ${customerName}, for choosing ${tNameEn}.\n\nTotal: ${price} SAR\n\nPaid: ${paid} SAR\n\nBalance: ${pending} SAR\n\nWe appreciate your patronage.`;
                  if (newLang === 'ar') setWaMessage(msgAr);
                  else if (newLang === 'en') setWaMessage(msgEn);
                  else setWaMessage(`${msgAr}\n\n${msgEn}`);
                }}
                className="text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded py-1 px-2 text-gray-700 dark:text-slate-300 outline-none"
              >
                <option value="both">{language === 'ar' ? 'عربي وإنجليزي' : 'Arabic & English'}</option>
                <option value="ar">عربي</option>
                <option value="en">English</option>
              </select>
            </div>
            <textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[120px]"
              dir={waMessageLang === 'ar' ? 'rtl' : 'ltr'}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setWaModalInvoice(null)}
              disabled={sendingWaModal}
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={sendWaMutation}
              disabled={!waPhone || sendingWaModal}
              icon={sendingWaModal ? null : Send}
            >
              {sendingWaModal ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              {language === 'ar' ? 'إرسال' : 'Send'}
            </Button>
          </div>
        </div>
      </Modal>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : stitchings.length > 0 ? (
          <Table>
            <Thead>
              <Tr>
                <Th>{(language === 'ar' ? 'رقم الإيصال' : 'Receipt Number')}</Th>
                <Th>{(language === 'ar' ? 'العميل' : 'Customer')}</Th>
                <Th>{(language === 'ar' ? 'العامل' : 'Worker')}</Th>
                <Th>{(language === 'ar' ? 'الكمية' : 'Quantity')}</Th>
                <Th>{(language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date')}</Th>
                <Th>{(language === 'ar' ? 'السعر' : 'Price')}</Th>
                <Th>Payment</Th>
                <Th>{(language === 'ar' ? 'الحالة' : 'Status')}</Th>
                <Th>{(language === 'ar' ? 'إجراءات' : 'Actions')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {stitchings.map((stitch) => (
                <Tr key={stitch._id}>
                  <Td className="font-medium">
                    <div>{stitch.receiptNumber}</div>
                    {stitch.oldInvoiceNumber ? (
                      <div className="text-xs font-normal text-amber-600 dark:text-amber-400">Old: {stitch.oldInvoiceNumber}</div>
                    ) : null}
                  </Td>
                  <Td>
                    <div>
                      <p className="font-medium">{stitch.customerId?.nameI18n?.[langKey] || stitch.customerName || stitch.customerId?.name || '-'}</p>
                      {stitch.customerId?.phone && (
                        <p className="text-xs text-gray-500 dark:text-slate-400" dir="ltr">{stitch.customerId.phone}</p>
                      )}
                      {stitch.customerId?.khayyatReceiptNumbers && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 break-all whitespace-pre-wrap max-w-[200px]">
                          {language === 'ar' ? '\u0625\u064A\u0635\u0627\u0644\u0627\u062A \u0633\u0627\u0628\u0642\u0629' : 'Old Receipts'}: {stitch.customerId.khayyatReceiptNumbers}
                        </p>
                      )}
                      {stitch.orderFor && stitch.orderFor !== (stitch.customerName || stitch.customerId?.name) && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">For: {stitch.orderFor}</p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    {stitch.workerId ? (
                      <button
                        onClick={() => (isDemo ? setDemoBlockedOpen(true) : setAssignModal({ open: true, stitching: stitch }))}
                        className="group flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-all cursor-pointer"
                        title="Click to change worker"
                      >
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{(stitch.workerId.nameI18n?.[langKey] || stitch.workerId.name || '')?.charAt(0)}</span>
                        </div>
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium text-sm">{stitch.workerId.nameI18n?.[langKey] || stitch.workerId.name}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => (isDemo ? setDemoBlockedOpen(true) : setAssignModal({ open: true, stitching: stitch }))}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-lg transition-all"
                      >
                        <UserPlus className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                        <span className="text-primary-600 dark:text-primary-300 font-medium text-sm">{(language === 'ar' ? 'تعيين عامل' : 'Assign Worker')}</span>
                      </button>
                    )}
                  </Td>
                  <Td>{stitch.quantity}</Td>
                  <Td>
                    {(() => {
                      if (!stitch.dueDate) return <span className="text-gray-400 dark:text-slate-500">-</span>;
                      const due = new Date(stitch.dueDate);
                      const today = new Date();
                      const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
                      const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                      const diffDays = Math.round((dueMid - todayMid) / (1000 * 60 * 60 * 24));
                      const isOverdue = diffDays < 0 && stitch.status !== 'delivered';
                      return (
                        <div className={`text-sm font-medium ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-700 dark:text-slate-200'}`}>
                          {due.toLocaleDateString()}
                        </div>
                      );
                    })()}
                  </Td>
                  <Td className="flex items-center gap-1">{formatSaudiRiyal(stitch.price || 0)} <SARIcon className="w-3 h-3" /></Td>
                  <Td>
                    {stitch.status === 'delivered' ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 shadow-lg shadow-slate-500/20">
                        <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xs font-bold text-white tracking-wide">PAID</span>
                      </div>
                    ) : (parseFloat(stitch.paidAmount) || 0) >= (parseFloat(stitch.price) || 0) ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30">
                        <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-xs font-bold text-white tracking-wide">PAID</span>
                      </div>
                    ) : (parseFloat(stitch.paidAmount) || 0) > 0 ? (
                      <div className="flex flex-col gap-1 items-start">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                          <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-white tracking-wide">PARTIAL</span>
                        </div>
                        <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          Pending: {formatSaudiRiyal(Math.max(0, (parseFloat(stitch.price) || 0) - (parseFloat(stitch.paidAmount) || 0)))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 items-start">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 shadow-lg shadow-rose-500/30">
                          <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-xs font-bold text-white tracking-wide">PENDING</span>
                        </div>
                        <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          Pending: {formatSaudiRiyal(stitch.price || 0)}
                        </div>
                      </div>
                    )}
                  </Td>
                  <Td>
                    <select
                      value={stitch.status}
                      onChange={(e) => handleStatusChange(stitch._id, e.target.value)}
                      disabled={isDemo}
                      className="text-sm bg-transparent border-none cursor-pointer text-gray-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="pending">{(language === 'ar' ? 'قيد الانتظار' : 'Pending')}</option>
                      <option value="assigned">{(language === 'ar' ? 'معين' : 'Assigned')}</option>
                      <option value="in_progress">{(language === 'ar' ? 'قيد التنفيذ' : 'In Progress')}</option>
                      <option value="completed">{(language === 'ar' ? 'مكتمل' : 'Completed')}</option>
                      <option value="delivered">{(language === 'ar' ? 'مُسلَّم' : 'Delivered')}</option>
                    </select>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (stitch.measurementImage) {
                            window.open(stitch.measurementImage, '_blank');
                          } else {
                            navigate(`/user/stitchings/${stitch._id}/edit`);
                          }
                        }}
                        className="p-2 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-sky-600 dark:text-sky-400 rounded-lg"
                        title={(language === 'ar' ? 'عرض المقاسات' : 'View Measurement')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePrintLabel(stitch)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-lg"
                        title="Print Label"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleWaClick(stitch)}
                        disabled={waLoadingId === stitch._id}
                        className="p-2 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-500 rounded-lg transition-colors"
                        title={language === 'ar' ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
                      >
                        {waLoadingId === stitch._id ? (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => requestDelete(stitch)}
                        disabled={isDemo}
                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        ) : (
          <div className="p-12 text-center text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'لا توجد بيانات' : 'No data available')}</div>
        )}
      </Card>

      {/* Assign Worker Modal */}
      <Modal 
        isOpen={assignModal.open} 
        onClose={() => setAssignModal({ open: false, stitching: null })} 
        title={(language === 'ar' ? 'تعيين عامل' : 'Assign Worker')}
      >
        <div className="space-y-3">
          {workers.filter(w => w.isActive).map((worker) => (
            <button
              key={worker._id}
              onClick={() => handleAssign(worker._id)}
              className="w-full p-4 bg-gray-50 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-3 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <span className="text-emerald-700 dark:text-emerald-200 font-medium">{(worker.nameI18n?.[langKey] || worker.name || '')?.charAt(0)}</span>
              </div>
              <div className="text-left">
                <p className="font-medium">{worker.nameI18n?.[langKey] || worker.name}</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">{worker.phone}</p>
              </div>
            </button>
          ))}
          {workers.filter(w => w.isActive).length === 0 && (
            <p className="text-center text-gray-500 dark:text-slate-400 py-4">{(language === 'ar' ? 'لا توجد بيانات' : 'No data available')}</p>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={closeDelete}
        title={(language === 'ar' ? 'حذف' : 'Delete')}
        message={(language === 'ar' ? 'stitchings.deleteConfirmTitle' : 'stitchings.deleteConfirmTitle')}
        subtitle={(language === 'ar' ? 'stitchings.deleteConfirmSubtitle' : 'stitchings.deleteConfirmSubtitle')}
        confirmText={(language === 'ar' ? 'حذف' : 'Delete')}
        cancelText={(language === 'ar' ? 'إلغاء' : 'Cancel')}
        confirmVariant="danger"
        loading={deleteModal.loading}
        onConfirm={confirmDelete}
        previewTitle={`#${deleteModal?.stitching?.receiptNumber || deleteModal?.stitching?._id?.slice(-6) || ''}`}
        previewSubtitle={`${deleteModal?.stitching?.customerId?.nameI18n?.[langKey] || deleteModal?.stitching?.customerName || deleteModal?.stitching?.customerId?.name || ''}${(deleteModal?.stitching?.customerPhone || deleteModal?.stitching?.customerId?.phone) ? ` • ${deleteModal.stitching.customerPhone || deleteModal.stitching.customerId.phone}` : ''}`}
      />

      <DemoBlockedModal
        isOpen={demoBlockedOpen}
        onClose={() => setDemoBlockedOpen(false)}
        title="Live Demo"
        phone="+966596775485"
      />

      {/* Print Modal for ThermalReceipt */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-[400px] mx-4 max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:w-auto print:max-h-none print:overflow-visible">
            <div className="flex justify-between items-center mb-4 print:hidden">
              <h3 className="text-lg font-bold">{(language === 'ar' ? 'إيصال الطلب' : 'Order Receipt')}</h3>
              <button onClick={() => setPrintOrder(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-2 print:border-none print:p-0 flex justify-center">
              <ThermalReceipt ref={printRef} order={printOrder} type="khayyat" />
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <button onClick={() => setPrintOrder(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 flex-1">
                {(language === 'ar' ? 'إغلاق' : 'Close')}
              </button>
              <button 
                onClick={handleSendWhatsApp}
                disabled={sendingWa}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white flex-1 disabled:opacity-50"
              >
                {sendingWa ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {(language === 'ar' ? 'إرسال واتساب' : 'Send WhatsApp')}
              </button>
              <button onClick={() => {
                if (printRef.current) {
                  printThermalElement(printRef.current, getThermalPrinterSettings(tenant));
                }
              }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white flex-1">
                {(language === 'ar' ? 'طباعة' : 'Print Receipt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stitchings;
