import { useMemo, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { convert, currencySymbol } from '../lib/types'
import { buildParties, partyBalance } from '../lib/directory'
import { exportOperationsPDF, filterOperations } from '../lib/printReport'
import { useToast } from '../lib/useToast'
import Select from '../components/Select'

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
    if (rows.length === 0) return <p className="text-[var(--muted)]">{empty}</p>
    return (
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-[var(--muted)]">
            <th className="border-b border-[var(--border)] py-1.5 text-right">الصنف</th>
            <th className="border-b border-[var(--border)] py-1.5 text-right">الكمية</th>
            <th className="border-b border-[var(--border)] py-1.5 text-right">الإجمالي ({reportCurrency})</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, v]) => (
            <tr key={name}>
              <td className="border-b border-[var(--border)] py-1.5">{name}</td>
              <td className="border-b border-[var(--border)] py-1.5">{v.qty}</td>
              <td className="border-b border-[var(--border)] py-1.5">{v.total.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="mb-1 block text-xs text-[var(--muted)]">عرض التقارير بعملة</label>
        <Select
          value={reportCurrency}
          ariaLabel="عملة التقارير"
          onChange={setReportCurrency}
          options={meta.currencies.map((c) => ({ value: c, label: `${c} ${currencySymbol(c)}` }))}
        />
        {mixedCur && <p className="mt-2 text-xs text-[var(--muted)]">💱 تُحوَّل المبالغ حسب أسعار الصرف المضبوطة في الإعدادات</p>}
      </div>

      <div className="card p-4">
        <h3 className="mb-2 font-bold">📈 صافي الربح الشهري ({reportCurrency})</h3>
        <MonthlyChart currency={reportCurrency} />
      </div>

      {/* Export operations PDF */}
      <div className="card p-4">
        <h3 className="mb-1 font-bold">📄 تصدير كشف عمليات PDF</h3>
        <p className="mb-3 text-xs text-[var(--muted)]">
          جدول بسيط للفترة المحددة — كل العمليات أو عميل/مورد معين — بعملة العرض المختارة أعلاه.
        </p>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">من تاريخ</label>
            <input
              type="date" value={pdfFrom} onChange={(e) => setPdfFrom(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">إلى تاريخ</label>
            <input
              type="date" value={pdfTo} onChange={(e) => setPdfTo(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <label className="mb-1 block text-xs text-[var(--muted)]">الطرف</label>
        <div className="mb-3">
          <Select
            value={pdfParty}
            ariaLabel="طرف الكشف"
            onChange={setPdfParty}
            options={[{ value: '', label: 'كل العملاء والموردين 📋' }, ...partyOptions.map((n) => ({ value: n, label: `👤 ${n}` }))]}
          />
        </div>
        <button
          onClick={handleExportPdf}
          disabled={pdfBusy || invoices.length === 0}
          className="btn-brand w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {pdfBusy ? '⏳ جارٍ التجهيز...' : `⬇️ تصدير الكشف (${pdfPreviewCount} عملية)`}
        </button>
      </div>

      <div className="card p-4">
        <h3 className="mb-2 font-bold">الأكثر توريدًا (شراء)</h3>
        <Table data={agg.purchase} empty="لا توجد بيانات شراء" />
      </div>

      {/* الديون */}
      <div className="card p-4">
        <h3 className="mb-2 font-bold">💰 الديون المستحقة ({reportCurrency})</h3>
        <DebtTable title="مستحق لك من العملاء 🟢" rows={debts.customers} empty="لا توجد ديون على العملاء" />
        <div className="mt-3" />
        <DebtTable title="مستحق عليك للموردين 🔴" rows={debts.suppliers} empty="لا توجد ديون للموردين" />
        {debts.mixed.length > 0 && (
          <div className="mt-3">
            <DebtTable title="تعامل مزدوج (بيع وشراء)" rows={debts.mixed} empty="" />
          </div>
        )}
      </div>

      {/* دليل الأطراف والأصناف */}
      <div className="card p-4">
        <h3 className="mb-2 font-bold">👥 دليل العملاء والموردين</h3>
        <DirectoryTable onOpenParty={onOpenParty} />
      </div>

      <div className="card p-4">
        <h3 className="mb-2 font-bold">الأكثر بيعًا</h3>
        <Table data={agg.sale} empty="لا توجد بيانات بيع" />
      </div>

      <div className="card p-4">
        <h3 className="mb-2 font-bold">تتبع سعر البيع عبر الزمن ({reportCurrency})</h3>
        {saleItemNames.length === 0 ? (
          <p className="text-[var(--muted)]">لا توجد فواتير بيع بعد</p>
        ) : (
          <>
            <div className="mb-3">
              <Select
                value={activeItem ?? ''}
                ariaLabel="الصنف"
                onChange={(v) => setSelectedItem(v)}
                options={saleItemNames.map((n) => ({ value: n, label: n }))}
              />
            </div>
            {trendPoints.length === 0 ? (
              <p className="text-[var(--muted)]">لا توجد بيانات لهذا الصنف بعد</p>
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
  title, rows, empty,
}: {
  title: string
  rows: { p: { name: string; invoiceCount: number }; bal: number }[]
  empty: string
}) {
  const total = rows.reduce((s, r) => s + r.bal, 0)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-bold">{title}</span>
        <span className="font-black text-[var(--brand)]">{total.toLocaleString('en-US')}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">{empty}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.name}>
                <td className="border-b border-[var(--border)] py-1.5">👤 {r.p.name}</td>
                <td className="border-b border-[var(--border)] py-1.5 text-center text-xs text-[var(--muted)]">
                  {r.p.invoiceCount} فواتير
                </td>
                <td className="border-b border-[var(--border)] py-1.5 text-left font-bold">
                  {r.bal.toLocaleString('en-US')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

  if (invoices.length === 0) return <p className="text-[var(--muted)]">لا توجد بيانات بعد</p>
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 ابحث عن عميل أو مورد..."
        className="mb-2 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm"
      />
      {parties.length === 0 ? (
        <p className="text-[var(--muted)]">لا توجد نتائج</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="border-b border-[var(--border)] py-1.5 text-right">الاسم</th>
              <th className="border-b border-[var(--border)] py-1.5 text-right">النوع</th>
              <th className="border-b border-[var(--border)] py-1.5 text-right">الفواتير</th>
              <th className="border-b border-[var(--border)] py-1.5 text-right">إجمالي التعامل ({meta.currency})</th>
            </tr>
          </thead>
          <tbody>
            {parties.map(({ p, volume }) => (
              <tr
                key={p.name}
                onClick={() => onOpenParty?.(p.name)}
                className={onOpenParty ? 'cursor-pointer hover:bg-white/5' : undefined}
                title={onOpenParty ? 'عرض كشف الحساب' : undefined}
              >
                <td className="border-b border-[var(--border)] py-1.5 font-semibold">
                  {p.name} {onOpenParty && <span className="text-[var(--brand)]">📊</span>}
                </td>
                <td className="border-b border-[var(--border)] py-1.5 text-xs text-[var(--muted)]">
                  {p.kinds.has('sale') && p.kinds.has('purchase')
                    ? 'عميل + مورد'
                    : p.kinds.has('sale') ? 'عميل'
                    : p.kinds.has('purchase') ? 'مورد' : '🧾 إشعارات فقط'}
                </td>
                <td className="border-b border-[var(--border)] py-1.5">{p.invoiceCount}</td>
                <td className="border-b border-[var(--border)] py-1.5 font-bold">{volume.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

  if (invoices.length === 0) return <p className="text-[var(--muted)]">لا توجد فواتير بعد</p>
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-white/5" style={{ direction: 'ltr' }}>
        <line x1={10} y1={base} x2={W - 10} y2={base} stroke="rgba(255,255,255,.2)" />
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
              <text x={cx} y={H - 8} fill={net < 0 ? '#f87171' : '#8b96ab'} fontSize={9} textAnchor="middle">
                {x.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex justify-center gap-4 text-xs text-[var(--muted)]">
        <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> مبيعات</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> مشتريات</span>
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
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-white/5">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(255,255,255,.2)" />
      <path d={path} fill="none" stroke="#2e8bff" strokeWidth={2.5} />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3.5} fill="#ffb020">
          <title>
            {points[i].price.toLocaleString('en-US')} — {new Date(points[i].date).toLocaleDateString('en-US')}
          </title>
        </circle>
      ))}
      <text x={P} y={14} fill="#8b96ab" fontSize={10}>
        أعلى: {max.toLocaleString('en-US')}
      </text>
      <text x={P} y={H - 6} fill="#8b96ab" fontSize={10}>
        أدنى: {min.toLocaleString('en-US')}
      </text>
    </svg>
  )
}
