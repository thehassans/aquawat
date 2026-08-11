import {
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ShieldCheck } from 'lucide-react'
import Money from '../ui/Money'

const COLORS = ['rgb(var(--color-primary-500))', '#f59e0b', '#ef4444', 'rgb(var(--color-secondary-500))', '#8b5cf6', '#06b6d4', '#ec4899']

function RevenueTooltip({ active, payload, isAr }) {
  if (!active || !payload?.length) return null
  const revenue = payload.find((p) => p.dataKey === 'revenue')?.value
  const expenses = payload.find((p) => p.dataKey === 'expenses')?.value
  return (
    <div className="bg-slate-800 text-white rounded-xl px-3 py-2 text-sm shadow-xl border border-slate-700">
      {typeof revenue === 'number' && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-300">{isAr ? 'الإيرادات' : 'Revenue'}</span>
          <Money value={revenue} minimumFractionDigits={0} maximumFractionDigits={0} />
        </div>
      )}
      {typeof expenses === 'number' && (
        <div className="flex items-center justify-between gap-3 mt-1">
          <span className="text-slate-300">{isAr ? 'المصروفات' : 'Expenses'}</span>
          <Money value={expenses} minimumFractionDigits={0} maximumFractionDigits={0} />
        </div>
      )}
    </div>
  )
}

export default function DashboardCharts({
  trendData,
  zatcaStatusData,
  isSarCurrencyTenant,
  isAr,
  zatcaStatusLabel,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className={isSarCurrencyTenant ? 'lg:col-span-2 card p-6' : 'lg:col-span-3 card p-6'}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {isAr ? 'الإيرادات التشغيلية مقابل المصروفات' : 'Multi-Stream Revenue vs Expenses'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAr
                ? 'تتبع التدفق المالي الشهري على مدار 12 شهراً'
                : 'Monthly financial trend tracking across all vertical revenue streams'}
            </p>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendData || []}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(var(--color-primary-500))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="rgb(var(--color-primary-500))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip content={<RevenueTooltip isAr={isAr} />} />
              <Legend
                verticalAlign="top"
                height={32}
                formatter={(value) => (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {value === 'revenue' ? (isAr ? 'الإيرادات' : 'Revenue') : (isAr ? 'المصروفات' : 'Expenses')}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="rgb(var(--color-primary-500))"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#ef4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExpenses)"
              />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {isSarCurrencyTenant && (
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {zatcaStatusLabel}
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {isAr ? 'المرحلة 2' : 'Phase 2'}
              </span>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={zatcaStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {zatcaStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100 dark:border-dark-700">
            {zatcaStatusData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate capitalize">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
