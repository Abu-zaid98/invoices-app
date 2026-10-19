import { useMemo } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { convert, currencySymbol, invoiceBalance, isOverdue, PAYMENT_META } from '../lib/types'
import { formatDate } from '../lib/format'
import type { IconName } from '../components/ui/Icon'
import Icon from '../components/ui/Icon'

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

  const kindLabel = kinds.sale && kinds.purchase ? 'عميل + مورد' : kinds.sale ? 'عميل' : kinds.purchase ? 'مورد' : 'إشعارات فقط'

  const header = (
    <div className="page-head">
      <button type="button" className="icon-btn icon-btn--ghost" onClick={onBack} aria-label="رجوع">
        <Icon name="arrowRight" />
      </button>
      <span className="t-heading">كشف الحساب</span>
      <span style={{ width: 40 }} aria-hidden="true" />
    </div>
  )

  if (partyInvoices.length === 0) {
    return (
      <div className="stack">
        {header}
        <div className="card card--flush">
          <div className="empty">
            <span className="empty-icon">
              <Icon name="user" />
            </span>
            <div className="empty-title">لا توجد فواتير لهذا الطرف</div>
          </div>
        </div>
      </div>
    )
  }

  function SummaryCard({ title, icon, data, tone, color }: {
    title: string
    icon: IconName
    data: { count: number; invoiced: number; paid: number; remaining: number }
    tone: string
    color: string
  }) {
    return (
      <div className="card card--pad">
        <div className="inline" style={{ marginBottom: 10 }}>
          <span className={`stat-icon ${tone}`}>
            <Icon name={icon} />
          </span>
          <span className="grow">
            <span className="row-title" style={{ display: 'block' }}>{title}</span>
            <span className="row-sub" style={{ display: 'block' }}>{data.count} فاتورة</span>
          </span>
        </div>
        <div className="stack-sm">
          <div className="row-between t-body">
            <span style={{ color: 'var(--muted)' }}>إجمالي الفواتير</span>
            <b className="amount">{data.invoiced.toLocaleString('en-US')} {currencySymbol(dispCur)}</b>
          </div>
          <div className="row-between t-body">
            <span style={{ color: 'var(--muted)' }}>المدفوع</span>
            <b className="amount" style={{ color: 'var(--success)' }}>
              {data.paid.toLocaleString('en-US')} {currencySymbol(dispCur)}
            </b>
          </div>
          <div className="row-between" style={{ paddingTop: 8, borderTop: '1px solid var(--separator)' }}>
            <span style={{ fontWeight: 700 }}>المتبقي</span>
            <b className="amount" style={{ color }}>{data.remaining.toLocaleString('en-US')} {currencySymbol(dispCur)}</b>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      {header}

      <div className="card card--pad" style={{ textAlign: 'center' }}>
        <span className="avatar" style={{ width: 58, height: 58, fontSize: 22, margin: '0 auto' }}>
          {partyName.trim().charAt(0) || '؟'}
        </span>
        <h2 className="t-title" style={{ marginTop: 10 }}>{partyName}</h2>
        <span className="badge badge--neutral" style={{ marginTop: 6 }}>{kindLabel}</span>
      </div>

      {kinds.sale && (
        <SummaryCard title="المبيعات — مستحق لك" icon="wallet" data={sums.sale} tone="g-green" color="var(--success)" />
      )}
      {kinds.purchase && (
        <SummaryCard title="المشتريات — مستحق عليك" icon="receipt" data={sums.purchase} tone="g-amber" color="var(--warning)" />
      )}
      {!kinds.sale && !kinds.purchase && kinds.credit && (
        <div className="card card--pad" style={{ textAlign: 'center' }}>
          <div className="inline" style={{ justifyContent: 'center', fontWeight: 700 }}>
            <Icon name="refresh" size={17} />
            إشعارات مطبقة ({partyInvoices.length})
          </div>
          <div className="amount-lg" style={{ color: 'var(--violet)', marginTop: 6 }}>
            − {creditTotal.toLocaleString('en-US')} {currencySymbol(dispCur)}
          </div>
        </div>
      )}

      <div className="section-head">
        <span className="section-title">الفواتير</span>
        <span className="section-meta">{partyInvoices.length}</span>
      </div>
      <div className="card card--flush">
        <div className="list list-tappable" style={{ padding: '4px 0' }}>
          {partyInvoices.map((inv) => {
            const bal = invoiceBalance(inv)
            const st = PAYMENT_META[inv.paymentStatus ?? 'unpaid']
            const credit = inv.type === 'credit'
            const late = isOverdue(inv)
            const typeIcon: IconName = credit ? 'refresh' : inv.type === 'sale' ? 'upload' : 'download'
            const tone = credit ? 'g-violet' : inv.type === 'sale' ? 'g-blue' : 'g-amber'
            return (
              <button key={inv.id} type="button" className="row" onClick={() => onOpenInvoice(inv.id)}>
                <span className={`stat-icon ${tone}`}>
                  <Icon name={typeIcon} />
                </span>
                <span className="row-main">
                  <span className="row-title" style={{ display: 'block' }}>
                    #{String(inv.id).padStart(4, '0')}
                  </span>
                  <span className="row-sub truncate" style={{ display: 'block' }}>
                    {formatDate(inv.date)} · {credit ? 'إشعار' : inv.type === 'sale' ? 'بيع' : 'شراء'}
                    {!credit && ` · ${st.label}`}
                  </span>
                </span>
                <span className="row-end">
                  <span className="amount" style={{ display: 'block', color: credit ? 'var(--violet)' : 'var(--text)' }}>
                    {credit ? '− ' : ''}{inv.total.toLocaleString('en-US')} {currencySymbol(inv.currency)}
                  </span>
                  {!credit && bal > 0 && (
                    <span className={`badge ${late ? 'badge--danger' : 'badge--warning'}`} style={{ marginTop: 3 }}>
                      متبقٍ {bal.toLocaleString('en-US')}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {ledger.length > 0 && (
        <>
          <div className="section-head">
            <span className="section-title">سجل الدفعات</span>
            <span className="section-meta">{ledger.length}</span>
          </div>
          <div className="card card--flush">
            <div className="list" style={{ padding: '4px 0' }}>
              {ledger.map((r, idx) => (
                <div key={`${r.invId}-${idx}`} className="row">
                  <span className="stat-icon g-green">
                    <Icon name="cash" />
                  </span>
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block', color: 'var(--success)' }}>
                      + {r.amount.toLocaleString('en-US')} {currencySymbol(r.currency)}
                    </span>
                    <span className="row-sub truncate" style={{ display: 'block' }}>
                      فاتورة #{String(r.invId).padStart(4, '0')} · {formatDate(r.date)}
                      {r.note && ` · ${r.note}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
