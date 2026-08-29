import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, FileText, Users, ShoppingBag, Contact } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import api from '../../lib/api';

export default function GlobalSearch({ language }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation(language);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
        setResults(data.results || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleSelect = (result) => {
    setIsOpen(false);
    setQuery('');
    
    switch (result.type) {
      case 'invoice':
        navigate(`/app/dashboard/accounting/invoices/${result.id}`);
        break;
      case 'customer':
        navigate(`/app/dashboard/customers/${result.id}`);
        break;
      case 'supplier':
        navigate(`/app/dashboard/suppliers/${result.id}`);
        break;
      case 'purchase_order':
        navigate(`/app/dashboard/purchases/orders/${result.id}`);
        break;
      case 'contact':
        navigate(`/app/dashboard/contacts`);
        break;
      default:
        break;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'invoice': return <FileText className="w-4 h-4 text-primary-500" />;
      case 'customer': return <Users className="w-4 h-4 text-emerald-500" />;
      case 'supplier': return <ShoppingBag className="w-4 h-4 text-amber-500" />;
      case 'purchase_order': return <FileText className="w-4 h-4 text-purple-500" />;
      case 'contact': return <Contact className="w-4 h-4 text-blue-500" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative group">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={language === 'ar' ? 'بحث شامل (فواتير، عملاء، أوامر)...' : 'Global search (invoices, customers, POs)...'}
          className="w-full bg-gray-50/50 dark:bg-dark-900/50 border border-gray-200 dark:border-dark-700 rounded-xl ps-10 pe-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all dark:text-gray-200 placeholder-gray-400"
        />
        {isLoading && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-dark-800 rounded-xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden z-50">
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {results.length === 0 && !isLoading && (
              <div className="p-4 text-center text-sm text-gray-500">
                {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
              </div>
            )}
            {results.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center gap-3 p-3 text-start rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
              >
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-dark-900">
                  {getIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {result.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                </div>
                {result.badge && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300">
                    {result.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
