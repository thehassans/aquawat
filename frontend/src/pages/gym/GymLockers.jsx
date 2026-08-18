import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Lock, Unlock, AlertTriangle, Key, Search, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function GymLockers() {
  const { tenant } = useSelector((s) => s.auth);
  const language = tenant?.settings?.language || 'en';
  const isAr = language === 'ar';
  const currency = tenant?.settings?.currency || 'SAR';
  const queryClient = useQueryClient();

  const [activeZone, setActiveZone] = useState('All');
  const [selectedLocker, setSelectedLocker] = useState(null);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);

  // Mock Queries
  const { data: lockersData = [], isLoading } = useQuery({
    queryKey: ['gym', 'lockers'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/gym/lockers');
        return res.data?.data || [];
      } catch {
        return [];
      }
    }
  });

  const lockers = lockersData;

  const filteredLockers = useMemo(() => {
    if (activeZone === 'All') return lockers;
    return lockers.filter(l => l.zone === activeZone);
  }, [lockers, activeZone]);

  const stats = useMemo(() => {
    let available = 0, occupied = 0, maintenance = 0;
    lockers.forEach(l => {
      if (l.status === 'available') available++;
      else if (l.status === 'occupied') occupied++;
      else if (l.status === 'maintenance') maintenance++;
    });
    return { available, occupied, maintenance, total: lockers.length };
  }, [lockers]);

  const assignMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/gym/lockers/${id}/assign`, data),
    onSuccess: () => { toast.success(isAr ? 'تم تعيين الخزانة' : 'Locker assigned'); queryClient.invalidateQueries(['gym', 'lockers']); setSelectedLocker(null); }
  });

  const releaseMutation = useMutation({
    mutationFn: (id) => api.put(`/api/gym/lockers/${id}/release`),
    onSuccess: () => { toast.success(isAr ? 'تم إخلاء الخزانة' : 'Locker released'); queryClient.invalidateQueries(['gym', 'lockers']); setSelectedLocker(null); }
  });

  const toggleMaintenanceMutation = useMutation({
    mutationFn: ({ id, isMaintenance }) => api.put(`/api/gym/lockers/${id}/maintenance`, { status: isMaintenance ? 'maintenance' : 'available' }),
    onSuccess: () => { toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated'); queryClient.invalidateQueries(['gym', 'lockers']); setSelectedLocker(null); }
  });

  const batchAddMutation = useMutation({
    mutationFn: (data) => api.post('/api/gym/lockers/batch', data),
    onSuccess: () => { toast.success(isAr ? 'تم إضافة الخزائن' : 'Lockers added'); queryClient.invalidateQueries(['gym', 'lockers']); setIsAddBatchOpen(false); }
  });

  const getLockerStyle = (locker) => {
    if (locker.status === 'maintenance') return 'bg-slate-100 border-slate-200 text-slate-400';
    if (locker.status === 'available') return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:shadow-md cursor-pointer';
    
    // occupied
    if (locker.assignedUntil) {
      const daysLeft = (new Date(locker.assignedUntil) - new Date()) / (1000 * 60 * 60 * 24);
      if (daysLeft < 7) return 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:shadow-md cursor-pointer';
    }
    return 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:shadow-md cursor-pointer';
  };

  const zones = ['All', 'Men', 'Women', 'VIP', 'Unisex'];

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isAr ? 'rtl' : 'ltr'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
            {isAr ? 'إدارة الخزائن' : 'Locker Management'}
          </h1>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div> {isAr ? 'متاح' : 'Available'}: <b>{stats.available}</b></span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-400"></div> {isAr ? 'مشغول' : 'Occupied'}: <b>{stats.occupied}</b></span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div> {isAr ? 'صيانة' : 'Maintenance'}: <b>{stats.maintenance}</b></span>
          </div>
        </div>
        <button onClick={() => setIsAddBatchOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-sm">
          <Plus className="w-5 h-5" />
          <span>{isAr ? 'إضافة خزائن' : 'Add Lockers'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6 flex overflow-x-auto hide-scrollbar gap-2">
        {zones.map(zone => (
          <button
            key={zone}
            onClick={() => setActiveZone(zone)}
            className={`px-5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeZone === zone ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isAr ? (zone === 'All' ? 'الكل' : zone === 'Men' ? 'رجال' : zone === 'Women' ? 'نساء' : zone === 'Unisex' ? 'مشترك' : zone) : zone}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {[...Array(40)].map((_, i) => <div key={i} className="aspect-square bg-slate-200 animate-pulse rounded-xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
          <AnimatePresence>
            {filteredLockers.map(locker => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={locker._id || Math.random()}
                onClick={() => setSelectedLocker(locker)}
                className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center transition-all p-2 ${getLockerStyle(locker)}`}
                title={locker.status === 'occupied' ? locker.member?.nameEn : ''}
              >
                {locker.status === 'maintenance' && <ShieldAlert className="absolute top-1.5 right-1.5 w-3.5 h-3.5 opacity-50" />}
                {locker.status === 'occupied' && <Lock className="absolute top-1.5 right-1.5 w-3.5 h-3.5 opacity-75" />}
                
                <span className="font-bold text-lg leading-none mb-1">{locker.number}</span>
                <span className="text-[10px] font-medium opacity-75 uppercase">{locker.size}</span>
                
                {locker.status === 'occupied' && (
                  <div className="absolute bottom-1.5 inset-x-1.5 text-center truncate text-[10px] font-medium bg-white/30 rounded px-1 backdrop-blur-sm">
                    {locker.member?.nameEn?.split(' ')[0] || 'User'}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Locker Detail Modal */}
      <AnimatePresence>
        {selectedLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                    selectedLocker.status === 'available' ? 'bg-emerald-100 text-emerald-700' : 
                    selectedLocker.status === 'occupied' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {selectedLocker.number}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{isAr ? 'تفاصيل الخزانة' : 'Locker Details'}</h3>
                    <p className="text-xs text-slate-500">{selectedLocker.zone} • Size {selectedLocker.size}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedLocker(null)} className="text-slate-400 hover:bg-slate-200 p-1.5 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5">
                {selectedLocker.status === 'available' ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    assignMutation.mutate({ id: selectedLocker._id, data: Object.fromEntries(formData) });
                  }}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'بحث عن متدرب' : 'Member'}</label>
                        <select name="memberId" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20">
                          <option value="">Select...</option>
                          <option value="1">John Doe</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'من تاريخ' : 'From Date'}</label>
                          <input type="date" name="assignedFrom" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'إلى تاريخ' : 'Until Date'}</label>
                          <input type="date" name="assignedUntil" required className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'رسوم الإيجار' : 'Rental Fee'} ({currency})</label>
                          <input type="number" name="rentalFee" defaultValue={0} min={0} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'التأمين' : 'Deposit'} ({currency})</label>
                          <input type="number" name="deposit" defaultValue={0} min={0} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                      <button type="button" onClick={() => toggleMaintenanceMutation.mutate({ id: selectedLocker._id, isMaintenance: true })} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-4 h-4" /> {isAr ? 'تحويل للصيانة' : 'Set Maintenance'}
                      </button>
                      <button type="submit" disabled={assignMutation.isPending} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">
                        {isAr ? 'تعيين الخزانة' : 'Assign Locker'}
                      </button>
                    </div>
                  </form>
                ) : selectedLocker.status === 'occupied' ? (
                  <div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-slate-200"><User className="w-5 h-5 text-slate-400" /></div>
                        <div>
                          <h4 className="font-semibold text-slate-800">{selectedLocker.member?.nameEn || 'Unknown Member'}</h4>
                          <p className="text-xs text-slate-500">{isAr ? 'معينة منذ' : 'Assigned since'} {new Date(selectedLocker.assignedFrom).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                        <span className="text-sm text-slate-600">{isAr ? 'تنتهي في' : 'Ends on'}:</span>
                        <span className="text-sm font-semibold text-slate-800">{new Date(selectedLocker.assignedUntil).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => releaseMutation.mutate(selectedLocker._id)} className="flex-1 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-medium hover:bg-rose-100 transition-colors border border-rose-100 flex items-center justify-center gap-2">
                        <Unlock className="w-4 h-4" /> {isAr ? 'إخلاء' : 'Release'}
                      </button>
                      <button className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors border border-slate-900">
                        {isAr ? 'تمديد' : 'Extend'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="font-medium text-slate-800 mb-1">{isAr ? 'الخزانة تحت الصيانة' : 'Locker in Maintenance'}</h4>
                    <p className="text-sm text-slate-500 mb-6">{isAr ? 'هذه الخزانة غير متاحة للاستخدام حالياً.' : 'This locker is currently unavailable for use.'}</p>
                    <button onClick={() => toggleMaintenanceMutation.mutate({ id: selectedLocker._id, isMaintenance: false })} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors w-full">
                      {isAr ? 'إتاحة الخزانة' : 'Make Available'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Batch Modal */}
      <AnimatePresence>
        {isAddBatchOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">{isAr ? 'إضافة خزائن' : 'Batch Add Lockers'}</h3>
                <button onClick={() => setIsAddBatchOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                batchAddMutation.mutate(Object.fromEntries(formData));
              }} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'المنطقة' : 'Zone'}</label>
                    <select name="zone" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20">
                      {zones.filter(z => z !== 'All').map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'الحجم' : 'Size'}</label>
                    <select name="size" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20">
                      <option value="S">Small</option><option value="M">Medium</option><option value="L">Large</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'بادئة الرقم' : 'Prefix (Optional)'}</label>
                  <input type="text" name="prefix" placeholder="e.g. A" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'رقم البداية' : 'Start Number'}</label>
                    <input type="number" name="start" required min={1} defaultValue={1} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{isAr ? 'رقم النهاية' : 'End Number'}</label>
                    <input type="number" name="end" required min={1} defaultValue={50} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20" />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsAddBatchOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancel</button>
                  <button type="submit" disabled={batchAddMutation.isPending} className="px-5 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">Generate</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
