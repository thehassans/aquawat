import { useEffect, useState } from 'react'
import { parseCalendarDate, toDayMonthYear, toIsoDay } from '../../lib/subscriptionState'

/**
 * Text date field that always displays / accepts day-month-year (dd mm yyyy).
 * Emits yyyy-mm-dd on change for API storage. Never uses native type="date"
 * (which follows OS locale and shows mm/dd/yyyy on US Windows).
 */
export default function DayMonthYearInput({
  value = '',
  onChange,
  className = 'input',
  disabled = false,
  placeholder = 'dd mm yyyy',
  name,
  id,
  required = false,
  onBlur,
}) {
  const [text, setText] = useState(() => toDayMonthYear(value))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const next = toDayMonthYear(value)
    // Don't clobber in-progress typing with the same logical day
    if (toIsoDay(text) === toIsoDay(value) && text.trim() !== '') return
    setText(next)
    setInvalid(false)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps -- sync from prop only

  const commit = (raw, { normalize = true } = {}) => {
    const trimmed = String(raw || '').trim()
    if (!trimmed) {
      setText('')
      setInvalid(false)
      onChange?.('')
      return true
    }
    const iso = toIsoDay(trimmed)
    if (!iso) {
      setInvalid(true)
      return false
    }
    setInvalid(false)
    if (normalize) setText(toDayMonthYear(iso))
    onChange?.(iso)
    return true
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      name={name}
      id={id}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      className={`${className}${invalid ? ' border-red-400 focus:border-red-500' : ''}`}
      value={text}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        setInvalid(false)
        // Live-emit when the typed value is a complete valid dd mm yyyy
        const iso = toIsoDay(next)
        if (iso) onChange?.(iso)
      }}
      onBlur={(e) => {
        commit(e.target.value)
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit(e.currentTarget.value)
          e.currentTarget.blur()
        }
      }}
      title={parseCalendarDate(text) || value ? toDayMonthYear(parseCalendarDate(text) || value) : placeholder}
    />
  )
}
