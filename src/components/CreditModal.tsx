import { useEffect, useState } from 'react'
import type { Invoice } from '../lib/types'
import { currencySymbol } from '../lib/types'

interface Props {
  isOpen: boolean
  invoice: Invoice
  onConfirm: (amount: number, reason: string) => void
  onClose: () => void
}

/** مودال إنشاء إشعار دائن/مرتجع مرتبط بفاتورة */
export default function CreditModal({ isOpen, invoice, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setAmount(String(invoice.total))
      setReason('')
      setError('')
    }
  }, [isOpen, invoice])

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

  const sym = currencySymbol(invoice.currency)
  const isSale = invoice.type === 'sale'

  function submit() {
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('أدخل مبلغاً صحيحاً أكبر من صفر')
      return
    }
    if (value > invoice.total + 0.005) {
      setError(`المبلغ يتجاوز إجمالي الفاتورة (${invoice.total.toLocaleString('en-US')} ${sym})`)
      return
    }
    onConfirm(value, reason.trim())
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
        role="dialog" aria-modal="true" aria-label="إشعار دائن"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', zIndex: 61,
          width: 'calc(100% - 40px)', maxWidth: 360,
          background: 'linear-gradient(160deg,#1c2547,#0d1526)',
          border: '1px solid rgba(139,92,246,0.4)', borderRadius: 24,
          padding: '28px 22px 22px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          animation: 'confirmSlideUp .22s cubic-bezier(.34,1.56,.64,1)',
          direction: 'rtl', textAlign: 'center',
        }}
      >
        <div style={{
          width: 60, height: 60, borderRadius: '50%', margin: '0 auto 14px',
          background: 'linear-gradient(135deg,rgba(139,92,246,.35),rgba(46,139,255,.2))',
          border: '1.5px solid rgba(139,92,246,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          ↩️
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 900, color: '#f0f4ff', marginBottom: 6 }}>
          {isSale ? 'إشعار دائن (مرتجع بيع)' : 'مرتجع مشتريات'}
        </h3>
        <p style={{ fontSize: 12.5, color: '#8b96ab', marginBottom: 16, lineHeight: 1.8 }}>
          فاتورة #{String(invoice.id).padStart(4, '0')} — {invoice.party}
          <br />
          الإجمالي: <b style={{ color: '#c4b5fd' }}>{invoice.total.toLocaleString('en-US')} {sym}</b>
          {' · '}يُطبَّق فوراً على الحساب
        </p>

        <label style={{ display: 'block', fontSize: 12, color: '#8b96ab', marginBottom: 6, textAlign: 'right' }}>
          مبلغ الإشعار ({sym})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError('') }}
          min={0}
          style={{
            width: '100%', borderRadius: 12, border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text)',
            padding: '12px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            outline: 'none', textAlign: 'center', boxSizing: 'border-box',
          }}
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السبب (اختياري: بضاعة تالفة، خطأ بالكمية...)"
          maxLength={80}
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
            onClick={submit}
            style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,#6d28d9,#2563eb)',
              color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ↩️ إنشاء الإشعار
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
