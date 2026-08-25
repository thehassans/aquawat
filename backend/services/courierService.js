/**
/**
 * Courier provider adapters for shipping labels and tracking.
 * Each adapter implements:
 *   - createShipment({ order, customer, items, config })
 *   - trackShipment(trackingNumber, config)
 *   - cancelShipment(shipmentId, config)
 */

// --- SMSA Express ---
const smsaAdapter = {
  async createShipment({ order, customer, items, config }) {
    const baseUrl = config.environment === 'production'
      ? 'https://ecomapis.smsaexpress.com/api/v1/shipments'
      : 'https://ecomapis.smsaexpress.com/api/v1/shipments';
    const body = {
      refNo: order.orderNumber,
      shipperName: config.accountNumber || 'Store',
      consigneeName: customer.name,
      consigneeMobile: customer.phone,
      consigneeAddress: customer.addressLine1,
      consigneeCity: customer.city,
      consigneeCountry: customer.country || 'SA',
      codAmount: order.payment?.method === 'cod' ? order.grandTotal : 0,
      weight: items.reduce((sum, i) => sum + (i.weight || 0), 0),
      pcs: items.length,
      descr: items.map(i => i.productTitle).join(', '),
    };
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`SMSA error: ${res.status}`);
    const data = await res.json();
    return {
      trackingNumber: data.awbNo || data.trackingNumber || '',
      shipmentId: data.awbNo || '',
      labelUrl: data.labelUrl || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const res = await fetch(`https://ecomapis.smsaexpress.com/api/v1/track/${trackingNumber}`, {
      headers: { 'API-Key': config.apiKey },
    });
    if (!res.ok) throw new Error(`SMSA track error: ${res.status}`);
    const data = await res.json();
    return {
      status: data.status || 'unknown',
      events: data.events || [],
      raw: data,
    };
  },

  async cancelShipment(shipmentId, config) {
    const res = await fetch(`https://ecomapis.smsaexpress.com/api/v1/shipments/${shipmentId}`, {
      method: 'DELETE',
      headers: { 'API-Key': config.apiKey },
    });
    if (!res.ok) throw new Error(`SMSA cancel error: ${res.status}`);
    return { success: true };
  },
};

