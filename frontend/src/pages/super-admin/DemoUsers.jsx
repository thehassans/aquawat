import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Search, Crown, Clock, CheckCircle, TrendingUp, Building2 } from 'lucide-react'
import api from '../../lib/api'
import { getBusinessTypeOptions } from '../../lib/businessTypes'
import { formatSubscriptionDate } from '../../lib/subscriptionState'

export default function DemoUsers() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [businessFilter, setBusinessFilter] = useState('')
  const language = 'en'

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-demo-users', page, search, statusFilter, businessFilter],
    queryFn: () => api.get('/super-admin/demo-users', {
      params: { page, limit: 20, search, status: statusFilter, businessType: businessFilter },
    }).then((res) => res.data),
  })

  const { data: statsData } = useQuery({
    queryKey: ['super-admin-demo-users-stats'],
    queryFn: () => api.get('/super-admin/demo-users/stats').then((res) => res.data),
  })

  const upgradeMutation = useMutation({
    mutationFn: ({ id, plan, billingCycle }) => api.post(`/super-admin/demo-users/${id}/upgrade`, { plan, billingCycle }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-demo-users'] })
      queryClient.invalidateQueries({ queryKey: ['super-admin-demo-users-stats'] })
    },
  })

  const businessOptions = getBusinessTypeOptions('en')
  const demoUsers = data?.demoUsers || []
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, pages: 1 }

  const getBusinessLabel = (type) => {
    const option = businessOptions.find((o) => o.id === type)
    return option?.label || type
  }

  const handleUpgrade = (userId) => {
    const plan = window.prompt('Enter plan (starter, professional, enterprise):', 'professional')
    if (!plan) return
    const billingCycle = window.prompt('Billing cycle (monthly or yearly):', 'monthly')
    if (!billingCycle) return
    upgradeMutation.mutate({ id: userId, plan, billingCycle })
  }

  const formatDate = (dateStr) => formatSubscriptionDate(dateStr, language)

  const isTrialExpired = (trialEnd) => {
    if (!trialEnd) return false
    return new Date(trialEnd).getTime() < Date.now()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Demo Users</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage demo trial accounts and upgrades</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsData?.total || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Demo Users</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsData?.trial || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On Trial</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Crown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsData?.upgraded || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upgraded</p>
            </div>
          </div>
        </div>
      </div>

      {/* Business Type Distribution */}
      {statsData?.byBusinessType?.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">By Business Type</h3>
          <div className="flex flex-wrap gap-2">
            {statsData.byBusinessType.map((item) => (
              <span key={item._id} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-dark-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                <Building2 className="h-3 w-3" />
                {getBusinessLabel(item._id)}: {item.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by email..."
            className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 py-2.5 px-4 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All Status</option>
          <option value="trial">On Trial</option>
          <option value="upgraded">Upgraded</option>
        </select>
        <select
          value={businessFilter}
          onChange={(e) => { setBusinessFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 py-2.5 px-4 text-sm outline-none focus:border-emerald-500"
        >
          <option value="">All Types</option>
          {businessOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-900/50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Business Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Trial Start</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Trial End</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Plan</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : demoUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No demo users found</td>
                </tr>
              ) : (
                demoUsers.map((demo) => {
                  const tenant = demo.tenantId
                  const trialEnd = tenant?.demoTrialEndsAt || demo.trialEndDate
                  const expired = isTrialExpired(trialEnd)
                  return (
                    <tr key={demo._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/30">
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{demo.email}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{getBusinessLabel(demo.businessType)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(demo.trialStartDate)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(trialEnd)}</td>
                      <td className="px-4 py-3">
                        {demo.isUpgraded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle className="h-3 w-3" /> Upgraded
                          </span>
                        ) : expired ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                            <Clock className="h-3 w-3" /> Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" /> Trial
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {demo.isUpgraded ? `${demo.plan} (${demo.billingCycle})` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!demo.isUpgraded && (
                          <button
                            onClick={() => handleUpgrade(demo._id)}
                            disabled={upgradeMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                          >
                            <Crown className="h-3.5 w-3.5" />
                            Upgrade
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-dark-700 px-4 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 dark:border-dark-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="rounded-lg border border-gray-300 dark:border-dark-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
