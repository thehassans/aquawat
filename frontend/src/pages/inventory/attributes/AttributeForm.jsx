import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import api from '../../../lib/api'
import { asInvList } from '../../../lib/invList'
import { formatInvError } from '../../../lib/invError'
import { useDirtyGuard } from '../../../lib/useDirtyGuard'

const MODE_OPTIONS = [
  {
    value: 'always',
    en: 'Instantly (Always)',
    ar: 'فوري (دائماً)',
    hintEn: 'Generate all combinations when you click Generate variants',
    hintAr: 'توليد كل التوافيق عند الضغط على توليد المتغيرات',
  },
  {
    value: 'dynamic',
    en: 'Dynamically (Only when added to a Sales Order)',
    ar: 'ديناميكي (عند الإضافة لطلب مبيعات)',
    hintEn: 'Create the variant on demand when used on an order',
    hintAr: 'يُنشأ المتغير عند استخدامه في الطلب',
  },
  {
    value: 'never',
    en: 'Never (No variants — filtering only)',
    ar: 'أبداً (بدون متغيرات — للتصفية فقط)',
    hintEn: 'Informational / filter attribute; not part of the SKU matrix',
    hintAr: 'سمة معلوماتية أو تصفية؛ ليست جزءاً من مصفوفة SKU',
  },
]

const DISPLAY_OPTIONS = [
  { value: 'radio', en: 'Radio Buttons', ar: 'أزرار اختيار' },
  { value: 'select', en: 'Select / Dropdown', ar: 'قائمة منسدلة' },
  { value: 'color', en: 'Color / Pills', ar: 'لون / حبوب' },
]

function newLocalId() {
  return `tmp-${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`
}

function emptyValueRow() {
  return {
    _key: newLocalId(),
    _id: null,
    name: '',
    nameAr: '',
    htmlColor: '#64748b',
    isCustom: false,
    dirty: true,
  }
}

function normalizeDisplayType(t) {
  if (t === 'pill' || t === 'image') return t === 'pill' ? 'color' : 'select'
  if (['radio', 'select', 'color'].includes(t)) return t
  return 'select'
}

/**
 * Dedicated attribute detail form — header fields + inline values grid.
 */
