import { useRef, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import { currencySymbol, invoiceBalance, isOverdue, PAYMENT_META } from '../lib/types'
import type { Invoice } from '../lib/types'
import { formatDate } from '../lib/format'
import DatePicker from '../components/DatePicker'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import PaymentModal from '../components/PaymentModal'
import Select from '../components/Select'
import Icon, { type IconName } from '../components/ui/Icon'

type Filter = 'all' | 'purchase' | 'sale' | 'credit'
export type PayFilter = 'all' | 'paid' | 'partial' | 'unpaid' | 'overdue'

const TYPE_META: Record<Invoice['type'], { icon: IconName; tone: string; label: string }> = {
  purchase: { icon: 'download', tone: 'g-amber', label: 'شراء' },
  sale: { icon: 'upload', tone: 'g-blue', label: 'بيع' },
  credit: { icon: 'refresh', tone: 'g-violet', label: 'مرتجع' },
}

export default function InvoicesList({ onOpen, initialPayFilter = 'all' }: { onOpen: (id: number) => void; initialPayFilter?: PayFilter }) {
  const { meta, invoices, trashInvoice, restoreInvoice, recordPayment } = useAppData()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [payFilter, setPayFilter] = useState<PayFilter>(initialPayFilter)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [curFilter, setCurFilter] = useState('all')
  const [showAdvanced, setShowAdvanced] = useState(false)

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
      label: 'تراجع',
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

  return (
    <div className="stack">
      {/* Search & filter */}
      <div className="card card--pad stack-sm">
        <div className="search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الصنف..."
            className="input"
            aria-label="بحث في الفواتير"
            type="search"
          />
        </div>

        <div className="segmented" role="group" aria-label="نوع الفاتورة">
          {(['all', 'purchase', 'sale', 'credit'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className="segmented-item"
              data-active={filter === f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'الكل' : f === 'purchase' ? 'شراء' : f === 'sale' ? 'بيع' : 'مرتجع'}
            </button>
          ))}
        </div>

        <div className="scroll-x" role="group" aria-label="حالة الدفع">
          {(['all', 'unpaid', 'partial', 'paid', 'overdue'] as PayFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              className="chip"
              data-active={payFilter === f}
              aria-pressed={payFilter === f}
              onClick={() => setPayFilter(f)}
            >
              {f === 'all' ? 'كل الحالات'
                : f === 'overdue' ? `متأخرة${overdueCount > 0 ? ` (${overdueCount})` : ''}`
                : PAYMENT_META[f].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          <Icon name="filter" size={16} />
          خيارات متقدمة
          {hasExtraFilters && <span className="badge badge--brand">مُفعّلة</span>}
          <Icon name="chevronDown" size={15} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        {showAdvanced && (
          <div className="form-grid">
            <div>
              <label className="field-label" htmlFor="flt-from">من تاريخ</label>
              <DatePicker id="flt-from" value={dateFrom} onChange={setDateFrom} ariaLabel="من تاريخ" />
            </div>
            <div>
              <label className="field-label" htmlFor="flt-to">إلى تاريخ</label>
              <DatePicker id="flt-to" value={dateTo} onChange={setDateTo} ariaLabel="إلى تاريخ" />
            </div>
            <div className="span-2">
              <label className="field-label">العملة</label>
              <Select
                value={curFilter}
                ariaLabel="فلترة العملة"
                onChange={setCurFilter}
                options={[{ value: 'all', label: 'كل العملات' }, ...meta.currencies.map((c) => ({ value: c, label: c }))]}
              />
            </div>
            {hasExtraFilters && (
              <button type="button" className="btn btn--secondary btn--sm span-2" onClick={clearExtraFilters}>
                <Icon name="x" size={16} />
                مسح فلترة التاريخ والعملة
              </button>
            )}
          </div>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="card card--flush">
          <div className="empty">
            <span className="empty-icon">
              <Icon name="receipt" />
            </span>
            <div className="empty-title">لا توجد فواتير بعد</div>
            <div className="empty-text">أنشئ أول فاتورة من الزر المركزي في شريط التنقل.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="section-head">
            <span className="section-title">النتائج</span>
            <span className="section-meta">{filtered.length}</span>
          </div>
          {filtered.length === 0 ? (
            <div className="card card--flush">
              <div className="empty">
                <span className="empty-icon">
                  <Icon name="search" />
                </span>
                <div className="empty-title">لا توجد نتائج مطابقة</div>
                <div className="empty-text">جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر.</div>
              </div>
            </div>
          ) : (
            <div className="card card--flush inv-list">
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
            </div>
          )}
          {filtered.length > 0 && (
            <p className="hint" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="info" size={14} />
              اسحب أي صف يساراً للدفع السريع أو النقل للسلة
            </p>
          )}
        </>
      )}

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
    return <span className="badge badge--violet">مطبَّق على الحساب</span>
  }
  const st = inv.paymentStatus ?? 'unpaid'
  if (st === 'paid') return <span className="badge badge--success">مدفوعة</span>
  const bal = invoiceBalance(inv)
  const late = isOverdue(inv)
  return (
    <span className={`badge ${late ? 'badge--danger' : st === 'partial' ? 'badge--warning' : 'badge--danger'}`}>
      {late ? 'متأخرة · ' : ''}
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
  const meta = TYPE_META[inv.type]

  return (
    <div className="swipe-row">
      {/* Quick actions overlay — تنزلق من اليسار عند السحب */}
      <div
        className="swipe-actions"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform .2s ease',
        }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTrash(inv) }}
          className="btn"
          style={{
            width: 66, minHeight: 'auto', borderRadius: 0, flexDirection: 'column', gap: 2,
            background: 'linear-gradient(135deg,#991b1b,#dc2626)', color: '#fff', fontSize: 11, fontWeight: 800,
          }}
          title="نقل إلى السلة"
        >
          <Icon name="trash" size={19} />
          سلة
        </button>
        {bal > 0.005 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPay(inv) }}
            className="btn"
            style={{
              width: 66, minHeight: 'auto', borderRadius: 0, flexDirection: 'column', gap: 2,
              background: 'linear-gradient(135deg,#065f46,#10b981)', color: '#fff', fontSize: 11, fontWeight: 800,
            }}
            title="تسجيل دفعة سريعة"
          >
            <Icon name="cash" size={19} />
            دفعة
          </button>
        )}
      </div>

      {/* Row content */}
      <div
        className="row"
        role="button"
        tabIndex={0}
        aria-label={`فتح فاتورة ${inv.party || ''}`.trim()}
        onClick={() => (open ? onToggle(null) : onOpen(inv.id))}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (open) onToggle(null)
            else onOpen(inv.id)
          }
        }}
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
        style={{ cursor: 'pointer', background: 'var(--card)' }}
      >
        <span className={`stat-icon ${meta.tone}`}>
          <Icon name={meta.icon} />
        </span>
        <span className="row-main">
          <span className="row-title truncate" style={{ display: 'block' }}>{inv.party || '-'}</span>
          <span className="row-sub inline-row" style={{ display: 'flex', flexWrap: 'wrap', rowGap: 3, marginTop: 3, gap: 6 }}>
            <span>{formatDate(inv.date)}</span>
            <span className="badge badge--neutral">{meta.label}</span>
            <PayBadge inv={inv} />
          </span>
        </span>
        <span className="row-end inline" style={{ gap: 8 }}>
          <span className="amount" style={{ color: inv.type === 'credit' ? 'var(--violet)' : 'var(--text)' }}>
            {inv.type === 'credit' ? '− ' : ''}{inv.total.toLocaleString('en-US')} {currencySymbol(inv.currency)}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTrash(inv) }}
            className="btn btn--tint-danger btn--icon"
            style={{ width: 38, minHeight: 38, borderRadius: 10 }}
            aria-label="نقل إلى السلة"
          >
            <Icon name="trash" size={17} />
          </button>
        </span>
      </div>
    </div>
  )
}
