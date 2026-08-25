import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { Plus, Pencil, Check, X } from 'lucide-react'
import api from '../../lib/api'
import { fieldControlClass, primaryBtn, ghostBtn, INVENTORY_PATH } from './inventoryUi'
import { InventoryField, InventoryFormShell, InventoryPageHeader } from './InventoryChrome'

const emptyDraft = () => ({
  name: '',
  categoryId: '',
  uomType: 'bigger',
  factor: '1',
  rounding: '0.01',
})

export default function UomList() {
  const { language } = useSelector((state) => state.ui)
  const isAr = language === 'ar'
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(emptyDraft())
  const [editingId, setEditingId] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [newCategoryName, setNewCategoryName] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['stock-uom'],
    queryFn: () => api.get('/stock/uom').then((r) => r.data),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['stock-uom-categories'],
    queryFn: () => api.get('/stock/uom-categories').then((r) => r.data),
  })

  const invalidate = () => {
    queryClient.invalidateQueries(['stock-uom'])
    queryClient.invalidateQueries(['stock-uom-categories'])
  }

  const create = useMutation({
    mutationFn: (payload) => api.post('/stock/uom', payload),
    onSuccess: () => {
      toast.success(isAr ? 'تمت الإضافة' : 'Unit added')
      setDraft(emptyDraft())
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const patch = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/stock/uom/${id}`, payload),
    onSuccess: () => {
      toast.success(isAr ? 'تم التحديث' : 'Updated')
      setEditingId(null)
      setEditRow(null)
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const createCategory = useMutation({
    mutationFn: (name) => api.post('/stock/uom-categories', { name }),
    onSuccess: (res) => {
      toast.success(isAr ? 'تمت إضافة الفئة' : 'Category added')
      setNewCategoryName('')
      setDraft((d) => ({ ...d, categoryId: res.data._id }))
      invalidate()
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Error'),
  })

  const startEdit = (u) => {
    setEditingId(u._id)
    setEditRow({
      name: u.name,
      categoryId: u.categoryId?._id || u.categoryId || '',
      uomType: u.uomType || 'reference',
      factor: String(u.factor ?? '1'),
      rounding: String(u.rounding ?? '0.01'),
    })
  }

  return (
    <div className="space-y-8">
      <InventoryPageHeader
        title={isAr ? 'وحدات القياس' : 'Units of Measure'}
        subtitle={isAr
          ? 'أنشئ وحدات إضافية فوق الوحدة المرجعية (مثل صندوق، كرتون، كجم)'
          : 'Add packing and conversion units on top of your reference unit'}
        backTo={INVENTORY_PATH.config}
        backLabel={isAr ? 'الإعدادات' : 'Configuration'}
      />

      <InventoryFormShell
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.name.trim()) return
          create.mutate({
            name: draft.name.trim(),
            categoryId: draft.categoryId || undefined,
            uomType: draft.uomType,
            factor: draft.factor,
            rounding: draft.rounding,
          })
        }}
      >
        <div className="md:col-span-2">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {isAr ? 'وحدة جديدة' : 'New unit'}
          </p>
        </div>
        <InventoryField label={isAr ? 'الاسم' : 'Name'}>
          <input
            className={fieldControlClass}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={isAr ? 'مثال: صندوق' : 'e.g. Box'}
            required
          />
        </InventoryField>
        <InventoryField label={isAr ? 'الفئة' : 'Category'}>
          <select
            className={fieldControlClass}
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          >
            <option value="">{isAr ? 'وحدات (افتراضي)' : 'Units (default)'}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </InventoryField>
        <InventoryField label={isAr ? 'النوع' : 'Type'}>
          <select
            className={fieldControlClass}
            value={draft.uomType}
            onChange={(e) => setDraft({ ...draft, uomType: e.target.value })}
          >
            <option value="reference">{isAr ? 'مرجعي' : 'Reference'}</option>
            <option value="bigger">{isAr ? 'أكبر' : 'Bigger'}</option>
            <option value="smaller">{isAr ? 'أصغر' : 'Smaller'}</option>
          </select>
        </InventoryField>
        <InventoryField
          label={isAr ? 'المعامل' : 'Factor'}
          hint={isAr ? 'كم وحدة مرجعية تساوي هذه الوحدة' : 'How many reference units equal one of this'}
        >
          <input
            className={fieldControlClass}
            value={draft.factor}
            onChange={(e) => setDraft({ ...draft, factor: e.target.value })}
          />
        </InventoryField>
        <InventoryField label={isAr ? 'التقريب' : 'Rounding'}>
          <input
            className={fieldControlClass}
            value={draft.rounding}
            onChange={(e) => setDraft({ ...draft, rounding: e.target.value })}
          />
        </InventoryField>
        <div className="md:col-span-2 flex flex-wrap items-end gap-3">
          <InventoryField label={isAr ? 'فئة جديدة' : 'New category'} className="min-w-[200px] flex-1">
            <div className="flex gap-2">
              <input
                className={fieldControlClass}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={isAr ? 'وزن، حجم…' : 'Weight, Volume…'}
              />
              <button
                type="button"
                className={ghostBtn}
                disabled={!newCategoryName.trim() || createCategory.isPending}
                onClick={() => createCategory.mutate(newCategoryName.trim())}
              >
                {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
          </InventoryField>
          <button type="submit" className={primaryBtn} disabled={create.isPending || !draft.name.trim()}>
            <Plus className="h-4 w-4" />
            {isAr ? 'إضافة وحدة' : 'Add unit'}
          </button>
        </div>
      </InventoryFormShell>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الاسم' : 'Name'}</th>
                <th>{isAr ? 'الفئة' : 'Category'}</th>
                <th>{isAr ? 'النوع' : 'Type'}</th>
                <th>{isAr ? 'المعامل' : 'Factor'}</th>
                <th>{isAr ? 'التقريب' : 'Rounding'}</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">…</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    {isAr ? 'لا وحدات بعد' : 'No units yet'}
                  </td>
                </tr>
              )}
              {items.map((u) => (
                <tr key={u._id}>
                  {editingId === u._id && editRow ? (
                    <>
                      <td>
                        <input
                          className={fieldControlClass}
                          value={editRow.name}
                          onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className={fieldControlClass}
                          value={editRow.categoryId}
                          onChange={(e) => setEditRow({ ...editRow, categoryId: e.target.value })}
                        >
                          {categories.map((c) => (
                            <option key={c._id} value={c._id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className={fieldControlClass}
                          value={editRow.uomType}
                          onChange={(e) => setEditRow({ ...editRow, uomType: e.target.value })}
                        >
                          <option value="reference">reference</option>
                          <option value="bigger">bigger</option>
                          <option value="smaller">smaller</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className={fieldControlClass}
                          value={editRow.factor}
                          onChange={(e) => setEditRow({ ...editRow, factor: e.target.value })}
                          disabled={editRow.uomType === 'reference'}
                        />
                      </td>
                      <td>
                        <input
                          className={fieldControlClass}
                          value={editRow.rounding}
                          onChange={(e) => setEditRow({ ...editRow, rounding: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={ghostBtn}
                            onClick={() => patch.mutate({ id: u._id, ...editRow })}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className={ghostBtn}
                            onClick={() => { setEditingId(null); setEditRow(null) }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="font-medium">{u.name}</td>
                      <td>{u.categoryId?.name || '—'}</td>
                      <td className="capitalize text-slate-500">{u.uomType}</td>
                      <td>{u.factor}</td>
                      <td>{u.rounding}</td>
                      <td>
                        <button type="button" className={ghostBtn} onClick={() => startEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                          {isAr ? 'تعديل' : 'Edit'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
