import React, { useState, useEffect } from 'react';
import { PackageMinus, Plus, Check, Save, ArrowLeft, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import ProductChooser, { loadInventoryProducts } from '../../components/inventory/ProductChooser';

const fontPage = { fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" };
const fontDisplay = { fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" };
const field = 'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10';

export default function PurchaseReturns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');

  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [lines, setLines] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [retRes, suppRes, products] = await Promise.all([
        api.get('/purchase-returns'),
        api.get('/contacts?types=supplier'),
        loadInventoryProducts(api),
      ]);
      setReturns(Array.isArray(retRes.data) ? retRes.data : []);
      setSuppliers(suppRes.data?.contacts || []);
      setAllProducts(products);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = (product) => {
    const existingLineIndex = lines.findIndex((l) => l.productId === product._id);
    if (existingLineIndex >= 0) {
      const newLines = [...lines];
      newLines[existingLineIndex].quantityReturned += 1;
      setLines(newLines);
      return;
    }
    setLines([{
      productId: product._id,
      productName: product.name,
      barcode: product.barcode,
      quantityReturned: 1,
      reason: 'expired',
    }, ...lines]);
  };

  const handleSaveReturn = async () => {
    if (!selectedSupplier) return toast.error('Please select a supplier');
    if (lines.length === 0) return toast.error('Please add at least one product to return');

    try {
      await api.post('/purchase-returns', {
        supplierId: selectedSupplier,
        referenceNumber,
        lines
      });
      toast.success('Return saved and stock deducted');
      setView('list');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save purchase return');
    }
  };

  const updateLine = (index, fieldName, value) => {
    const newLines = [...lines];
    newLines[index][fieldName] = value;
    setLines(newLines);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-600 border-t-transparent" />
      </div>
    );
  }

  if (view === 'new') {
    return (
      <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-16 pt-6 lg:-mx-6 lg:px-6" style={fontPage}>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-rose-300/16 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-5xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setView('list')} className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-rose-700">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-700/80">Inventory</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950" style={fontDisplay}>Return goods to supplier</h2>
              </div>
            </div>
            <button type="button" onClick={handleSaveReturn} className="inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(190,18,60,0.75)] hover:bg-rose-800">
              <Save className="h-4 w-4" /> Finalize return & deduct stock
            </button>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-500">
              Supplier *
              <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className={`${field} mt-1.5`}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.entityId || s._id} value={s.entityId || s._id}>{s.displayName || s.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Reference / invoice #
              <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className={`${field} mt-1.5`} placeholder="Optional" />
            </label>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)]">
            <div className="border-b border-slate-100 bg-slate-50/70 p-6">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Choose product</p>
              <ProductChooser
                products={allProducts}
                onPick={addProduct}
                accent="rose"
                placeholder="Search by name, SKU, or scan barcode…"
              />
              <p className="mt-2 text-xs text-slate-400">Click the field to browse, or type a name. Barcode scans still work.</p>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="min-w-[150px] px-6 py-3.5">Product</th>
                  <th className="min-w-[150px] px-6 py-3.5 w-32">Qty returned</th>
                  <th className="min-w-[150px] px-6 py-3.5 w-48">Reason</th>
                  <th className="min-w-[150px] px-6 py-3.5 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-rose-50/30">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{line.productName}</p>
                      <p className="text-xs text-slate-400">{line.barcode || 'No barcode'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <input type="number" min="1" value={line.quantityReturned} onChange={(e) => updateLine(index, 'quantityReturned', Number(e.target.value))} className={`${field} text-center font-semibold text-rose-700`} />
                    </td>
                    <td className="px-6 py-4">
                      <select value={line.reason} onChange={(e) => updateLine(index, 'reason', e.target.value)} className={field}>
                        <option value="expired">Expired</option>
                        <option value="damaged">Damaged</option>
                        <option value="wrong_item">Wrong item</option>
                        <option value="other">Other</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))} className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                        <PackageMinus className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No items added yet</p>
                      <p className="mt-1 text-xs text-slate-400">Choose a product by name or SKU, or scan a barcode.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-16 pt-6 lg:-mx-6 lg:px-6" style={fontPage}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-rose-300/16 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-rose-700/80">Inventory</p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950" style={fontDisplay}>Purchase returns</h1>
            <p className="mt-2 max-w-xl text-[15px] text-slate-500">Return expired or damaged goods to suppliers and deduct stock.</p>
          </div>
          <button
            type="button"
            onClick={() => { setLines([]); setSelectedSupplier(''); setReferenceNumber(''); setView('new'); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(190,18,60,0.75)] hover:bg-rose-800"
          >
            <Plus className="h-4 w-4" /> New return
          </button>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="min-w-[150px] px-6 py-3.5">Return number</th>
                <th className="min-w-[150px] px-6 py-3.5">Date</th>
                <th className="min-w-[150px] px-6 py-3.5">Supplier</th>
                <th className="min-w-[150px] px-6 py-3.5">Ref #</th>
                <th className="min-w-[150px] px-6 py-3.5">Items</th>
                <th className="min-w-[150px] px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map(ret => (
                <tr key={ret._id} className="hover:bg-rose-50/30">
                  <td className="px-6 py-4 font-semibold text-slate-900">{ret.returnNumber}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(ret.dateReturned).toLocaleString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{ret.supplierId?.nameEn || ret.supplierId?.nameAr}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{ret.referenceNumber || '—'}</td>
                  <td className="px-6 py-4 text-slate-500">{ret.lines?.length || 0} lines</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">
                      <Check className="h-3.5 w-3.5" /> Completed
                    </span>
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                      <PackageMinus className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No returns yet</p>
                    <p className="mt-1 text-xs text-slate-400">Create a return to deduct stock from a supplier delivery.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
