import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useCartEngine } from '../../hooks/useCartEngine';
import { useBakalaSync } from '../../hooks/useBakalaSync';
import { getProductByBarcode, saveOfflineInvoice } from '../../lib/bakalaDb';
import { hasBusinessType } from '../../lib/businessTypes';
import { ShoppingCart, CreditCard, Wallet, Send, RefreshCw, Server, WifiOff, ArrowLeft, Search, Plus, Minus, Trash2, LogOut, Smartphone, Keyboard, Users, CheckCircle2, Scale, Plug, Unplug, Printer, Archive } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import PosSessions from './PosSessions';
import { updateTenant } from '../../store/slices/authSlice';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { generateZatcaQrValue } from '../../lib/zatcaQr';
import { generateFbrQrValue } from '../../lib/fbrQr';
import { getThermalPrinterSettings, getBodyWidthCss, getPageCss } from '../../lib/thermalPrinter';
import { isAndroidPos, isAndroidDevice, detectBridge, isWebUsbSupported, isWebSerialSupported, printText as androidPrintText, openCashDrawer as androidOpenCashDrawer, openCashDrawerViaRaw, openCashDrawerViaWebUSB, openCashDrawerViaSerial, openCashDrawerViaSystemPrint, printViaSystemPrint, buildReceiptHtml } from '../../lib/androidPosPrinter';
import { PosRelationStrip, buildRelationsBySource } from '../../components/inventory/ProductRelationSuggestions';
import { asInvList } from '../../lib/invList';
import { useQuery } from '@tanstack/react-query';

// ─── Memoized single product card — only re-renders if this specific product changes ───
const ProductCard = React.memo(function ProductCard({ item, onAddItem }) {
  return (
    <button
      type="button"
      onClick={() => onAddItem(item)}
      className="w-full min-h-[108px] p-3 rounded-2xl border border-gray-100 bg-white hover:border-emerald-400 hover:shadow-md transition-all text-left active:scale-95 flex flex-col justify-between"
    >
      <span className="font-semibold text-gray-700 line-clamp-2 leading-snug text-sm">{item.name}</span>
      <span className="text-sm font-bold text-emerald-600 mt-1">SAR {(item.retailPrice || 0).toFixed(2)}</span>
    </button>
  );
}, (prev, next) => prev.item._id === next.item._id && prev.item.retailPrice === next.item.retailPrice);

function ProductGrid({ items, onAddItem }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((item) => (
          <ProductCard key={item._id || item.primaryBarcode} item={item} onAddItem={onAddItem} />
        ))}
      </div>
    </div>
  );
}

