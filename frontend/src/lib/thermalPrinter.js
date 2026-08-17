/**
 * Shared thermal printer settings helper.
 * Reads from tenant.settings.thermalPrinter and provides sensible defaults.
 */

export const DEFAULT_THERMAL_SETTINGS = {
  printerModel: 'generic_80', // printer model preset key
  paperWidth: 80,       // 58 or 80 (mm)
  charsPerLine: 48,     // character columns (32 for 58mm, 48 for 80mm)
  dpi: 203,             // print resolution (203 or 300)
  fontSize: 11,         // base font size in px
  lineHeight: 1.4,      // line height multiplier
  padding: 4,           // padding in mm
  autoPrint: false,     // auto-open print dialog after checkout
  showLogo: true,       // print logo on receipt
  showQrCode: true,     // print ZATCA QR code
  showFooter: true,     // print footer message
  footerTextEn: 'Thank you for your visit!',
  footerTextAr: 'شكراً لزيارتكم!',
  cutAtEnd: true,       // send paper cut command (for ESC/POS)
  copies: 1,            // number of receipt copies
  encoding: 'utf8',     // text encoding for ESC/POS
  darkness: 2,          // print darkness 1-5 (ESC/POS)
  beepOnComplete: false, // beep after print
};

/**
 * Printer model presets.
 * Each preset auto-configures paper width, chars per line, DPI, and encoding.
 */
export const PRINTER_MODELS = {
  generic_80: {
    label: 'Generic 80mm Thermal',
    labelAr: 'طابعة حرارية 80mm',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'utf8',
  },
  generic_58: {
    label: 'Generic 58mm Thermal',
    labelAr: 'طابعة حرارية 58mm',
    paperWidth: 58,
    charsPerLine: 32,
    dpi: 203,
    encoding: 'utf8',
  },
  epson_tm_t20: {
    label: 'Epson TM-T20 (80mm)',
    labelAr: 'Epson TM-T20 (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'utf8',
  },
  epson_tm_t88: {
    label: 'Epson TM-T88VI (80mm)',
    labelAr: 'Epson TM-T88VI (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 300,
    encoding: 'utf8',
  },
  star_tsp100: {
    label: 'Star TSP100III (80mm)',
    labelAr: 'Star TSP100III (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'utf8',
  },
  star_tsp143: {
    label: 'Star TSP143IIIW (80mm)',
    labelAr: 'Star TSP143IIIW (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'utf8',
  },
  xprinter_xp58: {
    label: 'Xprinter XP-58IIH (58mm)',
    labelAr: 'Xprinter XP-58IIH (58mm)',
    paperWidth: 58,
    charsPerLine: 32,
    dpi: 203,
    encoding: 'cp864',
  },
  xprinter_xp80: {
    label: 'Xprinter XP-80IIH (80mm)',
    labelAr: 'Xprinter XP-80IIH (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'cp864',
  },
  gprinter_gp58: {
    label: 'Goojprt GP-58 (58mm)',
    labelAr: 'Goojprt GP-58 (58mm)',
    paperWidth: 58,
    charsPerLine: 32,
    dpi: 203,
    encoding: 'cp864',
  },
  gprinter_gp80: {
    label: 'Goojprt GP-80 (80mm)',
    labelAr: 'Goojprt GP-80 (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'cp864',
  },
  citizen_cts310: {
    label: 'Citizen CT-S310II (80mm)',
    labelAr: 'Citizen CT-S310II (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'utf8',
  },
  rongta_rp80: {
    label: 'Rongta RP-80USE (80mm)',
    labelAr: 'Rongta RP-80USE (80mm)',
    paperWidth: 80,
    charsPerLine: 48,
    dpi: 203,
    encoding: 'cp864',
  },
};

/**
 * Apply a printer model preset to thermal settings.
 * Updates paperWidth, charsPerLine, dpi, and encoding from the model.
 * @param {string} modelKey - Key from PRINTER_MODELS.
 * @param {object} currentThermal - Current thermal settings.
 * @returns {object} Updated thermal settings.
 */
export function applyPrinterModel(modelKey, currentThermal) {
  const model = PRINTER_MODELS[modelKey];
  if (!model) return currentThermal;
  return {
    ...currentThermal,
    printerModel: modelKey,
    paperWidth: model.paperWidth,
    charsPerLine: model.charsPerLine,
    dpi: model.dpi,
    encoding: model.encoding,
  };
}

/**
 * Get thermal printer settings from tenant, merged with defaults.
 * @param {object} tenant - The tenant object from Redux state or API.
 * @returns {object} Merged settings.
 */