// --- Aramex ---
const aramexAdapter = {
  async createShipment({ order, customer, items, config }) {
    const baseUrl = config.environment === 'production'
      ? 'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1.0.svc'
      : 'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1.0.svc';
    const body = {
      ClientInfo: {
        UserName: config.accountNumber || '',
        Password: config.apiSecret || '',
        Version: 'v2',
        AccountNumber: config.accountNumber || '',
        AccountPin: config.apiKey || '',
        AccountEntity: 'RUH',
      },
      Shipments: [{
        Reference1: order.orderNumber,
        Shipper: { Name: 'Store', CellPhone: '' },
        Consignee: {
          Name: customer.name,
          CellPhone: customer.phone,
          AddressLine1: customer.addressLine1,
          City: customer.city,
          CountryCode: 'SA',
        },
        Details: items.map(i => ({
          PackageCount: 1,
          Weight: { Unit: 'KG', Value: i.weight || 0.5 },
          ProductGroup: 'EXP',
          ProductType: 'PPX',
        })),
        ShippingDate: new Date().toISOString(),
        PaymentType: order.payment?.method === 'cod' ? 'P' : 'P',
        CashOnDeliveryAmount: order.payment?.method === 'cod' ? order.grandTotal : 0,
      }],
      LabelInfo: { ReportID: 9201, ReportType: 'URL' },
    };
    const res = await fetch(`${baseUrl}/json/CreateShipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Aramex error: ${res.status}`);
    const data = await res.json();
    const shipment = data.Shipments?.[0] || {};
    return {
      trackingNumber: shipment.ID || '',
      shipmentId: shipment.ID || '',
      labelUrl: shipment.LabelURL || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const body = {
      ClientInfo: {
        UserName: config.accountNumber || '',
        Password: config.apiSecret || '',
        Version: 'v2',
      },
      Shipments: [trackingNumber],
    };
    const res = await fetch('https://ws.aramex.net/ShippingAPI.V2/Tracking/Service_1.0.svc/json/TrackShipments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Aramex track error: ${res.status}`);
    const data = await res.json();
    const tracking = data.TrackingResults?.[0]?.Value?.[0] || {};
    return {
      status: tracking.UpdateDescription || 'unknown',
      events: data.TrackingResults?.[0]?.Value || [],
      raw: data,
    };
  },

  async cancelShipment(shipmentId, config) {
    // Aramex uses a different cancellation flow
    return { success: true, message: 'Contact Aramex to cancel shipment' };
  },
};

// --- Naqel ---
const naqelAdapter = {
  async createShipment({ order, customer, items, config }) {
    const baseUrl = 'https://api.naqelexpress.com/v3';
    const body = {
      InvoiceNo: order.orderNumber,
      PickupDate: new Date().toISOString(),
      PickupFrom: { Name: 'Store' },
      ConsigneeInfo: {
        Name: customer.name,
        Mobile: customer.phone,
        Address: customer.addressLine1,
        City: customer.city,
      },
      COD: order.payment?.method === 'cod' ? order.grandTotal : 0,
      Weight: items.reduce((sum, i) => sum + (i.weight || 0.5), 0),
      Pieces: items.length,
    };
    const res = await fetch(`${baseUrl}/shipments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Naqel error: ${res.status}`);
    const data = await res.json();
    return {
      trackingNumber: data.trackingNumber || data.awbNo || '',
      shipmentId: data.shipmentId || '',
      labelUrl: data.labelUrl || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const res = await fetch(`https://api.naqelexpress.com/v3/track/${trackingNumber}`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });
    if (!res.ok) throw new Error(`Naqel track error: ${res.status}`);
    const data = await res.json();
    return { status: data.status || 'unknown', events: data.events || [], raw: data };
  },

  async cancelShipment(shipmentId, config) {
    const res = await fetch(`https://api.naqelexpress.com/v3/shipments/${shipmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });
    if (!res.ok) throw new Error(`Naqel cancel error: ${res.status}`);
    return { success: true };
  },
};

// --- iMile ---
const imileAdapter = {
  async createShipment({ order, customer, items, config }) {
    const baseUrl = config.environment === 'production'
      ? 'https://api.imile.com/openapi/shipper/createOrder'
      : 'https://api.imile.com/openapi/shipper/createOrder';
    const body = {
      customerOrderNo: order.orderNumber,
      consigneeName: customer.name,
      consigneePhone: customer.phone,
      consigneeAddress: customer.addressLine1,
      consigneeCity: customer.city,
      country: 'SA',
      weight: items.reduce((sum, i) => sum + (i.weight || 0.5), 0),
      itemNum: items.length,
      codAmount: order.payment?.method === 'cod' ? order.grandTotal : 0,
      itemDescription: items.map(i => i.productTitle).join(', '),
    };
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`iMile error: ${res.status}`);
    const data = await res.json();
    return {
      trackingNumber: data.data?.billCode || '',
      shipmentId: data.data?.orderId || '',
      labelUrl: data.data?.labelUrl || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const res = await fetch('https://api.imile.com/openapi/shipper/queryTrack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ billCodes: [trackingNumber] }),
    });
    if (!res.ok) throw new Error(`iMile track error: ${res.status}`);
    const data = await res.json();
    return { status: data.data?.[0]?.status || 'unknown', events: data.data?.[0]?.tracks || [], raw: data };
  },

  async cancelShipment(shipmentId, config) {
    const res = await fetch('https://api.imile.com/openapi/shipper/cancelOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ orderId: shipmentId }),
    });
    if (!res.ok) throw new Error(`iMile cancel error: ${res.status}`);
    return { success: true };
  },
};

function sandboxShipment(provider, { order, customer, items }, note = '') {
  const awb = `${String(provider).toUpperCase()}-SBX-${Date.now().toString().slice(-8)}`;
  return {
    trackingNumber: awb,
    shipmentId: awb,
    labelUrl: null,
    sandbox: true,
    message: note || `${provider} sandbox waybill created. Add live API credentials to print production labels.`,
    consignee: customer?.name || '',
    pieces: items?.length || 1,
    reference: order?.orderNumber || '',
    raw: { sandbox: true, provider, awb },
  };
}

// --- J&T Express ---
const jntAdapter = {
  async createShipment({ order, customer, items, config }) {
    const baseUrl = config.environment === 'production'
      ? 'https://openapi.jtexpress.com.sa/webopenplatformapi/api/order/addOrder'
      : 'https://demoopenapi.jtexpress.com.sa/webopenplatformapi/api/order/addOrder';
    const body = {
      customerCode: config.accountNumber || '',
      txlogisticId: order.orderNumber,
      serviceType: '02',
      orderType: '1',
      sender: { name: config.accountNumber || 'Store', mobile: '', city: 'Riyadh', address: 'KSA' },
      receiver: {
        name: customer.name,
        mobile: customer.phone,
        city: customer.city || 'Riyadh',
        address: customer.addressLine1,
      },
      cargo: {
        goodsType: 'bm000006',
        goodsValue: order.grandTotal || 0,
        weight: items.reduce((sum, i) => sum + (i.weight || 0.5), 0),
        quantity: items.length,
      },
      expressType: order.payment?.method === 'cod' ? '1' : '2',
      itemsValue: order.payment?.method === 'cod' ? order.grandTotal : 0,
    };
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiAccount': config.apiKey || '',
        'digest': config.apiSecret || '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`J&T error: ${res.status}`);
    const data = await res.json();
    return {
      trackingNumber: data.data?.billCode || data.billCode || '',
      shipmentId: data.data?.txlogisticId || order.orderNumber,
      labelUrl: data.data?.labelUrl || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const res = await fetch('https://openapi.jtexpress.com.sa/webopenplatformapi/api/logistics/trace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiAccount': config.apiKey || '',
        'digest': config.apiSecret || '',
      },
      body: JSON.stringify({ billCodes: [trackingNumber] }),
    });
    if (!res.ok) throw new Error(`J&T track error: ${res.status}`);
    const data = await res.json();
    const first = data.data?.[0] || {};
    return { status: first.status || 'unknown', events: first.details || [], raw: data };
  },

  async cancelShipment(shipmentId, config) {
    const res = await fetch('https://openapi.jtexpress.com.sa/webopenplatformapi/api/order/cancelOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiAccount': config.apiKey || '',
        'digest': config.apiSecret || '',
      },
      body: JSON.stringify({ txlogisticId: shipmentId }),
    });
    if (!res.ok) throw new Error(`J&T cancel error: ${res.status}`);
    return { success: true };
  },
};

// --- Saudi Post (SPL) ---
const splAdapter = {
  async createShipment({ order, customer, items, config }) {
    const baseUrl = config.environment === 'production'
      ? 'https://api.splonline.com.sa/v2/shipments'
      : 'https://sandbox.splonline.com.sa/v2/shipments';
    const body = {
      reference: order.orderNumber,
      consignee: {
        name: customer.name,
        mobile: customer.phone,
        address: customer.addressLine1,
        city: customer.city || 'Riyadh',
        country: customer.country || 'SA',
      },
      pieces: items.length,
      weight: items.reduce((sum, i) => sum + (i.weight || 0.5), 0),
      codAmount: order.payment?.method === 'cod' ? order.grandTotal : 0,
      description: items.map(i => i.productTitle).join(', '),
    };
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`SPL error: ${res.status}`);
    const data = await res.json();
    return {
      trackingNumber: data.barcode || data.trackingNumber || '',
      shipmentId: data.shipmentId || data.barcode || '',
      labelUrl: data.labelUrl || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const res = await fetch(`https://api.splonline.com.sa/v2/track/${trackingNumber}`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });
    if (!res.ok) throw new Error(`SPL track error: ${res.status}`);
    const data = await res.json();
    return { status: data.status || 'unknown', events: data.events || [], raw: data };
  },

  async cancelShipment(shipmentId, config) {
    const res = await fetch(`https://api.splonline.com.sa/v2/shipments/${shipmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
    });
    if (!res.ok) throw new Error(`SPL cancel error: ${res.status}`);
    return { success: true };
  },
};

function parcelWeight(items) {
  const kg = (items || []).reduce((sum, i) => sum + (Number(i.weight) || 0.5), 0);
  return Math.max(0.5, Number(kg.toFixed(2)));
}

function countryCode(value) {
  if (!value) return 'SA';
  const raw = String(value).trim();
  if (raw.length === 2) return raw.toUpperCase();
  if (/saudi/i.test(raw)) return 'SA';
  return raw.slice(0, 2).toUpperCase() || 'SA';
}

async function readJson(res, label) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${label} error: ${res.status} ${data.message || data.errors || ''}`.trim());
  return data;
}

async function fedexAccessToken(config) {
  const base = config.environment === 'production' ? 'https://apis.fedex.com' : 'https://apis-sandbox.fedex.com';
  const res = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.apiKey || '',
      client_secret: config.apiSecret || '',
    }),
  });
  const data = await readJson(res, 'FedEx auth');
  if (!data.access_token) throw new Error('FedEx auth: missing access_token');
  return { token: data.access_token, base };
}

