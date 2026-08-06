import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Info, Star } from 'lucide-react'

export default function MaqderUpdates() {
  const isRtl = localStorage.getItem('language') === 'ar'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isRtl ? 'تحديثات مقدر' : 'Maqder Updates'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {isRtl ? 'اكتشف أحدث الميزات والتحسينات في النظام' : 'Discover the latest features and improvements in the system'}
            </p>
          </div>
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold flex items-center gap-2">
            <Star className="w-5 h-5" />
            {isRtl ? 'الإصدار 2.1.0' : 'Version 2.1.0'}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <Info className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">{isRtl ? 'الجديد في هذا التحديث' : 'What\'s New in this Update'}</h2>
          </div>
          
          <ul className="space-y-4 mt-6">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <strong className="block text-gray-900 dark:text-white">{isRtl ? 'تحسينات متجر التطبيقات' : 'App Store Improvements'}</strong>
                <span className="text-gray-600 dark:text-gray-400">{isRtl ? 'إضافة 5 تطبيقات جديدة للتكامل الحكومي في متجر التطبيقات (علم، قوى، بلدي، سابر، اعتماد).' : 'Added 5 new government integration apps in the App Store (Elm, Qiwa, Balady, Saber, Etimad).'}</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <strong className="block text-gray-900 dark:text-white">{isRtl ? 'تحسين استقرار النظام' : 'System Stability'}</strong>
                <span className="text-gray-600 dark:text-gray-400">{isRtl ? 'حل مشكلة 429 Rate Limit وتحسين أداء ترجمة الفواتير ورفع كفاءة الخوادم.' : 'Resolved 429 Rate Limit issues, improved invoice translation performance, and increased server efficiency.'}</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <strong className="block text-gray-900 dark:text-white">{isRtl ? 'تحسين القوائم الجانبية' : 'Sidebar Enhancements'}</strong>
                <span className="text-gray-600 dark:text-gray-400">{isRtl ? 'إعادة ترتيب القوائم الجانبية وإضافة صفحة التحديثات هذه لتكون على اطلاع دائم.' : 'Reorganized sidebar menus and added this updates page to keep you informed.'}</span>
              </div>
            </li>
          </ul>
        </div>
      </motion.div>
    </div>
  )
}
