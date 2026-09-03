import { useEffect, useState, useRef } from 'react'
import { getAuthToken } from '../lib/authStorage'

export function useZatcaQueueStream() {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.EventSource) return

    const token = getAuthToken()
    if (!token) return

    const url = `${import.meta.env.VITE_API_URL || '/api'}/super-admin/zatca/queue/stream`

    try {
      const es = new EventSource(url, { withCredentials: true })
      eventSourceRef.current = es

      es.onopen = () => setConnected(true)
      es.onerror = () => {
        setConnected(false)
        es.close()
        setTimeout(() => {
          if (eventSourceRef.current === es) {
            try {
              eventSourceRef.current = new EventSource(url, { withCredentials: true })
            } catch {}
          }
        }, 10000)
      }

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'connected') {
            setConnected(true)
          } else if (parsed.type === 'queue-status') {
            setData(parsed)
          }
        } catch {}
      }
    } catch {}

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  return { data, connected }
}
