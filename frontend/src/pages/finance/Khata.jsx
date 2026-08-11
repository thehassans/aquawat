import React, { useState, useEffect } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { Users, Plus, CreditCard, Clock, FileText, ChevronRight, RefreshCw, X, Receipt, Trash2, ArrowLeft } from 'lucide-react';

export default function Khata() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Selection
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  // Form States
  const [customers, setCustomers] = useState([]);
  const [newAccountId, setNewAccountId] = useState('');
  const [transactionType, setTransactionType] = useState('credit');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionNotes, setTransactionNotes] = useState('');

  // Quick Add Customer States
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accRes, custRes] = await Promise.all([
        api.get('/khata'),
        api.get('/contacts?types=customer')
      ]);
      const newAccounts = accRes.data;
      setAccounts(newAccounts);
      setCustomers(custRes.data?.contacts || []);

      if (selectedAccount) {
        const updated = newAccounts.find(a => a._id === selectedAccount._id);
        if (updated) setSelectedAccount(updated);
      }
    } catch (error) {
      toast.error('Failed to load Khata accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (accountId) => {
    try {
      const res = await api.get(`/khata/${accountId}/transactions`);
      setTransactions(res.data);
    } catch (error) {
      toast.error('Failed to load transactions');
    }
  };

  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
    fetchTransactions(account._id);
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      let customerId = newAccountId;
      
      if (showNewCustomerForm) {
        const custRes = await api.post('/customers', {
          name: newCustomerName,
          phone: newCustomerPhone,
          type: 'individual'
        });
        customerId = custRes.data._id;
      }

      await api.post('/khata', { customerId });
      toast.success('Account created');
      setShowAddModal(false);
      setShowNewCustomerForm(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create account');
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/khata/${selectedAccount._id}/transactions`, {
        type: transactionType,
        amount: Number(transactionAmount),
        notes: transactionNotes
      });
      toast.success('Transaction recorded');
      setShowTransactionModal(false);
      setTransactionAmount('');
      setTransactionNotes('');
      fetchData(); // Refresh balances
      fetchTransactions(selectedAccount._id);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record transaction');
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      toast.error('Please enter your password');
      return;
    }
    setIsDeleting(true);
    try {
      await api.delete(`/khata/${selectedAccount._id}`, { data: { password: deletePassword } });
      toast.success('Account deleted');
      setShowDeleteModal(false);
      setDeletePassword('');
      setSelectedAccount(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-[#FAFAFA] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      
      {/* LEFT PANEL: Accounts List */}
      <div className={`${selectedAccount ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] border-r border-gray-100/80 flex-col bg-white z-10 shadow-[4px_0_24px_rgb(0,0,0,0.02)]`}>
        <div className="px-6 py-8 border-b border-gray-100/50 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Daftar</h2>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">Customer Ledgers</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-full hover:scale-105 hover:bg-gray-800 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3 custom-scrollbar">
          {accounts.map(acc => (
            <button
              key={acc._id}
              onClick={() => handleSelectAccount(acc)}
              className={`group w-full text-left p-5 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                selectedAccount?._id === acc._id 
                  ? 'bg-black text-white shadow-xl shadow-black/10 scale-[1.02]' 
                  : 'bg-gray-50/50 hover:bg-gray-100/80 hover:scale-[1.01]'
              }`}
            >
              {selectedAccount?._id === acc._id && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              )}
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-3">
                  <span className={`font-semibold tracking-tight ${selectedAccount?._id === acc._id ? 'text-white' : 'text-gray-900'}`}>
                    {acc.customerId?.name || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-end">
                  <span className={`text-xs flex items-center gap-1.5 ${selectedAccount?._id === acc._id ? 'text-gray-300' : 'text-gray-400'}`}>
                    <Clock className="w-3.5 h-3.5"/> 
                    {new Date(acc.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 ${selectedAccount?._id === acc._id ? 'text-gray-400' : 'text-gray-400'}`}>Balance</span>
                    <span className={`font-bold tracking-tight ${
                      selectedAccount?._id === acc._id 
                        ? 'text-white' 
                        : acc.balance > 0 ? 'text-rose-500' : 'text-emerald-500'
                    }`}>
                      SAR {Math.abs(acc.balance).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
          {accounts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Users className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No ledgers found</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Account Details & Ledger */}
      <div className={`${selectedAccount ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[#FAFAFA] relative`}>
        {selectedAccount ? (
          <>
            {/* Header */}
            <div className="px-4 sm:px-10 py-6 sm:py-8 border-b border-gray-100/80 bg-white/50 backdrop-blur-xl sticky top-0 z-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center gap-3 sm:gap-5">
                <button
                  type="button"
                  onClick={() => setSelectedAccount(null)}
                  className="md:hidden p-2 -ml-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                  aria-label="Back to accounts"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xl font-bold text-gray-700 shadow-inner">
                  {selectedAccount.customerId?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-1">{selectedAccount.customerId?.name}</h2>
                  <p className="text-sm font-medium text-gray-400 tracking-wide">{selectedAccount.customerId?.phone || 'No phone number'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 sm:gap-8 flex-wrap">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-1">Outstanding Balance</p>
                  <p className={`text-2xl sm:text-4xl font-black tracking-tighter ${selectedAccount.balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    SAR {Math.abs(selectedAccount.balance).toFixed(2)}
                  </p>
                </div>
                <div className="hidden sm:block w-px h-12 bg-gray-200"></div>
                <button 
                  onClick={() => setShowDeleteModal(true)}
                  className="group relative w-12 h-12 bg-red-50 text-red-500 rounded-full font-bold hover:bg-red-100 hover:text-red-600 transition-all flex items-center justify-center shadow-sm"
                  title="Delete Account"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowTransactionModal(true)}
                  className="group relative px-6 py-3.5 bg-black text-white rounded-full font-bold shadow-[0_8px_20px_rgb(0,0,0,0.15)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.25)] hover:-translate-y-0.5 transition-all flex items-center gap-2 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  <Receipt className="w-5 h-5 relative z-10" /> 
                  <span className="relative z-10">Record</span>
                </button>
              </div>
            </div>

            {/* Ledger */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Transaction History</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>
                
                <div className="space-y-4">
                  {transactions.map(tx => (
                    <div key={tx._id} className="group flex justify-between items-center p-5 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${
                          tx.type === 'credit' 
                            ? 'bg-rose-50 text-rose-500' 
                            : 'bg-emerald-50 text-emerald-500'
                        }`}>
                          {tx.type === 'credit' ? <Plus className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 tracking-tight">{tx.type === 'credit' ? 'Purchased on Credit' : 'Payment Received'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
                              {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {tx.notes && <span className="text-sm text-gray-500">- {tx.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <div className={`text-xl font-black tracking-tighter ${tx.type === 'credit' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {tx.type === 'credit' ? '+' : '-'} SAR {tx.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                      <FileText className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-base font-medium">No transactions recorded yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 bg-gradient-to-br from-[#FAFAFA] to-gray-50">
            <div className="w-32 h-32 mb-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100">
              <Users className="w-12 h-12 text-gray-300" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-400">Select a ledger to view</h2>
            <p className="text-sm font-medium text-gray-400 mt-2">Manage customer credit and payments seamlessly</p>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">New Khata Account</h2>
              <button onClick={() => {
                setShowAddModal(false);
                setShowNewCustomerForm(false);
              }} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleCreateAccount} className="p-6">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Select Customer</label>
                  {!showNewCustomerForm && (
                    <button type="button" onClick={() => setShowNewCustomerForm(true)} className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:text-emerald-700">
                      <Plus className="w-4 h-4"/> New Customer
                    </button>
                  )}
                </div>
                {!showNewCustomerForm ? (
                  <select 
                    required
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => <option key={c.entityId || c._id} value={c.entityId || c._id}>{c.displayName || c.name}</option>)}
                  </select>
                ) : (
                  <div className="space-y-3">
                    <input type="text" required value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Customer Name *" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"/>
                    <input type="text" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="Phone Number (Optional)" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"/>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowNewCustomerForm(false)} className="flex-1 p-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors">Create Ledger</button>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold">Add Transaction</h2>
              <button onClick={() => setShowTransactionModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleCreateTransaction} className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button type="button" onClick={() => setTransactionType('credit')} className={`p-4 rounded-xl font-bold border-2 transition-all ${transactionType === 'credit' ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                  Give Credit
                </button>
                <button type="button" onClick={() => setTransactionType('payment')} className={`p-4 rounded-xl font-bold border-2 transition-all ${transactionType === 'payment' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                  Receive Payment
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (SAR)</label>
                <input type="number" required min="0.01" step="0.01" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00"/>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                <input type="text" value={transactionNotes} onChange={(e) => setTransactionNotes(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Weekly groceries"/>
              </div>
              <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors">Record Transaction</button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-red-600">Delete Khata Account</h2>
              <button onClick={() => {
                setShowDeleteModal(false);
                setDeletePassword('');
              }} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>
            <form onSubmit={handleDeleteAccount} className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete this Khata account and all its transactions? This action cannot be undone.
              </p>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Tenant Password</label>
                <input 
                  type="password" 
                  required 
                  value={deletePassword} 
                  onChange={(e) => setDeletePassword(e.target.value)} 
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none" 
                  placeholder="Enter your password"
                />
              </div>
              <button type="submit" disabled={isDeleting} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
