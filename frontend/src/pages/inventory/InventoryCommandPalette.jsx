import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Command } from 'cmdk'
import { Search, Package, MapPin, Truck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import { INVENTORY_PATH } from './inventoryUi'

const TYPE_ICON = {
  picking: Truck,
  product: Package,
  location: MapPin,
}

function navigateForResult(navigate, item) {
  if (item.type === 'picking') navigate(INVENTORY_PATH.picking(item.id))
  else if (item.type === 'product') navigate(INVENTORY_PATH.product(item.id))
  else if (item.type === 'location') navigate(`${INVENTORY_PATH.locations}?highlight=${item.id}`)
}

export default function InventoryCommandPalette() {
  const navigate = useNavigate()
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['stock-search', query],
    queryFn: () => api.get('/stock/search', { params: { q: query } }).then((r) => r.data),
    enabled: open && query.trim().length >= 2,
    staleTime: 10_000,
  })

  const results = data?.results || []

  const pick = useCallback((item) => {
    navigateForResult(navigate, item)
    setOpen(false)
    setQuery('')
  }, [navigate])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-auto mt-[12vh] max-w-xl px-4">
        <Command
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0c111a]"
          shouldFilter={false}
        >
          <div className="flex items-center gap-2 border-b border-slate-200/80 px-4 dark:border-white/10">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={isAr ? 'ابحث عن منتج، عملية، موقع…' : 'Search products, transfers, locations…'}
              className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-slate-400"
              autoFocus
            />
            <kbd className="hidden sm:inline rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">Esc</kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {query.trim().length < 2 && (
              <Command.Empty className="py-8 text-center text-sm text-slate-500">
                {isAr ? 'اكتب حرفين على الأقل' : 'Type at least 2 characters'}
              </Command.Empty>
            )}
            {query.trim().length >= 2 && isFetching && (
              <div className="py-6 text-center text-sm text-slate-500">{isAr ? 'جاري البحث…' : 'Searching…'}</div>
            )}
            {query.trim().length >= 2 && !isFetching && results.length === 0 && (
              <Command.Empty className="py-8 text-center text-sm text-slate-500">
                {isAr ? 'لا نتائج' : 'No results'}
              </Command.Empty>
            )}
            {results.map((item) => {
              const Icon = TYPE_ICON[item.type] || Search
              return (
                <Command.Item
                  key={`${item.type}-${item.id}`}
                  value={`${item.type}-${item.id}-${item.label}`}
                  onSelect={() => pick(item)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-teal-50 dark:aria-selected:bg-teal-500/10"
                >
                  <Icon className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{item.label}</p>
                    {item.meta && <p className="truncate text-xs text-slate-500">{item.meta}</p>}
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{item.type}</span>
                </Command.Item>
              )
            })}
          </Command.List>
          <div className="border-t border-slate-200/80 px-4 py-2 text-[11px] text-slate-400 dark:border-white/10">
            {isAr ? 'Ctrl+K للبحث السريع' : 'Ctrl+K quick search · ↑↓ navigate · Enter open'}
          </div>
        </Command>
      </div>
    </div>
  )
}
