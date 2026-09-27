import { useMemo } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { convert, currencySymbol, invoiceBalance, PAYMENT_META } from '../lib/types'

interface Props {
  partyName: string
  onBack: () => void
  onOpenInvoice: (id: number) => void
}

/** كشف حساب عميل/مورد: فواتيره + دفعاته + أرصدته */
export default function PartyStatement({ partyName, onBack, onOpenInvoice }: Props) {
  const { meta, invoices } = useAppData()
  const dispCur = meta.currency

  const partyInvoices = useMemo(
    () => invoices.filter((i) => i.party.trim() === partyName.trim()).sort((a, b) => b.date - a.date),
    [invoices, partyName],
  )

  const kinds = useMemo(() => {
    const s = new Set(partyInvoices.map((i) => i.type))
    return { sale: s.has('sale'), purchase: s.has('purchase'), credit: s.has('credit') }
  }, [partyInvoices])

  const creditTotal = useMemo(() => partyInvoices
    .filter((i) => i.type === 'credit')
    .reduce((sum, i) => sum + convert(i.total, i.currency, dispCur, meta.rates), 0),
  [partyInvoices, dispCur, meta.rates])

  const sums = useMemo(() => {
    const calc = (type: 'sale' | 'purchase') => {
      const list = partyInvoices.filter((i) => i.type === type)
      const credits = partyInvoices.filter((i) => i.type === 'credit' && (i.creditKind ?? type) === type)
      const conv = (v: number, cur: string) => convert(v, cur, dispCur, meta.rates)
      const invoiced = list.reduce((s, i) => s + conv(i.total, i.currency), 0)
        - credits.reduce((s, i) => s + conv(i.total, i.currency), 0)
      const paid = list.reduce((s, i) => s + conv(i.paidAmount || 0, i.currency), 0)
        - credits.reduce((s, i) => s + conv(i.total, i.currency), 0)
      return { count: list.length + credits.length, invoiced, paid, remaining: invoiced - paid }
    }
    return { sale: calc('sale'), purchase: calc('purchase') }
  }, [partyInvoices, dispCur, meta.rates])

  const ledger = useMemo(() => {
    const rows: { date: number; invId: number; amount: number; currency: string; note?: string }[] = []
    for (const inv of partyInvoices) {
      for (const p of inv.payments || []) {
        rows.push({ date: p.date, invId: inv.id, amount: p.amount, currency: inv.currency, note: p.note })
      }
    }
    return rows.sort((a, b) => b.date - a.date)
  }, [partyInvoices])

  if (partyInvoices.length === 0) {
    return (
      <div>
        <button
          onClick={onBack}
          className="mb-3 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-white/5 transition-colors"
        >
          ← رجوع
        </button>
        <div className="card p-4 text-center text-[var(--muted)]">لا توجد فواتير لهذا الطرف</div>
      </div>
    )
  }

  function SummaryCard({ title, icon, data, tone }: {
    title: string
    icon: string
    data: { count: number; invoiced: number; paid: number; remaining: number }
    tone: 'green' | 'amber'
  }) {
    const color = tone === 'green' ? 'text-emerald-400' : 'text-amber-400'
    return (
      <div className="card p-4">
        <div className="mb-2 text-sm font-black">{icon} {title} ({data.count})</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-[var(--muted)]">
            <span>إجمالي الفواتير</span>
            <b className="text-[var(--text)]">{data.invoiced.toLocaleString('en-US')} {currencySymbol(dispCur)}</b>
          </div>
          <div className="flex justify-between text-[var(--muted)]">
            <span>المدفوع</span>
            <b className="text-emerald-400">{data.paid.toLocaleString('en-US')} {currencySymbol(dispCur)}</b>
          </div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1">
            <span className="font-bold">المتبقي</span>
            <b className={color}>{data.remaining.toLocaleString('en-US')} {currencySymbol(dispCur)}</b>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-white/5 transition-colors"
      >
        ← رجوع
      </button>

      <div className="card mb-3 p-4 text-center">
        <div className="text-3xl">👤</div>
        <h2 className="mt-1 text-lg font-black">{partyName}</h2>
        <span className="mt-1 inline-block rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold text-[var(--muted)]">
          {kinds.sale && kinds.purchase ? 'عميل + مورد' : kinds.sale ? '📦 عميل' : '🛒 مورد'}
        </span>
      </div>

      <div className={`grid gap-2.5 ${kinds.sale && kinds.purchase ? 'grid-cols-1' : 'grid-cols-1'}`}>
        {kinds.sale && <SummaryCard title="كمبيعات (مستحق لك)" icon="📦" data={sums.sale} tone="green" />}
        {kinds.purchase && <SummaryCard title="كمشتريات (مستحق عليك)" icon="🛒" data={sums.purchase} tone="amber" />}
        {!kinds.sale && !kinds.purchase && kinds.credit && (
          <div className="card p-4 text-center">
            <div className="mb-1 text-sm font-black">↩️ إشعارات مطبقة ({partyInvoices.length})</div>
            <div className="text-lg font-black text-violet-300">
              − {creditTotal.toLocaleString('en-US')} {currencySymbol(dispCur)}
            </div>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="card mt-3 p-4">
        <h3 className="mb-2 font-bold">🧾 الفواتير ({partyInvoices.length})</h3>
        {partyInvoices.map((inv) => {
          const bal = invoiceBalance(inv)
          const st = PAYMENT_META[inv.paymentStatus ?? 'unpaid']
          const credit = inv.type === 'credit'
          return (
            <div
              key={inv.id}
              onClick={() => onOpenInvoice(inv.id)}
              className="flex cursor-pointer items-center justify-between gap-2 border-b border-[var(--border)] py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold">
                  #{String(inv.id).padStart(4, '0')} · {new Date(inv.date).toLocaleDateString('en-US')}
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  {credit ? '↩️ إشعار' : inv.type === 'sale' ? 'بيع' : 'شراء'} · {credit ? 'مطبَّق' : `${st.icon} ${st.label}`}
                  {!credit && bal > 0 && ` · متبقٍ ${bal.toLocaleString('en-US')} ${currencySymbol(inv.currency)}`}
                </div>
              </div>
              <div className={`shrink-0 text-sm font-extrabold ${credit ? 'text-violet-300' : 'accent-text'}`}>
                {credit ? '− ' : ''}{inv.total.toLocaleString('en-US')} {currencySymbol(inv.currency)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Payments ledger */}
      {ledger.length > 0 && (
        <div className="card mt-3 p-4">
          <h3 className="mb-2 font-bold">💵 سجل الدفعات ({ledger.length})</h3>
          {ledger.map((r, idx) => (
            <div key={`${r.invId}-${idx}`} className="flex items-center justify-between border-b border-[var(--border)] py-2 text-sm last:border-b-0">
              <div className="text-xs text-[var(--muted)]">
                {new Date(r.date).toLocaleDateString('en-US')} · فاتورة #{String(r.invId).padStart(4, '0')}
                {r.note && ` · ${r.note}`}
              </div>
              <div className="font-bold text-emerald-400">
                + {r.amount.toLocaleString('en-US')} {currencySymbol(r.currency)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
