import { useSelector } from 'react-redux'
import { CheckCircle2 } from 'lucide-react'
import { usePublicWebsiteSettings } from '../../lib/website'
import Money from '../../components/ui/Money'

const fallbackPricingPlans = [
  {
    id: 'starter',
    nameEn: 'Starter',
    nameAr: 'البداية',
    priceMonthly: 99.99,
    priceYearly: 999.99,
    priceMonthlySar: 99.99,
    priceYearlySar: 999.99,
    priceMonthlyUsd: 29.99,
    priceYearlyUsd: 299.99,
    popular: false,
    featuresEn: ['E-Invoicing & Tax', 'Up to 100 invoices/month', 'Inventory & Warehouses', 'Basic Reports', 'Up to 5 users', 'Email Support'],
    featuresAr: ['الفوترة الإلكترونية والضرائب', 'حتى 100 فاتورة/شهر', 'المخزون والمستودعات', 'تقارير أساسية', 'حتى 5 مستخدمين', 'دعم بالبريد'],
  },
  {
    id: 'professional',
    nameEn: 'Professional',
    nameAr: 'الاحترافية',
    priceMonthly: 199.99,
    priceYearly: 1999.99,
    priceMonthlySar: 199.99,
    priceYearlySar: 1999.99,
    priceMonthlyUsd: 59.99,
    priceYearlyUsd: 599.99,
    popular: true,
    featuresEn: ['Everything in Starter', 'Unlimited Invoices', 'HR & Payroll', 'Expenses & Finance', 'Projects & Tasks', 'Advanced Reports', 'Up to 25 users', 'Priority Support'],
    featuresAr: ['كل ما في البداية', 'فواتير غير محدودة', 'الموارد البشرية والرواتب', 'المصروفات والمالية', 'المشاريع والمهام', 'تقارير متقدمة', 'حتى 25 مستخدم', 'دعم ذو أولوية'],
  },
  {
    id: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'المؤسسات',
    priceMonthly: 0,
    priceYearly: 0,
    popular: false,
    featuresEn: ['Everything in Professional', 'Unlimited users', 'Dedicated Account Manager', 'Custom Integrations', 'On-premise Option', '24/7 Phone Support', 'SLA Guarantee'],
    featuresAr: ['كل ما في الاحترافية', 'مستخدمون غير محدودين', 'مدير حساب مخصص', 'تكاملات مخصصة', 'خيار الخادم الخاص', 'دعم هاتفي 24/7', 'ضمان SLA'],
  },
]

export default function MarketingPricing() {
  const { language } = useSelector((state) => state.ui)
  const { data } = usePublicWebsiteSettings()
  const isArabic = language === 'ar'

  const currency = data?.pricing?.currency || 'SAR'
  const plans = Array.isArray(data?.pricing?.plans) && data.pricing.plans.length > 0 ? data.pricing.plans : fallbackPricingPlans

  return (
    <main className="py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
            {isArabic ? 'خطط مرنة للشركات النامية' : 'Flexible plans for growing businesses'}
          </div>
          <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold text-slate-950">{isArabic ? 'خطط الأسعار' : 'Pricing Plans'}</h1>
          <p className="mt-3 max-w-2xl mx-auto text-slate-600">
            {isArabic ? 'اختر الخطة المناسبة لحجم عملك ويمكنك الترقية في أي وقت.' : 'Choose the plan that fits your business. Upgrade anytime.'}
          </p>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const name = isArabic ? (plan.nameAr || plan.nameEn || plan.name) : (plan.nameEn || plan.name || plan.nameAr)
            const features = isArabic ? (plan.featuresAr || plan.featuresEn || plan.features || []) : (plan.featuresEn || plan.features || plan.featuresAr || [])
            const monthly = Number(
              String(currency).toUpperCase() === 'USD'
                ? (plan.priceMonthlyUsd ?? plan.priceMonthly ?? 0)
                : (plan.priceMonthlySar ?? plan.priceMonthly ?? 0)
            )
            const yearly = Number(
              String(currency).toUpperCase() === 'USD'
                ? (plan.priceYearlyUsd ?? plan.priceYearly ?? 0)
                : (plan.priceYearlySar ?? plan.priceYearly ?? 0)
            )

            return (
              <div
                key={plan.id}
                className={`rounded-3xl border p-7 bg-white transition ${plan.popular ? 'border-emerald-300 shadow-xl shadow-emerald-100/70 ring-1 ring-emerald-100' : 'border-slate-200 shadow-sm shadow-slate-100/80'}`}
              >
                {plan.popular && (
                  <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {isArabic ? 'الأكثر شيوعاً' : 'Most Popular'}
                  </div>
                )}

                <div className="mt-3 text-xl font-bold text-slate-950">{name}</div>

                <div className="mt-4">
                  <div className="text-4xl font-extrabold text-slate-950">
                    {monthly > 0
                      ? <Money value={monthly} currency={currency} language={language} minimumFractionDigits={2} maximumFractionDigits={2} className="text-4xl font-extrabold text-slate-950" />
                      : (isArabic ? 'مخصص' : 'Custom')}
                  </div>
                  <div className="text-sm text-slate-500">{monthly > 0 ? (isArabic ? 'شهرياً' : 'per month') : (isArabic ? 'تواصل معنا' : 'Contact us')}</div>
                  {yearly > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                      <span>{isArabic ? 'سنويًا:' : 'Yearly:'}</span>
                      <Money value={yearly} currency={currency} language={language} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  {(features || []).map((f, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <span className="leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>

                <a
                  href="/contact"
                  className={`mt-8 inline-flex w-full justify-center rounded-2xl px-5 py-3 font-semibold transition ${plan.popular ? 'bg-gradient-to-r from-[#1f6b43] to-[#155234] text-white shadow-lg shadow-emerald-200' : 'border border-slate-200 bg-slate-50 text-slate-900 hover:border-emerald-200 hover:bg-emerald-50'}`}
                >
                  {isArabic ? 'تواصل معنا' : 'Get in touch'}
                </a>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