const fedexAdapter = {
  async createShipment({ order, customer, items, config }) {
    const { token, base } = await fedexAccessToken(config);
    const weight = parcelWeight(items);
    const body = {
      labelResponseOptions: 'URL_ONLY',
      requestedShipment: {
        shipDatestamp: new Date().toISOString().slice(0, 10),
        pickupType: 'USE_SCHEDULED_PICKUP',
        serviceType: countryCode(customer.country) === 'SA' ? 'FEDEX_EXPRESS_SAVER' : 'INTERNATIONAL_PRIORITY',
        packagingType: 'YOUR_PACKAGING',
        shipper: {
          contact: { personName: config.accountNumber || 'Store', phoneNumber: '0500000000', companyName: 'Store' },
          address: { streetLines: ['KSA'], city: 'Riyadh', countryCode: 'SA' },
        },
        recipients: [{
          contact: { personName: customer.name, phoneNumber: customer.phone || '0500000000' },
          address: {
            streetLines: [customer.addressLine1 || 'Address'],
            city: customer.city || 'Riyadh',
            postalCode: customer.postalCode || '',
            countryCode: countryCode(customer.country),
          },
        }],
        shippingChargesPayment: {
          paymentType: 'SENDER',
          payor: { responsibleParty: { accountNumber: { value: config.accountNumber || '' } } },
        },
        labelSpecification: { imageType: 'PDF', labelStockType: 'STOCK_4X6' },
        requestedPackageLineItems: [{ weight: { units: 'KG', value: weight } }],
      },
      accountNumber: { value: config.accountNumber || '' },
    };
    const res = await fetch(`${base}/ship/v1/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await readJson(res, 'FedEx');
    const shipment = data.output?.transactionShipments?.[0] || {};
    const piece = shipment.pieceResponses?.[0] || {};
    return {
      trackingNumber: piece.trackingNumber || shipment.masterTrackingNumber || '',
      shipmentId: shipment.masterTrackingNumber || piece.trackingNumber || '',
      labelUrl: piece.packageDocuments?.[0]?.url || shipment.shipmentDocuments?.[0]?.url || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const { token, base } = await fedexAccessToken(config);
    const res = await fetch(`${base}/track/v1/trackingnumbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackingInfo: [{ trackingNumberInfo: { trackingNumber } }] }),
    });
    const data = await readJson(res, 'FedEx track');
    const complete = data.output?.completeTrackResults?.[0]?.trackResults?.[0] || {};
    return {
      status: complete.latestStatusDetail?.description || 'unknown',
      events: complete.scanEvents || [],
      raw: data,
    };
  },

  async cancelShipment(shipmentId, config) {
    const { token, base } = await fedexAccessToken(config);
    const res = await fetch(`${base}/ship/v1/shipments/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ accountNumber: { value: config.accountNumber || '' }, trackingNumber: shipmentId }),
    });
    await readJson(res, 'FedEx cancel');
    return { success: true };
  },
};

function dhlBase(config) {
  return config.environment === 'production'
    ? 'https://express.api.dhl.com/mydhlapi'
    : 'https://express.api.dhl.com/mydhlapi/test';
}

function dhlHeaders(config) {
  const token = Buffer.from(`${config.apiKey || ''}:${config.apiSecret || ''}`).toString('base64');
  return { 'Content-Type': 'application/json', Authorization: `Basic ${token}` };
}

const dhlAdapter = {
  async createShipment({ order, customer, items, config }) {
    const weight = parcelWeight(items);
    const when = new Date(Date.now() + 36e5).toISOString().replace(/\.\d{3}Z$/, ' GMT+03:00');
    const body = {
      plannedShippingDateAndTime: when,
      pickup: { isRequested: false },
      productCode: countryCode(customer.country) === 'SA' ? 'N' : 'P',
      accounts: [{ typeCode: 'shipper', number: config.accountNumber || '' }],
      customerDetails: {
        shipperDetails: {
          postalAddress: { cityName: 'Riyadh', countryCode: 'SA', postalCode: '11564', addressLine1: 'KSA' },
          contactInformation: { phone: '0500000000', companyName: 'Store', fullName: 'Store' },
        },
        receiverDetails: {
          postalAddress: {
            cityName: customer.city || 'Riyadh',
            countryCode: countryCode(customer.country),
            postalCode: customer.postalCode || '11564',
            addressLine1: customer.addressLine1 || 'Address',
          },
          contactInformation: { phone: customer.phone || '0500000000', companyName: customer.name, fullName: customer.name },
        },
      },
      content: {
        packages: [{ weight, dimensions: { length: 10, width: 10, height: 10 } }],
        isCustomsDeclarable: false,
        description: items.map((i) => i.productTitle).filter(Boolean).join(', ').slice(0, 70) || order.orderNumber,
        incoterm: 'DAP',
        unitOfMeasurement: 'metric',
      },
      outputImageProperties: { encodingFormat: 'pdf', imageOptions: [{ typeCode: 'label', templateName: 'ECOM26_84_001' }] },
    };
    const res = await fetch(`${dhlBase(config)}/shipments`, {
      method: 'POST',
      headers: dhlHeaders(config),
      body: JSON.stringify(body),
    });
    const data = await readJson(res, 'DHL');
    return {
      trackingNumber: data.shipmentTrackingNumber || data.packages?.[0]?.trackingNumber || '',
      shipmentId: data.shipmentTrackingNumber || '',
      labelUrl: data.documents?.[0]?.url || data.documents?.[0]?.content || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const res = await fetch(`${dhlBase(config)}/shipments/${encodeURIComponent(trackingNumber)}/tracking`, {
      headers: dhlHeaders(config),
    });
    const data = await readJson(res, 'DHL track');
    const shipment = data.shipments?.[0] || data;
    return {
      status: shipment.status || shipment.events?.[0]?.description || 'unknown',
      events: shipment.events || [],
      raw: data,
    };
  },

  async cancelShipment(shipmentId, config) {
    const res = await fetch(`${dhlBase(config)}/shipments/${encodeURIComponent(shipmentId)}`, {
      method: 'DELETE',
      headers: dhlHeaders(config),
    });
    if (!res.ok && res.status !== 204) await readJson(res, 'DHL cancel');
    return { success: true };
  },
};

async function upsAccessToken(config) {
  const base = config.environment === 'production' ? 'https://onlinetools.ups.com' : 'https://wwwcie.ups.com';
  const token = Buffer.from(`${config.apiKey || ''}:${config.apiSecret || ''}`).toString('base64');
  const res = await fetch(`${base}/security/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${token}` },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  const data = await readJson(res, 'UPS auth');
  if (!data.access_token) throw new Error('UPS auth: missing access_token');
  return { token: data.access_token, base };
}

const upsAdapter = {
  async createShipment({ order, customer, items, config }) {
    const { token, base } = await upsAccessToken(config);
    const weight = parcelWeight(items);
    const body = {
      ShipmentRequest: {
        Request: { RequestOption: 'nonvalidate', SubVersion: '1801', TransactionReference: { CustomerContext: order.orderNumber } },
        Shipment: {
          Description: items.map((i) => i.productTitle).filter(Boolean).join(', ').slice(0, 50) || order.orderNumber,
          Shipper: {
            Name: 'Store',
            ShipperNumber: config.accountNumber || '',
            Address: { AddressLine: ['KSA'], City: 'Riyadh', CountryCode: 'SA' },
            Phone: { Number: '0500000000' },
          },
          ShipTo: {
            Name: customer.name,
            Address: { AddressLine: [customer.addressLine1 || 'Address'], City: customer.city || 'Riyadh', CountryCode: countryCode(customer.country) },
            Phone: { Number: customer.phone || '0500000000' },
          },
          PaymentInformation: { ShipmentCharge: { Type: '01', BillShipper: { AccountNumber: config.accountNumber || '' } } },
          Service: { Code: '65', Description: 'UPS Saver' },
          Package: {
            Packaging: { Code: '02' },
            PackageWeight: { UnitOfMeasurement: { Code: 'KGS' }, Weight: String(weight) },
          },
        },
        LabelSpecification: { LabelImageFormat: { Code: 'PDF' }, LabelStockSize: { Height: '6', Width: '4' } },
      },
    };
    const res = await fetch(`${base}/api/shipments/v2403/ship`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, transId: order.orderNumber, transactionSrc: 'maqder' },
      body: JSON.stringify(body),
    });
    const data = await readJson(res, 'UPS');
    const result = data.ShipmentResponse?.ShipmentResults || {};
    const pkg = result.PackageResults || {};
    return {
      trackingNumber: pkg.TrackingNumber || result.ShipmentIdentificationNumber || '',
      shipmentId: result.ShipmentIdentificationNumber || pkg.TrackingNumber || '',
      labelUrl: pkg.ShippingLabel?.GraphicImage || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const { token, base } = await upsAccessToken(config);
    const res = await fetch(`${base}/api/track/v1/details/${encodeURIComponent(trackingNumber)}`, {
      headers: { Authorization: `Bearer ${token}`, transId: trackingNumber, transactionSrc: 'maqder' },
    });
    const data = await readJson(res, 'UPS track');
    const shipment = data.trackResponse?.shipment?.[0] || {};
    const pkg = shipment.package?.[0] || {};
    return {
      status: pkg.currentStatus?.description || 'unknown',
      events: pkg.activity || [],
      raw: data,
    };
  },

  async cancelShipment(shipmentId, config) {
    const { token, base } = await upsAccessToken(config);
    const res = await fetch(`${base}/api/shipments/v2403/void/cancel/${encodeURIComponent(shipmentId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, transId: shipmentId, transactionSrc: 'maqder' },
    });
    if (!res.ok && res.status !== 204) await readJson(res, 'UPS cancel');
    return { success: true };
  },
};

