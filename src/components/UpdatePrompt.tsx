import { useRegisterSW } from 'virtual:pwa-register/react'

/** إشعار توفر نسخة جديدة من التطبيق (PWA update) — تصميم Apple */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', bottom: 86, left: 0, right: 0, zIndex: 56,
        display: 'flex', justifyContent: 'center', padding: '0 16px',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        pointerEvents: 'auto', width: '100%', maxWidth: 508,
        background: 'var(--modal-bg)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '0.5px solid var(--separator)',
        borderRadius: '20px', padding: '12px 16px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.06)',
        animation: 'slideUp .3s cubic-bezier(0.34, 1.4, 0.64, 1)',
        direction: 'rtl', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 26 }}>🚀</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>تحديث جديد متاح</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>أعد التحميل للحصول على أحدث المزايا</div>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            padding: '9px 16px', borderRadius: '12px', border: 'none',
            background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600,
            letterSpacing: '-0.01em', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)',
            transition: 'all 0.15s ease',
          }}
        >
          تحديث
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="إغلاق"
          style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
