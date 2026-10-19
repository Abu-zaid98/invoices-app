/**
 * Premium Invoice Export Utility — Arabic-safe
 *
 * Strategy:
 *  - PNG  → Direct Canvas-2D renderer (invoiceCanvas.ts): deterministic geometry,
 *            browser-native Arabic shaping. No DOM screenshots.
 *  - PDF file → Real PDF via jsPDF from the canvas (invoicePdf.ts), A4-paginated.
 *  - Print / Save-as-PDF → standalone HTML from buildInvoiceHTML (vector).
 *  - Live preview → same buildInvoiceHTML in an iframe (مصدر واحد للمعاينة والطباعة).
 *
 * كل المخرجات تستهلك نفس `InvoiceDesign` (قالب + ألوان + عناصر الظهور) لضمان الاتساق.
 */

import type { Invoice, Meta, PaymentEntry } from './types'
import { currencySymbol, calcTotals, PAYMENT_METHOD_META } from './types'
import { getInvoiceQR } from './qr'
import { formatDate } from './format'
import { INVOICE_CREDIT } from './developer'
import { drawInvoiceCanvas } from './invoiceCanvas'
import {
  resolveDesign, templateTraits, withAlpha, shade, readableOn, docTitle,
  type InvoiceDesign, type TemplateTraits,
} from './invoiceDesign'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Western/Latin numerals (0123456789) */
function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(ts: number) {
  return formatDate(ts)
}
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const LOGO_H: Record<string, number> = { sm: 40, md: 56, lg: 78 }

/**
 * العلامة المائية: رمز «فاتورة/سند» بحدّ سفلي مسنّن + الأحرف MJ خفيفة داخل الرمز.
 * تُرسم كـ SVG في الطباعة/المعاينة، وبمثلها على Canvas في PDF/PNG.
 */