const tntAdapter = {
  async createShipment({ order, customer, items, config }) {
    const body = {
      consignment: {
        sender: { name: 'Store', country: 'SA', city: 'Riyadh' },
        receiver: {
          name: customer.name,
          phone: customer.phone,
          address: customer.addressLine1,
          city: customer.city || 'Riyadh',
          country: countryCode(customer.country),
        },
        reference: order.orderNumber,
        pieces: items.length || 1,
        weight: parcelWeight(items),
        collectionDate: new Date().toISOString().slice(0, 10),
        account: config.accountNumber || '',
      },
    };
    const token = Buffer.from(`${config.apiKey || ''}:${config.apiSecret || ''}`).toString('base64');
    const res = await fetch('https://express.tnt.com/expressconnect/shipping/ship', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${token}` },
      body: JSON.stringify(body),
    });
    const data = await readJson(res, 'TNT');
    return {
      trackingNumber: data.consignmentNumber || data.trackingNumber || '',
      shipmentId: data.consignmentNumber || '',
      labelUrl: data.labelUrl || null,
      raw: data,
    };
  },

  async trackShipment(trackingNumber, config) {
    const token = Buffer.from(`${config.apiKey || ''}:${config.apiSecret || ''}`).toString('base64');
    const res = await fetch(`https://express.tnt.com/expressconnect/track.do?cons=${encodeURIComponent(trackingNumber)}`, {
      headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
    });
    const data = await readJson(res, 'TNT track');
    return { status: data.status || data.consignment?.status || 'unknown', events: data.events || [], raw: data };
  },

  async cancelShipment(shipmentId, config) {
    const token = Buffer.from(`${config.apiKey || ''}:${config.apiSecret || ''}`).toString('base64');
    const res = await fetch(`https://express.tnt.com/expressconnect/shipping/void/${encodeURIComponent(shipmentId)}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${token}` },
    });
    if (!res.ok && res.status !== 204) await readJson(res, 'TNT cancel');
    return { success: true };
  },
};

