import { useEffect, useMemo, useRef, useState } from 'react'
import type { Meta } from '../lib/types'
import { sampleInvoiceFor, type InvoiceDesign, type InvoiceDocKind } from '../lib/invoiceDesign'
import { buildInvoiceHTML } from '../lib/printInvoice'

/**
 * معاينة حيّة للفاتورة — تعرض نفس HTML الناتج المستخدم في الطباعة/PDF
 * داخل iframe معزول (مصدر واحد ⇒ تطابق المعاينة مع الطباعة).
 * تُعرض ببيانات تجريبية ثابتة فقط ولا تُحفظ في سجلات الفواتير.
 */
export default function InvoicePreview({
  meta,
  design,
  kind = 'sale',
}: {
  meta: Meta
  design: InvoiceDesign
  kind?: InvoiceDocKind
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(520)
  // تأجيل بسيط لتقليل عمليات إعادة التحميل أثناء السحب في منتقي الألوان
  const [live, setLive] = useState(design)

  useEffect(() => {
    const t = setTimeout(() => setLive(design), 130)
    return () => clearTimeout(t)
  }, [design])

  const html = useMemo(
    () => buildInvoiceHTML(sampleInvoiceFor(kind), { ...meta, invoiceDesign: live }, '', { preview: true }),
    [meta, live, kind],
  )

  function measure() {
    const doc = iframeRef.current?.contentDocument
    if (!doc || !doc.body) return
    const h = Math.max(220, doc.body.scrollHeight)
    setHeight((prev) => (Math.abs(prev - h) > 2 ? h : prev))
  }

  useEffect(() => {
    const t1 = setTimeout(measure, 60)
    const t2 = setTimeout(measure, 500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [html])

  return (
    <div className="invoice-preview">
      <iframe
        ref={iframeRef}
        title="معاينة الفاتورة"
        srcDoc={html}
        onLoad={measure}
        scrolling="no"
        style={{ height }}
      />
    </div>
  )
}