export function getThermalPrinterSettings(tenant) {
  const saved = tenant?.settings?.thermalPrinter || {};
  return { ...DEFAULT_THERMAL_SETTINGS, ...saved };
}

/**
 * Get the CSS width string for the current paper width.
 * @param {object} settings - Thermal printer settings (from getThermalPrinterSettings).
 * @returns {string} e.g. '80mm' or '58mm'
 */
export function getPaperWidth(settings) {
  return `${settings.paperWidth}mm`;
}

/**
 * Get the CSS padding string.
 * @param {object} settings
 * @returns {string} e.g. '4mm'
 */
export function getPaperPadding(settings) {
  return `${settings.padding}mm`;
}

/**
 * Get inline style object for a thermal receipt container.
 * @param {object} settings - Thermal printer settings.
 * @returns {object} React style object.
 */
export function getReceiptStyle(settings) {
  return {
    width: getPaperWidth(settings),
    padding: getPaperPadding(settings),
    boxSizing: 'border-box',
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
  };
}

/**
 * Print a thermal receipt element or HTML in a dedicated, isolated iframe.
 * Avoids all SPA/Tailwind/overflow/modal clipping issues that cause blank white pages.
 * 
 * @param {HTMLElement|string} elementOrHtml - The DOM element or HTML string to print.
 * @param {object} [settings] - Optional thermal settings (e.g. paperWidth: 80).
 * @returns {Promise<boolean>}
 */
