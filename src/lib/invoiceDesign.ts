import type { Invoice, Meta } from './types'

/**
 * نظام تخصيص تصميم الفواتير
 * ─────────────────────────────────────────────────────────────────────────
 * - قوالب بصرية مختلفة البنية فعليًا (classic / modern / minimal / professional / bold).
 * - ألوان قابلة للتخصيص (٧ أدوار لونية) + لوحات جاهزة متناسقة.
 * - خيارات إظهار/إخفاء العناصر الاختيارية فقط (تبقى الحقول المحاسبية الأساسية).
 * - يُطبّق التصميم نفسه على المعاينة + الطباعة + PDF + PNG من مصدر واحد.
 *
 * ملاحظة: التصميم عام على مستوى التطبيق، لذا يسري على عرض/طباعة جميع الفواتير
 * (القديمة والجديدة) دون المساس بأي بيانات أو قيم محاسبية محفوظة.
 */

export type InvoiceTemplate = 'classic' | 'modern' | 'minimal' | 'professional' | 'bold'

export type LogoSize = 'sm' | 'md' | 'lg'
export type LogoPosition = 'start' | 'center' | 'end'

/** الأدوار اللونية السبعة القابلة للتخصيص */
export interface InvoiceColors {
  /** اللون الأساسي (الهوية) */
  primary: string
  /** اللون الثانوي / لمسة التمييز */
  secondary: string
  /** لون العناوين والعناصر البارزة */
  heading: string
  /** لون النصوص */
  text: string
  /** لون الخلفيات الخفيفة */
  surface: string
  /** لون الحدود والفواصل */
  border: string
  /** لون الإجمالي النهائي والمبالغ المهمة */
  total: string
}

/** عناصر اختيارية يمكن إظهارها/إخفاؤها (لا تشمل الأرقام المحاسبية الأساسية) */
export interface InvoiceElements {
  logo: boolean
  logoSize: LogoSize
  logoPosition: LogoPosition
  companyName: boolean
  party: boolean
  invoiceTitle: boolean
  invoiceNumber: boolean
  itemNumbers: boolean
  itemSpecs: boolean
  /** تفاصيل المجموع (فرعي/خصم/ضريبة) — الإجمالي الكلي يظهر دائمًا */
  breakdown: boolean
  paid: boolean
  remaining: boolean
  payMethod: boolean
  dueDate: boolean
  notes: boolean
  terms: boolean
  payments: boolean
  qr: boolean
  signature: boolean
  footerNote: boolean
  thankYou: boolean
  watermark: boolean
}

/** أنواع المستندات لعناوين الفاتورة */
export type InvoiceDocKind = 'sale' | 'purchase' | 'credit' | 'return'

/** عناوين قابلة للتخصيص حسب نوع المستند (فارغ = العنوان التلقائي) */
export type InvoiceTitles = Record<InvoiceDocKind, string>

export const DEFAULT_TITLES: InvoiceTitles = {
  sale: 'فاتورة بيع',
  purchase: 'فاتورة شراء',
  credit: 'إشعار دائن',
  return: 'مرتجع مشتريات',
}

/** نوع المستند الفعلي للفاتورة (يميّز بين الإشعار الدائن ومرتجع المشتريات) */
export function docKind(inv: Invoice): InvoiceDocKind {
  if (inv.type === 'credit') return (inv.creditKind ?? 'sale') === 'sale' ? 'credit' : 'return'
  return inv.type === 'sale' ? 'sale' : 'purchase'
}

/** العنوان الظاهر على الفاتورة: عنوان النوع المخصّص ← عنوان عام قديم ← العنوان التلقائي */
export function docTitle(inv: Invoice, design: InvoiceDesign): string {
  const kind = docKind(inv)
  const specific = design.titles?.[kind]?.trim()
  if (specific) return specific
  const general = design.invoiceTitle?.trim()
  if (general) return general
  return DEFAULT_TITLES[kind]
}

