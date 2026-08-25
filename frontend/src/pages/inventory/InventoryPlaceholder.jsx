import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import EmptyState from '../../components/ui/EmptyState'

/**
 * Step 1 placeholder for config / ops screens arriving in Steps 2–4.
 */
export default function InventoryPlaceholder({ titleEn, titleAr, step = 2 }) {
  const { language } = useSelector((s) => s.ui)
  return (
    <div className="mx-auto max-w-xl py-8">
      <EmptyState
        title={language === 'ar' ? (titleAr || titleEn) : titleEn}
        description={
          language === 'ar'
            ? `هذه الشاشة ضمن الخطوة ${step} من إعادة هيكلة المخزون. الروابط القديمة ما زالت تعمل.`
            : `This screen ships in Step ${step} of the inventory IA restructure. Existing deep links stay valid.`
        }
      />
      <div className="mt-4 text-center">
        <Link to="/app/dashboard/inventory" className="text-sm font-medium text-primary-600 hover:underline">
          {language === 'ar' ? 'العودة للنظرة العامة' : 'Back to Overview'}
        </Link>
      </div>
    </div>
  )
}
