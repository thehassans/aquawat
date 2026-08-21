import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../../lib/translations';
import { Scissors, Users, Banknote, TrendingUp, Sparkles, Clock, CalendarDays } from 'lucide-react';
import api from '../../lib/api';
import CurrencySymbol from '../../components/ui/CurrencySymbol';

export default function SaloonDashboard() {
  const { language } = useSelector((state) => state.ui);
  const { tenant } = useSelector((state) => state.auth);
  const { t } = useTranslation(language);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todayRevenue: 0,
    todayOrders: 0,
    activeTickets: 0,
    totalServices: 0,
    recentOrders: []
  });

  const isRtl = language === 'ar';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [ordersRes, servicesRes] = await Promise.all([
        api.get('/saloon/orders'),
        api.get('/saloon/services')
      ]);

      const orders = ordersRes.data?.orders || [];
      const services = Array.isArray(servicesRes.data) ? servicesRes.data : (servicesRes.data?.services || []);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
      const activeTickets = orders.filter(o => o.status === 'in_progress' || o.status === 'waiting');

      setMetrics({
        todayRevenue,
        todayOrders: todayOrders.length,
        activeTickets: activeTickets.length,
        totalServices: services.length,
        recentOrders: orders.slice(0, 5)
      });
    } catch (error) {
      console.error('Failed to load saloon dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, isCurrency = false }) => (
    <div className="bg-white dark:bg-dark-900 rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50/50 dark:border-dark-800 transition-all hover:-translate-y-1 duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-dark-800 text-gray-900 dark:text-gray-100">
          <Icon className="w-6 h-6 stroke-[1.5]" />
        </div>
      </div>
      <div>
        <h3 className="text-4xl font-light text-gray-900 dark:text-white mb-2 tracking-tight flex items-baseline gap-2">
          {value}
          {isCurrency && <CurrencySymbol currency={tenant?.settings?.currency} className="w-5 h-5 text-gray-400" />}
        </h3>
        <p className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{title}</p>
        <p className="text-xs text-gray-400 mt-2">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-100 dark:border-dark-800 pb-8">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-gray-900 dark:text-white mb-2">
            {isRtl ? 'لوحة القيادة' : 'Dashboard'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide uppercase">
            {isRtl ? 'أداء الصالون اليوم' : 'Saloon Performance Today'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-dark-900 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-dark-800 text-sm font-medium text-gray-600 dark:text-gray-300">
          <CalendarDays className="w-4 h-4" />
          {new Date().toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={isRtl ? 'الإيرادات' : "Revenue"}
          value={metrics.todayRevenue.toFixed(2)}
          subtitle={isRtl ? 'مبيعات اليوم' : 'Sales today'}
          icon={Banknote}
          isCurrency={true}
        />
        <StatCard
          title={isRtl ? 'العملاء' : "Customers"}
          value={metrics.todayOrders}
          subtitle={isRtl ? 'تمت خدمتهم اليوم' : 'Served today'}
          icon={Users}
        />
        <StatCard
          title={isRtl ? 'الانتظار' : 'Queue'}
          value={metrics.activeTickets}
          subtitle={isRtl ? 'في الانتظار حالياً' : 'Currently waiting'}
          icon={Clock}
        />
        <StatCard
          title={isRtl ? 'الخدمات' : 'Services'}
          value={metrics.totalServices}
          subtitle={isRtl ? 'متاحة للحجز' : 'Available to book'}
          icon={Scissors}
        />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Recent Orders List */}
        <div className="xl:col-span-2 bg-white dark:bg-dark-900 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50/50 dark:border-dark-800">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-light text-gray-900 dark:text-white">
              {isRtl ? 'الطلبات الأخيرة' : 'Recent Activity'}
            </h3>
            <button className="text-sm font-medium text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              {isRtl ? 'عرض الكل' : 'View All'}
            </button>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-50 dark:bg-dark-800 rounded-2xl" />
              ))}
            </div>
          ) : metrics.recentOrders.length > 0 ? (
            <div className="space-y-4">
              {metrics.recentOrders.map((order) => (
                <div key={order._id} className="group flex items-center justify-between p-5 rounded-2xl hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-dark-700">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-white flex items-center justify-center font-mono text-lg tracking-tighter">
                      {order.queueNumber ? `Q${order.queueNumber}` : order.orderNumber?.split('-')[1]?.slice(-3)}
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                        {order.customerName || (isRtl ? 'عميل عام' : 'Walk-in Customer')}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span className="capitalize">{order.status || 'waiting'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-light text-gray-900 dark:text-white flex items-center gap-1.5 justify-end">
                      {order.grandTotal?.toFixed(2)}
                      <CurrencySymbol currency={tenant?.settings?.currency} className="w-4 h-4 text-gray-400" />
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <div className="w-20 h-20 bg-gray-50 dark:bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Scissors className="w-8 h-8 stroke-[1.5]" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">{isRtl ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
              <p className="text-sm">{isRtl ? 'ابدأ في إنشاء طلبات جديدة من نقاط البيع' : 'Start creating new orders from POS'}</p>
            </div>
          )}
        </div>

        {/* Hero Highlight Widget */}
        <div className="bg-gray-900 dark:bg-black rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <Sparkles className="w-10 h-10 text-gray-400 mb-8 stroke-[1.5]" />
            <h3 className="text-4xl font-light mb-4 leading-tight">
              {isRtl ? 'مرحباً بك في مساحتك' : 'Welcome to your space'}
            </h3>
            <p className="text-gray-400 text-lg font-light leading-relaxed mb-12">
              {isRtl 
                ? 'أدر خدماتك وعملائك ونقاط البيع ببساطة مطلقة.' 
                : 'Manage your services, customers, and point of sale with absolute simplicity.'}
            </p>
          </div>
          
          <div className="relative z-10 bg-white/10 backdrop-blur-xl rounded-[1.5rem] p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-300 font-medium tracking-wide uppercase text-sm">
                {isRtl ? 'أداء اليوم' : "Today's Performance"}
              </span>
              <TrendingUp className="w-5 h-5 text-gray-300" />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-light tracking-tight">{metrics.todayOrders}</span>
              <span className="text-gray-400 font-medium uppercase tracking-widest text-xs">
                {isRtl ? 'زيارة' : 'Visits'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