export function printThermalElement(elementOrHtml, settings = DEFAULT_THERMAL_SETTINGS) {
  return new Promise((resolve) => {
    try {
      const paperWidth = settings.paperWidth ? `${settings.paperWidth}mm` : '80mm';
      const padding = settings.padding ? `${settings.padding}mm` : '3mm';
      const fontSize = settings.fontSize || 11;
      const lineHeight = settings.lineHeight || 1.35;

      let contentHtml = '';
      if (typeof elementOrHtml === 'string') {
        contentHtml = elementOrHtml;
      } else if (elementOrHtml && elementOrHtml.outerHTML) {
        contentHtml = elementOrHtml.outerHTML;
      } else {
        console.warn('printThermalElement: Invalid element provided, aborting.');
        resolve(false);
        return;
      }

      // *** GUARD: Check if content is empty before opening print dialog (prevents blank white page)
      const rawText = contentHtml.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, '').trim();
      const hasMedia = /<(img|svg|canvas)/i.test(contentHtml);
      if (!rawText && !hasMedia) {
        console.warn('printThermalElement: Content is empty, aborting print to avoid blank page.');
        resolve(false);
        return;
      }

      // Strip all embedded <style> tags from the source element
      contentHtml = contentHtml.replace(/<style[\s\S]*?<\/style>/gi, '');

      // Remove any existing print iframes
      const existingIframe = document.getElementById('maqder-thermal-print-frame');
      if (existingIframe) {
        try { document.body.removeChild(existingIframe); } catch (_) {}
      }

      // Create isolated invisible iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'maqder-thermal-print-frame';
      iframe.setAttribute('style', 'position: fixed; top: -9999px; left: -9999px; width: 0; height: 0; border: 0; visibility: hidden;');
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        window.print();
        resolve(true);
        return;
      }

      const htmlDir = document.documentElement.getAttribute('dir') || 'ltr';
      const fullHtml = `<!DOCTYPE html>
<html dir="${htmlDir}">
<head>
  <meta charset="utf-8" />
  <title>Thermal Receipt</title>
  <style>
    @page {
      size: auto;
      margin: 0mm !important;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
      width: ${paperWidth} !important;
      max-width: ${paperWidth} !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Tajawal', 'Helvetica Neue', Arial, sans-serif !important;
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      visibility: visible !important;
    }
    body * {
      visibility: visible !important;
      opacity: 1 !important;
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    @media print {
      html, body {
        width: ${paperWidth} !important;
        margin: 0 auto !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Tajawal', 'Helvetica Neue', Arial, sans-serif !important;
      }
      body * {
        visibility: visible !important;
        opacity: 1 !important;
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
      }
    }
    .print-section, .order-receipt, .thermal-receipt, .kitchen-ticket {
      width: 100% !important;
      max-width: ${paperWidth} !important;
      padding: ${padding} !important;
      margin: 0 auto !important;
      background: #ffffff !important;
      color: #000000 !important;
      border: none !important;
      box-shadow: none !important;
      display: block !important;
      position: static !important;
      visibility: visible !important;
      opacity: 1 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Cairo', 'Tajawal', 'Helvetica Neue', Arial, sans-serif !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-row { flex-direction: row !important; }
    .justify-between { justify-content: space-between !important; }
    .justify-center { justify-content: center !important; }
    .items-center { align-items: center !important; }
    .text-center { text-align: center !important; }
    .text-left { text-align: left !important; }
    .text-right { text-align: right !important; }
    .font-mono { font-variant-numeric: tabular-nums !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-bold { font-weight: 700 !important; }
    .font-extrabold, .font-black { font-weight: 900 !important; }
    .w-full { width: 100% !important; }
    .border { border: 1px solid #000 !important; }
    .border-2 { border: 2px solid #000 !important; }
    .border-t { border-top: 1px solid #000 !important; }
    .border-b { border-bottom: 1px solid #000 !important; }
    .border-t-2 { border-top: 2px solid #000 !important; }
    .border-b-2 { border-bottom: 2px solid #000 !important; }
    .border-dashed { border-style: dashed !important; }
    .rounded { border-radius: 4px !important; }
    .uppercase { text-transform: uppercase !important; }
    .my-1 { margin-top: 4px !important; margin-bottom: 4px !important; }
    .my-2 { margin-top: 8px !important; margin-bottom: 8px !important; }
    .py-1 { padding-top: 4px !important; padding-bottom: 4px !important; }
    .py-2 { padding-top: 8px !important; padding-bottom: 8px !important; }
    .px-2 { padding-left: 8px !important; padding-right: 8px !important; }
    .px-3 { padding-left: 10px !important; padding-right: 10px !important; }
    .text-xs { font-size: 11px !important; }
    .text-sm { font-size: 13px !important; }
    .text-base { font-size: 14px !important; }
    .text-lg { font-size: 16px !important; }
    .text-xl { font-size: 18px !important; }
    img {
      max-width: 100% !important;
      height: auto !important;
      display: block;
      margin: 0 auto;
    }
    svg {
      display: block !important;
      margin: 0 auto !important;
      max-width: 100% !important;
    }
    .dark, [class*="dark:"] { color: #000 !important; background: transparent !important; }
    [class*="text-white"] { color: #000000 !important; }
    [class*="bg-gray"], [class*="bg-slate"], [class*="bg-dark"] { background: transparent !important; }
    hr, .divider, [class*="border-dashed"] { border-color: #333 !important; border-top-color: #333 !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #fff; color: #000; width: ${paperWidth};">
  ${contentHtml}
</body>
</html>`;

      doc.open();
      doc.write(fullHtml);
      doc.close();

      const triggerIframePrint = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          // Clean up iframe after user completes print
          setTimeout(() => {
            try {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            } catch (_) {}
            resolve(true);
          }, 30000);
        } catch (e) {
          console.error('Iframe print failed, falling back to window.print:', e);
          window.print();
          resolve(true);
        }
      };

      if (iframe.contentDocument?.readyState === 'complete') {
        setTimeout(triggerIframePrint, 350);
      } else {
        iframe.onload = () => setTimeout(triggerIframePrint, 350);
        setTimeout(triggerIframePrint, 800);
      }
    } catch (err) {
      console.error('printThermalElement error:', err);
      resolve(false);
    }
  });
}

/**
 * Get print CSS for a given class name and settings.
 * @param {string} className - The CSS class used on the receipt container.
 * @param {object} settings - Thermal printer settings.
 * @returns {string} CSS string for @media print block.
 */
export function getPrintCss(className, settings) {
  const width = getPaperWidth(settings);
  const padding = getPaperPadding(settings);
  return `
    @media print {
      .${className} {
        width: ${width} !important;
        padding: ${padding} !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border: none !important;
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
      }
      .${className}, .${className} * {
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      /* NOTE: Do NOT add "body * { visibility: hidden }" here.
         That rule is only valid for window.print() page isolation.
         When used inside printThermalElement (iframe), it hides all content → blank page. */
    }
  `;
}

/**
 * Get the @page CSS string for thermal printing.
 * @param {object} settings
 * @returns {string}
 */
export function getPageCss(settings) {
  return `@page { size: ${getPaperWidth(settings)} auto; margin: 0; }`;
}

/**
 * Get the body width CSS for inline HTML receipts (e.g. window.open() receipts).
 * @param {object} settings
 * @returns {string}
 */
export function getBodyWidthCss(settings) {
  const width = getPaperWidth(settings);
  return `body { margin: 0; padding: 8px; font-family: monospace; font-size: ${settings.fontSize}px; background: white; color: black; width: ${width}; }`;
}


