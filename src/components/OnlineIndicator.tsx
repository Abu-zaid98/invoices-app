import { useEffect, useState } from 'react'

/** مؤشر متصل/غير متصل — يوضح أن التطبيق يعمل محلياً دون إنترنت */
export default function OnlineIndicator() {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    function goOnline() {
      setOnline(true)
      setFlash(true)
      setTimeout(() => setFlash(false), 3000)
    }
    function goOffline() {
      setOnline(false)
      setFlash(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online && !flash) return null

  return (
    <div style={{ display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em',
          padding: '6px 14px', borderRadius: 999,
          background: online ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 149, 0, 0.12)',
          border: online ? '0.5px solid rgba(52, 199, 89, 0.3)' : '0.5px solid rgba(255, 149, 0, 0.3)',
          color: online ? '#34C759' : '#FF9500',
          animation: 'fadeIn .2s ease',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: online ? '#34C759' : '#FF9500',
          boxShadow: online ? '0 0 8px #34C759' : '0 0 8px #FF9500',
        }} />
        {online ? 'عاد الاتصال بالإنترنت' : 'غير متصل — التطبيق يعمل على بيانات جهازك 📴'}
      </div>
    </div>
  )
}
