import { Lock } from 'lucide-react'
import { invoiceTemplateOptions, FREE_TEMPLATE_IDS } from '../../lib/invoiceTemplates'

export default function InvoiceTemplateSelector({ language = 'en', value = 1, onChange, tenant, onLockedClick, allowedIds }) {
  const options = Array.isArray(allowedIds) && allowedIds.length > 0
    ? invoiceTemplateOptions.filter((template) => allowedIds.includes(template.id))
    : invoiceTemplateOptions
  const gridClass = options.length <= 2
    ? 'grid grid-cols-1 gap-3 md:grid-cols-2'
    : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3'

  const installedApps = tenant?.settings?.installedApps || {}

  return (
    <div className={gridClass}>
      {options.map((template) => {
        const isActive = Number(value) === template.id
        
        // Check if the specific template addon is installed, or if they have the legacy bundle
        const isLegacyBundleInstalled = installedApps['premium_invoice_templates']?.isInstalled && installedApps['premium_invoice_templates']?.isEnabled !== false;
        const isSpecificTemplateInstalled = installedApps[`invoice_template_${template.id}`]?.isInstalled && installedApps[`invoice_template_${template.id}`]?.isEnabled !== false;
        const hasAccess = isLegacyBundleInstalled || isSpecificTemplateInstalled;

        const isLocked = !FREE_TEMPLATE_IDS.includes(template.id) && !hasAccess

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => (isLocked ? onLockedClick?.(template) : onChange(template.id))}
            className={`relative rounded-2xl border p-4 text-start transition-all ${
              isActive
                ? 'border-primary-500 bg-primary-50 shadow-sm dark:bg-primary-900/20'
                : 'border-gray-200 hover:border-gray-300 dark:border-dark-600 dark:hover:border-dark-500'
            } ${isLocked ? 'opacity-70' : ''}`}
          >
            {isLocked && (
              <span className="absolute top-3 end-3 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-900/80 text-white dark:bg-white/10">
                <Lock className="w-3 h-3" />
              </span>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {language === 'ar' ? template.nameAr : template.nameEn}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {language === 'ar' ? template.descriptionAr : template.descriptionEn}
                </p>
              </div>
              {!isLocked && (
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${isActive ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300'}`}>
                  {template.id}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