export default function BakalaPOS() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { tenant, user } = useSelector(state => state.auth);
  const hw = tenant?.settings?.hardwareSettings || {};
  const bakalaSettings = tenant?.settings?.bakala || {};
  const pharmacySettings = tenant?.settings?.pharmacy || tenant?.settings?.installedApps?.pharmacy?.config || {};
  const isPharmacy = hasBusinessType(tenant, 'pharmacy');
  const taxEnabled = bakalaSettings.taxEnabled !== false;
  const autoInvoicePrint = bakalaSettings.autoInvoicePrint !== false;
  const scalePrefix = (hw.scaleBarcodePrefix || '21').substring(0, 2).padEnd(2, '0');
  
  const { cartItems, addItem, addWeightedItem, updateQuantity, removeItem, clearCart, totals, holdBill, autoHoldBill, recallBill, getHeldBills } = useCartEngine();
  const { isOnline, pendingCount, syncOfflineData } = useBakalaSync();
  const barcodeInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [fastItems, setFastItems] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitCash, setSplitCash] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [scannerConnected, setScannerConnected] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    scanner: 'disconnected', // disconnected | connected | checking | unsupported
    printer: 'disconnected', // disconnected | connected | checking | not_configured
    cashDrawer: 'disconnected',
  });
  const [showPrinterConfig, setShowPrinterConfig] = useState(false);
  const [printerConfig, setPrinterConfig] = useState({
    printerIpAddress: hw.printerIpAddress || '192.168.1.100',
    printerPort: hw.printerPort || 9100,
    cashDrawerKickCode: hw.cashDrawerKickCode || '27,112,0,50,250',
  });
  const [savingPrinterConfig, setSavingPrinterConfig] = useState(false);

  // Weight Scale Modal
  const [showWeighModal, setShowWeighModal] = useState(false);
  const [weighSearch, setWeighSearch] = useState('');
  const [weighProduct, setWeighProduct] = useState(null);
  const [weighValue, setWeighValue] = useState('');
  const [weighUnit, setWeighUnit] = useState('KG');
  const [scalePort, setScalePort] = useState(null);
  const scaleReaderRef = useRef(null);
  
  // Khata Modal
  const [showKhataModal, setShowKhataModal] = useState(false);
  const [khataAccounts, setKhataAccounts] = useState([]);
  const [loadingKhata, setLoadingKhata] = useState(false);
  const [khataSearch, setKhataSearch] = useState('');
  const [pharmacyRx, setPharmacyRx] = useState({
    patientName: '',
    patientIdNumber: '',
    prescriptionNumber: '',
    prescriberName: '',
    pharmacistNote: '',
  });
  const [lastSuggestTradingId, setLastSuggestTradingId] = useState(null);

  const heldBills = getHeldBills();

  const hasLinkedTradingProducts = useMemo(
    () => (allProducts || []).some((p) => p?.productId),
    [allProducts],
  );

  const { data: relationsCatalogue = [] } = useQuery({
    queryKey: ['inv-relations-catalogue', 'pos'],
    queryFn: () => api.get('/stock/relations').then((r) => asInvList(r.data)),
    enabled: hasLinkedTradingProducts,
    staleTime: 120_000,
  });

  const relationsBySource = useMemo(
    () => (relationsCatalogue.length ? buildRelationsBySource(relationsCatalogue) : null),
    [relationsCatalogue],
  );

  const bakalaByTradingId = useMemo(() => {
    const m = new Map();
    for (const p of allProducts || []) {
      if (p?.productId) m.set(String(p.productId), p);
    }
    return m;
  }, [allProducts]);

  const addPosItem = (item) => {
    if (!item) return;
    addItem(item);
    const tid = item.productId ? String(item.productId) : null;
    setLastSuggestTradingId(tid);
  };

  const getBillTotal = (bill) => {
    if (bill.totals && typeof bill.totals.grandTotal === 'number') {
      return bill.totals.grandTotal;
    }
    return bill.items.reduce((acc, item) => {
       return acc + (item.quantity * (item.unitPrice || item.retailPrice || 0));
    }, 0);
  };

  // Focus search input automatically if typing letters/numbers outside of an input
  useEffect(() => {
    const handleGlobalKeydown = (e) => {
      if (e.target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  // Auto-hold the active bill when leaving the POS page so nothing is lost.
  useEffect(() => {
    return () => {
      const held = autoHoldBill();
      if (held) {
        toast('Bill moved to Hold', { icon: '⏸️' });
      }
    };
  }, [autoHoldBill]);

  // Warn the cashier before refreshing/closing the tab with an active bill.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (cartItems.length > 0) {
        autoHoldBill();
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [cartItems.length, autoHoldBill]);

  // Load products from IndexedDB, with a live API fallback if the cache is empty.
  useEffect(() => {
    const loadProducts = async () => {
      await syncOfflineData();
      const { getAllProducts } = await import('../../lib/bakalaDb');
      let products = [];
      try {
        products = await getAllProducts();
      } catch (err) {
        console.error('Failed to read POS product cache', err);
      }
      if (!products?.length) {
        try {
          const prodRes = await api.get('/bakala/products');
          products = prodRes.data?.products || [];
        } catch (err) {
          console.error('Failed to load POS products', err);
        }
      }
      setAllProducts(Array.isArray(products) ? products : []);
      setFastItems([]);
    };
    loadProducts();
  }, [syncOfflineData]);

  // Handle Search Filtering
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFastItems([]);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const filtered = allProducts.filter((p) => {
      const name = String(p?.name || p?.nameAr || '').toLowerCase();
      const barcode = String(p?.primaryBarcode || '').toLowerCase();
      const extra = Array.isArray(p?.barcodes) ? p.barcodes : [];
      return name.includes(lower) || barcode.includes(lower) || extra.some((b) => String(b).toLowerCase().includes(lower));
    });
    setFastItems(filtered.slice(0, 24));
  }, [searchTerm, allProducts]);

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

  // ===== Weight Scale (in-POS) =====
  const weighProducts = useMemo(() => {
    const list = allProducts.filter(p => {
      const cat = (p.category || '').toLowerCase();
      return cat.includes('fruit') || cat.includes('veg') || cat.includes('produce') || p.unit === 'KG';
    });
    if (!weighSearch.trim()) return list.slice(0, 30);
    const lower = weighSearch.toLowerCase();
    return list.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.primaryBarcode?.includes(lower)
    ).slice(0, 30);
  }, [allProducts, weighSearch]);

  const weighKg = useMemo(() => {
    const v = parseFloat(weighValue) || 0;
    return weighUnit === 'G' ? v / 1000 : v;
  }, [weighValue, weighUnit]);

  const weighTotal = weighProduct ? weighKg * (weighProduct.retailPrice || 0) : 0;

  const openWeighModal = () => {
    setWeighProduct(null);
    setWeighSearch('');
    setWeighValue('');
    setWeighUnit('KG');
    setShowWeighModal(true);
  };

  const connectPosScale = async () => {
    if (!('serial' in navigator)) {
      toast.error('Web Serial not supported. Use Chrome or Edge.');
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      setScalePort(port);
      toast.success('Scale connected');
      readScaleLoop(port);
    } catch (err) {
      toast.error('Failed to connect to scale');
    }
  };

  const readScaleLoop = async (port) => {
    try {
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      scaleReaderRef.current = reader;
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (const line of lines) {
          const match = line.match(/([0-9]+\.[0-9]+)/);
          if (match) {
            setWeighUnit('KG');
            setWeighValue(match[1]);
          }
        }
      }
    } catch (err) {
      // stream ended
    }
  };

  const disconnectPosScale = async () => {
    try {
      if (scaleReaderRef.current) await scaleReaderRef.current.cancel();
      if (scalePort) await scalePort.close();
    } catch (err) { /* noop */ }
    setScalePort(null);
  };

  // Clean up scale connection when component unmounts
  useEffect(() => {
    return () => {
      if (scaleReaderRef.current) {
        try { scaleReaderRef.current.cancel(); } catch (e) { /* noop */ }
      }
      if (scalePort) {
        try { scalePort.close(); } catch (e) { /* noop */ }
      }
    };
  }, [scalePort]);

  // ===== Device Connection Manager (Scanner / Printer / Cash Drawer) =====
  const updateDeviceStatus = (key, status) => {
    setDeviceStatus((prev) => ({ ...prev, [key]: status }));
  };

  const connectScanner = async (auto = false) => {
    if (!('serial' in navigator)) {
      updateDeviceStatus('scanner', 'unsupported');
      if (!auto) toast.error('Web Serial not supported. Use Chrome or Edge.');
      return;
    }
    updateDeviceStatus('scanner', 'checking');
    try {
      // Try previously allowed serial ports first (smart auto-connect)
      const existingPorts = await navigator.serial.getPorts();
      if (auto && existingPorts.length > 0) {
        setScannerConnected(true);
        updateDeviceStatus('scanner', 'connected');
        toast.success('Scanner auto-connected');
        return;
      }
      // Otherwise request a new port (requires user gesture)
      const port = await navigator.serial.requestPort();
      if (port) {
        setScannerConnected(true);
        updateDeviceStatus('scanner', 'connected');
        toast.success('Scanner Connected via Serial');
      }
    } catch (err) {
      if (!auto) {
        // Keyboard wedge fallback when user cancels or no serial device
        setScannerConnected(true);
        updateDeviceStatus('scanner', 'connected');
        barcodeInputRef.current?.focus();
        toast.success('Scanner Ready (Keyboard Mode)');
      } else {
        updateDeviceStatus('scanner', 'disconnected');
      }
    }
  };

  const testPrinterConnection = async () => {
    if (hw.receiptPrinterType === 'android') {
      if (isAndroidPos()) return { ok: true };
      return { ok: false, reason: 'not_configured' };
    }
    if (hw.receiptPrinterType === 'android_system_print') {
      if (isAndroidDevice()) return { ok: true };
      return { ok: false, reason: 'not_configured' };
    }
    if (hw.receiptPrinterType === 'usb') {
      return { ok: false, reason: 'not_configured' };
    }
    if (hw.receiptPrinterType === 'bluetooth') {
      return { ok: false, reason: 'not_configured' };
    }
    if (hw.receiptPrinterType !== 'network' || !hw.printerIpAddress) {
      return { ok: false, reason: 'not_configured' };
    }
    try {
      await api.post('/tenants/test-printer', {
        ipAddress: hw.printerIpAddress,
        port: Number(hw.printerPort) || 9100,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: 'offline' };
    }
  };

  const connectPrinter = async () => {
    updateDeviceStatus('printer', 'checking');
    const result = await testPrinterConnection();
    if (result.ok) {
      updateDeviceStatus('printer', 'connected');
      toast.success('Printer connected');
    } else if (result.reason === 'not_configured') {
      updateDeviceStatus('printer', 'not_configured');
      toast('Printer not configured in Settings > Hardware', { icon: '⚙️' });
    } else {
      updateDeviceStatus('printer', 'disconnected');
      toast.error('Printer unreachable');
    }
  };

  const connectCashDrawer = async () => {
    if (hw.openCashDrawerOnCashPayment === false) {
      updateDeviceStatus('cashDrawer', 'not_configured');
      toast('Cash drawer auto-open is disabled in settings.', { icon: '⚙️' });
      return;
    }
    updateDeviceStatus('cashDrawer', 'checking');
    const bridge = detectBridge();
    let opened = false;

    // 1. Try bridge dedicated openCashDrawer
    if (bridge && bridge.methods.openCashDrawer) {
      try { await androidOpenCashDrawer(); opened = true; } catch (e) { console.error('Bridge cash drawer failed:', e); }
    }

    // 2. Try bridge raw kick code
    if (!opened && bridge && (bridge.methods.printRaw || bridge.methods.printText)) {
      try { await openCashDrawerViaRaw(hw.cashDrawerKickCode); opened = true; } catch (e) { console.error('Bridge raw kick code failed:', e); }
    }

    // 3. Try Android system print service — sends kick code through print dialog
    if (!opened && isAndroidDevice()) {
      try { await openCashDrawerViaSystemPrint(hw.cashDrawerKickCode); opened = true; } catch (e) { console.error('System print cash drawer failed:', e); }
    }

    // 4. Try WebUSB — direct USB connection to printer
    if (!opened && isWebUsbSupported()) {
      try { await openCashDrawerViaWebUSB(hw.cashDrawerKickCode); opened = true; } catch (e) { console.error('WebUSB cash drawer failed:', e); }
    }

    // 5. Try Web Serial API
    if (!opened && isWebSerialSupported()) {
      try { await openCashDrawerViaSerial(hw.cashDrawerKickCode); opened = true; } catch (e) { console.error('Web Serial cash drawer failed:', e); }
    }

    // 6. Try network backend ONLY for network printer type
    if (!opened && hw.receiptPrinterType === 'network' && hw.printerIpAddress) {
      try {
        await api.post('/tenants/test-cash-drawer', {
          ipAddress: hw.printerIpAddress,
          port: Number(hw.printerPort) || 9100,
          kickCode: hw.cashDrawerKickCode,
        });
        opened = true;
      } catch (err) {
        console.error('Network cash drawer failed:', err);
      }
    }

    if (opened) {
      updateDeviceStatus('cashDrawer', 'connected');
      toast.success('Cash drawer connected');
    } else {
      updateDeviceStatus('cashDrawer', 'not_configured');
      toast('Cash drawer could not be opened. Check Settings > Hardware for diagnostics.', { icon: '⚙️' });
    }
  };

  const savePrinterConfig = async () => {
    setSavingPrinterConfig(true);
    try {
      const payload = {
        ...hw,
        printerIpAddress: printerConfig.printerIpAddress,
        printerPort: Number(printerConfig.printerPort) || 9100,
        cashDrawerKickCode: printerConfig.cashDrawerKickCode,
      };
      const res = await api.put('/tenants/current', { settings: { hardwareSettings: payload } });
      if (res.data?.tenant) {
        dispatch(updateTenant(res.data.tenant));
      }
      toast.success('Printer settings saved');
      setShowPrinterConfig(false);
      // Re-test the connection now that settings are saved
      await connectPrinter();
      await connectCashDrawer();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save printer settings');
    } finally {
      setSavingPrinterConfig(false);
    }
  };

  // Smart auto-connect: try to reconnect known devices on mount
  useEffect(() => {
    let cancelled = false;
    const autoConnect = async () => {
      // Scanner: reconnect previously allowed serial ports without user gesture
      if ('serial' in navigator) {
        try {
          const ports = await navigator.serial.getPorts();
          if (!cancelled && ports.length > 0) {
            setScannerConnected(true);
            updateDeviceStatus('scanner', 'connected');
          }
        } catch (e) {
          // ignore
        }
      }
      // Printer: test connection based on printer type
      const printerResult = await testPrinterConnection();
      if (!cancelled) {
        updateDeviceStatus('printer', printerResult.ok ? 'connected' : printerResult.reason === 'not_configured' ? 'not_configured' : 'disconnected');
      }
      // Cash Drawer: only for network type (Android types need user gesture or bridge)
      if (!cancelled && printerResult.ok && hw.receiptPrinterType === 'network') {
        try {
          await api.post('/tenants/test-cash-drawer', {
            ipAddress: hw.printerIpAddress,
            port: Number(hw.printerPort) || 9100,
            kickCode: hw.cashDrawerKickCode,
          });
          updateDeviceStatus('cashDrawer', 'connected');
        } catch (e) {
          updateDeviceStatus('cashDrawer', 'disconnected');
        }
      } else if (!cancelled && printerResult.ok && (hw.receiptPrinterType === 'android' || hw.receiptPrinterType === 'android_system_print')) {
        // For Android types, mark cash drawer as connected if bridge supports it (dedicated method or raw/text print)
        const bridge = detectBridge();
        if (bridge && (bridge.methods.openCashDrawer || bridge.methods.printRaw || bridge.methods.printText)) {
          updateDeviceStatus('cashDrawer', 'connected');
        } else {
          updateDeviceStatus('cashDrawer', 'not_configured');
        }
      } else if (!cancelled) {
        updateDeviceStatus('cashDrawer', 'not_configured');
      }
    };
    autoConnect();
    return () => { cancelled = true; };
  }, [hw.printerIpAddress, hw.printerPort, hw.receiptPrinterType, hw.cashDrawerKickCode]);

  // ===== POS session heartbeat for super-admin live monitoring =====
  const tabIdRef = useRef(`pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const heartbeatIntervalRef = useRef(null);

  const sendPosHeartbeat = async () => {
    if (!tenant?._id || !user?._id) return;
    try {
      await api.post('/pos-terminal/heartbeat', {
        tenantId: tenant._id,
        tabId: tabIdRef.current,
        deviceStatus: {
          scanner: deviceStatus.scanner,
          printer: deviceStatus.printer,
          cashDrawer: deviceStatus.cashDrawer,
          scale: scalePort ? 'connected' : 'disconnected',
        },
      });
    } catch (err) {
      // Silently fail — heartbeat is best-effort monitoring
    }
  };

  const closePosSession = async () => {
    if (!tenant?._id || !user?._id) return;
    try {
      await api.post('/pos-terminal/close', {
        tenantId: tenant._id,
        tabId: tabIdRef.current,
      });
    } catch (err) {
      // silently fail
    }
  };

  useEffect(() => {
    sendPosHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendPosHeartbeat, 30000);
    const handleVisibility = () => {
      if (!document.hidden) sendPosHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(heartbeatIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      closePosSession();
    };
  }, [tenant?._id, user?._id, deviceStatus.scanner, deviceStatus.printer, deviceStatus.cashDrawer, scalePort]);

  const handleAddWeighedToCart = () => {
    if (!weighProduct) {
      toast.error('Select a product first');
      return;
    }
    if (!weighKg || weighKg <= 0) {
      toast.error('Enter a valid weight');
      return;
    }
    addWeightedItem(weighProduct, weighKg);
    toast.success(`${weighProduct.name} • ${weighKg.toFixed(3)} KG added`);
    setShowWeighModal(false);
  };

  // Handle Barcode Scans via Enter key in search
  const handleScannerSubmit = async (e) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    // 1. Check for Scale Barcode (EAN-13 starting with scalePrefix)
    if (term.length === 13 && term.startsWith(scalePrefix)) {
      const itemCode = term.substring(2, 7);
      const priceHalalas = parseInt(term.substring(7, 12), 10);
      const priceSAR = priceHalalas / 100;

      // Find product by itemCode (assuming itemCode is the first 5 digits of primaryBarcode)
      const scaleMatch = allProducts.find(p => 
        (p.primaryBarcode && p.primaryBarcode.startsWith(itemCode)) || 
        (p.primaryBarcode && p.primaryBarcode.endsWith(itemCode)) ||
        p.primaryBarcode === itemCode
      );

      if (scaleMatch) {
        const isWeightBased = scaleMatch.unit === 'KG' || !scaleMatch.unit;
        const scaledItem = {
          ...scaleMatch,
          retailPrice: priceSAR,
          name: `${scaleMatch.name} (${isWeightBased ? 'Weighed' : 'Counted'})`
        };
        addPosItem(scaledItem);
        setSearchTerm('');
        return;
      }
    }
    
    // 2. Check for Exact Match
    const exactMatch = allProducts.find(p => p.primaryBarcode === term || p.barcodes?.includes(term));
    
    if (exactMatch) {
      addPosItem(exactMatch);
      setSearchTerm('');
    } else {
      // If no exact match but there's only 1 item in the filtered list, add that one
      if (fastItems.length === 1) {
        addPosItem(fastItems[0]);
        setSearchTerm('');
      } else {
        // Fallback for manual test item
        addPosItem({
          _id: uuidv4(),
          name: `Item ${term}`,
          primaryBarcode: term,
          retailPrice: 15.0,
          taxRate: 15
        });
        setSearchTerm('');
      }
    }
  };

  // Checkout handling
  const handleCheckout = async (paymentMethod, payments = null, khataAccountId = null) => {
    if (cartItems.length === 0) return;

    if (isPharmacy) {
      const needsRx = cartItems.some((item) => item.requiresPrescription);
      const needsControlledNote = cartItems.some((item) => item.isControlled);
      if (pharmacySettings.requirePrescriptionOnRx !== false && needsRx && !String(pharmacyRx.prescriptionNumber || '').trim()) {
        toast.error('Enter the prescription number for Rx items');
        return;
      }
      if (needsRx && !String(pharmacyRx.patientName || '').trim()) {
        toast.error('Enter the patient name for Rx items');
        return;
      }
      if (pharmacySettings.controlledSaleRequiresNote !== false && needsControlledNote && !String(pharmacyRx.pharmacistNote || '').trim()) {
        toast.error('Enter a pharmacist note for controlled drugs');
        return;
      }
    }

    if (paymentMethod === 'khata' && khataAccountId) {
      try {
        await api.post(`/khata/${khataAccountId}/transactions`, {
          type: 'credit',
          amount: totals.grandTotal,
          notes: 'POS Checkout (Bakala)'
        });
        toast.success('Recorded in Khata');
      } catch (error) {
        toast.error('Failed to record Khata transaction');
        return; // Stop checkout if Khata transaction fails
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
        taxRate: taxEnabled ? item.taxRate : 0,
        taxAmount: taxEnabled ? (item.lineTotal * item.taxRate) / (100 + item.taxRate) : 0,
        lineTotal: taxEnabled ? item.lineTotal - ((item.lineTotal * item.taxRate) / (100 + item.taxRate)) : item.lineTotal,
        lineTotalWithTax: item.lineTotal,
        taxCategory: taxEnabled ? 'S' : 'O'
      })),
      subtotal: taxEnabled ? totals.subtotal : totals.grandTotal,
      totalTax: taxEnabled ? totals.taxAmount : 0,
      grandTotal: totals.grandTotal,
      paymentMethod,
      payments,
      khataAccountId,
      issueDate: new Date().toISOString(),
      ...(isPharmacy ? { pharmacyDispense: pharmacyRx } : {}),
    };

    await saveOfflineInvoice(invoice);
    clearCart();
    if (isPharmacy) {
      setPharmacyRx({ patientName: '', patientIdNumber: '', prescriptionNumber: '', prescriberName: '', pharmacistNote: '' });
    }

    // Get hardware + thermal settings
    const thermal = getThermalPrinterSettings(tenant);

    // Auto open cash drawer on cash payment
    const hasCashComponent = paymentMethod === 'cash' || (paymentMethod === 'split' && Array.isArray(payments) && payments.some(p => p.method === 'cash' && Number(p.amount) > 0));
    const shouldOpenDrawer = hasCashComponent && hw.openCashDrawerOnCashPayment !== false;
    let drawerOpened = false;
    if (shouldOpenDrawer) {
      const bridge = detectBridge();

      // 1. Try Android bridge dedicated openCashDrawer method
      if (bridge && bridge.methods.openCashDrawer) {
        try { await androidOpenCashDrawer(); drawerOpened = true; } catch (e) { console.error('Bridge cash drawer failed:', e); }
      }

      // 2. Try sending ESC/POS kick code via bridge raw/text print
      if (!drawerOpened && bridge && (bridge.methods.printRaw || bridge.methods.printText)) {
        try { await openCashDrawerViaRaw(hw.cashDrawerKickCode); drawerOpened = true; } catch (e) { console.error('Bridge raw kick code failed:', e); }
      }

      // 3. Try Android system print service — sends kick code through print dialog
      if (!drawerOpened && isAndroidDevice()) {
        try { await openCashDrawerViaSystemPrint(hw.cashDrawerKickCode); drawerOpened = true; } catch (e) { console.error('System print cash drawer failed:', e); }
      }

      // 4. Try WebUSB — direct USB connection to printer
      if (!drawerOpened && isWebUsbSupported()) {
        try { await openCashDrawerViaWebUSB(hw.cashDrawerKickCode); drawerOpened = true; } catch (e) { console.error('WebUSB cash drawer failed:', e); }
      }

      // 5. Try Web Serial API
      if (!drawerOpened && isWebSerialSupported()) {
        try { await openCashDrawerViaSerial(hw.cashDrawerKickCode); drawerOpened = true; } catch (e) { console.error('Web Serial cash drawer failed:', e); }
      }

      // 6. Try network backend ONLY for network printer type
      if (!drawerOpened && hw.receiptPrinterType === 'network' && hw.printerIpAddress) {
        try {
          await api.post('/tenants/test-cash-drawer', {
            ipAddress: hw.printerIpAddress,
            port: hw.printerPort,
            kickCode: hw.cashDrawerKickCode,
          });
          drawerOpened = true;
        } catch (err) {
          console.error('Network cash drawer failed:', err);
        }
      }

      if (!drawerOpened) {
        console.warn('Cash drawer could not be opened — kick code will be appended to receipt print');
      }
    }

    // Auto-print receipt: always for cash, otherwise only if autoPrint is enabled
    // Also respects bakala autoInvoicePrint setting — if disabled, never auto-print
    const shouldAutoPrint = autoInvoicePrint && (paymentMethod === 'cash' || thermal.autoPrint);
    // If drawer didn't open and should have, append kick code to receipt print
    const kickCodeForReceipt = (shouldOpenDrawer && !drawerOpened) ? hw.cashDrawerKickCode : null;
    if (shouldAutoPrint) {
      let printed = false;
      if (hw.receiptPrinterType === 'android' && isAndroidPos()) {
        const receiptText = buildAndroidReceiptText(invoice, paymentMethod, tenant, thermal);
        try { await androidPrintText(receiptText); printed = true; } catch (e) { console.error('Android bridge print failed:', e); }
      }
      if (!printed && (hw.receiptPrinterType === 'android_system_print' || isAndroidDevice())) {
        const html = buildAndroidReceiptHtml(invoice, paymentMethod, tenant, thermal, kickCodeForReceipt);
        try { await printViaSystemPrint(html); printed = true; } catch (e) { console.error('System print failed:', e); }
      }
      if (!printed && hw.receiptPrinterType === 'network' && hw.printerIpAddress) {
        try { await printReceiptESCPOS(invoice, paymentMethod, hw, thermal); printed = true; } catch (e) { console.error('Network print failed:', e); }
      }
      if (!printed) {
        // Last resort: browser print (opens new window)
        printReceipt(invoice, paymentMethod);
      }
    }
  };

  // Send ESC/POS receipt to network printer via backend
  const printReceiptESCPOS = async (order, paymentMethod, hw, thermal) => {
    const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS';
    const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مقدر نقاط البيع';
    const vatNumber = tenant?.business?.vatNumber || '';
    const dateStr = new Date().toLocaleString('en-US');
    const items = order.lineItems || [];
    const pmLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'card' ? 'Card' : paymentMethod === 'split' ? 'Split' : paymentMethod;

    const lines = [
      { type: 'center', bold: true, size: 'double', text: businessNameEn },
      { type: 'center', bold: true, text: businessNameAr },
      { type: 'center', text: 'SIMPLIFIED TAX INVOICE' },
    ];
    if (vatNumber) lines.push({ type: 'center', text: `VAT: ${vatNumber}` });
    lines.push({ text: '--------------------------------' });
    lines.push({ text: `Date: ${dateStr}` });
    lines.push({ text: `Payment: ${pmLabel}` });
    lines.push({ text: '--------------------------------' });
    lines.push({ bold: true, text: 'Item                    Total' });

    for (const item of items) {
      const name = (item.productName || item.productNameAr || 'Item').substring(0, 20);
      const total = Number(item.lineTotalWithTax || (item.unitPrice * item.quantity)).toFixed(2);
      lines.push({ text: `${name.padEnd(20)} ${total.padStart(8)}` });
    }

    lines.push({ text: '--------------------------------' });
    lines.push({ text: `Subtotal:       SAR ${Number(order.subtotal || 0).toFixed(2)}` });
    if (taxEnabled && Number(order.totalTax || 0) > 0) {
      lines.push({ text: `VAT (15%):      SAR ${Number(order.totalTax || 0).toFixed(2)}` });
    }
    lines.push({ bold: true, size: 'double', text: `TOTAL:          SAR ${Number(order.grandTotal || 0).toFixed(2)}` });

    if (thermal.showFooter) {
      lines.push({ type: 'center', text: thermal.footerTextEn || 'Thank you!' });
      lines.push({ type: 'center', text: thermal.footerTextAr || 'شكراً' });
    }
    lines.push({ text: '' });
    lines.push({ text: '' });

    try {
      await api.post('/tenants/print-receipt', {
        ipAddress: hw.printerIpAddress,
        port: hw.printerPort,
        receipt: { lines },
        openCashDrawer: false, // already opened above if needed
        encoding: thermal.encoding,
        paperWidth: thermal.paperWidth,
        cutAtEnd: thermal.cutAtEnd,
      });
    } catch (err) {
      console.error('ESC/POS print failed:', err);
      // Fallback to browser print
      printReceipt(order, paymentMethod);
    }
  };

  const buildAndroidReceiptText = (order, paymentMethod, tenant, thermal) => {
    const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS';
    const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مقدر نقاط البيع';
    const vatNumber = tenant?.business?.vatNumber || '';
    const address = tenant?.business?.address;
    const addressParts = address ? [address.buildingNumber, address.street, address.district, address.city].filter(Boolean) : [];
    const dateStr = new Date().toLocaleString('en-US');
    const items = order.lineItems || [];
    const chars = thermal.paperWidth === 58 ? 32 : 48;
    const pmLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'card' ? 'Card' : paymentMethod === 'split' ? 'Split' : paymentMethod === 'khata' ? 'Khata' : String(paymentMethod);
    const sep = '-'.repeat(chars);
    const invId = order.offlineId ? order.offlineId.substring(0, 8).toUpperCase() : 'N/A';
    const cashier = user?.name || user?.email || '';

    let text = '';
    text += businessNameEn + '\n';
    text += businessNameAr + '\n';
    if (addressParts.length) text += addressParts.join(', ') + '\n';
    if (vatNumber) text += 'VAT: ' + vatNumber + '\n';
    text += sep + '\n';
    text += 'Invoice: ' + invId + '\n';
    text += 'Date: ' + dateStr + '\n';
    if (cashier) text += 'Cashier: ' + cashier + '\n';
    text += 'Payment: ' + pmLabel + '\n';
    text += sep + '\n';

    for (const item of items) {
      const name = (item.productName || item.productNameAr || 'Item').substring(0, chars - 12);
      const price = (item.lineTotalWithTax || 0).toFixed(2);
      const qty = 'x' + (item.quantity || 1);
      text += name + '\n';
      text += '  ' + qty + ' @ ' + (item.unitPrice || 0).toFixed(2) + ' = SAR ' + price + '\n';
    }

    text += sep + '\n';
    text += 'Subtotal:    SAR ' + (order.subtotal || 0).toFixed(2) + '\n';
    if (taxEnabled) {
      text += 'VAT:         SAR ' + (order.totalTax || 0).toFixed(2) + '\n';
    }
    text += 'TOTAL:       SAR ' + (order.grandTotal || 0).toFixed(2) + '\n';
    text += sep + '\n';
    if (thermal.showFooter) {
      text += (thermal.footerTextEn || 'Thank you!') + '\n';
      text += (thermal.footerTextAr || 'شكراً') + '\n';
    }
    text += '\n\n\n';

    return text;
  };

  const buildAndroidReceiptHtml = (order, paymentMethod, tenant, thermal, appendKickCode) => {
    const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS';
    const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مقدر نقاط البيع';
    const vatNumber = tenant?.business?.vatNumber || '';
    const address = tenant?.business?.address;
    const addressParts = address ? [address.buildingNumber, address.street, address.district, address.city].filter(Boolean) : [];
    const addressText = addressParts.join(', ');
    const dateStr = new Date().toLocaleString('en-US');
    const items = order.lineItems || [];
    const pmLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'card' ? 'Card' : paymentMethod === 'split' ? 'Split' : paymentMethod === 'khata' ? 'Khata' : String(paymentMethod);
    const invId = order.offlineId ? order.offlineId.substring(0, 8).toUpperCase() : (order.invoiceNumber || 'N/A');
    const cashier = user?.name || user?.email || '';

    return buildReceiptHtml({
      businessName: businessNameEn,
      businessNameAr,
      vatNumber,
      address: addressText,
      date: dateStr,
      paymentMethod: pmLabel,
      paperWidth: thermal.paperWidth,
      invoiceId: invId,
      cashier,
      items: items.map(i => ({
        nameEn: i.productName || 'Item',
        nameAr: i.productNameAr || '',
        qty: String(i.quantity || 1),
        unitPrice: 'SAR ' + Number(i.unitPrice || 0).toFixed(2),
        price: 'SAR ' + Number(i.lineTotalWithTax || 0).toFixed(2),
      })),
      subtotal: 'SAR ' + Number(order.subtotal || 0).toFixed(2),
      tax: taxEnabled ? 'SAR ' + Number(order.totalTax || 0).toFixed(2) : '',
      total: 'SAR ' + Number(order.grandTotal || 0).toFixed(2),
      appendKickCode,
    });
  };

  const printReceipt = (order, paymentMethod = 'cash') => {
    const w = window.open('', '_blank', 'width=320,height=600,scrollbars=yes');
    if (!w) return;

    const businessNameEn = tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS';
    const businessNameAr = tenant?.business?.legalNameAr || tenant?.name || 'مقدر نقاط البيع';
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
      if (isZatcaApplicable) zatcaQrPayload = generateZatcaQrValue({
        sellerName: businessNameAr,
        vatNumber,
        timestamp: new Date().toISOString(),
        totalWithVat: order.grandTotal || 0,
        vatTotal: order.totalTax || 0
      });
      else if (isFbrApplicable && tenant?.fbr?.autoGenerateQr !== false) {
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
    <thead><tr><th>Item / الصنف</th><th style="text-align:center;">Qty / الكمية</th><th class="right">Total / المجموع</th></tr></thead>
    <tbody>
      ${items.map(item => {
        const displayName = escapeHtml(item.productName || item.productNameAr || item.name || item.nameAr || item.nameEn || 'Item');
        return `
        <tr>
          <td><div style="font-weight:bold;">${displayName}</div><span style="font-size:8px;color:#666;">SAR ${Number(item.unitPrice).toFixed(2)} x ${item.quantity}</span></td>
          <td style="text-align:center;">${item.quantity}</td>
          <td class="right">SAR ${Number(item.lineTotalWithTax || (item.unitPrice * item.quantity)).toFixed(2)}</td>
        </tr>
      `}).join('')}
    </tbody>
  </table>
  <div class="divider"></div>
  <div style="display:flex;justify-content:space-between;font-size:10px;"><span>Subtotal / المجموع الفرعي:</span><span>SAR ${Number(order.subtotal || 0).toFixed(2)}</span></div>
  ${taxEnabled ? `<div style="display:flex;justify-content:space-between;font-size:10px;"><span>VAT (15%) / ضريبة القيمة المضافة:</span><span>SAR ${Number(order.totalTax || 0).toFixed(2)}</span></div>` : ''}
  <div class="total" style="display:flex;justify-content:space-between;"><span>Total / الإجمالي:</span><span>SAR ${Number(order.grandTotal || 0).toFixed(2)}</span></div>
  ${zatcaQrPayload ? `
  <div class="qr">
    <div style="font-size:7px;color:#666;margin-bottom:2px;">${isFbrApplicable ? 'FBR | DIGITAL INVOICE' : 'ZATCA | هيئة الزكاة'}</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(zatcaQrPayload)}" />
  </div>
  ` : ''}
  <div class="divider"></div>
  <div class="center" style="font-size:9px; margin-top:6px;">Thank you for your visit! | شكراً لزيارتكم!</div>
  <div class="center" style="font-size:8px; color:#999;">Maqder POS</div>
  <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},500);},300);};</script>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch(e.key) {
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
    const actualClosing = window.prompt("Enter actual cash in till for End of Day:");
    if (actualClosing === null) return;

    try {
      await api.post(`/bakala/shift/close`, {
        actualClosingBalance: Number(actualClosing)
      });
      toast.success("Till closed successfully");
      setActiveSession(null);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to close till");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-[#F8F9FA] text-gray-900 overflow-hidden font-sans">
      
      {tenant?.settings?.bakala?.requireShift !== false && !activeSession && <PosSessions onSessionVerified={setActiveSession} />}

      {/* LEFT PANEL: Cart View (60%) */}
      <div className="order-2 lg:order-1 w-full lg:w-[60%] min-w-0 flex flex-col border-r border-gray-100 bg-white shadow-[2px_0_10px_rgba(0,0,0,0.02)] relative min-h-[40vh] lg:min-h-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(isPharmacy ? '/app/dashboard/pharmacy/products' : '/app/dashboard/bakala/dashboard')}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-gray-800">Current Order</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-500"><Server className="w-4 h-4"/> Online</span>
            ) : (
              <span className="flex items-center gap-1 text-rose-500"><WifiOff className="w-4 h-4"/> Offline Sync Mode</span>
            )}
            {pendingCount > 0 && <span className="text-amber-500">{pendingCount} Pending</span>}
            
            {activeSession && activeSession._id !== 'auto' && (
              <button 
                onClick={handleCloseSession}
                className="ml-4 flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg font-bold transition-colors"
              >
                <LogOut className="w-4 h-4" /> End of Day
              </button>
            )}
          </div>
        </div>

        {/* Cart Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <ShoppingCart className="w-20 h-20 mb-6 opacity-20" strokeWidth={1} />
              <p className="text-xl tracking-tight text-gray-400 font-light">Scan a product to begin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item, index) => (
                <div key={item.lineId || index} className="flex items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-800 truncate text-lg">{item.productName}</p>
                      {item.isWeighed && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold border border-emerald-100">
                          <Scale className="w-3 h-3" /> {item.weightLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 font-medium">
                      {item.isWeighed
                        ? `SAR ${(item.unitPrice || 0).toFixed(2)} / KG`
                        : item.primaryBarcode}
                    </p>
                  </div>

                  {item.isWeighed ? (
                    <div className="flex items-center mr-6">
                      <button onClick={() => removeItem(index)} className="w-10 h-10 flex items-center justify-center bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-500 shadow-sm transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 mr-6 bg-gray-50 rounded-xl p-1">
                      <button onClick={() => updateQuantity(index, item.quantity - 1)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-lg text-gray-600 shadow-sm transition-colors">
                        {item.quantity === 1 ? <Trash2 className="w-4 h-4 text-rose-400" /> : <Minus className="w-4 h-4" />}
                      </button>
                      <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                      <button onClick={() => updateQuantity(index, item.quantity + 1)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-gray-100 rounded-lg text-gray-600 shadow-sm transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="text-right w-24">
                    <p className="font-bold text-gray-900 text-lg">{(item.lineTotal || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">SAR</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Actions & Fast Menu (40%) */}
      <div className="order-1 lg:order-2 w-full lg:w-[40%] min-w-0 flex flex-col bg-[#F8F9FA] flex-1 min-h-[45vh] lg:min-h-0 overflow-hidden relative z-20">
        
        {/* Search Bar & Device Connection Status */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
            <h2 className="font-bold text-gray-700">Search Products</h2>
            <div className="flex items-center gap-2">
              {[
                { key: 'scanner', label: 'Scanner', icon: Smartphone, onClick: () => connectScanner(false) },
                { key: 'printer', label: 'Printer', icon: Printer, onClick: () => {
                  if (hw.receiptPrinterType === 'android' || hw.receiptPrinterType === 'android_system_print') {
                    connectPrinter();
                  } else if (deviceStatus.printer === 'connected') {
                    connectPrinter();
                  } else {
                    setShowPrinterConfig(true);
                  }
                }},
                { key: 'cashDrawer', label: 'Drawer', icon: Archive, onClick: connectCashDrawer },
              ].map(({ key, label, icon: Icon, onClick }) => {
                const status = deviceStatus[key];
                const isConnected = status === 'connected';
                const isChecking = status === 'checking';
                const isNotConfigured = status === 'not_configured';
                const isUnsupported = status === 'unsupported';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={onClick}
                    disabled={isChecking}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100'
                        : isChecking
                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : isNotConfigured || isUnsupported
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100'
                    }`}
                    title={isNotConfigured ? 'Not configured in Settings > Hardware' : isUnsupported ? 'Not supported in this browser' : isConnected ? 'Connected' : 'Click to connect'}
                  >
                    {isChecking ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : isNotConfigured || isUnsupported ? 'bg-gray-400' : 'bg-rose-500'}`} />
                        <Icon className="w-3 h-3" />
                      </>
                    )}
                    {isConnected ? label : isChecking ? 'Checking' : isNotConfigured ? `${label} Off` : isUnsupported ? 'N/A' : `Connect ${label}`}
                  </button>
                );
              })}
            </div>
          </div>

          {showPrinterConfig && (
            <div className="mb-3 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">
                  {(hw.receiptPrinterType === 'android' || hw.receiptPrinterType === 'android_system_print')
                    ? 'Printer Status'
                    : 'Configure Network Printer'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPrinterConfig(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              {(hw.receiptPrinterType === 'android' || hw.receiptPrinterType === 'android_system_print') ? (
                <div className="space-y-3">
                  <div className={`p-3 rounded-xl ${(hw.receiptPrinterType === 'android' && isAndroidPos()) || (hw.receiptPrinterType === 'android_system_print' && isAndroidDevice()) ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-center gap-2">
                      {(hw.receiptPrinterType === 'android' && isAndroidPos()) || (hw.receiptPrinterType === 'android_system_print' && isAndroidDevice()) ? (
                        <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-sm font-semibold text-emerald-700">Printer ready</span></>
                      ) : (
                        <><Smartphone className="w-4 h-4 text-amber-600" /><span className="text-sm font-semibold text-amber-700">Not detected on this device</span></>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {hw.receiptPrinterType === 'android'
                        ? 'Uses built-in JS bridge for direct ESC/POS printing.'
                        : 'Uses Android system print service. A print dialog will appear on checkout.'}
                    </p>
                    {(() => {
                      const bridge = detectBridge();
                      if (bridge) return <p className="text-xs text-gray-400 mt-1">Bridge: <code>{bridge.name}</code></p>;
                      return null;
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const thermal = getThermalPrinterSettings(tenant);
                      const html = buildReceiptHtml({
                        businessName: tenant?.business?.legalNameEn || tenant?.name || 'Maqder POS',
                        businessNameAr: tenant?.business?.legalNameAr || '',
                        paperWidth: thermal.paperWidth,
                        date: new Date().toLocaleString(),
                        items: [{ name: 'Test Item', price: 'SAR 1.00' }],
                        total: 'SAR 1.00',
                      });
                      try { await printViaSystemPrint(html); toast.success('Test print sent'); } catch (e) { toast.error('Print failed: ' + e.message); }
                    }}
                    className="px-4 py-2 bg-indigo-500 text-white text-sm font-bold rounded-lg hover:bg-indigo-600 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Test Print
                  </button>
                </div>
              ) : (
                <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Printer IP Address</label>
                  <input
                    type="text"
                    value={printerConfig.printerIpAddress}
                    onChange={(e) => setPrinterConfig((prev) => ({ ...prev, printerIpAddress: e.target.value }))}
                    className="input mt-1 w-full text-sm"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Port</label>
                  <input
                    type="number"
                    value={printerConfig.printerPort}
                    onChange={(e) => setPrinterConfig((prev) => ({ ...prev, printerPort: Number(e.target.value) || 0 }))}
                    className="input mt-1 w-full text-sm"
                    placeholder="9100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-500">Cash Drawer Kick Code (comma separated)</label>
                  <input
                    type="text"
                    value={printerConfig.cashDrawerKickCode}
                    onChange={(e) => setPrinterConfig((prev) => ({ ...prev, cashDrawerKickCode: e.target.value }))}
                    className="input mt-1 w-full text-sm"
                    placeholder="27,112,0,50,250"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrinterConfig(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePrinterConfig}
                  disabled={savingPrinterConfig}
                  className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingPrinterConfig && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save & Connect
                </button>
              </div>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleScannerSubmit} className="relative z-20">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Search by name or scan barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="relative z-20 w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-base font-medium text-gray-900 caret-emerald-600 transition-all"
              autoFocus
            />
          </form>
        </div>
        
        {/* Fast Grid Menu — Virtualized for 60fps with 1000+ products */}
        <div className="flex-1 px-6 pb-6 pt-2 overflow-hidden flex flex-col">
          {fastItems.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-10 rounded-2xl bg-white border border-gray-100">
              {searchTerm ? 'No products found matching your search.' : 'Type or scan a barcode to search for products.'}
            </div>
          ) : (
            <ProductGrid
              items={fastItems}
              onAddItem={(item) => {
                addPosItem(item);
                setSearchTerm('');
                barcodeInputRef.current?.focus();
              }}
            />
          )}
        </div>

        {lastSuggestTradingId && cartItems.length > 0 ? (
          <PosRelationStrip
            tradingProductId={lastSuggestTradingId}
            relationsBySource={relationsBySource}
            resolveAddable={(tradingId) => bakalaByTradingId.get(String(tradingId)) || null}
            onAdd={(bakalaProduct) => {
              if (bakalaProduct) addPosItem(bakalaProduct);
            }}
            language="en"
          />
        ) : null}

        {/* Summary Card */}
        <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-10 rounded-tl-3xl">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-gray-500 font-medium">
              <span>Subtotal</span>
              <span className="text-gray-700">SAR {(taxEnabled ? (totals.subtotal || 0) : (totals.grandTotal || 0)).toFixed(2)}</span>
            </div>
            {taxEnabled && (
            <div className="flex justify-between text-gray-500 font-medium">
              <span>VAT (15%)</span>
              <span className="text-gray-700">SAR {(totals.taxAmount || 0).toFixed(2)}</span>
            </div>
            )}
            <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-100">
              <span className="text-gray-400 font-bold uppercase tracking-widest text-sm">Total</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-emerald-600">SAR</span>
                <span className="text-5xl font-black tracking-tighter text-emerald-600">{(totals.grandTotal || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Drawer */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <button
              onClick={openWeighModal}
              className={`flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold transition-colors ${isPharmacy ? 'hidden' : ''}`}
            >
              <Scale className="w-4 h-4" /> Weigh
            </button>
            <button 
              onClick={() => holdBill('Walk-in')}
              disabled={cartItems.length === 0}
              className="flex items-center justify-center gap-2 p-3 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              Hold Bill
            </button>
            <button 
              onClick={() => {
                if (heldBills.length === 1) {
                  recallBill(heldBills[0].id);
                } else if (heldBills.length > 1) {
                  setShowRecallModal(true);
                }
              }}
              disabled={heldBills.length === 0}
              className="flex items-center justify-center gap-2 p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-bold transition-colors disabled:opacity-50 relative"
            >
              Recall Bill
              {heldBills.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center shadow-sm">
                  {heldBills.length}
                </span>
              )}
            </button>
          </div>

          {isPharmacy && (
            <div className="mb-3 grid grid-cols-1 gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 sm:grid-cols-2">
              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Patient name" value={pharmacyRx.patientName} onChange={(e) => setPharmacyRx((p) => ({ ...p, patientName: e.target.value }))} />
              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="National / Iqama ID" value={pharmacyRx.patientIdNumber} onChange={(e) => setPharmacyRx((p) => ({ ...p, patientIdNumber: e.target.value }))} />
              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Prescription number" value={pharmacyRx.prescriptionNumber} onChange={(e) => setPharmacyRx((p) => ({ ...p, prescriptionNumber: e.target.value }))} />
              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Prescriber" value={pharmacyRx.prescriberName} onChange={(e) => setPharmacyRx((p) => ({ ...p, prescriberName: e.target.value }))} />
              <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:col-span-2" placeholder="Pharmacist note (required for controlled drugs)" value={pharmacyRx.pharmacistNote} onChange={(e) => setPharmacyRx((p) => ({ ...p, pharmacistNote: e.target.value }))} />
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <button onClick={() => handleCheckout('cash')} className="flex flex-col items-center justify-center gap-1 p-3 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl font-bold transition-colors active:scale-95 shadow-sm shadow-emerald-200">
              <Wallet className="w-5 h-5" /> 
              <span className="text-xs">Cash</span>
            </button>
            <button 
              onClick={() => handleCheckout('card')}
              disabled={cartItems.length === 0}
              className="flex flex-col items-center justify-center gap-1 p-3 bg-[#0a192f] text-white hover:bg-[#112240] rounded-2xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >  
              <CreditCard className="w-5 h-5" /> 
              <span className="text-xs">Mada/Visa</span>
            </button>
            <button 
              onClick={() => setShowSplitModal(true)}
              disabled={cartItems.length === 0}
              className="flex flex-col items-center justify-center gap-1 p-3 bg-purple-500 text-white hover:bg-purple-600 rounded-2xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-purple-200"
            >  
              <RefreshCw className="w-5 h-5" /> 
              <span className="text-xs">Split Pay</span>
            </button>
            <button 
              onClick={handleOpenKhata}
              disabled={cartItems.length === 0}
              className="flex flex-col items-center justify-center gap-1 p-3 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-amber-200"
            >  
              <Users className="w-5 h-5" /> 
              <span className="text-xs">Khata</span>
            </button>
          </div>
        </div>
        
      </div>

      {/* Weight Scale Modal */}
      {showWeighModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-500" />
                Weigh &amp; Add to Bill
              </h2>
              <div className="flex items-center gap-3">
                {scalePort ? (
                  <button onClick={disconnectPosScale} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-all border border-emerald-100">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    Scale Live <Unplug className="w-3.5 h-3.5 opacity-60" />
                  </button>
                ) : (
                  <button onClick={connectPosScale} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50 transition-all border border-gray-200">
                    <Plug className="w-4 h-4 text-gray-400" /> Connect Scale
                  </button>
                )}
                <button onClick={() => setShowWeighModal(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm hover:shadow transition-all">
                  &times;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 flex-1 overflow-hidden">
              {/* Product Picker */}
              <div className="p-6 border-r border-gray-100 flex flex-col min-h-0">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">1. Select Item</label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={weighSearch}
                    onChange={(e) => setWeighSearch(e.target.value)}
                    placeholder="Search produce / weighed items..."
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-medium"
                    autoFocus
                  />
                </div>
                <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-2">
                  {weighProducts.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-10">No weighable products found.</div>
                  ) : (
                    weighProducts.map(p => (
                      <button
                        key={p._id}
                        onClick={() => setWeighProduct(p)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${weighProduct?._id === p._id ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-gray-100 bg-white hover:border-emerald-200'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-700 truncate pr-2">{p.name}</span>
                          <span className="text-sm font-bold text-emerald-600 shrink-0">SAR {(p.retailPrice || 0).toFixed(2)}<span className="text-gray-400 font-medium">/{p.unit || 'KG'}</span></span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Weight Entry */}
              <div className="p-6 flex flex-col justify-between bg-[#F8FAFC]">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">2. Enter Weight</label>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <div className="flex justify-end mb-2">
                      <div className="bg-gray-50 p-1 rounded-xl flex border border-gray-100">
                        {['KG', 'G'].map(u => (
                          <button
                            key={u}
                            onClick={() => setWeighUnit(u)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${weighUnit === u ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-baseline justify-center gap-3 border-b-4 border-gray-100 pb-4">
                      <input
                        type="text"
                        value={weighValue}
                        onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setWeighValue(e.target.value); }}
                        placeholder="0.000"
                        readOnly={!!scalePort}
                        className="text-6xl font-black text-gray-900 w-full text-center outline-none bg-transparent tracking-tighter"
                      />
                      <span className="text-2xl font-black text-gray-300 uppercase">{weighUnit}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Item</p>
                      <p className="font-bold text-gray-800 truncate max-w-[180px]">{weighProduct?.name || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Net Price</p>
                      <p className="text-4xl font-black text-emerald-500 tracking-tight">SAR {weighTotal.toFixed(2)}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAddWeighedToCart}
                    disabled={!weighProduct || !weighKg}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-lg transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Add to Bill
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Payment Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-purple-500" />
                Split Payment
              </h2>
              <button onClick={() => setShowSplitModal(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm hover:shadow transition-all">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 font-medium mb-1">Total to Pay</p>
                <p className="text-4xl font-black text-emerald-600 tracking-tight">SAR {totals.grandTotal.toFixed(2)}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Cash Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">SAR</span>
                    <input 
                      type="number" 
                      value={splitCash}
                      onChange={(e) => {
                        setSplitCash(e.target.value);
                        const remainder = totals.grandTotal - Number(e.target.value);
                        setSplitCard(remainder > 0 ? remainder.toFixed(2) : '0');
                      }}
                      className="w-full pl-14 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-xl font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Card (Mada/Visa) Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">SAR</span>
                    <input 
                      type="number" 
                      value={splitCard}
                      onChange={(e) => {
                        setSplitCard(e.target.value);
                        const remainder = totals.grandTotal - Number(e.target.value);
                        setSplitCash(remainder > 0 ? remainder.toFixed(2) : '0');
                      }}
                      className="w-full pl-14 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-xl font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    const cash = Number(splitCash);
                    const card = Number(splitCard);
                    if (Math.abs(cash + card - totals.grandTotal) > 0.01) {
                      toast.error('Split amounts must equal total');
                      return;
                    }
                    setShowSplitModal(false);
                    handleCheckout('split', [
                      { method: 'cash', amount: cash },
                      { method: 'card', amount: card }
                    ]);
                  }}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-purple-200 active:scale-95"
                >
                  Confirm Split Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recall Bill Modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Recall Held Bill
              </h2>
              <button onClick={() => setShowRecallModal(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm hover:shadow transition-all">
                &times;
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {heldBills.map((bill, index) => (
                <div key={bill.id} className="flex justify-between items-center p-4 border border-gray-100 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer bg-white"
                  onClick={() => {
                    recallBill(bill.id);
                    setShowRecallModal(false);
                  }}
                >
                  <div>
                    <h3 className="font-bold text-gray-800">Bill #{heldBills.length - index}</h3>
                    <p className="text-xs text-gray-500">{new Date(bill.createdAt || bill.time).toLocaleTimeString()}</p>
                    <p className="text-sm text-gray-600 mt-1">{bill.items.length} items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-600 text-xl">SAR {getBillTotal(bill).toFixed(2)}</p>
                    <button className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-sm font-bold transition-colors">
                      Recall
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Khata Checkout Modal */}
      {showKhataModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Select Khata Customer
              </h2>
              <button onClick={() => setShowKhataModal(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-white rounded-full shadow-sm hover:shadow transition-all">
                &times;
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 relative">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search by name or phone..."
                  value={khataSearch}
                  onChange={(e) => setKhataSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all font-medium"
                  autoFocus
                />
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-2">
                {loadingKhata ? (
                  <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-amber-500" /></div>
                ) : filteredKhataAccounts.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 font-medium">No customers found</div>
                ) : (
                  filteredKhataAccounts.map((acc) => (
                    <button
                      key={acc._id}
                      onClick={() => {
                        handleCheckout('khata', null, acc._id);
                        setShowKhataModal(false);
                      }}
                      className="w-full flex justify-between items-center p-4 border border-gray-100 rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-md transition-all text-left group"
                    >
                      <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-amber-700">{acc.customerId?.name}</h3>
                        <p className="text-xs text-gray-500 font-medium">{acc.customerId?.phone || acc.customerId?.mobile || 'No phone'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-gray-400">Balance</p>
                        <p className={`font-black tracking-tight ${acc.balance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          SAR {Math.abs(acc.balance).toFixed(2)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Total to charge</p>
                <p className="text-2xl font-black text-emerald-600">SAR {totals.grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
