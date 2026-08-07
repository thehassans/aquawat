import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit3, Trash2, Image as ImageIcon, X, Upload, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { autoTranslateText } from '../../lib/builtInTranslator';
import { Card } from './components/ui/Card';
import { Modal } from './components/ui/Modal';

const CATEGORIES = [
  { id: 'collar', en: 'Collar', ar: 'الياقة (القلاب)' },
  { id: 'pocket', en: 'Pocket', ar: 'الجيب' },
  { id: 'bain', en: 'Bain (Placket)', ar: 'البين (الجبزور)' },
  { id: 'cuff', en: 'Cuff', ar: 'الكبك (الكم)' },
  { id: 'buttons', en: 'Buttons', ar: 'الأزرار' },
  { id: 'embroidery', en: 'Embroidery', ar: 'التطريز' },
  { id: 'fabricMaterial', en: 'Fabric Material', ar: 'نوع القماش' },
  { id: 'fabricColor', en: 'Fabric Color', ar: 'لون القماش' },
  { id: 'thawbType', en: 'Thawb Type', ar: 'نوع الثوب' },
];

const resolveImageUrl = (src) => {
  if (!src) return null;
  if (src.startsWith('http')) return src;
  const baseUrl = api?.defaults?.baseURL || '';
  if (baseUrl.startsWith('http')) {
    return `${new URL(baseUrl).origin}${src}`;
  }
  return src;
};

