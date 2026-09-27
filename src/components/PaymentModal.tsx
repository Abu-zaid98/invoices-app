import { useEffect, useState } from 'react'
import type { Invoice } from '../lib/types'
import { currencySymbol, invoiceBalance } from '../lib/types'

interface Props {
  isOpen: boolean
  invoice: Invoice
  onConfirm: (amount: number, note: string) => void
  onClose: () => void
}

/** مودال تسجيل دفعة على فاتورة */
export default function PaymentModal({ isOpen, invoice, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setNote('')
      setError('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const remaining = invoiceBalance(invoice)
  const sym = currencySymbol(invoice.currency)

  function submit(value: number) {
    if (!value || value <= 0) {
      setError('أدخل مبلغاً صحيحاً أكبر من صفر')
      return
    }
    if (value > remaining + 0.005) {
      setError(`المبلغ يتجاوز المتبقي (${remaining.toLocaleString('en-US')} ${sym})`)
      return
    }
    onConfirm(value, note)
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)', animation: 'fadeIn .18s ease',
        }}
      />
      <div
        role="dialog" aria-modal="true" aria-label="تسجيل دفعة"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', zIndex: 61,
          width: 'calc(100% - 40px)', maxWidth: 360,
          background: 'linear-gradient(160deg,#16213a,#0d1526)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
          padding: '28px 22px 22px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          animation: 'confirmSlideUp .22s cubic-bezier(.34,1.56,.64,1)',
          direction: 'rtl', textAlign: 'center',
        }}
      >
        <div style={{
          width: 60, height: 60, borderRadius: '50%', margin: '0 auto 14px',
          background: 'linear-gradient(135deg,rgba(34,201,163,.3),rgba(46,139,255,.2))',
          border: '1.5px solid rgba(34,201,163,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          💵
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 900, color: '#f0f4ff', marginBottom: 6 }}>
          تسجيل دفعة
        </h3>
        <p style={{ fontSize: 12.5, color: '#8b96ab', marginBottom: 4 }}>
          فاتورة #{String(invoice.id).padStart(4, '0')} — {invoice.party}
        </p>
        <p style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 16 }}>
          المتبقي: <b style={{ color: 'var(--brand)' }}>{remaining.toLocaleString('en-US')} {sym}</b>
        </p>

        <button
          onClick={() => submit(remaining)}
          style={{
            width: '100%', padding: '10px', borderRadius: 12, marginBottom: 10,
            border: '1px solid rgba(34,201,163,0.4)', background: 'rgba(34,201,163,0.1)',
            color: '#5eead4', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ✅ تسديد كامل المتبقي ({remaining.toLocaleString('en-US')} {sym})
        </button>

        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError('') }}
          placeholder={`مبلغ الدفعة بـ ${sym}`}
          min={0}
          style={{
            width: '100%', borderRadius: 12, border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
            padding: '12px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            outline: 'none', textAlign: 'center', boxSizing: 'border-box',
          }}
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ملاحظة (اختياري: نقداً، تحويل...)"
          maxLength={60}
          style={{
            width: '100%', borderRadius: 12, border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
            padding: '10px 12px', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginTop: 8,
          }}
        />
        {error && (
          <div style={{
            marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#ff8a8e',
            background: 'rgba(255,90,95,0.1)', border: '1px solid rgba(255,90,95,0.3)',
            borderRadius: 10, padding: '7px 12px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          <button
            onClick={() => submit(Number(amount))}
            style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,var(--brand),var(--brand2))',
              color: '#1a1200', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            💾 حفظ الدفعة
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
              color: '#8b96ab', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes confirmSlideUp { from { opacity:0; transform:translate(-50%,-44%) } to { opacity:1; transform:translate(-50%,-50%) } }
      `}</style>
    </>
  )
}
