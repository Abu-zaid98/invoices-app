import type { Invoice, Meta } from './types'
import { drawInvoiceCanvas } from './invoiceCanvas'

/**
 * ملف PDF حقيقي من صورة Canvas عالية الدقة (مقسم A4) — للمشاركة كملف
 * بدل صورة PNG. لا مشاكل خطوط عربية: النص مرسوم مسبقاً بدقة.
 */

/** يبني Blob لملف PDF الفاتورة */
export async function makeInvoicePdfBlob(inv: Invoice, meta: Meta): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const canvas = await drawInvoiceCanvas(inv, meta, 2)
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })

  const pageW = pdf.internal.pageSize.getWidth() // 595.28
  const pageH = pdf.internal.pageSize.getHeight() // 841.89
  // ارتفاع شريحة البكسل المقابلة لصفحة كاملة
  const sliceH = Math.floor((canvas.width / pageW) * pageH)

  let y = 0
  let first = true
  while (y < canvas.height) {
    const h = Math.min(sliceH, canvas.height - y)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = h
    const sctx = slice.getContext('2d')!
    sctx.fillStyle = '#ffffff'
    sctx.fillRect(0, 0, slice.width, slice.height)
    sctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    const imgH = (h / canvas.width) * pageW
    if (!first) pdf.addPage()
    first = false
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, imgH)
    y += h
  }
  const out = pdf.output('blob')
  return out as Blob
}

export function invoicePdfName(inv: Invoice): string {
  return `فاتورة-${String(inv.id).padStart(4, '0')}.pdf`
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** مشاركة ملف PDF عبر Web Share، أو تنزيله عند عدم الدعم */
export async function shareInvoicePdf(inv: Invoice, meta: Meta): Promise<'shared' | 'downloaded'> {
  const blob = await makeInvoicePdfBlob(inv, meta)
  const file = new File([blob], invoicePdfName(inv), { type: 'application/pdf' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `فاتورة #${String(inv.id).padStart(4, '0')}`,
      })
      return 'shared'
    }
  } catch {
    // إلغاء المستخدم أو فشل المشاركة → تنزيل
  }
  downloadBlob(blob, file.name)
  return 'downloaded'
}

/** تنزيل ملف PDF مباشرة */
export async function downloadInvoicePdf(inv: Invoice, meta: Meta): Promise<void> {
  const blob = await makeInvoicePdfBlob(inv, meta)
  downloadBlob(blob, invoicePdfName(inv))
}
