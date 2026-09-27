import type { Invoice, Meta } from './types'
import { currencySymbol, invoiceBalance, PAYMENT_META, PAYMENT_METHOD_META } from './types'

/** تنزيل النسخة الاحتياطية JSON */
export function downloadJsonBackup(meta: Meta, invoices: Invoice[]): void {
  const data = JSON.stringify({ meta, invoices }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `solar-invoices-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * تصدير الفواتير كـ CSV (صف لكل صنف) متوافق مع Excel —
 * BOM في البداية لدعم العربية.
 */
export function downloadInvoicesCsv(invoices: Invoice[]): void {
  const header = [
    'رقم الفاتورة', 'النوع', 'الطرف', 'التاريخ', 'العملة',
    'الصنف', 'المواصفات', 'الكمية', 'سعر الوحدة', 'إجمالي السطر',
    'الخصم', 'الضريبة %', 'إجمالي الفاتورة',
    'حالة الدفع', 'طريقة الدفع', 'المدفوع', 'المتبقي',
  ]
  const lines = [header.map(csvCell).join(',')]
  const sorted = [...invoices].sort((a, b) => a.date - b.date)
  for (const inv of sorted) {
    const date = new Date(inv.date).toLocaleDateString('en-US')
    const typeLabel = inv.type === 'purchase' ? 'شراء' : inv.type === 'credit' ? 'مرتجع' : 'بيع'
    const payLabel = PAYMENT_META[inv.paymentStatus ?? 'unpaid']?.label ?? ''
    const methodLabel = inv.payMethod ? PAYMENT_METHOD_META[inv.payMethod].label : ''
    const discount = inv.discountType === 'percent'
      ? `${inv.discountValue}%`
      : inv.discountType === 'amount'
        ? `${inv.discountValue} ${currencySymbol(inv.currency)}`
        : '—'
    for (const it of inv.items) {
      lines.push([
        String(inv.id).padStart(4, '0'), typeLabel, inv.party, date, inv.currency,
        it.name, it.specs || '', it.qty, it.price, it.qty * it.price,
        discount, inv.taxPercent || 0, inv.total,
        payLabel, methodLabel, inv.paidAmount || 0, invoiceBalance(inv),
      ].map(csvCell).join(','))
    }
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `solar-invoices-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
