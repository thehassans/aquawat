import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Receipt,
  Printer,
  CheckCircle2,
  X,
  Coffee,
  Sparkles,
  Zap,
  Flame,
  Dumbbell,
  ShieldAlert,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useTranslation } from '../../lib/translations';

const DEFAULT_SUPPLEMENT_ITEMS = [
  {
    id: 'supp_1',
    nameEn: 'Gold Standard 100% Whey (Double Rich Chocolate)',
    nameAr: 'واي بروتين جولد ستاندرد (شوكولاتة دبل)',
    category: 'protein',
    price: 320,
    barcode: '748927028669',
    stock: 24,
    calories: '120 kcal / scoop',
  },
  {
    id: 'supp_2',
    nameEn: 'ISO-100 Hydrolyzed Protein (Gourmet Vanilla)',
    nameAr: 'ايزو 100 بروتين هيدرولايزد (فانيلا فاخرة)',
    category: 'protein',
    price: 380,
    barcode: '705016353209',
    stock: 18,
    calories: '110 kcal / scoop',
  },
  {
    id: 'supp_3',
    nameEn: 'C4 Original Pre-Workout (Fruit Punch)',
    nameAr: 'سي 4 بري ورك اوت باور (فواكه)',
    category: 'preworkout',
    price: 185,
    barcode: '842595101234',
    stock: 30,
    calories: 'Zero Sugar',
  },
  {
    id: 'supp_4',
    nameEn: 'Creapure Micronized Creatine 300g',
    nameAr: 'كرياتين ميكرونايزد نقي 300 جم',
    category: 'creatine',
    price: 130,
    barcode: '748927054118',
    stock: 45,
    calories: '5g Creatine / serving',
  },
  {
    id: 'supp_5',
    nameEn: 'Fresh Whey Protein Shake (Blended at Bar)',
    nameAr: 'مخفوق واي بروتين طازج (بالموز والحليب)',
    category: 'smoothie',
    price: 25,
    barcode: 'BAR-SHAKE-01',
    stock: 999,
    calories: '32g Protein • 240 kcal',
  },
  {
    id: 'supp_6',
    nameEn: 'BCAA 2:1:1 Recovery Drink (Watermelon)',
    nameAr: 'مشروب ريكفري BCAA (بطيخ منعش)',
    category: 'bcaa',
    price: 165,
    barcode: '811445020112',
    stock: 20,
    calories: '7g BCAAs',
  },
  {
    id: 'supp_7',
    nameEn: 'Protein Bar 20g (Salted Caramel)',
    nameAr: 'لوح بروتين بار 20 جم (كراميل مملح)',
    category: 'snacks',
    price: 15,
    barcode: 'BAR-PRO-02',
    stock: 80,
    calories: '20g Protein • 210 kcal',
  },
  {
    id: 'supp_8',
    nameEn: 'Pro Shaker Bottle 700ml (Stainless Steel)',
    nameAr: 'شيكر بروتين ستانلس ستيل 700 مل',
    category: 'gear',
    price: 65,
    barcode: 'GEAR-SHAKER-01',
    stock: 35,
    calories: 'BPA Free',
  },
  {
    id: 'supp_9',
    nameEn: 'Gym Heavy Weightlifting Lifting Straps',
    nameAr: 'أحزمة رفع أثقال قطنية مدعمة',
    category: 'gear',
    price: 45,
    barcode: 'GEAR-STRAP-01',
    stock: 25,
    calories: 'Heavy Duty',
  },
  {
    id: 'supp_10',
    nameEn: 'Electrolyte Energy Water 500ml',
    nameAr: 'مياه كهارل وطاقة 500 مل',
    category: 'hydration',
    price: 6,
    barcode: 'WATER-ELECTRO-01',
    stock: 120,
    calories: '0 Calories',
  },
];

const CATEGORIES = [
  { id: 'all', en: 'All Items', ar: 'كل المنتجات' },
  { id: 'smoothie', en: 'Shakes & Bar', ar: 'المخفوقات والبار' },
  { id: 'protein', en: 'Whey Protein', ar: 'البروتين' },
  { id: 'preworkout', en: 'Pre-Workout', ar: 'مكملات الطاقة' },
  { id: 'creatine', en: 'Creatine & BCAA', ar: 'كرياتين وأحماض' },
  { id: 'snacks', en: 'Healthy Snacks', ar: 'سناكات صحية' },
  { id: 'gear', en: 'Gym Gear', ar: 'معدات وإكسسوارات' },
];

