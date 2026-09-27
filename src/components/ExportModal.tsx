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
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 51,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            borderRadius: '24px 24px 0 0',
            padding: '20px 20px 36px',
            background: 'linear-gradient(160deg,#141a2d,#0c1220)',
            boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div style={{
            width: 40, height: 4,
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 999,
            margin: '0 auto 20px',
          }} />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,rgba(255,176,32,.3),rgba(255,122,61,.2))',
              border: '1px solid rgba(255,176,32,.4)',
              fontSize: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>📄</div>
            <div style={{
              fontSize: 20, fontWeight: 900,
              background: 'linear-gradient(90deg,var(--brand),var(--brand2))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 6,
            }}>
              تصدير الفاتورة
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13, direction: 'rtl' }}>
              فاتورة رقم{' '}
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>#{invNum}</span>
              {' — '}
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{invoice.party}</span>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div style={{
              background: 'rgba(255,90,95,0.12)',
              border: '1px solid rgba(255,90,95,0.35)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13,
              color: '#ff8a8e',
              marginBottom: 14,
              textAlign: 'center',
              direction: 'rtl',
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ExportBtn
              icon="📄"
              label="تحميل PDF"
              sub="ملف حقيقي A4 قابل للمشاركة والأرشفة"
              gradient="linear-gradient(135deg,#b71c1c,#e53935)"
              state={pdfState}
              onClick={() => handleExport('pdf', setPdfState)}
            />
            <ExportBtn
              icon="🖼️"
              label="تحميل PNG"
              sub="صورة عالية الدقة للمشاركة والأرشفة"
              gradient="linear-gradient(135deg,#1565c0,#1e88e5)"
              state={pngState}
              onClick={() => handleExport('png', setPngState)}
            />
            <ExportBtn
              icon="🖨️"
              label="طباعة مباشرة"
              sub="افتح نافذة الطباعة في المتصفح"
              gradient="linear-gradient(135deg,#1b5e20,#388e3c)"
              state={printState}
              onClick={() => handleExport('print', setPrintState)}
            />
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '13px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--muted)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              direction: 'rtl',
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Export button ─────────────────────────────────────────────────────────────
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
    state === 'success' ? 'linear-gradient(135deg,#1b5e20,#2e7d32)' :
    state === 'error'   ? 'linear-gradient(135deg,#7f0000,#c62828)' :
    gradient

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 16,
        border: 'none',
        background: bg,
        color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.75 : 1,
        transition: 'transform .2s, box-shadow .2s',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        fontFamily: 'inherit',
        direction: 'rtl',
        textAlign: 'right',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 22, lineHeight: 1 }}>
        {state === 'loading' ? <Spinner /> :
         state === 'success' ? '✅' :
         state === 'error'   ? '❌' : icon}
      </span>

      {/* Text */}
      <span style={{ textAlign: 'right' }}>
        {state === 'loading' ? (
          <span style={{ fontSize: 14, fontWeight: 700 }}>جارٍ التصدير…</span>
        ) : state === 'success' ? (
          <span style={{ fontSize: 14, fontWeight: 700 }}>تم بنجاح!</span>
        ) : state === 'error' ? (
          <span style={{ fontSize: 14, fontWeight: 700 }}>فشل التصدير</span>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{label}</div>
            <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 2, fontWeight: 400 }}>{sub}</div>
          </>
        )}
      </span>

      {/* Arrow (RTL: arrow points left = towards content) */}
      <span style={{ fontSize: 15, opacity: 0.5, direction: 'ltr' }}>→</span>
    </button>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 20, height: 20,
      border: '2.5px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin .7s linear infinite',
      verticalAlign: 'middle',
    }} />
  )
}
