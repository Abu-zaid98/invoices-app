import { createContext } from 'react'
import type { Invoice, Meta } from '../types'
import type { TrashRecord } from '../db'

export interface AppDataContextValue {
  loaded: boolean
  meta: Meta
  invoices: Invoice[]
  trash: TrashRecord[]
  updateMeta: <K extends keyof Meta>(key: K, value: Meta[K]) => Promise<void>
  saveInvoice: (invoice: Invoice) => Promise<void>
  removeInvoice: (id: number) => Promise<void>
  /** نقل فاتورة إلى سلة المحذوفات (استعادة خلال 30 يوم) */
  trashInvoice: (id: number) => Promise<void>
  restoreInvoice: (id: number) => Promise<void>
  deleteForever: (id: number) => Promise<void>
  emptyTrash: () => Promise<void>
  /** إضافة دفعة لفاتورة (يُحدّث paidAmount والحالة تلقائياً) */
  recordPayment: (id: number, amount: number, note?: string) => Promise<void>
  /** التراجع عن دفعة مسجلة (إعادة حساب المجموع والحالة) */
  voidPayment: (id: number, entryId: string) => Promise<void>
  importAll: (data: { meta: Meta; invoices: Invoice[] }) => Promise<void>
}

/**
 * سياق بيانات التطبيق — في وحدة مستقلّة عن المزوّد **عن قصد**.
 *
 * لو كان `createContext` داخل `AppDataContext.tsx` (الذي يستورد `types` و`db`)،
 * فأي تعديل على تلك الملفات في وضع التطوير يُعيد تنفيذ وحدة المزوّد وينشئ سياقاً
 * جديداً، بينما المزوّد المثبَّت في الشجرة يحمل السياق القديم → يرمي `useAppData`
 * خطأ «must be used within Provider».
 * فصل السياق هنا يحفظ هويته دائماً.
 *
 * (الاستيرادات أعلاه كلها `import type` — تُحذَف عند البناء فلا تُنشئ أي تبعية وقت التنفيذ.)
 */
export const AppDataContext = createContext<AppDataContextValue | null>(null)
