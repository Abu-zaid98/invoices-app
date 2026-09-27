import { useRegisterSW } from 'virtual:pwa-register/react'

/** إشعار توفر نسخة جديدة من التطبيق (PWA update) */
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
        background: 'linear-gradient(160deg,#1a2340,#0d1526)',
        border: '1px solid rgba(46,139,255,0.4)', borderRadius: 20, padding: '12px 14px',
        boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
        animation: 'installUp .3s cubic-bezier(.34,1.4,.64,1)',
        direction: 'rtl', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 26 }}>🚀</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 900, color: '#fff' }}>تحديث جديد متاح</div>
          <div style={{ fontSize: 11.5, color: '#9aa5b8' }}>أعد التحميل للحصول على أحدث المزايا</div>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            padding: '9px 16px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg,var(--brand),var(--brand2))',
            color: '#1a1200', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          تحديث
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="إغلاق"
          style={{ background: 'transparent', border: 'none', color: '#8b96ab', fontSize: 15, cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
      <style>{`@keyframes installUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
