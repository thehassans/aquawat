import { useEffect, useState } from 'react'

/** Debounce a value — useful for search inputs hitting the API. */
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
