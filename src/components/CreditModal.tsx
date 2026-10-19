import { useEffect, useState } from 'react'
import type { Invoice } from '../lib/types'
import { currencySymbol } from '../lib/types'
import Modal from './ui/Modal'
import Icon from './ui/Icon'

interface Props {
  isOpen: boolean
  invoice: Invoice
  onConfirm: (amount: number, reason: string) => void
  onClose: () => void
}

/** إنشاء إشعار دائن/مرتجع مرتبط بفاتورة — يُطبَّق فوراً على الحساب */
export default function CreditModal({ isOpen, invoice, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAmount(String(invoice.total))
      setReason('')
      setError('')
      setSubmitting(false)
    }
  }, [isOpen, invoice])

  const sym = currencySymbol(invoice.currency)
  const isSale = invoice.type === 'sale'

  function submit() {
    if (submitting) return
    const value = Number(amount)
    if (!value || value <= 0) {
      setError('أدخل مبلغاً صحيحاً أكبر من صفر')
      return
    }
    if (value > invoice.total + 0.005) {
      setError(`المبلغ يتجاوز إجمالي الفاتورة (${invoice.total.toLocaleString('en-US')} ${sym})`)
      return
    }
    setSubmitting(true)
    onConfirm(value, reason.trim())
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      variant="sheet"
      size="sm"
      busy={submitting}
      title={isSale ? 'إشعار دائن (مرتجع بيع)' : 'مرتجع مشتريات'}
      description={`فاتورة #${String(invoice.id).padStart(4, '0')} — ${invoice.party}`}
      icon={<Icon name="refresh" />}
      iconTone="violet"
      footer={
        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={submit} disabled={submitting}>
            {submitting ? 'جارٍ الإنشاء…' : 'إنشاء الإشعار'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
            إلغاء
          </button>
        </div>
      }
    >
      <div className="modal-note" style={{ marginBottom: 14 }}>
        <span>إجمالي الفاتورة</span>
        <b style={{ color: 'var(--violet)', fontSize: 15 }} className="t-num">
          {invoice.total.toLocaleString('en-US')} {sym}
        </b>
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field-label" htmlFor="credit-amount">مبلغ الإشعار ({sym})</label>
        <input
          id="credit-amount"
          data-autofocus
          className="input input--num"
          type="number"
          inputMode="decimal"
          min={0}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError('') }}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="credit-reason">السبب <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(اختياري)</span></label>
        <input
          id="credit-reason"
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="بضاعة تالفة، خطأ بالكمية…"
          maxLength={80}
        />
      </div>

      <p className="hint" style={{ marginTop: 10 }}>
        يُطبَّق الإشعار فوراً على حساب الطرف المرتبط بالفاتورة.
      </p>

      {error && (
        <div className="error-text" style={{ marginTop: 12 }}>
          <Icon name="alert" />
          {error}
        </div>
      )}
    </Modal>
  )
}
