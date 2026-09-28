import { useState } from 'react'

interface Props {
  hidden?: boolean
  lastPartyName: string | null
  dueCount: number
  onNew: () => void
  onLastParty: () => void
  onDue: () => void
}

/** زر + عائم (Speed Dial) — تصميم Apple: فاتورة جديدة / لآخر عميل / المستحقات */
export default function Fab({ hidden, lastPartyName, dueCount, onNew, onLastParty, onDue }: Props) {
  const [open, setOpen] = useState(false)

  if (hidden) return null

  function act(fn: () => void) {
    setOpen(false)
    fn()
  }

  const actions = [
    { icon: '🆕', label: 'فاتورة جديدة', fn: onNew, show: true },
    { icon: '👤', label: lastPartyName ? `لآخر عميل: ${lastPartyName}` : 'فاتورة جديدة', fn: onLastParty, show: !!lastPartyName },
    { icon: '⏰', label: `المستحقات${dueCount > 0 ? ` (${dueCount})` : ''}`, fn: onDue, show: true },
  ].filter((a) => a.show)

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'transparent' }}
        />
      )}
      <div
        style={{
          position: 'fixed', bottom: 108, right: 16, zIndex: 40,
          display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-end', gap: 10,
        }}
      >
        {open && actions.map((a) => (
          <button
            key={a.label}
            onClick={() => act(a.fn)}
            title={a.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--modal-bg)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '0.5px solid var(--separator)',
              borderRadius: 999, padding: '9px 14px 9px 10px',
              color: 'var(--text)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              animation: 'slideUp .18s cubic-bezier(0.34, 1.4, 0.64, 1)',
            }}
          >
            <span style={{ fontSize: 16 }}>{a.icon}</span>
            <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'إغلاق القائمة' : 'إجراءات سريعة'}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#007AFF', color: '#fff', fontSize: 26, fontWeight: 400, lineHeight: 1,
            boxShadow: '0 8px 24px rgba(0, 122, 255, 0.35), 0 2px 8px rgba(0, 122, 255, 0.2)',
            transform: open ? 'rotate(45deg)' : 'rotate(0)',
            transition: 'transform .2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            fontFamily: 'inherit',
          }}
        >
          +
        </button>
      </div>
    </>
  )
}
