import { useTranslation } from '../../lib/translations.js';
import React, { useState, useEffect, useRef } from 'react';

import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
const t = (key, opts) => opts?.defaultValue || key;

import { Card, StatCard } from './components/ui/Card';
import { StatusBadge } from './components/ui/Badge';
import { Table, Thead, Tbody, Tr, Th, Td } from './components/ui/Table';
import { Users, UserPlus, Clock, CheckCircle, AlertCircle, Search, Plus, Calendar, Truck, FileText, X, Receipt, Phone, User, Scissors, ChevronRight, ShoppingBag } from 'lucide-react';
import SARIcon from './components/ui/SARIcon';
import { Button } from './components/ui/Button';
import DemoBlockedModal from './components/ui/DemoBlockedModal';
import { canonicalSaudiMobile, formatSaudiRiyal } from './utils/saudi';

const UserDashboard = () => {
  
  const { user } = useSelector(state => state.auth);
  const { language } = useSelector(state => state.ui);
  const { t } = useTranslation(language);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const langKey = (language || 'en').split('-')[0];
  const isRTL = ['ar', 'ur'].includes((language || 'en').split('-')[0]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchResults, setSearchResults] = useState({ orders: [], customers: [], workers: [] });
  const [workersCache, setWorkersCache] = useState(null);
  const searchWrapRef = useRef(null);
  const debounceRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);

  const isDemo = !!user?.isDemoSession;
  const [demoBlockedOpen, setDemoBlockedOpen] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/khayyat/user/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
    setLoading(false);
  };

  const runGlobalSearch = async (q) => {
    const requestId = ++searchRequestIdRef.current;
    setSearchLoading(true);
    try {
      const phoneKey = canonicalSaudiMobile(q);
      const isPhone = !!phoneKey && phoneKey.length >= 3;
      const [ordersRes, customersRes, workersRes] = await Promise.all([
        api.get('/khayyat/stitchings/search', { params: { q, ...(isPhone ? { phone: phoneKey } : {}) } }),
        api.get('/khayyat/customers/search', { params: { q } }),
        workersCache ? Promise.resolve({ data: { workers: workersCache } }) : api.get('/khayyat/worker')
      ]);

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      const ordersRaw = ordersRes.data?.stitchings || [];
      const customersRaw = customersRes.data?.customers || [];

      const workersRaw = workersCache || workersRes.data?.workers || [];
      if (!workersCache) {
        setWorkersCache(workersRaw);
      }

      const qLower = q.toLowerCase();
      const workersFiltered = Array.isArray(workersRaw)
        ? workersRaw
            .filter((w) => {
              const name = (w.name || '').toLowerCase();
              const phone = String(w.phone || '');
              if (name.includes(qLower)) return true;
              if (!isPhone) return phone.includes(q);
              return canonicalSaudiMobile(phone) === phoneKey;
            })
            .slice(0, 6)
        : [];

      setSearchResults({
        orders: Array.isArray(ordersRaw) ? ordersRaw.slice(0, 6) : [],
        customers: Array.isArray(customersRaw) ? customersRaw.slice(0, 6) : [],
        workers: workersFiltered
      });
      setSearchOpen(true);
      setActiveIndex(-1);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      console.error('Global search error:', error);
      setSearchResults({ orders: [], customers: [], workers: [] });
      setSearchOpen(true);
      setActiveIndex(-1);
    }
    if (requestId === searchRequestIdRef.current) {
      setSearchLoading(false);
    }
  };

  const openCustomerProfile = async (customer) => {
    setCustomerProfileLoading(true);
    setCustomerProfile(null);
    setCustomerOrders([]);
    setCustomerOrdersLoading(true);
    try {
      const resp = await api.get(`/khayyat/customers/${customer._id}`);
      const fetched = resp.data?.customer || customer;
      setCustomerProfile(fetched);
    } catch {
      setCustomerProfile(customer);
    }
    setCustomerProfileLoading(false);

    // Fetch customer's stitching orders
    try {
      const ordersResp = await api.get(`/khayyat/stitchings/customer/${customer._id}`, {
        params: { limit: 100 },
      });
      setCustomerOrders(ordersResp.data?.stitchings || []);
    } catch {
      setCustomerOrders([]);
    }
    setCustomerOrdersLoading(false);
  };

  const navigateToResult = (result) => {
    if (!result) return;
    if (result.type === 'order') {
      navigate(`/user/stitchings/${result.item._id}/edit`);
      return;
    }
    if (result.type === 'customer') {
      openCustomerProfile(result.item);
      return;
    }
    if (result.type === 'worker') {
      navigate(`/user/workers/${result.item._id}`);
    }
  };

  useEffect(() => {
    const q = orderSearch.trim();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (!q) {
      setSearchLoading(false);
      setSearchOpen(false);
      setSearchResults({ orders: [], customers: [], workers: [] });
      setActiveIndex(-1);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runGlobalSearch(q);
    }, 120);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [orderSearch]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target)) {
        setSearchOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div data-tutorial="page-dashboard" className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div ref={searchWrapRef} className="relative w-full lg:max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = orderSearch.trim();
              const flat = [
                ...searchResults.orders.map((item) => ({ type: 'order', item })),
                ...searchResults.customers.map((item) => ({ type: 'customer', item })),
                ...searchResults.workers.map((item) => ({ type: 'worker', item }))
              ];

              if (activeIndex >= 0 && flat[activeIndex]) {
                navigateToResult(flat[activeIndex]);
                setSearchOpen(false);
                return;
              }

              if (!q) {
                navigate('/app/dashboard/khayyat/stitchings');
                return;
              }

              navigate(`/user/stitchings?search=${encodeURIComponent(q)}`);
            }}
            className="relative w-full"
          >
            <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-400`} />
            {searchLoading && (
              <div className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400`}>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              onFocus={() => {
                const q = orderSearch.trim();
                if (q) setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                const flat = [
                  ...searchResults.orders.map((item) => ({ type: 'order', item })),
                  ...searchResults.customers.map((item) => ({ type: 'customer', item })),
                  ...searchResults.workers.map((item) => ({ type: 'worker', item }))
                ];
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                  setActiveIndex(-1);
                  return;
                }
                if (e.key === 'ArrowDown') {
                  if (!flat.length) return;
                  e.preventDefault();
                  setSearchOpen(true);
                  setActiveIndex((prev) => {
                    const next = prev + 1;
                    return next >= flat.length ? 0 : next;
                  });
                  return;
                }
                if (e.key === 'ArrowUp') {
                  if (!flat.length) return;
                  e.preventDefault();
                  setSearchOpen(true);
                  setActiveIndex((prev) => {
                    const next = prev - 1;
                    return next < 0 ? flat.length - 1 : next;
                  });
                  return;
                }
                if (e.key === 'Enter') {
                  if (activeIndex >= 0 && flat[activeIndex]) {
                    e.preventDefault();
                    navigateToResult(flat[activeIndex]);
                    setSearchOpen(false);
                  }
                }
              }}
              placeholder={`${(language === 'ar' ? 'بحث' : 'Search')}...`}
              className={`w-full ${isRTL ? 'pr-11 pl-12' : 'pl-11 pr-12'} py-3 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-gray-200/70 dark:border-slate-700/70 rounded-2xl text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 shadow-soft focus:ring-2 focus:ring-primary-500`}
            />
          </form>

          {searchOpen && (
            <div className="absolute z-40 mt-2 w-full rounded-2xl border border-gray-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-soft overflow-hidden">
              <div className="p-2">
                {(() => {
                  let cursor = -1;
                  const sections = [
                    { key: 'orders', title: (language === 'ar' ? 'الخياطة' : 'Stitchings'), type: 'order', items: searchResults.orders },
                    { key: 'customers', title: (language === 'ar' ? 'العملاء' : 'Customers'), type: 'customer', items: searchResults.customers },
                    { key: 'workers', title: (language === 'ar' ? 'العمال' : 'Workers'), type: 'worker', items: searchResults.workers }
                  ];
                  const hasAny = sections.some((s) => (s.items || []).length > 0);

                  if (!hasAny && !searchLoading) {
                    return (
                      <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
                        {(language === 'ar' ? 'لا توجد بيانات' : 'No data available')}
                      </div>
                    );
                  }

                  return sections
                    .filter((s) => (s.items || []).length > 0)
                    .map((section) => (
                      <div key={section.key} className="mb-2 last:mb-0">
                        <div className="px-3 py-2 text-[11px] font-semibold tracking-wide text-gray-400 dark:text-slate-500 uppercase">
                          {section.title}
                        </div>
                        <div className="space-y-1">
                          {section.items.map((item) => {
                            cursor += 1;
                            const idx = cursor;
                            const isActive = idx === activeIndex;

                            const primary =
                              section.type === 'order'
                                ? `#${item.receiptNumber || ''}`
                                : item.nameI18n?.[langKey] || item.name || '';
                            const secondary =
                              section.type === 'order'
                                ? `${item.customerId?.nameI18n?.[langKey] || item.customerId?.name || '-'}${item.customerId?.phone ? ` • ${item.customerId.phone}` : ''}${item.oldInvoiceNumber ? ` • Old: ${item.oldInvoiceNumber}` : ''}`
                                : [
                                    item.phone && item.phone,
                                    item.khayyatReceiptNumbers && `${language === 'ar' ? '\u0625\u064A\u0635\u0627\u0644\u0627\u062A' : 'Receipts'}: ${item.khayyatReceiptNumbers}`,
                                    item.khayyatHijriDate && `${language === 'ar' ? '\u062A\u0627\u0631\u064A\u062E' : 'Date'}: ${item.khayyatHijriDate}`,
                                  ].filter(Boolean).join(' \u2022 ');

                            return (
                              <button
                                key={item._id}
                                type="button"
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={() => {
                                  navigateToResult({ type: section.type, item });
                                  setSearchOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${
                                  isActive
                                    ? 'bg-primary-50 dark:bg-primary-900/20'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                                      {primary || '-'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-slate-400 break-all">{secondary || ''}</div>
                                  </div>
                                  <div className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
                                    {section.type === 'order'
                                      ? (language === 'ar' ? 'الخياطة' : 'Stitchings')
                                      : section.type === 'customer'
                                      ? (language === 'ar' ? 'العملاء' : 'Customers')
                                      : (language === 'ar' ? 'العمال' : 'Workers')}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <Button
            onClick={() => (isDemo ? setDemoBlockedOpen(true) : navigate('/app/dashboard/khayyat/stitchings/new'))}
            icon={Plus}
            variant="success"
            className="rounded-2xl px-5 py-3"
            disabled={isDemo}
          >
            {(language === 'ar' ? 'إنشاء طلب' : 'Create Order')}
          </Button>
          <Button
            variant="outline"
            onClick={() => (isDemo ? setDemoBlockedOpen(true) : navigate('/app/dashboard/khayyat/quick-invoice'))}
            icon={FileText}
            className="rounded-2xl px-5 py-3"
            disabled={isDemo}
          >
            Create Invoice
          </Button>
          <Button
            variant="outline"
            onClick={() => (isDemo ? setDemoBlockedOpen(true) : navigate('/app/dashboard/customers/new?role=customer&returnTo=/app/dashboard/contacts?types=customer'))}
            icon={UserPlus}
            className="rounded-2xl px-5 py-3"
            disabled={isDemo}
          >
            {(language === 'ar' ? 'إضافة عميل' : 'Create Customer')}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{(language === 'ar' ? 'لوحة التحكم' : 'Dashboard')}</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">{(language === 'ar' ? 'مرحباً بك' : 'Welcome')}</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-emerald-900/10 dark:border-emerald-400/10 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 shadow-soft">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-28 -left-28 w-96 h-96 rounded-full bg-black/10 blur-3xl" />
        </div>
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-white/70">{(language === 'ar' ? 'ملخص اليوم' : 'Today\'s Summary')}</p>
                <p className="text-sm sm:text-base font-semibold text-white">
                  {new Intl.DateTimeFormat(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-6">
              <div>
                <p className="text-[11px] font-medium text-white/60">{(language === 'ar' ? 'الطلبات المعلقة' : 'Pending Orders')}</p>
                <p className="mt-1 text-lg sm:text-xl font-bold text-white">{data?.stats?.pendingStitchings || 0}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-white/60">{(language === 'ar' ? 'مستحقة اليوم' : 'Due Today')}</p>
                <p className={`mt-1 text-lg sm:text-xl font-bold ${(data?.stats?.dueTodayCount || 0) > 0 ? 'text-amber-300' : 'text-white'}`}>{data?.stats?.dueTodayCount || 0}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-white/60">{(language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue')}</p>
                <p className="mt-1 text-lg sm:text-xl font-bold text-white flex items-center gap-1">
                  {formatSaudiRiyal(data?.stats?.totalRevenue || 0)}
                  <SARIcon className="w-4 h-4" color="white" />
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-white/60">{(language === 'ar' ? 'مدفوعات معلّقة' : 'Pending Payments')}</p>
                <p className="mt-1 text-lg sm:text-xl font-bold text-white flex items-center gap-1">
                  {formatSaudiRiyal(data?.stats?.pendingPayments || 0)}
                  <SARIcon className="w-4 h-4" color="white" />
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-white/60">{(language === 'ar' ? 'إجمالي العملاء' : 'Total Customers')}</p>
                <p className="mt-1 text-lg sm:text-xl font-bold text-white">{data?.stats?.customersCount || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Alert */}
      {data?.subscription?.daysRemaining <= 7 && data?.subscription?.type !== 'lifetime' && (
        <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-300" />
          <p className="text-amber-800 dark:text-amber-200">
            {(language === 'ar' ? 'حالة الاشتراك' : 'Subscription Status')}: {data.subscription.daysRemaining} {(language === 'ar' ? 'الأيام المتبقية' : 'Days Remaining')}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label={(language === 'ar' ? 'إجمالي العمال' : 'Total Workers')}
          value={data?.stats?.workersCount || 0}
          color="primary"
        />
        <StatCard
          icon={UserPlus}
          label={(language === 'ar' ? 'إجمالي العملاء' : 'Total Customers')}
          value={data?.stats?.customersCount || 0}
          color="emerald"
        />
        <StatCard
          icon={Clock}
          label={(language === 'ar' ? 'الطلبات المعلقة' : 'Pending Orders')}
          value={data?.stats?.pendingStitchings || 0}
          color="amber"
        />
        <StatCard
          icon={() => <SARIcon className="w-6 h-6" />}
          label={(language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue')}
          value={<span className="flex items-center gap-1">{formatSaudiRiyal(data?.stats?.totalRevenue || 0)} <SARIcon className="w-5 h-5" /></span>}
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'قيد التنفيذ' : 'In Progress')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary-600 mt-1">{data?.stats?.inProgressStitchings || 0}</p>
            </div>
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'مكتمل' : 'Completed')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1">{data?.stats?.completedStitchings || 0}</p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'قيد الانتظار' : 'Pending')} Payments</p>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1 flex items-center gap-1">{formatSaudiRiyal(data?.stats?.pendingPayments || 0)} <SARIcon className="w-6 h-6" /></p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <SARIcon className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">{(language === 'ar' ? 'مواعيد التسليم القادمة' : 'Upcoming Due Dates')}</h2>
            <button
              type="button"
              onClick={() => navigate('/app/dashboard/khayyat/stitchings')}
              className="text-sm font-medium text-primary-600 dark:text-primary-300 hover:underline"
            >
              {(language === 'ar' ? 'عرض' : 'View')}
            </button>
          </div>
          {(data?.upcomingDueStitchings || []).length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {(data.upcomingDueStitchings || []).slice(0, 8).map((stitch) => {
                const due = stitch?.dueDate ? new Date(stitch.dueDate) : null;
                const today = new Date();
                const dueMid = due ? new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() : null;
                const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                const diffDays = dueMid === null ? null : Math.round((dueMid - todayMid) / (1000 * 60 * 60 * 24));
                const isOverdue = typeof diffDays === 'number' && diffDays < 0;

                return (
                  <button
                    key={stitch._id}
                    type="button"
                    onClick={() => navigate(`/user/stitchings/${stitch._id}/edit`)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">#{stitch.receiptNumber || ''}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          {stitch.customerId?.nameI18n?.[langKey] || stitch.customerId?.name || '-'}
                          {stitch.customerId?.phone ? ` • ${stitch.customerId.phone}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-slate-100'}`}>
                            {due ? due.toLocaleDateString() : '-'}
                          </div>
                          {typeof diffDays === 'number' ? (
                            <div className={`text-[11px] font-medium ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-slate-400'}`}>
                              {isOverdue
                                ? t('dashboard.overdueByDays', { defaultValue: 'Overdue by {{count}}d', count: Math.abs(diffDays) })
                                : t('dashboard.dueInDays', { defaultValue: 'Due in {{count}}d', count: diffDays })}
                            </div>
                          ) : null}
                        </div>
                        <StatusBadge status={stitch.status} />
                        {stitch.status !== 'delivered' && (
                          <button
                            type="button"
                            title={(language === 'ar' ? 'common.delivered' : 'common.delivered')}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDemo) { setDemoBlockedOpen(true); return; }
                              (async () => {
                                try {
                                  await api.put(`/khayyat/stitchings/${stitch._id}`, { status: 'delivered' });
                                  fetchDashboard();
                                } catch (err) { console.error(err); }
                              })();
                            }}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 transition-colors"
                          >
                            <Truck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'لا توجد بيانات' : 'No data available')}</div>
          )}
        </Card>

        {/* Recent Orders */}
        <Card>
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base">{(language === 'ar' ? 'الطلبات الأخيرة' : 'Recent Orders')}</h2>
          </div>
          {data?.recentStitchings?.length > 0 ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>{(language === 'ar' ? 'رقم الإيصال' : 'Receipt Number')}</Th>
                  <Th>{(language === 'ar' ? 'العميل' : 'Customer')}</Th>
                  <Th>{(language === 'ar' ? 'العامل' : 'Worker')}</Th>
                  <Th>{(language === 'ar' ? 'الحالة' : 'Status')}</Th>
                  <Th>{(language === 'ar' ? 'السعر' : 'Price')}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.recentStitchings.map((stitch) => (
                  <Tr key={stitch._id} onClick={() => navigate(`/user/stitchings/${stitch._id}/edit`)}>
                    <Td className="font-medium">{stitch.receiptNumber}</Td>
                    <Td>{stitch.customerId?.nameI18n?.[langKey] || stitch.customerId?.name || '-'}</Td>
                    <Td>{stitch.workerId?.nameI18n?.[langKey] || stitch.workerId?.name || '-'}</Td>
                    <Td><StatusBadge status={stitch.status} /></Td>
                    <Td className="flex items-center gap-1">{formatSaudiRiyal(stitch.price || 0)} <SARIcon className="w-3 h-3" /></Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          ) : (
            <div className="p-12 text-center text-gray-500 dark:text-slate-400">
              {(language === 'ar' ? 'لا توجد بيانات' : 'No data available')}
            </div>
          )}
        </Card>
      </div>

      <DemoBlockedModal
        isOpen={demoBlockedOpen}
        onClose={() => setDemoBlockedOpen(false)}
        title={(language === 'ar' ? '\u0648\u0636\u0639 \u0627\u0644\u0639\u0631\u0636' : 'Demo Mode')}
        phone="+966596775485"
      />

      {/* Customer Profile Page */}
      {(customerProfile || customerProfileLoading) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={() => { setCustomerProfile(null); setCustomerProfileLoading(false); setCustomerOrders([]); }}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-3xl my-4 mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {customerProfileLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                <p className="mt-3 text-sm text-gray-500">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
              </div>
            ) : customerProfile ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-primary-50 to-emerald-50 dark:from-slate-800 dark:to-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary-600 dark:text-primary-300" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-slate-100">{customerProfile.nameI18n?.[langKey] || customerProfile.name || '-'}</h3>
                      {customerProfile.customerCode && (
                        <p className="text-xs text-gray-400 font-mono">#{customerProfile.customerCode}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setCustomerProfile(null); setCustomerOrders([]); }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                  {/* Info Cards */}
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customerProfile.phone && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
                        <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">{language === 'ar' ? 'الهاتف' : 'Phone'}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300 font-medium" dir="ltr">{customerProfile.phone}</p>
                        </div>
                      </div>
                    )}

                    {customerProfile.khayyatReceiptNumbers && (
                      <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
                        <Receipt className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400">{language === 'ar' ? 'أرقام الإيصالات' : 'Receipt Numbers'}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300 font-mono break-all">{customerProfile.khayyatReceiptNumbers}</p>
                        </div>
                      </div>
                    )}

                    {customerProfile.khayyatHijriDate && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
                        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">{language === 'ar' ? 'التاريخ الهجري' : 'Hijri Date'}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300">{customerProfile.khayyatHijriDate}</p>
                        </div>
                      </div>
                    )}

                    {customerProfile.email && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">{language === 'ar' ? 'البريد' : 'Email'}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300">{customerProfile.email}</p>
                        </div>
                      </div>
                    )}

                    {customerProfile.address && typeof customerProfile.address === 'object' && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">{language === 'ar' ? 'العنوان' : 'Address'}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300">
                            {[
                              customerProfile.address.street,
                              customerProfile.address.district,
                              customerProfile.address.city,
                              customerProfile.address.country,
                            ].filter(Boolean).join(', ') || '-'}
                          </p>
                        </div>
                      </div>
                    )}
                    {typeof customerProfile.address === 'string' && customerProfile.address && (
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-[11px] text-gray-400">{language === 'ar' ? 'العنوان' : 'Address'}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300">{customerProfile.address}</p>
                        </div>
                      </div>
                    )}

                    {customerProfile.notes && (
                      <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 px-4 py-3">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400">{language === 'ar' ? 'ملاحظات' : 'Notes'}</p>
                          <p className="text-sm text-gray-700 dark:text-slate-300">{customerProfile.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Measurements */}
                  {customerProfile.measurements && Object.keys(customerProfile.measurements).length > 0 && (
                    <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-700">
                      <p className="text-xs font-semibold text-gray-500 mb-2">{language === 'ar' ? 'القياسات' : 'Measurements'}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {Object.entries(customerProfile.measurements).filter(([, v]) => v != null && v !== '').map(([key, val]) => (
                          <div key={key} className="bg-gray-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-center">
                            <p className="text-[10px] text-gray-400 capitalize">{key}</p>
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order History */}
                  <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <h4 className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                          {language === 'ar' ? 'سجل الطلبات' : 'Order History'}
                        </h4>
                        {!customerOrdersLoading && (
                          <span className="text-xs text-gray-400">({customerOrders.length})</span>
                        )}
                      </div>
                    </div>

                    {customerOrdersLoading ? (
                      <div className="py-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
                        <p className="mt-2 text-xs text-gray-400">{language === 'ar' ? 'جاري تحميل الطلبات...' : 'Loading orders...'}</p>
                      </div>
                    ) : customerOrders.length > 0 ? (
                      <div className="space-y-2">
                        {customerOrders.map((order) => {
                          const due = order.dueDate ? new Date(order.dueDate) : null;
                          const created = order.createdAt ? new Date(order.createdAt) : null;
                          return (
                            <button
                              key={order._id}
                              type="button"
                              onClick={() => {
                                setCustomerProfile(null);
                                setCustomerOrders([]);
                                navigate(`/user/stitchings/${order._id}/edit`);
                              }}
                              className="w-full text-left rounded-xl border border-gray-100 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-800 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 px-4 py-3 transition-colors group"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                                      #{order.receiptNumber || '-'}
                                    </span>
                                    <StatusBadge status={order.status} />
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-slate-400">
                                    {order.workerId?.name && (
                                      <span>{language === 'ar' ? 'العامل' : 'Worker'}: {order.workerId.name}</span>
                                    )}
                                    {order.quantity != null && (
                                      <span>{language === 'ar' ? 'الكمية' : 'Qty'}: {order.quantity}</span>
                                    )}
                                    {created && (
                                      <span>{created.toLocaleDateString(language)}</span>
                                    )}
                                    {due && (
                                      <span className={due < new Date() && order.status !== 'delivered' ? 'text-rose-500 font-medium' : ''}>
                                        {language === 'ar' ? 'التسليم' : 'Due'}: {due.toLocaleDateString(language)}
                                      </span>
                                    )}
                                  </div>
                                  {order.description && (
                                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500 truncate">{order.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1">
                                      {formatSaudiRiyal(order.price || 0)}
                                      <SARIcon className="w-3 h-3" />
                                    </div>
                                    {order.paidAmount != null && order.paidAmount < (order.price || 0) && (
                                      <div className="text-[10px] text-amber-500 font-medium">
                                        {language === 'ar' ? 'متبقي' : 'Pending'}: {formatSaudiRiyal((order.price || 0) - (order.paidAmount || 0))}
                                      </div>
                                    )}
                                  </div>
                                  <ChevronRight className={`w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors ${isRTL ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                        {language === 'ar' ? 'لا توجد طلبات سابقة' : 'No previous orders'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex gap-2 bg-gray-50/50 dark:bg-slate-800/30">
                  <Button
                    onClick={() => {
                      if (isDemo) {
                        setDemoBlockedOpen(true);
                      } else {
                        navigate(`/app/dashboard/khayyat/stitchings/new?customerId=${customerProfile._id}`);
                      }
                      setCustomerProfile(null);
                      setCustomerOrders([]);
                    }}
                    icon={Scissors}
                    variant="success"
                    className="flex-1 rounded-xl"
                  >
                    {language === 'ar' ? 'إنشاء طلب' : 'New Order'}
                  </Button>
                  <Button
                    onClick={() => {
                      if (isDemo) {
                        setDemoBlockedOpen(true);
                      } else {
                        navigate(`/app/dashboard/khayyat/quick-invoice?customerId=${customerProfile._id}`);
                      }
                      setCustomerProfile(null);
                      setCustomerOrders([]);
                    }}
                    icon={FileText}
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    {language === 'ar' ? 'فاتورة' : 'Invoice'}
                  </Button>
                  <Button
                    onClick={() => { setCustomerProfile(null); setCustomerOrders([]); }}
                    variant="outline"
                    className="rounded-xl"
                  >
                    {language === 'ar' ? 'إغلاق' : 'Close'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;