export interface InvoiceDesign {
  template: InvoiceTemplate
  colors: InvoiceColors
  elements: InvoiceElements
  /** عناوين مخصّصة حسب نوع المستند (فارغ = العنوان التلقائي) */
  titles: InvoiceTitles
  /** عنوان عام (توافق خلفي) يُستخدم إن لم يُخصَّص عنوان للنوع */
  invoiceTitle: string
  /** رسالة الشكر/التذييل */
  footerText: string
}

// ─── لوحات الألوان الجاهزة ────────────────────────────────────────────────────

export interface Palette {
  id: string
  name: string
  colors: InvoiceColors
}

export const PALETTES: Palette[] = [
  {
    id: 'slate',
    name: 'رمادي رسمي',
    colors: { primary: '#334155', secondary: '#64748b', heading: '#0f172a', text: '#1e293b', surface: '#f4f6f9', border: '#e2e8f0', total: '#0f172a' },
  },
  {
    id: 'blue',
    name: 'أزرق',
    colors: { primary: '#1e88e5', secondary: '#00b8d4', heading: '#1565c0', text: '#1c2733', surface: '#eef5fd', border: '#d6e6f7', total: '#1565c0' },
  },
  {
    id: 'emerald',
    name: 'أخضر',
    colors: { primary: '#1f9d63', secondary: '#38bdf8', heading: '#0f7a4b', text: '#182a24', surface: '#eefaf4', border: '#d2ecdf', total: '#0f7a4b' },
  },
  {
    id: 'gold',
    name: 'ذهبي',
    colors: { primary: '#c2891c', secondary: '#1f9e7a', heading: '#8a5a00', text: '#22303f', surface: '#fbf6ea', border: '#ecdfc6', total: '#a86e00' },
  },
  {
    id: 'violet',
    name: 'بنفسجي',
    colors: { primary: '#6d5bd0', secondary: '#e15dab', heading: '#5240b8', text: '#211f33', surface: '#f4f2fd', border: '#e0dbf6', total: '#5240b8' },
  },
  {
    id: 'rose',
    name: 'وردي',
    colors: { primary: '#c13584', secondary: '#f59e0b', heading: '#a01f6a', text: '#2a1f27', surface: '#fdf2f8', border: '#f3d9e8', total: '#a01f6a' },
  },
]

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

// ─── القوالب البصرية ──────────────────────────────────────────────────────────

export type HeaderStyle = 'gradient' | 'solid' | 'band' | 'minimal' | 'panel'
export type TotalStyle = 'gradient' | 'solid' | 'bordered' | 'accent' | 'hero'
export type TableStyle = 'tinted' | 'solid-light' | 'plain' | 'solid-primary'

export interface TemplateTraits {
  /** مظهر الرأس */
  header: HeaderStyle
  /** نص الرأس فاتح أم داكن */
  headerLight: boolean
  /** مظهر بطاقة الإجمالي */
  total: TotalStyle
  /** مظهر رأس الجدول */
  table: TableStyle
  /** خلفية الصفحة الداخلية (للرأس) */
  headerRadius: boolean
}

export interface TemplateDef {
  id: InvoiceTemplate
  name: string
  desc: string
  /** لوحة الألوان الافتراضية للقالب */
  paletteId: string
  traits: TemplateTraits
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'classic',
    name: 'كلاسيكي',
    desc: 'ترويسة بلون واحد + إجمالي داكن — تقليدي منظّم',
    paletteId: 'slate',
    traits: { header: 'solid', headerLight: true, total: 'solid', table: 'solid-light', headerRadius: false },
  },
  {
    id: 'modern',
    name: 'حديث',
    desc: 'ترويسة متدرّجة + جدول ملوّن + إجمالي متدرّج',
    paletteId: 'blue',
    traits: { header: 'gradient', headerLight: true, total: 'gradient', table: 'tinted', headerRadius: false },
  },
  {
    id: 'minimal',
    name: 'بسيط',
    desc: 'ترويسة بيضاء بخط سفلي + إجمالي بإطار — أخفّ على الطباعة',
    paletteId: 'slate',
    traits: { header: 'minimal', headerLight: false, total: 'bordered', table: 'plain', headerRadius: false },
  },
  {
    id: 'professional',
    name: 'احترافي',
    desc: 'شريط لوني أعلى الترويسة + إجمالي بشريط جانبي — رسمي للأعمال',
    paletteId: 'emerald',
    traits: { header: 'band', headerLight: false, total: 'accent', table: 'tinted', headerRadius: false },
  },
  {
    id: 'bold',
    name: 'بارز',
    desc: 'ترويسة ملوّنة بزوايا دائرية + إجمالي بعرض كامل',
    paletteId: 'violet',
    traits: { header: 'panel', headerLight: true, total: 'hero', table: 'solid-primary', headerRadius: true },
  },
]

