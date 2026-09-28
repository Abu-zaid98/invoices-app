export type InvoiceType = 'purchase' | 'sale' | 'credit'

/** جهة الإشعار الدائن: يعوّض مبيعاً (دائن للعميل) أو مشتريات (مرتجع للمورد) */
export type CreditKind = 'sale' | 'purchase'

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export type DiscountType = 'percent' | 'amount'

export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'other'

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; icon: string }> = {
  cash: { label: 'نقداً', icon: '💵' },
  transfer: { label: 'تحويل', icon: '🏦' },
  check: { label: 'شيك', icon: '📝' },
  other: { label: 'أخرى', icon: '📦' },
}

/** دفعة مسجلة على فاتورة */
export interface PaymentEntry {
  id: string
  amount: number
  date: number
  note?: string
}

export interface InvoiceItem {
  name: string
  qty: number
  price: number
  specs?: string
}

export interface Invoice {
  id: number
  type: InvoiceType
  /** للإشعارات: جهة التعويض + الفاتورة المرتبطة */
  creditKind?: CreditKind | null
  linkedId?: number | null
  party: string
  currency: string
  date: number
  items: InvoiceItem[]
  /** الإجمالي النهائي بعد الخصم والضريبة */
  total: number
  /** حالة الدفع — تُملأ تلقائياً للفواتير القديمة */
  paymentStatus: PaymentStatus
  /** المبلغ المدفوع (بنفس عملة الفاتورة) — مجموع سجل الدفعات */
  paidAmount: number
  /** طريقة الدفع */
  payMethod: PaymentMethod | null
  /** سجل الدفعات (مبلغ + تاريخ + ملاحظة) */
  payments: PaymentEntry[]
  /** تاريخ الاستحقاق (timestamp) أو null بدون استحقاق */
  dueDate: number | null
  /** الخصم: نسبة أو مبلغ — null بدون خصم */
  discountType: DiscountType | null
  discountValue: number
  /** نسبة الضريبة % (تُحسب بعد الخصم) */
  taxPercent: number
  /** ملاحظات حرة تظهر في الفاتورة المطبوعة */
  notes: string
  /** مرفق اختياري (صورة إشعار الحوالة) — DataURL مضغوط */
  attachment?: string
}

export interface CompanyInfo {
  name: string
  signature?: string // base64 data URL
  logo?: string // base64 data URL — شعار الشركة للمطبوعات
}

export interface Meta {
  pin: string | null
  currency: string
  currencies: string[]
  rates: Record<string, number> // value of 1 unit in ILS terms
  theme: 'dark' | 'light'
  company: CompanyInfo
  nextId: number
  /** نسخ احتياطي تلقائي: إيقاف / أسبوعي / شهري */
  autoBackup: 'off' | 'weekly' | 'monthly'
  /** آخر نسخة (يدوية أو تلقائية) */
  lastBackupAt: number | null
  /** قفل تلقائي بعد خمول بالدقائق — 0 يعطّل */
  autoLockMinutes: number
  /** قالب الطباعة: حديث (متدرج) أو كلاسيكي (رسمي أبيض) */
  printTemplate: 'modern' | 'classic'
  /** الشروط الافتراضية تُطبع في كل فاتورة */
  defaultTerms: string
}

export const DEFAULT_META: Meta = {
  pin: null,
  currency: 'ILS',
  currencies: ['ILS', 'USD', 'JOD', 'EUR'],
  rates: { ILS: 1, USD: 3.7, JOD: 5.2, EUR: 4.0 },
  theme: 'dark',
  company: { name: '' },
  nextId: 1,
  autoBackup: 'weekly',
  lastBackupAt: null,
  autoLockMinutes: 5,
  printTemplate: 'modern',
  defaultTerms: '',
}

export function currencySymbol(code: string): string {
  return { ILS: '₪', USD: '$', JOD: 'د.أ', EUR: '€' }[code] ?? code
}

export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount
  const fromRate = rates[from] ?? 1
  const toRate = rates[to] ?? 1
  return (amount * fromRate) / toRate
}

// ─── Payments ────────────────────────────────────────────────────────────────

export const PAYMENT_META: Record<PaymentStatus, { label: string; icon: string }> = {
  paid: { label: 'مدفوعة', icon: '✅' },
  partial: { label: 'جزئية', icon: '🟡' },
  unpaid: { label: 'غير مدفوعة', icon: '🔴' },
}

