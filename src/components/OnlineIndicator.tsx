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
          fontSize: 12, fontWeight: 800,
          padding: '6px 14px', borderRadius: 999,
          background: online ? 'rgba(34,201,163,0.15)' : 'rgba(245,158,11,0.15)',
          border: online ? '1px solid rgba(34,201,163,0.4)' : '1px solid rgba(245,158,11,0.4)',
          color: online ? '#5eead4' : '#fcd34d',
          animation: 'fadeIn .2s ease',
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: online ? '#22c9a3' : '#f59e0b',
          boxShadow: online ? '0 0 8px #22c9a3' : '0 0 8px #f59e0b',
        }} />
        {online ? 'عاد الاتصال بالإنترنت' : 'غير متصل — التطبيق يعمل على بيانات جهازك 📴'}
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  )
}
