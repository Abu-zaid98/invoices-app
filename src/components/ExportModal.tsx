import { useState } from 'react'
import type { Invoice, Meta } from '../lib/types'
import { exportInvoicePNG, buildInvoiceHTML } from '../lib/printInvoice'
import { downloadInvoicePdf } from '../lib/invoicePdf'
import { getInvoiceQR } from '../lib/qr'

interface Props {
  invoice: Invoice
  meta: Meta
  onClose: () => void
}

type ExportState = 'idle' | 'loading' | 'success' | 'error'

export default function ExportModal({ invoice, meta, onClose }: Props) {
  const [pdfState, setPdfState] = useState<ExportState>('idle')
  const [pngState, setPngState] = useState<ExportState>('idle')
  const [printState, setPrintState] = useState<ExportState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleExport(
    type: 'pdf' | 'png' | 'print',
    setter: (s: ExportState) => void,
  ) {
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
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
          display: 'flex', justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%', maxWidth: 480,
            borderRadius: '20px 20px 0 0',
            padding: '20px 20px 36px',
            background: 'var(--modal-bg)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '0.5px solid var(--separator)',
            borderBottom: 'none',
            boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            width: 40, height: 4,
            background: 'var(--separator)',
            borderRadius: 999,
            margin: '0 auto 20px',
          }} />

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(0, 122, 255, 0.12)',
              border: '1px solid rgba(0, 122, 255, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', fontSize: 24,
            }}>📄</div>
            <div style={{
              fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)',
              marginBottom: 4,
            }}>
              تصدير الفاتورة
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 400 }}>
              فاتورة رقم{' '}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>#{invNum}</span>
              {' — '}
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{invoice.party}</span>
            </div>
          </div>

          {errorMsg && (
            <div style={{
              background: 'rgba(255, 59, 48, 0.08)',
              border: '0.5px solid rgba(255, 59, 48, 0.2)',
              borderRadius: '12px', padding: '10px 14px',
              fontSize: 13, fontWeight: 500, color: '#FF3B30',
              marginBottom: 14, textAlign: 'center', direction: 'rtl',
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ExportBtn
              icon="📄"
              label="تحميل PDF"
              sub="ملف حقيقي A4 قابل للمشاركة والأرشفة"
              gradient="linear-gradient(135deg,#007AFF,#5856D6)"
              state={pdfState}
              onClick={() => handleExport('pdf', setPdfState)}
            />
            <ExportBtn
              icon="🖼️"
              label="تحميل PNG"
              sub="صورة عالية الدقة للمشاركة والأرشفة"
              gradient="linear-gradient(135deg,#34C759,#30D158)"
              state={pngState}
              onClick={() => handleExport('png', setPngState)}
            />
            <ExportBtn
              icon="🖨️"
              label="طباعة مباشرة"
              sub="افتح نافذة الطباعة في المتصفح"
              gradient="linear-gradient(135deg,#FF9500,#FFCC00)"
              state={printState}
              onClick={() => handleExport('print', setPrintState)}
            />
          </div>

          <button
            onClick={onClose}
            style={{
              marginTop: 14, width: '100%', padding: '13px', borderRadius: '14px',
              border: '0.5px solid var(--separator)', background: 'var(--modal-field)',
              color: 'var(--text)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </>
  )
}

function ExportBtn({
  icon, label, sub, gradient, state, onClick,
}: {
  icon: string
  label: string
  sub: string
  gradient: string
  state: ExportState
  onClick: () => void
}) {
  const disabled = state === 'loading'

  const bg =
    state === 'success' ? 'linear-gradient(135deg,#34C759,#30D158)' :
    state === 'error'   ? 'linear-gradient(135deg,#FF3B30,#FF453A)' :
    gradient

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%', display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: '16px', border: 'none',
        background: bg, color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.75 : 1,
        transition: 'transform .15s ease, box-shadow .15s ease',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        fontFamily: 'inherit', direction: 'rtl', textAlign: 'right',
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>
        {state === 'loading' ? <Spinner /> :
         state === 'success' ? '✅' :
         state === 'error'   ? '❌' : icon}
      </span>

      <span style={{ textAlign: 'right' }}>
        {state === 'loading' ? (
          <span style={{ fontSize: 14, fontWeight: 600 }}>جارٍ التصدير…</span>
        ) : state === 'success' ? (
          <span style={{ fontSize: 14, fontWeight: 600 }}>تم بنجاح!</span>
        ) : state === 'error' ? (
          <span style={{ fontSize: 14, fontWeight: 600 }}>فشل التصدير</span>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{label}</div>
            <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 2, fontWeight: 400 }}>{sub}</div>
          </>
        )}
      </span>

      <span style={{ fontSize: 15, opacity: 0.6, direction: 'ltr' }}>→</span>
    </button>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 20, height: 20,
      border: '2.5px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin .7s linear infinite',
      verticalAlign: 'middle',
    }} />
  )
}
