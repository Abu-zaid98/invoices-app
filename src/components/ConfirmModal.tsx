import { useEffect } from 'react'

interface Props {
  isOpen: boolean
  variant?: 'danger' | 'warning' | 'info'
  icon: string
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

const VARIANTS = {
  danger: {
    iconBg: 'linear-gradient(135deg,rgba(220,38,38,.3),rgba(185,28,28,.2))',
    iconBorder: 'rgba(220,38,38,.45)',
    btnBg: 'linear-gradient(135deg,#991b1b,#dc2626)',
    btnShadow: 'rgba(220,38,38,.35)',
  },
  warning: {
    iconBg: 'linear-gradient(135deg,rgba(217,119,6,.3),rgba(180,83,9,.2))',
    iconBorder: 'rgba(245,158,11,.45)',
    btnBg: 'linear-gradient(135deg,#92400e,#d97706)',
    btnShadow: 'rgba(245,158,11,.3)',
  },
  info: {
    iconBg: 'linear-gradient(135deg,rgba(37,99,235,.3),rgba(29,78,216,.2))',
    iconBorder: 'rgba(59,130,246,.45)',
    btnBg: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
    btnShadow: 'rgba(59,130,246,.3)',
  },
}

export default function ConfirmModal({
  isOpen,
  variant = 'danger',
  icon,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  onConfirm,
  onCancel,
}: Props) {
  // Esc للإغلاق + منع تمرير الخلفية أثناء فتح المودال
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const v = VARIANTS[variant]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'fadeIn .18s ease',
        }}
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 61,
          width: 'calc(100% - 40px)',
          maxWidth: 380,
          background: 'linear-gradient(160deg,#16213a,#0d1526)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          padding: '32px 24px 24px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          animation: 'confirmSlideUp .22s cubic-bezier(.34,1.56,.64,1)',
          textAlign: 'center',
          direction: 'rtl',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon bubble */}
        <div style={{
          width: 72, height: 72,
          borderRadius: '50%',
          background: v.iconBg,
          border: `1.5px solid ${v.iconBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32,
          margin: '0 auto 18px',
          boxShadow: `0 8px 24px ${v.btnShadow}`,
        }}>
          {icon}
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: 18, fontWeight: 900,
          color: '#f0f4ff',
          marginBottom: 10,
          lineHeight: 1.3,
        }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{
          fontSize: 13.5, color: '#8b96ab',
          lineHeight: 1.7,
          marginBottom: 28,
          padding: '0 8px',
          whiteSpace: 'pre-line',
        }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Confirm */}
          <button
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            onClick={onConfirm}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 14,
              border: 'none',
              background: v.btnBg,
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: `0 6px 20px ${v.btnShadow}`,
              fontFamily: 'inherit',
              transition: 'opacity .15s, transform .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '.88'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {confirmLabel}
          </button>

          {/* Cancel */}
          <button
            onClick={onCancel}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#8b96ab',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            {cancelLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes confirmSlideUp { from { opacity:0; transform:translate(-50%,-44%) } to { opacity:1; transform:translate(-50%,-50%) } }
      `}</style>
    </>
  )
}
