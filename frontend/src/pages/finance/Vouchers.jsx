import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';
import { Plus, Search, Filter, Receipt, FileText, ArrowUpRight, ArrowDownRight, Edit, Trash2, Calendar } from 'lucide-react';
import Money from '../../components/ui/Money';
import toast from 'react-hot-toast';

export default function Vouchers({ forcedType, embedded = false }) {
  const queryClient = useQueryClient();
  const { language } = useSelector((state) => state.ui);
  const { t } = useTranslation(language);

  const [activeTab, setActiveTab] = useState(forcedType || 'receive'); // 'receive' or 'payment'
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const voucherType = forcedType || activeTab;

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['vouchers', voucherType],
    queryFn: () => api.get('/vouchers', { params: { type: voucherType } }).then(res => res.data)
  });

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => 
      (v.voucherNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.partyName && v.partyName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [vouchers, searchTerm]);

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/vouchers/${id}`),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحذف' : 'Deleted successfully');
      queryClient.invalidateQueries(['vouchers']);
    }
  });

  return (
    <div className="space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {!embedded && (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'السندات' : 'Vouchers'}
          </h1>
          <p className="text-sm text-gray-500">
            {language === 'ar' ? 'إدارة سندات القبض والصرف' : 'Manage receive and payment vouchers'}
          </p>
        </div>
        <button
          onClick={() => { setEditingVoucher(null); setShowForm(true); }}
          className="btn btn-primary gap-2"
        >
          <Plus className="w-4 h-4" />
          {language === 'ar' ? 'سند جديد' : 'New Voucher'}
        </button>
      </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl border border-gray-100 dark:border-dark-700">
        {!forcedType ? (
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-700 p-1 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('receive')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'receive' ? 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm' : 'text-gray-500'}`}
          >
            <ArrowDownRight className="w-4 h-4 inline-block mr-1 rtl:ml-1" />
            {language === 'ar' ? 'سندات القبض' : 'Receive Vouchers'}
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'payment' ? 'bg-white dark:bg-dark-800 text-red-600 shadow-sm' : 'text-gray-500'}`}
          >
            <ArrowUpRight className="w-4 h-4 inline-block mr-1 rtl:ml-1" />
            {language === 'ar' ? 'سندات الصرف' : 'Payment Vouchers'}
          </button>
        </div>
        ) : (
          <button
            onClick={() => { setEditingVoucher(null); setShowForm(true); }}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-4 h-4" />
            {language === 'ar' ? 'سند جديد' : 'New Voucher'}
          </button>
        )}
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-dark-700/50 border-b border-gray-100 dark:border-dark-700">
              <tr>
                <th className="px-6 py-4">{language === 'ar' ? 'رقم السند' : 'Number'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'الطرف' : 'Party'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th className="px-6 py-4">{language === 'ar' ? 'البيان' : 'Description'}</th>
                <th className="px-6 py-4 text-center">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    {language === 'ar' ? 'لا يوجد بيانات' : 'No data found'}
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((voucher) => (
                  <tr key={voucher._id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {voucher.voucherNumber}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(voucher.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {voucher.partyName || '-'}
                    </td>
                    <td className="px-6 py-4 font-medium">
                      <Money value={voucher.amount} />
                    </td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                      {voucher.description || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setEditingVoucher(voucher); setShowForm(true); }}
                          className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?')) {
                              deleteMutation.mutate(voucher._id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <VoucherFormModal
            voucher={editingVoucher}
            defaultType={voucherType}
            onClose={() => { setShowForm(false); setEditingVoucher(null); }}
            language={language}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function VoucherFormModal({ voucher, defaultType, onClose, language }) {
  const queryClient = useQueryClient();
  const isEditing = !!voucher;
  const [formData, setFormData] = useState({
    type: voucher?.type || defaultType,
    date: voucher?.date ? new Date(voucher.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    amount: voucher?.amount || '',
    partyType: voucher?.partyType || 'customer',
    partyName: voucher?.partyName || '',
    paymentMethod: voucher?.paymentMethod || 'cash',
    reference: voucher?.reference || '',
    description: voucher?.description || ''
  });

  const mutation = useMutation({
    mutationFn: (data) => isEditing ? api.put(`/vouchers/${voucher._id}`, data) : api.post('/vouchers', data),
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved successfully');
      queryClient.invalidateQueries(['vouchers']);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error saving')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-dark-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditing ? (language === 'ar' ? 'تعديل سند' : 'Edit Voucher') : (language === 'ar' ? 'سند جديد' : 'New Voucher')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'النوع' : 'Type'}
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="select"
                disabled={isEditing}
              >
                <option value="receive">{language === 'ar' ? 'قبض' : 'Receive'}</option>
                <option value="payment">{language === 'ar' ? 'صرف' : 'Payment'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'التاريخ' : 'Date'}
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'المبلغ' : 'Amount'}
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="select"
              >
                <option value="cash">{language === 'ar' ? 'نقدي' : 'Cash'}</option>
                <option value="bank_transfer">{language === 'ar' ? 'حوالة بنكية' : 'Bank Transfer'}</option>
                <option value="card">{language === 'ar' ? 'بطاقة' : 'Card'}</option>
                <option value="cheque">{language === 'ar' ? 'شيك' : 'Cheque'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'نوع الطرف' : 'Party Type'}
              </label>
              <select
                value={formData.partyType}
                onChange={(e) => setFormData({ ...formData, partyType: e.target.value })}
                className="select"
              >
                <option value="customer">{language === 'ar' ? 'عميل' : 'Customer'}</option>
                <option value="supplier">{language === 'ar' ? 'مورد' : 'Supplier'}</option>
                <option value="employee">{language === 'ar' ? 'موظف' : 'Employee'}</option>
                <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'اسم الطرف' : 'Party Name'}
              </label>
              <input
                type="text"
                required
                value={formData.partyName}
                onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                className="input"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {language === 'ar' ? 'البيان' : 'Description'}
            </label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700 mt-6">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn btn-primary">
              {mutation.isPending ? '...' : (language === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
