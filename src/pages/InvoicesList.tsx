import { useRef, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import { currencySymbol, invoiceBalance, isOverdue, PAYMENT_META } from '../lib/types'
import type { Invoice } from '../lib/types'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import PaymentModal from '../components/PaymentModal'
import Select from '../components/Select'

type Filter = 'all' | 'purchase' | 'sale' | 'credit'
export type PayFilter = 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'

export default function InvoicesList({ onOpen, initialPayFilter = 'all' }: { onOpen: (id: number) => void; initialPayFilter?: PayFilter }) {
  const { meta, invoices, trashInvoice, restoreInvoice, recordPayment } = useAppData()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [payFilter, setPayFilter] = useState<PayFilter>(initialPayFilter)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [curFilter, setCurFilter] = useState('all')

  // Confirm-delete state
  const [pendingDelete, setPendingDelete] = useState<Invoice | null>(null)
  // Swipe + quick pay
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null)
  const [payTarget, setPayTarget] = useState<Invoice | null>(null)

  const q = query.trim().toLowerCase()
  const fromTs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null
  const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
  let filtered = [...invoices].reverse()
  if (filter !== 'all') filtered = filtered.filter((i) => i.type === filter)
  if (payFilter === 'overdue') filtered = filtered.filter((i) => isOverdue(i))
  else if (payFilter !== 'all') filtered = filtered.filter((i) => (i.paymentStatus ?? 'unpaid') === payFilter)
  if (curFilter !== 'all') filtered = filtered.filter((i) => i.currency === curFilter)
  if (fromTs != null) filtered = filtered.filter((i) => i.date >= fromTs)
  if (toTs != null) filtered = filtered.filter((i) => i.date <= toTs)
  if (q) {
    filtered = filtered.filter(
      (i) => i.party.toLowerCase().includes(q) || i.items.some((it) => it.name.toLowerCase().includes(q)),
    )
  }

  const hasExtraFilters = dateFrom !== '' || dateTo !== '' || curFilter !== 'all'
  function clearExtraFilters() {
    setDateFrom('')
    setDateTo('')
    setCurFilter('all')
  }

  const overdueCount = invoices.filter((i) => isOverdue(i)).length

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    await trashInvoice(id)
    setPendingDelete(null)
    setOpenSwipeId(null)
    toast('نُقلت الفاتورة إلى سلة المحذوفات', 'danger', {
      label: '↩️ تراجع',
      onClick: () => restoreInvoice(id).then(() => toast('تمت استعادة الفاتورة')),
    })
  }

  async function confirmQuickPay(amount: number, note: string) {
    if (!payTarget) return
    await recordPayment(payTarget.id, amount, note)
    setPayTarget(null)
    setOpenSwipeId(null)
    toast('تم تسجيل الدفعة بنجاح')
  }

  if (invoices.length === 0) {
    return (
      <div className="card p-4 text-center text-[var(--muted)]">لا توجد فواتير بعد</div>
    )
  }

  return (
    <div>
      {/* Search & filter */}
      <div className="card mb-3 p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 ابحث بالاسم أو الصنف..."
          className="mb-3 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2"
        />
        <div className="flex gap-2">
          {(['all', 'purchase', 'sale', 'credit'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${
                filter === f
                  ? 'border-transparent bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] text-white'
                  : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {f === 'all' ? 'الكل' : f === 'purchase' ? 'شراء' : f === 'sale' ? 'بيع' : '↩️ مرتجع'}
            </button>
          ))}
        </div>
        {/* Payment filter */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {(['all', 'unpaid', 'partial', 'paid', 'overdue'] as PayFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setPayFilter(f)}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${
                payFilter === f
                  ? 'border-transparent bg-gradient-to-br from-[var(--brand)] to-[var(--brand2)] text-black'
                  : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              {f === 'all' ? 'كل الحالات'
                : f === 'overdue' ? `⚠️ متأخرة${overdueCount > 0 ? ` (${overdueCount})` : ''}`
                : `${PAYMENT_META[f].icon} ${PAYMENT_META[f].label}`}
            </button>
          ))}
        </div>
        {/* Date + currency filters */}
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-[var(--muted)]">من تاريخ</label>
            <input
              type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[var(--muted)]">إلى تاريخ</label>
            <input
              type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[var(--muted)]">العملة</label>
            <div className="flex gap-1">
              <Select
                value={curFilter}
                ariaLabel="فلترة العملة"
                onChange={setCurFilter}
                options={[{ value: 'all', label: 'الكل 💱' }, ...meta.currencies.map((c) => ({ value: c, label: c }))]}
              />
              {hasExtraFilters && (
                <button
                  onClick={clearExtraFilters}
                  title="مسح فلترة التاريخ والعملة"
                  className="shrink-0 rounded-lg border border-[var(--border)] px-2 text-xs text-[var(--muted)] hover:bg-white/10"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card p-4">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-[var(--muted)]">لا توجد نتائج مطابقة</p>
        )}
        {filtered.map((inv) => (
          <SwipeRow
            key={inv.id}
            inv={inv}
            open={openSwipeId === inv.id}
            onToggle={(id) => setOpenSwipeId((cur) => (cur === id ? null : id))}
            onOpen={onOpen}
            onTrash={(v) => setPendingDelete(v)}
            onPay={(v) => { setOpenSwipeId(null); setPayTarget(v) }}
          />
        ))}
        {filtered.length > 0 && (
          <p className="pt-3 text-center text-[11px] text-[var(--muted)]">💡 اسحب أي صف يساراً للدفع السريع أو النقل للسلة</p>
        )}
      </div>

      {/* Quick payment modal */}
      {payTarget && (
        <PaymentModal
          isOpen={!!payTarget}
          invoice={payTarget}
          onConfirm={confirmQuickPay}
          onClose={() => setPayTarget(null)}
        />
      )}

      {/* Delete confirmation modal — مخصص للحذف */}
      <DeleteConfirmModal
        isOpen={!!pendingDelete}
        title="نقل الفاتورة إلى السلة"
        itemName={
          pendingDelete
            ? `فاتورة #${String(pendingDelete.id).padStart(4, '0')} — "${pendingDelete.party}"`
            : undefined
        }
        itemMeta={
          pendingDelete
            ? `${pendingDelete.total.toLocaleString('en-US')} ${currencySymbol(pendingDelete.currency)} · ${pendingDelete.type === 'purchase' ? 'شراء' : 'بيع'}`
            : undefined
        }
        message="سيتم نقل هذه الفاتورة إلى سلة المحذوفات ويمكن استعادتها خلال 30 يوماً."
        confirmLabel="نعم، انقل إلى السلة"
        cancelLabel="تراجع"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

function PayBadge({ inv }: { inv: Invoice }) {
  if (inv.type === 'credit') {
    return (
      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-bold text-violet-300">
        ↩️ مطبَّق على الحساب
      </span>
    )
  }
  const st = inv.paymentStatus ?? 'unpaid'
  if (st === 'paid') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
        ✅ مدفوعة
      </span>
    )
  }
  const bal = invoiceBalance(inv)
  const late = isOverdue(inv)
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
        late ? 'bg-red-500/20 text-red-300' : st === 'partial' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/10 text-red-400'
      }`}
    >
      {late ? '⚠️ متأخرة · ' : `${PAYMENT_META[st].icon} `}
      {bal.toLocaleString('en-US')} {currencySymbol(inv.currency)}
    </span>
  )
}

/** صف قابل للسحب: اسحب يساراً لإظهار الدفع السريع والنقل للسلة */
function SwipeRow({
  inv, open, onToggle, onOpen, onTrash, onPay,
}: {
  inv: Invoice
  open: boolean
  onToggle: (id: number | null) => void
  onOpen: (id: number) => void
  onTrash: (inv: Invoice) => void
  onPay: (inv: Invoice) => void
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const bal = invoiceBalance(inv)

  return (
    <div className="relative overflow-hidden border-b border-[var(--border)] last:border-b-0">
      {/* Quick actions overlay — تنزلق من اليسار عند السحب */}
      <div
        className="absolute inset-y-0 left-0 z-10 flex items-stretch"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform .2s ease',
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onTrash(inv) }}
          className="flex w-16 flex-col items-center justify-center gap-0.5 text-white"
          style={{ background: 'linear-gradient(135deg,#991b1b,#dc2626)', fontSize: 18 }}
          title="نقل إلى السلة"
        >
          🗑️
          <span style={{ fontSize: 10, fontWeight: 800 }}>سلة</span>
        </button>
        {bal > 0.005 && (
          <button
            onClick={(e) => { e.stopPropagation(); onPay(inv) }}
            className="flex w-16 flex-col items-center justify-center gap-0.5 text-white"
            style={{ background: 'linear-gradient(135deg,#065f46,#10b981)', fontSize: 18 }}
            title="تسجيل دفعة سريعة"
          >
            💵
            <span style={{ fontSize: 10, fontWeight: 800 }}>دفعة</span>
          </button>
        )}
      </div>

      {/* Row content */}
      <div
        onClick={() => (open ? onToggle(null) : onOpen(inv.id))}
        onTouchStart={(e) => {
          const t = e.touches[0]
          start.current = { x: t.clientX, y: t.clientY }
        }}
        onTouchEnd={(e) => {
          if (!start.current) return
          const t = e.changedTouches[0]
          const dx = t.clientX - start.current.x
          const dy = t.clientY - start.current.y
          start.current = null
          if (Math.abs(dy) > Math.abs(dx)) return // تمرير عمودي — تجاهل
          if (dx < -48) onToggle(inv.id)
          else if (dx > 48 || open) onToggle(null)
        }}
        className="flex cursor-pointer items-center justify-between py-3"
      >
        <div>
          <div className="font-semibold">{inv.party}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">
            {new Date(inv.date).toLocaleDateString('en-US')} ·{' '}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                inv.type === 'purchase'
                  ? 'bg-amber-500/20 text-amber-400'
                  : inv.type === 'credit'
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {inv.type === 'purchase' ? 'شراء' : inv.type === 'credit' ? '↩️ مرتجع' : 'بيع'}
            </span>
            <PayBadge inv={inv} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`font-extrabold ${inv.type === 'credit' ? 'text-violet-300' : 'accent-text'}`}>
            {inv.type === 'credit' ? '− ' : ''}{inv.total.toLocaleString('en-US')} {currencySymbol(inv.currency)}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onTrash(inv) }}
            style={{
              width: 32, height: 32,
              borderRadius: 9,
              border: '1px solid rgba(255,90,95,.3)',
              background: 'rgba(255,90,95,.1)',
              color: 'var(--danger)',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,90,95,.22)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,90,95,.1)')}
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}