/** ترحيل الفواتير القديمة إلى البنية الجديدة */
export function normalizeInvoice(inv: Invoice): Invoice {
  const total = Number(inv.total) || 0
  let payments: PaymentEntry[] = Array.isArray(inv.payments) ? inv.payments : []
  let paidAmount = Number(inv.paidAmount ?? 0)
  // فواتير قديمة بمبلغ مدفوع بلا سجل → دفعة أرشيفية واحدة بتاريخ الفاتورة
  if (payments.length === 0 && paidAmount > 0) {
    payments = [{ id: `legacy-${inv.id}`, amount: paidAmount, date: inv.date, note: 'رصيد سابق' }]
  }
  if (payments.length > 0) {
    paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }
  let paymentStatus: PaymentStatus = inv.paymentStatus ?? 'unpaid'
  if (paidAmount >= total && total > 0) {
    paymentStatus = 'paid'
    paidAmount = total
  } else if (paidAmount > 0) {
    paymentStatus = 'partial'
  }
  if (paidAmount < 0) paidAmount = 0
  if (paidAmount > total) paidAmount = total
  return {
    ...inv,
    total,
    paymentStatus,
    paidAmount,
    payments,
    payMethod: inv.payMethod ?? null,
    creditKind: inv.creditKind ?? null,
    linkedId: inv.linkedId ?? null,
    dueDate: inv.dueDate ?? null,
    discountType: inv.discountType ?? null,
    discountValue: Number(inv.discountValue ?? 0) || 0,
    taxPercent: Number(inv.taxPercent ?? 0) || 0,
    notes: inv.notes ?? '',
  }
}

export function newPaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function isCredit(inv: Invoice): boolean {
  return inv.type === 'credit'
}

/** صافي المستحق لك (مبيعات ناقص إشعاراتها) بعملة العرض */
export function totalReceivable(invoices: Invoice[], displayCurrency: string, rates: Record<string, number>): number {
  const sales = invoices
    .filter((i) => i.type === 'sale')
    .reduce((s, i) => s + convert(invoiceBalance(i), i.currency, displayCurrency, rates), 0)
  const credits = invoices
    .filter((i) => i.type === 'credit' && (i.creditKind ?? 'sale') === 'sale')
    .reduce((s, i) => s + convert(i.total, i.currency, displayCurrency, rates), 0)
  return sales - credits
}

/** صافي المستحق عليك (مشتريات ناقص مرتجعاتها) بعملة العرض */
export function totalPayable(invoices: Invoice[], displayCurrency: string, rates: Record<string, number>): number {
  const purchases = invoices
    .filter((i) => i.type === 'purchase')
    .reduce((s, i) => s + convert(invoiceBalance(i), i.currency, displayCurrency, rates), 0)
  const credits = invoices
    .filter((i) => i.type === 'credit' && (i.creditKind ?? 'purchase') === 'purchase')
    .reduce((s, i) => s + convert(i.total, i.currency, displayCurrency, rates), 0)
  return purchases - credits
}

export function deriveStatus(total: number, paid: number): PaymentStatus {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

/** المتبقي على الفاتورة */
export function invoiceBalance(inv: Invoice): number {
  return Math.max(0, (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0))
}

/** متأخرة؟ يوجد متبقٍ وتجاوز تاريخ الاستحقاق (مقارنة بيوم كامل) */
export function isOverdue(inv: Invoice, now = Date.now()): boolean {
  if (invoiceBalance(inv) <= 0.005) return false
  if (inv.dueDate == null) return false
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  return inv.dueDate < day.getTime()
}

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | null

/** تصنيف الاستحقاق: متأخر / اليوم / غداً — null بلا استحقاق قريب */
export function dueBucket(inv: Invoice, now = Date.now()): DueBucket {
  if (invoiceBalance(inv) <= 0.005) return null
  if (inv.dueDate == null) return null
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const due = new Date(inv.dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - start.getTime()) / (24 * 3600 * 1000))
  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  return null
}

// ─── Discount & Tax ──────────────────────────────────────────────────────────

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  afterDiscount: number
  taxAmount: number
  total: number
}

/** المجموع الفرعي → الخصم → الضريبة (تُحسب بعد الخصم) → الإجمالي */
export function calcTotals(
  items: Pick<InvoiceItem, 'qty' | 'price'>[],
  discountType: DiscountType | null,
  discountValue: number,
  taxPercent: number,
): InvoiceTotals {
  const subtotal = items.reduce((s, it) => s + Number(it.qty || 0) * Number(it.price || 0), 0)
  let discountAmount = 0
  if (discountType === 'percent') {
    const p = Math.min(100, Math.max(0, Number(discountValue) || 0))
    discountAmount = (subtotal * p) / 100
  } else if (discountType === 'amount') {
    discountAmount = Math.min(subtotal, Math.max(0, Number(discountValue) || 0))
  }
  const afterDiscount = subtotal - discountAmount
  const t = Math.min(100, Math.max(0, Number(taxPercent) || 0))
  const taxAmount = (afterDiscount * t) / 100
  return { subtotal, discountAmount, afterDiscount, taxAmount, total: afterDiscount + taxAmount }
}
