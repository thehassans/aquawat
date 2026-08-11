import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Download, CheckCircle, Clock, Calculator, FileText, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { useTranslation } from '../../lib/translations'
import Money from '../../components/ui/Money'
import ExportMenu from '../../components/ui/ExportMenu'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'

export default function Payroll() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const queryClient = useQueryClient()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [statusFilter, setStatusFilter] = useState('')

  const exportColumns = [
    {
      key: 'employeeId',
      label: t('employeeId'),
      value: (r) => r?.employeeId?.employeeId || ''
    },
    {
      key: 'employeeName',
      label: language === 'ar' ? 'الاسم' : 'Name',
      value: (r) => `${r?.employeeId?.firstNameEn || ''} ${r?.employeeId?.lastNameEn || ''}`.trim()
    },
    {
      key: 'basic',
      label: t('basicSalary'),
      value: (r) => r?.earnings?.find(e => e.type === 'basic')?.amount ?? ''
    },
    {
      key: 'allowances',
      label: language === 'ar' ? 'البدلات' : 'Allowances',
      value: (r) => (r?.totalEarnings || 0) - (r?.earnings?.find(e => e.type === 'basic')?.amount || 0)
    },
    {
      key: 'gosi',
      label: language === 'ar' ? 'التأمينات' : 'GOSI',
      value: (r) => r?.gosi?.employeeShare ?? ''
    },
    {
      key: 'netPay',
      label: language === 'ar' ? 'صافي الراتب' : 'Net Pay',
      value: (r) => r?.netPay ?? ''
    },
    {
      key: 'status',
      label: t('status'),
      value: (r) => r?.status || ''
    },
  ]

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', selectedMonth, selectedYear, statusFilter],
    queryFn: () => api.get('/payroll', { params: { month: selectedMonth, year: selectedYear, status: statusFilter || undefined } }).then(res => res.data)
  })

  const generateMutation = useMutation({
    mutationFn: () => api.post('/payroll/generate', { month: selectedMonth, year: selectedYear }),
    onSuccess: (res) => {
      toast.success(`Generated ${res.data.payrolls.length} payroll records`)
      queryClient.invalidateQueries(['payroll'])
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to generate payroll')
  })

  const generateWPSMutation = useMutation({
    mutationFn: () => api.post('/payroll/generate-wps', { month: selectedMonth, year: selectedYear, paymentDate: new Date() }, { responseType: 'blob' }),
    onSuccess: (res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `WPS_${selectedYear}${String(selectedMonth).padStart(2, '0')}.sif`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(language === 'ar' ? 'تم تحميل ملف WPS' : 'WPS file downloaded')
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to generate WPS')
  })

  const approveMutation = useMutation({
    mutationFn: (payrollId) => api.put(`/payroll/${payrollId}/approve`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم اعتماد الراتب' : 'Payroll approved')
      queryClient.invalidateQueries(['payroll'])
    },
    onError: (err) => toast.error(err.response?.data?.error || (language === 'ar' ? 'تعذر اعتماد الراتب' : 'Failed to approve payroll'))
  })

  const payMutation = useMutation({
    mutationFn: ({ payrollId }) => api.put(`/payroll/${payrollId}/pay`, { paymentMethod: 'bank_transfer' }),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تسجيل دفع الراتب' : 'Payroll marked as paid')
      queryClient.invalidateQueries(['payroll'])
    },
    onError: (err) => toast.error(err.response?.data?.error || (language === 'ar' ? 'تعذر تسجيل الدفع' : 'Failed to mark payroll as paid'))
  })

  const totalNet = data?.payrolls?.reduce((sum, p) => sum + p.netPay, 0) || 0
  const totalGosiEmployee = data?.payrolls?.reduce((sum, p) => sum + (p.gosi?.employeeShare || 0), 0) || 0
  const totalGosiEmployer = data?.payrolls?.reduce((sum, p) => sum + (p.gosi?.employerShare || 0), 0) || 0
  const totalGOSI = totalGosiEmployee + totalGosiEmployer

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('payroll')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === 'ar' ? 'إدارة رواتب الموظفين وملفات WPS' : 'Manage employee salaries and WPS files'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/payroll/calculators" className="btn btn-secondary">
            <Calculator className="w-4 h-4" />
            GOSI/EOSB
          </Link>
          <ExportMenu
            language={language}
            t={t}
            rows={data?.payrolls || []}
            columns={exportColumns}
            fileBaseName={language === 'ar' ? `رواتب_${selectedYear}_${String(selectedMonth).padStart(2, '0')}` : `Payroll_${selectedYear}_${String(selectedMonth).padStart(2, '0')}`}
            title={language === 'ar' ? 'الرواتب' : 'Payroll'}
            disabled={isLoading || !(data?.payrolls || []).length}
          />
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn btn-primary">
            {generateMutation.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus className="w-4 h-4" />{language === 'ar' ? 'إنشاء الرواتب' : 'Generate Payroll'}</>}
          </button>
        </div>
      </div>

      {/* Period Selection */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div>
            <label className="label">{language === 'ar' ? 'الشهر' : 'Month'}</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="select w-40">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{new Date(2024, m-1).toLocaleString(language === 'ar' ? 'ar' : 'en', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'السنة' : 'Year'}</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="select w-32">
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'الحالة' : 'Status'}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select w-40">
              <option value="">{language === 'ar' ? 'كل الحالات' : 'All statuses'}</option>
              <option value="draft">{language === 'ar' ? 'مسودة' : 'Draft'}</option>
              <option value="approved">{language === 'ar' ? 'معتمد' : 'Approved'}</option>
              <option value="paid">{language === 'ar' ? 'مدفوع' : 'Paid'}</option>
            </select>
          </div>
          <button onClick={() => generateWPSMutation.mutate()} disabled={generateWPSMutation.isPending || !data?.payrolls?.length} className="btn btn-secondary">
            {generateWPSMutation.isPending ? <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" /> : <><Download className="w-4 h-4" />{t('generateWps')}</>}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-500">{language === 'ar' ? 'عدد الموظفين' : 'Employees'}</p>
          <p className="text-2xl font-bold">{data?.payrolls?.length || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">{language === 'ar' ? 'إجمالي الرواتب' : 'Total Salaries'}</p>
          <p className="text-2xl font-bold text-primary-600"><Money value={totalNet} /></p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">{language === 'ar' ? 'التأمينات (حصة الموظف)' : 'GOSI (Employee)'}</p>
          <p className="text-2xl font-bold text-red-600"><Money value={totalGosiEmployee} /></p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-500">{language === 'ar' ? 'التأمينات (حصة صاحب العمل)' : 'GOSI (Employer)'}</p>
          <p className="text-2xl font-bold text-blue-600"><Money value={totalGosiEmployer} /></p>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
        {isLoading ? (
          <div className="p-8 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : data?.payrolls?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{language === 'ar' ? 'لا توجد رواتب لهذه الفترة' : 'No payroll records for this period'}</p>
            <p className="text-sm mt-1">{language === 'ar' ? 'اضغط "إنشاء الرواتب" لإنشاء سجلات جديدة' : 'Click "Generate Payroll" to create records'}</p>
          </div>
        ) : (
          <ResponsiveDataList
            items={data?.payrolls || []}
            renderCard={(p) => (
              <div key={p._id} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{p.employeeId?.firstNameEn} {p.employeeId?.lastNameEn}</p>
                    <p className="text-xs text-gray-500">{p.employeeId?.employeeId}</p>
                  </div>
                  <span className={`badge ${p.status === 'paid' ? 'badge-success' : p.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{language === 'ar' ? 'صافي الراتب' : 'Net Pay'}</span>
                  <span className="font-semibold text-primary-600"><Money value={p.netPay} /></span>
                </div>
                <div className="flex gap-2 pt-1">
                  {p.status === 'draft' ? (
                    <button type="button" className="btn btn-secondary flex-1 min-h-11" onClick={() => approveMutation.mutate(p._id)} disabled={approveMutation.isPending}>
                      {language === 'ar' ? 'اعتماد' : 'Approve'}
                    </button>
                  ) : null}
                  {p.status === 'approved' ? (
                    <button type="button" className="btn btn-secondary flex-1 min-h-11" onClick={() => payMutation.mutate({ payrollId: p._id })} disabled={payMutation.isPending}>
                      {language === 'ar' ? 'تسجيل الدفع' : 'Mark Paid'}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          >
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('employeeId')}</th>
                    <th>{language === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th>{t('basicSalary')}</th>
                    <th>{language === 'ar' ? 'البدلات' : 'Allowances'}</th>
                    <th>{language === 'ar' ? 'التأمينات' : 'GOSI'}</th>
                    <th>{language === 'ar' ? 'صافي الراتب' : 'Net Pay'}</th>
                    <th>{t('status')}</th>
                    <th>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.payrolls?.map((p) => (
                    <tr key={p._id}>
                      <td className="font-medium">{p.employeeId?.employeeId}</td>
                      <td>{p.employeeId?.firstNameEn} {p.employeeId?.lastNameEn}</td>
                      <td><Money value={p.earnings?.find(e => e.type === 'basic')?.amount} /></td>
                      <td>
                        <div className="space-y-1">
                          <div><Money value={p.totalEarnings - (p.earnings?.find(e => e.type === 'basic')?.amount || 0)} /></div>
                          <div className="text-xs text-gray-500">
                            {language === 'ar' ? 'سكن / نقل / طعام / أخرى' : 'Housing / Transport / Food / Other'}
                          </div>
                        </div>
                      </td>
                      <td className="text-red-600">-<Money value={p.gosi?.employeeShare} /></td>
                      <td className="font-semibold text-primary-600"><Money value={p.netPay} /></td>
                      <td>
                        <span className={`badge ${p.status === 'paid' ? 'badge-success' : p.status === 'approved' ? 'badge-info' : 'badge-warning'}`}>
                          {p.status === 'paid' && <CheckCircle className="w-3 h-3 me-1" />}
                          {p.status === 'draft' && <Clock className="w-3 h-3 me-1" />}
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {p.status === 'draft' ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              title={language === 'ar' ? 'اعتماد' : 'Approve'}
                              onClick={() => approveMutation.mutate(p._id)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          ) : null}
                          {p.status === 'approved' ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              title={language === 'ar' ? 'تسجيل الدفع' : 'Mark Paid'}
                              onClick={() => payMutation.mutate({ payrollId: p._id })}
                              disabled={payMutation.isPending}
                            >
                              <Wallet className="w-4 h-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ResponsiveDataList>
        )}
      </motion.div>
    </div>
  )
}
