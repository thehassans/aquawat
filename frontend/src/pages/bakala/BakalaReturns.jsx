import React, { useState, useEffect } from 'react';
import { Search, RefreshCcw, ArrowLeft, Receipt, Clock, PackageX, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { hasBusinessType } from '../../lib/businessTypes';

export default function BakalaReturns() {
  const navigate = useNavigate();
  const tenant = useSelector((state) => state.auth.tenant);
  const posPath = hasBusinessType(tenant, 'pharmacy') ? '/app/dashboard/pharmacy/pos' : '/app/dashboard/bakala/pos';
  const [searchTerm, setSearchTerm] = useState('');
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Refund State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    fetchRecentInvoices();
  }, []);
  
  const fetchRecentInvoices = async () => {
    try {
      const res = await api.get('/invoices', { params: { businessContext: 'bakala', limit: 15 } });
      setRecentInvoices(res.data.invoices || []);
    } catch (err) {
      toast.error('Failed to fetch recent invoices');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchInvoiceDetails = async (invoiceId) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}`);
      setSelectedInvoice(res.data);
      setReturnQuantities({});
    } catch (err) {
      toast.error('Failed to fetch invoice details');
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm) return fetchRecentInvoices();
    setLoading(true);
    try {
      const res = await api.get('/invoices', { params: { businessContext: 'bakala', search: searchTerm, limit: 10 } });
      setRecentInvoices(res.data.invoices || []);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (lineId, val, maxQty) => {
    const qty = Math.max(0, Math.min(maxQty, Number(val)));
    setReturnQuantities(prev => ({ ...prev, [lineId]: qty }));
  };

  const calculateRefundTotal = () => {
    if (!selectedInvoice) return 0;
    return selectedInvoice.lineItems.reduce((acc, line) => {
      const qtyToReturn = returnQuantities[line._id] || 0;
      return acc + (qtyToReturn * line.unitPrice);
    }, 0);
  };

  const processRefund = async () => {
    const refundTotal = calculateRefundTotal();
    if (refundTotal <= 0) {
      toast.error('Please select items to refund');
      return;
    }

    setIsProcessing(true);
    try {
      const returnedLines = selectedInvoice.lineItems.filter(line => returnQuantities[line._id] > 0).map((line, index) => ({
        lineNumber: index + 1,
        productId: line.productId,
        productName: line.productName,
        productNameAr: line.productNameAr,
        quantity: returnQuantities[line._id], // Positive qty for ZATCA credit note
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        taxAmount: (returnQuantities[line._id] * line.unitPrice * (line.taxRate / 100)),
        lineTotal: returnQuantities[line._id] * line.unitPrice,
        lineTotalWithTax: (returnQuantities[line._id] * line.unitPrice) * (1 + line.taxRate / 100)
      }));

      const totalTax = returnedLines.reduce((acc, l) => acc + l.taxAmount, 0);
      const subtotal = returnedLines.reduce((acc, l) => acc + l.lineTotal, 0);
      const grandTotal = subtotal + totalTax;

      const payload = {
        invoiceType: '381', // Credit Note
        invoiceTypeCode: '0200000', // B2C
        transactionType: 'B2C',
        businessContext: 'bakala',
        flow: 'sell',
        issueDate: new Date(),
        subtotal,
        totalTax,
        grandTotal,
        paymentMethod: selectedInvoice.paymentMethod || 'cash',
        payments: [{ method: selectedInvoice.paymentMethod || 'cash', amount: grandTotal }],
        lineItems: returnedLines,
        zatca: { previousInvoiceHash: selectedInvoice.zatca?.invoiceHash },
        buyer: selectedInvoice.buyer
      };

      await api.post('/invoices', payload);
      toast.success('Refund processed successfully');
      setSelectedInvoice(null);
      setReturnQuantities({});
      fetchRecentInvoices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to process refund');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#F8F9FA] text-gray-900 overflow-hidden font-sans">
      <div className="w-[60%] flex flex-col border-r border-gray-100 bg-white z-10 relative">
        <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(posPath)}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-rose-600 flex items-center gap-2">
              <RefreshCcw className="w-6 h-6" />
              Returns & Refunds
            </h1>
          </div>
        </div>

        {selectedInvoice ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-rose-50/30">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Invoice</p>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedInvoice.invoiceNumber}</h2>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 font-medium">Original Total</p>
                  <p className="text-xl font-bold text-gray-900">SAR {selectedInvoice.grandTotal?.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-12 text-xs font-bold text-gray-400 uppercase tracking-wider px-4 mb-2">
                <div className="col-span-5">Product</div>
                <div className="col-span-2 text-center">Unit Price</div>
                <div className="col-span-2 text-center">Orig. Qty</div>
                <div className="col-span-3 text-right">Return Qty</div>
              </div>
              
              {selectedInvoice.lineItems.map(line => (
                <div key={line._id} className="grid grid-cols-12 items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="col-span-5 font-bold text-gray-800">{line.productName}</div>
                  <div className="col-span-2 text-center text-sm font-semibold text-gray-500">{line.unitPrice?.toFixed(2)}</div>
                  <div className="col-span-2 text-center text-sm font-semibold text-gray-500">{line.quantity}</div>
                  <div className="col-span-3 flex justify-end">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                      <input 
                        type="number" 
                        min="0" 
                        max={line.quantity}
                        value={returnQuantities[line._id] || ''}
                        onChange={(e) => handleQtyChange(line._id, e.target.value, line.quantity)}
                        className="w-16 text-center bg-transparent outline-none font-bold text-rose-600"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-4px_20px_rgb(0,0,0,0.02)]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500 font-medium">Refund Amount</span>
                <span className="text-3xl font-black text-rose-600">SAR {calculateRefundTotal().toFixed(2)}</span>
              </div>
              <button 
                onClick={processRefund}
                disabled={isProcessing || calculateRefundTotal() <= 0}
                className="w-full py-4 bg-rose-600 text-white font-bold rounded-xl text-lg shadow-lg shadow-rose-200 hover:bg-rose-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none flex justify-center items-center gap-2"
              >
                {isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Process Refund
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 px-6 py-4 flex flex-col items-center justify-center text-gray-400">
            <PackageX className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-xl mb-2 font-medium">Select an Invoice to Refund</p>
            <p className="text-sm">Click on any invoice from the right panel to begin.</p>
          </div>
        )}
      </div>

      <div className="w-[40%] flex flex-col bg-[#F8F9FA]">
        <div className="px-6 pt-6 pb-2">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search Invoice Number (e.g. BAKALA-123)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none text-base font-medium transition-all"
            />
          </form>
        </div>

        <div className="flex-1 px-6 pb-6 pt-2 overflow-y-auto">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            Recent Invoices
          </h3>
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl w-full"></div>)}
            </div>
          ) : recentInvoices.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-sm">No recent invoices found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map(invoice => (
                <div 
                  key={invoice._id} 
                  onClick={() => fetchInvoiceDetails(invoice._id)}
                  className={`bg-white p-4 rounded-xl border shadow-sm transition-all cursor-pointer ${selectedInvoice?._id === invoice._id ? 'border-rose-500 ring-2 ring-rose-100' : 'border-gray-100 hover:shadow hover:border-rose-200'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-bold ${selectedInvoice?._id === invoice._id ? 'text-rose-600' : 'text-gray-800'}`}>{invoice.invoiceNumber}</span>
                    <span className="font-bold text-gray-900">SAR {invoice.grandTotal?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{new Date(invoice.issueDate).toLocaleString()}</span>
                    <span className="font-semibold">{invoice.paymentMethod?.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
