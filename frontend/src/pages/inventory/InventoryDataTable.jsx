import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import ResponsiveDataList from '../../components/ui/ResponsiveDataList'

function SortIcon({ sorted }) {
  if (sorted === 'asc') return <ChevronUp className="w-3.5 h-3.5 opacity-60" />
  if (sorted === 'desc') return <ChevronDown className="w-3.5 h-3.5 opacity-60" />
  return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
}

/**
 * TanStack-powered inventory table with mobile cards, sticky header, and optional row selection.
 */
export default function InventoryDataTable({
  columns = [],
  data = [],
  loading = false,
  empty = null,
  pagination,
  selectable = false,
  selectedIds,
  onSelectedIdsChange,
  getRowId = (row) => row._id || row.id,
  rowClassName,
}) {
  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})

  const tableColumns = useMemo(() => {
    const cols = []
    if (selectable) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        size: 40,
      })
    }
    for (const col of columns) {
      cols.push({
        id: col.key,
        accessorKey: col.key,
        header: col.label,
        enableSorting: col.sortable !== false,
        cell: ({ row }) => (col.render ? col.render(row.original) : row.getValue(col.key) ?? '—'),
      })
    }
    return cols
  }, [columns, selectable])

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater
      setRowSelection(next)
      if (onSelectedIdsChange) {
        const ids = Object.keys(next).filter((k) => next[k])
        onSelectedIdsChange(ids)
      }
    },
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: selectable,
  })

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="animate-pulse space-y-3 p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-dark-700" />
          ))}
        </div>
      </div>
    )
  }

  const rows = table.getRowModel().rows

  const renderCard = (row) => {
    const original = row
    return (
      <div
        key={getRowId(original)}
        className={`rounded-xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-[#0c111a] ${rowClassName?.(original) || ''}`}
      >
        {selectable && (
          <div className="mb-2">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={Boolean(rowSelection[getRowId(original)])}
              onChange={() => {
                const id = getRowId(original)
                const next = { ...rowSelection, [id]: !rowSelection[id] }
                setRowSelection(next)
                onSelectedIdsChange?.(Object.keys(next).filter((k) => next[k]))
              }}
            />
          </div>
        )}
        <dl className="space-y-2 text-sm">
          {columns.map((col) => (
            <div key={col.key} className="flex justify-between gap-3">
              <dt className="text-slate-500 shrink-0">{col.label}</dt>
              <dd className="text-end font-medium text-slate-900 dark:text-white min-w-0">
                {col.render ? col.render(original) : original[col.key] ?? '—'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {columns.length > 3 && data.length > 5 && (
        <input
          className="input max-w-xs text-sm"
          placeholder="Filter rows…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      )}

      <ResponsiveDataList
        items={rows.length ? data : []}
        renderCard={renderCard}
        empty={empty}
      >
        <div className="card overflow-hidden">
          <div className="table-container max-h-[70vh] overflow-auto">
            <table className="table">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-dark-800 shadow-sm">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th key={header.id} className="whitespace-nowrap">
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 font-medium hover:text-teal-700 dark:hover:text-teal-400"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIcon sorted={header.column.getIsSorted()} />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={tableColumns.length} className="text-center py-10 text-slate-500">
                      {empty || '—'}
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={rowClassName?.(row.original) || ''}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ResponsiveDataList>

      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {pagination.total} {pagination.totalLabel || 'items'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange?.(pagination.page - 1)}
            >
              Prev
            </button>
            <span className="px-2 py-1">{pagination.page}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => pagination.onPageChange?.(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