function watermarkSVG(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6.1 3.6A2 2 0 0 1 8.1 1.7h7.8a2 2 0 0 1 2 1.9v17.1l-1.95-1.25-1.95 1.25-1.95-1.25L10.1 20.7 8.15 19.45 6.1 20.7z"/>
    <path d="M8.7 6.5h6.6M8.7 9.4h6.6"/>
    <text x="12" y="15.9" text-anchor="middle" font-size="5.2" font-weight="700" fill="currentColor" stroke="none" opacity="0.9">MJ</text>
  </svg>`
}

// ─── CSS builder (يشتق كل القوالب من نفس البنية) ─────────────────────────────

function buildStyle(design: InvoiceDesign, traits: TemplateTraits, preview: boolean): string {
  const c = design.colors
  const p = c.primary
  const p2 = c.secondary
  const head = c.heading
  const ink = c.text
  const surface = c.surface
  const line = c.border
  const total = c.total
  const headLight = traits.headerLight
  const onPrimary = readableOn(p)

  // ⚠️ إعلانات CSS فقط (بلا مُحدِّد) — تُدمج داخل قاعدة .hdr
  const headerDecls = (() => {
    switch (traits.header) {
      case 'gradient':
        return `background:linear-gradient(135deg,${shade(p, -0.14)},${p} 55%,${p2});color:#fff;`
      case 'solid':
        return `background:${p};color:${onPrimary};`
      case 'panel':
        return `background:${p};color:${onPrimary};padding:40px 40px 30px;border-radius:0 0 26px 26px;`
      case 'band':
        return `background:#fff;color:${ink};border-top:9px solid ${p};border-bottom:1px solid ${line};`
      case 'minimal':
      default:
        return `background:#fff;color:${ink};border-bottom:2px solid ${line};padding:26px 40px 20px;`
    }
  })()

  const headInk = headLight ? '#ffffff' : ink
  const headSub = headLight ? 'rgba(255,255,255,.72)' : withAlpha(ink, 0.6)

  const tableCSS = (() => {
    switch (traits.table) {
      case 'solid-light':
        return `thead tr{background:#f1f3f7;}thead th{color:${head};border-bottom:2px solid ${head};}`
      case 'plain':
        return `thead tr{background:transparent;}thead th{color:${head};border-bottom:2px solid ${line};}`
      case 'solid-primary':
        return `thead tr{background:${p};}thead th{color:${readableOn(p)};border-bottom:2px solid ${p};}`
      case 'tinted':
      default:
        return `thead tr{background:${withAlpha(p, 0.12)};}thead th{color:${head};border-bottom:2px solid ${withAlpha(p, 0.35)};}`
    }
  })()

  const totalCSS = (() => {
    switch (traits.total) {
      case 'solid':
        return `.total-card{background:${total};color:#fff;box-shadow:none;}.total-card::before{display:none;}`
      case 'bordered':
        return `.total-card{background:#fff;border:1.5px solid ${line};box-shadow:none;color:${ink};}.total-card::before{display:none;}`
      case 'accent':
        return `.total-card{background:${surface};border:1px solid ${line};border-inline-start:6px solid ${p};box-shadow:none;color:${ink};}.total-card::before{display:none;}`
      case 'hero':
        return `.total-card{background:${p};color:#fff;min-width:100%;border-radius:18px;}.total-card::before{display:none;}.tc-amt{font-size:38px;}`
      case 'gradient':
      default:
        return `.total-card{background:linear-gradient(135deg,${shade(p, -0.12)},${p});color:#fff;}`
    }
  })()

  const filledTotals = traits.total === 'solid' || traits.total === 'gradient' || traits.total === 'hero'
  const totalLabel = filledTotals ? 'rgba(255,255,255,.68)' : withAlpha(ink, 0.62)
  const totalValue = filledTotals ? '#ffffff' : total
  const totalRow = filledTotals ? 'rgba(255,255,255,.78)' : ink
  const totalSep = filledTotals ? 'rgba(255,255,255,.25)' : line

  return `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{
    font-family:'Cairo','Tahoma',sans-serif;
    background:#eef0f7;
    display:flex;align-items:flex-start;justify-content:center;
    padding:28px 12px;min-height:100vh;direction:rtl;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  }
  .page{
    width:794px;min-height:1100px;background:#fff;border-radius:20px;
    box-shadow:0 20px 70px rgba(0,0,0,.18);overflow:hidden;position:relative;color:${ink};
  }
  .hdr{padding:32px 40px 26px;position:relative;overflow:hidden;${headerDecls}}
  .hdr-inner{position:relative;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
  .hdr.center .hdr-inner{flex-direction:column;align-items:center;text-align:center;}
  .co-block{display:flex;align-items:center;gap:14px;min-width:0;}
  .hdr.center .co-block{flex-direction:column;gap:8px;text-align:center;}
  .co-name{font-size:23px;font-weight:900;color:${headInk};line-height:1.15;}
  .co-sub{font-size:12.5px;color:${headSub};margin-top:3px;}
  .inv-num-lbl{font-size:11px;color:${headSub};letter-spacing:1.4px;font-weight:600;text-align:left;}
  .inv-num{font-size:34px;font-weight:900;color:${headInk};line-height:1;text-align:left;direction:ltr;}
  .hdr.center .inv-num-lbl,.hdr.center .inv-num{text-align:center;}
  .logo-img{max-height:${LOGO_H[design.elements.logoSize] ?? 56}px;max-width:150px;object-fit:contain;background:#fff;border-radius:9px;padding:4px;}
  .type-pill{
    position:relative;z-index:2;margin-top:16px;display:inline-flex;align-items:center;gap:7px;
    border-radius:100px;padding:5px 16px;font-size:13px;font-weight:700;
  }
  .type-dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.9;}
  .type-pill--solid{background:${withAlpha(headLight ? '#ffffff' : p, headLight ? 0.2 : 0.12)};
    border:1.5px solid ${withAlpha(headLight ? '#ffffff' : p, 0.38)};color:${headInk};}
  .meta-bar{background:${surface};border-bottom:1px solid ${line};padding:14px 40px;display:flex;gap:28px;flex-wrap:wrap;}
  .mi-lbl{font-size:10.5px;color:${withAlpha(ink, 0.55)};font-weight:700;margin-bottom:2px;}
  .mi-val{font-size:13.5px;color:${ink};font-weight:700;}
  .body{padding:24px 40px;}
  table{width:100%;border-collapse:collapse;font-size:13.5px;}
  thead{display:table-header-group;}
  thead th{padding:11px 14px;font-weight:800;font-size:11.5px;}
  ${tableCSS}
  tbody tr{break-inside:avoid;}
  tbody td{padding:11px 14px;border-bottom:1px solid ${line};vertical-align:top;}
  .idx{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;
    background:${withAlpha(p, 0.14)};color:${head};font-size:11px;font-weight:800;}
  .it-name{font-weight:700;color:${ink};}
  .it-spec{font-size:11.5px;color:${withAlpha(ink, 0.55)};margin-top:2px;}
  .num{font-variant-numeric:tabular-nums;white-space:nowrap;}
  .line-total{font-weight:800;color:${head};}
  .total-wrap{margin-top:24px;display:flex;justify-content:flex-start;break-inside:avoid;}
  .total-card{border-radius:16px;padding:18px 24px;min-width:250px;position:relative;overflow:hidden;}
  .total-card::before{content:'';position:absolute;top:-28px;right:-28px;width:90px;height:90px;background:rgba(255,255,255,.08);border-radius:50%;}
  ${totalCSS}
  .trow{display:flex;justify-content:space-between;gap:24px;font-size:12.5px;color:${totalRow};padding:2px 0;position:relative;z-index:1;}
  .tsep{height:1px;background:${totalSep};margin:10px 0;position:relative;z-index:1;}
  .tc-lbl{font-size:10.5px;color:${totalLabel};font-weight:700;letter-spacing:.6px;margin-bottom:5px;position:relative;z-index:1;}
  .tc-amt{font-size:26px;font-weight:900;color:${totalValue};line-height:1;position:relative;z-index:1;direction:ltr;text-align:right;}
  .trow--pay{color:${filledTotals ? 'rgba(255,255,255,.85)' : ink};}
  .box{margin-top:14px;background:${surface};border:1px solid ${line};border-radius:12px;padding:12px 16px;break-inside:avoid;}
  .box-title{font-size:11px;color:${withAlpha(ink, 0.55)};font-weight:700;margin-bottom:4px;}
  .box-body{font-size:13px;color:${ink};line-height:1.9;white-space:pre-line;}
  .box--terms{background:${withAlpha(c.secondary, 0.06)};border-style:dashed;}
  .payrow{display:flex;justify-content:space-between;font-size:12.5px;color:${ink};padding:3px 0;border-bottom:1px solid ${line};}
  .fresh{border-bottom:0;padding-bottom:0;}
  .footer{padding:20px 40px 28px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;}
  .credit{font-size:9.5px;font-weight:600;letter-spacing:.02em;color:${withAlpha(ink, 0.5)};margin-top:8px;}
  .fn{font-size:11.5px;color:${withAlpha(ink, 0.55)};line-height:1.7;max-width:300px;}
  .thank{font-size:14px;font-weight:800;color:${head};margin-top:10px;}
  .sig-img{max-height:72px;max-width:160px;display:block;margin:0 auto;}
  .sig-lbl{margin-top:6px;padding-top:6px;border-top:1.5px solid ${line};font-size:10.5px;color:${withAlpha(ink, 0.55)};font-weight:700;text-align:center;}
  .sig-line{width:150px;border-bottom:1.5px solid ${line};height:40px;margin:0 auto 6px;}
  .mid-div{height:1px;background:linear-gradient(90deg,transparent,${line},transparent);margin:0 40px;}
  .bar{height:6px;background:linear-gradient(90deg,${shade(p, -0.12)},${p},${p2});}
  .wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:58%;max-width:400px;aspect-ratio:1/1;opacity:.05;pointer-events:none;user-select:none;color:${p};}
  .wm svg{width:100%;height:100%;display:block;}
  ${preview ? `
  body{padding:0;background:transparent;display:block;min-height:0;}
  .page{width:100%;max-width:none;min-height:0;border-radius:0;box-shadow:none;}
  ` : ''}
  @media print{
    body{background:#fff;padding:0;display:block;}
    .page{box-shadow:none;border-radius:0;width:100%;min-height:0;}
    thead{display:table-header-group;}
    tr,.total-wrap,.box{break-inside:avoid;}
  }
  `
}

