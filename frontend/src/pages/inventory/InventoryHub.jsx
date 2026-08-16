import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Warehouse, ArrowRightLeft, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from '../../lib/translations'
import Products from './Products'
import Warehouses from './Warehouses'

export default function InventoryHub() {
  const { language } = useSelector((state) => state.ui)
  const { t } = useTranslation(language)
  const location = useLocation()
  const navigate = useNavigate()

  // Determine active tab from URL hash, default to 'products'
  const activeTab = location.hash ? location.hash.replace('#', '') : 'products'

  const tabs = [
    { id: 'products', label: language === 'ar' ? 'المنتجات' : 'Products', icon: Package },
    { id: 'warehouses', label: t('warehouses'), icon: Warehouse },
  ]

  const handleTabChange = (tabId) => {
    navigate(`#${tabId}`, { replace: true })
  }

  return (
    <div className="space-y-6">
      {/* Top Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-dark-600">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="activeInventoryTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                  initial={false}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        <AnimatePresence mode="wait">
          {activeTab === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Products />
            </motion.div>
          )}
          {activeTab === 'warehouses' && (
            <motion.div
              key="warehouses"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Warehouses />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
