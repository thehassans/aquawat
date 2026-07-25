import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Image as ImageIcon, Loader2, Target, CheckCircle2, Trash2 } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const BUSINESS_TYPES = ['trading', 'construction', 'travel_agency', 'restaurant', 'car_rental', 'laundry', 'saloon', 'khayyat', 'boutique', 'manpower', 'bakala', 'car_workshop', 'bookstore', 'ecommerce', 'furniture_shop'];

const LeadSetup = () => {
  const { t } = useTranslation();
  const { language } = useSelector((state) => state.ui);
  const isRTL = language === 'ar';

  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedType, setSelectedType] = useState(BUSINESS_TYPES[0]);
  const [message, setMessage] = useState('');
  const [bannerImage, setBannerImage] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');

  useEffect(() => {
    fetchSetups();
  }, []);

  const fetchSetups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lead-setup');
      setSetups(res.data);
      if (res.data.length > 0) {
        const defaultSetup = res.data.find(s => s.businessType === selectedType);
        if (defaultSetup) {
          setMessage(defaultSetup.message);
          setBannerPreview(defaultSetup.bannerImage);
        } else {
          setMessage('');
          setBannerPreview('');
        }
      }
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في جلب الإعدادات' : 'Failed to fetch setups');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
    const existing = setups.find(s => s.businessType === type);
    if (existing) {
      setMessage(existing.message);
      setBannerPreview(existing.bannerImage);
    } else {
      setMessage('');
      setBannerPreview('');
    }
    setBannerImage(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBannerImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(language === 'ar' ? 'الرسالة مطلوبة' : 'Message is required');
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('businessType', selectedType);
      formData.append('message', message);
      if (bannerImage) {
        formData.append('bannerImage', bannerImage);
      }

      await api.post('/lead-setup', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully');
      fetchSetups();
      setBannerImage(null);
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-6 max-w-5xl mx-auto space-y-8 ${isRTL ? 'text-right rtl' : 'text-left ltr'}`}>
      
      {/* Header Panel */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-purple-500/10 border border-purple-100 p-8"
      >
        <div className="absolute top-0 right-0 -mt-16 -mr-16 w-64 h-64 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-16 w-48 h-48 bg-gradient-to-tr from-fuchsia-400 to-pink-500 rounded-full blur-3xl opacity-20" />
        
        <div className="relative flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Target className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-700">
              {language === 'ar' ? 'إعدادات استخراج العملاء' : 'Lead Setup'}
            </h1>
            <p className="text-gray-500 mt-2 text-lg">
              {language === 'ar' ? 'تكوين رسائل واتساب وصور البانر لكل نشاط تجاري' : 'Configure WhatsApp messages and banner images for each business type'}
            </p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-semibold text-lg text-gray-800 mb-4">
                {language === 'ar' ? 'اختر النشاط التجاري' : 'Select Business Type'}
              </h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {BUSINESS_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${
                      selectedType === type
                        ? 'bg-purple-50 border-purple-200 shadow-sm'
                        : 'hover:bg-gray-50 border-transparent'
                    } border`}
                  >
                    <span className={`font-medium ${selectedType === type ? 'text-purple-700' : 'text-gray-600'}`}>
                      {t(`businessTypes.${type}`, type.replace('_', ' ').toUpperCase())}
                    </span>
                    {setups.some(s => s.businessType === type) && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              key={selectedType}
              onSubmit={handleSave} 
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-8"
            >
              <div className="border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  {t(`businessTypes.${selectedType}`, selectedType.replace('_', ' ').toUpperCase())} Setup
                </h2>
              </div>

              {/* Message Input */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  {language === 'ar' ? 'رسالة واتساب الترويجية' : 'WhatsApp Promotional Message'}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : 'Type your message here...'}
                  className="w-full h-40 p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none resize-none"
                  required
                />
                <p className="text-sm text-gray-500">
                  {language === 'ar' 
                    ? 'هذه هي الرسالة النصية التي سيتم تعبئتها مسبقاً عند النقر على واتساب في صفحة استخراج العملاء.' 
                    : 'This is the text message that will be pre-filled when clicking WhatsApp on the Leads Generation page.'}
                </p>
              </div>

              {/* Banner Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  {language === 'ar' ? 'صورة البانر' : 'Banner Image'}
                </label>
                
                <div className="mt-2 flex justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 hover:bg-gray-50 transition-colors relative overflow-hidden group">
                  {bannerPreview ? (
                    <div className="relative w-full">
                      <img src={bannerPreview.startsWith('http') || bannerPreview.startsWith('data:') ? bannerPreview : api.defaults.baseURL.replace('/api', '') + bannerPreview} alt="Banner" className="mx-auto max-h-64 rounded-lg object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-gray-100 transition-colors">
                          {language === 'ar' ? 'تغيير الصورة' : 'Change Image'}
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
                      <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md bg-white font-semibold text-purple-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-600 focus-within:ring-offset-2 hover:text-purple-500"
                        >
                          <span>{language === 'ar' ? 'رفع ملف' : 'Upload a file'}</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                        </label>
                        <p className="pl-1">{language === 'ar' ? 'أو سحب وإفلات' : 'or drag and drop'}</p>
                      </div>
                      <p className="text-xs leading-5 text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {language === 'ar'
                    ? 'سيتم إرفاق رابط الصورة هذه أسفل رسالة الواتساب ليتم عرضها كمعاينة للصورة.'
                    : 'The link to this image will be appended to the WhatsApp message to generate a preview thumbnail.'}
                </p>
              </div>

              {/* Actions */}
              <div className="pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 transition-all active:scale-95 disabled:opacity-70"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {language === 'ar' ? 'حفظ الإعدادات' : 'Save Setup'}
                </button>
              </div>

            </motion.form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadSetup;
