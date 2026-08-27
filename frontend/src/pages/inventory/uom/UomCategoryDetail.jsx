import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { ArrowLeft, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import EmptyState from '../../../components/ui/EmptyState'
import { invTableClass, invTableWrapClass, invThClass, invTdClass } from '../inventoryUi'
import { ConfigModal } from '../ConfigModal'

const LOCK_MSG_EN = 'Cannot modify a UOM that has active inventory, as this will corrupt historical valuations.'
const LOCK_MSG_AR = 'لا يمكن تعديل وحدة قياس لها مخزون نشط، لأن ذلك يفسد التقييمات التاريخية.'

/**
 * Category detail — manage UoMs with a single Reference Unit and Ratio column.
 * Ratio = how many reference units equal 1 of this unit (kg ref → g=0.001, t=1000).
 */
export default function UomCategoryDetail() {
  const { categoryId } = useParams()
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    ratio: '1',
    rounding: '0.01',
    isReference: false,
  })
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ ratio: '', rounding: '' })

  const { data: category, isLoading: catLoading } = useQuery({
    queryKey: ['inv-uom-category', categoryId],
    queryFn: () => api.get(`/stock/uom-categories/${categoryId}`).then((r) => r.data),
    enabled: Boolean(categoryId),
  })

  const { data: uoms, isLoading } = useQuery({
    queryKey: ['inv-uoms', categoryId, 'stockGuard'],
    queryFn: () => api.get('/stock/uoms', {
      params: { categoryId, active: 'false', stockGuard: '1' },
    }).then((r) => asInvList(r.data)),
    enabled: Boolean(categoryId),
  })

  const rows = useMemo(() => {
    const list = uoms || []
    return [...list].sort((a, b) => {
      const aRef = a.uomType === 'reference' || a.isReference ? 0 : 1
      const bRef = b.uomType === 'reference' || b.isReference ? 0 : 1
      if (aRef !== bRef) return aRef - bRef
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
  }, [uoms])

  const hasReference = rows.some((u) => u.uomType === 'reference' || u.isReference)
  const catName = category
    ? (ar && category.nameAr ? category.nameAr : category.name)
    : '…'

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inv-uoms'] })
    qc.invalidateQueries({ queryKey: ['inv-uom-categories'] })
    qc.invalidateQueries({ queryKey: ['inv-uom-category', categoryId] })
  }

  const createMut = useMutation({
    mutationFn: () => api.post('/stock/uoms', {
      categoryId,
      name: form.name,
      nameAr: form.nameAr || undefined,
      ratio: form.isReference || !hasReference ? '1' : form.ratio,
      rounding: form.rounding || '0.01',
      isReference: form.isReference || !hasReference,
    }),
    onSuccess: () => {
      toast.success(ar ? 'تمت إضافة الوحدة' : 'UoM added')
      setModalOpen(false)
      setForm({ name: '', nameAr: '', ratio: '1', rounding: '0.01', isReference: false })
      invalidate()
    },
    onError: (e) => toast.error(formatInvError(e, language)),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/stock/uoms/${id}`, body),
    onSuccess: () => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      setEditingId(null)
      invalidate()
    },
    onError: (e) => {
      const code = e?.response?.data?.code
      const msg = code === 'UOM_ACTIVE_STOCK'
        ? (ar ? LOCK_MSG_AR : (e?.response?.data?.error || LOCK_MSG_EN))
        : formatInvError(e, language)
      toast.error(msg)
    },
  })

  const startEdit = (u) => {
    if (u.hasActiveStock) {
      toast.error(ar ? LOCK_MSG_AR : LOCK_MSG_EN)
      return
    }
    setEditingId(u._id)
    setEditDraft({
      ratio: String(u.ratio ?? '1'),
      rounding: String(u.rounding ?? '0.01'),
    })
  }

  const saveEdit = (u) => {
    if (u.hasActiveStock) {
      toast.error(ar ? LOCK_MSG_AR : LOCK_MSG_EN)
      return
    }
    const isRef = u.uomType === 'reference' || u.isReference
    patchMut.mutate({
      id: u._id,
      body: isRef
        ? { rounding: editDraft.rounding, isReference: true }
        : { ratio: editDraft.ratio, rounding: editDraft.rounding },
    })
  }

  const makeReference = (u) => {
    if (u.hasActiveStock) {
      toast.error(ar ? LOCK_MSG_AR : LOCK_MSG_EN)
      return
    }
    if (!window.confirm(ar
      ? `تعيين «${u.name}» كوحدة مرجعية؟ سيتم ضبط النسبة إلى 1.`
      : `Set "${u.name}" as the reference unit? Its ratio will be set to 1.`)) {
      return
    }
    patchMut.mutate({ id: u._id, body: { isReference: true, ratio: '1' } })
  }

  if (catLoading && !category) {
    return <div className="text-sm text-slate-400">…</div>
  }

  if (!category && !catLoading) {
    return (
      <div className="space-y-3">
        <EmptyState title={ar ? 'الفئة غير موجودة' : 'Category not found'} />
        <div className="text-center">
          <Link to="/app/dashboard/inventory/uom" className="text-sm text-sky-700 hover:underline">
            {ar ? 'العودة للفئات' : 'Back to categories'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col gap-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-icon mt-0.5"
            onClick={() => navigate('/app/dashboard/inventory/uom')}
            aria-label={ar ? 'رجوع' : 'Back'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {catName}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {ar
                ? 'نسبة كل وحدة نسبةً إلى الوحدة المرجعية الوحيدة في هذه الفئة.'
                : 'Every unit’s ratio is relative to the single reference unit in this category.'}
            </p>
            {category?.referenceUom ? (
              <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {ar ? 'المرجع: ' : 'Reference: '}
                {ar && category.referenceUom.nameAr
                  ? category.referenceUom.nameAr
                  : category.referenceUom.name}
                {' '}(= 1)
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700">
                {ar ? 'لا توجد وحدة مرجعية بعد — أول وحدة تُنشأ ستكون المرجع.' : 'No reference yet — the first unit created becomes the anchor.'}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setForm({
              name: '',
              nameAr: '',
              ratio: '1',
              rounding: '0.01',
              isReference: !hasReference,
            })
            setModalOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {ar ? 'وحدة جديدة' : 'New UoM'}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">…</div>
      ) : !rows.length ? (
        <EmptyState
          title={ar ? 'لا وحدات في هذه الفئة' : 'No units in this category'}
          description={ar ? 'أضف وحدة مرجعية للبدء' : 'Add a reference unit to get started'}
        />
      ) : (
        <div className={`${invTableWrapClass} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className={`${invTableClass} min-w-[720px]`}>
              <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 text-start text-xs uppercase tracking-wide text-slate-500 backdrop-blur dark:border-dark-600 dark:bg-dark-900/95">
                <tr>
                  <th className={invThClass}>{ar ? 'الاسم' : 'Name'}</th>
                  <th className={invThClass}>{ar ? 'النسبة (إلى المرجع)' : 'Ratio (to reference)'}</th>
                  <th className={invThClass}>{ar ? 'التقريب' : 'Rounding'}</th>
                  <th className={`${invThClass} text-end`}>{ar ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const isRef = u.uomType === 'reference' || u.isReference
                  const locked = Boolean(u.hasActiveStock)
                  const isEditing = editingId === u._id
                  return (
                    <tr
                      key={u._id}
                      className={`border-b border-slate-50 dark:border-dark-700 ${
                        isRef ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                      } ${locked ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''} hover:bg-gray-50 dark:hover:bg-dark-700/40`}
                    >
                      <td className={invTdClass}>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</span>
                        {isRef ? (
                          <span className="ms-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                            {ar ? 'مرجعي' : 'Reference'}
                          </span>
                        ) : null}
                        {locked ? (
                          <span className="ms-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            {ar ? 'مخزون نشط' : 'Active stock'}
                          </span>
                        ) : null}
                        {u.nameAr ? <div className="text-xs text-slate-400">{u.nameAr}</div> : null}
                      </td>
                      <td className={`${invTdClass} tabular-nums`}>
                        {isEditing && !isRef ? (
                          <input
                            className="input input-sm w-28"
                            value={editDraft.ratio}
                            disabled={locked}
                            onChange={(e) => setEditDraft((d) => ({ ...d, ratio: e.target.value }))}
                          />
                        ) : (
                          <span title={ar ? 'كمية المرجع لكل وحدة واحدة : 'Reference qty per 1 of this unit'}>
                            {isRef ? '1' : (u.ratio ?? '—')}
                          </span>
                        )}
                      </td>
                      <td className={`${invTdClass} tabular-nums`}>
                        {isEditing ? (
                          <input
                            className="input input-sm w-28"
                            value={editDraft.rounding}
                            disabled={locked}
                            onChange={(e) => setEditDraft((d) => ({ ...d, rounding: e.target.value }))}
                          />
                        ) : u.rounding}
                      </td>
                      <td className={`${invTdClass} text-end`}>
                        {isEditing ? (
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              disabled={patchMut.isPending || locked}
                              onClick={() => saveEdit(u)}
                            >
                              {ar ? 'حفظ' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setEditingId(null)}
                            >
                              {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex flex-wrap justify-end gap-1.5">
                            {!isRef ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                disabled={patchMut.isPending}
                                onClick={() => makeReference(u)}
                              >
                                {ar ? 'اجعل مرجع' : 'Set reference'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => startEdit(u)}
                            >
                              {locked ? (ar ? 'مقفل' : 'Locked') : (ar ? 'تعديل' : 'Edit')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfigModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        ar={ar}
        title={ar ? 'وحدة قياس جديدة' : 'New unit of measure'}
        subtitle={catName}
        footer={(
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={createMut.isPending || !form.name.trim()}
              onClick={() => createMut.mutate()}
            >
              {ar ? 'إضافة' : 'Add'}
            </button>
          </>
        )}
      >
        <div className="space-y-3">
          <div>
            <label className="label text-xs">{ar ? 'الاسم' : 'Name'}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={ar ? 'غرام' : 'Gram'}
              autoFocus
            />
          </div>
          <div>
            <label className="label text-xs">{ar ? 'الاسم بالعربي' : 'Arabic name'}</label>
            <input
              className="input"
              value={form.nameAr}
              onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.isReference || !hasReference}
              disabled={!hasReference}
              onChange={(e) => setForm((f) => ({
                ...f,
                isReference: e.target.checked,
                ratio: e.target.checked ? '1' : f.ratio,
              }))}
            />
            {ar ? 'هذه هي الوحدة المرجعية للفئة' : 'This is the reference unit for the category'}
          </label>
          {!(form.isReference || !hasReference) ? (
            <div>
              <label className="label text-xs">
                {ar ? 'النسبة إلى المرجع' : 'Ratio to reference'}
              </label>
              <input
                className="input"
                value={form.ratio}
                onChange={(e) => setForm((f) => ({ ...f, ratio: e.target.value }))}
                placeholder="0.001"
              />
              <p className="mt-1 text-xs text-slate-400">
                {ar
                  ? 'مثال: إذا كان المرجع كغ، الغرام = 0.001 والطن = 1000'
                  : 'e.g. if reference is kg, Gram = 0.001 and Ton = 1000'}
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {ar ? 'النسبة ثابتة عند 1 للوحدة المرجعية.' : 'Ratio is fixed at 1 for the reference unit.'}
            </p>
          )}
          <div>
            <label className="label text-xs">{ar ? 'دقة التقريب' : 'Rounding precision'}</label>
            <input
              className="input"
              value={form.rounding}
              onChange={(e) => setForm((f) => ({ ...f, rounding: e.target.value }))}
            />
          </div>
        </div>
      </ConfigModal>
    </div>
  )
}
