import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { ShoppingCart, CreditCard, Wallet, Search, Plus, Minus, Trash2, LogOut, ArrowLeft, BookOpen, CheckCircle2, X, Shirt, GraduationCap, Package, Users, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { generateZatcaQrValue } from '../../lib/zatcaQr';
import { generateFbrQrValue } from '../../lib/fbrQr';
import { getThermalPrinterSettings, getBodyWidthCss, getPageCss } from '../../lib/thermalPrinter';

function BookStorePosSessions({ onSessionVerified }) {
  const { tenant } = useSelector(state => state.auth);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState('');

  useEffect(() => {
    checkCurrentSession();
  }, []);

  const checkCurrentSession = async () => {
    try {
      const res = await api.get('/bookstore/shift/current');
      if (res.data.session) {
        setSession(res.data.session);
        if (onSessionVerified) onSessionVerified(res.data.session);
      }
    } catch (err) {
      console.error('Failed to check session', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/bookstore/shift/open', { openingBalance: Number(openingBalance) });
      setSession(res.data);
      toast.success('Till opened successfully');
      if (onSessionVerified) onSessionVerified(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open session');
    }
  };

  if (loading) return null;
  if (session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100">
        <div className="p-8 pb-6 flex flex-col items-center border-b border-gray-50">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Open Till</h2>
          <p className="text-gray-500 text-sm text-center">Start a new shift to begin processing sales.</p>
        </div>
        <form onSubmit={handleOpenSession} className="p-8 pt-6 bg-gray-50/50">
          <div className="mb-8">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">Opening Cash Balance</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">SAR</span>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full text-3xl pl-14 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-gray-900 shadow-sm"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-indigo-600/20"
          >
            Start Shift
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BookStorePOS() {
  const navigate = useNavigate();
  const { tenant } = useSelector(state => state.auth);

  const [cartItems, setCartItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [heldBills, setHeldBills] = useState([]);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [seriesSuggestion, setSeriesSuggestion] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');
  // Khata
  const [showKhataModal, setShowKhataModal] = useState(false);
  const [khataAccounts, setKhataAccounts] = useState([]);
  const [loadingKhata, setLoadingKhata] = useState(false);
  const [khataSearch, setKhataSearch] = useState('');
  const barcodeInputRef = useRef(null);

  const totals = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      const taxAmount = (lineTotal * item.taxRate) / (100 + item.taxRate);
      const taxableAmount = lineTotal - taxAmount;
      return {
        subtotal: acc.subtotal + taxableAmount,
        taxAmount: acc.taxAmount + taxAmount,
        grandTotal: acc.grandTotal + lineTotal,
      };
    }, { subtotal: 0, taxAmount: 0, grandTotal: 0 });
  }, [cartItems]);

  const addItem = useCallback((product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.productId === product._id || item.primaryBarcode === product.primaryBarcode);
      if (existing) {
        return prev.map(item =>
          item.productId === product._id || item.primaryBarcode === product.primaryBarcode
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      const price = product.discountPrice > 0 ? product.discountPrice : product.retailPrice;
      return [...prev, {
        productId: product._id,
        productName: product.name,
        productNameAr: product.nameAr || product.name,
        primaryBarcode: product.primaryBarcode,
        isbn: product.isbn,
        author: product.author,
        seriesName: product.seriesName || '',
        seriesNumber: product.seriesNumber || null,
        productType: product.productType || 'book',
        quantity: 1,
        unitPrice: price,
        taxRate: product.taxRate || 15,
      }];
    });

    if (product.seriesName) {
      api.get(`/bookstore/series/${encodeURIComponent(product.seriesName)}/next-volume`)
        .then(res => {
          if (res.data?.nextVolume) {
            const nextBook = res.data.books.find(b => b.seriesNumber === res.data.nextVolume);
            if (nextBook) {
              setSeriesSuggestion({
                seriesName: product.seriesName,
                nextVolume: res.data.nextVolume,
                seriesTotal: res.data.seriesTotal,
                book: nextBook,
              });
            }
          }
        })
        .catch(() => {});
    }

    if (product.productType === 'bundle' && product.bundleItems?.length > 0) {
      api.get(`/bookstore/bundles/${product._id}/items`)
        .then(res => {
          if (res.data?.items?.length > 0) {
            setCartItems(prev => {
              let updated = [...prev];
              for (const item of res.data.items) {
                const prod = item.productId;
                if (!prod) continue;
                const qty = item.quantity || 1;
                const existing = updated.find(ci => ci.productId === prod._id);
                if (existing) {
                  updated = updated.map(ci =>
                    ci.productId === prod._id ? { ...ci, quantity: ci.quantity + qty } : ci
                  );
                } else {
                  const itemPrice = prod.discountPrice > 0 ? prod.discountPrice : prod.retailPrice;
                  updated = [...updated, {
                    productId: prod._id,
                    productName: prod.name,
                    productNameAr: prod.nameAr || prod.name,
                    primaryBarcode: prod.primaryBarcode,
                    isbn: prod.isbn,
                    author: prod.author,
                    productType: prod.productType || 'book',
                    isBundleItem: true,
                    quantity: qty,
                    unitPrice: itemPrice,
                    taxRate: prod.taxRate || 15,
                  }];
                }
              }
              return updated;
            });
            toast.success(`Added ${res.data.items.length} bundle item${res.data.items.length > 1 ? 's' : ''} to cart`);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (seriesSuggestion) {
      const timer = setTimeout(() => setSeriesSuggestion(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [seriesSuggestion]);

  const updateQuantity = useCallback((index, quantity) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter((_, i) => i !== index));
      return;
    }
    setCartItems(prev => prev.map((item, i) => i === index ? { ...item, quantity } : item));
  }, []);

  const removeItem = useCallback((index) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await api.get('/bookstore/products');
        if (res.data.success) setAllProducts(res.data.products || []);
      } catch (err) {
        console.error('Failed to load products', err);
      }
    };
    loadProducts();
    setHeldBills(JSON.parse(localStorage.getItem('maqder_bookstore_held_bills') || '[]'));
  }, []);

  useEffect(() => {
    const handleGlobalKeydown = (e) => {
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          barcodeInputRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const filtered = allProducts.filter(p =>
      p.name?.toLowerCase().includes(lower) ||
      p.nameAr?.includes(searchTerm) ||
      p.isbn?.includes(searchTerm) ||
      p.primaryBarcode?.includes(searchTerm) ||
      p.author?.toLowerCase().includes(lower) ||
      p.publisher?.toLowerCase().includes(lower)
    );
    setSearchResults(filtered.slice(0, 24));
  }, [searchTerm, allProducts]);

  const handleScannerSubmit = async (e) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    const exactMatch = allProducts.find(p =>
      p.primaryBarcode === term || p.isbn === term || p.barcodes?.includes(term)
    );

    if (exactMatch) {
      addItem(exactMatch);
      setSearchTerm('');
    } else if (searchResults.length === 1) {
      addItem(searchResults[0]);
      setSearchTerm('');
    } else {
      toast.error('No product found for: ' + term);
    }
  };

  const holdBill = () => {
    if (cartItems.length === 0) return;
    const holdData = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      items: cartItems,
      totals,
    };
    const existing = JSON.parse(localStorage.getItem('maqder_bookstore_held_bills') || '[]');
    localStorage.setItem('maqder_bookstore_held_bills', JSON.stringify([...existing, holdData]));
    setHeldBills([...existing, holdData]);
    clearCart();
    toast('Bill held', { icon: '⏸️' });
  };

  const recallBill = (billId) => {
    const existing = JSON.parse(localStorage.getItem('maqder_bookstore_held_bills') || '[]');
    const bill = existing.find(b => b.id === billId);
    if (bill) {
      setCartItems(bill.items);
      const remaining = existing.filter(b => b.id !== billId);
      localStorage.setItem('maqder_bookstore_held_bills', JSON.stringify(remaining));
      setHeldBills(remaining);
      setShowRecallModal(false);
    }
  };

  const handleCheckout = async (paymentMethod, payments = null, khataAccountId = null) => {
    if (cartItems.length === 0) return;

    if (paymentMethod === 'khata' && khataAccountId) {
      try {
        await api.post(`/khata/${khataAccountId}/transactions`, {
          type: 'credit',
          amount: totals.grandTotal,
          notes: 'Bookstore POS Checkout'
        });
        toast.success('Recorded in Khata');
      } catch (error) {
        toast.error('Failed to record Khata transaction');
        return;
      }
    }

    const invoice = {
      offlineId: uuidv4(),
      lineItems: cartItems.map((item, index) => ({
        lineNumber: index + 1,
        productId: item.productId,
        productName: item.productName,
        productNameAr: item.productNameAr,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: (item.quantity * item.unitPrice * item.taxRate) / (100 + item.taxRate),
        lineTotal: item.quantity * item.unitPrice - (item.quantity * item.unitPrice * item.taxRate) / (100 + item.taxRate),
        lineTotalWithTax: item.quantity * item.unitPrice,
        taxCategory: 'S',
      })),
      subtotal: totals.subtotal,
      totalTax: totals.taxAmount,
      grandTotal: totals.grandTotal,
      paymentMethod,
      payments,
      khataAccountId,
      issueDate: new Date().toISOString(),
    };

    try {
      await api.post('/bookstore/sync', { invoices: [invoice] });
    } catch (err) {
      console.error('Sync failed, invoice saved locally', err);
    }

    clearCart();
    printReceipt(invoice, paymentMethod);
    toast.success('Sale completed!');
  };

  const printReceipt = (order, paymentMethod = 'cash') => {
    const w = window.open('', '_blank', 'width=320,height=600,scrollbars=yes');
    if (!w) {
      toast.error('Please allow popups for receipt printing');
      return;
    }

    const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Bookstore POS';
    const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مكتبة نقاط البيع';
    const vatNumber = tenant?.business?.vatNumber || '';
    const address = tenant?.business?.address;
    const addressParts = address ? [address.buildingNumber, address.street, address.district, address.city, address.postalCode].filter(Boolean) : [];
    const addressText = addressParts.join(', ');
    const dateStr = new Date().toLocaleString('en-US');
    const items = order.lineItems || [];
    const pmLabel = paymentMethod === 'cash' ? 'Cash | نقدي' : paymentMethod === 'card' ? 'Card | بطاقة' : paymentMethod === 'split' ? 'Split | مقسم' : paymentMethod === 'khata' ? 'Khata | خطة' : String(paymentMethod);

    const isZatcaApplicable = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'SAR';
    const isFbrApplicable = String(tenant?.settings?.currency || 'SAR').toUpperCase() === 'PKR';
    let zatcaQrPayload = '';
    try {
      if (isZatcaApplicable) {
        zatcaQrPayload = generateZatcaQrValue({
          sellerName: businessNameAr,
          vatNumber,
          timestamp: new Date().toISOString(),
          totalWithVat: order.grandTotal || 0,
          vatTotal: order.totalTax || 0,
        });
      } else if (isFbrApplicable && tenant?.fbr?.autoGenerateQr !== false) {
        zatcaQrPayload = generateFbrQrValue({
          sellerName: businessNameEn,
          ntn: tenant?.fbr?.ntn || vatNumber,
          strn: tenant?.fbr?.strn || '',
          invoiceNumber: order.invoiceNumber || order.receiptNumber || '',
          fbrInvoiceNo: order.fbr?.fbrInvoiceNo || '',
          timestamp: new Date().toISOString(),
          totalWithTax: order.grandTotal || 0,
          salesTax: order.totalTax || 0,
        });
      }
    } catch (_) {}

    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    const _thermal = getThermalPrinterSettings(tenant);
    const _bodyCss = getBodyWidthCss(_thermal);
    const _pageCss = getPageCss(_thermal);

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt</title>
<style>
  ${_pageCss}
  ${_bodyCss}
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #999; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { text-align: left; border-bottom: 1px dashed #999; padding: 2px 0; }
  td { padding: 3px 0; vertical-align: top; }
  .right { text-align: right; }
  .total { font-weight: bold; font-size: 12px; border-top: 1px dashed #999; padding-top: 4px; margin-top: 4px; }
  .qr { text-align: center; margin-top: 8px; }
  .qr img { width: 80px; height: 80px; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:13px;">${escapeHtml(businessNameEn)}</div>
  <div class="center bold">${escapeHtml(businessNameAr)}</div>
  <div class="center" style="font-size:9px; margin-top:4px;">SIMPLIFIED TAX INVOICE | فاتورة ضريبية مبسطة</div>
  ${vatNumber ? `<div class="center" style="font-size:9px;">VAT / الرقم الضريبي: ${escapeHtml(vatNumber)}</div>` : ''}
  ${addressText ? `<div class="center" style="font-size:9px;">${escapeHtml(addressText)}</div>` : ''}
  <div class="divider"></div>
  <div style="font-size:9px;">Date / التاريخ: ${escapeHtml(dateStr)}</div>
  <div style="font-size:9px;">Payment / الدفع: ${escapeHtml(pmLabel)}</div>
  <div class="divider"></div>
  <table>
    <thead><tr><th>Item / الصنف</th><th style="text-align:center;">Qty</th><th class="right">Total</th></tr></thead>
    <tbody>
      ${items.map(item => {
        const displayName = escapeHtml(item.productName || item.productNameAr || 'Item');
        return `
        <tr>
          <td><div style="font-weight:bold;">${displayName}</div>${item.author ? `<span style="font-size:8px;color:#666;">${escapeHtml(item.author)}</span><br/>` : ''}<span style="font-size:8px;color:#666;">SAR ${Number(item.unitPrice).toFixed(2)} x ${item.quantity}</span></td>
          <td style="text-align:center;">${item.quantity}</td>
          <td class="right">SAR ${Number(item.lineTotalWithTax || (item.unitPrice * item.quantity)).toFixed(2)}</td>
        </tr>
      `}).join('')}
    </tbody>
  </table>
  <div class="divider"></div>
  <div style="display:flex;justify-content:space-between;font-size:10px;"><span>Subtotal / المجموع الفرعي:</span><span>SAR ${Number(order.subtotal || 0).toFixed(2)}</span></div>
  <div style="display:flex;justify-content:space-between;font-size:10px;"><span>VAT (15%) / ضريبة القيمة المضافة:</span><span>SAR ${Number(order.totalTax || 0).toFixed(2)}</span></div>
  <div class="total" style="display:flex;justify-content:space-between;"><span>Total / الإجمالي:</span><span>SAR ${Number(order.grandTotal || 0).toFixed(2)}</span></div>
  ${zatcaQrPayload ? `
  <div class="qr">
    <div style="font-size:7px;color:#666;margin-bottom:2px;">${isFbrApplicable ? 'FBR | DIGITAL INVOICE' : 'ZATCA | هيئة الزكاة'}</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(zatcaQrPayload)}" />
  </div>
  ` : ''}
  <div class="divider"></div>
  <div class="center" style="font-size:9px; margin-top:6px;">Thank you for your visit! | شكراً لزيارتكم!</div>
  <div class="center" style="font-size:8px; color:#999;">Maqder Bookstore POS</div>
  <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},500);},300);};</script>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'F1': e.preventDefault(); handleCheckout('cash'); break;
        case 'F2': e.preventDefault(); handleCheckout('card'); break;
        case 'F3': e.preventDefault(); setShowSplitModal(true); break;
        case 'F4': e.preventDefault(); handleOpenKhata(); break;
        case 'Escape': e.preventDefault(); clearCart(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems, totals]);

  const handleCloseSession = async () => {
    if (!activeSession) return;
    const actualClosing = window.prompt('Enter actual cash in till for End of Day:');
    if (actualClosing === null) return;
    try {
      await api.post('/bookstore/shift/close', { actualClosingBalance: Number(actualClosing) });
      toast.success('Till closed successfully');
      setActiveSession(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to close till');
    }
  };

  const handleSplitCheckout = () => {
    const cash = parseFloat(splitCash) || 0;
    const card = parseFloat(splitCard) || 0;
    if (cash + card < totals.grandTotal) {
      toast.error('Split amounts do not cover total');
      return;
    }
    setShowSplitModal(false);
    handleCheckout('split', [
      { method: 'cash', amount: cash },
      { method: 'card', amount: card },
    ]);
    setSplitCash('');
    setSplitCard('');
  };

  const handleOpenKhata = async () => {
    if (cartItems.length === 0) return;
    setShowKhataModal(true);
    setLoadingKhata(true);
    try {
      const res = await api.get('/khata');
      setKhataAccounts(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch Khata accounts');
    } finally {
      setLoadingKhata(false);
    }
  };

  const filteredKhataAccounts = useMemo(() => {
    if (!khataSearch) return khataAccounts;
    const lower = khataSearch.toLowerCase();
    return khataAccounts.filter(a =>
      a.customerId?.name?.toLowerCase().includes(lower) ||
      a.customerId?.phone?.includes(lower) ||
      a.customerId?.mobile?.includes(lower)
    );
  }, [khataSearch, khataAccounts]);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#F8F9FA] text-gray-900 overflow-hidden font-sans">
      {tenant?.settings?.bookstore?.requireShift !== false && !activeSession && (
        <BookStorePosSessions onSessionVerified={setActiveSession} />
      )}

      {/* LEFT PANEL: Cart (60%) */}
      <div className="w-[60%] flex flex-col border-r border-gray-100 bg-white shadow-sm relative">
        <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/app/dashboard/bookstore/dashboard')}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">Bookstore POS</h1>
              <p className="text-xs text-gray-400">{cartItems.length} items in cart</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={holdBill}
              disabled={cartItems.length === 0}
              className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              Hold
            </button>
            <button
              onClick={() => setShowRecallModal(true)}
              className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors relative"
            >
              Recall
              {heldBills.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {heldBills.length}
                </span>
              )}
            </button>
            {activeSession && activeSession._id !== 'auto' && (
              <button
                onClick={handleCloseSession}
                className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1"
              >
                <LogOut className="w-4 h-4" /> Close Till
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="px-6 py-4 border-b border-gray-50">
          <form onSubmit={handleScannerSubmit} className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Scan ISBN/barcode or search by title, author..."
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
              autoFocus
            />
          </form>
          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-lg">
              {searchResults.map(product => (
                <button
                  key={product._id}
                  onClick={() => { addItem(product); setSearchTerm(''); }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  {product.coverImage ? (
                    <img src={product.coverImage} alt="" className="w-10 h-14 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-14 bg-indigo-50 rounded flex items-center justify-center">
                      {(() => {
                        const pt = product.productType || 'book';
                        const Icon = pt === 'uniform' ? Shirt : pt === 'course' ? GraduationCap : pt === 'bundle' ? Package : pt === 'stationery' || pt === 'other' ? Package : BookOpen;
                        return <Icon className="w-5 h-5 text-indigo-300" />;
                      })()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                    {product.author && <p className="text-xs text-gray-400 truncate">{product.author}</p>}
                    {product.uniformSize && <p className="text-xs text-gray-400 truncate">Size: {product.uniformSize}</p>}
                    {product.courseLevel && <p className="text-xs text-gray-400 truncate">Level: {product.courseLevel}</p>}
                    {product.isbn && <p className="text-[10px] text-gray-300">ISBN: {product.isbn}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-indigo-600">SAR {Number(product.discountPrice > 0 ? product.discountPrice : product.retailPrice).toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">{product.productType === 'course' ? `${product.courseEnrolledCount || 0}/${product.courseCapacity || '∞'} enrolled` : product.productType === 'bundle' ? `${product.bundleItems?.length || 0} items` : `Stock: ${product.stockQuantity || 0}`}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-30" />
              <p className="font-bold text-lg">Cart is empty</p>
              <p className="text-sm">Scan or search to add items</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cartItems.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-gray-900 truncate">{item.productName}</p>
                      {item.isCourseBook && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 shrink-0">
                          <GraduationCap className="w-2.5 h-2.5" /> Course Book
                        </span>
                      )}
                      {item.productType === 'course' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 shrink-0">
                          <GraduationCap className="w-2.5 h-2.5" /> Course
                        </span>
                      )}
                      {item.isBundleItem && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-600 shrink-0">
                          <Package className="w-2.5 h-2.5" /> Bundle Item
                        </span>
                      )}
                      {item.productType === 'bundle' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-50 text-violet-600 shrink-0">
                          <Package className="w-2.5 h-2.5" /> Bundle
                        </span>
                      )}
                    </div>
                    {item.author && <p className="text-xs text-gray-400 truncate">{item.author}</p>}
                    {item.seriesName && (
                      <p className="text-[10px] text-indigo-500 font-medium">{item.seriesName} #{item.seriesNumber || '?'}</p>
                    )}
                    <p className="text-xs text-gray-400">SAR {item.unitPrice.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(index, item.quantity - 1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(index, item.quantity + 1)} className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="w-20 text-right">
                    <p className="font-bold text-sm text-gray-900">SAR {(item.quantity * item.unitPrice).toFixed(2)}</p>
                  </div>
                  <button onClick={() => removeItem(index)} className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Series suggestion banner */}
        {seriesSuggestion && (
          <div className="mx-6 mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-indigo-700">Next in series: {seriesSuggestion.seriesName}</p>
              <p className="text-sm font-bold text-gray-900 truncate">Book #{seriesSuggestion.nextVolume}: {seriesSuggestion.book?.name}</p>
              {seriesSuggestion.book?.stockQuantity > 0 ? (
                <p className="text-[10px] text-emerald-600 font-medium">In stock ({seriesSuggestion.book.stockQuantity})</p>
              ) : (
                <p className="text-[10px] text-amber-600 font-medium">Out of stock</p>
              )}
            </div>
            <button
              onClick={() => { addItem(seriesSuggestion.book); setSeriesSuggestion(null); }}
              className="px-3 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              Add to cart
            </button>
            <button
              onClick={() => setSeriesSuggestion(null)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Totals & checkout */}
        <div className="px-6 py-5 border-t border-gray-100 bg-white">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-500">Subtotal</span>
            <span className="text-sm font-bold text-gray-900">SAR {totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-500">VAT (15%)</span>
            <span className="text-sm font-bold text-gray-900">SAR {totals.taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-5 pb-4 border-b border-dashed border-gray-200">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-2xl font-black tracking-tighter text-indigo-600">SAR {totals.grandTotal.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={() => handleCheckout('cash')}
              disabled={cartItems.length === 0}
              className="py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all flex flex-col items-center gap-1"
            >
              <Wallet className="w-5 h-5" />
              <span className="text-xs">Cash (F1)</span>
            </button>
            <button
              onClick={() => handleCheckout('card')}
              disabled={cartItems.length === 0}
              className="py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 disabled:opacity-40 transition-all flex flex-col items-center gap-1"
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Card (F2)</span>
            </button>
            <button
              onClick={() => setShowSplitModal(true)}
              disabled={cartItems.length === 0}
              className="py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 disabled:opacity-40 transition-all flex flex-col items-center gap-1"
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs">Split (F3)</span>
            </button>
            <button
              onClick={handleOpenKhata}
              disabled={cartItems.length === 0}
              className="py-4 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 disabled:opacity-40 transition-all flex flex-col items-center gap-1"
            >
              <Users className="w-5 h-5" />
              <span className="text-xs">Khata (F4)</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Product grid (40%) */}
      <div className="w-[40%] flex flex-col bg-[#F8F9FA] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Quick Browse</h2>
            <p className="text-[10px] text-gray-400">Tap to add</p>
          </div>
          <span className="text-[10px] text-gray-400">{allProducts.length} items</span>
        </div>
        <div className="px-4 py-2 border-b border-gray-100 bg-white">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'book', label: 'Books' },
              { key: 'course', label: 'Courses' },
              { key: 'uniform', label: 'Uniforms' },
              { key: 'stationery', label: 'Stationery' },
              { key: 'bundle', label: 'Bundles' },
              { key: 'other', label: 'Other' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-colors ${
                  quickFilter === f.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {allProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <BookOpen className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No products loaded</p>
              <p className="text-xs">Add products from the Products page</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(quickFilter === 'all' ? allProducts : allProducts.filter(p => p.productType === quickFilter)).slice(0, 80).map(product => {
                const pt = product.productType || 'book';
                const TypeIcon = pt === 'uniform' ? Shirt : pt === 'course' ? GraduationCap : pt === 'bundle' ? Package : pt === 'stationery' || pt === 'other' ? Package : BookOpen;
                const typeColor = pt === 'uniform' ? 'text-emerald-500 bg-emerald-50' : pt === 'course' ? 'text-rose-500 bg-rose-50' : pt === 'bundle' ? 'text-violet-500 bg-violet-50' : pt === 'stationery' ? 'text-amber-500 bg-amber-50' : 'text-indigo-500 bg-indigo-50';
                const price = Number(product.discountPrice > 0 ? product.discountPrice : product.retailPrice).toFixed(2);
                return (
                  <button
                    key={product._id}
                    onClick={() => addItem(product)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColor}`}>
                      {product.coverImage ? (
                        <img src={product.coverImage} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <TypeIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-gray-900 truncate leading-tight">{product.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {pt === 'course' && product.courseBooks?.length > 0 ? (
                          product.courseBooks
                            .map(id => allProducts.find(p => p._id === id)?.name)
                            .filter(Boolean)
                            .join(' · ')
                        ) : (
                          <>
                            {pt === 'course' && product.courseLevel ? `${product.courseLevel} · ` : ''}
                            {pt === 'uniform' && product.uniformSize ? `Size ${product.uniformSize} · ` : ''}
                            {product.author || product.publisher || pt.charAt(0).toUpperCase() + pt.slice(1)}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-xs text-indigo-600">SAR {price}</p>
                      <p className="text-[9px] text-gray-300">{pt === 'course' ? 'course' : pt === 'bundle' ? 'bundle' : `Stock: ${product.stockQuantity || 0}`}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Split Payment Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Split Payment</h2>
              <button onClick={() => setShowSplitModal(false)} className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-4 bg-indigo-50 rounded-2xl text-center">
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Total Due</p>
              <p className="text-3xl font-black text-indigo-600">SAR {totals.grandTotal.toFixed(2)}</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cash Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-200 outline-none font-bold text-lg"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Card Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={splitCard}
                  onChange={(e) => setSplitCard(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-200 outline-none font-bold text-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
            <button
              onClick={handleSplitCheckout}
              className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
            >
              Complete Split Payment
            </button>
          </div>
        </div>
      )}

      {/* Recall Bills Modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Held Bills</h2>
              <button onClick={() => setShowRecallModal(false)} className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            {heldBills.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No held bills</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {heldBills.map(bill => (
                  <button
                    key={bill.id}
                    onClick={() => recallBill(bill.id)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors text-left"
                  >
                    <div>
                      <p className="font-bold text-sm text-gray-900">{bill.items.length} items</p>
                      <p className="text-xs text-gray-400">{new Date(bill.time).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-600">SAR {bill.totals.grandTotal.toFixed(2)}</p>
                      <p className="text-xs text-indigo-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Recall
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Khata Checkout Modal */}
      {showKhataModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Select Khata Customer
              </h2>
              <button onClick={() => setShowKhataModal(false)} className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={khataSearch}
                  onChange={(e) => setKhataSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-amber-200 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {loadingKhata ? (
                <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-amber-500" /></div>
              ) : filteredKhataAccounts.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No customers found</p>
              ) : (
                filteredKhataAccounts.map((acc) => (
                  <button
                    key={acc._id}
                    onClick={() => {
                      handleCheckout('khata', null, acc._id);
                      setShowKhataModal(false);
                    }}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-amber-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-bold text-sm text-gray-900">{acc.customerId?.name}</p>
                      <p className="text-xs text-gray-400">{acc.customerId?.phone || acc.customerId?.mobile || 'No phone'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Balance</p>
                      <p className="font-bold text-amber-600">SAR {Number(acc.balance || 0).toFixed(2)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
