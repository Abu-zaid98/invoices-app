import { useEffect, useState } from 'react'
import type { Invoice } from '../lib/types'
import { currencySymbol } from '../lib/types'

interface Props {
  isOpen: boolean
  invoice: Invoice
  onConfirm: (amount: number, reason: string) => void
  onClose: () => void
}

/** مودال إنشاء إشعار دائن/مرتجع مرتبط بفاتورة — تصميم Apple */
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
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'fadeIn .2s ease',
        }}
      />
      <div
        role="dialog" aria-modal="true" aria-label="إشعار دائن"
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
          direction: 'rtl', textAlign: 'center',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
          background: 'rgba(88, 86, 214, 0.12)',
          border: '1px solid rgba(88, 86, 214, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}>
          ↩️
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 6 }}>
          {isSale ? 'إشعار دائن (مرتجع بيع)' : 'مرتجع مشتريات'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.8, fontWeight: 400 }}>
          فاتورة #{String(invoice.id).padStart(4, '0')} — {invoice.party}
          <br />
          الإجمالي: <b style={{ color: '#5856D6' }}>{invoice.total.toLocaleString('en-US')} {sym}</b>
          {' · '}يُطبَّق فوراً على الحساب
        </p>

        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, textAlign: 'right', fontWeight: 500 }}>
          مبلغ الإشعار ({sym})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError('') }}
          min={0}
          style={{
            width: '100%', borderRadius: '12px', border: '0.5px solid var(--separator)',
            background: 'var(--modal-field)', color: 'var(--text)',
            padding: '12px 14px', fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
            outline: 'none', textAlign: 'center', boxSizing: 'border-box',
            boxShadow: 'var(--shadow-sm)',
          }}
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السبب (اختياري: بضاعة تالفة، خطأ بالكمية...)"
          maxLength={80}
          style={{
            width: '100%', borderRadius: '12px', border: '0.5px solid var(--separator)',
            background: 'var(--modal-field)', color: 'var(--text)',
            padding: '10px 14px', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginTop: 8,
            boxShadow: 'var(--shadow-sm)',
          }}
        />
        {error && (
          <div style={{
            marginTop: 8, fontSize: 12.5, fontWeight: 500, color: '#FF3B30',
            background: 'rgba(255, 59, 48, 0.08)', border: '0.5px solid rgba(255, 59, 48, 0.2)',
            borderRadius: '10px', padding: '8px 12px',
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <button
            onClick={submit}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: '#5856D6', color: '#fff', fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.01em', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(88, 86, 214, 0.25)',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            ↩️ إنشاء الإشعار
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px',
              border: '0.5px solid var(--separator)', background: 'var(--modal-field)',
              color: 'var(--text)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </>
  )
}