export default function GymPOS() {
  const { language } = useSelector((state) => state.ui);
  const tenant = useSelector((state) => state.auth?.tenant || state.auth?.user?.tenant);
  const isAr = language === 'ar';
  const { t } = useTranslation(language);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  const currency = tenant?.currency || (isAr ? 'SAR' : 'SAR');
  const taxRate = 0.15; // 15% VAT

  const filteredItems = DEFAULT_SUPPLEMENT_ITEMS.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nameAr.includes(searchQuery) ||
      item.barcode.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  const grandTotal = Number((subtotal + taxAmount).toFixed(2));

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      const receipt = {
        invoiceNumber: `INV-GYM-${Date.now().toString().slice(-6)}`,
        date: new Date(),
        items: [...cart],
        subtotal,
        taxAmount,
        grandTotal,
        paymentMethod,
        currency,
      };
      setLastReceipt(receipt);
      setCart([]);
      toast.success(isAr ? 'تمت عملية البيع وإصدار الفاتورة بنجاح' : 'Sale completed & invoice issued');
    }, 600);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-16 animate-fade-in items-start">
      {/* ── LEFT: PRODUCT CATALOG & SEARCH (8 COLS) ────────────────────────────── */}
      <div className="lg:col-span-8 space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isAr ? 'نقطة بيع المكملات والبار' : 'Supplements & Protein Bar POS'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'مخفوقات البروتين، المكملات الغذائية، السناكات، ومعدات التمرين'
                  : 'Fast checkout for protein shakes, BCAAs, creatine, energy drinks, and gym apparel'}
              </p>
            </div>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم أو الباركود...' : 'Scan barcode or search...'}
              className="input ps-10 pe-4 !py-2 text-xs font-medium w-full"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="card p-2.5 rounded-2xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-dark-700'
              }`}
            >
              {isAr ? cat.ar : cat.en}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            return (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="card p-4 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-dark-700 dark:text-slate-300 font-bold uppercase">
                      {item.category}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">
                      {item.stock > 100 ? (isAr ? 'متوفر' : 'In Stock') : `${item.stock} left`}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-emerald-600 transition">
                    {isAr ? item.nameAr || item.nameEn : item.nameEn}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">{item.calories}</p>
                </div>

                <div className="flex items-baseline justify-between pt-3 mt-3 border-t border-slate-100 dark:border-dark-700">
                  <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                    {item.price} <span className="text-[10px] font-normal text-slate-400">{currency}</span>
                  </span>

                  <button
                    type="button"
                    className="w-7 h-7 rounded-xl bg-slate-900 text-white group-hover:bg-emerald-600 flex items-center justify-center transition shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: CART & INSTANT CHECKOUT (4 COLS) ────────────────────────────── */}
      <div className="lg:col-span-4 card p-6 rounded-3xl bg-white dark:bg-dark-800 border border-slate-100 dark:border-dark-700 shadow-xl space-y-5 sticky top-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-dark-700">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'سلة الطلب' : 'Current Order'}
            </h3>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'تفريغ' : 'Clear'}</span>
            </button>
          )}
        </div>

        {/* Cart Line Items */}
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Coffee className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs font-medium">{isAr ? 'السلة فارغة، اضغط على المنتجات لإضافتها' : 'Cart is empty. Tap items to add.'}</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-700/40 border border-slate-100 dark:border-dark-600/50 flex items-center justify-between text-xs"
              >
                <div className="flex-1 pr-2">
                  <p className="font-bold text-slate-900 dark:text-white truncate">
                    {isAr ? item.nameAr || item.nameEn : item.nameEn}
                  </p>
                  <p className="font-mono text-emerald-600 font-bold mt-0.5">
                    {item.price * item.qty} {currency}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateCartQty(item.id, -1)}
                    className="w-6 h-6 rounded-lg bg-white dark:bg-dark-800 border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => updateCartQty(item.id, 1)}
                    className="w-6 h-6 rounded-lg bg-white dark:bg-dark-800 border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals Summary */}
        <div className="pt-3 border-t border-slate-100 dark:border-dark-700 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>{isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{subtotal} {currency}</span>
          </div>

          <div className="flex justify-between text-slate-500">
            <span>{isAr ? 'ضريبة القيمة المضافة (15%):' : 'VAT (15%):'}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{taxAmount} {currency}</span>
          </div>

          <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200/60 dark:border-dark-600">
            <span>{isAr ? 'المجموع النهائي:' : 'Grand Total:'}</span>
            <span className="font-mono text-emerald-600 text-lg">{grandTotal} {currency}</span>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-1.5">
          <label className="label text-[11px]">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                paymentMethod === 'card'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isAr ? 'بطاقة / مدى' : 'Card / Mada'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                paymentMethod === 'cash'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{isAr ? 'نقداً (Cash)' : 'Cash'}</span>
            </button>
          </div>
        </div>

        {/* Instant Checkout Button */}
        <button
          type="button"
          disabled={cart.length === 0 || isProcessing}
          onClick={handleCheckout}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/25 transition disabled:opacity-40 flex items-center justify-center gap-2 transform active:scale-95"
        >
          {isProcessing ? (
            <span>Processing...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAr ? `تأكيد الدفع (${grandTotal} ${currency})` : `Complete Sale (${grandTotal} ${currency})`}</span>
            </>
          )}
        </button>
      </div>

      {/* ── PRINT RECEIPT MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lastReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-dark-700 w-full max-w-sm overflow-hidden p-6 space-y-4 text-center"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {isAr ? 'تم إصدار الفاتورة الضريبية' : 'Tax Invoice Issued'}
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{lastReceipt.invoiceNumber}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-700/40 text-xs space-y-2 text-start font-mono">
                {lastReceipt.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate pr-2">{it.qty}x {it.nameEn}</span>
                    <span className="font-bold">{it.price * it.qty} {lastReceipt.currency}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-200 dark:border-dark-600 flex justify-between font-bold text-slate-900 dark:text-white">
                  <span>Total:</span>
                  <span className="text-emerald-600">{lastReceipt.grandTotal} {lastReceipt.currency}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isAr ? 'طباعة الإيصال الحراري' : 'Print Receipt'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLastReceipt(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  {isAr ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
