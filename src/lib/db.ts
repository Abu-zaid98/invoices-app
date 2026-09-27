import type { Invoice, Meta } from './types'
import { DEFAULT_META } from './types'

const DB_NAME = 'solarInvoicingDB'
const DB_VERSION = 2

export interface TrashRecord {
  id: number // نفس رقم الفاتورة
  invoice: Invoice
  deletedAt: number
}

/** تُحذف السلة تلقائياً بعد 30 يوم */
export const TRASH_RETENTION_MS = 30 * 24 * 3600 * 1000

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('invoices')) {
        db.createObjectStore('invoices', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('trash')) {
        db.createObjectStore('trash', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const result = await tx<Invoice[]>('invoices', 'readonly', (s) => s.getAll())
  return result.sort((a, b) => a.date - b.date)
}

export async function putInvoice(invoice: Invoice): Promise<void> {
  await tx('invoices', 'readwrite', (s) => s.put(invoice))
}

export async function deleteInvoiceDB(id: number): Promise<void> {
  await tx('invoices', 'readwrite', (s) => s.delete(id))
}

export async function replaceAllInvoices(invoices: Invoice[]): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('invoices', 'readwrite')
    const store = transaction.objectStore('invoices')
    store.clear()
    invoices.forEach((inv) => store.put(inv))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function getMeta(): Promise<Meta> {
  const rows = await tx<{ key: string; value: unknown }[]>('meta', 'readonly', (s) => s.getAll())
  const found: Record<string, unknown> = {}
  rows.forEach((r) => (found[r.key] = r.value))
  return { ...DEFAULT_META, ...found } as Meta
}

export async function setMetaField<K extends keyof Meta>(key: K, value: Meta[K]): Promise<void> {
  await tx('meta', 'readwrite', (s) => s.put({ key, value }))
}

export async function setMetaAll(meta: Meta): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('meta', 'readwrite')
    const store = transaction.objectStore('meta')
    ;(Object.keys(meta) as (keyof Meta)[]).forEach((key) => store.put({ key, value: meta[key] }))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// ─── Trash (سلة المحذوفات) ───────────────────────────────────────────────────

export async function getTrash(): Promise<TrashRecord[]> {
  const result = await tx<TrashRecord[]>('trash', 'readonly', (s) => s.getAll())
  return result.sort((a, b) => b.deletedAt - a.deletedAt)
}

export async function moveToTrash(invoice: Invoice): Promise<TrashRecord> {
  const record: TrashRecord = { id: invoice.id, invoice, deletedAt: Date.now() }
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['invoices', 'trash'], 'readwrite')
    transaction.objectStore('invoices').delete(invoice.id)
    transaction.objectStore('trash').put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  return record
}

export async function restoreFromTrash(id: number): Promise<Invoice | null> {
  const rec = await tx<TrashRecord | undefined>('trash', 'readonly', (s) => s.get(id))
  if (!rec) return null
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['invoices', 'trash'], 'readwrite')
    transaction.objectStore('trash').delete(id)
    transaction.objectStore('invoices').put(rec.invoice)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  return rec.invoice
}

export async function deleteTrashForever(id: number): Promise<void> {
  await tx('trash', 'readwrite', (s) => s.delete(id))
}

export async function emptyTrashDB(): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('trash', 'readwrite')
    transaction.objectStore('trash').clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

/** حذف السجلات الأقدم من 30 يوم — تُستدعى عند بدء التطبيق */
export async function purgeExpiredTrash(now = Date.now()): Promise<number> {
  const all = await getTrash()
  const expired = all.filter((r) => now - r.deletedAt > TRASH_RETENTION_MS)
  for (const r of expired) {
    await deleteTrashForever(r.id)
  }
  return expired.length
}
