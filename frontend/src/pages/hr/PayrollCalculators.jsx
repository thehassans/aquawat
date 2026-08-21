import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { Calculator, ArrowLeft, DollarSign, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import CurrencySymbol from '../../components/ui/CurrencySymbol'

export default function PayrollCalculators() {
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)

  const [gosiInput, setGosiInput] = useState({ salary: '', nationality: 'Saudi', dateOfBirth: '', asOfDate: '' })
  const [gosiResult, setGosiResult] = useState(null)
  
  const [eosbInput, setEosbInput] = useState({ yearsService: '', lastSalary: '', terminationReason: 'end_of_contract' })
  const [eosbResult, setEosbResult] = useState(null)

  const gosiMutation = useMutation({
    mutationFn: (data) => api.post('/payroll/calculate-gosi', data).then(res => res.data),
    onSuccess: setGosiResult
  })

  const eosbMutation = useMutation({
    mutationFn: (data) => api.post('/payroll/calculate-eosb', data).then(res => res.data),
    onSuccess: setEosbResult
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'حاسبات الرواتب' : 'Payroll Calculators'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'حساب التأمينات الاجتماعية ومكافأة نهاية الخدمة' : 'Calculate GOSI contributions and End of Service Benefits'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GOSI Calculator */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('gosiCalculation')}</h3>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'التأمينات الاجتماعية' : 'Social Insurance'}</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-500">
              {language === 'ar'
                ? 'هذه الحاسبة تحسب التأمينات بناءً على أساس الأجر الشهري (وقد يُطبّق حد أقصى 45,000). إذا أدخلت تاريخ الميلاد، سيتم احتساب أهلية ساند بدقة.'
                : 'This calculator uses the monthly GOSI base (cap applies at 45,000). If you provide a date of birth, SANED eligibility is calculated deterministically.'}
            </p>
            <div>
              <label className="label">
                <span className="inline-flex items-center gap-1.5">
                  {t('basicSalary')}
                  <CurrencySymbol />
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={gosiInput.salary}
                onChange={(e) => setGosiInput({ ...gosiInput, salary: e.target.value })}
                className="input"
                placeholder="5000"
              />
              {Number(gosiInput.salary) < 0 && (
                <p className="text-xs text-red-600 mt-1">{language === 'ar' ? 'الراتب يجب أن يكون 0 أو أكثر' : 'Salary must be 0 or more'}</p>
              )}
            </div>
            <div>
              <label className="label">{t('nationality')}</label>
              <select
                value={gosiInput.nationality}
                onChange={(e) => setGosiInput({ ...gosiInput, nationality: e.target.value })}
                className="select"
              >
                <option value="Saudi">{language === 'ar' ? 'سعودي' : 'Saudi'}</option>
                <option value="Non-Saudi">{language === 'ar' ? 'غير سعودي' : 'Non-Saudi'}</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">{language === 'ar' ? 'تاريخ الميلاد (اختياري)' : 'Date of Birth (optional)'}</label>
                <input
                  type="date"
                  value={gosiInput.dateOfBirth}
                  onChange={(e) => setGosiInput({ ...gosiInput, dateOfBirth: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'تاريخ الاحتساب (اختياري)' : 'As-of Date (optional)'}</label>
                <input
                  type="date"
                  value={gosiInput.asOfDate}
                  onChange={(e) => setGosiInput({ ...gosiInput, asOfDate: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <button
              onClick={() => {
                const salary = Number(gosiInput.salary)
                if (!Number.isFinite(salary) || salary < 0) return
                gosiMutation.mutate({
                  salary,
                  nationality: gosiInput.nationality,
                  dateOfBirth: gosiInput.dateOfBirth || undefined,
                  asOfDate: gosiInput.asOfDate ? new Date(gosiInput.asOfDate).toISOString() : new Date().toISOString()
                })
              }}
              disabled={
                !gosiInput.salary ||
                !Number.isFinite(Number(gosiInput.salary)) ||
                Number(gosiInput.salary) < 0 ||
                gosiMutation.isPending
              }
              className="btn btn-primary w-full"
            >
              <Calculator className="w-4 h-4" />
              {language === 'ar' ? 'احسب' : 'Calculate'}
            </button>
          </div>

          {gosiResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">{language === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}</span>
                <span className="font-semibold"><Money value={gosiResult.baseSalary} /></span>
              </div>
              {gosiResult.cappedSalary !== gosiResult.baseSalary && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600">{language === 'ar' ? 'الحد الأقصى للتأمينات' : 'GOSI Cap Applied'}</span>
                  <span><Money value={gosiResult.cappedSalary} /></span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-dark-600 pt-3">
                <div className="flex justify-between text-red-600">
                  <span>{language === 'ar' ? 'حصة الموظف' : 'Employee Share'}</span>
                  <span className="font-semibold"><Money value={-gosiResult.employeeShare} /></span>
                </div>
                <div className="flex justify-between text-blue-600 mt-2">
                  <span>{language === 'ar' ? 'حصة صاحب العمل' : 'Employer Share'}</span>
                  <span className="font-semibold"><Money value={gosiResult.employerShare} /></span>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-dark-600 pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>{language === 'ar' ? 'إجمالي المساهمة' : 'Total Contribution'}</span>
                  <span className="text-primary-600"><Money value={gosiResult.totalContribution} /></span>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* EOSB Calculator */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('eosbCalculation')}</h3>
              <p className="text-sm text-gray-500">{language === 'ar' ? 'مكافأة نهاية الخدمة' : 'End of Service Benefits'}</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-500">
              {language === 'ar'
                ? 'أدخل سنوات الخدمة (يمكن أن تكون كسور) وآخر راتب شهري كإجمالي الأجر الشهري. سيتم تطبيق معامل الاستحقاق تلقائياً حسب سبب الانتهاء.'
                : 'Enter years of service (can be fractional) and the last monthly salary (total monthly wage). Entitlement modifiers are applied automatically based on termination reason.'}
            </p>
            <div>
              <label className="label">{language === 'ar' ? 'سنوات الخدمة' : 'Years of Service'}</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={eosbInput.yearsService}
                onChange={(e) => setEosbInput({ ...eosbInput, yearsService: e.target.value })}
                className="input"
                placeholder="5"
              />
              {Number(eosbInput.yearsService) < 0 && (
                <p className="text-xs text-red-600 mt-1">{language === 'ar' ? 'سنوات الخدمة يجب أن تكون 0 أو أكثر' : 'Years of service must be 0 or more'}</p>
              )}
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'آخر راتب شهري' : 'Last Monthly Salary'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={eosbInput.lastSalary}
                onChange={(e) => setEosbInput({ ...eosbInput, lastSalary: e.target.value })}
                className="input"
                placeholder="10000"
              />
              {Number(eosbInput.lastSalary) < 0 && (
                <p className="text-xs text-red-600 mt-1">{language === 'ar' ? 'الراتب يجب أن يكون 0 أو أكثر' : 'Salary must be 0 or more'}</p>
              )}
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'سبب انتهاء الخدمة' : 'Termination Reason'}</label>
              <select
                value={eosbInput.terminationReason}
                onChange={(e) => setEosbInput({ ...eosbInput, terminationReason: e.target.value })}
                className="select"
              >
                <option value="end_of_contract">{language === 'ar' ? 'انتهاء العقد' : 'End of Contract'}</option>
                <option value="employer_termination">{language === 'ar' ? 'إنهاء من صاحب العمل' : 'Employer Termination'}</option>
                <option value="resignation_less_than_2_years">{language === 'ar' ? 'استقالة (أقل من سنتين)' : 'Resignation (<2 years)'}</option>
                <option value="resignation_2_to_5_years">{language === 'ar' ? 'استقالة (2-5 سنوات)' : 'Resignation (2-5 years)'}</option>
                <option value="resignation_5_to_10_years">{language === 'ar' ? 'استقالة (5-10 سنوات)' : 'Resignation (5-10 years)'}</option>
                <option value="resignation_over_10_years">{language === 'ar' ? 'استقالة (أكثر من 10 سنوات)' : 'Resignation (>10 years)'}</option>
                <option value="retirement">{language === 'ar' ? 'تقاعد' : 'Retirement'}</option>
              </select>
            </div>
            <button
              onClick={() => eosbMutation.mutate({ yearsService: Number(eosbInput.yearsService), lastSalary: Number(eosbInput.lastSalary), terminationReason: eosbInput.terminationReason })}
              disabled={
                !eosbInput.yearsService ||
                !eosbInput.lastSalary ||
                !Number.isFinite(Number(eosbInput.yearsService)) ||
                !Number.isFinite(Number(eosbInput.lastSalary)) ||
                Number(eosbInput.yearsService) < 0 ||
                Number(eosbInput.lastSalary) < 0 ||
                eosbMutation.isPending
              }
              className="btn btn-primary w-full"
            >
              <Calculator className="w-4 h-4" />
              {language === 'ar' ? 'احسب' : 'Calculate'}
            </button>
          </div>

          {eosbResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">{language === 'ar' ? 'سنوات الخدمة' : 'Years of Service'}</span>
                <span className="font-semibold">{eosbResult.yearsOfService}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{language === 'ar' ? 'آخر راتب' : 'Last Salary'}</span>
                <span className="font-semibold"><Money value={eosbResult.lastSalary} /></span>
              </div>
              
              <div className="border-t border-gray-200 dark:border-dark-600 pt-3 space-y-2">
                {eosbResult.breakdown?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500">{item.period} × {item.rate}</span>
                    <span><Money value={item.amount} /></span>
                  </div>
                ))}
              </div>

              {eosbResult.modifier !== 1 && (
                <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                  {eosbResult.modifierReason}
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-dark-600 pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>{language === 'ar' ? 'المبلغ النهائي' : 'Final Amount'}</span>
                  <span className="text-emerald-600"><Money value={eosbResult.finalAmount} /></span>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
