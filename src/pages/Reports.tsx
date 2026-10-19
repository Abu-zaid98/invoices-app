import { useMemo, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { convert, currencySymbol } from '../lib/types'
import { buildParties, partyBalance } from '../lib/directory'
import { exportOperationsPDF, filterOperations } from '../lib/printReport'
import { formatDate } from '../lib/format'
import { useToast } from '../lib/useToast'
import DatePicker from '../components/DatePicker'
import Select from '../components/Select'
import Icon from '../components/ui/Icon'

export default function Reports({ onOpenParty }: { onOpenParty?: (name: string) => void }) {
  const { meta, invoices } = useAppData()
  const { toast } = useToast()
  const [reportCurrency, setReportCurrency] = useState(meta.currency)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  // كشف PDF
  const [pdfFrom, setPdfFrom] = useState('')
  const [pdfTo, setPdfTo] = useState('')
  const [pdfParty, setPdfParty] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)

  const partyOptions = useMemo(
    () => buildParties(invoices).map((p) => p.name),
    [invoices],
  )

  const pdfPreviewCount = useMemo(() => filterOperations(invoices, {
    from: pdfFrom ? new Date(pdfFrom + 'T00:00:00').getTime() : null,
    to: pdfTo ? new Date(pdfTo + 'T23:59:59').getTime() : null,
    party: pdfParty,
  }).length, [invoices, pdfFrom, pdfTo, pdfParty])

  async function handleExportPdf() {
    if (pdfBusy) return
    setPdfBusy(true)
    try {
      await exportOperationsPDF(invoices, meta, {
        from: pdfFrom ? new Date(pdfFrom + 'T00:00:00').getTime() : null,
        to: pdfTo ? new Date(pdfTo + 'T23:59:59').getTime() : null,
        party: pdfParty,
      }, reportCurrency)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التصدير', 'danger')
    } finally {
      setPdfBusy(false)
    }
  }

  const agg = useMemo(() => {
    const result: Record<'purchase' | 'sale', Record<string, { qty: number; total: number }>> = { purchase: {}, sale: {} }
    invoices.forEach((inv) => {
      if (inv.type === 'credit') return // الإشعارات تسويات لا مبيعات/مشتريات
      const bucket = result[inv.type as 'purchase' | 'sale']
      inv.items.forEach((it) => {
        if (!bucket[it.name]) bucket[it.name] = { qty: 0, total: 0 }
        bucket[it.name].qty += it.qty
        bucket[it.name].total += convert(it.qty * it.price, inv.currency, reportCurrency, meta.rates)
      })
    })
    return result
  }, [invoices, reportCurrency, meta.rates])

  const saleItemNames = useMemo(() => {
    const names = new Set<string>()
    invoices.filter((i) => i.type === 'sale').forEach((inv) => inv.items.forEach((it) => names.add(it.name)))
    return Array.from(names)
  }, [invoices])

  const activeItem = selectedItem && saleItemNames.includes(selectedItem) ? selectedItem : saleItemNames[0]

  const trendPoints = useMemo(() => {
    if (!activeItem) return []
    return invoices
      .filter((i) => i.type === 'sale')
      .sort((a, b) => a.date - b.date)
      .flatMap((inv) =>
        inv.items
          .filter((it) => it.name === activeItem)
          .map((it) => ({ date: inv.date, price: convert(it.price, inv.currency, reportCurrency, meta.rates) })),
      )
  }, [invoices, activeItem, reportCurrency, meta.rates])

  const mixedCur = invoices.some((i) => i.currency !== reportCurrency)

  // الديون حسب الطرف (عملاء/موردون) — مرتبة بالأعلى رصيداً
  const debts = useMemo(() => {
    const all = buildParties(invoices)
      .map((p) => ({ p, bal: partyBalance(p, reportCurrency, meta.rates) }))
      .filter((r) => r.bal > 0.005)
      .sort((a, b) => b.bal - a.bal)
    return {
      customers: all.filter((r) => r.p.kinds.has('sale') && !r.p.kinds.has('purchase')),
      suppliers: all.filter((r) => r.p.kinds.has('purchase') && !r.p.kinds.has('sale')),
      mixed: all.filter((r) => r.p.kinds.has('sale') && r.p.kinds.has('purchase')),
    }
  }, [invoices, reportCurrency, meta.rates])

  function Table({ data, empty }: { data: Record<string, { qty: number; total: number }>; empty: string }) {
    const rows = Object.entries(data).sort((a, b) => b[1].qty - a[1].qty)
    if (rows.length === 0) return <p className="hint">{empty}</p>
    return (
      <div className="table-scroll table-scroll--narrow">
        <table className="table">
          <thead>
            <tr>
              <th>الصنف</th>
              <th style={{ textAlign: 'center' }}>الكمية</th>
              <th style={{ textAlign: 'left' }}>الإجمالي ({reportCurrency})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, v]) => (
              <tr key={name}>
                <td>{name}</td>
                <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{v.qty}</td>
                <td className="amount" style={{ textAlign: 'left' }}>{v.total.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      {/* عملة العرض */}
      <div className="card card--pad">
        <label className="field-label" style={{ marginBottom: 6 }}>عرض التقارير بعملة</label>
        <Select
          value={reportCurrency}
          ariaLabel="عملة التقارير"
          onChange={setReportCurrency}
          options={meta.currencies.map((c) => ({ value: c, label: `${c} ${currencySymbol(c)}` }))}
        />
        {mixedCur && (
          <p className="hint inline-row" style={{ marginTop: 8, display: 'flex' }}>
            <Icon name="refresh" size={14} />
            تُحوَّل المبالغ حسب أسعار الصرف المضبوطة في الإعدادات
          </p>
        )}
      </div>

      {/* صافي الربح الشهري */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">صافي الربح الشهري ({reportCurrency})</span>
          <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}>
            <Icon name="trendingUp" size={18} />
          </span>
        </div>
        <MonthlyChart currency={reportCurrency} />
      </div>

      {/* تصدير كشف عمليات PDF */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">تصدير كشف عمليات PDF</span>
          <span className="stat-icon g-violet" style={{ width: 34, height: 34 }}>
            <Icon name="file" size={18} />
          </span>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          جدول بسيط للفترة المحددة — كل العمليات أو عميل/مورد معين — بعملة العرض المختارة أعلاه.
        </p>
        <div className="form-grid" style={{ marginBottom: 12 }}>
          <div>
            <label className="field-label" htmlFor="pdf-from">من تاريخ</label>
            <DatePicker id="pdf-from" value={pdfFrom} onChange={setPdfFrom} ariaLabel="من تاريخ" />
          </div>
          <div>
            <label className="field-label" htmlFor="pdf-to">إلى تاريخ</label>
            <DatePicker id="pdf-to" value={pdfTo} onChange={setPdfTo} ariaLabel="إلى تاريخ" />
          </div>
        </div>
        <label className="field-label" style={{ marginBottom: 6 }}>الطرف</label>
        <div style={{ marginBottom: 12 }}>
          <Select
            value={pdfParty}
            ariaLabel="طرف الكشف"
            onChange={setPdfParty}
            options={[{ value: '', label: 'كل العملاء والموردين' }, ...partyOptions.map((n) => ({ value: n, label: n }))]}
          />
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={pdfBusy || invoices.length === 0}
          className="btn btn--primary btn--block"
        >
          <Icon name="download" />
          {pdfBusy ? 'جارٍ التجهيز...' : `تصدير الكشف (${pdfPreviewCount} عملية)`}
        </button>
      </div>

      {/* الأكثر توريدًا (شراء) */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">الأكثر توريدًا (شراء)</span>
          <span className="stat-icon g-amber" style={{ width: 34, height: 34 }}>
            <Icon name="download" size={18} />
          </span>
        </div>
        <Table data={agg.purchase} empty="لا توجد بيانات شراء" />
      </div>

      {/* الديون */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">الديون المستحقة ({reportCurrency})</span>
          <span className="stat-icon g-red" style={{ width: 34, height: 34 }}>
            <Icon name="wallet" size={18} />
          </span>
        </div>
        <DebtTable title="مستحق لك من العملاء" tone="success" rows={debts.customers} empty="لا توجد ديون على العملاء" />
        <div style={{ height: 14 }} />
        <DebtTable title="مستحق عليك للموردين" tone="danger" rows={debts.suppliers} empty="لا توجد ديون للموردين" />
        {debts.mixed.length > 0 && (
          <>
            <div style={{ height: 14 }} />
            <DebtTable title="تعامل مزدوج (بيع وشراء)" tone="brand" rows={debts.mixed} empty="" />
          </>
        )}
      </div>

      {/* دليل الأطراف والأصناف */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">دليل العملاء والموردين</span>
          <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}>
            <Icon name="users" size={18} />
          </span>
        </div>
        <DirectoryTable onOpenParty={onOpenParty} />
      </div>

      {/* الأكثر بيعًا */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">الأكثر بيعًا</span>
          <span className="stat-icon g-green" style={{ width: 34, height: 34 }}>
            <Icon name="upload" size={18} />
          </span>
        </div>
        <Table data={agg.sale} empty="لا توجد بيانات بيع" />
      </div>

      {/* تتبع سعر البيع */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">تتبع سعر البيع عبر الزمن ({reportCurrency})</span>
          <span className="stat-icon g-violet" style={{ width: 34, height: 34 }}>
            <Icon name="chart" size={18} />
          </span>
        </div>
        {saleItemNames.length === 0 ? (
          <p className="hint">لا توجد فواتير بيع بعد</p>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Select
                value={activeItem ?? ''}
                ariaLabel="الصنف"
                onChange={(v) => setSelectedItem(v)}
                options={saleItemNames.map((n) => ({ value: n, label: n }))}
              />
            </div>
            {trendPoints.length === 0 ? (
              <p className="hint">لا توجد بيانات لهذا الصنف بعد</p>
            ) : (
              <PriceChart points={trendPoints} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DebtTable({
  title, rows, empty, tone,
}: {
  title: string
  rows: { p: { name: string; invoiceCount: number }; bal: number }[]
  empty: string
  tone: 'success' | 'danger' | 'brand'
}) {
  const total = rows.reduce((s, r) => s + r.bal, 0)
  const color = tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--brand)'
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <span className="inline" style={{ fontWeight: 700, fontSize: 13.5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: color, display: 'inline-block' }} />
          {title}
        </span>
        <span className="amount" style={{ color }}>{total.toLocaleString('en-US')}</span>
      </div>
      {rows.length === 0 ? (
        <p className="hint">{empty}</p>
      ) : (
        <div className="table-scroll table-scroll--narrow">
          <table className="table">
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.name}>
                  <td>{r.p.name}</td>
                  <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{r.p.invoiceCount} فواتير</td>
                  <td className="amount" style={{ textAlign: 'left' }}>{r.bal.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DirectoryTable({ onOpenParty }: { onOpenParty?: (name: string) => void }) {
  const { meta, invoices } = useAppData()
  const [q, setQ] = useState('')
  const parties = useMemo(() => {
    const query = q.trim().toLowerCase()
    const all = buildParties(invoices)
    const rows = (!query ? all : all.filter((p) => p.name.toLowerCase().includes(query))).slice(0, 20)
    return rows.map((p) => ({
      p,
      volume: invoices
        .filter((i) => i.party.trim() === p.name)
        .reduce((s, i) => s + convert(i.total, i.currency, meta.currency, meta.rates), 0),
    }))
  }, [invoices, q, meta.currency, meta.rates])

  if (invoices.length === 0) return <p className="hint">لا توجد بيانات بعد</p>
  return (
    <div>
      <div className="search" style={{ marginBottom: 10 }}>
        <Icon name="search" size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن عميل أو مورد..."
          className="input"
          aria-label="بحث في دليل الأطراف"
          type="search"
        />
      </div>
      {parties.length === 0 ? (
        <p className="hint">لا توجد نتائج</p>
      ) : (
        <div className="list list-tappable">
          {parties.map(({ p, volume }) => (
            <button
              key={p.name}
              type="button"
              className="row row--flush"
              onClick={() => onOpenParty?.(p.name)}
              disabled={!onOpenParty}
            >
              <span className="avatar" style={{ width: 38, height: 38, fontSize: 14 }}>
                {p.name.charAt(0)}
              </span>
              <span className="row-main">
                <span className="row-title truncate" style={{ display: 'block' }}>{p.name}</span>
                <span className="row-sub" style={{ display: 'block' }}>
                  {p.kinds.has('sale') && p.kinds.has('purchase')
                    ? 'عميل + مورد'
                    : p.kinds.has('sale') ? 'عميل'
                    : p.kinds.has('purchase') ? 'مورد' : 'إشعارات فقط'}
                  {' · '}{p.invoiceCount} فواتير
                </span>
              </span>
              <span className="row-end amount" style={{ color: 'var(--brand)' }}>
                {volume.toLocaleString('en-US')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MonthlyChart({ currency }: { currency: string }) {
  const { meta, invoices } = useAppData()
  const months = useMemo(() => {
    const out: { key: string; label: string; sales: number; purchases: number }[] = []
    const now = new Date()
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
      const y = d.getFullYear()
      const m = d.getMonth()
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      let sales = 0
      let purchases = 0
      for (const inv of invoices) {
        const dt = new Date(inv.date)
        if (dt.getFullYear() === y && dt.getMonth() === m) {
          const v = convert(inv.total, inv.currency, currency, meta.rates)
          if (inv.type === 'sale') sales += v
          else if (inv.type === 'purchase') purchases += v
          else if ((inv.creditKind ?? 'sale') === 'sale') sales -= v
          else purchases -= v
        }
      }
      out.push({ key: `${y}-${m}`, label, sales, purchases })
    }
    return out
  }, [invoices, meta.rates, currency])

  const max = Math.max(1, ...months.map((x) => Math.max(x.sales, x.purchases)))
  const W = 320
  const H = 150
  const base = H - 22
  const gw = (W - 20) / months.length
  const bw = Math.min(18, (gw - 14) / 2)

  if (invoices.length === 0) return <p className="hint">لا توجد فواتير بعد</p>
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: 'ltr', background: 'var(--chip)', borderRadius: 'var(--radius-md)' }}>
        <line x1={10} y1={base} x2={W - 10} y2={base} strokeWidth={1} style={{ stroke: 'var(--chart-grid)' }} />
        {months.map((x, i) => {
          const cx = 10 + gw * i + gw / 2
          const sh = ((base - 18) * x.sales) / max
          const ph = ((base - 18) * x.purchases) / max
          const net = x.sales - x.purchases
          return (
            <g key={x.key}>
              <rect x={cx - bw - 1} y={base - ph} width={bw} height={Math.max(0, ph)} rx={2} fill="#f59e0b" opacity={0.85}>
                <title>مشتريات {x.label}: {x.purchases.toLocaleString('en-US')}</title>
              </rect>
              <rect x={cx + 1} y={base - sh} width={bw} height={Math.max(0, sh)} rx={2} fill="#22c9a3" opacity={0.9}>
                <title>مبيعات {x.label}: {x.sales.toLocaleString('en-US')}</title>
              </rect>
              <text x={cx} y={H - 8} fontSize={9} textAnchor="middle" style={{ fill: 'var(--muted)', fontWeight: net < 0 ? 800 : 400 }}>
                {x.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="inline" style={{ justifyContent: 'center', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
        <span className="inline-row">
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#22c9a3', display: 'inline-block' }} />
          مبيعات
        </span>
        <span className="inline-row">
          <span style={{ width: 8, height: 8, borderRadius: 99, background: '#f59e0b', display: 'inline-block' }} />
          مشتريات
        </span>
      </div>
    </div>
  )
}

function PriceChart({ points }: { points: { date: number; price: number }[] }) {
  const W = 300
  const H = 140
  const P = 28
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const step = points.length > 1 ? (W - 2 * P) / (points.length - 1) : 0
  const coords = points.map((p, i) => ({
    x: P + i * step,
    y: H - P - ((p.price - min) / range) * (H - 2 * P),
  }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: 'var(--chip)', borderRadius: 'var(--radius-md)' }}>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} strokeWidth={1} style={{ stroke: 'var(--chart-grid)' }} />
      <path d={path} fill="none" strokeWidth={2.5} strokeLinecap="round" style={{ stroke: 'var(--brand)' }} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3.5} style={{ fill: 'var(--brand)' }}>
          <title>
            {points[i].price.toLocaleString('en-US')} — {formatDate(points[i].date)}
          </title>
        </circle>
      ))}
      <text x={P} y={14} fontSize={10} style={{ fill: 'var(--muted)' }}>
        أعلى: {max.toLocaleString('en-US')}
      </text>
      <text x={P} y={H - 6} fontSize={10} style={{ fill: 'var(--muted)' }}>
        أدنى: {min.toLocaleString('en-US')}
      </text>
    </svg>
  )
}
