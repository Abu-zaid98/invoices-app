import { useEffect, useState } from 'react'
import type { Invoice } from '../lib/types'
import { currencySymbol } from '../lib/types'
import Modal from './ui/Modal'
import Icon from './ui/Icon'

interface Props {
  isOpen: boolean
  invoice: Invoice
  onConfirm: (amount: number, note: string) => void
  onClose: () => void
}

/** تسجيل دفعة على فاتورة — نموذج منظّم داخل Bottom Sheet مع عرض المتبقي */
export default function PaymentModal({ isOpen, invoice, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setNote('')
      setError('')
      setSubmitting(false)
    }
  }, [isOpen])

  const remaining = Math.max(0, invoice.total - (invoice.paidAmount || 0))
  const sym = currencySymbol(invoice.currency)

  function submit(value: number) {
    if (submitting) return
    if (!value || value <= 0) {
      setError('أدخل مبلغاً صحيحاً أكبر من صفر')
      return
    }
    if (value > remaining + 0.005) {
      setError(`المبلغ يتجاوز المتبقي (${remaining.toLocaleString('en-US')} ${sym})`)
      return
    }
    setSubmitting(true)
    onConfirm(value, note.trim())
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      variant="sheet"
      size="sm"
      busy={submitting}
      title="تسجيل دفعة"
      description={`فاتورة #${String(invoice.id).padStart(4, '0')} — ${invoice.party}`}
      icon={<Icon name="cash" />}
      iconTone="success"
      footer={
        <div style={{ display: 'flex', gap: 9 }}>
          <button
            type="button"
            className="btn btn--primary"
            style={{ flex: 1 }}
            onClick={() => submit(Number(amount))}
            disabled={submitting}
          >
            {submitting ? 'جارٍ الحفظ…' : 'حفظ الدفعة'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
            إلغاء
          </button>
        </div>
      }
    >
      <div className="modal-note" style={{ marginBottom: 14 }}>
        <span>المتبقي على الفاتورة</span>
        <b style={{ color: 'var(--brand)', fontSize: 15 }} className="t-num">
          {remaining.toLocaleString('en-US')} {sym}
        </b>
      </div>

      <button
        type="button"
        className="btn btn--tint-brand btn--block"
        style={{ marginBottom: 14 }}
        onClick={() => submit(remaining)}
        disabled={submitting || remaining <= 0}
      >
        <Icon name="check" />
        تسديد كامل المتبقي ({remaining.toLocaleString('en-US')} {sym})
      </button>

      <div className="field" style={{ marginBottom: 12 }}>
        <label className="field-label" htmlFor="pay-amount">مبلغ الدفعة ({sym})</label>
        <input
          id="pay-amount"
          data-autofocus
          className="input input--num"
          type="number"
          inputMode="decimal"
          min={0}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError('') }}
          placeholder="0"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="pay-note">ملاحظة <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(اختياري)</span></label>
        <input
          id="pay-note"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="نقداً، تحويل بنكي…"
          maxLength={60}
        />
      </div>

      {error && (
        <div className="error-text" style={{ marginTop: 12 }}>
          <Icon name="alert" />
          {error}
        </div>
      )}
    </Modal>
  )
}
