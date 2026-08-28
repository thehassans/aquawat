import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { resolvePosTaxRate, cartItemsMatch, posCartLineKey } from '../lib/resolvePosTaxRate';

export const useCartEngine = () => {
  const [rawCartItems, setRawCartItems] = useState([]);

  const addItem = useCallback((product, { tenant } = {}) => {
    setRawCartItems(prev => {
      const incoming = {
        ...product,
        productId: product.productId || product._id,
        variantId: product.variantId || null,
        variantName: product.variantName || null,
      };
      const existing = prev.find(item => cartItemsMatch(item, incoming));
      if (existing) {
        return prev.map(item =>
          cartItemsMatch(item, incoming)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        lineKey: posCartLineKey(incoming),
        productId: incoming.productId,
        variantId: incoming.variantId,
        variantName: incoming.variantName,
        productName: product.name || product.productName,
        productNameAr: product.nameAr || product.name,
        primaryBarcode: product.primaryBarcode,
        quantity: 1,
        unitPrice: product.retailPrice,
        taxRate: resolvePosTaxRate(product, tenant),
        promo: product.mixAndMatchPromo,
        requiresPrescription: !!product.requiresPrescription,
        isControlled: !!product.isControlled,
      }];
    });
  }, []);

  const addWeightedItem = useCallback((product, weightKg, { tenant } = {}) => {
    const qty = Number(weightKg);
    if (!product || !qty || qty <= 0) return;
    const productId = product.productId || product._id;
    setRawCartItems(prev => [...prev, {
      lineKey: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      productId,
      variantId: product.variantId || null,
      variantName: product.variantName || null,
      productName: product.name,
      productNameAr: product.nameAr || product.name,
      primaryBarcode: product.primaryBarcode,
      quantity: qty,
      unitPrice: product.retailPrice,
      taxRate: resolvePosTaxRate(product, tenant),
      isWeighed: true,
      weightLabel: `${qty.toFixed(3)} KG`
    }]);
  }, []);

  const updateQuantity = useCallback((index, quantity) => {
    if (quantity <= 0) {
      setRawCartItems(prev => prev.filter((_, i) => i !== index));
      return;
    }
    setRawCartItems(prev => prev.map((item, i) => 
      i === index ? { ...item, quantity } : item
    ));
  }, []);

  const removeItem = useCallback((index) => {
    setRawCartItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => {
    setRawCartItems([]);
  }, []);

  // Compute final items with promo logic
  const cartItems = useMemo(() => {
    return rawCartItems.map(item => {
      let finalQuantityToCharge = item.quantity;
      let discountAmount = 0;

      // Mix & Match Promo: Buy X Get Y Free
      if (item.promo?.isActive && item.promo.buyQty > 0 && item.promo.getQtyFree > 0) {
        const bundleSize = item.promo.buyQty + item.promo.getQtyFree;
        const bundles = Math.floor(item.quantity / bundleSize);
        const freeItems = bundles * item.promo.getQtyFree;
        finalQuantityToCharge = item.quantity - freeItems;
        discountAmount = freeItems * item.unitPrice;
      }

      const originalTotal = item.quantity * item.unitPrice;
      const lineTotal = finalQuantityToCharge * item.unitPrice;

      return {
        ...item,
        originalTotal,
        lineTotal,
        discountAmount,
        hasPromo: discountAmount > 0
      };
    });
  }, [rawCartItems]);

  const totals = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const totalWithTax = item.lineTotal;
      const taxAmount = (totalWithTax * item.taxRate) / (100 + item.taxRate);
      const taxableAmount = totalWithTax - taxAmount;
      
      return {
        subtotal: acc.subtotal + taxableAmount,
        taxAmount: acc.taxAmount + taxAmount,
        grandTotal: acc.grandTotal + totalWithTax
      };
    }, { subtotal: 0, taxAmount: 0, grandTotal: 0 });
  }, [cartItems]);

  // Keep latest cart/totals in refs so unmount-time auto-hold uses fresh data
  const cartStateRef = useRef({ rawCartItems, totals });
  useEffect(() => {
    cartStateRef.current = { rawCartItems, totals };
  }, [rawCartItems, totals]);

  const persistHeldBill = useCallback((items, billTotals, customerName, auto = false) => {
    if (!items || items.length === 0) return false;
    const holdData = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      customerName,
      auto,
      items,
      totals: billTotals
    };
    const existing = JSON.parse(localStorage.getItem('maqder_held_bills') || '[]');
    localStorage.setItem('maqder_held_bills', JSON.stringify([...existing, holdData]));
    return true;
  }, []);

  // Hold Bill functionality
  const holdBill = useCallback((customerName = 'Walk-in') => {
    const { rawCartItems: items, totals: billTotals } = cartStateRef.current;
    if (persistHeldBill(items, billTotals, customerName, false)) {
      setRawCartItems([]);
    }
  }, [persistHeldBill]);

  // Auto-hold on page change / unmount (reads from ref, never clears React state on its own)
  const autoHoldBill = useCallback(() => {
    const { rawCartItems: items, totals: billTotals } = cartStateRef.current;
    return persistHeldBill(items, billTotals, 'Auto-held', true);
  }, [persistHeldBill]);

  const recallBill = useCallback((heldBillId) => {
    const existing = JSON.parse(localStorage.getItem('maqder_held_bills') || '[]');
    const bill = existing.find(b => b.id === heldBillId);
    if (bill) {
      setRawCartItems(bill.items);
      const remaining = existing.filter(b => b.id !== heldBillId);
      localStorage.setItem('maqder_held_bills', JSON.stringify(remaining));
    }
  }, []);

  const getHeldBills = useCallback(() => {
    return JSON.parse(localStorage.getItem('maqder_held_bills') || '[]');
  }, []);

  return {
    cartItems,
    addItem,
    addWeightedItem,
    updateQuantity,
    removeItem,
    clearCart,
    totals,
    holdBill,
    autoHoldBill,
    recallBill,
    getHeldBills
  };
};