export default function KhayyatCustomizations() {
  const { language } = useSelector((state) => state.ui);
  const isRtl = language === 'ar';
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    extraPrice: 0,
    sortOrder: 0,
    isActive: true,
    hexColor: '#ffffff',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslateName = (source) => {
    if (source === 'en' && formData.nameEn && !formData.nameAr) {
      try {
        const translated = autoTranslateText(formData.nameEn, 'en', 'ar');
        if (translated) setFormData(prev => ({ ...prev, nameAr: translated }));
      } catch (err) { console.error('Translation failed:', err); }
    } else if (source === 'ar' && formData.nameAr && !formData.nameEn) {
      try {
        const translated = autoTranslateText(formData.nameAr, 'ar', 'en');
        if (translated) setFormData(prev => ({ ...prev, nameEn: translated }));
      } catch (err) { console.error('Translation failed:', err); }
    }
  };

  const { data: customizations, isLoading } = useQuery({
    queryKey: ['khayyat-customizations'],
    queryFn: () => api.get('/khayyat/customizations').then((res) => res.data.customizations),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const form = new FormData();
      form.append('category', activeCategory);
      form.append('nameEn', data.nameEn);
      form.append('nameAr', data.nameAr);
      form.append('extraPrice', data.extraPrice);
      form.append('sortOrder', data.sortOrder);
      form.append('isActive', data.isActive);
      
      if (activeCategory === 'fabricColor') {
        form.append('image', data.hexColor);
      } else if (imageFile) {
        form.append('image', imageFile);
      }
      
      if (removeImage) form.append('removeImage', 'true');

      if (editItem) {
        return api.put(`/khayyat/customizations/${editItem._id}`, form);
      } else {
        return api.post('/khayyat/customizations', form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['khayyat-customizations']);
      toast.success(isRtl ? 'تم الحفظ بنجاح' : 'Saved successfully');
      handleCloseModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || (isRtl ? 'حدث خطأ' : 'An error occurred'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/khayyat/customizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['khayyat-customizations']);
      toast.success(isRtl ? 'تم الحذف' : 'Deleted');
    },
  });

  const activeItems = useMemo(() => {
    return (customizations || [])
      .filter((c) => c.category === activeCategory)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [customizations, activeCategory]);

  const handleOpenModal = (item = null) => {
    setEditItem(item);
    if (item) {
      setFormData({
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        extraPrice: item.extraPrice || 0,
        sortOrder: item.sortOrder || 0,
        isActive: item.isActive,
        hexColor: item.category === 'fabricColor' ? (item.image || '#ffffff') : '#ffffff',
      });
      setImagePreview(item.category !== 'fabricColor' ? resolveImageUrl(item.image) : null);
    } else {
      setFormData({ nameEn: '', nameAr: '', extraPrice: 0, sortOrder: 0, isActive: true, hexColor: '#ffffff' });
      setImagePreview(null);
    }
    setImageFile(null);
    setRemoveImage(false);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditItem(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nameEn || !formData.nameAr) {
      toast.error(isRtl ? 'الاسم الانجليزي والعربي مطلوب' : 'English and Arabic names are required');
      return;
    }

    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isRtl ? 'تخصيص الخيارات' : 'Customizations'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isRtl
              ? 'إدارة خيارات التفصيل المتوفرة (ياقات، جيوب، أقمشة والمزيد)'
              : 'Manage tailoring options available (collars, pockets, fabrics, etc.)'}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Categories */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <Card className="p-2 sticky top-24">
            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 hide-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeCategory === cat.id
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700'
                  }`}
                >
                  {isRtl ? cat.ar : cat.en}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          <div className="flex justify-between items-center bg-white dark:bg-dark-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
            <h2 className="text-lg font-bold">
              {isRtl
                ? CATEGORIES.find((c) => c.id === activeCategory)?.ar
                : CATEGORIES.find((c) => c.id === activeCategory)?.en}
            </h2>
            <button onClick={() => handleOpenModal()} className="btn btn-primary btn-sm">
              <Plus className="w-4 h-4" />
              {isRtl ? 'إضافة جديد' : 'Add New'}
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white dark:bg-dark-800 rounded-2xl h-48 animate-pulse" />
              ))}
            </div>
          ) : activeItems.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-dark-800 rounded-3xl border border-dashed border-gray-200 dark:border-dark-700">
              <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{isRtl ? 'لا توجد خيارات بعد' : 'No options yet'}</p>
              <button onClick={() => handleOpenModal()} className="btn btn-secondary mt-4">
                {isRtl ? 'إضافة أول خيار' : 'Add First Option'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              <AnimatePresence mode="popLayout">
                {activeItems.map((item) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item._id}
                    className={`relative group bg-white dark:bg-dark-800 rounded-3xl border-2 transition-all cursor-pointer ${
                      item.isActive ? 'border-transparent hover:border-primary-100 dark:hover:border-primary-900/50 shadow-sm hover:shadow-md' : 'border-dashed border-gray-200 opacity-60'
                    }`}
                  >
                    {/* Actions Overlay */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }}
                        className="p-1.5 bg-white dark:bg-dark-700 rounded-lg shadow-sm text-gray-600 hover:text-primary-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const fd = new FormData();
                          fd.append('category', item.category);
                          fd.append('nameEn', item.nameEn);
                          fd.append('nameAr', item.nameAr);
                          fd.append('isActive', !item.isActive);
                          saveMutation.mutate({ id: item._id, data: fd });
                        }}
                        className="p-1.5 bg-white dark:bg-dark-700 rounded-lg shadow-sm text-gray-600 hover:text-orange-600"
                      >
                        {item.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(isRtl ? 'هل أنت متأكد؟' : 'Are you sure?')) {
                            deleteMutation.mutate(item._id);
                          }
                        }}
                        className="p-1.5 bg-white dark:bg-dark-700 rounded-lg shadow-sm text-gray-600 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4 flex flex-col items-center text-center h-full">
                      <div className="w-24 h-24 mb-4 rounded-2xl bg-gray-50 dark:bg-dark-900 flex items-center justify-center overflow-hidden">
                        {item.category === 'fabricColor' ? (
                          <div className="w-16 h-16 rounded-full border-4 border-white dark:border-dark-800 shadow-md" style={{ backgroundColor: item.image || '#ffffff' }} />
                        ) : item.category === 'thawbType' ? (
                          item.image ? (
                            <img src={resolveImageUrl(item.image)} alt={item.nameEn} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-gray-300" />
                          )
                        ) : item.image ? (
                          <img src={resolveImageUrl(item.image)} alt={item.nameEn} className="w-full h-full object-contain p-2" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">
                        {isRtl ? item.nameAr : item.nameEn}
                      </h3>
                      {item.extraPrice > 0 && (
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg mt-2">
                          +{item.extraPrice}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={handleCloseModal} title={editItem ? (isRtl ? 'تعديل خيار' : 'Edit Option') : (isRtl ? 'إضافة خيار جديد' : 'Add New Option')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="relative">
              {activeCategory === 'fabricColor' ? (
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-dark-800 shadow-lg cursor-pointer">
                  <input 
                    type="color" 
                    className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                    value={formData.hexColor}
                    onChange={(e) => setFormData({ ...formData, hexColor: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <div className={`rounded-3xl bg-gray-50 dark:bg-dark-800 border-2 border-dashed border-gray-300 dark:border-dark-600 flex flex-col items-center justify-center overflow-hidden ${activeCategory === 'thawbType' ? 'w-32 h-48' : 'w-32 h-32'}`}>
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-8 h-8 text-gray-300 mx-auto" />
                        <span className="text-xs text-gray-400 mt-1 block">SVG / PNG</span>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-3 -right-3 w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true); }}
                      className="absolute -top-3 -left-3 w-8 h-8 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-sm hover:bg-red-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">English Name *</label>
              <input
                type="text"
                required
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                onBlur={() => handleTranslateName('en')}
                disabled={isTranslating}
                className="input"
                placeholder="e.g. Classic Collar"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-right">
                {isRtl ? 'الاسم بالعربي *' : 'Arabic Name *'}
                {isTranslating && <span className="mx-2 text-xs text-gray-400">...</span>}
              </label>
              <input
                type="text"
                required
                dir="rtl"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                className="input"
                placeholder="مثال: ياقة كلاسيك"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{isRtl ? 'سعر إضافي' : 'Extra Price'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.extraPrice}
                onChange={(e) => setFormData({ ...formData, extraPrice: parseFloat(e.target.value) || 0 })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{isRtl ? 'الترتيب' : 'Sort Order'}</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="input"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-dark-800 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5 text-primary-600 rounded"
            />
            <span className="font-medium text-gray-900 dark:text-white">
              {isRtl ? 'نشط (متاح للاختيار)' : 'Active (Available for selection)'}
            </span>
          </label>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saveMutation.isPending} className="btn btn-primary">
              {saveMutation.isPending ? '...' : isRtl ? 'حفظ الخيار' : 'Save Option'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
