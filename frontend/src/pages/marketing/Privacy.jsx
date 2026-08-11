import { useSelector } from 'react-redux'
import { Shield, Lock, Database, Eye, Share2, UserCheck, Mail, FileText, Globe, Server, Cookie, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'

export default function MarketingPrivacy() {
  const { language } = useSelector((state) => state.ui)
  const isArabic = false

  const sections = isArabic ? [
    {
      icon: Database,
      title: '1. المعلومات التي نجمعها',
      body: 'نجمع نوعين رئيسيين من المعلومات لتقديم وتحسين خدمات Maqder ERP:',
      points: [
        'المعلومات التي تقدمها مباشرة: اسم الشركة، البريد الإلكتروني، رقم الهاتف، العنوان، الرقم الضريبي (VAT)، السجل التجاري، ومعلومات الفوترة عند التسجيل أو الاشتراك.',
        'المعلومات المالية والتجارية: بيانات الموردين، العملاء، الفواتير، التقارير المحاسبية، المخزون، وبيانات الموارد البشرية التي تقوم بإدخالها في النظام.',
        'المعلومات التقنية: عنوان IP، نوع المتصفح، نظام التشغيل، بيانات الاستخدام والتفاعل مع المنصة، وسجلات النظام للأغراض الأمنية والتشغيلية.',
      ],
    },
    {
      icon: Eye,
      title: '2. كيف نستخدم معلوماتك',
      body: 'نستخدم المعلومات التي نجمعها للأغراض التالية حصراً:',
      points: [
        'تقديم وتشغيل خدمات ERP بما في ذلك إدارة المخزون، المحاسبة، الفواتير الإلكترونية (فاتورة/ZATCA)، نقاط البيع، والموارد البشرية.',
        'الامتثال لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA) وهيئة البيانات الحكومية (NCA) في المملكة العربية السعودية.',
        'تقديم الدعم الفني وحل المشكلات التقنية وتحسين تجربة المستخدم.',
        'إرسال إشعارات تحديثات النظام، التنبيهات الأمنية، والمعلومات المتعلقة بالاشتراك.',
        'تحليل استخدام المنصة لتطوير ميزات جديدة وتحسين الأداء.',
        'حماية المنصة من الاحتيال والوصول غير المصرح به وضمان أمن البيانات.',
      ],
    },
    {
      icon: Lock,
      title: '3. الأساس القانوني لمعالجة البيانات',
      body: 'نعالج بياناتك الشخصية وفقاً لنظام حماية البيانات الشخصية السعودي (PDPL) بناءً على:',
      points: [
        'موافقتك الصريحة عند التسجيل في الخدمة وقبول الشروط والأحكام.',
        'تنفيذ العقد المبرم بينك وبين Maqder لتقديم خدمات ERP.',
        'الالتزامات القانونية والتنظيمية بما في ذلك متطلبات ZATCA وهيئة البيانات.',
        'مصالحنا المشروعة في تشغيل وتأمين وتحسين المنصة.',
      ],
    },
    {
      icon: Share2,
      title: '4. مشاركة البيانات مع الأطراف الثالثة',
      body: 'نحن لا نبيع بياناتك لأي طرف ثالث. قد نشارك بياناتك في الحالات التالية فقط:',
      points: [
        'مزودي البنية التحتية: شركات استضافة السحابة (Cloud Hosting) ومعالجات الدفع لتشغيل المنصة.',
        'التكاملات الحكومية: هيئة الزكاة والضريبة والجمارك (ZATCA)، منصة قوى (Qiwa)، منصة مدد (GOSI)، بوابة علم (Elm) عند تفعيلك لهذه التكاملات.',
        'مزودي خدمات الأعمال: بوابات الدفع، شركات الشحن، ومزودي الرسائل (SMS/Email) عند استخدامك لهذه الخدمات.',
        'السلطات القانونية: عند وجود التزام قانوني أو أمر قضائي أو طلب من الجهات التنظيمية المختصة.',
      ],
    },
    {
      icon: Server,
      title: '5. أمن البيانات وحمايتها',
      body: 'نطبق إجراءات أمنية صارمة لحماية بياناتك:',
      points: [
        'تشفير البيانات أثناء النقل (TLS 1.3) وأثناء التخزين (AES-256).',
        'نسخ احتياطي تلقائي يومي مع تخزين متكرر جغرافياً لضمان استمرارية الخدمة.',
        'مراجعات أمنية دورية واختبارات اختراق (Penetration Testing) من قبل جهات متخصصة.',
        'ضوابط وصول قائمة على الأدوار (RBAC) مع مصادقة متعددة العوامل (MFA).',
        'مراقبة على مدار الساعة للأنشطة المشبوهة والوصول غير المصرح به.',
        'الامتثال لمتطلبات هيئة البيانات الحكومية (NCA) ومعايير الأمن السيبراني السعودي.',
      ],
    },
    {
      icon: Globe,
      title: '6. تخزين البيانات والاحتفاظ بها',
      body: 'تُخزن بياناتك على خوادم سحابية آمنة. فيما يلي سياسة الاحتفاظ بالبيانات:',
      points: [
        'البيانات النشطة: تُحتفظ طوال مدة اشتراكك النشط في الخدمة.',
        'بعد انتهاء الاشتراك: نمنحك فترة سماح مدتها 30 يوماً لتصدير بياناتك.',
        'بعد فترة السماح: تُحذف البيانات نهائياً خلال 90 يوماً ما لم يُطلب قانونياً الاحتفاظ بها.',
        'السجلات المالية والضريبية: تُحتفظ لمدة 6 سنوات وفقاً لمتطلبات ZATCA والنظام الضريبي السعودي.',
        'سجلات الأمان والامتثال: تُحتفظ لمدة سنتين بعد انتهاء العقد لأغراض التدقيق.',
      ],
    },
    {
      icon: UserCheck,
      title: '7. حقوقك في الخصوصية',
      body: 'وفقاً لنظام حماية البيانات الشخصية (PDPL)، لديك الحقوق التالية:',
      points: [
        'الحق في الوصول إلى بياناتك الشخصية والاطلاع عليها.',
        'الحق في تصحيح أو تحديث البيانات غير الدقيقة.',
        'الحق في حذف بياناتك (الحق في النسيان) مع مراعاة الالتزامات القانونية.',
        'الحق في تصدير بياناتك بصيغة قابلة للقراءة الآلية.',
        'الحق في تقييد أو الاعتراض على معالجة بياناتك.',
        'الحق في سحب موافقتك في أي وقت.',
        'للتمتع بهذه الحقوق، تواصل معنا على: privacy@maqder.com',
      ],
    },
    {
      icon: Cookie,
      title: '8. ملفات تعريف الارتباط (Cookies)',
      body: 'نستخدم ملفات تعريف الارتباط لتحسين تجربتك:',
      points: [
        'ملفات أساسية: ضرورية لتشغيل المنصة والمصادقة (Session Cookies).',
        'ملفات تحليلية: لفهم كيفية استخدام المنصة وتحسينها (Google Analytics).',
        'ملفات تفضيلات: لحفظ لغة العرض وإعدادات المستخدم.',
        'يمكنك إدارة أو تعطيل ملفات تعريف الارتباط من إعدادات متصفحك في أي وقت.',
      ],
    },
    {
      icon: RefreshCw,
      title: '9. التحديثات على سياسة الخصوصية',
      body: 'قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر لتعكس التغييرات في الممارسات أو المتطلبات القانونية. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل المنصة قبل دخولها حيز التنفيذ بـ 30 يوماً على الأقل.',
      points: [],
    },
    {
      icon: Mail,
      title: '10. التواصل معنا',
      body: 'إذا كان لديك أي أسئلة أو استفسارات حول سياسة الخصوصية أو حقوقك، يمكنك التواصل معنا:',
      points: [
        'البريد الإلكتروني: privacy@maqder.com',
        'الهاتف: ‎+966 59 677 5485',
        'العنوان: المملكة العربية السعودية',
        'مسؤول حماية البيانات (DPO): privacy@maqder.com',
      ],
    },
  ] : [
    {
      icon: Database,
      title: '1. Information We Collect',
      body: 'We collect two main types of information to deliver and improve Maqder ERP services:',
      points: [
        'Information you provide directly: Company name, email, phone number, address, VAT number, commercial registration, and billing details when you register or subscribe.',
        'Business & financial data: Supplier data, customer data, invoices, accounting reports, inventory, and HR data that you enter into the system.',
        'Technical information: IP address, browser type, operating system, usage and interaction data with the platform, and system logs for security and operational purposes.',
      ],
    },
    {
      icon: Eye,
      title: '2. How We Use Your Information',
      body: 'We use the information we collect solely for the following purposes:',
      points: [
        'Providing and operating ERP services including inventory management, accounting, e-invoicing (Factoring/ZATCA), point of sale, and human resources.',
        'Complying with the requirements of the Zakat, Tax and Customs Authority (ZATCA) and the National Data Management Office (NCA) in the Kingdom of Saudi Arabia.',
        'Providing technical support, troubleshooting, and improving user experience.',
        'Sending system update notifications, security alerts, and subscription-related information.',
        'Analyzing platform usage to develop new features and improve performance.',
        'Protecting the platform from fraud, unauthorized access, and ensuring data security.',
      ],
    },
    {
      icon: Lock,
      title: '3. Legal Basis for Data Processing',
      body: 'We process your personal data in accordance with the Saudi Personal Data Protection Law (PDPL) based on:',
      points: [
        'Your explicit consent when registering for the service and accepting the Terms & Conditions.',
        'Performance of the contract between you and Maqder to deliver ERP services.',
        'Legal and regulatory obligations including ZATCA and NDA requirements.',
        'Our legitimate interests in operating, securing, and improving the platform.',
      ],
    },
    {
      icon: Share2,
      title: '4. Data Sharing with Third Parties',
      body: 'We do not sell your data to any third party. We may share your data only in the following circumstances:',
      points: [
        'Infrastructure providers: Cloud hosting companies and payment processors to operate the platform.',
        'Government integrations: ZATCA, Qiwa platform, Mudad (GOSI), Elm portal — only when you activate these integrations.',
        'Business service providers: Payment gateways, shipping companies, and SMS/email providers when you use these services.',
        'Legal authorities: When there is a legal obligation, court order, or request from competent regulatory authorities.',
      ],
    },
    {
      icon: Server,
      title: '5. Data Security & Protection',
      body: 'We implement strict security measures to protect your data:',
      points: [
        'Data encryption in transit (TLS 1.3) and at rest (AES-256).',
        'Automatic daily backups with geo-redundant storage to ensure business continuity.',
        'Regular security audits and penetration testing by specialized firms.',
        'Role-based access controls (RBAC) with multi-factor authentication (MFA).',
        '24/7 monitoring for suspicious activities and unauthorized access.',
        'Compliance with National Data Management Office (NCA) requirements and Saudi cybersecurity standards.',
      ],
    },
    {
      icon: Globe,
      title: '6. Data Storage & Retention',
      body: 'Your data is stored on secure cloud servers. Below is our data retention policy:',
      points: [
        'Active data: Retained throughout your active subscription period.',
        'After subscription ends: You are granted a 30-day grace period to export your data.',
        'After grace period: Data is permanently deleted within 90 days unless legally required to retain.',
        'Financial & tax records: Retained for 6 years in accordance with ZATCA and Saudi tax law requirements.',
        'Security & compliance logs: Retained for 2 years after contract termination for audit purposes.',
      ],
    },
    {
      icon: UserCheck,
      title: '7. Your Privacy Rights',
      body: 'Under the Personal Data Protection Law (PDPL), you have the following rights:',
      points: [
        'The right to access your personal data and review it.',
        'The right to correct or update inaccurate data.',
        'The right to delete your data (right to be forgotten), subject to legal obligations.',
        'The right to export your data in a machine-readable format.',
        'The right to restrict or object to the processing of your data.',
        'The right to withdraw your consent at any time.',
        'To exercise these rights, contact us at: privacy@maqder.com',
      ],
    },
    {
      icon: Cookie,
      title: '8. Cookies',
      body: 'We use cookies to enhance your experience:',
      points: [
        'Essential cookies: Necessary for platform operation and authentication (Session Cookies).',
        'Analytical cookies: To understand platform usage and improve it (Google Analytics).',
        'Preference cookies: To remember your language and user settings.',
        'You can manage or disable cookies from your browser settings at any time.',
      ],
    },
    {
      icon: RefreshCw,
      title: '9. Updates to This Privacy Policy',
      body: 'We may update this privacy policy from time to time to reflect changes in practices or legal requirements. We will notify you of any material changes via email or in-platform notification at least 30 days before they take effect.',
      points: [],
    },
    {
      icon: Mail,
      title: '10. Contact Us',
      body: 'If you have any questions or inquiries about this privacy policy or your rights, you can reach us at:',
      points: [
        'Email: privacy@maqder.com',
        'Phone: +966 59 677 5485',
        'Address: Kingdom of Saudi Arabia',
        'Data Protection Officer (DPO): privacy@maqder.com',
      ],
    },
  ]

  return (
    <main className="min-h-screen py-14">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3d28] via-[#1f6b43] to-[#155234] p-8 sm:p-12 mb-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 mb-4">
              <Shield className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-medium text-emerald-100">{isArabic ? 'ساري اعتبار من يناير 2025' : 'Effective January 2025'}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              {isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-emerald-100/90 max-w-2xl leading-relaxed">
              {isArabic
                ? 'نلتزم في Maqder ERP بحماية بياناتك الشخصية وضمان خصوصيتك وفقاً لأعلى المعايير العالمية ونظام حماية البيانات الشخصية السعودي (PDPL).'
                : 'At Maqder ERP, we are committed to protecting your personal data and ensuring your privacy in accordance with the highest global standards and the Saudi Personal Data Protection Law (PDPL).'}
            </p>
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="mb-10 rounded-2xl border border-slate-200 bg-white/60 backdrop-blur-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{isArabic ? 'محتويات سريعة' : 'Quick Navigation'}</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s, i) => (
              <a key={i} href={`#section-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                <s.icon className="w-3.5 h-3.5" />
                {s.title.replace(/^\d+\.\s*/, '')}
              </a>
            ))}
          </div>
        </div>

        {/* Compliance Badges */}
        <div className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: CheckCircle, label: isArabic ? 'متوافق مع PDPL' : 'PDPL Compliant' },
            { icon: CheckCircle, label: isArabic ? 'متوافق مع ZATCA' : 'ZATCA Compliant' },
            { icon: Lock, label: isArabic ? 'تشفير AES-256' : 'AES-256 Encrypted' },
            { icon: Server, label: isArabic ? 'استضافة سحابية آمنة' : 'Secure Cloud Hosted' },
          ].map((badge, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center">
              <badge.icon className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-medium text-slate-700">{badge.label}</span>
            </div>
          ))}
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {sections.map((section, i) => (
            <section key={i} id={`section-${i}`} className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm p-6 sm:p-8 transition-shadow hover:shadow-lg hover:shadow-slate-200/50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                  <section.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">{section.title}</h2>
                  <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">{section.body}</p>
                  {section.points.length > 0 && (
                    <ul className="mt-4 space-y-2.5">
                      {section.points.map((point, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
                          <CheckCircle className="flex-shrink-0 w-4 h-4 text-emerald-500 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Bottom Notice */}
        <div className="mt-10 rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
          <AlertTriangle className="flex-shrink-0 w-5 h-5 text-amber-600 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            {isArabic
              ? 'هذه السياسة وثيقة قانونية ملزمة. باستخدامك لمنصة Maqder ERP، فإنك تقر بأنك قد قرأت ووافقت على سياسة الخصوصية هذه بالكامل.'
              : 'This policy is a legally binding document. By using the Maqder ERP platform, you acknowledge that you have read and fully agreed to this Privacy Policy.'}
          </p>
        </div>
      </div>
    </main>
  )
}
