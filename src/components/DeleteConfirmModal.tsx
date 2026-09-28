import { useEffect } from 'react'

/**
 * DeleteConfirmModal — مودال حذف مخصص ومميز
 * تصميم Apple: أيقونة في دائرة حمراء، خلفية زجاجية، زوايا دائرية واسعة
 */

interface Props {
  isOpen: boolean
  title?: string
  itemName?: string
  itemMeta?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({
  isOpen,
  title = 'حذف نهائي؟',
  itemName,
  itemMeta,
  message = 'هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.',
  confirmLabel = 'نعم، احذف نهائياً',
  cancelLabel = 'تراجع',
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
          background: 'rgba(255, 59, 48, 0.12)',
          border: '1px solid rgba(255, 59, 48, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>
          🗑️
        </div>
        <h3 style={{
          fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em',
          color: 'var(--text)', marginBottom: 8, lineHeight: 1.3,
        }}>
          {title}
        </h3>
        {(itemName || itemMeta) && (
          <div style={{
            background: 'rgba(255, 59, 48, 0.06)',
            border: '0.5px solid rgba(255, 59, 48, 0.15)',
            borderRadius: '12px', padding: '10px 14px', marginBottom: 12,
          }}>
            {itemName && (
              <div style={{ fontSize: 14, fontWeight: 600, color: '#FF3B30', lineHeight: 1.5 }}>
                {itemName}
              </div>
            )}
            {itemMeta && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>
                {itemMeta}
              </div>
            )}
          </div>
        )}
        <p style={{
          fontSize: 13, color: 'var(--muted)', fontWeight: 400,
          lineHeight: 1.6, marginBottom: 24, whiteSpace: 'pre-line',
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            autoFocus
            onClick={onConfirm}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: '#FF3B30', color: '#fff', fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.01em', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(255, 59, 48, 0.25)',
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