// ─── Build standalone HTML (preview + print share this) ───────────────────────

export function buildInvoiceHTML(
  inv: Invoice,
  meta: Meta,
  qrDataUrl = '',
  opts: { preview?: boolean } = {},
): string {
  const design = resolveDesign(meta)
  const traits = templateTraits(design)
  const el = design.elements
  const preview = !!opts.preview

  const isSale = inv.type === 'sale'
  const isCredit = inv.type === 'credit'
  const creditSale = (inv.creditKind ?? 'sale') === 'sale'
  const sym = currencySymbol(inv.currency)
  const company = meta.company.name || 'اسم الشركة'
  const num = String(inv.id).padStart(4, '0')
  const sig = meta.company.signature ?? ''
  const logo = meta.company.logo ?? ''
  const paid = Number(inv.paidAmount) || 0
  const remaining = Math.max(0, inv.total - paid)
  const title = docTitle(inv, design)
  const showLogo = el.logo && !!logo
  const centered = el.logoPosition === 'center'
  const logoAtEnd = el.logoPosition === 'end'

  const bt = calcTotals(inv.items, inv.discountType ?? null, inv.discountValue || 0, inv.taxPercent || 0)

  // ── جدول الأصناف ──
  const colCount = 3 + (el.itemNumbers ? 1 : 0) + 1 // كمية + سعر + إجمالي + (رقم)
  const rows = inv.items.map((it, i) => `
    <tr>
      ${el.itemNumbers ? `<td style="text-align:center;"><span class="idx">${i + 1}</span></td>` : ''}
      <td>
        <div class="it-name">${esc(it.name)}</div>
        ${el.itemSpecs && it.specs ? `<div class="it-spec">${esc(it.specs)}</div>` : ''}
      </td>
      <td style="text-align:center;" class="num">${it.qty}</td>
      <td style="text-align:center;" class="num">${fmt(it.price)} ${sym}</td>
      <td style="text-align:center;" class="num line-total">${fmt(it.qty * it.price)} ${sym}</td>
    </tr>`).join('')

  // ── صفوف الإجمالي ──
  const breakdownRows = el.breakdown
    ? `
      <div class="trow"><span>المجموع الفرعي</span><span class="num">${fmt(bt.subtotal)} ${sym}</span></div>
      ${bt.discountAmount > 0 ? `<div class="trow"><span>الخصم${inv.discountType === 'percent' ? ` (${inv.discountValue}%)` : ''}</span><span class="num">− ${fmt(bt.discountAmount)} ${sym}</span></div>` : ''}
      ${bt.taxAmount > 0 ? `<div class="trow"><span>الضريبة (${inv.taxPercent}%)</span><span class="num">+ ${fmt(bt.taxAmount)} ${sym}</span></div>` : ''}
      <div class="tsep"></div>`
    : ''

  const paidRemainingRows = `
    ${el.paid ? `<div class="trow trow--pay"><span>المدفوع</span><span class="num">${fmt(paid)} ${sym}</span></div>` : ''}
    ${el.remaining && remaining > 0 ? `<div class="trow trow--pay"><span>المتبقي</span><span class="num">${fmt(remaining)} ${sym}</span></div>` : ''}
  `

  // ── صناديق نصية ──
  const notesBlock = el.notes && inv.notes
    ? `<div class="box"><div class="box-title">ملاحظات</div><div class="box-body">${esc(inv.notes)}</div></div>` : ''
  const termsBlock = el.terms && meta.defaultTerms
    ? `<div class="box box--terms"><div class="box-title">الشروط والأحكام</div><div class="box-body">${esc(meta.defaultTerms)}</div></div>` : ''
  const paymentsBlock = el.payments && (inv.payments || []).length > 0
    ? `<div class="box">
         <div class="box-title">سجل الدفعات</div>
         ${(inv.payments || []).map((pay, i, arr) => `
           <div class="payrow${i === arr.length - 1 ? ' fresh' : ''}">
             <span>${fmtDate(pay.date)}${pay.note ? ` — ${esc(pay.note)}` : ''}</span>
             <span class="num" style="font-weight:700;">${fmt(pay.amount)} ${sym}</span>
           </div>`).join('')}
       </div>` : ''

  // ── الشريط التعريفي ──
  const metaItems: string[] = []
  metaItems.push(`<div><div class="mi-lbl">التاريخ</div><div class="mi-val">${fmtDate(inv.date)}</div></div>`)
  if (el.party) metaItems.push(`<div><div class="mi-lbl">${isCredit ? 'الطرف' : isSale ? 'العميل' : 'المورد'}</div><div class="mi-val">${esc(inv.party)}</div></div>`)
  metaItems.push(`<div><div class="mi-lbl">العملة</div><div class="mi-val">${inv.currency} — ${sym}</div></div>`)
  if (el.dueDate && inv.dueDate != null) metaItems.push(`<div><div class="mi-lbl">الاستحقاق</div><div class="mi-val">${fmtDate(inv.dueDate)}</div></div>`)
  if (el.payMethod && inv.payMethod) metaItems.push(`<div><div class="mi-lbl">طريقة الدفع</div><div class="mi-val">${PAYMENT_METHOD_META[inv.payMethod].label}</div></div>`)
  const metaBar = `<div class="meta-bar">${metaItems.join('')}</div>`

  // ── الرأس ──
  const logoImg = showLogo ? `<img src="${logo}" class="logo-img" alt="الشعار"/>` : ''
  const coBlock = `
    <div class="co-block">
      ${!logoAtEnd ? logoImg : ''}
      <div>
        ${el.companyName ? `<div class="co-name">${esc(company)}</div>` : ''}
        <div class="co-sub">نظام إدارة الفواتير</div>
      </div>
    </div>`
  const numBlock = el.invoiceNumber
    ? `<div style="text-align:${centered ? 'center' : 'left'};">
         <div class="inv-num-lbl">رقم الفاتورة</div>
         <div class="inv-num">#${num}</div>
         ${logoAtEnd ? logoImg : ''}
       </div>`
    : (logoAtEnd ? `<div>${logoImg}</div>` : '<div></div>')

  const pill = el.invoiceTitle
    ? `<div class="type-pill type-pill--solid"><span class="type-dot"></span>${esc(title)}</div>`
    : ''

  const footerNote = el.footerNote
    ? `<div class="fn">
         ${isCredit && inv.linkedId != null
           ? `هذا الإشعار مرتبط بالفاتورة <strong>#${String(inv.linkedId).padStart(4, '0')}</strong> ومطبَّق على الحساب.<br/>`
           : 'هذه الفاتورة صادرة إلكترونياً عبر تطبيق فواتيري.<br/>'}
         للاستفسار يرجى ذكر رقم الفاتورة <strong>#${num}</strong>
       </div>` : '<div></div>'

  const footerBlocks: string[] = []
  if (el.qr && qrDataUrl) {
    footerBlocks.push(`<div style="text-align:center;"><img src="${qrDataUrl}" style="width:84px;height:84px;display:block;margin:0 auto;" alt="QR"/><div class="sig-lbl">امسح للتحقق</div></div>`)
  }
  if (el.signature) {
    footerBlocks.push(sig
      ? `<div><img src="${sig}" class="sig-img" alt="التوقيع"/><div class="sig-lbl">التوقيع المعتمد</div></div>`
      : `<div style="text-align:center;"><div class="sig-line"></div><div class="sig-lbl">التوقيع المعتمد</div></div>`)
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} #${num} — ${esc(company)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>${buildStyle(design, traits, preview)}</style>
</head>
<body>
<div class="page tpl-${design.template}">
  ${el.watermark ? `<div class="wm">${watermarkSVG()}</div>` : ''}
  <div class="hdr${centered ? ' center' : ''}">
    <div class="hdr-inner">
      ${coBlock}
      ${numBlock}
    </div>
    ${pill}
  </div>
  ${metaBar}
  <div class="body">
    <table>
      <thead>
        <tr>
          ${el.itemNumbers ? '<th style="width:40px;text-align:center;">#</th>' : ''}
          <th style="text-align:right;">الصنف</th>
          <th style="text-align:center;">الكمية</th>
          <th style="text-align:center;">سعر الوحدة</th>
          <th style="text-align:center;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="${colCount}" style="text-align:center;color:${withAlpha(design.colors.text, 0.5)};">لا توجد أصناف</td></tr>`}</tbody>
    </table>

    <div class="total-wrap">
      <div class="total-card">
        ${breakdownRows}
        <div class="tc-lbl">الإجمالي الكلي</div>
        <div class="tc-amt">${fmt(inv.total)} ${sym}</div>
        ${(el.paid || (el.remaining && remaining > 0)) ? `<div class="tsep"></div>${paidRemainingRows}` : ''}
      </div>
    </div>
    ${notesBlock}
    ${termsBlock}
    ${paymentsBlock}
  </div>

  <div class="mid-div"></div>

  <div class="footer">
    <div>
      ${footerNote}
      ${el.thankYou && design.footerText.trim() ? `<div class="thank">${esc(design.footerText)}</div>` : ''}
      <div class="credit">${esc(INVOICE_CREDIT)}</div>
    </div>
    ${footerBlocks.join('') || '<div></div>'}
  </div>

  <div class="bar"></div>
