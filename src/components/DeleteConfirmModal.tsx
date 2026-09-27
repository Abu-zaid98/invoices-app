import { useEffect } from 'react'

/**
 * DeleteConfirmModal — مودال حذف مخصص ومميز
 * تصميم مختلف تماماً عن ConfirmModal العام:
 * توهج أحمر علوي + حلقة نبض حول سلة المهملات + بطاقة تفاصيل العنصر + شريط تحذير
 */

interface Props {
  isOpen: boolean
  title?: string
  /** اسم العنصر المحذوف (مثال: اسم العميل / رمز العملة / اسم الصنف) */
  itemName?: string
  /** سطر تفاصيل إضافي (مثال: رقم الفاتورة + المبلغ) */
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
          background: 'rgba(20,0,0,0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'fadeIn .18s ease',
        }}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 61,
          width: 'calc(100% - 40px)',
          maxWidth: 380,
          background: 'linear-gradient(165deg,#2a0f14 0%,#14101c 45%,#0d1526 100%)',
          border: '1px solid rgba(255,90,95,0.3)',
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 32px 90px rgba(220,38,38,0.25), 0 32px 80px rgba(0,0,0,0.6)',
          animation: 'deletePop .25s cubic-bezier(.34,1.56,.64,1)',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        {/* Top red glow line */}
        <div style={{
          height: 4,
          background: 'linear-gradient(90deg,transparent,#dc2626 20%,#ff5a5f 50%,#dc2626 80%,transparent)',
          boxShadow: '0 0 18px rgba(220,38,38,0.8)',
        }} />

        <div style={{ padding: '28px 24px 24px' }}>
          {/* Trash icon with pulse ring */}
          <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto 16px' }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(220,38,38,0.4)',
              animation: 'deletePulse 1.6s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 8,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,rgba(220,38,38,.45),rgba(153,27,27,.3))',
              border: '1.5px solid rgba(255,90,95,.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 34,
              boxShadow: '0 10px 30px rgba(220,38,38,.45)',
            }}>
              🗑️
            </div>
          </div>

          <h3 style={{ fontSize: 19, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
            {title}
          </h3>

          {/* Item details card */}
          {(itemName || itemMeta) && (
            <div style={{
              background: 'rgba(220,38,38,0.08)',
              border: '1px dashed rgba(255,90,95,0.35)',
              borderRadius: 14,
              padding: '10px 14px',
              marginBottom: 12,
            }}>
              {itemName && (
                <div style={{ fontSize: 14, fontWeight: 800, color: '#ffb4b6', lineHeight: 1.5 }}>
                  {itemName}
                </div>
              )}
              {itemMeta && (
                <div style={{ fontSize: 12, color: '#8b96ab', marginTop: 2, lineHeight: 1.5 }}>
                  {itemMeta}
                </div>
              )}
            </div>
          )}

          <p style={{
            fontSize: 13.5, color: '#9aa5b8',
            lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-line',
          }}>
            {message}
          </p>

          {/* Warning strip */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 10,
            padding: '7px 12px',
            fontSize: 12, fontWeight: 700, color: '#fcd34d',
            marginBottom: 22,
          }}>
            <span>⚠️</span>
            <span>لا يمكن التراجع عن هذا الإجراء</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onClick={onConfirm}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#991b1b,#dc2626 60%,#ef4444)',
                color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 8px 26px rgba(220,38,38,.45)',
                fontFamily: 'inherit',
                transition: 'opacity .15s, transform .15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '.9'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              style={{
                width: '100%', padding: '13px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#cbd5e1', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes deletePop { from { opacity:0; transform:translate(-50%,-44%) scale(.96) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
        @keyframes deletePulse { 0% { transform:scale(.85); opacity:1 } 100% { transform:scale(1.25); opacity:0 } }
      `}</style>
    </>
  )
}
