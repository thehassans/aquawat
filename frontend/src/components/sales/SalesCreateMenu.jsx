import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDown, FileClock, FileText, Package, Plus, ShoppingCart } from 'lucide-react'
import { getTenantBusinessTypes } from '../../lib/businessTypes'
import { PortalDropdown } from '../../pages/inventory/PortalDropdown'
import { isSaudiTenant } from '../../lib/saudiTenant'

function buildCreateItems({ businessTypes, isAr, isSaudi, hideQuotations }) {
  const canCreatePurchase = businessTypes.some((type) =>
    ['trading', 'construction', 'travel_agency', 'bakala', 'pharmacy', 'furniture_shop', 'supermarket'].includes(type)
  )
  const canCreateProforma = businessTypes.some((type) =>
    ['trading', 'construction', 'manpower', 'travel_agency', 'real_estate'].includes(type)
  )

  const items = [
    {
      id: 'sell',
      href: '/app/dashboard/invoices/new/sell',
      icon: ShoppingCart,
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
  const items = buildCreateItems({ businessTypes, isAr, isSaudi, hideQuotations })

  useEffect(() => {
    setOpen(false)
  }, [language])

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className={`btn btn-action-dark ${className}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="h-4 w-4" />
        {isAr ? labelAr : labelEn}
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <PortalDropdown open={open} onClose={() => setOpen(false)} anchorRef={btnRef} align="end">
        <div className="py-1">
          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {isAr ? 'مستند جديد' : 'New document'}
          </div>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={item.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-dark-700"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
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
