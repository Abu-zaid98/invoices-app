import type { Invoice, Meta } from './types'
import { convert, currencySymbol, invoiceBalance, PAYMENT_META } from './types'

/**
 * كشف العمليات PDF — جدول بسيط لفترة زمنية (كل العمليات أو عميل/مورد معين).
 * نفس استراتيجية الفواتير: نافذة طباعة → حفظ PDF (تشكيل عربي سليم).
 */

export interface OperationsFilter {
  from: number | null // timestamp بداية اليوم
  to: number | null // timestamp نهاية اليوم
  party: string // '' = الكل
}

export function filterOperations(invoices: Invoice[], f: OperationsFilter): Invoice[] {
  return invoices
    .filter((i) => (f.party ? i.party.trim() === f.party.trim() : true))
    .filter((i) => (f.from != null ? i.date >= f.from : true))
    .filter((i) => (f.to != null ? i.date <= f.to : true))
    .sort((a, b) => a.date - b.date)
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function buildOperationsHTML(
  all: Invoice[],
  meta: Meta,
  f: OperationsFilter,
  currency: string,
): string {
  const rows = filterOperations(all, f)
  const sym = currencySymbol(currency)
  const company = meta.company.name || 'فواتيري'
  const periodLabel =
    f.from != null || f.to != null
      ? `${f.from != null ? fmtDate(f.from) : 'البداية'} ← ${f.to != null ? fmtDate(f.to) : 'اليوم'}`
      : 'كل الفترات'
  const partyLabel = f.party || 'كل العملاء والموردين'

  const sales = rows.filter((i) => i.type === 'sale')
  const purchases = rows.filter((i) => i.type === 'purchase')
  const sum = (list: Invoice[]) => list.reduce((s, i) => s + convert(i.total, i.currency, currency, meta.rates), 0)
  const sumPaid = (list: Invoice[]) =>
    list.reduce((s, i) => s + convert(i.paidAmount || 0, i.currency, currency, meta.rates), 0)
  const totalSales = sum(sales)
  const totalPurchases = sum(purchases)
  const totalPaid = sumPaid(rows)
  const totalRemaining = rows.reduce((s, i) => s + convert(invoiceBalance(i), i.currency, currency, meta.rates), 0)

  const bodyRows = rows.map((inv, idx) => {
    const total = convert(inv.total, inv.currency, currency, meta.rates)
    const paid = convert(inv.paidAmount || 0, inv.currency, currency, meta.rates)
    const bal = convert(invoiceBalance(inv), inv.currency, currency, meta.rates)
    const st = PAYMENT_META[inv.paymentStatus ?? 'unpaid']?.label ?? ''
    return `
    <tr>
      <td>${idx + 1}</td>
      <td>${fmtDate(inv.date)}</td>
      <td style="font-weight:700;">#${String(inv.id).padStart(4, '0')}</td>
      <td><span class="pill ${inv.type === 'credit' ? 'credit' : inv.type}">${inv.type === 'sale' ? 'بيع' : inv.type === 'credit' ? '↩️ مرتجع' : 'شراء'}</span></td>
      <td style="font-weight:700;">${inv.party}</td>
      <td>${fmt(total)}</td>
      <td>${fmt(paid)}</td>
      <td style="font-weight:700;">${fmt(bal)}</td>
      <td class="muted">${st}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<title>كشف عمليات — ${company}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Cairo','Tahoma',sans-serif;background:#fff;color:#1a2237;padding:32px;direction:rtl;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:16px;margin-bottom:16px;}
  .co{font-size:22px;font-weight:900;}
  .title{font-size:15px;font-weight:800;color:#374151;margin-top:2px;}
  .meta{font-size:12px;color:#6b7280;text-align:left;line-height:1.9;}
  .summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;}
  .card{flex:1;min-width:140px;border:1.5px solid #e5e7eb;border-radius:12px;padding:10px 14px;}
  .card .l{font-size:11px;color:#6b7280;font-weight:700;}
  .card .v{font-size:17px;font-weight:900;margin-top:2px;}
  table{width:100%;border-collapse:collapse;font-size:12.5px;}
  thead th{background:#111827;color:#fff;padding:9px 10px;font-size:11.5px;}
  tbody td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;}
  tbody td:nth-child(5){text-align:right;}
  .pill{display:inline-block;border-radius:100px;padding:2px 12px;font-size:11.5px;font-weight:800;}
  .pill.sale{background:#d1fae5;color:#065f46;}
  .pill.purchase{background:#fef3c7;color:#92400e;}
  .pill.credit{background:#ede9fe;color:#5b21b6;}
  .muted{color:#6b7280;font-size:11.5px;}
  .foot{margin-top:14px;font-size:11px;color:#6b7280;line-height:1.9;border-top:1px solid #e5e7eb;padding-top:10px;}
  @page{size:A4 portrait;margin:12mm;}
  @media print{body{padding:0;}}
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="co">🧾 ${company}</div>
      <div class="title">كشف عمليات (${sym})</div>
    </div>
    <div class="meta">
      <div>الفترة: ${periodLabel}</div>
      <div>الطرف: ${partyLabel}</div>
      <div>عدد العمليات: ${rows.length}</div>
    </div>
  </div>

  <div class="summary">
    <div class="card"><div class="l">💰 إجمالي المبيعات</div><div class="v">${fmt(totalSales)} ${sym}</div></div>
    <div class="card"><div class="l">🛒 إجمالي المشتريات</div><div class="v">${fmt(totalPurchases)} ${sym}</div></div>
    <div class="card"><div class="l">✅ المدفوع</div><div class="v" style="color:#059669;">${fmt(totalPaid)} ${sym}</div></div>
    <div class="card"><div class="l">⏳ المتبقي</div><div class="v" style="color:#dc2626;">${fmt(totalRemaining)} ${sym}</div></div>
  </div>

  ${rows.length === 0 ? '<p class="muted" style="text-align:center;padding:30px;">لا توجد عمليات مطابقة للفلترة</p>' : `
  <table>
    <thead>
      <tr>
        <th>#</th><th>التاريخ</th><th>رقم الفاتورة</th><th>النوع</th><th style="text-align:right;">الطرف</th>
        <th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>`}

  <div class="foot">
    صدر من تطبيق فواتيري 🧾 — المبالغ محوّلة إلى ${currency} حسب أسعار الصرف الحالية.
  </div>
</body>
</html>`
}

export async function exportOperationsPDF(
  all: Invoice[],
  meta: Meta,
  f: OperationsFilter,
  currency: string,
): Promise<void> {
  const html = buildOperationsHTML(all, meta, f, currency)
  const win = window.open('', '_blank', 'width=900,height=1200,menubar=no,toolbar=no')
  if (!win) throw new Error('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة في المتصفح')
  win.document.open()
  win.document.write(html)
  win.document.close()
  const tryPrint = () => {
    const fonts = (win.document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts
    if (fonts) {
      fonts.ready.then(() => setTimeout(() => { win.focus(); win.print() }, 300))
    } else {
      setTimeout(() => { win.focus(); win.print() }, 1200)
    }
  }
  if (win.document.readyState === 'complete') tryPrint()
  else win.addEventListener('load', tryPrint)
}
