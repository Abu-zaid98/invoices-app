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
    iconBg: 'rgba(255, 59, 48, 0.12)',
    iconBorder: 'rgba(255, 59, 48, 0.3)',
    btnBg: '#FF3B30',
    btnShadow: 'rgba(255, 59, 48, 0.25)',
  },
  warning: {
    iconBg: 'rgba(255, 149, 0, 0.12)',
    iconBorder: 'rgba(255, 149, 0, 0.3)',
    btnBg: '#FF9500',
    btnShadow: 'rgba(255, 149, 0, 0.25)',
  },
  info: {
    iconBg: 'rgba(0, 122, 255, 0.12)',
    iconBorder: 'rgba(0, 122, 255, 0.3)',
    btnBg: '#007AFF',
    btnShadow: 'rgba(0, 122, 255, 0.25)',
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
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'fadeIn .2s ease',
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 61,
          width: 'calc(100% - 48px)', maxWidth: 340,
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '0.5px solid var(--separator)',
          borderRadius: '20px',
          padding: '28px 20px 20px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.08)',
          animation: 'scaleIn .25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
          background: v.iconBg,
          border: `1px solid ${v.iconBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>
          {icon}
        </div>
        <h3 style={{
          fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
          color: 'var(--text)', marginBottom: 8, lineHeight: 1.3,
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: 13, color: 'var(--muted)', fontWeight: 400,
          lineHeight: 1.6, marginBottom: 24, padding: '0 4px',
          whiteSpace: 'pre-line',
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            autoFocus
            onClick={onConfirm}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: v.btnBg, color: '#fff', fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.01em', cursor: 'pointer',
              boxShadow: `0 4px 14px ${v.btnShadow}`,
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px',
              border: '0.5px solid var(--separator)', background: 'var(--modal-field)',
              color: 'var(--text)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </>
  )
}