export function getTemplate(id: InvoiceTemplate): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[1]
}

export function templateTraits(design: InvoiceDesign): TemplateTraits {
  const t = getTemplate(design.template)
  // لو كان المستخدم غيّر لوحة الألوان يدويًا، تبقى خصائص البنية كما هي
  return t.traits
}

// ─── الافتراضي ───────────────────────────────────────────────────────────────

export const DEFAULT_ELEMENTS: InvoiceElements = {
  logo: true,
  logoSize: 'md',
  logoPosition: 'start',
  companyName: true,
  party: true,
  invoiceTitle: true,
  invoiceNumber: true,
  itemNumbers: true,
  itemSpecs: true,
  breakdown: true,
  paid: true,
  remaining: true,
  payMethod: true,
  dueDate: true,
  notes: true,
  terms: true,
  payments: true,
  qr: true,
  signature: true,
  footerNote: true,
  thankYou: false,
  watermark: false,
}

export const DEFAULT_DESIGN: InvoiceDesign = {
  template: 'modern',
  colors: { ...getPalette('blue').colors },
  elements: { ...DEFAULT_ELEMENTS },
  titles: { ...DEFAULT_TITLES },
  invoiceTitle: '',
  footerText: 'شكراً لتعاملكم معنا',
}

/** تصميم القالب الافتراضي مع لون لوحته الافتراضية */
export function designForTemplate(id: InvoiceTemplate, current?: InvoiceDesign): InvoiceDesign {
  const def = getTemplate(id)
  return {
    template: id,
    colors: { ...getPalette(def.paletteId).colors },
    // نحافظ على اختيارات إظهار العناصر والنصوص عند تبديل القالب
    elements: { ...(current?.elements ?? DEFAULT_ELEMENTS) },
    titles: { ...(current?.titles ?? DEFAULT_TITLES) },
    invoiceTitle: current?.invoiceTitle ?? '',
    footerText: current?.footerText ?? DEFAULT_DESIGN.footerText,
  }
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function safeColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : fallback
}

/** يدمج جزءًا محفوظًا مع الافتراضي ويضمن صلاحية الحقول (متوافق مع النسخ القديمة) */
export function normalizeDesign(input?: Partial<InvoiceDesign> | null): InvoiceDesign {
  const template: InvoiceTemplate =
    input?.template && TEMPLATES.some((t) => t.id === input.template)
      ? input.template
      : 'modern'
  const basePalette = getPalette(getTemplate(template).paletteId).colors
  const inColors = (input?.colors ?? {}) as Partial<InvoiceColors>
  const colors: InvoiceColors = {
    primary: safeColor(inColors.primary, basePalette.primary),
    secondary: safeColor(inColors.secondary, basePalette.secondary),
    heading: safeColor(inColors.heading, basePalette.heading),
    text: safeColor(inColors.text, basePalette.text),
    surface: safeColor(inColors.surface, basePalette.surface),
    border: safeColor(inColors.border, basePalette.border),
    total: safeColor(inColors.total, basePalette.total),
  }
  const elements: InvoiceElements = { ...DEFAULT_ELEMENTS, ...(input?.elements ?? {}) }
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const legacyTitle = str(input?.invoiceTitle)
  const titles: InvoiceTitles = {
    sale: str(input?.titles?.sale) ?? legacyTitle ?? DEFAULT_TITLES.sale,
    purchase: str(input?.titles?.purchase) ?? legacyTitle ?? DEFAULT_TITLES.purchase,
    credit: str(input?.titles?.credit) ?? legacyTitle ?? DEFAULT_TITLES.credit,
    return: str(input?.titles?.return) ?? legacyTitle ?? DEFAULT_TITLES.return,
  }
  return {
    template,
    colors,
    elements,
    titles,
    invoiceTitle: legacyTitle ?? '',
    footerText: typeof input?.footerText === 'string' ? input.footerText : DEFAULT_DESIGN.footerText,
  }
}

