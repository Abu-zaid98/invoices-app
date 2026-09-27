import type { Invoice, InvoiceType } from './types'
import { convert, invoiceBalance } from './types'

/**
 * directory — دليل العملاء/الموردين وكتالوج الأصناف، مشتق من الفواتير.
 * لا مخزن جديد في IndexedDB: يُبنى بالذاكرة ويتحدث تلقائياً مع كل فاتورة.
 */

export interface PartyInfo {
  name: string
  kinds: Set<InvoiceType>
  invoiceCount: number
  /** المتبقي حسب العملة (لا يُخلط بين العملات) */
  balanceByCurrency: Record<string, number>
  lastDate: number
}

/** إجمالي رصيد الطرف محوّلاً لعملة العرض */
export function partyBalance(
  p: PartyInfo,
  displayCurrency: string,
  rates: Record<string, number>,
): number {
  return Object.entries(p.balanceByCurrency).reduce(
    (s, [cur, amt]) => s + convert(amt, cur, displayCurrency, rates),
    0,
  )
}

export function buildParties(invoices: Invoice[], type?: InvoiceType): PartyInfo[] {
  const map = new Map<string, PartyInfo>()
  const sorted = [...invoices].sort((a, b) => a.date - b.date)
  for (const inv of sorted) {
    if (type && inv.type !== type) continue
    const key = inv.party.trim()
    if (!key) continue
    let p = map.get(key)
    if (!p) {
      p = { name: key, kinds: new Set(), invoiceCount: 0, balanceByCurrency: {}, lastDate: inv.date }
      map.set(key, p)
    }
    p.kinds.add(inv.type)
    p.invoiceCount += 1
    if (inv.type === 'credit') {
      // الإشعار يُنقص الرصيد مباشرة (مطبّق بالكامل عند إنشائه)
      p.balanceByCurrency[inv.currency] = (p.balanceByCurrency[inv.currency] || 0) - (Number(inv.total) || 0)
    } else {
      const bal = invoiceBalance(inv)
      if (bal > 0) {
        p.balanceByCurrency[inv.currency] = (p.balanceByCurrency[inv.currency] || 0) + bal
      }
    }
    p.lastDate = Math.max(p.lastDate, inv.date)
  }
  return [...map.values()].sort((a, b) => b.lastDate - a.lastDate)
}

export interface ItemInfo {
  name: string
  lastPrice: number
  currency: string
  specs: string
  usageCount: number
}

export function buildItemCatalog(invoices: Invoice[]): ItemInfo[] {
  const map = new Map<string, ItemInfo>()
  const sorted = [...invoices].sort((a, b) => a.date - b.date)
  for (const inv of sorted) {
    for (const it of inv.items) {
      const key = it.name.trim()
      if (!key) continue
      const prev = map.get(key)
      map.set(key, {
        name: key,
        lastPrice: it.price,
        currency: inv.currency,
        specs: it.specs || prev?.specs || '',
        usageCount: (prev?.usageCount || 0) + 1,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.usageCount - a.usageCount)
}