</div>
</body>
</html>`
}

// ─── Render invoice to canvas (PNG / PDF) ─────────────────────────────────────
export async function renderInvoiceCanvas(inv: Invoice, meta: Meta): Promise<HTMLCanvasElement> {
  return drawInvoiceCanvas(inv, meta, 2)
}

/** صورة الفاتورة كـ Blob (للمشاركة عبر Web Share) */
export async function getInvoicePNGBlob(inv: Invoice, meta: Meta): Promise<Blob> {
  const canvas = await renderInvoiceCanvas(inv, meta)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('تعذّر إنشاء صورة الفاتورة')
  return blob
}

// ─── Export as PNG ────────────────────────────────────────────────────────────
export async function exportInvoicePNG(inv: Invoice, meta: Meta): Promise<void> {
  const canvas = await renderInvoiceCanvas(inv, meta)
  download(canvas.toDataURL('image/png'), `فاتورة-${String(inv.id).padStart(4, '0')}.png`)
}

// ─── Payment receipt (سند قبض / سند دفع) ─────────────────────────────────────

export function buildReceiptHTML(entry: PaymentEntry, inv: Invoice, meta: Meta): string {
  const isSale = inv.type === 'sale'
  const sym = currencySymbol(inv.currency)
  const company = meta.company.name || 'فواتيري'
  const num = String(inv.id).padStart(4, '0')
  const method = inv.payMethod ? `${PAYMENT_METHOD_META[inv.payMethod].icon} ${PAYMENT_METHOD_META[inv.payMethod].label}` : '—'

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<title>سند ${isSale ? 'قبض' : 'دفع'} — فاتورة #${num}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Cairo','Tahoma',sans-serif;background:#fff;color:#1a2237;padding:36px;direction:rtl;}
  .box{max-width:640px;margin:0 auto;border:2px solid #111827;border-radius:16px;overflow:hidden;}
  .hdr{background:#111827;color:#fff;padding:22px 28px;display:flex;justify-content:space-between;align-items:center;}
  .hdr .t{font-size:22px;font-weight:900;}
  .hdr .s{font-size:12px;opacity:.7;margin-top:2px;}
  .amt{background:#f6f8fc;padding:20px 28px;text-align:center;border-bottom:1px solid #e5eaf4;}
  .amt .v{font-size:34px;font-weight:900;direction:ltr;}
  .amt .l{font-size:11px;color:#8b96ab;font-weight:700;}
  .rows{padding:8px 28px 20px;}
  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #eef0f7;font-size:13.5px;}
  .row .k{color:#8b96ab;font-weight:700;}
  .row .v{font-weight:700;}
  .sign{display:flex;gap:24px;padding:26px 28px 30px;}
  .sigbox{flex:1;text-align:center;font-size:11.5px;color:#8b96ab;font-weight:700;}
  .sigbox .line{border-bottom:1.5px solid #111827;height:44px;margin-bottom:6px;}
  @page{size:A5 portrait;margin:10mm;}
  @media print{body{padding:0;}.box{border-radius:0;}}
</style>
</head>
<body>
<div class="box">
  <div class="hdr">
    <div>
      <div class="t">${isSale ? '🧾 سند قبض' : '💸 سند دفع'}</div>
      <div class="s">${company}</div>
    </div>
    <div class="s" style="text-align:left;">فاتورة #${num}<br/>${fmtDate(inv.date)}</div>
  </div>
  <div class="amt">
    <div class="l">${isSale ? 'المبلغ المستلم' : 'المبلغ المدفوع'}</div>
    <div class="v">${fmt(entry.amount)} ${sym}</div>
  </div>
  <div class="rows">
    <div class="row"><span class="k">${isSale ? 'العميل' : 'المورد'}</span><span class="v">${inv.party}</span></div>
    <div class="row"><span class="k">تاريخ الدفعة</span><span class="v">${fmtDate(entry.date)}</span></div>
    ${entry.note ? `<div class="row"><span class="k">بيان</span><span class="v">${entry.note}</span></div>` : ''}
    <div class="row"><span class="k">طريقة الدفع</span><span class="v">${method}</span></div>
    <div class="row"><span class="k">إجمالي الفاتورة</span><span class="v">${fmt(inv.total)} ${sym}</span></div>
  </div>
  <div class="sign">
    <div class="sigbox"><div class="line"></div>${isSale ? 'توقيع المستلم' : 'توقيع الدافع'}</div>
    <div class="sigbox"><div class="line"></div>المحاسب</div>
  </div>
</div>
</body>
</html>`
}

