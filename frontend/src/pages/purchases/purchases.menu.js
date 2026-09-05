/** Purchases module menu — mirrors Inventory layout pattern. */

import { PURCHASES_PATH } from './purchasesUi'

export const PURCHASES_MENU = [
  {
    id: 'overview',
    label: 'Overview',
    labelAr: 'نظرة عامة',
    href: PURCHASES_PATH.root,
    end: true,
  },
  {
    id: 'orders',
    label: 'Purchase Orders',
    labelAr: 'طلبات الشراء',
    children: [
      {
        id: 'orders-all',
        label: 'All purchase orders',
        labelAr: 'كل طلبات الشراء',
        href: PURCHASES_PATH.orders,
        end: true,
      },
      {
        id: 'orders-new',
        label: 'New purchase order',
        labelAr: 'طلب شراء جديد',
        href: `${PURCHASES_PATH.orders}/new`,
      },
    ],
  },
  {
    id: 'receipts',
    label: 'Receipts',
    labelAr: 'الاستلامات',
    href: PURCHASES_PATH.grn,
  },
  {
    id: 'returns',
    label: 'Returns',
    labelAr: 'المرتجعات',
    children: [
      {
        id: 'returns-all',
        label: 'All purchase returns',
        labelAr: 'كل مرتجعات المشتريات',
        href: PURCHASES_PATH.returns,
        end: true,
      },
      {
        id: 'returns-new',
        label: 'New purchase return',
        labelAr: 'مرتجع مشتريات جديد',
        href: `${PURCHASES_PATH.returns}/new`,
      },
    ],
  },
  {
    id: 'partners',
    label: 'Suppliers',
    labelAr: 'الموردون',
    children: [
      {
        id: 'suppliers',
        label: 'Suppliers & POs',
        labelAr: 'الموردون وطلباتهم',
        href: PURCHASES_PATH.suppliers,
      },
      {
        id: 'bills',
        label: 'Vendor bills',
        labelAr: 'فواتير الموردين',
        href: PURCHASES_PATH.bills,
      },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    labelAr: 'التقارير',
    children: [
      {
        id: 'reports',
        label: 'Purchases reports',
        labelAr: 'تقارير المشتريات',
        href: PURCHASES_PATH.reports,
      },
      {
        id: 'landed',
        label: 'Landed costs',
        labelAr: 'التكلفة المرسية',
        href: PURCHASES_PATH.landed,
      },
      {
        id: 'landed-new',
        label: 'New landed cost',
        labelAr: 'تكلفة مرسية جديدة',
        href: `${PURCHASES_PATH.landed}/new`,
      },
    ],
  },
]
