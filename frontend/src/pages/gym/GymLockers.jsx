import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Plus,
  Key,
  Calendar,
  User,
  CheckCircle2,
  X,
  Shield,
  Layers,
  Sparkles,
  Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

export default function GymLockers() {
  const queryClient = useQueryClient();
  const { language } = useSelector((state) => state.ui);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const [sectionFilter, setSectionFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState(null);

  // Assign Form State
  const [assignData, setAssignData] = useState({
    memberId: '',
    rentalDays: 30,
    keyPinCode: '',
    rentalFee: 100,
    depositAmount: 50,
  });

  // Create Locker Form State
  const [createData, setCreateData] = useState({
    lockerNumber: '',
    section: 'mens_area',
    size: 'standard',
    keyPinCode: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['gym-lockers'],
    queryFn: () => api.get('/gym/lockers').then((res) => res.data),
  });

  const { data: membersData } = useQuery({
    queryKey: ['gym-members-all'],
    queryFn: () => api.get('/gym/members?limit=100').then((res) => res.data),
  });

  const lockers = data?.lockers || [];
  const members = membersData?.members || [];

  const filteredLockers = lockers.filter((l) => {
    if (sectionFilter === 'all') return true;
    return l.section === sectionFilter;
  });

  const totalLockers = lockers.length;
  const occupiedLockers = lockers.filter((l) => l.status === 'occupied').length;
  const availableLockers = lockers.filter((l) => l.status === 'available').length;

  const createLockerMutation = useMutation({
    mutationFn: (payload) => api.post('/gym/lockers', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تمت إضافة الخزانة بنجاح' : 'Locker created successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-lockers'] });
      setShowAddModal(false);
      setCreateData({
        lockerNumber: '',
        section: 'mens_area',
        size: 'standard',
        keyPinCode: '',
      });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to create locker');
    },
  });

  const assignLockerMutation = useMutation({
    mutationFn: ({ lockerId, payload }) => api.post(`/gym/lockers/${lockerId}/assign`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم تأجير وتعيين الخزانة بنجاح' : 'Locker assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['gym-lockers'] });
      setShowAssignModal(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to assign locker');
    },
  });

  const releaseLockerMutation = useMutation({
    mutationFn: (lockerId) => api.post(`/gym/lockers/${lockerId}/release`),
    onSuccess: () => {
      toast.success(isAr ? 'تم إخلاء الخزانة وإعادتها للمتاح' : 'Locker released to available');
      queryClient.invalidateQueries({ queryKey: ['gym-lockers'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to release locker');
    },
  });

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* ── HEADER ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'مصفوفة وإدارة الخزائن الذكية' : 'Lockers Management Matrix'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'إدارة تأجير الخزائن، الأرقام السرية، المفاتيح، وتواريخ الإخلاء'
                  : 'Manage locker rentals, key/PIN codes, occupancy status, and security deposits'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-extrabold shadow-md shadow-cyan-600/20 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'إضافة خزانة جديدة' : 'Add Locker Unit'}</span>
        </button>
      </div>

      {/* ── KPI METRIC PILLS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">{isAr ? 'إجمالي الخزائن' : 'Total Lockers'}</span>
            <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">{totalLockers}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 dark:bg-dark-700 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">{isAr ? 'الخزائن الشاغرة' : 'Available'}</span>
            <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">{availableLockers}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 flex items-center justify-center">
            <Unlock className="w-5 h-5" />
          </div>
        </div>

        <div className="card p-5 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 block">{isAr ? 'المؤجرة والمشغولة' : 'Occupied'}</span>
            <p className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1">{occupiedLockers}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── SECTION TABS ────────────────────────────────────────────────────────── */}
      <div className="card p-3 rounded-2xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'all', en: 'All Sections', ar: 'كل الأقسام' },
          { id: 'mens_area', en: 'Men Section', ar: 'قسم الرجال' },
          { id: 'womens_area', en: 'Women Section', ar: 'قسم السيدات' },
          { id: 'vip_lounge', en: 'VIP Lounge', ar: 'صالة VIP' },
          { id: 'main_hallway', en: 'Main Hallway', ar: 'الممر الرئيسي' },
        ].map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => setSectionFilter(sec.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              sectionFilter === sec.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-700'
            }`}
          >
            {isAr ? sec.ar : sec.en}
          </button>
        ))}
      </div>

      {/* ── LOCKER MATRIX VISUAL GRID ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent mb-2" />
            <p className="text-xs">{isAr ? 'جاري تحميل الخزائن...' : 'Loading lockers matrix...'}</p>
          </div>
        ) : filteredLockers.length === 0 ? (
          <div className="col-span-full py-20 text-center card p-8 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700">
            <Lock className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'لا توجد خزائن مسجلة في هذا القسم' : 'No Lockers in this Section'}
            </h3>
          </div>
        ) : (
          filteredLockers.map((locker) => {
            const isOcc = locker.status === 'occupied';
            const member = locker.currentMemberId || {};

            return (
              <div
                key={locker._id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                  isOcc
                    ? 'bg-cyan-50/60 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-800/60 shadow-sm'
                    : 'bg-white dark:bg-dark-800 border-slate-200/80 dark:border-dark-700 hover:border-emerald-400 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      #{locker.lockerNumber}
                    </span>
                    <span className={`p-1 rounded-lg ${isOcc ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/50' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'}`}>
                      {isOcc ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </span>
                  </div>

                  {isOcc ? (
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {member.nameEn || 'Occupied'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {member.memberNumber || member.phone}
                      </p>
                      {locker.rentalEndDate && (
                        <p className="text-[10px] text-cyan-800 dark:text-cyan-300 font-medium">
                          {isAr ? 'ينتهي:' : 'Ends:'} {new Date(locker.rentalEndDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      {isAr ? 'متاحة للتأجير' : 'Available'}
                    </p>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200/60 dark:border-dark-700">
                  {isOcc ? (
                    <button
                      type="button"
                      onClick={() => releaseLockerMutation.mutate(locker._id)}
                      className="w-full py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold"
                    >
                      {isAr ? 'إخلاء الخزانة' : 'Release Unit'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLocker(locker);
                        setShowAssignModal(true);
                      }}
                      className="w-full py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-bold"
                    >
                      {isAr ? 'تأجير لعضو' : 'Assign Locker'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── ASSIGN LOCKER MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAssignModal && selectedLocker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-sm overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isAr ? `تأجير الخزانة #${selectedLocker.lockerNumber}` : `Assign Locker #${selectedLocker.lockerNumber}`}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedLocker.section}</p>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label">{isAr ? 'اختر العضو المستأجر' : 'Select Member'}</label>
                  <select
                    value={assignData.memberId}
                    onChange={(e) => setAssignData({ ...assignData, memberId: e.target.value })}
                    className="select mt-1"
                  >
                    <option value="">{isAr ? '-- اختر العضو --' : '-- Select Member --'}</option>
                    {members.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.nameEn} ({m.memberNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{isAr ? 'مدة التأجير (أيام)' : 'Rental Days'}</label>
                    <input
                      type="number"
                      min="1"
                      value={assignData.rentalDays}
                      onChange={(e) => setAssignData({ ...assignData, rentalDays: Number(e.target.value) })}
                      className="input mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="label">{isAr ? 'رمز PIN / القفل' : 'Lock PIN Code'}</label>
                    <input
                      type="text"
                      value={assignData.keyPinCode}
                      onChange={(e) => setAssignData({ ...assignData, keyPinCode: e.target.value })}
                      placeholder="e.g. 4821"
                      className="input mt-1 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={!assignData.memberId || assignLockerMutation.isPending}
                  onClick={() =>
                    assignLockerMutation.mutate({
                      lockerId: selectedLocker._id,
                      payload: assignData,
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {assignLockerMutation.isPending ? 'Assigning...' : isAr ? 'تأكيد التأجير' : 'Confirm Assignment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREATE LOCKER MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-sm overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isAr ? 'إضافة خزانة جديدة' : 'Add New Locker Unit'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createLockerMutation.mutate(createData);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="label">{isAr ? 'رقم الخزانة *' : 'Locker Number *'}</label>
                  <input
                    type="text"
                    required
                    value={createData.lockerNumber}
                    onChange={(e) => setCreateData({ ...createData, lockerNumber: e.target.value })}
                    placeholder="e.g. 101, A-12"
                    className="input mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="label">{isAr ? 'القسم / الموقع' : 'Section'}</label>
                  <select
                    value={createData.section}
                    onChange={(e) => setCreateData({ ...createData, section: e.target.value })}
                    className="select mt-1"
                  >
                    <option value="mens_area">{isAr ? 'قسم الرجال' : 'Men Section'}</option>
                    <option value="womens_area">{isAr ? 'قسم السيدات' : 'Women Section'}</option>
                    <option value="vip_lounge">{isAr ? 'صالة VIP' : 'VIP Lounge'}</option>
                    <option value="main_hallway">{isAr ? 'الممر الرئيسي' : 'Main Hallway'}</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-dark-700">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createLockerMutation.isPending}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md"
                  >
                    {createLockerMutation.isPending ? 'Saving...' : isAr ? 'حفظ الخزانة' : 'Save Locker'}
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
