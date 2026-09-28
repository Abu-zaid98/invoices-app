import type { Invoice, Meta } from './types'
import { currencySymbol, calcTotals, PAYMENT_META, PAYMENT_METHOD_META } from './types'
import { getInvoiceQR } from './qr'

/**
 * محرك رسم الفاتورة على Canvas-2D مباشرة (من الصفر — بلا DOM ولا لقطات).
 *
 * لماذا؟ محركات اللقط (html2canvas) تُعيد حساب هندسة الصفحة وتفشل مع RTL
 * (إزاحات يمين/يسار متكررة)، بينما Canvas يرسم بإحداثيات صريحة حتمية،
 * ومحرك نصوص المتصفح نفسه يشكّل العربية تشكيلاً سليماً.
 */

export const PAGE_W = 794
const PAD = 40

interface Palette {
  primary: string
  primaryLight: string
  primaryDark: string
  accent: string
}

const PALETTE: Palette = {
  primary: '#d4930e', primaryLight: '#ffb020', primaryDark: '#b37800', accent: '#22c9a3',
}
const CLASSIC: Palette = { primary: '#6b7280', primaryLight: '#9ca3af', primaryDark: '#111827', accent: '#374151' }

const INK = '#1a2237'
const MUTED = '#8b96ab'
const LINE = '#e8ecf5'
const META_BG = '#f6f8fc'

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function ensureFonts(): Promise<void> {
  try {
    const loads = ['400', '700', '800', '900'].map((w) => {
      try {
        return document.fonts.load(`${w} 20px Cairo`)
      } catch {
        return Promise.resolve()
      }
    })
    await Promise.race([
      Promise.all(loads).then(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 3000)),
    ])
  } catch {
    /* fallback fonts */
  }
}

