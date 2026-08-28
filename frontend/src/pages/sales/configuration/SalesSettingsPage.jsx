import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { fieldControlClass, fieldLabelClass, ghostActionClass, sectionCardClass } from '../salesUi'
import { INCOTERMS } from '../salesConfig.menu'

export default function SalesSettingsPage() {
  const { language } = useSelector((s) => s.ui)
  const isAr = language === 'ar'
  const qc = useQueryClient()
  const [form, setForm] = useState({})

  const { data } = useQuery({
    queryKey: ['sales-settings'],
    queryFn: async () => (await api.get('/sales/settings')).data,
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: () => api.patch('/sales/settings', form),
    onSuccess: () => {
      toast.success(isAr ? 'تم حفظ الإعدادات' : 'Settings saved')
      qc.invalidateQueries({ queryKey: ['sales-settings'] })
    },
    onError: (e) => toast.error(e?.response?.data?.error || e.message),
  })

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }))

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{isAr ? 'إعدادات عامة' : 'General Settings'}</h2>

      <div className={`${sectionCardClass} grid gap-4 sm:grid-cols-2`}>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'صلاحية العرض (أيام)' : 'Quotation validity (days)'}</label>
          <input type="number" className={fieldControlClass} value={form.quotationValidityDays ?? 30} onChange={(e) => set('quotationValidityDays', Number(e.target.value))} />
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'سياسة الفوترة الافتراضية' : 'Default invoicing policy'}</label>
          <select className={fieldControlClass} value={form.defaultInvoicingPolicy || 'ordered'} onChange={(e) => set('defaultInvoicingPolicy', e.target.value)}>
            <option value="ordered">{isAr ? 'فوترة المطلوب' : 'Invoice what is ordered'}</option>
            <option value="delivered">{isAr ? 'فوترة المسلّم' : 'Invoice what is delivered'}</option>
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'Incoterm افتراضي' : 'Default incoterm'}</label>
          <select className={fieldControlClass} value={form.defaultIncoterm || 'EXW'} onChange={(e) => set('defaultIncoterm', e.target.value)}>
            {INCOTERMS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={fieldLabelClass}>{isAr ? 'وضع بوابة العملاء' : 'Customer portal signup'}</label>
          <select className={fieldControlClass} value={form.portalSignupMode || 'invitation_only'} onChange={(e) => set('portalSignupMode', e.target.value)}>
            <option value="disabled">{isAr ? 'معطّل' : 'Disabled'}</option>
            <option value="invitation_only">{isAr ? 'بدعوة فقط' : 'Invitation only'}</option>
            <option value="free_signup">{isAr ? 'تسجيل حر' : 'Free signup'}</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={!!form.requireOnlineSignature} onChange={(e) => set('requireOnlineSignature', e.target.checked)} />
          {isAr ? 'يتطلب توقيعاً إلكترونياً قبل التأكيد' : 'Require online signature before confirmation'}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={!!form.requireOnlinePayment} onChange={(e) => set('requireOnlinePayment', e.target.checked)} />
          {isAr ? 'يتطلب دفعاً إلكترونياً قبل التأكيد' : 'Require online payment before confirmation'}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.lockConfirmedOrders !== false} onChange={(e) => set('lockConfirmedOrders', e.target.checked)} />
          {isAr ? 'قفل الطلبات المؤكدة (للتدقيق)' : 'Lock confirmed sales orders (audit integrity)'}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={!!form.amazonSyncEnabled} onChange={(e) => set('amazonSyncEnabled', e.target.checked)} />
          {isAr ? 'تفعيل مزامنة Amazon' : 'Enable Amazon marketplace sync'}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.enableSaleWarnings !== false} onChange={(e) => set('enableSaleWarnings', e.target.checked)} />
          {isAr ? 'تحذيرات البيع (عميل/منتج)' : 'Enable sale warnings (customer/product)'}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={form.enableProforma !== false} onChange={(e) => set('enableProforma', e.target.checked)} />
          {isAr ? 'إظهار إرسال فاتورة مبدئية' : 'Enable Send Pro-Forma action'}
        </label>
      </div>

      <button type="button" className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
        {isAr ? 'حفظ الإعدادات' : 'Save settings'}
      </button>
    </div>
  )
}
