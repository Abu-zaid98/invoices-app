import { useState } from 'react'

interface Props {
  hidden?: boolean
  lastPartyName: string | null
  dueCount: number
  onNew: () => void
  onLastParty: () => void
  onDue: () => void
}

/** زر + عائم (Speed Dial): فاتورة جديدة / لآخر عميل / المستحقات */
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
      {/* Backdrop لإغلاق القائمة */}
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
              background: 'linear-gradient(160deg,#1c2547,#10182c)',
              border: '1px solid rgba(255,176,32,0.35)',
              borderRadius: 999, padding: '9px 14px 9px 10px',
              color: '#f0f4ff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 10px 26px rgba(0,0,0,0.5)',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              animation: 'fabIn .18s cubic-bezier(.34,1.4,.64,1)',
            }}
          >
            <span style={{ fontSize: 16 }}>{a.icon}</span>
            <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.label}</span>
          </button>
        ))}
        {/* الزر الرئيسي */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'إغلاق القائمة' : 'إجراءات سريعة'}
          style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,var(--brand),var(--brand2))',
            color: '#1a1200', fontSize: 26, fontWeight: 900, lineHeight: 1,
            boxShadow: '0 10px 28px rgba(255,176,32,0.4)',
            transform: open ? 'rotate(45deg)' : 'rotate(0)',
            transition: 'transform .2s',
            fontFamily: 'inherit',
          }}
        >
          +
        </button>
      </div>
      <style>{`@keyframes fabIn { from { opacity:0; transform:translateY(8px) scale(.95) } to { opacity:1; transform:translateY(0) scale(1) } }`}</style>
    </>
  )
}
