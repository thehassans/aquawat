import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import { contactToSupplier, fetchContactsList } from '../../lib/contactMappers';
const t = (key, opts) => opts?.defaultValue || key;

import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { Modal } from './components/ui/Modal';
import { ConfirmModal } from './components/ui/ConfirmModal';
import DemoBlockedModal from './components/ui/DemoBlockedModal';
import { Input } from './components/ui/Input';
import { Table, Thead, Tbody, Tr, Th, Td } from './components/ui/Table';
import SARIcon from './components/ui/SARIcon';
import { Layers, Plus, Minus, Edit, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const FabricRollar = () => {
  
  const { user } = useSelector(state => state.auth);
  const { language } = useSelector(state => state.ui);
  const [searchParams] = useSearchParams();

  const isDemo = !!user?.isDemoSession;
  const [demoBlockedOpen, setDemoBlockedOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [fabrics, setFabrics] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const tutorialCreateOpenedRef = useRef(false);

  const [createForm, setCreateForm] = useState({ name: '', madeIn: '', pricePerRoll: '', rollsInStock: '', stockMeters: '', supplierId: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '', madeIn: '', pricePerRoll: '', rollsInStock: '', stockMeters: '', supplierId: '' });
  const [stockForm, setStockForm] = useState({ id: null, name: '', delta: '' });

  const [deleteModal, setDeleteModal] = useState({ open: false, fabric: null, loading: false });

  const computed = useMemo(() => {
    const list = Array.isArray(fabrics) ? fabrics : [];
    const totalRolls = list.reduce((sum, x) => sum + (Number(x.rollsInStock) || 0), 0);
    const totalValue = list.reduce((sum, x) => sum + ((Number(x.rollsInStock) || 0) * (Number(x.pricePerRoll) || 0)), 0);
    return { totalRolls, totalValue };
  }, [fabrics]);

  const fetchFabrics = async () => {
    try {
      setLoading(true);
      const [res, supRes] = await Promise.all([
        api.get('/khayyat/fabrics'),
        fetchContactsList(api, { types: 'supplier', limit: 500, isActive: 'all' }),
      ]);
      setFabrics(Array.isArray(res.data?.fabrics) ? res.data.fabrics : []);
      const suppliers = (supRes.contacts || [])
        .filter((c) => c.entityType === 'supplier')
        .map(contactToSupplier);
      setSuppliers(suppliers);
    } catch (e) {
      setFabrics([]);
      setSuppliers([]);
      toast.error((language === 'ar' ? 'حدث خطأ' : 'Error'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFabrics();
  }, []);

  const openCreate = () => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    setCreateForm({ name: '', madeIn: '', pricePerRoll: '', rollsInStock: '', stockMeters: '', supplierId: '' });
    setCreateOpen(true);
  };

  useEffect(() => {
    const shouldOpen = (searchParams.get('create') || '') === '1';
    if (!shouldOpen) return;
    if (tutorialCreateOpenedRef.current) return;
    if (createOpen) return;
    tutorialCreateOpenedRef.current = true;
    openCreate();
  }, [createOpen, openCreate, searchParams]);

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm({ name: '', madeIn: '', pricePerRoll: '', rollsInStock: '', stockMeters: '', supplierId: '' });
  };

  const submitCreate = async () => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }

    const name = String(createForm.name || '').trim();
    const madeIn = String(createForm.madeIn || '').trim();
    const pricePerRoll = Number(createForm.pricePerRoll);
    const rollsInStock = Number(createForm.rollsInStock);
    const stockMeters = Number(createForm.stockMeters);

    if (!name) {
      toast.error((language === 'ar' ? 'مطلوب' : 'Required'));
      return;
    }

    try {
      await api.post('/khayyat/fabrics', {
        name,
        madeIn,
        pricePerRoll: Number.isFinite(pricePerRoll) && pricePerRoll >= 0 ? pricePerRoll : 0,
        rollsInStock: Number.isFinite(rollsInStock) && rollsInStock >= 0 ? rollsInStock : 0,
        stockMeters: Number.isFinite(stockMeters) && stockMeters >= 0 ? stockMeters : 0,
        supplierId: createForm.supplierId || null
      });
      toast.success((language === 'ar' ? 'تمّت العملية بنجاح' : 'Success'));
      closeCreate();
      fetchFabrics();
    } catch (e) {
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error'));
    }
  };

  const [seeding, setSeeding] = useState(false);
  const handleSeedFabrics = async () => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    setSeeding(true);
    try {
      const res = await api.post('/khayyat/fabrics/seed');
      toast.success(res.data.message || (language === 'ar' ? 'تمت الإضافة بنجاح' : 'Fabrics added successfully'));
      fetchFabrics();
    } catch (e) {
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error'));
    }
    setSeeding(false);
  };

  const openEdit = (f) => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    setEditForm({
      id: f?._id,
      name: f?.name || '',
      madeIn: f?.madeIn || '',
      pricePerRoll: String(f?.pricePerRoll ?? ''),
      rollsInStock: String(f?.rollsInStock ?? ''),
      stockMeters: String(f?.stockMeters ?? ''),
      supplierId: f?.supplierId?._id || f?.supplierId || ''
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditForm({ id: null, name: '', madeIn: '', pricePerRoll: '', rollsInStock: '', stockMeters: '', supplierId: '' });
  };

  const submitEdit = async () => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    const id = editForm.id;
    if (!id) return;

    const name = String(editForm.name || '').trim();
    const madeIn = String(editForm.madeIn || '').trim();
    const pricePerRoll = Number(editForm.pricePerRoll);
    const rollsInStock = Number(editForm.rollsInStock);
    const stockMeters = Number(editForm.stockMeters);

    if (!name) {
      toast.error((language === 'ar' ? 'مطلوب' : 'Required'));
      return;
    }

    try {
      await api.put(`/khayyat/fabrics/${id}`, {
        name,
        madeIn,
        pricePerRoll: Number.isFinite(pricePerRoll) && pricePerRoll >= 0 ? pricePerRoll : 0,
        rollsInStock: Number.isFinite(rollsInStock) && rollsInStock >= 0 ? rollsInStock : 0,
        stockMeters: Number.isFinite(stockMeters) && stockMeters >= 0 ? stockMeters : 0,
        supplierId: editForm.supplierId || null
      });
      toast.success((language === 'ar' ? 'تمّت العملية بنجاح' : 'Success'));
      closeEdit();
      fetchFabrics();
    } catch (e) {
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error'));
    }
  };

  const openStock = (f) => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    setStockForm({ id: f?._id, name: f?.name || '', delta: '' });
    setStockOpen(true);
  };

  const closeStock = () => {
    setStockOpen(false);
    setStockForm({ id: null, name: '', delta: '' });
  };

  const submitStock = async () => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    const id = stockForm.id;
    if (!id) return;

    const delta = Number(stockForm.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error((language === 'ar' ? 'المبلغ غير صحيح' : 'Invalid amount'));
      return;
    }

    try {
      await api.post(`/khayyat/fabrics/${id}/stock`, { delta });
      toast.success((language === 'ar' ? 'تمّت العملية بنجاح' : 'Success'));
      closeStock();
      fetchFabrics();
    } catch (e) {
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error'));
    }
  };

  const requestDelete = (fabric) => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      return;
    }
    setDeleteModal({ open: true, fabric, loading: false });
  };

  const closeDelete = () => {
    setDeleteModal({ open: false, fabric: null, loading: false });
  };

  const confirmDelete = async () => {
    if (isDemo) {
      setDemoBlockedOpen(true);
      closeDelete();
      return;
    }

    const id = deleteModal?.fabric?._id;
    if (!id) {
      closeDelete();
      return;
    }

    setDeleteModal((p) => ({ ...p, loading: true }));
    try {
      await api.delete(`/khayyat/fabrics/${id}`);
      toast.success((language === 'ar' ? 'تمّت العملية بنجاح' : 'Success'));
      closeDelete();
      fetchFabrics();
    } catch (e) {
      toast.error(e?.response?.data?.error || (language === 'ar' ? 'حدث خطأ' : 'Error'));
      setDeleteModal((p) => ({ ...p, loading: false }));
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D5B25B] to-amber-700 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{(language === 'ar' ? 'رولات القماش' : 'Fabric Rollar')}</h1>
            <div className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'أنشئ الأقمشة وادِر سعر الرول وبلد الصنع والمخزون.' : 'Create fabrics, manage price per roll, made in, and stock.')}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleSeedFabrics} 
            disabled={seeding || isDemo} 
            variant="outline" 
            icon={seeding ? null : Download} 
            className="rounded-2xl px-5 py-3"
          >
            {seeding ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              language === 'ar' ? 'استيراد الأقمشة الشائعة' : 'Seed Popular Fabrics'
            )}
          </Button>
          <Button data-tutorial="fabrics-create-button" onClick={openCreate} icon={Plus} className="rounded-2xl px-5 py-3">
            {(language === 'ar' ? 'إضافة قماش' : 'Add Fabric')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'إجمالي الرولات في المخزون' : 'Total Rolls In Stock')}</div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-slate-100">{computed.totalRolls}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'قيمة المخزون' : 'Inventory Value')}</div>
          <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            {computed.totalValue.toFixed(2)} <SARIcon className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="font-semibold text-gray-900 dark:text-slate-100">{(language === 'ar' ? 'الأقمشة' : 'Fabrics')}</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        ) : fabrics.length > 0 ? (
          <Table>
            <Thead>
              <Tr>
                <Th>{(language === 'ar' ? 'الاسم' : 'Name')}</Th>
                <Th>{(language === 'ar' ? 'المورد' : 'Supplier')}</Th>
                <Th>{(language === 'ar' ? 'سعر / رول' : 'Price / Roll')}</Th>
                <Th>{(language === 'ar' ? 'المخزون' : 'Stock')}</Th>
                <Th>{(language === 'ar' ? 'القيمة' : 'Value')}</Th>
                <Th>{(language === 'ar' ? 'إجراءات' : 'Actions')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {fabrics.map((f) => {
                const price = Number(f.pricePerRoll) || 0;
                const stock = Number(f.rollsInStock) || 0;
                const value = price * stock;
                return (
                  <Tr key={f._id}>
                    <Td className="font-medium">
                      <div>{f.name}</div>
                      <div className="text-xs text-gray-500">{f.madeIn || '-'}</div>
                    </Td>
                    <Td className="text-gray-700 dark:text-slate-200">
                      {f.supplierId ? (f.supplierId.nameEn || f.supplierId.nameAr) : '-'}
                    </Td>
                    <Td className="text-gray-700 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1">{price.toFixed(2)} <SARIcon className="w-3 h-3" /></span>
                    </Td>
                    <Td className="text-gray-700 dark:text-slate-200">
                      <div>{stock} Rolls</div>
                      {f.stockMeters ? <div className="text-xs text-gray-500">{f.stockMeters} Meters</div> : null}
                    </Td>
                    <Td className="font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="inline-flex items-center gap-1">{value.toFixed(2)} <SARIcon className="w-3 h-3" /></span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => openStock(f)}
                          className="rounded-xl px-4 py-2"
                          disabled={isDemo}
                          icon={Layers}
                        >
                          {(language === 'ar' ? 'المخزون' : 'Stock')}
                        </Button>
                        <button
                          type="button"
                          onClick={() => openEdit(f)}
                          disabled={isDemo}
                          className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800/50 text-gray-600 dark:text-slate-300"
                          title={(language === 'ar' ? 'تعديل' : 'Edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(f)}
                          disabled={isDemo}
                          className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                          title={(language === 'ar' ? 'حذف' : 'Delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        ) : (
          <div className="p-12 text-center text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'لا توجد بيانات' : 'No data available')}</div>
        )}
      </Card>

      <Modal isOpen={createOpen} onClose={closeCreate} title={(language === 'ar' ? 'إضافة قماش' : 'Add Fabric')} size="lg">
        <div data-tutorial="fabrics-create-modal" className="space-y-4">
          <Input label={(language === 'ar' ? 'الاسم' : 'Name')} value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">{(language === 'ar' ? 'المورد' : 'Supplier')}</label>
            <select
              value={createForm.supplierId}
              onChange={(e) => setCreateForm((p) => ({ ...p, supplierId: e.target.value }))}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100"
            >
              <option value="">{(language === 'ar' ? 'اختر المورد...' : 'Select Supplier...')}</option>
              {suppliers.map(s => (
                <option key={s._id} value={s._id}>{s.nameEn || s.nameAr || s.name}</option>
              ))}
            </select>
          </div>
          <Input label={(language === 'ar' ? 'بلد الصنع' : 'Made In')} value={createForm.madeIn} onChange={(e) => setCreateForm((p) => ({ ...p, madeIn: e.target.value }))} />
          <Input label={(language === 'ar' ? 'سعر / رول' : 'Price / Roll')} type="number" min="0" step="0.01" value={createForm.pricePerRoll} onChange={(e) => setCreateForm((p) => ({ ...p, pricePerRoll: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={(language === 'ar' ? 'عدد الرولات' : 'Rolls in Stock')} type="number" min="0" step="1" value={createForm.rollsInStock} onChange={(e) => setCreateForm((p) => ({ ...p, rollsInStock: e.target.value }))} />
            <Input label={(language === 'ar' ? 'الامتار' : 'Stock Meters')} type="number" min="0" step="1" value={createForm.stockMeters} onChange={(e) => setCreateForm((p) => ({ ...p, stockMeters: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={submitCreate} className="flex-1 rounded-2xl" disabled={isDemo}>{(language === 'ar' ? 'حفظ' : 'Save')}</Button>
            <Button variant="secondary" onClick={closeCreate} className="flex-1 rounded-2xl">{(language === 'ar' ? 'إلغاء' : 'Cancel')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editOpen} onClose={closeEdit} title={(language === 'ar' ? 'تعديل القماش' : 'Edit Fabric')} size="lg">
        <div className="space-y-4">
          <Input label={(language === 'ar' ? 'الاسم' : 'Name')} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">{(language === 'ar' ? 'المورد' : 'Supplier')}</label>
            <select
              value={editForm.supplierId}
              onChange={(e) => setEditForm((p) => ({ ...p, supplierId: e.target.value }))}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100"
            >
              <option value="">{(language === 'ar' ? 'اختر المورد...' : 'Select Supplier...')}</option>
              {suppliers.map(s => (
                <option key={s._id} value={s._id}>{s.nameEn || s.nameAr || s.name}</option>
              ))}
            </select>
          </div>
          <Input label={(language === 'ar' ? 'بلد الصنع' : 'Made In')} value={editForm.madeIn} onChange={(e) => setEditForm((p) => ({ ...p, madeIn: e.target.value }))} />
          <Input label={(language === 'ar' ? 'سعر / رول' : 'Price / Roll')} type="number" min="0" step="0.01" value={editForm.pricePerRoll} onChange={(e) => setEditForm((p) => ({ ...p, pricePerRoll: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={(language === 'ar' ? 'عدد الرولات' : 'Rolls in Stock')} type="number" min="0" step="1" value={editForm.rollsInStock} onChange={(e) => setEditForm((p) => ({ ...p, rollsInStock: e.target.value }))} />
            <Input label={(language === 'ar' ? 'الامتار' : 'Stock Meters')} type="number" min="0" step="1" value={editForm.stockMeters} onChange={(e) => setEditForm((p) => ({ ...p, stockMeters: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={submitEdit} className="flex-1 rounded-2xl" disabled={isDemo}>{(language === 'ar' ? 'حفظ' : 'Save')}</Button>
            <Button variant="secondary" onClick={closeEdit} className="flex-1 rounded-2xl">{(language === 'ar' ? 'إلغاء' : 'Cancel')}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={stockOpen} onClose={closeStock} title={(language === 'ar' ? 'تعديل المخزون' : 'Adjust Stock')} size="lg">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-4">
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{stockForm.name || ''}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">{(language === 'ar' ? 'اكتب رقمًا موجبًا لإضافة رولات أو رقمًا سالبًا للخصم.' : 'Use a positive number to add rolls, or negative to subtract.')}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Input
                label={(language === 'ar' ? 'التغيير (± رولات)' : 'Delta (± rolls)')}
                type="number"
                step="1"
                value={stockForm.delta}
                onChange={(e) => setStockForm((p) => ({ ...p, delta: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-1 flex items-end gap-2">
              <button
                type="button"
                onClick={() => setStockForm((p) => ({ ...p, delta: String((Number(p.delta) || 0) + 1) }))}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:bg-gray-50 dark:hover:bg-slate-900/60 text-gray-700 dark:text-slate-200"
              >
                <Plus className="w-4 h-4" />
                {(language === 'ar' ? '+1' : '+1')}
              </button>
              <button
                type="button"
                onClick={() => setStockForm((p) => ({ ...p, delta: String((Number(p.delta) || 0) - 1) }))}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:bg-gray-50 dark:hover:bg-slate-900/60 text-gray-700 dark:text-slate-200"
              >
                <Minus className="w-4 h-4" />
                {(language === 'ar' ? '-1' : '-1')}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={submitStock} className="flex-1 rounded-2xl" disabled={isDemo}>{(language === 'ar' ? 'حفظ' : 'Save')}</Button>
            <Button variant="secondary" onClick={closeStock} className="flex-1 rounded-2xl">{(language === 'ar' ? 'إلغاء' : 'Cancel')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.open}
        onClose={closeDelete}
        title={(language === 'ar' ? 'حذف' : 'Delete')}
        message={(language === 'ar' ? 'حذف هذا القماش؟' : 'Delete this fabric?')}
        subtitle={(language === 'ar' ? 'لا يمكن التراجع عن هذا الإجراء. إذا كان القماش مستخدمًا في طلبات فسيتم منع الحذف.' : 'This action cannot be undone. If this fabric is used by orders, deletion will be blocked.')}
        confirmText={(language === 'ar' ? 'حذف' : 'Delete')}
        cancelText={(language === 'ar' ? 'إلغاء' : 'Cancel')}
        confirmVariant="danger"
        loading={deleteModal.loading}
        onConfirm={confirmDelete}
        previewTitle={deleteModal?.fabric?.name || ''}
        previewSubtitle={deleteModal?.fabric ? (
          <span className="inline-flex items-center gap-1">
            {Number(deleteModal.fabric.rollsInStock || 0)} {(language === 'ar' ? 'رولات' : 'rolls')} · {Number(deleteModal.fabric.pricePerRoll || 0).toFixed(2)} <SARIcon className="w-3 h-3" /> {(language === 'ar' ? '/ رول' : '/ roll')}
          </span>
        ) : ''}
      />

      <DemoBlockedModal
        isOpen={demoBlockedOpen}
        onClose={() => setDemoBlockedOpen(false)}
        title={(language === 'ar' ? 'وضع العرض' : 'Demo Mode')}
        phone="+966596775485"
      />
    </div>
  );
};

export default FabricRollar;