export async function exportReceiptPDF(entry: PaymentEntry, inv: Invoice, meta: Meta): Promise<void> {
  const html = buildReceiptHTML(entry, inv, meta)
  const win = window.open('', '_blank', 'width=700,height=900,menubar=no,toolbar=no')
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

// ─── Print / Save as PDF (vector HTML) ───────────────────────────────────────
export async function exportInvoicePDF(inv: Invoice, meta: Meta): Promise<void> {
  const qr = await getInvoiceQR(inv).catch(() => '')
  const html = buildInvoiceHTML(inv, meta, qr)

  const printCSS = `
    <style>
      @page { size: A4 portrait; margin: 0; }
      @media print {
        body { background: #fff !important; padding: 0 !important; display: block !important; }
        .page { box-shadow: none !important; border-radius: 0 !important; width: 100% !important; min-height: 0 !important; }
      }
    </style>`
  const printHtml = html.replace('</head>', printCSS + '</head>')

  const win = window.open('', '_blank', 'width=900,height=1200,menubar=no,toolbar=no')
  if (!win) throw new Error('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة في المتصفح')

  win.document.open()
  win.document.write(printHtml)
  win.document.close()

  const tryPrint = () => {
    const fonts = (win.document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts
    if (fonts) {
      fonts.ready.then(() => { setTimeout(() => { win.focus(); win.print() }, 300) })
    } else {
      setTimeout(() => { win.focus(); win.print() }, 1200)
    }
  }

  if (win.document.readyState === 'complete') {
    tryPrint()
  } else {
    win.addEventListener('load', tryPrint)
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function download(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