export const courierAdapters = {
  smsa: smsaAdapter,
  aramex: aramexAdapter,
  naqel: naqelAdapter,
  imile: imileAdapter,
  jnt: jntAdapter,
  spl: splAdapter,
  fedex: fedexAdapter,
  dhl: dhlAdapter,
  ups: upsAdapter,
  tnt: tntAdapter,
};

export function getCourierAdapter(provider) {
  return courierAdapters[provider] || null;
}

/**
 * Create a shipment with the tenant's configured courier.
 */
export async function createShipment(provider, params, config) {
  const adapter = getCourierAdapter(provider);
  if (!adapter) throw new Error(`Unknown courier: ${provider}`);
  if (!config?.enabled) throw new Error(`${provider} is not enabled`);
  const isSandbox = config.environment !== 'production';
  if (!config?.apiKey && !isSandbox) throw new Error(`${provider} API key not configured`);
  if (isSandbox && !config?.apiKey) {
    return sandboxShipment(provider, params);
  }
  try {
    return await adapter.createShipment({ ...params, config });
  } catch (err) {
    if (isSandbox) return sandboxShipment(provider, params, err.message);
    throw err;
  }
}

/**
 * Track a shipment.
 */
export async function trackShipment(provider, trackingNumber, config) {
  const adapter = getCourierAdapter(provider);
  if (!adapter) throw new Error(`Unknown courier: ${provider}`);
  return adapter.trackShipment(trackingNumber, config);
}

/**
 * Cancel a shipment.
 */
export async function cancelShipment(provider, shipmentId, config) {
  const adapter = getCourierAdapter(provider);
  if (!adapter) throw new Error(`Unknown courier: ${provider}`);
  return adapter.cancelShipment(shipmentId, config);
}
