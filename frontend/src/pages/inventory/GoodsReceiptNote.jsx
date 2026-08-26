import React, { useState, useEffect } from 'react';
import { PackageOpen, Plus, Check, Save, ArrowLeft, Calendar, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { normalizeGrnList } from '../../lib/grnApi';
import toast from 'react-hot-toast';
import ProductChooser, { loadInventoryProducts } from '../../components/inventory/ProductChooser';
import { useSelector } from 'react-redux';
import { hasBusinessType } from '../../lib/businessTypes';

const fontPage = { fontFamily: "'Plus Jakarta Sans', 'DM Sans', 'Tajawal', sans-serif" };
const fontDisplay = { fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" };
const field = 'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10';

export default function GoodsReceiptNote() {
  const tenant = useSelector((state) => state.auth.tenant);
  const isPharmacy = hasBusinessType(tenant, 'pharmacy');
  const requireBatch = isPharmacy && tenant?.settings?.pharmacy?.requireBatchOnReceive !== false;
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');

  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedPO, setSelectedPO] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [lines, setLines] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [grnRes, suppRes] = await Promise.all([
        api.get('/grn'),
        api.get('/contacts?types=supplier')
      ]);
      setGrns(normalizeGrnList(grnRes.data));
      setSuppliers(suppRes.data?.contacts || []);

      try {
        const poRes = await api.get('/purchase-orders');
        const poArray = Array.isArray(poRes.data)
          ? poRes.data
          : Array.isArray(poRes.data?.orders)
          ? poRes.data.orders
          : [];
        setPurchaseOrders(poArray.filter(po => po.status !== 'fulfilled'));
      } catch (_) {
        setPurchaseOrders([]);
      }

      setAllProducts(await loadInventoryProducts(api));
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
      newLines[existingLineIndex].quantityReceived += 1;
      setLines(newLines);
      return;
    }
    setLines([{
      productId: product._id,
      productName: product.name,
      barcode: product.barcode,
      quantityReceived: 1,
      costPrice: product.costPrice || 0,
      expiryDate: '',
      batchNumber: '',
    }, ...lines]);
  };

  const handleSaveGRN = async () => {
    if (!selectedSupplier) return toast.error('Please select a supplier');
    if (lines.length === 0) return toast.error('Please add at least one product');
    if (requireBatch && lines.some((l) => !String(l.batchNumber || '').trim() || !l.expiryDate)) {
      return toast.error('Pharmacy receipts need a batch number and expiry on every line');
    }

    try {
      await api.post('/grn', {
        supplierId: selectedSupplier,
        purchaseOrderId: selectedPO || undefined,
        referenceNumber,
        lines: lines.map(l => ({
          ...l,
          expiryDate: l.expiryDate || undefined
        }))
      });
      toast.success('GRN saved and stock updated');
      setView('list');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save GRN');
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (view === 'new') {
    return (
      <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-4rem)] overflow-hidden px-4 pb-16 pt-6 lg:-mx-6 lg:px-6" style={fontPage}>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-300/18 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-5xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setView('list')} className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:text-emerald-700">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700/80">Inventory</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950" style={fontDisplay}>Receive goods (GRN)</h2>
              </div>
            </div>
            <button type="button" onClick={handleSaveGRN} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(4,120,87,0.8)] hover:bg-emerald-800">
              <Save className="h-4 w-4" /> Save & update stock
            </button>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-white/80 bg-white/90 p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] sm:grid-cols-3">
            <label className="text-xs font-medium text-slate-500">
              Supplier *
              <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className={`${field} mt-1.5`}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.entityId || s._id} value={s.entityId || s._id}>{s.displayName || s.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Link PO (optional)
              <select value={selectedPO} onChange={(e) => setSelectedPO(e.target.value)} className={`${field} mt-1.5`}>
                <option value="">No PO</option>
                {purchaseOrders.map(p => <option key={p._id} value={p._id}>{p.poNumber}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-500">
              Supplier inv / ref #
              <input type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className={`${field} mt-1.5`} placeholder="e.g. INV-2024-99" />
            </label>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)]">
            <div className="border-b border-slate-100 bg-slate-50/70 p-6">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Choose product</p>
              <ProductChooser
                products={allProducts}
                onPick={addProduct}
                placeholder="Search by name, SKU, or scan barcode…"
              />
              <p className="mt-2 text-xs text-slate-400">Click the field to browse, or type a name. Barcode scans still work.</p>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5 w-32">Qty recv</th>
                  <th className="px-6 py-3.5 w-40">Unit cost (SAR)</th>
                  <th className="px-6 py-3.5 w-48">Expiry (Balady)</th>
                  <th className="px-6 py-3.5 w-40">Batch #</th>
                  <th className="px-6 py-3.5 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-emerald-50/40">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{line.productName}</p>
                      <p className="text-xs text-slate-400">{line.barcode || 'No barcode'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <input type="number" min="1" value={line.quantityReceived} onChange={(e) => updateLine(index, 'quantityReceived', Number(e.target.value))} className={`${field} text-center font-semibold`} />
                    </td>
                    <td className="px-6 py-4">
                      <input type="number" step="0.01" value={line.costPrice} onChange={(e) => updateLine(index, 'costPrice', Number(e.target.value))} className={`${field} text-right`} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input type="date" value={line.expiryDate} onChange={(e) => updateLine(index, 'expiryDate', e.target.value)} className={`${field} pl-10`} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input type="text" value={line.batchNumber} onChange={(e) => updateLine(index, 'batchNumber', e.target.value)} className={field} placeholder="Optional" />
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
                    <td colSpan="6" className="px-6 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <PackageOpen className="h-5 w-5" />
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
        <div className="absolute left-1/2 top-[-18%] h-[360px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-300/18 blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700/80">Inventory</p>
            <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-950" style={fontDisplay}>Goods receipt notes</h1>
            <p className="mt-2 max-w-xl text-[15px] text-slate-500">Receive supplier deliveries and update stock, cost, and expiry in one step.</p>
          </div>
          <button
            type="button"
            onClick={() => { setLines([]); setSelectedSupplier(''); setReferenceNumber(''); setSelectedPO(''); setView('new'); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(4,120,87,0.8)] hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" /> Receive goods
          </button>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/90 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.4)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="px-6 py-3.5">GRN number</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Supplier</th>
                <th className="px-6 py-3.5">Ref / PO</th>
                <th className="px-6 py-3.5">Items</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grns.map(grn => (
                <tr key={grn._id} className="hover:bg-emerald-50/40">
                  <td className="px-6 py-4 font-semibold text-slate-900">{grn.grnNumber}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(grn.dateReceived).toLocaleString()}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{grn.supplierId?.nameEn || grn.supplierId?.nameAr}</td>
                  <td className="px-6 py-4 text-sm">
                    {grn.referenceNumber && <span className="block text-slate-900">Ref: {grn.referenceNumber}</span>}
                    {grn.purchaseOrderId && <span className="block text-emerald-700">PO: {grn.purchaseOrderId.poNumber}</span>}
                    {!grn.referenceNumber && !grn.purchaseOrderId && '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500">{grn.lines?.length || 0} lines</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <Check className="h-3.5 w-3.5" /> Received
                    </span>
                  </td>
                </tr>
              ))}
              {grns.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <PackageOpen className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No GRNs yet</p>
                    <p className="mt-1 text-xs text-slate-400">Receive a delivery to update inventory.</p>
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