export default function AttributeForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { language } = useSelector((s) => s.ui)
  const ar = language === 'ar'

  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [mode, setMode] = useState('always')
  const [displayType, setDisplayType] = useState('select')
  const [values, setValues] = useState([])
  const [removedIds, setRemovedIds] = useState([])
  const [dirty, setDirty] = useState(false)
  const draftNameRef = useRef(null)

  useDirtyGuard(dirty, ar ? 'لديك تغييرات غير محفوظة' : 'You have unsaved changes')

  const { data: attr, isLoading: attrLoading } = useQuery({
    queryKey: ['inv-attribute', id],
    queryFn: () => api.get(`/stock/attributes/${id}`).then((r) => r.data),
    enabled: !isNew,
  })

  const { data: valuesData, isLoading: valuesLoading } = useQuery({
    queryKey: ['inv-attribute-values', id],
    queryFn: () => api.get(`/stock/attributes/${id}/values`).then((r) => asInvList(r.data)),
    enabled: !isNew,
  })

  useEffect(() => {
    if (isNew) {
      setName('')
      setNameAr('')
      setMode('always')
      setDisplayType('select')
      setValues([])
      setRemovedIds([])
      setDirty(false)
      return
    }
    if (!attr) return
    setName(attr.name || '')
    setNameAr(attr.nameAr || '')
    setMode(attr.createVariantMode || (attr.createVariant === false ? 'never' : 'always'))
    setDisplayType(normalizeDisplayType(attr.displayType))
    setDirty(false)
  }, [isNew, attr])

  useEffect(() => {
    if (isNew || !valuesData) return
    setValues(
      (valuesData || []).map((v) => ({
        _key: String(v._id),
        _id: v._id,
        name: v.name || '',
        nameAr: v.nameAr || '',
        htmlColor: v.htmlColor || '#64748b',
        isCustom: !!v.isCustom,
        dirty: false,
      })),
    )
    setRemovedIds([])
  }, [isNew, valuesData])

  const showColorCol = displayType === 'color'
  const modeMeta = MODE_OPTIONS.find((o) => o.value === mode) || MODE_OPTIONS[0]

  const updateValue = (key, patch) => {
    setValues((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch, dirty: true } : r)))
    setDirty(true)
  }

  const addLine = () => {
    const row = emptyValueRow()
    setValues((rows) => [...rows, row])
    setDirty(true)
    requestAnimationFrame(() => {
      draftNameRef.current?.focus()
    })
  }

  const removeLine = (row) => {
    setValues((rows) => rows.filter((r) => r._key !== row._key))
    if (row._id) setRemovedIds((ids) => [...ids, row._id])
    setDirty(true)
  }

  const commitDraftOnEnter = (e, row) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const nameTrim = String(row.name || '').trim()
    if (!nameTrim) {
      toast.error(ar ? 'اسم القيمة مطلوب' : 'Value name is required')
      return
    }
    // Keep in local form state; add another blank line for fast entry
    if (!values.some((v) => v._key !== row._key && !String(v.name || '').trim())) {
      addLine()
    } else {
      e.currentTarget.blur()
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const nameTrim = String(name || '').trim()
      if (!nameTrim) throw Object.assign(new Error('Attribute name required'), { code: 'ATTR_NAME' })

      const payload = {
        name: nameTrim,
        nameAr: String(nameAr || '').trim() || undefined,
        createVariantMode: mode,
        displayType,
      }

      let attrId = id
      if (isNew) {
        const created = await api.post('/stock/attributes', payload).then((r) => r.data)
        attrId = created._id
      } else {
        await api.patch(`/stock/attributes/${id}`, payload)
      }

      for (const rid of removedIds) {
        // eslint-disable-next-line no-await-in-loop
        await api.delete(`/stock/attribute-values/${rid}`)
      }

      for (const [idx, row] of values.entries()) {
        const vName = String(row.name || '').trim()
        if (!vName) continue
        const body = {
          name: vName,
          nameAr: String(row.nameAr || '').trim() || undefined,
          htmlColor: showColorCol ? (row.htmlColor || undefined) : undefined,
          isCustom: !!row.isCustom,
          sequence: (idx + 1) * 10,
        }
        if (row._id) {
          if (row.dirty) {
            // eslint-disable-next-line no-await-in-loop
            await api.patch(`/stock/attribute-values/${row._id}`, body)
          }
        } else {
          // eslint-disable-next-line no-await-in-loop
          await api.post(`/stock/attributes/${attrId}/values`, body)
        }
      }

      return attrId
    },
    onSuccess: (attrId) => {
      toast.success(ar ? 'تم الحفظ' : 'Saved')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['inv-attributes'] })
      qc.invalidateQueries({ queryKey: ['inv-attribute', attrId] })
      qc.invalidateQueries({ queryKey: ['inv-attribute-values', attrId] })
      if (isNew) navigate(`/app/dashboard/inventory/attributes/${attrId}`, { replace: true })
    },
    onError: (e) => {
      if (e?.code === 'ATTR_NAME' || e?.message === 'Attribute name required') {
        toast.error(ar ? 'اسم السمة مطلوب' : 'Attribute name is required')
        return
      }
      toast.error(formatInvError(e, language))
    },
  })

  const loading = !isNew && (attrLoading || valuesLoading)

  const title = useMemo(() => {
    if (isNew) return ar ? 'سمة جديدة' : 'New attribute'
    return ar && nameAr ? nameAr : (name || (ar ? 'تعديل السمة' : 'Edit attribute'))
  }, [isNew, ar, name, nameAr])

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">{ar ? 'جاري التحميل…' : 'Loading…'}</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/app/dashboard/inventory/attributes"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-50 dark:bg-dark-800 dark:text-slate-300 dark:ring-dark-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              {ar ? 'السمات' : 'Attributes'}
            </p>
            <h1 className="truncate text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          disabled={saveMut.isPending}
          onClick={() => saveMut.mutate()}
        >
          <Save className="h-4 w-4" />
          {saveMut.isPending ? '…' : (ar ? 'حفظ' : 'Save')}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] dark:border-dark-600 dark:bg-dark-800">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
          {ar ? 'بيانات السمة' : 'Attribute details'}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">
              {ar ? 'اسم السمة (إنجليزي)' : 'Attribute name (EN)'}
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600/40 focus:bg-white focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-900 dark:text-slate-100"
              value={name}
              onChange={(e) => { setName(e.target.value); setDirty(true) }}
              placeholder={ar ? 'Color' : 'Color'}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">
              {ar ? 'اسم السمة (عربي)' : 'Attribute name (AR)'}
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600/40 focus:bg-white focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-900 dark:text-slate-100"
              value={nameAr}
              onChange={(e) => { setNameAr(e.target.value); setDirty(true) }}
              placeholder={ar ? 'اللون' : 'اللون'}
              dir="rtl"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">
              {ar ? 'وضع إنشاء المتغير' : 'Variant creation mode'}
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600/40 focus:bg-white focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-900 dark:text-slate-100"
              value={mode}
              onChange={(e) => { setMode(e.target.value); setDirty(true) }}
            >
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
              {ar ? modeMeta.hintAr : modeMeta.hintEn}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">
              {ar ? 'نوع العرض' : 'Display type'}
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-600/40 focus:bg-white focus:ring-2 focus:ring-sky-700/10 dark:border-dark-600 dark:bg-dark-900 dark:text-slate-100"
              value={displayType}
              onChange={(e) => { setDisplayType(e.target.value); setDirty(true) }}
            >
              {DISPLAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
              {ar
                ? 'يُستخدم لاحقاً في نقاط البيع والتجارة الإلكترونية'
                : 'Used later for POS / e-commerce pickers'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] dark:border-dark-600 dark:bg-dark-800">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              {ar ? 'قيم السمة' : 'Attribute values'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {ar
                ? 'عدّل الصف مباشرة · Enter لإضافة سطر تالي · احفظ النموذج عند الانتهاء'
                : 'Edit inline · Enter adds the next line · Save the form when done'}
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100 dark:border-dark-600">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-start text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:border-dark-600 dark:bg-dark-900/50">
                <th className="min-w-[160px] px-3 py-2.5">{ar ? 'القيمة (EN)' : 'Value name (EN)'}</th>
                <th className="min-w-[160px] px-3 py-2.5">{ar ? 'القيمة (AR)' : 'Value name (AR)'}</th>
                {showColorCol && (
                  <th className="min-w-[140px] px-3 py-2.5">{ar ? 'لون / Hex' : 'Color / Hex'}</th>
                )}
                <th className="min-w-[120px] px-3 py-2.5">{ar ? 'قيمة مخصصة' : 'Is custom'}</th>
                <th className="w-12 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-dark-700">
              {values.map((row, idx) => {
                const isLast = idx === values.length - 1
                return (
                  <tr key={row._key} className="align-middle">
                    <td className="px-2 py-1.5">
                      <input
                        ref={isLast ? draftNameRef : undefined}
                        className="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-slate-900 outline-none hover:border-slate-200 focus:border-sky-600/40 focus:bg-slate-50 dark:text-slate-100 dark:focus:bg-dark-900"
                        value={row.name}
                        onChange={(e) => updateValue(row._key, { name: e.target.value })}
                        onKeyDown={(e) => commitDraftOnEnter(e, row)}
                        placeholder={ar ? 'مثلاً Red' : 'e.g. Red'}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-slate-900 outline-none hover:border-slate-200 focus:border-sky-600/40 focus:bg-slate-50 dark:text-slate-100 dark:focus:bg-dark-900"
                        value={row.nameAr}
                        dir="rtl"
                        onChange={(e) => updateValue(row._key, { nameAr: e.target.value })}
                        onKeyDown={(e) => commitDraftOnEnter(e, row)}
                        placeholder={ar ? 'أحمر' : 'أحمر'}
                      />
                    </td>
                    {showColorCol && (
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            className="h-8 w-8 cursor-pointer rounded-md border border-slate-200 bg-white p-0.5 dark:border-dark-500"
                            value={/^#[0-9A-Fa-f]{6}$/.test(row.htmlColor) ? row.htmlColor : '#64748b'}
                            onChange={(e) => updateValue(row._key, { htmlColor: e.target.value })}
                          />
                          <input
                            className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-2 font-mono text-xs text-slate-700 outline-none hover:border-slate-200 focus:border-sky-600/40 focus:bg-slate-50 dark:text-slate-200"
                            value={row.htmlColor || ''}
                            onChange={(e) => updateValue(row._key, { htmlColor: e.target.value })}
                            placeholder="#RRGGBB"
                          />
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-1.5">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-sky-700 focus:ring-sky-600/30"
                          checked={!!row.isCustom}
                          onChange={(e) => updateValue(row._key, { isCustom: e.target.checked })}
                        />
                        {ar ? 'مخصص' : 'Custom'}
                      </label>
                    </td>
                    <td className="px-2 py-1.5 text-end">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => removeLine(row)}
                        aria-label={ar ? 'حذف' : 'Remove'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!values.length && (
                <tr>
                  <td
                    colSpan={showColorCol ? 5 : 4}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    {ar ? 'لا قيم بعد — أضف سطراً أدناه' : 'No values yet — add a line below'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mt-3 text-sm font-medium text-sky-800 hover:text-sky-950 hover:underline dark:text-sky-400"
        >
          {ar ? '+ إضافة سطر' : '+ Add a line'}
        </button>
      </div>
    </div>
  )
}
