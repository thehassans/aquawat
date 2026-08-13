/**
 * SaaS plan caps applied on trial, checkout, and create-time enforcement.
 * 0 = unlimited (enterprise).
 */
export const TRIAL_LIMITS = {
  invoices: 10,
  quotations: 10,
  customers: 10,
  suppliers: 1,
  purchaseOrders: 10,
  purchaseReturns: 5,
  products: 10,
  warehouses: 1,
  users: 1,
  projects: 5,
  tasks: 10,
  employees: 5,
  expenses: 10,
  vouchers: 10,
  shipments: 5,
  restaurantOrders: 10,
  restaurantMenuItems: 200,
  restaurantTables: 5,
  travelBookings: 10,
  rentalCars: 5,
  rentalCustomers: 10,
  saloonServices: 10,
  saloonStaff: 5,
  saloonAppointments: 10,
  laundryServices: 10,
  laundryCustomers: 10,
  laundryInventory: 10,
  promotions: 5,
  manpowerTimesheets: 10,
  khayyatStitchings: 10,
}

export const PLAN_ENTITLEMENTS = {
  trial: {
    monthly: { maxUsers: 1, maxInvoices: 10, maxQuotations: 10 },
    yearly: { maxUsers: 1, maxInvoices: 10, maxQuotations: 10 },
  },
  starter: {
    monthly: { maxUsers: 1, maxInvoices: 50, maxQuotations: 50 },
    yearly: { maxUsers: 1, maxInvoices: 500, maxQuotations: 500 },
  },
  professional: {
    monthly: { maxUsers: 3, maxInvoices: 100, maxQuotations: 100 },
    yearly: { maxUsers: 3, maxInvoices: 1000, maxQuotations: 1000 },
  },
  enterprise: {
    monthly: { maxUsers: 0, maxInvoices: 0, maxQuotations: 0 },
    yearly: { maxUsers: 0, maxInvoices: 0, maxQuotations: 0 },
  },
}

export function getPlanEntitlements(plan = 'trial', billingCycle = 'monthly') {
  const id = String(plan || 'trial').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly'
  const row = PLAN_ENTITLEMENTS[id] || PLAN_ENTITLEMENTS.trial
  return { ...(row[cycle] || row.monthly) }
}
