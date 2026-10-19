import { useEffect, useState } from 'react'
import Icon from './ui/Icon'

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
      <div className={`badge ${online ? 'badge--success' : 'badge--warning'}`} style={{ animation: 'fadeIn .2s ease', padding: '6px 14px' }}>
        <Icon name={online ? 'checkCircle' : 'alert'} size={15} />
        {online ? 'عاد الاتصال بالإنترنت' : 'غير متصل — التطبيق يعمل على بيانات جهازك'}
      </div>
    </div>
  )
}
