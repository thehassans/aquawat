/**
 * Courier provider adapters for the ecommerce platform.
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

export const courierAdapters = {
  smsa: smsaAdapter,
  aramex: aramexAdapter,
  naqel: naqelAdapter,
  imile: imileAdapter,
  jnt: jntAdapter,
  spl: splAdapter,
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
