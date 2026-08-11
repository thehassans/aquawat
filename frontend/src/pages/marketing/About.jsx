import { useSelector } from 'react-redux'
import { BarChart3, Building2, CheckCircle2, Globe, ShieldCheck, Sparkles, Users } from 'lucide-react'

export default function MarketingAbout() {
  const { language } = useSelector((state) => state.ui)
  const isArabic = language === 'ar'

  const platformPillars = [
    {
      icon: ShieldCheck,
      title: isArabic ? 'امتثال حسب الدولة' : 'Country-aware compliance',
      description: isArabic
        ? 'تم تصميم المنصة لتخدم الأعمال من اليوم الأول مع جاهزية الفوترة الإلكترونية، الامتثال الضريبي حسب الدولة، والتشغيل ثنائي اللغة.'
        : 'The platform is built for multi-country operations from day one, including e-invoicing workflows, regional tax readiness, and bilingual execution.',
    },
    {
      icon: Sparkles,
      title: isArabic ? 'تجربة راقية وواضحة' : 'Premium and clear experience',
      description: isArabic
        ? 'نقلل الضوضاء في الواجهة ونركز على السرعة والوضوح حتى تتحرك الفرق بسرعة وتفهم ما يحدث فوراً.'
        : 'We reduce interface noise and emphasize speed and clarity so teams move faster and understand what matters instantly.',
    },
    {
      icon: BarChart3,
      title: isArabic ? 'قرار أسرع' : 'Faster decision-making',
      description: isArabic
        ? 'لوحات معلومات حية وتقارير مترابطة تمنح الإدارة صورة أوضح عن الإيرادات والمخزون والرواتب والمصروفات.'
        : 'Live dashboards and connected reporting give leadership a clearer view of revenue, inventory, payroll, and expenses.',
    },
  ]

  const capabilities = [
    isArabic ? 'الفوترة الإلكترونية مع XML و QR وتتبع الحالة' : 'Electronic invoicing with XML, QR, and status tracking',
    isArabic ? 'الموارد البشرية والرواتب وملفات WPS ونهاية الخدمة' : 'HR, payroll, WPS files, and EOSB support',
    isArabic ? 'المخزون والمستودعات والمشتريات والاستلام والشحن' : 'Inventory, warehouses, purchasing, receiving, and shipments',
    isArabic ? 'المشاريع والمهام والمصروفات والتقارير ولوحات التحكم' : 'Projects, tasks, expenses, reports, and dashboards',
    isArabic ? 'تشغيل عربي / إنجليزي مع دعم RTL كامل' : 'Arabic / English operation with full RTL support',
    isArabic ? 'بنية قابلة للتوسع من شركة ناشئة إلى مؤسسة' : 'Architecture that scales from startup to enterprise',
  ]

  const outcomes = [
    {
      value: isArabic ? 'تشغيل موحّد' : 'Unified operations',
      label: isArabic ? 'من أول فاتورة إلى آخر تقرير' : 'From first invoice to final report',
    },
    {
      value: isArabic ? 'وضوح إداري' : 'Executive clarity',
      label: isArabic ? 'صورة فورية عن الأداء والالتزام' : 'Instant visibility into performance and compliance',
    },
    {
      value: isArabic ? 'فرق أسرع' : 'Faster teams',
      label: isArabic ? 'عمليات أقل تعقيداً وأكثر انسيابية' : 'Less operational friction and smoother workflows',
    },
    {
      value: isArabic ? 'منصة جاهزة للنمو' : 'Built for growth',
      label: isArabic ? 'مرونة للتوسع حسب نوع النشاط وحجم الشركة' : 'Flexibility across business types and company size',
    },
  ]

  return (
    <main className="bg-[linear-gradient(180deg,#f8faf7_0%,#f4f8f4_42%,#ffffff_100%)] py-14 text-slate-900 sm:py-18">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-24 left-0 h-80 w-80 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-lime-100/60 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm shadow-emerald-100/80">
                <Sparkles className="h-4 w-4" />
                {isArabic ? 'منصة ERP عالمية بطابع راقٍ' : 'A premium modern ERP experience'}
              </div>

              <h1 className="mt-6 max-w-4xl font-display text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-slate-950 sm:text-5xl lg:text-6xl">
                {isArabic ? 'نصنع منصة تشغيل أعمال تجمع الأناقة والوضوح والامتثال.' : 'We build a business operating platform that blends elegance, clarity, and compliance.'}
              </h1>

              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
                {isArabic
                  ? 'Maqder ERP ليست مجرد مجموعة شاشات ERP تقليدية. إنها طبقة تشغيل متكاملة صُممت للشركات النامية لتوحيد الفوترة الإلكترونية، الموارد البشرية، الرواتب، المخزون، المشتريات، المشاريع، والتقارير داخل تجربة استخدام راقية وسريعة.'
                  : 'Maqder ERP is not just another collection of traditional ERP screens. It is a complete operating layer built for growing businesses to unify e-invoicing, HR, payroll, inventory, purchasing, projects, and reporting inside a refined and fast user experience.'}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {capabilities.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-2xl border border-white bg-white/90 px-4 py-4 shadow-sm shadow-slate-100/80">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
                    <span className="text-sm leading-6 text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white bg-white/90 p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.16)] backdrop-blur sm:p-8">
              <div className="rounded-[1.75rem] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbf8_100%)] p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700">
                      {isArabic ? 'رؤية المنصة' : 'Platform vision'}
                    </p>
                    <h2 className="mt-3 text-2xl font-bold text-slate-950">
                      {isArabic ? 'كل فريق. كل عملية. كل قرار.' : 'Every team. Every workflow. Every decision.'}
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    {isArabic ? 'جاهز للنمو' : 'Growth-ready'}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {outcomes.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="text-lg font-bold text-slate-950">{item.value}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.28)] sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                <Building2 className="h-4 w-4" />
                {isArabic ? 'قصتنا ولماذا نبني Maqder' : 'Our story and why Maqder exists'}
              </div>

              <h3 className="mt-5 text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
                {isArabic ? 'لأن الأعمال الحديثة تحتاج إلى ERP أقل تعقيداً وأكثر ذكاءً.' : 'Because modern businesses need an ERP that feels less heavy and more intelligent.'}
              </h3>
            </div>

            <div className="space-y-5 text-base leading-relaxed text-slate-600">
              <p>
                {isArabic
                  ? 'أنشأنا Maqder ERP لتقليل الفجوة بين التعقيد التشغيلي اليومي وبين حاجة الإدارة إلى السرعة والوضوح. في كثير من الأنظمة التقليدية، تتوزع العمليات عبر شاشات كثيرة، وتصبح البيانات متفرقة، ويضيع الوقت بين الإدخال والمتابعة والتحليل.'
                  : 'We created Maqder ERP to reduce the gap between daily operational complexity and leadership’s need for speed and clarity. In many traditional systems, workflows are spread across too many screens, data becomes fragmented, and time is lost between entry, follow-up, and analysis.'}
              </p>
              <p>
                {isArabic
                  ? 'لهذا صممنا المنصة لتكون طبقة تشغيل موحدة: الفوترة الإلكترونية تتصل بالمخزون، والرواتب تتكامل مع الموارد البشرية، والمشتريات ترتبط بالتقارير، وكل ذلك ضمن تجربة ثنائية اللغة مصقولة وواضحة.'
                  : 'That is why we designed the platform as one operating layer: e-invoicing connects to inventory, payroll integrates with HR, purchasing flows into reporting, and all of it lives inside a polished, bilingual experience designed for modern teams.'}
              </p>
              <p>
                {isArabic
                  ? 'هدفنا ليس فقط رقمنة الإجراءات، بل رفع جودة التشغيل بالكامل: فرق أكثر هدوءاً، قرارات أسرع، وصورة إدارية أوضح يمكن الوثوق بها يومياً.'
                  : 'Our goal is not only to digitize procedures, but to elevate operational quality itself: calmer teams, faster decisions, and a clearer management picture that can be trusted every day.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {platformPillars.map((pillar, idx) => (
            <div key={idx} className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdfb_100%)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/70">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <pillar.icon className="h-5 w-5" />
              </div>
              <h4 className="mt-5 text-xl font-bold text-slate-950">{pillar.title}</h4>
              <p className="mt-3 text-sm leading-7 text-slate-600">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 px-8 py-10 text-white shadow-[0_35px_90px_-45px_rgba(15,23,42,0.95)] sm:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-emerald-300">
                <Globe className="h-4 w-4" />
                {isArabic ? 'مبني لفرق طموحة حول العالم' : 'Built for ambitious growing teams'}
              </div>
              <h5 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">
                {isArabic ? 'منصة واحدة تمنحك أناقة التجربة وقوة التشغيل معاً.' : 'One platform delivering premium experience and operational power together.'}
              </h5>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Users,
                  title: isArabic ? 'للإدارة التنفيذية' : 'For leadership',
                  text: isArabic ? 'رؤية لحظية وواضحة للأداء والالتزام.' : 'A clear, real-time view of performance and compliance.',
                },
                {
                  icon: Building2,
                  title: isArabic ? 'للفرق التشغيلية' : 'For operations teams',
                  text: isArabic ? 'تدفقات أقل ازدحاماً وأكثر سرعة.' : 'Less cluttered and faster day-to-day workflows.',
                },
                {
                  icon: ShieldCheck,
                  title: isArabic ? 'للامتثال' : 'For compliance',
                  text: isArabic ? 'إعدادات وتجهيزات مناسبة لمتطلبات كل سوق.' : 'Workflows aligned with regional regulatory expectations.',
                },
                {
                  icon: Sparkles,
                  title: isArabic ? 'للنمو' : 'For growth',
                  text: isArabic ? 'قاعدة قابلة للتوسع حسب النشاط والحجم.' : 'A foundation that scales with business type and size.',
                },
              ].map((item, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <item.icon className="h-5 w-5 text-emerald-300" />
                  <div className="mt-4 text-lg font-bold">{item.title}</div>
                  <div className="mt-2 text-sm leading-7 text-white/70">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
