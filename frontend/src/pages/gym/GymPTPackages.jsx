import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Calendar, Clock, User, CheckCircle2, History, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function GymPTPackages() {
  const { tenant } = useSelector((s) => s.auth);
  const language = tenant?.settings?.language || 'en';
  const isAr = language === 'ar';
  const currency = tenant?.settings?.currency || 'SAR';
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [logSessionModal, setLogSessionModal] = useState({ isOpen: false, packageId: null });
  const [historyModal, setHistoryModal] = useState({ isOpen: false, package: null });

  // Mocking queries for the sake of completion, replace with actual api.get
  const { data: packagesData, isLoading } = useQuery({
    queryKey: ['gym', 'pt-packages'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/gym/pt-packages');
        return res.data?.data || [];
      } catch (err) {
        return []; // Fallback empty
      }
    }
  });

  const packages = packagesData || [];

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = pkg.member?.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            pkg.member?.nameAr?.includes(searchQuery) ||
                            pkg.trainer?.nameEn?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeTab === 'Active') return pkg.status === 'active';
      if (activeTab === 'Exhausted') return pkg.status === 'exhausted' || pkg.usedSessions >= pkg.totalSessions;
      if (activeTab === 'Expired') return pkg.status === 'expired' || new Date(pkg.expiryDate) < new Date();
      return true;
    });
  }, [packages, activeTab, searchQuery]);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/api/gym/pt-packages', data),
    onSuccess: () => {
      toast.success(isAr ? 'تم إنشاء الباقة بنجاح' : 'Package created successfully');
      queryClient.invalidateQueries(['gym', 'pt-packages']);
      setIsCreateModalOpen(false);
    },
    onError: () => toast.error(isAr ? 'حدث خطأ' : 'An error occurred')
  });

  const logSessionMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/api/gym/pt-packages/${id}/log-session`, data),
    onSuccess: () => {
      toast.success(isAr ? 'تم تسجيل الجلسة بنجاح' : 'Session logged successfully');
      queryClient.invalidateQueries(['gym', 'pt-packages']);
      setLogSessionModal({ isOpen: false, packageId: null });
    },
    onError: () => toast.error(isAr ? 'حدث خطأ' : 'An error occurred')
  });

  const getStatusBadge = (pkg) => {
    const isExpired = new Date(pkg.expiryDate) < new Date();
    const isExhausted = pkg.usedSessions >= pkg.totalSessions;
    if (isExpired) return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">{isAr ? 'منتهي' : 'Expired'}</span>;
    if (isExhausted) return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{isAr ? 'مستنفذ' : 'Exhausted'}</span>;
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">{isAr ? 'نشط' : 'Active'}</span>;
  };

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isAr ? 'rtl' : 'ltr'}`}>
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
            {isAr ? 'التدريب الشخصي' : 'Personal Training'}
          </h1>
          <p className="text-slate-500 mt-1">{isAr ? 'إدارة باقات وجلسات التدريب الشخصي' : 'Manage personal training packages and sessions'}</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
        >
          <Plus className="w-5 h-5" />
          <span>{isAr ? 'باقة جديدة' : 'New Package'}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
          {['All', 'Active', 'Exhausted', 'Expired'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isAr ? (tab === 'All' ? 'الكل' : tab === 'Active' ? 'نشط' : tab === 'Exhausted' ? 'مستنفذ' : 'منتهي') : tab}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${isAr ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={isAr ? 'بحث عن متدرب...' : 'Search member...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all ${isAr ? 'pr-10 pl-4' : ''}`}
          />
        </div>
      </div>

      {/* Packages List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-200 animate-pulse rounded-2xl"></div>
          ))}
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-1">{isAr ? 'لا توجد باقات' : 'No packages found'}</h3>
          <p className="text-slate-500">{isAr ? 'لم يتم العثور على باقات تطابق بحثك.' : 'We could not find any packages matching your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredPackages.map(pkg => {
              const progress = Math.min((pkg.usedSessions / pkg.totalSessions) * 100, 100);
              const remaining = Math.max(pkg.totalSessions - pkg.usedSessions, 0);
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={pkg._id || Math.random()}
                  className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden">
                          {pkg.member?.photo ? (
                            <img src={pkg.member.photo} alt={pkg.member?.nameEn} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{isAr ? pkg.member?.nameAr || pkg.member?.nameEn : pkg.member?.nameEn}</h3>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span>
                            {isAr ? pkg.trainer?.nameAr || pkg.trainer?.nameEn : pkg.trainer?.nameEn}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(pkg)}
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-medium text-slate-700 mb-2">{pkg.packageName}</p>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-xs text-slate-500">{isAr ? 'الجلسات المستخدمة' : 'Used Sessions'} ({pkg.usedSessions}/{pkg.totalSessions})</span>
                        <span className="text-sm font-bold text-slate-800">{remaining} {isAr ? 'متبقية' : 'left'}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="bg-slate-800 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded-xl mb-4">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">{isAr ? 'تاريخ الانتهاء' : 'Expiry Date'}</p>
                        <p className="font-medium text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(pkg.expiryDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">{isAr ? 'السعر' : 'Price'}</p>
                        <p className="font-medium text-slate-700">
                          {pkg.price} <span className="text-xs">{currency}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-t border-slate-100 divide-x divide-slate-100 rtl:divide-x-reverse">
                    <button
                      disabled={remaining === 0}
                      onClick={() => setLogSessionModal({ isOpen: true, packageId: pkg._id })}
                      className="py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {isAr ? 'تسجيل جلسة' : 'Log Session'}
                    </button>
                    <button
                      onClick={() => setHistoryModal({ isOpen: true, package: pkg })}
                      className="py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <History className="w-4 h-4 text-indigo-500" />
                      {isAr ? 'سجل الجلسات' : 'History'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Log Session Modal */}
      <AnimatePresence>
        {logSessionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">{isAr ? 'تسجيل جلسة جديدة' : 'Log New Session'}</h3>
                <button onClick={() => setLogSessionModal({ isOpen: false, packageId: null })} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                logSessionMutation.mutate({
                  id: logSessionModal.packageId,
                  data: Object.fromEntries(formData)
                });
              }} className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
                    <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'المدة (بالدقائق)' : 'Duration (minutes)'}</label>
                    <input type="number" name="duration" required defaultValue={60} min={15} step={5} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label>
                    <textarea name="notes" rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 resize-none"></textarea>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setLogSessionModal({ isOpen: false, packageId: null })} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={logSessionMutation.isPending} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                    {logSessionMutation.isPending ? '...' : (isAr ? 'حفظ الجلسة' : 'Save Session')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session History Modal */}
      <AnimatePresence>
        {historyModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">{isAr ? 'سجل الجلسات' : 'Session History'}</h3>
                  <p className="text-sm text-slate-500">{historyModal.package?.packageName}</p>
                </div>
                <button onClick={() => setHistoryModal({ isOpen: false, package: null })} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto">
                {(!historyModal.package?.sessions || historyModal.package.sessions.length === 0) ? (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500">{isAr ? 'لم يتم تسجيل أي جلسة بعد' : 'No sessions logged yet'}</p>
                  </div>
                ) : (
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {historyModal.package.sessions.map((session, idx) => (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold text-slate-800 text-sm">{new Date(session.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</span>
                            <span className="text-xs font-medium px-2 py-1 bg-slate-50 text-slate-600 rounded-md flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {session.duration} {isAr ? 'د' : 'min'}
                            </span>
                          </div>
                          {session.notes && <p className="text-sm text-slate-600">{session.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Package Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">{isAr ? 'إنشاء باقة جديدة' : 'Create New Package'}</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                createMutation.mutate(Object.fromEntries(formData));
              }} className="p-5 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'اسم الباقة' : 'Package Name'}</label>
                    <input type="text" name="packageName" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" placeholder={isAr ? 'مثال: 10 جلسات تدريب شخصي' : 'e.g., 10 PT Sessions'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'المتدرب' : 'Member'}</label>
                    <select name="memberId" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 bg-white">
                      <option value="">{isAr ? 'اختر المتدرب' : 'Select Member'}</option>
                      <option value="1">John Doe</option>
                      <option value="2">Ahmed Ali</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'المدرب' : 'Trainer'}</label>
                    <select name="trainerId" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 bg-white">
                      <option value="">{isAr ? 'اختر المدرب' : 'Select Trainer'}</option>
                      <option value="1">Mike Johnson</option>
                      <option value="2">Sara Smith</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'إجمالي الجلسات' : 'Total Sessions'}</label>
                    <input type="number" name="totalSessions" required min={1} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
                    <input type="date" name="expiryDate" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'سعر الجلسة' : 'Price per session'} ({currency})</label>
                    <input type="number" name="pricePerSession" required min={0} step={0.01} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'السعر الإجمالي' : 'Total Price'} ({currency})</label>
                    <input type="number" name="price" required min={0} step={0.01} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 bg-slate-50" />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={createMutation.isPending} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm hover:shadow-md disabled:opacity-50">
                    {createMutation.isPending ? '...' : (isAr ? 'إنشاء الباقة' : 'Create Package')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
