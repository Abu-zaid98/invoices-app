import type { Invoice } from './types'
import { PAYMENT_META } from './types'

/** محتوى QR: رقم + إجمالي + عملة + حالة — للتحقق والأرشفة */
export function qrPayload(inv: Invoice): string {
  const st = PAYMENT_META[inv.paymentStatus ?? 'unpaid']?.label ?? ''
  return `فواتيري|#${String(inv.id).padStart(4, '0')}|${inv.total}|${inv.currency}|${st}`
}

let cached: { key: string; url: string } | null = null

/** صورة QR كـ DataURL (تُحمّل المكتبة عند أول استخدام فقط) */
export async function getInvoiceQR(inv: Invoice): Promise<string> {
  const key = `${inv.id}-${inv.total}-${inv.currency}-${inv.paymentStatus}-${inv.paidAmount}`
  if (cached?.key === key) return cached.url
  const { default: QRCode } = await import('qrcode')
  const url = await QRCode.toDataURL(qrPayload(inv), {
    width: 132,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' },
  })
  cached = { key, url }
  return url
}
