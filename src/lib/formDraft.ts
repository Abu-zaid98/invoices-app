import type { DiscountType, InvoiceType, PaymentMethod, PaymentStatus } from './types'

/** مسودة نموذج الفاتورة الجديدة — تُحفظ تلقائياً وتبقى عند التنقل */
export interface FormDraft {
  type: InvoiceType
  party: string
  currency: string
  items: { name: string; qty: number; price: number; specs?: string }[]
  payStatus: PaymentStatus
  paidStr: string
  dueStr: string
  discountMode: 'none' | DiscountType
  discountStr: string
  taxStr: string
  notes: string
  payMethod: PaymentMethod | null
  attachment?: string
  savedAt?: number
}

const KEY = 'fawateeri-form-draft'

export function loadFormDraft(): FormDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as FormDraft
    if (!d || typeof d !== 'object' || !Array.isArray(d.items)) return null
    return d
  } catch {
    return null
  }
}

export function saveFormDraft(draft: FormDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    // تجاوز الحصة (صورة كبيرة غالباً) — احفظ بدون المرفق
    try {
      const { attachment: _omit, ...rest } = draft
      void _omit
      localStorage.setItem(KEY, JSON.stringify({ ...rest, savedAt: Date.now() }))
    } catch {
      /* تجاهل */
    }
  }
}

export function clearFormDraft(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
