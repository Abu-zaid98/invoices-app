import { useAppData } from '../lib/AppDataContext'
import { convert, currencySymbol, isOverdue, totalPayable, totalReceivable } from '../lib/types'
import type { Invoice } from '../lib/types'

function InvoiceRow({ inv }: { inv: Invoice }) {
  const credit = inv.type === 'credit'
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] py-3 last:border-b-0">
      <div>
        <div>{inv.party || '-'}</div>
        <div className="text-xs text-[var(--muted)]">
          {new Date(inv.date).toLocaleDateString('en-US')} ·{' '}
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              credit
                ? 'bg-violet-500/20 text-violet-300'
                : inv.type === 'purchase' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {credit ? '↩️ مرتجع' : inv.type === 'purchase' ? 'شراء' : 'بيع'}
          </span>
        </div>
      </div>
      <div className={`font-extrabold ${credit ? 'text-violet-300' : 'accent-text'}`}>
        {credit ? '− ' : ''}{inv.total.toLocaleString('en-US')} {currencySymbol(inv.currency)}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { meta, invoices } = useAppData()
  const purchases = invoices.filter((i) => i.type === 'purchase')
  const sales = invoices.filter((i) => i.type === 'sale')
  const dispCur = meta.currency
  const totalPurchase = purchases.reduce((s, i) => s + convert(i.total, i.currency, dispCur, meta.rates), 0)
  const totalSale = sales.reduce((s, i) => s + convert(i.total, i.currency, dispCur, meta.rates), 0)
  const mixedCur = invoices.some((i) => i.currency !== dispCur)
  const overdue = invoices.filter((i) => isOverdue(i))
  // مستحق لك = أرصدة البيع ناقص إشعاراتها، مستحق عليك = أرصدة الشراء ناقص مرتجعاتها
  const receivable = totalReceivable(invoices, dispCur, meta.rates)
  const payable = totalPayable(invoices, dispCur, meta.rates)

  return (
    <div>
      {overdue.length > 0 && (
        <div
          className="mb-2.5 rounded-2xl border border-red-500/40 p-3.5 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(220,38,38,.15), rgba(220,38,38,.05))' }}
        >
          <div className="text-sm font-black text-red-300">
            ⚠️ لديك {overdue.length} {overdue.length === 1 ? 'فاتورة متأخرة' : 'فواتير متأخرة'}
          </div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">
            تجاوزت تاريخ الاستحقاق ولم تُسدَّد بالكامل — راجع قائمة الفواتير (فلتر ⚠️ متأخرة)
          </div>
        </div>
      )}
      {/* Debts row */}
      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        <div className="card p-4 text-center">
          <div className="stat-ic g-green">💰</div>
          <div className="text-lg font-black text-emerald-400">
            {receivable.toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">مستحق لك (ديون العملاء)</div>
        </div>
        <div className="card p-4 text-center">
          <div className="stat-ic g-red">🧾</div>
          <div className="text-lg font-black text-red-400">
            {payable.toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">مستحق عليك (ديون الموردين)</div>
        </div>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2.5">
        <div className="card p-4 text-center">
          <div className="stat-ic g-amber">📥</div>
          <div className="accent-text text-xl font-black">{purchases.length}</div>
          <div className="text-xs text-[var(--muted)]">فواتير الشراء</div>
          <div className="mt-1 text-sm font-bold">
            {totalPurchase.toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="stat-ic g-blue">📤</div>
          <div className="accent-text text-xl font-black">{sales.length}</div>
          <div className="text-xs text-[var(--muted)]">فواتير البيع</div>
          <div className="mt-1 text-sm font-bold">
            {totalSale.toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
        </div>
        <div className="card col-span-2 flex flex-col items-center p-5 text-center">
          <div className="stat-ic g-violet">💰</div>
          <div className="accent-text text-2xl font-black">
            {(totalSale - totalPurchase).toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">هامش الربح التقديري</div>
        </div>
      </div>
      {mixedCur && (
        <p className="mb-4 text-xs text-[var(--muted)]">
          💱 تم تحويل بعض الفواتير من عملات مختلفة حسب أسعار الصرف في الإعدادات
        </p>
      )}
      <div className="card p-4">
        <h3 className="mb-2 font-bold">آخر الفواتير</h3>
        {invoices.length === 0 && <p className="py-6 text-center text-[var(--muted)]">لا توجد فواتير بعد</p>}
        {invoices
          .slice(-5)
          .reverse()
          .map((inv) => (
            <InvoiceRow key={inv.id} inv={inv} />
          ))}
      </div>
    </div>
  )
}
