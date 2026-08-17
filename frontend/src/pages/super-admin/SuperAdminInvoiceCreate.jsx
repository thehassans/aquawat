import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { 
  ArrowLeft, Save, Plus, Trash2, Building2, User, FileText, 
  Receipt, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, 
  UploadCloud, Landmark, Sliders, Calendar, Clock, CreditCard,
  Printer, Check, Eye, HelpCircle
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { generateZatcaQrValue } from '../../lib/zatcaQr'
import { getAvailableUomOptions, getDefaultUom, getUomLabel } from '../../lib/uomOptions'

const DEFAULT_LINE_ITEM = {
  lineNumber: 1,
  productName: 'Professional Services',
  productNameAr: 'خدمات احترافية واستشارية',
  productType: 'service',
  description: '',
  descriptionAr: '',
  quantity: 1,
  unitCode: '',
  unitPrice: 100,
  discount: 0,
  discountType: 'fixed',
  taxRate: 15,
  taxCategory: 'S',
}

export default function SuperAdminInvoiceCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'

  // Fetch all tenants for dropdown & drag-drop matching
  const { data: tenantsData, isLoading: isLoadingTenants } = useQuery({
    queryKey: ['super-admin-tenants-lookup'],
    queryFn: () => api.get('/super-admin/tenants/lookup').then(res => res.data?.tenants || []),
    staleTime: 60 * 1000,
  })

  const tenants = tenantsData || []

  // Selected Tenant IDs
  const [selectedSellerTenantId, setSelectedSellerTenantId] = useState('')
  const [selectedBuyerTenantId, setSelectedBuyerTenantId] = useState('')
  const [buyerMode, setBuyerMode] = useState('tenant') // 'tenant' | 'custom'

  // Invoice Identification & Dates
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [transactionType, setTransactionType] = useState('B2B') // 'B2B' | 'B2C'
  const [invoiceTypeCode, setInvoiceTypeCode] = useState('0100000')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [issueTime, setIssueTime] = useState(new Date().toTimeString().slice(0, 5))
  const [supplyDate, setSupplyDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentStatus, setPaymentStatus] = useState('pending')
  const [paidAmount, setPaidAmount] = useState(0)
  const [currency, setCurrency] = useState('SAR')
  const [pdfTemplateId, setPdfTemplateId] = useState(1)

  // Seller State
  const [seller, setSeller] = useState({
    name: 'Maqder Technologies Co.',
    nameAr: 'شركة مقدر للتقنية',
    tradeName: 'Maqder ERP',
    vatNumber: '300000000000003',
    crNumber: '1010000000',
    contactEmail: 'billing@maqder.com',
    contactPhone: '+966500000000',
    address: {
      street: 'King Fahd Road',
      streetAr: 'طريق الملك فهد',
      district: 'Al Olaya',
      districtAr: 'العليا',
      city: 'Riyadh',
      cityAr: 'الرياض',
      buildingNumber: '1234',
      additionalNumber: '5678',
      postalCode: '12214',
      country: 'SA',
    },
    bankDetails: {
      bankName: 'Al Rajhi Bank',
      accountName: 'Maqder Technologies Co.',
      accountNumber: '1234567890',
      iban: 'SA0080000000000000000000',
    },
    signatureUrl: '',
    stampUrl: '',
  })

  // Buyer State
  const [buyer, setBuyer] = useState({
    name: '',
    nameAr: '',
    tradeName: '',
    vatNumber: '',
    crNumber: '',
    contactEmail: '',
    contactPhone: '',
    address: {
      street: '',
      streetAr: '',
      district: '',
      districtAr: '',
      city: 'Riyadh',
      cityAr: 'الرياض',
      buildingNumber: '',
      additionalNumber: '',
      postalCode: '',
      country: 'SA',
    }
  })

  // Line Items
  const [lineItems, setLineItems] = useState([{ ...DEFAULT_LINE_ITEM }])
  const [invoiceDiscount, setInvoiceDiscount] = useState(0)
  const [termsAndConditions, setTermsAndConditions] = useState('')
  const [notes, setNotes] = useState('')
  const [includeBankDetails, setIncludeBankDetails] = useState(true)

  // Auto-fill Seller when Seller Tenant dropdown changes
  const applySellerTenant = useCallback((t) => {
    if (!t) return
    const b = t.business || {}
    const addr = b.address || {}
    const bank = b.bankDetails || {}
    const currentInvoiceBranding = t.settings?.invoiceBranding || {}

    setSeller({
      name: b.legalNameEn || t.name || '',
      nameAr: b.legalNameAr || t.name || '',
      tradeName: b.tradeName || '',
      vatNumber: b.vatNumber || '',
      crNumber: b.crNumber || b.commercialRegistration?.crNumber || '',
      contactEmail: b.contactEmail || b.email || '',
      contactPhone: b.contactPhone || b.phone || '',
      address: {
        street: addr.street || '',
        streetAr: addr.streetAr || '',
        district: addr.district || '',
        districtAr: addr.districtAr || '',
        city: addr.city || 'Riyadh',
        cityAr: addr.cityAr || 'الرياض',
        buildingNumber: addr.buildingNumber || '',
        additionalNumber: addr.additionalNumber || '',
        postalCode: addr.postalCode || '',
        country: addr.country || 'SA',
      },
      bankDetails: {
        bankName: bank.bankName || '',
        accountName: bank.accountName || '',
        accountNumber: bank.accountNumber || '',
        iban: bank.iban || '',
      },
      signatureUrl: currentInvoiceBranding.presetSignature || currentInvoiceBranding.signatureImage || '',
      stampUrl: currentInvoiceBranding.presetStamp || currentInvoiceBranding.stampImage || '',
    })

    if (t.settings?.termsAndConditions || currentInvoiceBranding.termsAndConditions) {
      setTermsAndConditions(t.settings?.termsAndConditions || currentInvoiceBranding.termsAndConditions)
    }
    if (t.settings?.notes || currentInvoiceBranding.defaultNotes) {
      setNotes(t.settings?.notes || currentInvoiceBranding.defaultNotes)
    }

    toast.success(isAr ? `تم ملء بيانات البائع من: ${t.name}` : `Seller details filled from: ${t.name}`)
  }, [isAr])

  const handleSellerTenantChange = (tenantId) => {
    setSelectedSellerTenantId(tenantId)
    if (!tenantId) return
    const t = tenants.find(item => item._id === tenantId)
    if (t) applySellerTenant(t)
  }

  // Auto-fill Buyer when Buyer Tenant dropdown changes
  const applyBuyerTenant = useCallback((t) => {
    if (!t) return
    const b = t.business || {}
    const addr = b.address || {}

    setBuyer({
      name: b.legalNameEn || t.name || '',
      nameAr: b.legalNameAr || t.name || '',
      tradeName: b.tradeName || '',
      vatNumber: b.vatNumber || '',
      crNumber: b.crNumber || b.commercialRegistration?.crNumber || '',
      contactEmail: b.contactEmail || b.email || '',
      contactPhone: b.contactPhone || b.phone || '',
      address: {
        street: addr.street || '',
        streetAr: addr.streetAr || '',
        district: addr.district || '',
        districtAr: addr.districtAr || '',
        city: addr.city || 'Riyadh',
        cityAr: addr.cityAr || 'الرياض',
        buildingNumber: addr.buildingNumber || '',
        additionalNumber: addr.additionalNumber || '',
        postalCode: addr.postalCode || '',
        country: addr.country || 'SA',
      }
    })

    // If buyer has VAT number, auto-set to B2B
    if (b.vatNumber) {
      setTransactionType('B2B')
      setInvoiceTypeCode('0100000')
    }

    toast.success(isAr ? `تم ملء بيانات المشتري من: ${t.name}` : `Buyer details filled from: ${t.name}`)
  }, [isAr])

  const handleBuyerTenantChange = (tenantId) => {
    setSelectedBuyerTenantId(tenantId)
    if (!tenantId) {
      setBuyer({
        name: '', nameAr: '', tradeName: '', vatNumber: '', crNumber: '',
        contactEmail: '', contactPhone: '',
        address: { street: '', streetAr: '', district: '', districtAr: '', city: 'Riyadh', cityAr: 'الرياض', buildingNumber: '', additionalNumber: '', postalCode: '', country: 'SA' }
      })
      return
    }
    const t = tenants.find(item => item._id === tenantId)
    if (t) applyBuyerTenant(t)
  }

  // Drag & Drop for Seller
  const onDropSeller = useCallback((acceptedFiles) => {
    const file = acceptedFiles?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        const data = JSON.parse(text)
        if (data) {
          // If it matches a tenant ID or payload
          if (data._id || data.business) {
            applySellerTenant(data)
          } else {
            setSeller(prev => ({
              ...prev,
              ...data,
              address: { ...(prev.address || {}), ...(data.address || {}) },
              bankDetails: { ...(prev.bankDetails || {}), ...(data.bankDetails || {}) }
            }))
            toast.success(isAr ? 'تم استيراد بيانات البائع بنجاح' : 'Seller data imported successfully')
          }
        }
      } catch (err) {
        toast.error(isAr ? 'فشل قراءة الملف - يرجى استخدام ملف JSON صالح' : 'Failed to parse JSON file')
      }
    }
    reader.readAsText(file)
  }, [applySellerTenant, isAr])

  const { getRootProps: getSellerDropProps, getInputProps: getSellerInputProps, isDragActive: isSellerDragActive } = useDropzone({
    onDrop: onDropSeller,
    accept: { 'application/json': ['.json'] },
    noClick: false
  })

  // Line item handlers
  const handleAddLine = () => {
    setLineItems(prev => [
      ...prev,
      {
        ...DEFAULT_LINE_ITEM,
        lineNumber: prev.length + 1,
      }
    ])
  }

  const handleRemoveLine = (index) => {
    if (lineItems.length <= 1) {
      toast.error(isAr ? 'يجب أن تحتوي الفاتورة على بند واحد على الأقل' : 'Invoice must have at least one line item')
      return
    }
    setLineItems(prev => prev.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, lineNumber: idx + 1 })))
  }

  const handleLineChange = (index, field, value) => {
    setLineItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0
    let totalTax = 0

    const computedLines = lineItems.map((item, idx) => {
      const qty = Math.max(0, Number(item.quantity) || 0)
      const price = Math.max(0, Number(item.unitPrice) || 0)
      const discount = Math.max(0, Number(item.discount) || 0)
      const isPercent = item.discountType === 'percentage'
      const lineDisc = isPercent ? (qty * price * (discount / 100)) : discount
      const taxable = Math.max(0, (qty * price) - lineDisc)
      const taxRate = item.taxRate !== undefined ? Number(item.taxRate) : 15
      const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2))
      const lineTotal = Number(taxable.toFixed(2))
      const lineTotalWithTax = Number((taxable + taxAmount).toFixed(2))

      subtotal += (qty * price)
      totalTax += taxAmount

      return {
        ...item,
        lineNumber: idx + 1,
        taxAmount,
        lineTotal,
        lineTotalWithTax
      }
    })

    const totalDisc = Math.max(0, Number(invoiceDiscount) || 0)
    const taxableAmount = Math.max(0, subtotal - totalDisc)
    const grandTotal = Number((taxableAmount + totalTax).toFixed(2))

    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalDiscount: totalDisc,
      taxableAmount: Number(taxableAmount.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      grandTotal,
      computedLines
    }
  }, [lineItems, invoiceDiscount])

  // Live ZATCA TLV QR Generation
  const liveZatcaQr = useMemo(() => {
    const sellerName = seller.nameAr || seller.name || 'Maqder'
    const vatNumber = seller.vatNumber || '300000000000003'
    const timestamp = issueDate && issueTime ? `${issueDate}T${issueTime}:00Z` : new Date().toISOString()
    const totalWithVat = calculations.grandTotal.toFixed(2)
    const vatTotal = calculations.totalTax.toFixed(2)

    return generateZatcaQrValue({
      sellerName,
      vatNumber,
      timestamp,
      totalWithVat,
      vatTotal
    })
  }, [seller.nameAr, seller.name, seller.vatNumber, issueDate, issueTime, calculations.grandTotal, calculations.totalTax])

  // Submit Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (payload) => api.post('/super-admin/invoices', payload),
    onSuccess: (res) => {
      toast.success(isAr ? `تم إصدار الفاتورة بنجاح: ${res.data?.invoiceNumber}` : `Invoice created successfully: ${res.data?.invoiceNumber}`)
      queryClient.invalidateQueries(['super-admin-invoices'])
      navigate('/super-admin/invoices')
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حفظ الفاتورة' : 'Failed to create invoice'))
    }
  })

  const handleSubmitInvoice = (status = 'issued') => {
    if (!seller.name && !seller.nameAr) {
      toast.error(isAr ? 'يرجى إدخال اسم البائع' : 'Seller name is required')
      return
    }
    if (!seller.vatNumber || seller.vatNumber.length !== 15) {
      toast.error(isAr ? 'الرقم الضريبي للبائع يجب أن يتكون من 15 رقماً' : 'Seller VAT number must be 15 digits')
      return
    }
    if (!buyer.name && !buyer.nameAr) {
      toast.error(isAr ? 'يرجى إدخال اسم المشتري' : 'Buyer name is required')
      return
    }
    if (transactionType === 'B2B' && (!buyer.vatNumber || buyer.vatNumber.length !== 15)) {
      toast.error(isAr ? 'الفواتير الضريبية B2B تتطلب رقماً ضريبياً للمشتري من 15 رقماً' : 'B2B invoices require a valid 15-digit Buyer VAT number')
      return
    }

    const payload = {
      sellerTenantId: selectedSellerTenantId || undefined,
      buyerTenantId: selectedBuyerTenantId || undefined,
      invoiceNumber: invoiceNumber || undefined,
      transactionType,
      invoiceTypeCode,
      issueDate,
      issueTime,
      supplyDate,
      dueDate,
      paymentMethod,
      paymentStatus: paidAmount >= calculations.grandTotal ? 'paid' : (paidAmount > 0 ? 'partial' : paymentStatus),
      paidAmount: Number(paidAmount || 0),
      currency,
      pdfTemplateId,
      seller,
      buyer,
      lineItems: calculations.computedLines,
      invoiceDiscount: calculations.totalDiscount,
      totalDiscount: calculations.totalDiscount,
      termsAndConditions,
      notes,
      status
    }

    createInvoiceMutation.mutate(payload)
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-dark-700 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/super-admin/invoices')}
            className="btn btn-ghost btn-icon"
            title={isAr ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{isAr ? 'إنشاء فاتورة مبيعات (ZATCA)' : 'Create Sell Invoice (ZATCA)'}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                {transactionType}
              </span>
            </h1>
            <p className="text-xs text-gray-500">
              {isAr ? 'إصدار فواتير بيع معتمدة ومطابقة لمتطلبات هيئة الزكاة والضريبة والجمارك مع الملء التلقائي' : 'Issue compliant tax invoices with automatic seller and buyer tenant resolution'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmitInvoice('draft')}
            disabled={createInvoiceMutation.isPending}
            className="btn btn-secondary text-xs font-bold"
          >
            {isAr ? 'حفظ كمسودة' : 'Save as Draft'}
          </button>

          <button
            type="button"
            onClick={() => handleSubmitInvoice('issued')}
            disabled={createInvoiceMutation.isPending}
            className="btn btn-primary text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ShieldCheck className="w-4 h-4" />
            {createInvoiceMutation.isPending ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ وإصدار الفاتورة' : 'Issue Invoice')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: FORM INPUTS (8 Cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* 1. INVOICE PROPERTIES CARD */}
          <div className="card p-6 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-3 dark:border-dark-700">
              <Sliders className="w-4 h-4 text-emerald-500" />
              {isAr ? 'بيانات وإعدادات الفاتورة' : 'Invoice Settings & Metadata'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">{isAr ? 'نوع المعاملة' : 'Transaction Type'}</label>
                <select
                  value={transactionType}
                  onChange={(e) => {
                    setTransactionType(e.target.value)
                    setInvoiceTypeCode(e.target.value === 'B2B' ? '0100000' : '0200000')
                  }}
                  className="select font-bold"
                >
                  <option value="B2B">{isAr ? 'B2B - فاتورة ضريبية قياسية (0100000)' : 'B2B - Standard Tax Invoice (0100000)'}</option>
                  <option value="B2C">{isAr ? 'B2C - فاتورة ضريبية مبسطة (0200000)' : 'B2C - Simplified Tax Invoice (0200000)'}</option>
                </select>
              </div>

              <div>
                <label className="label">{isAr ? 'تاريخ الإصدار' : 'Issue Date'}</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'وقت الإصدار' : 'Issue Time'}</label>
                <input
                  type="time"
                  value={issueTime}
                  onChange={(e) => setIssueTime(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'تاريخ التوريد' : 'Supply Date'}</label>
                <input
                  type="date"
                  value={supplyDate}
                  onChange={(e) => setSupplyDate(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="select"
                >
                  <option value="bank_transfer">{isAr ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                  <option value="cash">{isAr ? 'نقدي' : 'Cash'}</option>
                  <option value="card">{isAr ? 'بطاقة مدى / ائتمان' : 'Card / Mada'}</option>
                  <option value="credit">{isAr ? 'آجل / ذمم مدينة' : 'Credit'}</option>
                  <option value="cheque">{isAr ? 'شيك' : 'Cheque'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. SELLER DETAILS CARD WITH TENANT PICKER & DRAG-DROP */}
          <div className="card p-6 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 dark:border-dark-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                {isAr ? 'بيانات المورّد / البائع (Seller Party)' : 'Seller Details'}
              </h3>

              {/* Existing Tenant Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{isAr ? 'اختر من المنشآت:' : 'Select Tenant:'}</span>
                <select
                  value={selectedSellerTenantId}
                  onChange={(e) => handleSellerTenantChange(e.target.value)}
                  className="select !py-1 text-xs max-w-[220px]"
                >
                  <option value="">{isAr ? '-- منصة مقدر الافتراضية --' : '-- Default Platform --'}</option>
                  {tenants.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.business?.vatNumber ? `VAT: ${t.business.vatNumber.slice(-4)}` : t.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drag and Drop Zone Banner */}
            <div
              {...getSellerDropProps()}
              className={`p-3 rounded-2xl border-2 border-dashed transition-all text-center cursor-pointer flex items-center justify-center gap-3 ${
                isSellerDragActive 
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300' 
                  : 'border-gray-200 dark:border-dark-600 bg-gray-50/40 dark:bg-dark-900/30 hover:border-blue-400 text-gray-500'
              }`}
            >
              <input {...getSellerInputProps()} />
              <UploadCloud className="w-5 h-5 text-blue-500" />
              <p className="text-xs font-semibold">
                {isAr ? 'اسحب وأفلت ملف بيانات المنشأة (JSON) أو اختر منشأة لملء كافة الحقول تلقائياً' : 'Drag & drop tenant JSON or pick from dropdown to auto-fill all seller details'}
              </p>
            </div>

            {/* Seller Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{isAr ? 'اسم المنشأة البائعة (عربي)' : 'Seller Legal Name (Arabic)'} *</label>
                <input
                  type="text"
                  dir="rtl"
                  value={seller.nameAr}
                  onChange={(e) => setSeller(prev => ({ ...prev, nameAr: e.target.value }))}
                  placeholder="شركة فلان للتقنية"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">{isAr ? 'اسم المنشأة البائعة (إنجليزي)' : 'Seller Legal Name (English)'} *</label>
                <input
                  type="text"
                  value={seller.name}
                  onChange={(e) => setSeller(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Company Name LLC"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">{isAr ? 'الرقم الضريبي (VAT Number - 15 خانة)' : 'Seller VAT Number (15 digits)'} *</label>
                <input
                  type="text"
                  maxLength={15}
                  value={seller.vatNumber}
                  onChange={(e) => setSeller(prev => ({ ...prev, vatNumber: e.target.value.replace(/\D/g, '') }))}
                  placeholder="300000000000003"
                  className="input font-mono font-bold text-blue-600 dark:text-blue-400"
                  required
                />
              </div>

              <div>
                <label className="label">{isAr ? 'رقم السجل التجاري (CR Number)' : 'Seller CR Number'}</label>
                <input
                  type="text"
                  value={seller.crNumber}
                  onChange={(e) => setSeller(prev => ({ ...prev, crNumber: e.target.value }))}
                  placeholder="1010000000"
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'البريد الإلكتروني للتواصل' : 'Seller Contact Email'}</label>
                <input
                  type="email"
                  value={seller.contactEmail}
                  onChange={(e) => setSeller(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="input"
                  placeholder="billing@company.com"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'رقم الجوال / الهاتف' : 'Seller Contact Phone'}</label>
                <input
                  type="text"
                  value={seller.contactPhone}
                  onChange={(e) => setSeller(prev => ({ ...prev, contactPhone: e.target.value }))}
                  className="input font-mono"
                  placeholder="+966500000000"
                />
              </div>
            </div>

            {/* Address Subsection */}
            <div className="pt-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-3">
                {isAr ? 'العنوان الوطني للبائع (National Address)' : 'Seller National Address'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="label !text-[11px]">{isAr ? 'المدينة (عربي/EN)' : 'City'}</label>
                  <input
                    type="text"
                    value={seller.address.city}
                    onChange={(e) => setSeller(prev => ({ ...prev, address: { ...prev.address, city: e.target.value, cityAr: e.target.value } }))}
                    className="input !py-1.5"
                    placeholder="Riyadh / الرياض"
                  />
                </div>
                <div>
                  <label className="label !text-[11px]">{isAr ? 'الحي (عربي/EN)' : 'District'}</label>
                  <input
                    type="text"
                    value={seller.address.district}
                    onChange={(e) => setSeller(prev => ({ ...prev, address: { ...prev.address, district: e.target.value, districtAr: e.target.value } }))}
                    className="input !py-1.5"
                    placeholder="Al Olaya"
                  />
                </div>
                <div>
                  <label className="label !text-[11px]">{isAr ? 'اسم الشارع' : 'Street'}</label>
                  <input
                    type="text"
                    value={seller.address.street}
                    onChange={(e) => setSeller(prev => ({ ...prev, address: { ...prev.address, street: e.target.value, streetAr: e.target.value } }))}
                    className="input !py-1.5"
                    placeholder="King Fahd Rd"
                  />
                </div>
                <div>
                  <label className="label !text-[11px]">{isAr ? 'رقم المبنى والرمز' : 'Bldg / Postal'}</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={seller.address.buildingNumber}
                      onChange={(e) => setSeller(prev => ({ ...prev, address: { ...prev.address, buildingNumber: e.target.value } }))}
                      className="input !py-1.5 w-1/2"
                      placeholder="1234"
                    />
                    <input
                      type="text"
                      value={seller.address.postalCode}
                      onChange={(e) => setSeller(prev => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }))}
                      className="input !py-1.5 w-1/2"
                      placeholder="12214"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. BUYER DETAILS CARD WITH TENANT DROPDOWN */}
          <div className="card p-6 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 dark:border-dark-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-purple-500" />
                {isAr ? 'بيانات العميل / المشتري (Buyer Party)' : 'Buyer Details'}
              </h3>

              {/* Buyer Tenant Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{isAr ? 'اختر مشتري من المنشآت:' : 'Choose Buyer Tenant:'}</span>
                <select
                  value={selectedBuyerTenantId}
                  onChange={(e) => handleBuyerTenantChange(e.target.value)}
                  className="select !py-1 text-xs max-w-[220px]"
                >
                  <option value="">{isAr ? '-- إدخال يدوي / عميل خارجي --' : '-- Manual / External Buyer --'}</option>
                  {tenants.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.business?.vatNumber ? `VAT: ${t.business.vatNumber.slice(-4)}` : t.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buyer Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{isAr ? 'اسم العميل / المشتري (عربي)' : 'Buyer Legal Name (Arabic)'} *</label>
                <input
                  type="text"
                  dir="rtl"
                  value={buyer.nameAr}
                  onChange={(e) => setBuyer(prev => ({ ...prev, nameAr: e.target.value }))}
                  placeholder="مؤسسة العميل / عميل نقدي"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">{isAr ? 'اسم العميل / المشتري (إنجليزي)' : 'Buyer Legal Name (English)'} *</label>
                <input
                  type="text"
                  value={buyer.name}
                  onChange={(e) => setBuyer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Buyer Enterprise / Cash Customer"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">
                  {isAr ? 'الرقم الضريبي للمشتري (VAT)' : 'Buyer VAT Number'} {transactionType === 'B2B' && <span className="text-rose-500">* (B2B)</span>}
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={buyer.vatNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')
                    setBuyer(prev => ({ ...prev, vatNumber: val }))
                    if (val.length === 15 && transactionType !== 'B2B') {
                      setTransactionType('B2B')
                      setInvoiceTypeCode('0100000')
                    }
                  }}
                  placeholder="300000000000003"
                  className="input font-mono font-bold text-purple-600 dark:text-purple-400"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'رقم السجل التجاري (CR Number)' : 'Buyer CR Number'}</label>
                <input
                  type="text"
                  value={buyer.crNumber}
                  onChange={(e) => setBuyer(prev => ({ ...prev, crNumber: e.target.value }))}
                  placeholder="1010000000"
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'البريد الإلكتروني للعميل' : 'Buyer Email'}</label>
                <input
                  type="email"
                  value={buyer.contactEmail}
                  onChange={(e) => setBuyer(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="input"
                  placeholder="client@domain.com"
                />
              </div>

              <div>
                <label className="label">{isAr ? 'رقم جوال العميل' : 'Buyer Phone'}</label>
                <input
                  type="text"
                  value={buyer.contactPhone}
                  onChange={(e) => setBuyer(prev => ({ ...prev, contactPhone: e.target.value }))}
                  className="input font-mono"
                  placeholder="+966500000000"
                />
              </div>
            </div>

            {/* Buyer Address Subsection */}
            <div className="pt-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-3">
                {isAr ? 'عنوان المشتري (Buyer Address)' : 'Buyer Address'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="label !text-[11px]">{isAr ? 'المدينة' : 'City'}</label>
                  <input
                    type="text"
                    value={buyer.address.city}
                    onChange={(e) => setBuyer(prev => ({ ...prev, address: { ...prev.address, city: e.target.value, cityAr: e.target.value } }))}
                    className="input !py-1.5"
                    placeholder="Riyadh"
                  />
                </div>
                <div>
                  <label className="label !text-[11px]">{isAr ? 'الحي' : 'District'}</label>
                  <input
                    type="text"
                    value={buyer.address.district}
                    onChange={(e) => setBuyer(prev => ({ ...prev, address: { ...prev.address, district: e.target.value, districtAr: e.target.value } }))}
                    className="input !py-1.5"
                    placeholder="Al Malaz"
                  />
                </div>
                <div>
                  <label className="label !text-[11px]">{isAr ? 'الشارع' : 'Street'}</label>
                  <input
                    type="text"
                    value={buyer.address.street}
                    onChange={(e) => setBuyer(prev => ({ ...prev, address: { ...prev.address, street: e.target.value, streetAr: e.target.value } }))}
                    className="input !py-1.5"
                    placeholder="Salahuddin St"
                  />
                </div>
                <div>
                  <label className="label !text-[11px]">{isAr ? 'المبنى / الرمز' : 'Bldg / Postal'}</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={buyer.address.buildingNumber}
                      onChange={(e) => setBuyer(prev => ({ ...prev, address: { ...prev.address, buildingNumber: e.target.value } }))}
                      className="input !py-1.5 w-1/2"
                      placeholder="1234"
                    />
                    <input
                      type="text"
                      value={buyer.address.postalCode}
                      onChange={(e) => setBuyer(prev => ({ ...prev, address: { ...prev.address, postalCode: e.target.value } }))}
                      className="input !py-1.5 w-1/2"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. LINE ITEMS TABLE */}
          <div className="card p-6 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3 dark:border-dark-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                {isAr ? 'بنود الفاتورة والخدمات (Line Items)' : 'Invoice Line Items'}
              </h3>
              <button
                type="button"
                onClick={handleAddLine}
                className="btn btn-secondary text-xs flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAr ? 'إضافة بند جديد' : 'Add Line'}
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((line, index) => {
                const comp = calculations.computedLines[index] || {}
                return (
                  <div
                    key={index}
                    className="p-4 rounded-2xl bg-gray-50/70 dark:bg-dark-700/40 border border-gray-100 dark:border-dark-600/50 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center text-[10px]">
                          {index + 1}
                        </span>
                        {isAr ? `البند ${index + 1}` : `Line #${index + 1}`}
                      </span>

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(index)}
                          className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title={isAr ? 'حذف البند' : 'Remove Line'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <div className="md:col-span-2">
                        <label className="label !text-[11px]">{isAr ? 'اسم البند / الخدمة (عربي)' : 'Item Name (Arabic)'} *</label>
                        <input
                          type="text"
                          dir="rtl"
                          value={line.productNameAr}
                          onChange={(e) => handleLineChange(index, 'productNameAr', e.target.value)}
                          placeholder="اسم الخدمة أو المنتج"
                          className="input !py-1.5"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="label !text-[11px]">{isAr ? 'اسم البند (إنجليزي)' : 'Item Name (English)'}</label>
                        <input
                          type="text"
                          value={line.productName}
                          onChange={(e) => handleLineChange(index, 'productName', e.target.value)}
                          placeholder="Item or Service Description"
                          className="input !py-1.5"
                        />
                      </div>

                      <div>
                        <label className="label !text-[11px]">{isAr ? 'النوع' : 'Type'}</label>
                        <select
                          value={line.productType}
                          onChange={(e) => handleLineChange(index, 'productType', e.target.value)}
                          className="select !py-1.5"
                        >
                          <option value="service">{isAr ? 'خدمة (Service)' : 'Service'}</option>
                          <option value="goods">{isAr ? 'سلعة (Goods)' : 'Goods'}</option>
                        </select>
                      </div>

                      <div>
                        <label className="label !text-[11px]">{isAr ? 'وحدة القياس' : 'UOM (Optional)'}</label>
                        <select
                          value={line.unitCode}
                          onChange={(e) => handleLineChange(index, 'unitCode', e.target.value)}
                          className="select !py-1.5"
                        >
                          <option value="">{isAr ? 'بدون (اختياري)' : 'None (Optional)'}</option>
                          <option value="PCE">PCE - قطعة</option>
                          <option value="HUR">HUR - ساعة</option>
                          <option value="DAY">DAY - يوم</option>
                          <option value="MON">MON - شهر</option>
                          <option value="KGM">KGM - كيلوجرام</option>
                          <option value="MTR">MTR - متر</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1 border-t border-gray-100 dark:border-dark-700/60">
                      <div>
                        <label className="label !text-[11px]">{isAr ? 'الكمية' : 'Qty'}</label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                          className="input !py-1.5 font-mono text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="label !text-[11px]">{isAr ? 'سعر الوحدة (SAR)' : 'Unit Price (SAR)'}</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => handleLineChange(index, 'unitPrice', e.target.value)}
                          className="input !py-1.5 font-mono text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="label !text-[11px]">{isAr ? 'الخصم' : 'Discount'}</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={line.discount}
                            onChange={(e) => handleLineChange(index, 'discount', e.target.value)}
                            className="input !py-1.5 font-mono text-center w-2/3"
                          />
                          <select
                            value={line.discountType}
                            onChange={(e) => handleLineChange(index, 'discountType', e.target.value)}
                            className="select !py-1.5 !px-1 text-[11px] w-1/3"
                          >
                            <option value="fixed">SAR</option>
                            <option value="percentage">%</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="label !text-[11px]">{isAr ? 'الضريبة (VAT)' : 'Tax Rate'}</label>
                        <select
                          value={line.taxRate}
                          onChange={(e) => handleLineChange(index, 'taxRate', Number(e.target.value))}
                          className="select !py-1.5 text-center font-bold"
                        >
                          <option value={15}>15% (Standard)</option>
                          <option value={0}>0% (Zero-rated)</option>
                        </select>
                      </div>

                      <div className="col-span-2 md:col-span-1 flex flex-col justify-end">
                        <span className="text-[10px] text-gray-400 block mb-0.5 text-end">{isAr ? 'الإجمالي مع الضريبة' : 'Line Total + VAT'}</span>
                        <div className="p-1.5 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 text-end font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {(comp.lineTotalWithTax || 0).toFixed(2)} SAR
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5. TERMS, NOTES & BANK DETAILS */}
          <div className="card p-6 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 border-b pb-3 dark:border-dark-700">
              <FileText className="w-4 h-4 text-amber-500" />
              {isAr ? 'الشروط، الملاحظات، والحساب البنكي' : 'Terms, Notes & Bank Details'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}</label>
                <textarea
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="input"
                  placeholder={isAr ? '• الدفع خلال 30 يوماً من تاريخ الفاتورة' : '• Payment due within 30 days'}
                />
              </div>

              <div>
                <label className="label">{isAr ? 'ملاحظات الفاتورة' : 'Invoice Notes'}</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  placeholder={isAr ? 'شكراً لتعاملكم معنا' : 'Thank you for your business'}
                />
              </div>
            </div>

            {/* Bank details preview card */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    {seller.bankDetails?.bankName || 'Al Rajhi Bank'} - {seller.bankDetails?.accountName || seller.name}
                  </p>
                  <p className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                    IBAN: {seller.bankDetails?.iban || 'SA0000000000000000000000'}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200">
                {isAr ? 'مدرج تلقائياً بالفاتورة' : 'Auto-included on PDF'}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE SUMMARY & ZATCA QR PREVIEW (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Live Summary Card */}
          <div className="card p-6 border border-gray-100 dark:border-dark-700 rounded-3xl bg-white dark:bg-dark-800 shadow-sm sticky top-24 space-y-6">
            <div className="flex items-center justify-between border-b pb-3 dark:border-dark-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {isAr ? 'ملخص الفاتورة وزاتكا' : 'Summary & ZATCA QR'}
              </h3>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                SAR
              </span>
            </div>

            {/* ZATCA QR LIVE PREVIEW */}
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-dark-900 border border-slate-200/80 dark:border-dark-700 flex flex-col items-center justify-center text-center">
              {liveZatcaQr ? (
                <QRCodeSVG
                  value={liveZatcaQr}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              ) : (
                <div className="w-32 h-32 flex items-center justify-center text-xs text-gray-400">
                  {isAr ? 'أدخل الرقم الضريبي للبائع لتوليد QR' : 'Enter 15-digit VAT to generate QR'}
                </div>
              )}
              <div className="mt-3 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isAr ? 'رمز QR متوافق مع هيئة الزكاة (TLV)' : 'ZATCA TLV Phase 1 & 2 Valid'}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {isAr ? 'يتضمن اسم البائع، الرقم الضريبي، التوقيت، الإجمالي، والضريبة' : 'Encodes seller name, VAT, timestamp, total, and VAT'}
              </p>
            </div>

            {/* Financial Breakdown Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>{isAr ? 'المجموع الفرعي (قبل الضريبة)' : 'Subtotal'}</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {calculations.subtotal.toFixed(2)} SAR
                </span>
              </div>

              {calculations.totalDiscount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>{isAr ? 'إجمالي الخصم' : 'Total Discount'}</span>
                  <span className="font-mono">
                    -{calculations.totalDiscount.toFixed(2)} SAR
                  </span>
                </div>
              )}

              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>{isAr ? 'المبلغ الخاضع للضريبة' : 'Taxable Amount'}</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {calculations.taxableAmount.toFixed(2)} SAR
                </span>
              </div>

              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                <span>{isAr ? 'ضريبة القيمة المضافة (15%)' : 'VAT (15%)'}</span>
                <span className="font-mono">
                  +{calculations.totalTax.toFixed(2)} SAR
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-dark-600 flex justify-between items-baseline">
                <span className="text-sm font-black text-gray-900 dark:text-white">
                  {isAr ? 'المجموع الكلي' : 'Grand Total'}
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {calculations.grandTotal.toFixed(2)} <span className="text-xs font-normal text-gray-500">SAR</span>
                </span>
              </div>
            </div>

            {/* Payment Quick Inputs */}
            <div className="pt-3 border-t border-gray-100 dark:border-dark-700 space-y-3">
              <label className="label !text-xs">{isAr ? 'المبلغ المدفوع (Paid Amount)' : 'Paid Amount (SAR)'}</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max={calculations.grandTotal}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  className="input !py-1.5 font-mono text-center font-bold text-sm"
                />
                <button
                  type="button"
                  onClick={() => setPaidAmount(calculations.grandTotal)}
                  className="btn btn-secondary text-[11px] px-3 whitespace-nowrap"
                >
                  {isAr ? 'دفع كامل' : 'Full Pay'}
                </button>
              </div>
            </div>

            {/* Issue Button in Sidebar */}
            <button
              type="button"
              onClick={() => handleSubmitInvoice('issued')}
              disabled={createInvoiceMutation.isPending}
              className="btn btn-primary w-full py-3 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ShieldCheck className="w-5 h-5" />
              {createInvoiceMutation.isPending ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'إصدار الفاتورة الآن' : 'Issue Invoice Now')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