interface Ctx {
  ctx: CanvasRenderingContext2D
  y: number
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function text(
  c: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'right',
  dir: 'rtl' | 'ltr' = 'rtl',
) {
  c.save()
  c.font = font
  c.fillStyle = color
  c.textAlign = align
  c.textBaseline = 'alphabetic'
  c.direction = dir
  c.fillText(str, x, y)
  c.restore()
}

function wrap(c: CanvasRenderingContext2D, str: string, font: string, maxW: number): string[] {
  c.save()
  c.font = font
  const words = str.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (c.measureText(t).width <= maxW || !cur) cur = t
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  c.restore()
  return lines
}

/** تقليم نصي ليناسب عرضاً مع … بناءً على القياس الفعلي (لا عدد الأحرف) */
function fit(c: CanvasRenderingContext2D, str: string, font: string, maxW: number): string {
  c.save()
  c.font = font
  if (c.measureText(str).width <= maxW) {
    c.restore()
    return str
  }
  let out = str
  while (out.length > 1 && c.measureText(out + '…').width > maxW) {
    out = out.slice(0, -1)
  }
  c.restore()
  return out + '…'
}

/** عزل LTR صريح (U+2066..U+2069) لقطعة (نسبة/مبلغ) داخل سطر عربي */
const LRI = String.fromCharCode(0x2066)
const PDI = String.fromCharCode(0x2069)

function ltrIsolate(s: string): string {
  return LRI + s + PDI
}

function drawFit(
  c: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  top: number,
  boxW: number,
  boxH: number,
  bg = false,
) {
  const k = Math.min(boxW / img.width, boxH / img.height, 1)
  const w = img.width * k
  const h = img.height * k
  const x = cx - w / 2
  if (bg) {
    c.save()
    c.fillStyle = '#ffffff'
    rr(c, x - 4, top - 4, w + 8, h + 8, 8)
    c.fill()
    c.restore()
  }
  c.drawImage(img, x, top, w, h)
  return h
}

/** يرسم الفاتورة كاملة على Canvas جديد ويعيده (scale=2 للطباعة) */
export async function drawInvoiceCanvas(inv: Invoice, meta: Meta, scale = 2): Promise<HTMLCanvasElement> {
  const classic = meta.printTemplate === 'classic'
  const p: Palette = classic ? CLASSIC : PALETTE
  const sym = currencySymbol(inv.currency)
  const isSale = inv.type === 'sale'
  const isCredit = inv.type === 'credit'
  const creditSale = (inv.creditKind ?? 'sale') === 'sale'
  const company = meta.company.name || 'فواتيري'
  const num = String(inv.id).padStart(4, '0')

  await ensureFonts()
  const [qrImg, sigImg, logoImg] = await Promise.all([
    getInvoiceQR(inv).then(loadImage).catch(() => null),
    loadImage(meta.company.signature ?? ''),
    loadImage(meta.company.logo ?? ''),
  ])

  const cv = document.createElement('canvas')
  cv.width = PAGE_W * scale
  cv.height = 4200 * scale
  const c = cv.getContext('2d')!
  c.scale(scale, scale)
  c.direction = 'rtl'

  const F = (w: number, s: number) => `${w} ${s}px Cairo, Tahoma, sans-serif`
  let y = 0
  const right = PAGE_W - PAD
  const left = PAD

  // ─── Watermark (خلفية باهتة) ───
  c.save()
  c.globalAlpha = 0.035
  text(c, '☀️', PAGE_W / 2, 560, F(400, 110), p.primary, 'center', 'ltr')
  c.restore()

  // ─── Header ───
  const HDR_H = 152
  const grad = c.createLinearGradient(0, 0, PAGE_W, 0)
  if (classic) {
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(1, '#ffffff')
  } else {
    grad.addColorStop(0, p.primaryDark)
    grad.addColorStop(0.55, p.primary)
    grad.addColorStop(1, p.primaryLight)
  }
  c.fillStyle = grad
  c.fillRect(0, 0, PAGE_W, HDR_H)
  if (!classic) {
    c.save()
    c.globalAlpha = 0.07
    c.fillStyle = '#ffffff'
    c.beginPath(); c.arc(PAGE_W - 20, -40, 100, 0, Math.PI * 2); c.fill()
    c.globalAlpha = 0.05
    c.beginPath(); c.arc(30, HDR_H + 30, 85, 0, Math.PI * 2); c.fill()
    c.restore()
  } else {
    c.fillStyle = '#111827'
    c.fillRect(0, HDR_H - 3, PAGE_W, 3)
  }
  const headInk = classic ? '#111827' : '#ffffff'
  const headSub = classic ? '#6b7280' : 'rgba(255,255,255,0.75)'

  // الشعار + الشركة (يمين)
  let cx = right
  if (logoImg) {
    drawFit(c, logoImg, right - 40, 30, 76, 52, true)
    cx = right - 92
  }
  text(c, `🧾 ${company}`, cx, 62, F(900, 24), headInk, 'right')
  text(c, 'نظام إدارة الفواتير', cx, 84, F(400, 12.5), headSub, 'right')

  // الرقم (يسار)
  text(c, 'رقم الفاتورة', left, 44, F(600, 11), headSub, 'left')
  text(c, `#${num}`, left, 80, F(900, 36), headInk, 'left', 'ltr')

  // شارة النوع
  const pillLabel = isCredit ? (creditSale ? '↩️ إشعار دائن' : '↩️ مرتجع مشتريات') : isSale ? '📦 فاتورة بيع' : '🛒 فاتورة شراء'
  c.save()
  c.font = F(700, 13.5)
  const pillW = c.measureText(pillLabel).width + 44
  c.restore()
  const pillX = right - pillW
  const pillY = 100
  if (classic) {
    c.fillStyle = '#111827'
    rr(c, pillX, pillY, pillW, 30, 15)
    c.fill()
  } else {
    c.save()
    c.fillStyle = 'rgba(255,255,255,0.18)'
    c.strokeStyle = 'rgba(255,255,255,0.35)'
    c.lineWidth = 1.5
    rr(c, pillX, pillY, pillW, 30, 15)
    c.fill()
    c.stroke()
    c.restore()
  }
  text(c, pillLabel, right - 22, pillY + 20, F(700, 13.5), '#ffffff', 'right')
  y = HDR_H

  // ─── Meta bar ───
  const paid = Number(inv.paidAmount) || 0
  const remaining = Math.max(0, inv.total - paid)
  const payLabel =
    inv.paymentStatus === 'paid' ? 'مدفوعة بالكامل ✅'
    : inv.paymentStatus === 'partial' ? `جزئية — متبقٍ ${fmt(remaining)} ${sym}`
    : `غير مدفوعة — ${fmt(remaining)} ${sym}`
  const partyKind = isCredit ? 'الطرف' : isSale ? 'العميل' : 'المورد'
  const metaItems: [string, string][] = [
    ['التاريخ', fmtDate(inv.date)],
    [partyKind, inv.party],
    ['العملة', `${inv.currency} — ${sym}`],
    ['عدد الأصناف', `${inv.items.length} صنف`],
    ['الدفع', payLabel],
  ]
  if (inv.payMethod) {
    const pm = PAYMENT_METHOD_META[inv.payMethod]
    metaItems.push(['طريقة الدفع', `${pm.icon} ${pm.label}`])
  }
  const COLS = 3
  const colW = (PAGE_W - PAD * 2) / COLS
  const rowsMeta = Math.ceil(metaItems.length / COLS)
  const META_H = rowsMeta * 46 + 18
  c.fillStyle = classic ? '#ffffff' : META_BG
  c.fillRect(0, y, PAGE_W, META_H)
  if (classic) {
    c.fillStyle = '#e5e7eb'
    c.fillRect(0, y + META_H - 1, PAGE_W, 1)
  }
  metaItems.forEach(([k, v], i) => {
    const col = i % COLS
    // RTL: العمود الأول يميناً
    const ccx = right - col * colW - 12
    const ry = y + 20 + Math.floor(i / COLS) * 46
    text(c, k, ccx, ry, F(700, 10.5), MUTED, 'right')
    text(c, fit(c, v, F(700, 13), colW - 28), ccx, ry + 17, F(700, 13), INK, 'right')
  })
  y += META_H

  // ─── Items table ───
  y += 24
  const cNum = 44
  const cQty = 64
  const cPrice = 120
  const cTotal = 120
  const cItem = PAGE_W - PAD * 2 - cNum - cQty - cPrice - cTotal
  // x لكل عمود (من اليمين): # | الصنف | الكمية | السعر | الإجمالي
  const xNum = right - cNum
  const xItem = xNum - cItem
  const xQty = xItem - cQty
  const xPrice = xQty - cPrice
  const xTot = xPrice - cTotal // == PAD
  const cellCX = (x0: number, w: number) => x0 + w / 2

  // رأس الجدول
  const TH_H = 34
  c.save()
  c.fillStyle = classic ? '#f3f4f6' : p.primary + '22'
  rr(c, left, y, PAGE_W - PAD * 2, TH_H, 8)
  c.fill()
  c.restore()
  c.fillStyle = classic ? '#111827' : p.primaryDark
  c.fillRect(left, y + TH_H - 2, PAGE_W - PAD * 2, 2)
  const hy = y + 22
  const thc = classic ? '#111827' : p.primaryDark
  text(c, '#', cellCX(xNum, cNum), hy, F(800, 11.5), thc, 'center')
  text(c, 'الصنف', xItem + cItem - 8, hy, F(800, 11.5), thc, 'right')
  text(c, 'الكمية', cellCX(xQty, cQty), hy, F(800, 11.5), thc, 'center')
  text(c, 'سعر الوحدة', cellCX(xPrice, cPrice), hy, F(800, 11.5), thc, 'center')
  text(c, 'الإجمالي', cellCX(xTot, cTotal), hy, F(800, 11.5), thc, 'center')
  y += TH_H

  const nameFont = F(700, 13.5)
  const specFont = F(400, 11.5)
  const numFont = F(400, 13.5)
  inv.items.forEach((it, i) => {
    const nameLines = wrap(c, it.name, nameFont, cItem - 16)
    const specLines = it.specs ? wrap(c, it.specs, specFont, cItem - 16) : []
    const rowH = 16 + nameLines.length * 20 + specLines.length * 17 + 12
    // رقم
    c.save()
    c.fillStyle = classic ? '#e5e7eb' : p.primary + '22'
    c.beginPath(); c.arc(cellCX(xNum, cNum), y + rowH / 2, 12, 0, Math.PI * 2); c.fill()
    c.restore()
    text(c, String(i + 1), cellCX(xNum, cNum), y + rowH / 2 + 4, F(800, 11), classic ? '#111827' : p.primaryDark, 'center', 'ltr')
    // الاسم + المواصفات — متمركزة عمودياً داخل الصف
    const blockH = nameLines.length * 20 + specLines.length * 17
    let ty = y + (rowH - blockH) / 2 + 15
    nameLines.forEach((ln) => { text(c, ln, xItem + cItem - 8, ty, nameFont, INK, 'right'); ty += 20 })
    specLines.forEach((ln) => { text(c, ln, xItem + cItem - 8, ty, specFont, MUTED, 'right'); ty += 17 })
    // الكمية والسعر والإجمالي (عمودياً بالمنتصف) — أرقام باتجاه LTR الصريح
    const midY = y + rowH / 2 + 5
    text(c, String(it.qty), cellCX(xQty, cQty), midY, numFont, INK, 'center', 'ltr')
    text(c, `${fmt(it.price)} ${sym}`, cellCX(xPrice, cPrice), midY, numFont, INK, 'center', 'ltr')
    text(c, `${fmt(it.qty * it.price)} ${sym}`, cellCX(xTot, cTotal), midY, F(700, 13.5), classic ? '#111827' : p.primaryDark, 'center', 'ltr')
    y += rowH
    c.fillStyle = LINE
    c.fillRect(left, y, PAGE_W - PAD * 2, 1)
  })

  // ─── Totals card (يمين) ───
  const bt = calcTotals(inv.items, inv.discountType ?? null, inv.discountValue || 0, inv.taxPercent || 0)
  y += 22
  const cardW = 250
  const cardX = right - cardW
  const tRows: [string, string][] = [
    ['المجموع الفرعي', `${fmt(bt.subtotal)} ${sym}`],
  ]
  if (bt.discountAmount > 0) {
    const dLabel = inv.discountType === 'percent' ? `الخصم ${ltrIsolate(`(${inv.discountValue}%)`)}` : 'الخصم'
    tRows.push([dLabel, `− ${fmt(bt.discountAmount)} ${sym}`])
  }
  if (bt.taxAmount > 0) {
    tRows.push([`الضريبة ${ltrIsolate(`(${inv.taxPercent}%)`)}`, `+ ${fmt(bt.taxAmount)} ${sym}`])
  }
  const cardH = 20 + tRows.length * 24 + 14 + 44
  const tGrad = c.createLinearGradient(0, y, 0, y + cardH)
  if (classic) {
    tGrad.addColorStop(0, '#111827')
    tGrad.addColorStop(1, '#111827')
  } else {
    tGrad.addColorStop(0, p.primaryDark)
    tGrad.addColorStop(1, p.primary)
  }
  c.fillStyle = tGrad
  rr(c, cardX, y, cardW, cardH, 16)
  c.fill()
  let ty = y + 26
  tRows.forEach(([k, v]) => {
    text(c, k, cardX + cardW - 16, ty, F(700, 12), 'rgba(255,255,255,0.75)', 'right')
    text(c, v, cardX + 16, ty, F(700, 12), '#ffffff', 'left', 'ltr')
    ty += 24
  })
  c.save()
  c.strokeStyle = 'rgba(255,255,255,0.25)'
  c.lineWidth = 1
  c.beginPath(); c.moveTo(cardX + 16, ty - 4); c.lineTo(cardX + cardW - 16, ty - 4); c.stroke()
  c.restore()
  text(c, 'الإجمالي الكلي', cardX + cardW - 16, ty + 16, F(700, 10.5), 'rgba(255,255,255,0.7)', 'right')
  text(c, `${fmt(inv.total)} ${sym}`, cardX + cardW - 16, ty + 40, F(900, 22), '#ffffff', 'right', 'ltr')
  y += cardH + 16

  // ─── صناديق نصية بعرض كامل ───
  const box = (title: string, body: string, dashed = false, tint = META_BG, titleCol = MUTED, bodyCol = INK) => {
    const lines = wrap(c, body, F(400, 13), PAGE_W - PAD * 2 - 32)
    const bh = 30 + lines.length * 24 + 14
    c.save()
    c.fillStyle = tint
    if (dashed) c.setLineDash([7, 5])
    c.strokeStyle = LINE
    c.lineWidth = 1
    rr(c, left, y, PAGE_W - PAD * 2, bh, 12)
    c.fill()
    c.stroke()
    c.restore()
    text(c, title, right - 16, y + 24, F(700, 11), titleCol, 'right')
    lines.forEach((ln, i) => text(c, ln, right - 16, y + 48 + i * 24, F(400, 13), bodyCol, 'right'))
    y += bh + 12
  }
  if (inv.notes) box('📝 ملاحظات', inv.notes)
  if (meta.defaultTerms) box('📜 الشروط والأحكام', meta.defaultTerms, true, '#fffdf5', '#92600a', '#4a3a10')
  if ((inv.payments || []).length > 0) {
    const payLines = (inv.payments || []).map(
      (pay) => `${fmtDate(pay.date)} — ${ltrIsolate(`${fmt(pay.amount)} ${sym}`)}${pay.note ? ` — ${pay.note}` : ''}`,
    )
    const bh = 30 + payLines.length * 24 + 14
    c.save()
    c.fillStyle = META_BG
    c.strokeStyle = LINE
    rr(c, left, y, PAGE_W - PAD * 2, bh, 12)
    c.fill(); c.stroke()
    c.restore()
    text(c, '💵 سجل الدفعات', right - 16, y + 24, F(700, 11), MUTED, 'right')
    payLines.forEach((ln, i) => text(c, ln, right - 16, y + 48 + i * 24, F(400, 12.5), INK, 'right'))
    y += bh + 12
  }

  // ─── Footer: ملاحظة + QR + توقيع ───
  y += 8
  c.fillStyle = LINE
  c.fillRect(left, y, PAGE_W - PAD * 2, 1)
  y += 18
  const footTop = y
  // يمين: ملاحظة التطبيق
  const fnLines = wrap(c, 'هذه الفاتورة صادرة إلكترونياً عبر تطبيق فواتيري. للاستفسار يرجى ذكر رقم الفاتورة #' + num, F(400, 11.5), 300)
  fnLines.forEach((ln, i) => text(c, ln, right, footTop + 16 + i * 20, F(400, 11.5), MUTED, 'right'))
  // يسار: QR والتوقيع
  let fx = left + 8
  const caption = (cap: string) => {
    text(c, cap, fx + 80, footTop + 118, F(700, 10.5), MUTED, 'center')
    fx += 172
  }
  if (qrImg) {
    c.drawImage(qrImg, fx + 80 - 42, footTop, 84, 84)
    caption('امسح للتحقق')
  }
  if (sigImg) {
    drawFit(c, sigImg, fx + 80, footTop + 6, 150, 66, true)
    caption('التوقيع المعتمد')
  } else {
    // خط توقيع فارغ
    c.save()
    c.strokeStyle = '#d0d5e4'
    c.lineWidth = 1.5
    c.beginPath(); c.moveTo(fx + 10, footTop + 66); c.lineTo(fx + 150, footTop + 66); c.stroke()
    c.restore()
    text(c, 'التوقيع المعتمد', fx + 80, footTop + 118, F(700, 10.5), MUTED, 'center')
    fx += 172
  }
  y = footTop + 132

  // ─── الشريط السفلي ───
  const barGrad = c.createLinearGradient(0, 0, PAGE_W, 0)
  if (classic) {
    barGrad.addColorStop(0, '#111827')
    barGrad.addColorStop(1, '#111827')
  } else {
    barGrad.addColorStop(0, p.primaryDark)
    barGrad.addColorStop(0.5, p.primary)
    barGrad.addColorStop(1, p.accent)
  }
  c.fillStyle = barGrad
  c.fillRect(0, y, PAGE_W, 6)
  y += 6

  // ─── قص الارتفاع الفعلي ───
  const out = document.createElement('canvas')
  out.width = PAGE_W * scale
  out.height = Math.ceil(y * scale)
  const octx = out.getContext('2d')!
  octx.fillStyle = '#ffffff'
  octx.fillRect(0, 0, out.width, out.height)
  octx.drawImage(cv, 0, 0)
  return out
}
