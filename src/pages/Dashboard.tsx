import { useAppData } from '../lib/AppDataContext'
import { convert, currencySymbol, invoiceBalance, isOverdue, PAYMENT_META, totalPayable, totalReceivable } from '../lib/types'
import type { Invoice } from '../lib/types'
import { formatDate } from '../lib/format'
import Icon from '../components/ui/Icon'
import type { IconName } from '../components/ui/Icon'

interface Props {
  onOpenInvoice?: (id: number) => void
  onOpenOverdue?: () => void
  onOpenInvoices?: () => void
}

const TYPE_META: Record<Invoice['type'], { icon: IconName; tone: string; label: string; color: string }> = {
  purchase: { icon: 'download', tone: 'g-amber', label: 'شراء', color: 'var(--warning)' },
  sale: { icon: 'upload', tone: 'g-blue', label: 'بيع', color: 'var(--accent)' },
  credit: { icon: 'refresh', tone: 'g-violet', label: 'مرتجع', color: 'var(--violet)' },
}

function InvoiceRow({ inv, onOpen }: { inv: Invoice; onOpen?: (id: number) => void }) {
  const credit = inv.type === 'credit'
  const meta = TYPE_META[inv.type]
  const bal = invoiceBalance(inv)
  const st = PAYMENT_META[inv.paymentStatus ?? 'unpaid']
  const late = isOverdue(inv)
  return (
    <button type="button" className="row" onClick={() => onOpen?.(inv.id)} style={{ cursor: onOpen ? 'pointer' : 'default' }}>
      <span className={`stat-icon ${meta.tone}`}>
        <Icon name={meta.icon} />
      </span>
      <span className="row-main">
        <span className="row-title truncate" style={{ display: 'block' }}>
          {inv.party || '-'}
        </span>
        <span className="row-sub" style={{ display: 'block' }}>
          {formatDate(inv.date)} · {meta.label}
          {!credit && bal > 0 && !late && ` · ${st.label}`}
        </span>
      </span>
      <span className="row-end">
        <span
          className="amount"
          style={{ display: 'block', color: credit ? 'var(--violet)' : 'var(--text)' }}
        >
          {credit ? '− ' : ''}
          {inv.total.toLocaleString('en-US')} {currencySymbol(inv.currency)}
        </span>
        {late && (
          <span className="badge badge--danger" style={{ marginTop: 3 }}>
            متأخرة
          </span>
        )}
        {!late && !credit && bal > 0 && (
          <span className={`badge ${inv.paymentStatus === 'partial' ? 'badge--warning' : 'badge--danger'}`} style={{ marginTop: 3 }}>
            {bal.toLocaleString('en-US')} {currencySymbol(inv.currency)}
          </span>
        )}
      </span>
    </button>
  )
}

export default function Dashboard({ onOpenInvoice, onOpenOverdue, onOpenInvoices }: Props) {
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
  const profit = totalSale - totalPurchase

  const recent = [...invoices].reverse().slice(0, 5)

  return (
    <div className="stack dash-page">
      {overdue.length > 0 && (
        <button
          type="button"
          className="card card--pad card-interactive"
          onClick={onOpenOverdue}
          style={{
            textAlign: 'right',
            borderColor: 'transparent',
            background: 'linear-gradient(135deg, var(--danger-soft), transparent 70%), var(--card)',
          }}
        >
          <div className="inline">
            <span className="stat-icon g-red">
              <Icon name="alert" />
            </span>
            <span className="grow">
              <span className="row-title" style={{ display: 'block', color: 'var(--danger)' }}>
                {overdue.length} {overdue.length === 1 ? 'فاتورة متأخرة' : 'فواتير متأخرة'}
              </span>
              <span className="row-sub" style={{ display: 'block' }}>
                تجاوزت تاريخ الاستحقاق ولم تُسدَّد بالكامل
              </span>
            </span>
            <Icon name="chevronLeft" size={18} style={{ color: 'var(--muted)' }} />
          </div>
        </button>
      )}

      {/* الأرصدة */}
      <div className="grid-2">
        <div className="card card--pad">
          <span className="stat-icon g-green">
            <Icon name="wallet" />
          </span>
          <div className="amount-lg" style={{ marginTop: 10, color: 'var(--success)' }}>
            {receivable.toLocaleString('en-US')}
            <span style={{ fontSize: 13, fontWeight: 700 }}> {currencySymbol(dispCur)}</span>
          </div>
          <div className="stat-label" style={{ marginTop: 3 }}>مستحق لك</div>
          <div className="t-caption">ديون العملاء</div>
        </div>
        <div className="card card--pad">
          <span className="stat-icon g-red">
            <Icon name="receipt" />
          </span>
          <div className="amount-lg" style={{ marginTop: 10, color: 'var(--danger)' }}>
            {payable.toLocaleString('en-US')}
            <span style={{ fontSize: 13, fontWeight: 700 }}> {currencySymbol(dispCur)}</span>
          </div>
          <div className="stat-label" style={{ marginTop: 3 }}>مستحق عليك</div>
          <div className="t-caption">ديون الموردين</div>
        </div>
      </div>

      {/* عدد الفواتير */}
      <div className="grid-2">
        <div className="card card--pad">
          <div className="row-between">
            <span className="stat-icon g-amber">
              <Icon name="download" />
            </span>
            <span className="amount-lg" style={{ color: 'var(--warning)' }}>{purchases.length}</span>
          </div>
          <div className="stat-label" style={{ marginTop: 10 }}>فواتير الشراء</div>
          <div className="t-caption">
            {totalPurchase.toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
        </div>
        <div className="card card--pad">
          <div className="row-between">
            <span className="stat-icon g-blue">
              <Icon name="upload" />
            </span>
            <span className="amount-lg" style={{ color: 'var(--brand)' }}>{sales.length}</span>
          </div>
          <div className="stat-label" style={{ marginTop: 10 }}>فواتير البيع</div>
          <div className="t-caption">
            {totalSale.toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
        </div>
      </div>

      {/* هامش الربح */}
      <div className="card card--pad card--tint">
        <div className="inline">
          <span className="stat-icon g-violet">
            <Icon name="trendingUp" />
          </span>
          <div className="grow">
            <div className="stat-label">هامش الربح التقديري</div>
            <div className="amount-lg" style={{ color: 'var(--violet)', marginTop: 2 }}>
              {profit.toLocaleString('en-US')}
              <span style={{ fontSize: 13, fontWeight: 700 }}> {currencySymbol(dispCur)}</span>
            </div>
          </div>
        </div>
      </div>

      {mixedCur && (
        <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
          <Icon name="refresh" size={14} />
          تم تحويل بعض الفواتير من عملات مختلفة حسب أسعار الصرف في الإعدادات
        </p>
      )}

      {/* آخر الفواتير */}
      <div className="section-head">
        <span className="section-title">آخر الفواتير</span>
        {invoices.length > 0 && onOpenInvoices && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onOpenInvoices}>
            عرض الكل
            <Icon name="chevronLeft" size={16} />
          </button>
        )}
      </div>

      <div className="card card--flush">
        {recent.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <Icon name="receipt" />
            </span>
            <div className="empty-title">لا توجد فواتير بعد</div>
            <div className="empty-text">ابدأ بإنشاء أول فاتورة بيع أو شراء من الزر المركزي بالأسفل.</div>
          </div>
        ) : (
          <div className="list list-tappable" style={{ padding: '4px 0' }}>
            {recent.map((inv) => (
              <InvoiceRow key={inv.id} inv={inv} onOpen={onOpenInvoice} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