/**
 * التصميم الفعّال من الإعدادات.
 * - إن وُجد `invoiceDesign` محفوظ يُستخدم.
 * - وإلا يُشتق من `printTemplate` القديم (توافق خلفي).
 */
export function resolveDesign(meta: Meta): InvoiceDesign {
  const stored = meta.invoiceDesign
  if (stored) return normalizeDesign(stored)
  return normalizeDesign({ template: meta.printTemplate === 'classic' ? 'classic' : 'modern' })
}

// ─── أدوات ألوان ─────────────────────────────────────────────────────────────

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || '').replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** rgba من لون hex بنسبة الشفافية */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** تعتيم/تفتيح لون بنسبة (amount بين -1 و1) */
export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex)
  const t = amount < 0 ? 0 : 255
  const p = Math.abs(amount)
  const mix = (c: number) => clamp255(c + (t - c) * p)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`
}

/** لون نص مناسب (فاتح/داكن) اعتمادًا على إضاءة الخلفية */
export function readableOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  // luminance نسبية
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#111827' : '#ffffff'
}

// ─── بيانات معاينة تجريبية (لا تُحفظ مطلقًا في سجلات الفواتير) ────────────────

export const SAMPLE_INVOICE: Invoice = {
  id: 1024,
  type: 'sale',
  creditKind: null,
  linkedId: null,
  party: 'مؤسسة النور للطاقة',
  currency: 'ILS',
  date: Date.now(),
  items: [
    { name: 'لوح شمسي أحادي 550 واط', qty: 8, price: 620, specs: 'كفاءة 21% — ضمان 12 سنة' },
    { name: 'عاكس كهربائي هجين 5 كيلو', qty: 1, price: 2450, specs: 'MPPT مزدوج' },
    { name: 'بطارية ليثيوم 5 كيلوواط', qty: 2, price: 3100, specs: 'LiFePO4 — 6000 دورة' },
    { name: 'ملحقات وتركيب', qty: 1, price: 850 },
  ],
  total: 0,
  paymentStatus: 'partial',
  paidAmount: 12000,
  payMethod: 'transfer',
  payments: [
    { id: 'demo-1', amount: 8000, date: Date.now() - 12 * 86400000, note: 'دفعة مقدمة' },
    { id: 'demo-2', amount: 4000, date: Date.now() - 3 * 86400000, note: 'تحويل بنكي' },
  ],
  dueDate: Date.now() + 14 * 86400000,
  discountType: 'percent',
  discountValue: 5,
  taxPercent: 17,
  notes: 'الأسعار شاملة التركيب والتوصيل داخل المدينة.',
}
;((inv) => {
  const sub = inv.items.reduce((s, it) => s + it.qty * it.price, 0)
  const disc = (sub * (inv.discountValue || 0)) / 100
  const after = sub - disc
  inv.total = Math.round(after + (after * (inv.taxPercent || 0)) / 100)
})(SAMPLE_INVOICE)

/** نسخة من فاتورة المعاينة بنوع مستند مختلف (بيع/شراء/إشعار دائن/مرتجع) */
export function sampleInvoiceFor(kind: InvoiceDocKind): Invoice {
  if (kind === 'sale') return SAMPLE_INVOICE
  if (kind === 'purchase') {
    return { ...SAMPLE_INVOICE, type: 'purchase', creditKind: null, linkedId: null, party: 'شركة الأمل للتوريدات' }
  }
  return {
    ...SAMPLE_INVOICE,
    type: 'credit',
    creditKind: kind === 'credit' ? 'sale' : 'purchase',
    linkedId: 1018,
    party: kind === 'credit' ? SAMPLE_INVOICE.party : 'شركة الأمل للتوريدات',
    notes: `مرتجع مرتبط بالفاتورة #1018`,
  }
}
