import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Printer, Box, Camera, Save, Receipt, Wifi, Loader2, CheckCircle2, XCircle, Send, Usb, Bluetooth, Zap, Smartphone } from 'lucide-react';
import { useTranslation } from '../../lib/translations';
import { DEFAULT_THERMAL_SETTINGS, PRINTER_MODELS, applyPrinterModel } from '../../lib/thermalPrinter';
import { isAndroidPos, isAndroidDevice, detectBridge, getBridgeInfo, diagnoseBridge, isWebUsbSupported, isWebSerialSupported, testPrint as androidTestPrint, openCashDrawer as androidOpenCashDrawer, openCashDrawerViaRaw, openCashDrawerViaWebUSB, openCashDrawerViaSerial, openCashDrawerViaSystemPrint, printViaSystemPrint, buildReceiptHtml } from '../../lib/androidPosPrinter';
import api from '../../lib/api';

export default function HardwareSettings({ tenant, language, onSave, isSaving }) {
  const { t } = useTranslation(language);
  const [hardware, setHardware] = useState({
    receiptPrinterType: 'none',
    printerIpAddress: '192.168.1.100',
    printerPort: 9100,
    cashDrawerKickCode: '27,112,0,50,250',
    openCashDrawerOnCashPayment: true,
    barcodeScannerPrefix: '',
    barcodeScannerSuffix: 'Enter',
    scaleBarcodePrefix: '21',
    scaleType: 'none',
  });
  const [thermal, setThermal] = useState(DEFAULT_THERMAL_SETTINGS);

  useEffect(() => {
    if (tenant?.settings?.hardwareSettings) {
      setHardware(tenant.settings.hardwareSettings);
    }
    if (tenant?.settings?.thermalPrinter) {
      setThermal(prev => ({ ...prev, ...tenant.settings.thermalPrinter }));
    }
  }, [tenant]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setHardware(prev => ({ ...prev, [name]: value }));
  };

  const handleThermalChange = (e) => {
    const { name, value, type, checked } = e.target;
    setThermal(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value),
    }));
  };

  const handleSave = () => {
    onSave({ ...hardware }, thermal);
  };

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [drawerTesting, setDrawerTesting] = useState(false);
  const [drawerResult, setDrawerResult] = useState(null);
  const [printTesting, setPrintTesting] = useState(false);
  const [printResult, setPrintResult] = useState(null);
  const [usbTesting, setUsbTesting] = useState(false);
  const [usbResult, setUsbResult] = useState(null);
  const [btTesting, setBtTesting] = useState(false);
  const [btResult, setBtResult] = useState(null);
  const [androidTesting, setAndroidTesting] = useState(false);
  const [androidResult, setAndroidResult] = useState(null);
  const [androidDrawerTesting, setAndroidDrawerTesting] = useState(false);
  const [androidDrawerResult, setAndroidDrawerResult] = useState(null);
  const usbDeviceRef = useRef(null);
  const btCharacteristicRef = useRef(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/tenants/test-printer', {
        ipAddress: hardware.printerIpAddress,
        port: hardware.printerPort,
      });
      setTestResult({ success: true, message: res.data?.message || 'Connection successful' });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleTestUsbPrinter = async () => {
    setUsbTesting(true);
    setUsbResult(null);
    let device = null;
    let claimedInterface = null;
    try {
      if (!('usb' in navigator)) {
        throw new Error('WebUSB not supported in this browser. Use Chrome or Edge.');
      }
      device = await navigator.usb.requestDevice({
        filters: [
          { classCode: 7 },
          { classCode: 0xFF },
        ],
      });
      await device.open();

      let config = device.configuration;
      if (!config) {
        const configs = device.configurations;
        if (!configs || configs.length === 0) {
          throw new Error('No USB configurations available on this device');
        }
        config = configs[0];
        await device.selectConfiguration(config.configurationValue);
      }

      let targetInterface = null;
      let targetEndpointNumber = null;

      for (const iface of config.interfaces) {
        const alt = iface.alternate;
        if (!alt) continue;

        const isPrinterClass = alt.interfaceClass === 7;
        const hasBulkOut = (alt.endpoints || []).some(
          ep => ep.direction === 'out' && (ep.type === 'bulk' || ep.type === 'interrupt')
        );

        if (isPrinterClass || hasBulkOut) {
          try {
            if (iface.alternates && iface.alternates.length > 1) {
              await device.selectAlternateInterface(iface.interfaceNumber, alt.alternateSetting);
            }
            await device.claimInterface(iface.interfaceNumber);
            claimedInterface = iface.interfaceNumber;

            const outEp = (alt.endpoints || []).find(
              ep => ep.direction === 'out' && (ep.type === 'bulk' || ep.type === 'interrupt')
            );
            if (outEp) {
              targetInterface = iface.interfaceNumber;
              targetEndpointNumber = outEp.endpointNumber;
              break;
            }
          } catch (claimErr) {
            try { await device.releaseInterface(iface.interfaceNumber); } catch (_) { /* ignore */ }
            claimedInterface = null;
            continue;
          }
        }
      }

      if (targetInterface === null) {
        for (const iface of config.interfaces) {
          try {
            await device.claimInterface(iface.interfaceNumber);
            claimedInterface = iface.interfaceNumber;
            const alt = iface.alternate;
            const outEp = (alt?.endpoints || []).find(ep => ep.direction === 'out');
            if (outEp) {
              targetInterface = iface.interfaceNumber;
              targetEndpointNumber = outEp.endpointNumber;
              break;
            }
            await device.releaseInterface(iface.interfaceNumber);
            claimedInterface = null;
          } catch (_) {
            continue;
          }
        }
      }

      if (targetInterface === null || targetEndpointNumber === null) {
        throw new Error('No writable USB endpoint found on this device. The printer may be using a driver that blocks WebUSB access.');
      }

      const init = new Uint8Array([0x1B, 0x40]);
      const testData = new TextEncoder().encode(
        '*** USB TEST ***\nMaqder ERP\n' +
        new Date().toLocaleString() + '\n' +
        'Interface: ' + targetInterface + '\n' +
        'Endpoint: ' + targetEndpointNumber + '\n' +
        'Printer works!\n\n\n'
      );
      const cut = new Uint8Array([0x1B, 0x69]);
      const payload = new Uint8Array([...init, ...testData, ...cut]);

      await device.transferOut(targetEndpointNumber, payload);
      usbDeviceRef.current = device;
      setUsbResult({
        success: true,
        message: `Connected to ${device.productName || 'USB Printer'} (iface ${targetInterface}, ep ${targetEndpointNumber}) and test receipt sent`,
      });
    } catch (err) {
      setUsbResult({ success: false, message: err.message || 'Failed to connect to USB printer' });
    } finally {
      if (claimedInterface !== null && device && device.opened) {
        try { await device.releaseInterface(claimedInterface); } catch (_) { /* ignore */ }
      }
      setUsbTesting(false);
    }
  };

  const handleTestBluetoothPrinter = async () => {
    setBtTesting(true);
    setBtResult(null);
    try {
      if (!('bluetooth' in navigator)) {
        throw new Error('Web Bluetooth not supported in this browser. Use Chrome or Edge.');
      }
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '00001101-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
      });
      const server = await device.gatt.connect();

      let characteristic = null;
      const serviceUuids = ['000018f0-0000-1000-8000-00805f9b34fb', '00001101-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'];
      for (const sUuid of serviceUuids) {
        try {
          const service = await server.getPrimaryService(sUuid);
          const characteristics = await service.getCharacteristics();
          characteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
          if (characteristic) break;
        } catch (e) { /* try next */ }
      }

      if (!characteristic) {
        throw new Error('No writable characteristic found on this Bluetooth device');
      }

      const init = new Uint8Array([0x1B, 0x40]);
      const testData = new TextEncoder().encode('*** BT TEST ***\nMaqder ERP\n' + new Date().toLocaleString() + '\nPrinter works!\n\n\n');
      const cut = new Uint8Array([0x1B, 0x69]);
      const payload = new Uint8Array([...init, ...testData, ...cut]);

      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(payload);
      } else {
        await characteristic.writeValue(payload);
      }

      btCharacteristicRef.current = characteristic;
      setBtResult({ success: true, message: `Connected to ${device.name || 'Bluetooth Printer'} and test receipt sent` });
    } catch (err) {
      setBtResult({ success: false, message: err.message || 'Failed to connect to Bluetooth printer' });
    } finally {
      setBtTesting(false);
    }
  };

  const handleTestAndroidPrint = async () => {
    setAndroidTesting(true);
    setAndroidResult(null);
    try {
      const result = await androidTestPrint({
        businessName: tenant?.business?.legalNameEn || tenant?.name || '',
        businessNameAr: tenant?.business?.legalNameAr || '',
        paperWidth: thermal.paperWidth,
      });
      setAndroidResult(result);
    } catch (err) {
      setAndroidResult({ success: false, message: err.message || 'Failed to print via Android POS bridge' });
    } finally {
      setAndroidTesting(false);
    }
  };

  const handleTestSystemPrint = async () => {
    setAndroidTesting(true);
    setAndroidResult(null);
    try {
      const html = buildReceiptHtml({
        businessName: tenant?.business?.legalNameEn || tenant?.name || 'Maqder ERP',
        businessNameAr: tenant?.business?.legalNameAr || '',
        paperWidth: thermal.paperWidth,
        date: new Date().toLocaleString(),
        items: [
          { name: 'Item 1', price: 'SAR 10.00' },
          { name: 'Item 2', price: 'SAR 15.00' },
        ],
        subtotal: 'SAR 25.00',
        tax: 'SAR 0.00',
        total: 'SAR 25.00',
      });
      await printViaSystemPrint(html);
      setAndroidResult({ success: true, message: 'Print dialog triggered — select your built-in printer' });
    } catch (err) {
      setAndroidResult({ success: false, message: err.message || 'Failed to trigger system print' });
    } finally {
      setAndroidTesting(false);
    }
  };

  const handleTestAndroidCashDrawer = async () => {
    setAndroidDrawerTesting(true);
    setAndroidDrawerResult(null);
    try {
      await androidOpenCashDrawer();
      setAndroidDrawerResult({ success: true, message: 'Cash drawer opened via Android POS bridge' });
    } catch (err) {
      setAndroidDrawerResult({ success: false, message: err.message || 'Failed to open cash drawer' });
    } finally {
      setAndroidDrawerTesting(false);
    }
  };

  const handleTestAll = async () => {
    await handleSave();
    if (hardware.receiptPrinterType === 'network') {
      await handleTestConnection();
      await handleTestThermalPrint();
    } else if (hardware.receiptPrinterType === 'android') {
      await handleTestAndroidPrint();
    } else if (hardware.receiptPrinterType === 'android_system_print') {
      await handleTestSystemPrint();
    }
  };

  const handleTestCashDrawer = async () => {
    setDrawerTesting(true);
    setDrawerResult(null);

    const bridge = detectBridge();
    let opened = false;
    let lastError = null;

    // 1. Try Android bridge dedicated openCashDrawer
    if (bridge && bridge.methods.openCashDrawer) {
      try { await androidOpenCashDrawer(); opened = true; } catch (e) { lastError = e; }
    }

    // 2. Try sending ESC/POS kick code via bridge raw/text print
    if (!opened && bridge && (bridge.methods.printRaw || bridge.methods.printText)) {
      try { await openCashDrawerViaRaw(hardware.cashDrawerKickCode); opened = true; } catch (e) { lastError = e; }
    }

    // 3. Try Android system print service — sends kick code as raw text through print dialog
    if (!opened && isAndroidDevice()) {
      try {
        await openCashDrawerViaSystemPrint(hardware.cashDrawerKickCode);
        opened = true;
      } catch (e) { lastError = e; }
    }

    // 4. Try WebUSB — direct USB connection to printer
    if (!opened && isWebUsbSupported()) {
      try { await openCashDrawerViaWebUSB(hardware.cashDrawerKickCode); opened = true; } catch (e) { lastError = e; }
    }

    // 5. Try Web Serial API
    if (!opened && isWebSerialSupported()) {
      try { await openCashDrawerViaSerial(hardware.cashDrawerKickCode); opened = true; } catch (e) { lastError = e; }
    }

    // 6. Try network backend ONLY for network printer type
    if (!opened && hardware.receiptPrinterType === 'network' && hardware.printerIpAddress) {
      try {
        await api.post('/tenants/test-cash-drawer', {
          ipAddress: hardware.printerIpAddress,
          port: hardware.printerPort,
          kickCode: hardware.cashDrawerKickCode,
        });
        opened = true;
      } catch (err) { lastError = err; }
    }

    if (opened) {
      setDrawerResult({ success: true, message: 'Cash drawer command sent. Select your ESC/POS USB print service in the print dialog if prompted.' });
    } else {
      setDrawerResult({ success: false, message: lastError?.message || 'Could not open cash drawer. Make sure the printer is connected and turned on.' });
    }

    setDrawerTesting(false);
  };

  const handleTestThermalPrint = async () => {
    setPrintTesting(true);
    setPrintResult(null);
    try {
      const res = await api.post('/tenants/test-thermal-print', {
        ipAddress: hardware.printerIpAddress,
        port: hardware.printerPort,
        paperWidth: thermal.paperWidth,
        encoding: thermal.encoding,
        businessName: tenant?.business?.legalNameEn || tenant?.name || '',
        businessNameAr: tenant?.business?.legalNameAr || '',
      });
      setPrintResult({ success: true, message: res.data?.message || 'Test receipt printed successfully' });
    } catch (err) {
      setPrintResult({ success: false, message: err.response?.data?.error || err.message || 'Failed to print test receipt' });
    } finally {
      setPrintTesting(false);
    }
  };

  const handleModelChange = (modelKey) => {
    setThermal(prev => applyPrinterModel(modelKey, prev));
  };

  const Toggle = ({ name, label, desc }) => (
    <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700/50 rounded-xl cursor-pointer">
      <div>
        <span className="font-semibold text-sm">{label}</span>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <input type="checkbox" name={name} checked={thermal[name]} onChange={handleThermalChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 relative" />
    </label>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

      {/* Printer Size & Connection */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Printer className="w-5 h-5 text-indigo-500" />
          {language === 'ar' ? 'إعدادات الطابعة' : 'Printer Settings'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Printer Type */}
          <div>
            <label className="label">{language === 'ar' ? 'نوع الطابعة' : 'Printer Type'}</label>
            <select name="receiptPrinterType" value={hardware.receiptPrinterType} onChange={handleChange} className="select">
              <option value="none">{language === 'ar' ? 'بدون (طباعة المتصفح)' : 'None (Browser Print)'}</option>
              <option value="network">{language === 'ar' ? 'طابعة شبكة (ESC/POS)' : 'Network Printer (ESC/POS)'}</option>
              <option value="usb">{language === 'ar' ? 'طابعة USB' : 'USB Printer'}</option>
              <option value="bluetooth">{language === 'ar' ? 'طابعة بلوتوث' : 'Bluetooth Printer'}</option>
              <option value="android">{language === 'ar' ? 'جهاز POS أندرويد (مدمج)' : 'Android POS (Built-in)'}</option>
              <option value="android_system_print">{language === 'ar' ? 'طباعة نظام أندرويد' : 'Android System Print'}</option>
            </select>
          </div>

          {/* Printer Model */}
          <div>
            <label className="label">{language === 'ar' ? 'موديل الطابعة' : 'Printer Model'}</label>
            <select
              value={thermal.printerModel || 'generic_80'}
              onChange={(e) => handleModelChange(e.target.value)}
              className="select"
            >
              {Object.entries(PRINTER_MODELS).map(([key, model]) => (
                <option key={key} value={key}>
                  {language === 'ar' ? model.labelAr : model.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Paper Width — the main "size of printer" control */}
        <div className="mb-6">
          <label className="label">{language === 'ar' ? 'حجم الورق / عرض الطابعة' : 'Paper Size / Printer Width'}</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setThermal(prev => ({ ...prev, paperWidth: 58, charsPerLine: 32 }))}
              className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${thermal.paperWidth === 58 ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300'}`}
            >
              58mm
              <span className="block text-[10px] font-normal opacity-60">{language === 'ar' ? 'صغير' : 'Small'}</span>
            </button>
            <button
              type="button"
              onClick={() => setThermal(prev => ({ ...prev, paperWidth: 80, charsPerLine: 48 }))}
              className={`py-3 rounded-xl font-bold text-sm border-2 transition-all ${thermal.paperWidth === 80 ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-amber-300'}`}
            >
              80mm
              <span className="block text-[10px] font-normal opacity-60">{language === 'ar' ? 'قياسي' : 'Standard'}</span>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold">
              {thermal.paperWidth}mm
            </span>
            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold">
              {thermal.charsPerLine} {language === 'ar' ? 'عمود' : 'cols'}
            </span>
            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold">
              {thermal.dpi} DPI
            </span>
            <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold">
              {thermal.encoding}
            </span>
          </div>
        </div>

        {/* Connection Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hardware.receiptPrinterType === 'network' && (
            <>
              <div>
                <label className="label">{language === 'ar' ? 'عنوان IP للطابعة' : 'Printer IP Address'}</label>
                <input type="text" name="printerIpAddress" value={hardware.printerIpAddress} onChange={handleChange} className="input" placeholder="192.168.1.100" />
              </div>
              <div>
                <label className="label">{language === 'ar' ? 'منفذ الطابعة' : 'Printer Port'}</label>
                <input type="number" name="printerPort" value={hardware.printerPort} onChange={handleChange} className="input" placeholder="9100" />
              </div>
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="btn btn-outline text-sm"
                >
                  {testing ? (
                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> {language === 'ar' ? 'جاري الاختبار...' : 'Testing...'}</>
                  ) : (
                    <><Wifi className="w-4 h-4" /> {language === 'ar' ? 'اختبار الاتصال' : 'Test Connection'}</>
                  )}
                </button>
                {testResult && (
                  <div className={`mt-2 flex items-center gap-2 text-sm font-semibold ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {testResult.message}
                  </div>
                )}
              </div>
            </>
          )}

          {hardware.receiptPrinterType === 'usb' && (
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 mb-3">
                {language === 'ar' ? 'اضغط على زر الاختبار لاختيار طابعة USB متصلة وإرسال إيصال اختبار. يتطلب Chrome أو Edge.' : 'Click the test button to select a connected USB printer and send a test receipt. Requires Chrome or Edge.'}
              </p>
              <button
                type="button"
                onClick={handleTestUsbPrinter}
                disabled={usbTesting}
                className="btn btn-outline text-sm gap-2"
              >
                {usbTesting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري الاتصال...' : 'Connecting...'}</>
                ) : (
                  <><Usb className="w-4 h-4" /> {language === 'ar' ? 'اختبار طابعة USB' : 'Test USB Printer'}</>
                )}
              </button>
              {usbResult && (
                <div className={`mt-2 flex items-center gap-2 text-sm font-semibold ${usbResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {usbResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {usbResult.message}
                </div>
              )}
            </div>
          )}

          {hardware.receiptPrinterType === 'bluetooth' && (
            <div className="md:col-span-2">
              <label className="label">{language === 'ar' ? 'اسم جهاز البلوتوث' : 'Bluetooth Device Name'}</label>
              <input type="text" name="bluetoothDeviceName" value={hardware.bluetoothDeviceName || ''} onChange={handleChange} className="input" placeholder="" />
              <p className="text-xs text-gray-500 mt-1 mb-3">
                {language === 'ar' ? 'تأكد من اقتران الطابعة مع الجهاز أولاً' : 'Make sure the printer is paired with the device first'}
              </p>
              <button
                type="button"
                onClick={handleTestBluetoothPrinter}
                disabled={btTesting}
                className="btn btn-outline text-sm gap-2"
              >
                {btTesting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري الاتصال...' : 'Connecting...'}</>
                ) : (
                  <><Bluetooth className="w-4 h-4" /> {language === 'ar' ? 'اختبار طابعة البلوتوث' : 'Test Bluetooth Printer'}</>
                )}
              </button>
              {btResult && (
                <div className={`mt-2 flex items-center gap-2 text-sm font-semibold ${btResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {btResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {btResult.message}
                </div>
              )}
            </div>
          )}

          {hardware.receiptPrinterType === 'android' && (
            <div className="md:col-span-2 space-y-4">
              <div className={`p-4 rounded-xl ${isAndroidPos() ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {isAndroidPos() ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-amber-600" />}
                  <span className="font-semibold text-sm">
                    {isAndroidPos()
                      ? (language === 'ar' ? 'تم اكتشاف جسر الطابعة' : 'Printer bridge detected')
                      : (language === 'ar' ? 'لم يتم اكتشاف جسر الطابعة' : 'No printer bridge detected')}
                  </span>
                </div>
                {(() => {
                  const info = getBridgeInfo();
                  if (info) {
                    return (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {language === 'ar' ? 'الجسر: ' : 'Bridge: '}<code className="font-mono">{info.name}</code>
                        {info.methods.length > 0 && (
                          <span className="ml-2">{language === 'ar' ? 'الطرق: ' : 'Methods: '}{info.methods.join(', ')}</span>
                        )}
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {language === 'ar'
                        ? 'يجب فتح التطبيق داخل WebView الخاص بجهاز POS أندرويد لاستخدام الطابعة المدمجة.'
                        : 'You must open the app inside the Android POS device WebView to use the built-in printer.'}
                    </p>
                  );
                })()}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleTestAndroidPrint}
                  disabled={androidTesting}
                  className="btn btn-outline text-sm gap-2"
                >
                  {androidTesting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري الطباعة...' : 'Printing...'}</>
                  ) : (
                    <><Smartphone className="w-4 h-4" /> {language === 'ar' ? 'اختبار الطباعة' : 'Test Print'}</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleTestAndroidCashDrawer}
                  disabled={androidDrawerTesting}
                  className="btn btn-outline text-sm gap-2"
                >
                  {androidDrawerTesting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري الفتح...' : 'Opening...'}</>
                  ) : (
                    <><Box className="w-4 h-4" /> {language === 'ar' ? 'اختبار الدرج' : 'Test Cash Drawer'}</>
                  )}
                </button>
              </div>

              {androidResult && (
                <div className={`flex items-center gap-2 text-sm font-semibold ${androidResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {androidResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {androidResult.message}
                </div>
              )}
              {androidDrawerResult && (
                <div className={`flex items-center gap-2 text-sm font-semibold ${androidDrawerResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {androidDrawerResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {androidDrawerResult.message}
                </div>
              )}
            </div>
          )}

          {hardware.receiptPrinterType === 'android_system_print' && (
            <div className="md:col-span-2 space-y-4">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-sm">
                    {language === 'ar' ? 'طباعة نظام أندرويد' : 'Android System Print'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {language === 'ar'
                    ? 'يستخدم خدمة الطباعة الافتراضية في أندرويد. سيظهر مربع حوار الطباعة — اختر الطابعة المدمجة لجهاز POS.'
                    : 'Uses the Android default print service. A print dialog will appear — select your POS built-in printer.'}
                </p>
                {isAndroidDevice() && (
                  <p className="text-xs text-green-600 mt-1">
                    {language === 'ar' ? 'تم اكتشاف جهاز أندرويد' : 'Android device detected'}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleTestSystemPrint}
                disabled={androidTesting}
                className="btn btn-outline text-sm gap-2"
              >
                {androidTesting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري الإرسال...' : 'Sending...'}</>
                ) : (
                  <><Smartphone className="w-4 h-4" /> {language === 'ar' ? 'اختبار الطباعة' : 'Test Print'}</>
                )}
              </button>

              {androidResult && (
                <div className={`flex items-center gap-2 text-sm font-semibold ${androidResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {androidResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {androidResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-500" />
          {language === 'ar' ? 'تنسيق الإيصال' : 'Receipt Layout'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {language === 'ar'
            ? 'تنسيق الخط والهوامش والمحتوى للإيصالات الحرارية'
            : 'Font, margins, and content formatting for thermal receipts'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{language === 'ar' ? 'عدد الأعمدة' : 'Characters per Line'}</label>
            <input type="number" name="charsPerLine" min="24" max="64" value={thermal.charsPerLine} onChange={handleThermalChange} className="input" />
            <p className="text-xs text-gray-500 mt-1">
              {language === 'ar' ? '32 لورق 58mm، 48 لورق 80mm' : '32 for 58mm, 48 for 80mm'}
            </p>
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'حجم الخط (px)' : 'Font Size (px)'}</label>
            <select name="fontSize" value={thermal.fontSize} onChange={handleThermalChange} className="select">
              <option value={9}>9px — {language === 'ar' ? 'صغير' : 'Small'}</option>
              <option value={10}>10px — {language === 'ar' ? 'متوسط' : 'Medium'}</option>
              <option value={11}>11px — {language === 'ar' ? 'قياسي' : 'Standard'}</option>
              <option value={12}>12px — {language === 'ar' ? 'كبير' : 'Large'}</option>
              <option value={14}>14px — {language === 'ar' ? 'كبير جداً' : 'Extra Large'}</option>
            </select>
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'تباعد الأسطر' : 'Line Height'}</label>
            <select name="lineHeight" value={thermal.lineHeight} onChange={handleThermalChange} className="select">
              <option value={1.2}>1.2 — {language === 'ar' ? 'مضغوط' : 'Compact'}</option>
              <option value={1.4}>1.4 — {language === 'ar' ? 'عادي' : 'Normal'}</option>
              <option value={1.6}>1.6 — {language === 'ar' ? 'مريح' : 'Relaxed'}</option>
              <option value={1.8}>1.8 — {language === 'ar' ? 'واسع' : 'Spacious'}</option>
            </select>
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'الهامش الداخلي (mm)' : 'Padding (mm)'}</label>
            <select name="padding" value={thermal.padding} onChange={handleThermalChange} className="select">
              <option value={2}>2mm</option>
              <option value={3}>3mm</option>
              <option value={4}>4mm</option>
              <option value={5}>5mm</option>
            </select>
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'دقة الطباعة (DPI)' : 'Print Resolution (DPI)'}</label>
            <select name="dpi" value={thermal.dpi} onChange={handleThermalChange} className="select">
              <option value={203}>203 DPI — {language === 'ar' ? 'عادية' : 'Standard'}</option>
              <option value={300}>300 DPI — {language === 'ar' ? 'عالية' : 'High'}</option>
            </select>
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'كثافة الطباعة' : 'Print Darkness'}</label>
            <input type="range" name="darkness" min="1" max="5" value={thermal.darkness} onChange={handleThermalChange} className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{language === 'ar' ? 'فاتح' : 'Light'}</span>
              <span className="font-bold text-amber-600">{thermal.darkness}/5</span>
              <span>{language === 'ar' ? 'داكن' : 'Dark'}</span>
            </div>
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'عدد النسخ' : 'Receipt Copies'}</label>
            <input type="number" name="copies" min="1" max="5" value={thermal.copies} onChange={handleThermalChange} className="input" />
          </div>

          <div>
            <label className="label">{language === 'ar' ? 'ترميز النص (ESC/POS)' : 'Text Encoding (ESC/POS)'}</label>
            <select name="encoding" value={thermal.encoding} onChange={handleThermalChange} className="select">
              <option value="utf8">UTF-8</option>
              <option value="cp864">CP-864 (Arabic)</option>
              <option value="cp1256">CP-1256 (Windows Arabic)</option>
              <option value="iso8859-6">ISO 8859-6</option>
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <Toggle name="autoPrint" label={language === 'ar' ? 'طباعة تلقائية بعد الدفع' : 'Auto-print after checkout'} desc={language === 'ar' ? 'فتح نافذة الطباعة تلقائياً' : 'Open print dialog automatically'} />
          <Toggle name="showLogo" label={language === 'ar' ? 'إظهار الشعار' : 'Show Logo'} desc={language === 'ar' ? 'طباعة شعار الشركة على الإيصال' : 'Print company logo on receipt'} />
          <Toggle name="showQrCode" label={language === 'ar' ? 'إظهار رمز QR' : 'Show QR Code'} desc={language === 'ar' ? 'طباعة رمز ZATCA QR' : 'Print ZATCA QR code'} />
          <Toggle name="showFooter" label={language === 'ar' ? 'إظهار التذييل' : 'Show Footer'} desc={language === 'ar' ? 'رسالة شكر في أسفل الإيصال' : 'Thank you message at bottom'} />
          <Toggle name="cutAtEnd" label={language === 'ar' ? 'قص الورق في النهاية' : 'Paper Cut at End'} desc={language === 'ar' ? 'إرسال أمر قص الورق (ESC/POS)' : 'Send paper cut command (ESC/POS)'} />
          <Toggle name="beepOnComplete" label={language === 'ar' ? 'صوت تنبيه بعد الطباعة' : 'Beep after print'} desc={language === 'ar' ? 'إرسال صوت تنبيه (ESC/POS)' : 'Send beep command (ESC/POS)'} />
        </div>

        {thermal.showFooter && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{language === 'ar' ? 'نص التذييل (إنجليزي)' : 'Footer Text (English)'}</label>
              <input type="text" name="footerTextEn" value={thermal.footerTextEn} onChange={handleThermalChange} className="input" placeholder="Thank you for your visit!" />
            </div>
            <div>
              <label className="label">{language === 'ar' ? 'نص التذييل (عربي)' : 'Footer Text (Arabic)'}</label>
              <input type="text" name="footerTextAr" value={thermal.footerTextAr} onChange={handleThermalChange} className="input" placeholder="شكراً لزيارتكم!" dir="rtl" />
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-100 dark:bg-dark-800 rounded-xl">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{language === 'ar' ? 'معاينة' : 'Preview'}</p>
          <div
            className="bg-white text-black mx-auto font-mono border border-gray-200"
            style={{
              width: `${thermal.paperWidth}mm`,
              padding: `${thermal.padding}mm`,
              fontSize: `${thermal.fontSize}px`,
              lineHeight: thermal.lineHeight,
              boxSizing: 'border-box',
            }}
          >
            {thermal.showLogo && <div className="text-center mb-2 text-gray-400 text-[8px]">[ LOGO ]</div>}
            <div className="text-center font-bold">Business Name</div>
            <div className="text-center text-gray-500">اسم الشركة</div>
            <div className="border-t border-dashed border-gray-300 my-2"></div>
            <div className="flex justify-between"><span>Item 1</span><span>SAR 10.00</span></div>
            <div className="flex justify-between"><span>Item 2</span><span>SAR 15.00</span></div>
            <div className="border-t border-dashed border-gray-300 my-2"></div>
            <div className="flex justify-between font-bold"><span>Total</span><span>SAR 25.00</span></div>
            {thermal.showQrCode && <div className="text-center mt-2 text-gray-400 text-[8px]">[ QR CODE ]</div>}
            {thermal.showFooter && (
              <div className="text-center mt-2 text-gray-500 text-[9px]">
                <p>{thermal.footerTextEn}</p>
                <p>{thermal.footerTextAr}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cash Drawer Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Box className="w-5 h-5 text-emerald-500" />
          {language === 'ar' ? 'درج النقود' : 'Cash Drawer'}
        </h3>

        {/* Connection info */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
          {language === 'ar'
            ? 'الدرج متصل بالطابعة عبر كابل RJ-11 (مثل كابل الهاتف). يتم إرسال كود الفتح عبر الطابعة إلى الدرج.'
            : 'The cash drawer connects to the printer via RJ-11 cable (telephone-like cable). The kick code is sent through the printer to the drawer.'}
        </div>

        {/* Bridge status & diagnostics */}
        {(() => {
          const diag = diagnoseBridge();
          const bridge = detectBridge();
          const webusb = isWebUsbSupported();
          const webserial = isWebSerialSupported();
          if (bridge) {
            const methods = [];
            if (bridge.methods.openCashDrawer) methods.push('openCashDrawer');
            if (bridge.methods.printRaw) methods.push('printRaw');
            if (bridge.methods.printText) methods.push('printText');
            return (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs text-green-700 dark:text-green-300">
                <div className="font-semibold">{language === 'ar' ? 'الجسر متصل' : 'Bridge detected'}</div>
                <div>{language === 'ar' ? 'الاسم' : 'Name'}: {bridge.name}</div>
                <div>{language === 'ar' ? 'الطرق' : 'Methods'}: {methods.join(', ') || 'none'}</div>
              </div>
            );
          } else if (diag.platform === 'android') {
            return (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-2">
                <div className="font-semibold">{language === 'ar' ? 'طباعة النظام Android' : 'Android System Print'}</div>
                <div>{language === 'ar'
                  ? 'سيتم استخدام خدمة طباعة Android لإرسال كود فتح الدرج. اضغط "اختبار فتح الدرج" واختر خدمة طباعة ESC/POS USB.'
                  : 'Cash drawer will use the Android system print service to send the kick code. Click "Test Open Drawer" and select your ESC/POS USB print service.'}</div>
                <div>WebUSB: {webusb ? '✅' : '❌'} | Serial: {webserial ? '✅' : '❌'}</div>
              </div>
            );
          }
          return null;
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{language === 'ar' ? 'كود فتح الدرج' : 'Kick Code (Decimal)'}</label>
            <input type="text" name="cashDrawerKickCode" value={hardware.cashDrawerKickCode} onChange={handleChange} className="input" placeholder="27,112,0,50,250" />
            <p className="text-xs text-gray-500 mt-1">
              {language === 'ar' ? 'الكود الافتراضي لطابعات Epson/Star' : 'Default ESC/POS kick code for Epson/Star printers.'}
            </p>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleTestCashDrawer}
              disabled={drawerTesting}
              className="btn btn-outline text-sm gap-2"
            >
              {drawerTesting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري الفتح...' : 'Opening...'}</>
              ) : (
                <><Box className="w-4 h-4" /> {language === 'ar' ? 'اختبار فتح الدرج' : 'Test Open Drawer'}</>
              )}
            </button>
          </div>
        </div>

        {/* Auto-open cash drawer on cash payment */}
        <label className="mt-4 flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-700/50 rounded-xl cursor-pointer">
          <div>
            <span className="font-semibold text-sm">
              {language === 'ar' ? 'فتح الدرج تلقائياً عند الدفع النقدي' : 'Auto-open drawer on cash payment'}
            </span>
            <p className="text-xs text-gray-500">
              {language === 'ar' ? 'يفتح درج النقود تلقائياً بعد كل عملية دفع نقدي' : 'Automatically opens the cash drawer after each cash checkout'}
            </p>
          </div>
          <input
            type="checkbox"
            name="openCashDrawerOnCashPayment"
            checked={hardware.openCashDrawerOnCashPayment ?? true}
            onChange={(e) => setHardware(prev => ({ ...prev, openCashDrawerOnCashPayment: e.target.checked }))}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 relative" />
        </label>
        {drawerResult && (
          <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${drawerResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {drawerResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {drawerResult.message}
          </div>
        )}
      </div>

      {/* Scanner / Scale Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5 text-rose-500" />
          {language === 'ar' ? 'قارئ الباركود والميزان' : 'Barcode Scanner & Scale'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">{language === 'ar' ? 'بادئة الباركود (إن وجدت)' : 'Scanner Prefix (If any)'}</label>
            <input type="text" name="barcodeScannerPrefix" value={hardware.barcodeScannerPrefix} onChange={handleChange} className="input" />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'لاحقة الباركود' : 'Scanner Suffix'}</label>
            <input type="text" name="barcodeScannerSuffix" value={hardware.barcodeScannerSuffix} onChange={handleChange} className="input" placeholder="Enter" />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'بادئة باركود الميزان' : 'Scale Barcode Prefix'}</label>
            <input type="text" name="scaleBarcodePrefix" value={hardware.scaleBarcodePrefix || '21'} onChange={handleChange} className="input" placeholder="21" />
          </div>
          <div>
            <label className="label">{language === 'ar' ? 'تكامل الميزان' : 'Scale Integration'}</label>
            <select name="scaleType" value={hardware.scaleType} onChange={handleChange} className="select">
              <option value="none">{language === 'ar' ? 'بدون ميزان متصل' : 'No connected scale'}</option>
              <option value="barcode">{language === 'ar' ? 'باركود الميزان (مثل بنده)' : 'Weight Barcode (Weight embedded)'}</option>
              <option value="serial">{language === 'ar' ? 'ميزان تسلسلي (Serial/COM)' : 'Serial Port Scale'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Test Print Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-500" />
          {language === 'ar' ? 'اختبار الطباعة الحرارية' : 'Thermal Printer Test Print'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {language === 'ar'
            ? 'أرسل إيصال اختبار إلى الطابعة الحرارية للتحقق من عملها بشكل صحيح.'
            : 'Send a test receipt to the thermal printer to verify it is working correctly.'}
        </p>
        <button
          type="button"
          onClick={handleTestThermalPrint}
          disabled={printTesting || hardware.receiptPrinterType !== 'network'}
          className="btn btn-outline text-sm gap-2"
        >
          {printTesting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {language === 'ar' ? 'جاري الطباعة...' : 'Printing...'}</>
          ) : (
            <><Send className="w-4 h-4" /> {language === 'ar' ? 'إرسال إيصال اختبار' : 'Send Test Receipt'}</>
          )}
        </button>
        {printResult && (
          <div className={`mt-3 flex items-center gap-2 text-sm font-semibold ${printResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {printResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {printResult.message}
          </div>
        )}
        {hardware.receiptPrinterType !== 'network' && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {language === 'ar'
              ? 'اختبار الطباعة يتطلب طابعة شبكة متصلة (ESC/POS).'
              : 'Test print requires a connected network printer (ESC/POS).'}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        {(hardware.receiptPrinterType === 'network' || hardware.receiptPrinterType === 'android' || hardware.receiptPrinterType === 'android_system_print') && (
          <button onClick={handleTestAll} disabled={testing || printTesting || androidTesting || isSaving} className="btn btn-outline text-sm gap-2">
            {(testing || printTesting || androidTesting) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {language === 'ar' ? 'اختبار الكل وحفظ' : 'Test All & Save'}
          </button>
        )}
        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
          {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t('save')}</>}
        </button>
      </div>

    </motion.div>
  );
}
