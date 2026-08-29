import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Loader2,
  FileText,
  Users,
  ShoppingBag,
  Contact,
  Package,
  Warehouse,
  ClipboardList,
  Truck,
} from 'lucide-react';
import api from '../../lib/api';

const HINT_PREFIX = { en: 'Search', ar: 'بحث' };

/** Only the second segment rotates — “Search” stays fixed */
const HINT_TARGETS = {
  en: [
    'Purchase Order',
    'GRN',
    'Product',
    'Supplier',
    'Customer',
    'Warehouse',
    'Invoice',
  ],
  ar: [
    'أمر شراء',
    'إشعار استلام',
    'منتج',
    'مورد',
    'عميل',
    'مستودع',
    'فاتورة',
  ],
};

const HINT_EASE = [0.22, 1, 0.36, 1];

export default function GlobalSearch({ language }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const hintPrefix = HINT_PREFIX[isAr ? 'ar' : 'en'];
  const hintTargets = HINT_TARGETS[isAr ? 'ar' : 'en'];
  const hintFull = `${hintPrefix} ${hintTargets[hintIndex]}`;

  useEffect(() => {
    if (query.trim() || isFocused) return undefined;
    const id = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % hintTargets.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [query, isFocused, hintTargets.length]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        const panel = document.getElementById('global-search-panel');
        if (panel && panel.contains(event.target)) return;
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || !query.trim() || !wrapperRef.current) {
      setPanelStyle(null);
      return undefined;
    }
    const update = () => {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPanelStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 320),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, query]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(query)}&lang=${isAr ? 'ar' : 'en'}`);
        setResults(data.results || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, isAr]);

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
      case 'grn':
        navigate(`/app/dashboard/purchases/grn/${result.id}`);
        break;
      case 'product':
        navigate(`/app/dashboard/inventory/products/${result.id}`);
        break;
      case 'warehouse':
        navigate(`/app/dashboard/inventory/warehouses/${result.id}`);
        break;
      case 'contact':
        navigate(`/app/dashboard/contacts`);
        break;
      case 'shortcut':
        if (result.path) navigate(result.path);
        break;
      default:
        break;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'invoice':
        return <FileText className="w-4 h-4 text-primary-500" />;
      case 'customer':
        return <Users className="w-4 h-4 text-emerald-500" />;
      case 'supplier':
        return <ShoppingBag className="w-4 h-4 text-amber-500" />;
      case 'purchase_order':
        return <ClipboardList className="w-4 h-4 text-violet-500" />;
      case 'grn':
        return <Truck className="w-4 h-4 text-teal-500" />;
      case 'product':
        return <Package className="w-4 h-4 text-sky-500" />;
      case 'warehouse':
        return <Warehouse className="w-4 h-4 text-indigo-500" />;
      case 'contact':
        return <Contact className="w-4 h-4 text-blue-500" />;
      case 'shortcut':
        return <Search className="w-4 h-4 text-primary-500" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const showPanel = isOpen && query.trim() && panelStyle;

  return (
    <div ref={wrapperRef} className="relative z-[60] w-full max-w-2xl min-w-[28rem] sm:min-w-[36rem]">
      <div className="relative group">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={() => setIsFocused(false)}
          aria-label={isAr ? 'بحث شامل' : 'Global search'}
          className="w-full bg-gray-50/50 dark:bg-dark-900/50 border border-gray-200 dark:border-dark-700 rounded-xl ps-10 pe-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all dark:text-gray-200 placeholder-transparent"
          placeholder={hintFull}
        />
        {!query && (
          <div
            className="pointer-events-none absolute inset-y-0 start-10 end-4 flex items-center gap-1 overflow-hidden text-sm text-gray-400"
            aria-hidden
          >
            <span className="shrink-0">{hintPrefix}</span>
            <span className="relative min-w-0 flex-1 overflow-hidden">
              {isFocused ? (
                <span className="block truncate">{hintTargets[hintIndex]}</span>
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={hintTargets[hintIndex]}
                    initial={{ y: 14, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: -14, opacity: 0, filter: 'blur(4px)' }}
                    transition={{ duration: 0.5, ease: HINT_EASE }}
                    className="block truncate"
                  >
                    {hintTargets[hintIndex]}
                  </motion.span>
                </AnimatePresence>
              )}
            </span>
          </div>
        )}
        {isLoading && (
          <div className="absolute end-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        )}
      </div>

      {showPanel &&
        createPortal(
          <div
            id="global-search-panel"
            style={{
              position: 'fixed',
              top: panelStyle.top,
              left: panelStyle.left,
              width: panelStyle.width,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-dark-800 dark:ring-white/10"
          >
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.length === 0 && !isLoading && (
                <div className="p-4 text-center text-sm text-gray-500">
                  {isAr ? 'لا توجد نتائج' : 'No results found'}
                </div>
              )}
              {results.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id || result.path || idx}`}
                  type="button"
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
          </div>,
          document.body
        )}
    </div>
  );
}
