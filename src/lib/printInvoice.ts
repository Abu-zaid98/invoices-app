/**
 * Premium Invoice Export Utility — Arabic-safe
 *
 * Strategy (rebuilt):
 *  - PNG  → Direct Canvas-2D renderer (invoiceCanvas.ts): deterministic geometry,
 *            browser-native Arabic shaping. No DOM screenshots.
 *  - PDF file → Real PDF via jsPDF from the canvas (invoicePdf.ts), A4-paginated,
 *            shareable as a file.
 *  - Print → Classic print window from buildInvoiceHTML (vector, browser dialog).
 */

import type { Invoice, Meta } from './types'
import { currencySymbol, convert, calcTotals, PAYMENT_METHOD_META } from './types'
import { getInvoiceQR } from './qr'
import { drawInvoiceCanvas } from './invoiceCanvas'
import type { PaymentEntry } from './types'

// ─── Color palettes ──────────────────────────────────────────────────────────
const PALETTES = {
  gold: {
    primary:      '#d4930e',
    primaryLight: '#ffb020',
    primaryDark:  '#b37800',
    accent:       '#22c9a3',
    glow1:        'rgba(255,176,32,0.15)',
    glow2:        'rgba(34,201,163,0.10)',
  },
  blue: {
    primary:      '#1e88e5',
    primaryLight: '#5ea8ff',
    primaryDark:  '#1565c0',
    accent:       '#00d4ff',
    glow1:        'rgba(46,139,255,0.15)',
    glow2:        'rgba(0,212,255,0.10)',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Western/Latin numerals (0123456789) as requested
function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(ts: number) {
  // Keep date in Arabic words but with Latin digits
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

// ─── Build standalone HTML ────────────────────────────────────────────────────
export function buildInvoiceHTML(inv: Invoice, meta: Meta, qrDataUrl = ''): string {
  const isSale = inv.type === 'sale'
  const isCredit = inv.type === 'credit'
  const creditSale = (inv.creditKind ?? 'sale') === 'sale'
  const classic = meta.printTemplate === 'classic'
  const p = classic
    ? { primary: '#6b7280', primaryLight: '#9ca3af', primaryDark: '#111827', accent: '#374151', glow1: 'transparent', glow2: 'transparent' }
    : meta.theme === 'blue' ? PALETTES.blue : PALETTES.gold
  const sym = currencySymbol(inv.currency)
  const company = meta.company.name || 'اسم الشركة'
  const num = String(inv.id).padStart(4, '0')
  const sig = meta.company.signature ?? ''
  const logo = meta.company.logo ?? ''
  const paid = Number(inv.paidAmount) || 0
  const remaining = Math.max(0, inv.total - paid)
  const payLabel = inv.paymentStatus === 'paid' ? 'مدفوعة بالكامل ✅'
    : inv.paymentStatus === 'partial' ? `دفعة جزئية — المتبقي ${fmt(remaining)} ${sym}`
    : `غير مدفوعة — المستحق ${fmt(remaining)} ${sym}`
  const methodLabel = inv.payMethod ? `${PAYMENT_METHOD_META[inv.payMethod].icon} ${PAYMENT_METHOD_META[inv.payMethod].label}` : ''
  const bt = calcTotals(inv.items, inv.discountType ?? null, inv.discountValue || 0, inv.taxPercent || 0)
  const discountRow = bt.discountAmount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:12.5px;color:rgba(255,255,255,.75);margin-bottom:4px;">
         <span>الخصم${inv.discountType === 'percent' ? ` (${inv.discountValue}%)` : ''}</span>
         <span style="font-weight:700;">− ${fmt(bt.discountAmount)} ${sym}</span>
       </div>` : ''
  const taxRow = bt.taxAmount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:12.5px;color:rgba(255,255,255,.75);margin-bottom:4px;">
         <span>الضريبة (${inv.taxPercent}%)</span>
         <span style="font-weight:700;">+ ${fmt(bt.taxAmount)} ${sym}</span>
       </div>` : ''
  const notesBlock = inv.notes
    ? `<div style="margin-top:16px;background:#f6f8fc;border:1px solid #e5eaf4;border-radius:12px;padding:12px 16px;">
         <div style="font-size:11px;color:#8b96ab;font-weight:700;margin-bottom:4px;">📝 ملاحظات</div>
         <div style="font-size:13px;color:#1e2a40;line-height:1.9;white-space:pre-line;">${inv.notes}</div>
       </div>` : ''
  const termsBlock = meta.defaultTerms
    ? `<div style="margin-top:12px;background:#fffdf5;border:1px dashed #e3c878;border-radius:12px;padding:12px 16px;">
         <div style="font-size:11px;color:#92600a;font-weight:700;margin-bottom:4px;">📜 الشروط والأحكام</div>
         <div style="font-size:12.5px;color:#4a3a10;line-height:1.9;white-space:pre-line;">${meta.defaultTerms}</div>
       </div>` : ''
  const paymentsBlock = (inv.payments || []).length > 0
    ? `<div style="margin-top:12px;background:#f6f8fc;border:1px solid #e5eaf4;border-radius:12px;padding:12px 16px;">
         <div style="font-size:11px;color:#8b96ab;font-weight:700;margin-bottom:6px;">💵 سجل الدفعات</div>
         ${(inv.payments || []).map((pay) => `
           <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#1e2a40;padding:3px 0;border-bottom:1px solid #eef0f7;">
             <span>${fmtDate(pay.date)}${pay.note ? ` — ${pay.note}` : ''}</span>
             <span style="font-weight:700;">${fmt(pay.amount)} ${sym}</span>
           </div>`).join('')}
       </div>` : ''

  const rows = inv.items.map((it, i) => `
    <tr>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf5;text-align:center;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;
          border-radius:50%;background:${p.primary}22;color:${p.primaryDark};font-size:11px;font-weight:800;">
          ${i + 1}
        </span>
      </td>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf5;">
        <div style="font-weight:700;color:#1a2237;">${it.name}</div>
        ${it.specs ? `<div style="font-size:11.5px;color:#8b96ab;margin-top:2px;">${it.specs}</div>` : ''}
      </td>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf5;text-align:center;">${it.qty}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf5;text-align:center;white-space:nowrap;">${fmt(it.price)} ${sym}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #e8ecf5;text-align:center;white-space:nowrap;
          font-weight:700;color:${p.primaryDark};">${fmt(it.qty * it.price)} ${sym}</td>
    </tr>`).join('')

  // No alt currencies — only show the invoice's own currency

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>فاتورة #${num} — ${company}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{
    font-family:'Cairo','Tahoma',sans-serif;
    background:#eef0f7;
    display:flex;align-items:flex-start;justify-content:center;
    padding:28px 12px;
    min-height:100vh;
    direction:rtl;
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }

  /* A4 page */
  .page{
    width:794px;min-height:1100px;
    background:#fff;
    border-radius:20px;
    box-shadow:0 20px 70px rgba(0,0,0,.18);
    overflow:hidden;
    position:relative;
  }

  /* Header */
  .hdr{
    background:linear-gradient(135deg,${p.primaryDark},${p.primary},${p.primaryLight});
    padding:32px 40px 26px;position:relative;overflow:hidden;
  }
  .hdr::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;
    background:rgba(255,255,255,.07);border-radius:50%;}
  .hdr::after{content:'';position:absolute;bottom:-50px;left:-50px;width:170px;height:170px;
    background:rgba(255,255,255,.05);border-radius:50%;}
  .hdr-inner{position:relative;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;}
  .co-name{font-size:24px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.2);}
  .co-sub{font-size:12.5px;color:rgba(255,255,255,.7);margin-top:3px;}
  .inv-num-lbl{font-size:11px;color:rgba(255,255,255,.6);letter-spacing:1.5px;text-transform:uppercase;font-weight:600;text-align:left;}
  .inv-num{font-size:36px;font-weight:900;color:#fff;line-height:1;text-align:left;direction:ltr;
    text-shadow:0 3px 10px rgba(0,0,0,.25);}
  .type-pill{
    position:relative;z-index:2;margin-top:16px;
    display:inline-flex;align-items:center;gap:7px;
    background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.35);
    border-radius:100px;padding:5px 16px;font-size:13.5px;font-weight:700;color:#fff;
  }
  .type-dot{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.9);}

  /* Meta bar */
  .meta-bar{background:#f6f8fc;border-bottom:1px solid #e5eaf4;padding:14px 40px;
    display:flex;gap:28px;flex-wrap:wrap;}
  .mi-lbl{font-size:10.5px;color:#8b96ab;font-weight:700;text-transform:uppercase;letter-spacing:.7px;margin-bottom:2px;}
  .mi-val{font-size:13.5px;color:#1e2a40;font-weight:700;}

  /* Table */
  .body{padding:24px 40px;}
  table{width:100%;border-collapse:collapse;font-size:13.5px;}
  thead tr{background:linear-gradient(90deg,${p.primary}18,${p.accent}10);}
  thead th{padding:11px 14px;font-weight:800;font-size:11.5px;color:${p.primaryDark};
    border-bottom:2px solid ${p.primary}44;letter-spacing:.3px;}
  thead th:first-child{text-align:center;}
  thead th:nth-child(3),thead th:nth-child(4),thead th:nth-child(5){text-align:center;}

  /* Total card */
  .total-wrap{margin-top:24px;display:flex;justify-content:flex-start;}
  .total-card{
    background:linear-gradient(135deg,${p.primaryDark},${p.primary});
    border-radius:16px;padding:18px 26px;min-width:210px;
    box-shadow:0 8px 24px ${p.glow1};position:relative;overflow:hidden;
  }
  .total-card::before{content:'';position:absolute;top:-28px;right:-28px;width:90px;height:90px;
    background:rgba(255,255,255,.08);border-radius:50%;}
  .tc-lbl{font-size:10.5px;color:rgba(255,255,255,.65);font-weight:700;letter-spacing:.8px;
    text-transform:uppercase;margin-bottom:5px;position:relative;z-index:1;}
  .tc-amt{font-size:26px;font-weight:900;color:#fff;line-height:1;
    text-shadow:0 2px 8px rgba(0,0,0,.2);position:relative;z-index:1;direction:ltr;text-align:right;}

  /* Footer */
  .footer{padding:20px 40px 28px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;}
  .fn{font-size:11.5px;color:#aab2c4;line-height:1.7;max-width:300px;}
  .sig-img{max-height:72px;max-width:160px;display:block;margin:0 auto;}
  .sig-lbl{margin-top:6px;padding-top:6px;border-top:1.5px solid #d0d5e4;
    font-size:10.5px;color:#8b96ab;font-weight:700;text-align:center;letter-spacing:.5px;}

  /* Bottom bar */
  .bar{height:6px;background:linear-gradient(90deg,${p.primaryDark},${p.primary},${p.accent});}

  ${classic ? `
  /* Classic overrides — رسمي أبيض */
  .hdr{background:#fff;border-bottom:3px solid #111827;}
  .hdr::before,.hdr::after{display:none;}
  .co-name{color:#111827;text-shadow:none;}
  .co-sub{color:#6b7280;}
  .inv-num-lbl{color:#9ca3af;}
  .inv-num{color:#111827;text-shadow:none;}
  .type-pill{background:#111827;border:none;}
  thead tr{background:#f3f4f6;}
  thead th{color:#111827;border-bottom:2px solid #111827;}
  .total-card{background:#111827;box-shadow:none;}
  .total-card::before{display:none;}
  .wm{display:none;}
  .bar{background:#111827;}
  ` : ''}

  /* Watermark */
  .wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    font-size:110px;opacity:.03;pointer-events:none;user-select:none;color:${p.primary};}

  @media print{
    body{background:#fff;padding:0;}
    .page{box-shadow:none;border-radius:0;width:100%;min-height:0;}
  }
</style>
</head>
<body>
<div class="page">
  <div class="wm">☀️</div>
  <div class="hdr">
    <div class="hdr-inner">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logo ? `<img src="${logo}" style="max-height:56px;max-width:120px;object-fit:contain;background:#fff;border-radius:8px;padding:4px;" alt="الشعار"/>` : ''}
        <div>
          <div class="co-name">🧾 ${company}</div>
          <div class="co-sub">نظام إدارة الفواتير</div>
        </div>
      </div>
      <div>
        <div class="inv-num-lbl">رقم الفاتورة</div>
        <div class="inv-num">#${num}</div>
      </div>
    </div>
    <div class="type-pill">
      <div class="type-dot"></div>
      ${isCredit ? (creditSale ? 'إشعار دائن ↩️' : 'مرتجع مشتريات ↩️') : isSale ? 'فاتورة بيع' : 'فاتورة شراء'}
    </div>
  </div>

  <div class="meta-bar">
    <div><div class="mi-lbl">التاريخ</div><div class="mi-val">${fmtDate(inv.date)}</div></div>
    <div><div class="mi-lbl">${isCredit ? 'الطرف' : isSale ? 'العميل' : 'المورد'}</div><div class="mi-val">${inv.party}</div></div>
    <div><div class="mi-lbl">العملة</div><div class="mi-val">${inv.currency} — ${sym}</div></div>
    <div><div class="mi-lbl">عدد الأصناف</div><div class="mi-val">${inv.items.length} صنف</div></div>
    <div><div class="mi-lbl">الدفع</div><div class="mi-val">${payLabel}</div></div>
    ${methodLabel ? `<div><div class="mi-lbl">طريقة الدفع</div><div class="mi-val">${methodLabel}</div></div>` : ''}
  </div>

  <div class="body">
    <table>
      <thead>
        <tr>
          <th style="width:40px;">#</th>
          <th style="text-align:right;">الصنف</th>
          <th>الكمية</th>
          <th>سعر الوحدة</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="total-wrap">
      <div class="total-card">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.7);margin-bottom:4px;">
          <span>المجموع الفرعي</span><span style="font-weight:700;">${fmt(bt.subtotal)} ${sym}</span>
        </div>
        ${discountRow}
        ${taxRow}
        <div class="tc-lbl">الإجمالي الكلي</div>
        <div class="tc-amt">${fmt(inv.total)} ${sym}</div>
      </div>
    </div>
    ${notesBlock}
    ${termsBlock}
    ${paymentsBlock}
  </div>

  <div style="height:1px;background:linear-gradient(90deg,transparent,#dde2ef,transparent);margin:0 40px;"></div>

  <div class="footer">
    <div class="fn">
      <strong style="color:#6b7694;">ملاحظة:</strong><br/>
      ${isCredit && inv.linkedId != null
        ? `هذا الإشعار مرتبط بالفاتورة <strong style="color:#6b7694;">#${String(inv.linkedId).padStart(4, '0')}</strong> ومطبَّق على الحساب.<br/>`
        : 'هذه الفاتورة صادرة إلكترونياً عبر تطبيق فواتيري.<br/>'}      للاستفسار يرجى ذكر رقم الفاتورة <strong style="color:#6b7694;">#${num}</strong>
    </div>
    ${qrDataUrl
      ? `<div style="text-align:center;"><img src="${qrDataUrl}" style="width:84px;height:84px;display:block;margin:0 auto;" alt="QR"/><div class="sig-lbl">امسح للتحقق</div></div>`
      : ''
    }
    ${sig
      ? `<div><img src="${sig}" class="sig-img" alt="التوقيع"/><div class="sig-lbl">التوقيع المعتمد</div></div>`
      : `<div style="text-align:center;">
           <div style="width:160px;border-bottom:1.5px solid #d0d5e4;padding-bottom:36px;margin-bottom:6px;"></div>
           <div class="sig-lbl">التوقيع المعتمد</div>
         </div>`
    }
  </div>

  <div class="bar"></div>
</div>
</body>
</html>`
}

// ─── Render invoice to canvas (المحرك الجديد: رسم مباشر — NG PNG) ─────────────
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

// ─── Export as PDF (via browser print dialog → Save as PDF) ──────────────────
export async function exportInvoicePDF(inv: Invoice, meta: Meta): Promise<void> {
  const qr = await getInvoiceQR(inv).catch(() => '')
  const html = buildInvoiceHTML(inv, meta, qr)

  // Inject print-specific CSS that triggers "Save as PDF" workflow
  const printCSS = `
    <style>
      @page { size: A4 portrait; margin: 0; }
      @media print {
        body { background: #fff !important; padding: 0 !important; }
        .page {
          box-shadow: none !important;
          border-radius: 0 !important;
          width: 100% !important;
          min-height: 0 !important;
        }
      }
    </style>`
  const printHtml = html.replace('</head>', printCSS + '</head>')

  const win = window.open('', '_blank', 'width=900,height=1200,menubar=no,toolbar=no')
  if (!win) throw new Error('تعذّر فتح نافذة الطباعة — يرجى السماح بالنوافذ المنبثقة في المتصفح')

  win.document.open()
  win.document.write(printHtml)
  win.document.close()

  // Wait for fonts then print
  const tryPrint = () => {
    const fonts = (win.document as any).fonts
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
