import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Invoice, Meta } from './types'
import { DEFAULT_META, normalizeInvoice, newPaymentId } from './types'
import {
  getAllInvoices, getMeta, putInvoice, deleteInvoiceDB, replaceAllInvoices, setMetaAll, setMetaField,
  getTrash, moveToTrash, restoreFromTrash, deleteTrashForever, emptyTrashDB, purgeExpiredTrash,
  type TrashRecord,
} from './db'

interface AppDataContextValue {
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

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [meta, setMeta] = useState<Meta>(DEFAULT_META)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [trash, setTrash] = useState<TrashRecord[]>([])

  useEffect(() => {
    ;(async () => {
      const [m, inv, tr] = await Promise.all([getMeta(), getAllInvoices(), getTrash()])
      // ترحيل الثيمات القديمة (gold/blue) إلى النظام الجديد (dark/light)
      if (m.theme !== 'dark' && m.theme !== 'light') {
        m.theme = 'dark'
        setMetaField('theme', 'dark').catch(() => {})
      }
      setMeta(m)
      // ترحيل الفواتير القديمة لحقول الدفع + حفظها لتوحيد المخزن
      const normalized = inv.map(normalizeInvoice)
      setInvoices(normalized)
      normalized.forEach((n, i) => {
        if (JSON.stringify(n) !== JSON.stringify(inv[i])) putInvoice(n).catch(() => {})
      })
      setTrash(tr)
      // تنظيف السجلات الأقدم من 30 يوم
      purgeExpiredTrash().then((n) => {
        if (n > 0) setTrash((prev) => prev.slice(0, Math.max(0, prev.length - n)))
      }).catch(() => {})
      document.documentElement.setAttribute('data-theme', m.theme)
      setLoaded(true)
    })()
  }, [])

  async function updateMeta<K extends keyof Meta>(key: K, value: Meta[K]) {
    await setMetaField(key, value)
    setMeta((prev) => ({ ...prev, [key]: value }))
    if (key === 'theme') document.documentElement.setAttribute('data-theme', value as string)
  }

  async function saveInvoice(invoice: Invoice) {
    const normalized = normalizeInvoice(invoice)
    await putInvoice(normalized)
    setInvoices((prev) => {
      const exists = prev.some((i) => i.id === normalized.id)
      return exists ? prev.map((i) => (i.id === normalized.id ? normalized : i)) : [...prev, normalized]
    })
  }

  async function recordPayment(id: number, amount: number, note?: string) {
    const current = invoices.find((i) => i.id === id)
    if (!current || amount <= 0) return
    const remaining = current.total - (current.paidAmount || 0)
    const value = Math.min(remaining, amount)
    if (value <= 0) return
    const entry = { id: newPaymentId(), amount: value, date: Date.now(), note: note?.trim() || undefined }
    const updated = normalizeInvoice({ ...current, payments: [...(current.payments || []), entry] })
    await putInvoice(updated)
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)))
  }

  async function voidPayment(id: number, entryId: string) {
    const current = invoices.find((i) => i.id === id)
    if (!current) return
    const updated = normalizeInvoice({
      ...current,
      payments: (current.payments || []).filter((p) => p.id !== entryId),
      // إلغاء آخر أثر للحالة المحسوبة من المبلغ القديم
      paidAmount: 0,
      paymentStatus: 'unpaid' as const,
    })
    await putInvoice(updated)
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)))
  }

  async function removeInvoice(id: number) {
    await deleteInvoiceDB(id)
    setInvoices((prev) => prev.filter((i) => i.id !== id))
  }

  async function trashInvoice(id: number) {
    const current = invoices.find((i) => i.id === id)
    if (!current) return
    const record = await moveToTrash(current)
    setInvoices((prev) => prev.filter((i) => i.id !== id))
    setTrash((prev) => [record, ...prev.filter((r) => r.id !== id)])
  }

  async function restoreInvoice(id: number) {
    const restored = await restoreFromTrash(id)
    if (!restored) return
    setTrash((prev) => prev.filter((r) => r.id !== id))
    setInvoices((prev) => {
      const normalized = normalizeInvoice(restored)
      const exists = prev.some((i) => i.id === normalized.id)
      return exists ? prev.map((i) => (i.id === normalized.id ? normalized : i)) : [...prev, normalized]
    })
  }

  async function deleteForever(id: number) {
    await deleteTrashForever(id)
    setTrash((prev) => prev.filter((r) => r.id !== id))
  }

  async function emptyTrash() {
    await emptyTrashDB()
    setTrash([])
  }

  async function importAll(data: { meta: Meta; invoices: Invoice[] }) {
    if (data.meta.theme !== 'dark' && data.meta.theme !== 'light') {
      data.meta.theme = 'dark'
    }
    const normalized = data.invoices.map(normalizeInvoice)
    await setMetaAll(data.meta)
    await replaceAllInvoices(normalized)
    setMeta(data.meta)
    setInvoices(normalized)
    document.documentElement.setAttribute('data-theme', data.meta.theme)
  }

  return (
    <AppDataContext.Provider value={{ loaded, meta, invoices, trash, updateMeta, saveInvoice, removeInvoice, trashInvoice, restoreInvoice, deleteForever, emptyTrash, recordPayment, voidPayment, importAll }}>
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
