import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDown, FileClock, FileText, Package, Plus, Receipt, ShoppingCart } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { PortalDropdown } from '../../pages/inventory/PortalDropdown'
import { isSaudiTenant } from '../../lib/saudiTenant'

function buildCreateItems({ businessTypes, isSaudi, hideQuotations }) {
  const canCreatePurchase = businessTypes.some((type) =>
    ['trading', 'construction', 'travel_agency', 'bakala', 'pharmacy', 'furniture_shop', 'supermarket'].includes(type)
  )
  const canCreateProforma = businessTypes.some((type) =>
    ['trading', 'construction', 'manpower', 'travel_agency', 'real_estate'].includes(type)
  )

  const items = [
    {
      id: 'sales-order',
      href: '/app/dashboard/sales/orders/new',
      icon: ShoppingCart,
      labelEn: 'Sales order',
      labelAr: 'أمر بيع',
      hintEn: 'Quote → confirm → deliver → invoice',
      hintAr: 'عرض ← تأكيد ← تسليم ← فاتورة',
    },
    {
      id: 'sell',
      href: '/app/dashboard/invoices/new/sell',
      icon: Receipt,
      labelEn: 'Sales invoice',
      labelAr: 'فاتورة مبيعات',
      hintEn: isSaudi ? 'B2B / B2C with ZATCA QR' : 'B2B / B2C tax invoice',
      hintAr: isSaudi ? 'B2B / B2C مع رمز QR' : 'فاتورة ضريبية B2B / B2C',
    },
  ]

  if (canCreatePurchase) {
    items.push({
      id: 'purchase',
      href: '/app/dashboard/invoices/new/purchase',
      icon: Package,
      labelEn: 'Purchase invoice',
      labelAr: 'فاتورة مشتريات',
      hintEn: 'Supplier bill & input VAT',
      hintAr: 'فاتورة مورد وضريبة مدخلات',
    })
  }

  if (canCreateProforma) {
    items.push({
      id: 'proforma',
      href: '/app/dashboard/invoices/new/sell?proforma=1',
      icon: FileClock,
      labelEn: 'Proforma invoice',
      labelAr: 'فاتورة مبدئية',
      hintEn: 'Non-fiscal estimate',
      hintAr: 'تقدير غير ملزم ضريبياً',
    })
  }

  if (!hideQuotations) {
    items.push({
      id: 'quotation',
      href: '/app/dashboard/quotations/new',
      icon: FileText,
      labelEn: 'Quotation',
      labelAr: 'عرض سعر',
      hintEn: 'Commercial offer',
      hintAr: 'عرض تجاري',
    })
  }

  return items
}

const triggerClass =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-dark-800 dark:text-slate-100 dark:hover:bg-dark-700'

export default function SalesCreateMenu({
  language = 'en',
  labelEn = 'Create',
  labelAr = 'إنشاء',
  className = '',
}) {
  const btnRef = useRef(null)
  const [open, setOpen] = useState(false)
  const { tenant } = useSelector((state) => state.auth)
  const isAr = language === 'ar'
  const businessTypes = getTenantBusinessTypes(tenant)
  const hideQuotations = businessTypes.includes('bakala')
  const isSaudi = isSaudiTenant(tenant)
  const items = buildCreateItems({ businessTypes, isSaudi, hideQuotations })

  useEffect(() => {
    setOpen(false)
  }, [language])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`${triggerClass} ${className}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
        {isAr ? labelAr : labelEn}
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align="end">
        <div className="min-w-[260px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] dark:border-dark-600 dark:bg-dark-800">
          <div className="px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAr ? 'مستند جديد' : 'New document'}
          </div>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-3.5 py-2.5 transition hover:bg-slate-50 dark:hover:bg-dark-700"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 dark:border-white/10 dark:bg-dark-800 dark:text-slate-300">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    {isAr ? item.labelAr : item.labelEn}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    {isAr ? item.hintAr : item.hintEn}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </PortalDropdown>
    </div>
  )
}
