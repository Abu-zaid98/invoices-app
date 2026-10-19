import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Icon from './ui/Icon'

/**
 * إشعار توفّر تحديث جديد للتطبيق.
 * يتحقّق من وجود تحديث عند فتح التطبيق وعند العودة إليه (visibilitychange).
 */
export default function UpdatePrompt() {
  const regRef = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const lastCheck = useRef(0)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      regRef.current = registration
    },
  })

  useEffect(() => {
    // نتحقّق عند الفتح وعند العودة للتطبيق، مع تهيئة كي لا نتكرّر بلا داعٍ
    const check = (force = false) => {
      const now = Date.now()
      if (!force && now - lastCheck.current < 30 * 60 * 1000) return
      lastCheck.current = now
      regRef.current?.update().catch(() => {})
    }
    check(true)
    const onReturn = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
    }
  }, [])

  if (!needRefresh) return null

  return (
    <div className="pwa-toast pwa-toast--update" role="alert">
      <div className="pwa-toast-head">
        <span className="pwa-toast-icon">
          <Icon name="sparkles" />
        </span>
        <div className="pwa-toast-main">
          <div className="pwa-toast-title">تحديث جديد متاح</div>
          <div className="pwa-toast-sub">أعد التحميل للحصول على أحدث المزايا والإصلاحات</div>
        </div>
        <button type="button" className="pwa-toast-x" onClick={() => setNeedRefresh(false)} aria-label="إغلاق">
          <Icon name="x" />
        </button>
      </div>
      <div className="pwa-toast-actions">
        <button type="button" className="btn btn--sm pwa-toast-btn" onClick={() => updateServiceWorker(true)}>
          <Icon name="refresh" size={15} />
          تحديث الآن
        </button>
      </div>
    </div>
  )
}
