import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Search, Loader, Download, QrCode, PackagePlus, Boxes, WifiOff } from 'lucide-react';
import Barcode from 'react-barcode';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { getAllProducts } from '../../../lib/bakalaDb';
import { useAutoTranslate } from '../../../hooks/useAutoTranslate';
import { useSelector } from 'react-redux';
import { hasBusinessType } from '../../../lib/businessTypes';

export default function ProductList() {
  const navigate = useNavigate();
  const tenant = useSelector((state) => state.auth.tenant);
  const isPharmacy = hasBusinessType(tenant, 'pharmacy');
  const catalogBase = isPharmacy ? '/app/dashboard/pharmacy' : '/app/dashboard/bakala';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewBarcodeProduct, setViewBarcodeProduct] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: '', costPrice: '', expiryDate: '', batchNumber: '' });
  const [stockSaving, setStockSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', nameAr: '', primaryBarcode: '', category: '', brand: '', 
    unit: 'PCS', costPrice: 0, retailPrice: 0, minimumStockAlertLevel: 10,
    stockQuantity: 0, expiryDate: '', batchNumber: '', isActive: true,
    genericName: '', sfdaRegisterNumber: '', dosageForm: '', strength: '', manufacturer: '',
    requiresPrescription: false, isControlled: false,
  });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [units, setUnits] = useState([]);
  const [translatingName, setTranslatingName] = useState(false);
  const translateTimerRef = useRef(null);
  const { translate } = useAutoTranslate();

  const handleNameChange = (lang, value) => {
    const patch = lang === 'en' ? { name: value } : { nameAr: value };
    setFormData(prev => ({ ...prev, ...patch }));

    if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
    if (!value.trim()) return;

    const otherKey = lang === 'en' ? 'nameAr' : 'name';
    if (formData[otherKey] && formData[otherKey] !== formData[lang === 'en' ? 'name' : 'nameAr']) return;

    translateTimerRef.current = setTimeout(() => {
      setTranslatingName(true);
      const fromLang = lang === 'en' ? 'en' : 'ar';
      const toLang = lang === 'en' ? 'ar' : 'en';
      const translated = translate(value, fromLang, toLang);
      if (translated) {
        setFormData(prev => ({ ...prev, [otherKey]: translated }));
      }
      setTranslatingName(false);
    }, 120);
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      if (!navigator.onLine) {
        const cached = await getAllProducts();
        setItems(cached);
        setIsOffline(true);
        return;
      }
      setIsOffline(false);
      const res = await api.get('/bakala-products');
      setItems(res.data);
    } catch (err) {
      // Fallback to cache if API fails
      try {
        const cached = await getAllProducts();
        setItems(cached);
      } catch {
        toast.error('Failed to load products');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    if (!navigator.onLine) return;
    try {
      const [catRes, brandRes, unitRes] = await Promise.all([
        api.get('/bakala-products/categories'),
        api.get('/bakala-products/brands'),
        api.get('/bakala-products/units')
      ]);
      setCategories(catRes.data);
      setBrands(brandRes.data);
      setUnits(unitRes.data);
    } catch (err) {
      console.error('Failed to load dropdowns');
    }
  };

  useEffect(() => {
    fetchItems();
    fetchDropdownData();
    
    const handleOnline = () => { setIsOffline(false); fetchItems(); };
    const handleOffline = () => { setIsOffline(true); fetchItems(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, expiryDate: formData.expiryDate ? formData.expiryDate : null };
      if (editingId) {
        await api.put(`/bakala-products/${editingId}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/bakala-products', payload);
        toast.success('Product created');
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name || '',
      nameAr: product.nameAr || '',
      primaryBarcode: product.primaryBarcode || '',
      category: product.category || '',
      brand: product.brand || '',
      unit: product.unit || 'PCS',
      costPrice: product.costPrice || 0,
      retailPrice: product.retailPrice || 0,
      minimumStockAlertLevel: product.minimumStockAlertLevel || 10,
      stockQuantity: product.stockQuantity || 0,
      expiryDate: product.expiryDate ? product.expiryDate.substring(0, 10) : '',
      batchNumber: product.batchNumber || '',
      isActive: product.isActive ?? true,
      genericName: product.genericName || '',
      sfdaRegisterNumber: product.sfdaRegisterNumber || '',
      dosageForm: product.dosageForm || '',
      strength: product.strength || '',
      manufacturer: product.manufacturer || '',
      requiresPrescription: !!product.requiresPrescription,
      isControlled: !!product.isControlled,
    });
    setEditingId(product._id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/bakala-products/${id}`);
      toast.success('Product deleted');
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete product');
    }
  };

  const openStockModal = (product) => {
    setStockForm({ quantity: '', costPrice: product.costPrice || '', expiryDate: '', batchNumber: '' });
    setStockProduct(product);
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!stockForm.quantity || Number(stockForm.quantity) <= 0) {
      return toast.error('Enter a quantity greater than zero');
    }
    setStockSaving(true);
    try {
      await api.post(`/bakala-products/${stockProduct._id}/add-stock`, {
        quantity: Number(stockForm.quantity),
        costPrice: stockForm.costPrice === '' ? undefined : Number(stockForm.costPrice),
        expiryDate: stockForm.expiryDate || undefined,
        batchNumber: stockForm.batchNumber || undefined,
      });
      toast.success('Stock added');
      setStockProduct(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add stock');
    } finally {
      setStockSaving(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.primaryBarcode?.includes(searchQuery)
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name or barcode..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          {!isPharmacy && (
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            onClick={async () => {
              const toastId = toast.loading('Importing from CSV on server... This may take up to a minute.');
              try {
                const res = await api.get('/bakala-products/trigger-import', { timeout: 120000 });
                toast.success(res.data.message, { id: toastId });
                fetchItems();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Import failed. If it timed out, check back in a minute to see if they imported in the background.', { id: toastId });
              }
            }}
          >
            <Download className="w-4 h-4" /> Import CSV
          </button>
          )}
          <button
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
            onClick={() => navigate(`${catalogBase}/add-product`)}
          >
            <PackagePlus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-medium">Barcode</th>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium text-right">Cost Price</th>
              <th className="px-6 py-3 font-medium text-right">Retail Price</th>
              <th className="px-6 py-3 font-medium text-center">In Stock</th>
              <th className="px-6 py-3 font-medium text-center">Unit</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                  <Loader className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  Loading...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-10 text-center text-gray-500">
                  No products found.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => (
                <tr key={item._id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-500 font-mono text-xs">{item.primaryBarcode}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    <p>{item.name}</p>
                    <p className="text-xs text-gray-500">{item.nameAr}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{item.category || '-'}</td>
                  <td className="px-6 py-3 text-right text-gray-500">SAR {item.costPrice?.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right font-medium text-gray-900">SAR {item.retailPrice?.toFixed(2)}</td>
                  <td className="px-6 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${(item.stockQuantity || 0) <= 0 ? 'bg-red-50 text-red-600' : (item.stockQuantity || 0) <= (item.minimumStockAlertLevel || 0) ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.stockQuantity ?? 0}</span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{item.unit || 'PCS'}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => openStockModal(item)} title="Add Stock" className="p-1 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded mr-2">
                      <Boxes className="w-4 h-4" />
                    </button>
                    <button onClick={() => setViewBarcodeProduct(item)} title="View Barcode" className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded mr-2">
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEdit(item)} className="p-1 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded mr-2">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item._id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit' : 'Add'} Product</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                  <input type="text" required value={formData.name} onChange={e => handleNameChange('en', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    Name (Arabic)
                    {translatingName && <span className="text-xs text-emerald-600 flex items-center gap-1"><Loader className="w-3 h-3 animate-spin" /> Translating...</span>}
                  </label>
                  <input type="text" value={formData.nameAr} onChange={e => handleNameChange('ar', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none text-right" dir="rtl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode *</label>
                  <input type="text" required value={formData.primaryBarcode} onChange={e => setFormData({...formData, primaryBarcode: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none">
                    <option value="PCS">PCS</option>
                    {units.map(u => <option key={u._id} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none">
                    <option value="">None</option>
                    {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <select value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none">
                    <option value="">None</option>
                    {brands.map(b => <option key={b._id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (SAR)</label>
                  <input type="number" step="0.01" min="0" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Retail Price (SAR) *</label>
                  <input type="number" step="0.01" min="0" required value={formData.retailPrice} onChange={e => setFormData({...formData, retailPrice: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                  <input type="number" step="1" value={formData.stockQuantity} onChange={e => setFormData({...formData, stockQuantity: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min. Stock Alert Level</label>
                  <input type="number" step="1" min="0" value={formData.minimumStockAlertLevel} onChange={e => setFormData({...formData, minimumStockAlertLevel: parseFloat(e.target.value) || 0})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                  <input type="text" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                </div>
                {isPharmacy && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Generic / scientific name</label>
                      <input type="text" value={formData.genericName || ''} onChange={e => setFormData({...formData, genericName: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SFDA register #</label>
                      <input type="text" value={formData.sfdaRegisterNumber || ''} onChange={e => setFormData({...formData, sfdaRegisterNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dosage form</label>
                      <select value={formData.dosageForm || ''} onChange={e => setFormData({...formData, dosageForm: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none">
                        <option value="">Select</option>
                        <option value="tablet">Tablet</option>
                        <option value="capsule">Capsule</option>
                        <option value="syrup">Syrup</option>
                        <option value="drops">Drops</option>
                        <option value="cream">Cream</option>
                        <option value="injection">Injection</option>
                        <option value="inhaler">Inhaler</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                      <input type="text" value={formData.strength || ''} onChange={e => setFormData({...formData, strength: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 outline-none" />
                    </div>
                    <div className="col-span-2 flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={!!formData.requiresPrescription} onChange={e => setFormData({...formData, requiresPrescription: e.target.checked})} />
                        Requires prescription
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={!!formData.isControlled} onChange={e => setFormData({...formData, isControlled: e.target.checked})} />
                        Controlled drug
                      </label>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {stockProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setStockProduct(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Add Stock</h3>
                <p className="text-xs text-gray-500">{stockProduct.name} · {stockProduct.primaryBarcode}</p>
              </div>
              <button onClick={() => setStockProduct(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAddStock} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 flex justify-between">
                <span>Current stock: <b>{stockProduct.stockQuantity ?? 0}</b></span>
                <span>Unit: <b>{stockProduct.unit || 'PCS'}</b></span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to add *</label>
                <input type="number" min="1" autoFocus required value={stockForm.quantity} onChange={e => setStockForm({...stockForm, quantity: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (SAR) — updates product cost</label>
                <input type="number" step="0.01" min="0" value={stockForm.costPrice} onChange={e => setStockForm({...stockForm, costPrice: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={stockForm.expiryDate} onChange={e => setStockForm({...stockForm, expiryDate: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                  <input type="text" value={stockForm.batchNumber} onChange={e => setStockForm({...stockForm, batchNumber: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setStockProduct(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={stockSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60">
                  {stockSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Barcode Modal */}
      {viewBarcodeProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewBarcodeProduct(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2 truncate">{viewBarcodeProduct.name}</h3>
            <p className="text-sm text-gray-500 mb-6">SAR {viewBarcodeProduct.retailPrice?.toFixed(2)}</p>
            <div className="flex justify-center bg-gray-50 p-6 rounded-xl border border-gray-100 mb-6">
              <Barcode 
                value={viewBarcodeProduct.primaryBarcode} 
                format="EAN13" 
                width={2} 
                height={80} 
                fontSize={16} 
                margin={0} 
                background="#F9FAFB" 
                valid={() => {}} // Ignore invalid lengths gracefully if needed
              />
            </div>
            <button 
              onClick={() => setViewBarcodeProduct(null)} 
              className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
