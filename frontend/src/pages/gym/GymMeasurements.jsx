import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, User, Activity, Scale, Droplet, ArrowUp, ArrowDown, Minus, Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

function MiniLineChart({ data, color = '#10b981', width = 280, height = 80 }) {
  if (!data || data.length < 2) return <div className="text-xs text-slate-400 h-full flex items-center justify-center">Not enough data</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 12;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-sm">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {data.map((v, i) => {
        const x = padding + (i / (data.length - 1)) * w;
        const y = padding + h - ((v - min) / range) * h;
        return <circle key={i} cx={x} cy={y} r="3.5" fill="white" stroke={color} strokeWidth="2" />;
      })}
    </svg>
  );
}

export default function GymMeasurements() {
  const { language = 'en' } = useSelector((state) => state.ui || {})
  const { tenant } = useSelector((state) => state.auth || {})
  const isAr = language === 'ar';
  const queryClient = useQueryClient();

  const [selectedMember, setSelectedMember] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch real members from gym API
  const { data: membersData } = useQuery({
    queryKey: ['gym-members-select'],
    queryFn: () => api.get('/api/gym/members?limit=100').then(res => res.data.data?.docs || res.data.data || [])
  });
  const members = membersData || [];

  React.useEffect(() => {
    if (!selectedMember && members.length > 0) {
      setSelectedMember(members[0]._id || members[0].id);
    }
  }, [members, selectedMember]);

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['gym', 'measurements', selectedMember],
    queryFn: async () => {
      if (!selectedMember) return [];
      try {
        const res = await api.get(`/api/gym/measurements/member/${selectedMember}`);
        return res.data?.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!selectedMember
  });

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/api/gym/measurements', data),
    onSuccess: () => {
      toast.success(isAr ? 'تم الحفظ بنجاح' : 'Saved successfully');
      queryClient.invalidateQueries(['gym', 'measurements', selectedMember]);
      setIsAddModalOpen(false);
    },
    onError: () => toast.error(isAr ? 'حدث خطأ' : 'An error occurred')
  });

  const sortedMeasurements = [...measurements].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sortedMeasurements[0] || null;
  const previous = sortedMeasurements[1] || null;

  const getChange = (curr, prev) => {
    if (!curr || !prev) return null;
    const diff = (curr - prev).toFixed(1);
    if (diff > 0) return { type: 'up', text: `+${diff}` };
    if (diff < 0) return { type: 'down', text: diff };
    return { type: 'none', text: '0.0' };
  };

  const getBmiCategory = (bmi) => {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: isAr ? 'نقص وزن' : 'Underweight', color: 'text-blue-600 bg-blue-50' };
    if (bmi < 25) return { label: isAr ? 'طبيعي' : 'Normal', color: 'text-emerald-600 bg-emerald-50' };
    if (bmi < 30) return { label: isAr ? 'وزن زائد' : 'Overweight', color: 'text-amber-600 bg-amber-50' };
    return { label: isAr ? 'سمنة' : 'Obese', color: 'text-red-600 bg-red-50' };
  };

  const weightData = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date)).map(m => m.weight).filter(Boolean);
  const bodyFatData = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date)).map(m => m.bodyFat).filter(Boolean);
  const muscleMassData = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date)).map(m => m.muscleMass).filter(Boolean);

  const renderMetricCard = (title, value, unit, icon, change) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <div className="p-2 bg-slate-50 rounded-lg text-slate-600">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl font-bold text-slate-800">{value || '--'}</h4>
        <span className="text-sm text-slate-500">{unit}</span>
      </div>
      {change && (
        <div className="mt-2 flex items-center gap-1 text-sm">
          {change.type === 'up' && <ArrowUp className="w-4 h-4 text-rose-500" />}
          {change.type === 'down' && <ArrowDown className="w-4 h-4 text-emerald-500" />}
          {change.type === 'none' && <Minus className="w-4 h-4 text-slate-400" />}
          <span className={change.type === 'up' ? 'text-rose-600 font-medium' : change.type === 'down' ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
            {change.text} {unit}
          </span>
          <span className="text-slate-400 text-xs ms-1">{isAr ? 'عن السابق' : 'vs prev'}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-50 p-6 ${isAr ? 'rtl' : 'ltr'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
            {isAr ? 'القياسات البدنية' : 'Body Measurements'}
          </h1>
          <p className="text-slate-500 mt-1">{isAr ? 'تتبع تركيبة الجسم والمقاسات' : 'Track body composition and metrics'}</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedMember || ''}
            onChange={(e) => setSelectedMember(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 bg-white shadow-sm"
          >
            <option value="">{isAr ? '-- اختر متدرب --' : '-- Select Member --'}</option>
            {members.map(m => (
              <option key={m._id || m.id} value={m._id || m.id}>
                {m.memberNumber ? `${m.memberNumber} - ` : ''}{isAr ? (m.nameAr || m.nameEn || m.firstName) : (m.nameEn || m.nameAr || m.firstName)}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedMember}
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-sm hover:shadow-md disabled:opacity-50 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{isAr ? 'قياس جديد' : 'Add Measurement'}</span>
          </button>
        </div>
      </div>

      {!selectedMember ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-2xl border border-slate-100 shadow-sm text-center px-4">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">{isAr ? 'اختر متدرب لعرض القياسات' : 'Select a member to view measurements'}</h3>
          <p className="text-slate-500 max-w-sm">{isAr ? 'يمكنك تتبع التغيرات في الوزن، نسبة الدهون، الكتلة العضلية، والمزيد.' : 'You can track changes in weight, body fat %, muscle mass, and more.'}</p>
        </div>
      ) : isLoading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><div className="h-32 bg-slate-200 rounded-2xl"></div><div className="h-32 bg-slate-200 rounded-2xl"></div><div className="h-32 bg-slate-200 rounded-2xl"></div><div className="h-32 bg-slate-200 rounded-2xl"></div></div>
          <div className="h-64 bg-slate-200 rounded-2xl"></div>
        </div>
      ) : sortedMeasurements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm text-center px-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Scale className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">{isAr ? 'لا توجد قياسات مسجلة' : 'No measurements recorded'}</h3>
          <button onClick={() => setIsAddModalOpen(true)} className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors">
            {isAr ? 'إضافة أول قياس' : 'Add First Measurement'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderMetricCard(isAr ? 'الوزن' : 'Weight', latest?.weight, 'kg', <Scale className="w-5 h-5" />, getChange(latest?.weight, previous?.weight))}
            {renderMetricCard(isAr ? 'نسبة الدهون' : 'Body Fat', latest?.bodyFat, '%', <Droplet className="w-5 h-5" />, getChange(latest?.bodyFat, previous?.bodyFat))}
            {renderMetricCard(isAr ? 'الكتلة العضلية' : 'Muscle Mass', latest?.muscleMass, 'kg', <Activity className="w-5 h-5" />, getChange(latest?.muscleMass, previous?.muscleMass))}
            
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-slate-500 text-sm font-medium">{isAr ? 'مؤشر كتلة الجسم' : 'BMI'}</p>
                <div className="p-2 bg-slate-50 rounded-lg text-slate-600"><Activity className="w-5 h-5" /></div>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <h4 className="text-2xl font-bold text-slate-800">{latest?.bmi || '--'}</h4>
              </div>
              {latest?.bmi && (
                <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getBmiCategory(latest.bmi).color}`}>
                  {getBmiCategory(latest.bmi).label}
                </span>
              )}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-medium text-slate-800 mb-4">{isAr ? 'تطور الوزن' : 'Weight Progress'}</h4>
              <div className="h-32"><MiniLineChart data={weightData} color="#3b82f6" /></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-medium text-slate-800 mb-4">{isAr ? 'تطور نسبة الدهون' : 'Body Fat Progress'}</h4>
              <div className="h-32"><MiniLineChart data={bodyFatData} color="#f43f5e" /></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <h4 className="font-medium text-slate-800 mb-4">{isAr ? 'تطور الكتلة العضلية' : 'Muscle Mass Progress'}</h4>
              <div className="h-32"><MiniLineChart data={muscleMassData} color="#10b981" /></div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold text-lg text-slate-800">{isAr ? 'سجل القياسات' : 'Measurement History'}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                    <th className="p-4 font-medium">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="p-4 font-medium">{isAr ? 'الوزن (kg)' : 'Weight (kg)'}</th>
                    <th className="p-4 font-medium">{isAr ? 'الدهون (%)' : 'Body Fat (%)'}</th>
                    <th className="p-4 font-medium">{isAr ? 'العضلات (kg)' : 'Muscle (kg)'}</th>
                    <th className="p-4 font-medium">BMI</th>
                    <th className="p-4 font-medium">{isAr ? 'الخصر (cm)' : 'Waist (cm)'}</th>
                    <th className="p-4 font-medium">{isAr ? 'الصدر (cm)' : 'Chest (cm)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedMeasurements.map((m) => (
                    <tr key={m._id || Math.random()} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-800">{new Date(m.date || Date.now()).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}</td>
                      <td className="p-4 text-sm text-slate-600">{m.weight || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{m.bodyFat || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{m.muscleMass || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{m.bmi || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{m.waist || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{m.chest || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-slate-900/20 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-auto"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800">{isAr ? 'إضافة قياس جديد' : 'Add New Measurement'}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                formData.append('memberId', selectedMember);
                addMutation.mutate(Object.fromEntries(formData));
              }} className="p-5">
                
                <h4 className="text-sm font-semibold text-slate-800 mb-3 bg-slate-50 p-2 rounded-lg">{isAr ? 'التركيبة العامة' : 'General Composition'}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'التاريخ' : 'Date'}</label>
                    <input type="date" name="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'الوزن' : 'Weight'} (kg)</label>
                    <input type="number" name="weight" step="0.1" required className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'الطول' : 'Height'} (cm)</label>
                    <input type="number" name="height" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'نسبة الدهون' : 'Body Fat'} (%)</label>
                    <input type="number" name="bodyFat" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'الكتلة العضلية' : 'Muscle Mass'} (kg)</label>
                    <input type="number" name="muscleMass" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">BMR (kcal)</label>
                    <input type="number" name="bmr" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-slate-800 mb-3 bg-slate-50 p-2 rounded-lg">{isAr ? 'المقاسات المحيطية (سم)' : 'Circumferences (cm)'}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'الصدر' : 'Chest'}</label>
                    <input type="number" name="chest" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'الخصر' : 'Waist'}</label>
                    <input type="number" name="waist" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'الحوض' : 'Hips'}</label>
                    <input type="number" name="hips" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'الذراعين' : 'Arms'}</label>
                    <input type="number" name="arms" step="0.1" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{isAr ? 'ملاحظات' : 'Notes'}</label>
                  <textarea name="notes" rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 resize-none"></textarea>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors text-sm">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={addMutation.isPending} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 text-sm">
                    {addMutation.isPending ? '...' : (isAr ? 'حفظ القياس' : 'Save Measurement')}
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
