import { useState } from 'react'
import type { Invoice, Meta } from '../lib/types'
import { exportInvoicePNG, buildInvoiceHTML } from '../lib/printInvoice'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import { getInvoiceQR } from '../lib/qr'
import Modal from './ui/Modal'
import Icon, { type IconName } from './ui/Icon'

interface Props {
  invoice: Invoice
  meta: Meta
  onClose: () => void
}

type ExportState = 'idle' | 'loading' | 'success' | 'error'

/** تصدير الفاتورة PDF/PNG/طباعة — Bottom Sheet بأزرار إجراءات واضحة وحالات تحميل */
export default function ExportModal({ invoice, meta, onClose }: Props) {
  const [pdfState, setPdfState] = useState<ExportState>('idle')
  const [pngState, setPngState] = useState<ExportState>('idle')
  const [printState, setPrintState] = useState<ExportState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const busy = pdfState === 'loading' || pngState === 'loading' || printState === 'loading'

  async function handleExport(type: 'pdf' | 'png' | 'print', setter: (s: ExportState) => void) {
    if (busy) return
    setter('loading')
    setErrorMsg('')
    try {
      if (type === 'pdf') await downloadInvoicePdf(invoice, meta)
      else if (type === 'png') await exportInvoicePNG(invoice, meta)
      else {
        const qr = await getInvoiceQR(invoice).catch(() => '')
        const html = buildInvoiceHTML(invoice, meta, qr)
        const win = window.open('', '_blank', 'width=900,height=1200')
        if (!win) throw new Error('تعذّر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.')
        win.document.open()
        win.document.write(html)
        win.document.close()
        win.onload = () => setTimeout(() => { win.focus(); win.print() }, 600)
      }
      setter('success')
      setTimeout(() => setter('idle'), 3000)
    } catch (err: unknown) {
      setter('error')
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
      setTimeout(() => setter('idle'), 4000)
    }
  }

  const invNum = String(invoice.id).padStart(4, '0')

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      busy={busy}
      title="تصدير الفاتورة"
      description={<>فاتورة رقم <b style={{ color: 'var(--text)' }}>#{invNum}</b> — {invoice.party}</>}
      icon={<Icon name="download" />}
      iconTone="info"
      footer={
        <button type="button" className="btn btn--secondary btn--block" onClick={onClose} disabled={busy}>
          إغلاق
        </button>
      }
    >
      {errorMsg && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          <Icon name="alert" />
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ExportBtn
          icon="file"
          label="تحميل PDF"
          sub="ملف A4 قابل للمشاركة والأرشفة"
          gradient="linear-gradient(135deg,#007AFF,#5856D6)"
          state={pdfState}
          disabled={busy && pdfState !== 'loading'}
          onClick={() => handleExport('pdf', setPdfState)}
        />
        <ExportBtn
          icon="image"
          label="تحميل PNG"
          sub="صورة عالية الدقة للمشاركة"
          gradient="linear-gradient(135deg,#34C759,#1fa94a)"
          state={pngState}
          disabled={busy && pngState !== 'loading'}
          onClick={() => handleExport('png', setPngState)}
        />
        <ExportBtn
          icon="printer"
          label="طباعة مباشرة"
          sub="افتح نافذة الطباعة في المتصفح"
          gradient="linear-gradient(135deg,#FF9500,#ffb020)"
          state={printState}
          disabled={busy && printState !== 'loading'}
          onClick={() => handleExport('print', setPrintState)}
        />
      </div>
    </Modal>
  )
}

function ExportBtn({
  icon, label, sub, gradient, state, disabled, onClick,
}: {
  icon: IconName
  label: string
  sub: string
  gradient: string
  state: ExportState
  disabled: boolean
  onClick: () => void
}) {
  const loading = state === 'loading'
  const bg =
    state === 'success' ? 'linear-gradient(135deg,#34C759,#1fa94a)' :
    state === 'error' ? 'linear-gradient(135deg,#FF3B30,#e0332a)' :
    gradient

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--radius-lg)',
        border: 'none',
        background: bg,
        color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'transform .15s ease, opacity .15s ease',
        boxShadow: 'var(--shadow-sm)',
        fontFamily: 'inherit',
        textAlign: 'right',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>
        {loading ? <Spinner /> :
          state === 'success' ? <Icon name="checkCircle" /> :
          state === 'error' ? <Icon name="alert" /> : <Icon name={icon} />}
      </span>
      <span style={{ textAlign: 'right' }}>
        {loading ? (
          <span style={{ fontSize: 14, fontWeight: 700 }}>جارٍ التصدير…</span>
        ) : state === 'success' ? (
          <span style={{ fontSize: 14, fontWeight: 700 }}>تم بنجاح!</span>
        ) : state === 'error' ? (
          <span style={{ fontSize: 14, fontWeight: 700 }}>فشل التصدير</span>
        ) : (
          <>
            <div style={{ fontSize: 14.5, fontWeight: 750, lineHeight: 1.3 }}>{label}</div>
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2, fontWeight: 400 }}>{sub}</div>
          </>
        )}
      </span>
      <span style={{ display: 'flex', opacity: 0.7 }}>
        <Icon name="chevronLeft" size={18} />
      </span>
    </button>
  )
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block', width: 20, height: 20,
        border: '2.5px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff', borderRadius: '50%',
        animation: 'spin .7s linear infinite',
      }}
    />
  )
}
