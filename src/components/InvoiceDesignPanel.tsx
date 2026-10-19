import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Meta } from '../lib/types'
import {
  DEFAULT_DESIGN, DEFAULT_TITLES, PALETTES, TEMPLATES, designForTemplate, getPalette, normalizeDesign, shade,
  type InvoiceColors, type InvoiceDesign, type InvoiceDocKind, type InvoiceElements, type InvoiceTemplate,
  type LogoPosition, type LogoSize, type Palette, type TemplateTraits,
} from '../lib/invoiceDesign'
import ConfirmModal from './ConfirmModal'
import Icon from './ui/Icon'
import InvoicePreview from './InvoicePreview'

interface Props {
  meta: Meta
  updateMeta: <K extends keyof Meta>(key: K, value: Meta[K]) => Promise<void>
  toast: (message: string, kind?: 'success' | 'danger') => void
}

type BoolElementKey = {
  [K in keyof InvoiceElements]: InvoiceElements[K] extends boolean ? K : never
}[keyof InvoiceElements]

const COLOR_FIELDS: { key: keyof InvoiceColors; label: string; sub: string }[] = [
  { key: 'primary', label: 'اللون الأساسي', sub: 'هوية الفاتورة والرأس' },
  { key: 'secondary', label: 'اللون الثانوي', sub: 'لمسات التمييز والتدرّجات' },
  { key: 'heading', label: 'لون العناوين', sub: 'العناوين والمبالغ البارزة' },
  { key: 'text', label: 'لون النصوص', sub: 'النصوص العامة' },
  { key: 'surface', label: 'الخلفيات الخفيفة', sub: 'شرائط المعلومات والصناديق' },
  { key: 'border', label: 'الحدود والفواصل', sub: 'الخطوط الفاصلة' },
  { key: 'total', label: 'الإجمالي النهائي', sub: 'صندوق الإجمالي الكلي' },
]

const CONTENT_TOGGLES: { key: BoolElementKey; label: string; sub?: string }[] = [
  { key: 'party', label: 'اسم العميل / المورد', sub: 'بيانات الطرف في شريط المعلومات' },
  { key: 'invoiceNumber', label: 'رقم الفاتورة', sub: 'يظهر في الرأس وفي التذييل' },
  { key: 'invoiceTitle', label: 'عنوان الفاتورة', sub: 'شارة نوع المستند (بيع/شراء/إشعار)' },
  { key: 'dueDate', label: 'تاريخ الاستحقاق' },
  { key: 'payMethod', label: 'طريقة الدفع' },
  { key: 'itemNumbers', label: 'ترقيم الأصناف', sub: 'عمود الرقم (#) في الجدول' },
  { key: 'itemSpecs', label: 'مواصفات الأصناف', sub: 'السطر الفرعي تحت اسم الصنف' },
  { key: 'breakdown', label: 'تفاصيل المجموع', sub: 'المجموع الفرعي والخصم والضريبة' },
  { key: 'paid', label: 'المبلغ المدفوع' },
  { key: 'remaining', label: 'المبلغ المتبقي' },
  { key: 'notes', label: 'الملاحظات' },
  { key: 'terms', label: 'الشروط والأحكام' },
  { key: 'payments', label: 'سجل الدفعات' },
  { key: 'qr', label: 'رمز QR للتحقق' },
  { key: 'signature', label: 'التوقيع المعتمد' },
  { key: 'footerNote', label: 'ملاحظة التذييل' },
  { key: 'thankYou', label: 'رسالة الشكر' },
  { key: 'watermark', label: 'العلامة المائية', sub: 'رمز فواتيري خفيف خلف المحتوى' },
]

const DOC_KINDS: { key: InvoiceDocKind; label: string }[] = [
  { key: 'sale', label: 'بيع' },
  { key: 'purchase', label: 'شراء' },
  { key: 'credit', label: 'إشعار دائن' },
  { key: 'return', label: 'مرتجع مشتريات' },
]

const TITLE_FIELDS: { key: InvoiceDocKind; label: string }[] = [
  { key: 'sale', label: 'عنوان فاتورة البيع' },
  { key: 'purchase', label: 'عنوان فاتورة الشراء' },
  { key: 'credit', label: 'عنوان الإشعار الدائن (مرتجع بيع)' },
  { key: 'return', label: 'عنوان مرتجع المشتريات' },
]

function group(headIcon: Parameters<typeof Icon>[0]['name'], title: string, sub?: string) {
  return (
    <div className="design-group-head">
      <span className="dg-icon"><Icon name={headIcon} size={17} /></span>
      <div>
        <div className="dg-title">{title}</div>
        {sub && <div className="dg-sub">{sub}</div>}
      </div>
    </div>
  )
}

function MockHeader({ traits, pal }: { traits: TemplateTraits; pal: InvoiceColors }) {
  const base: CSSProperties = { height: 22 }
  if (traits.header === 'gradient') {
    return <span className="tc-mock-head" style={{ ...base, background: `linear-gradient(135deg, ${shade(pal.primary, -0.18)}, ${pal.primary}, ${pal.secondary})` }} />
  }
  if (traits.header === 'solid' || traits.header === 'panel') {
    return <span className="tc-mock-head" style={{ ...base, background: pal.primary }} />
  }
  if (traits.header === 'band') {
    return <span className="tc-mock-head" style={{ ...base, background: '#fff', borderTop: `6px solid ${pal.primary}`, borderBottom: `1px solid ${pal.border}` }} />
  }
  return <span className="tc-mock-head" style={{ ...base, background: '#fff', borderBottom: `2px solid ${pal.border}` }} />
}

/** لوحة تخصيص تصميم الفواتير: القوالب + الألوان + العناصر + معاينة حيّة */
export default function InvoiceDesignPanel({ meta, updateMeta, toast }: Props) {
  const [design, setDesign] = useState<InvoiceDesign>(() => normalizeDesign(meta.invoiceDesign))
  const [tab, setTab] = useState<'customize' | 'preview'>('customize')
  const [previewKind, setPreviewKind] = useState<InvoiceDocKind>('sale')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showReset, setShowReset] = useState(false)
  const [terms, setTerms] = useState(meta.defaultTerms ?? '')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function scheduleSave(next: InvoiceDesign) {
    window.clearTimeout(timer.current)
    setSaveState('saving')
    timer.current = window.setTimeout(async () => {
      try {
        await updateMeta('invoiceDesign', next)
        setSaveState('saved')
        window.setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1800)
      } catch {
        setSaveState('error')
      }
    }, 550)
  }

  function patch(p: Partial<InvoiceDesign>) {
    const next: InvoiceDesign = { ...design, ...p }
    setDesign(next)
    scheduleSave(next)
  }
  function setColor(key: keyof InvoiceColors, value: string) {
    patch({ colors: { ...design.colors, [key]: value } })
  }
  function setElement<K extends keyof InvoiceElements>(key: K, value: InvoiceElements[K]) {
    patch({ elements: { ...design.elements, [key]: value } })
  }
  function chooseTemplate(id: InvoiceTemplate) {
    patch(designForTemplate(id, design))
  }
  function choosePalette(p: Palette) {
    patch({ colors: { ...p.colors } })
  }
  function matchesPalette(p: Palette) {
    return (Object.keys(p.colors) as (keyof InvoiceColors)[])
      .every((k) => p.colors[k].toLowerCase() === (design.colors[k] ?? '').toLowerCase())
  }
  function doReset() {
    const fresh: InvoiceDesign = normalizeDesign(DEFAULT_DESIGN)
    setDesign(fresh)
    scheduleSave(fresh)
    setShowReset(false)
    toast('تمت استعادة التصميم الافتراضي')
  }
  async function saveTerms() {
    await updateMeta('defaultTerms', terms.trim())
    toast(terms.trim() ? 'تم حفظ الشروط الافتراضية' : 'تم مسح الشروط الافتراضية')
  }

  return (
    <div className="stack-lg">
      <div className="segmented" role="tablist" aria-label="تخصيص الفاتورة">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'customize'}
          className="segmented-item"
          data-active={tab === 'customize'}
          onClick={() => setTab('customize')}
        >
          <Icon name="palette" size={17} />
          التخصيص
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className="segmented-item"
          data-active={tab === 'preview'}
          onClick={() => setTab('preview')}
        >
          <Icon name="eye" size={17} />
          المعاينة
        </button>
      </div>

      {/* شريط حالة الحفظ */}
      <div className="row-between" style={{ marginTop: -2 }}>
        <span className="hint">
          يُحفظ التصميم تلقائيًا ويُطبّق على الطباعة و PDF و PNG لكل الفواتير.
        </span>
        <span
          className="hint"
          style={{
            color: saveState === 'error' ? 'var(--danger)' : saveState === 'saved' ? 'var(--success)' : 'var(--muted)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
          aria-live="polite"
        >
          {saveState === 'saving' ? 'جارٍ الحفظ…' : saveState === 'saved' ? 'تم الحفظ ✓' : saveState === 'error' ? 'تعذّر الحفظ' : ''}
        </span>
      </div>

      {tab === 'preview' ? (
        <div className="stack">
          <div className="field">
            <span className="field-label">نوع المستند</span>
            <div className="segmented segmented--wrap">
              {DOC_KINDS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="segmented-item"
                  data-active={previewKind === d.key}
                  onClick={() => setPreviewKind(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <InvoicePreview meta={meta} design={design} kind={previewKind} />
          <div className="preview-note">
            <Icon name="info" size={14} />
            معاينة ببيانات تجريبية للعرض فقط — لا تُحفظ في سجلات الفواتير.
          </div>
        </div>
      ) : (
        <>
          {/* القالب */}
          <div className="card card--pad design-group">
            {group('layout', 'قالب الفاتورة', 'القالب يغيّر شكل الترويسة والجدول وصندوق الإجمالي، ويطبّق لوحة ألوانه الافتراضية (قابلة للتعديل)')}
            <div className="grid-2">
              {TEMPLATES.map((t) => {
                const pal = getPalette(t.paletteId).colors
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="template-card"
                    data-active={design.template === t.id}
                    onClick={() => chooseTemplate(t.id)}
                    aria-pressed={design.template === t.id}
                  >
                    <span className="tc-mock" aria-hidden="true">
                      <MockHeader traits={t.traits} pal={pal} />
                      <span className="tc-mock-bar" />
                      <span className="tc-mock-row"><i /><i /><i /></span>
                    </span>
                    <span className="tc-name">{t.name}</span>
                    <span className="tc-desc">{t.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* الألوان */}
          <div className="card card--pad design-group">
            {group('droplet', 'الألوان', 'لوحات جاهزة أو ألوان مخصصة لكل عنصر')}
            <div className="palette-grid" style={{ marginBottom: 14 }}>
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="palette-btn"
                  data-active={matchesPalette(p)}
                  onClick={() => choosePalette(p)}
                  aria-pressed={matchesPalette(p)}
                  title={p.name}
                >
                  <span className="pb-colors" aria-hidden="true">
                    <i style={{ background: p.colors.primary }} />
                    <i style={{ background: p.colors.secondary }} />
                    <i style={{ background: p.colors.heading }} />
                    <i style={{ background: p.colors.total }} />
                  </span>
                  <span className="pb-name">{p.name}</span>
                </button>
              ))}
            </div>
            {COLOR_FIELDS.map((f) => (
              <div className="color-row" key={f.key}>
                <span className="color-swatch" style={{ background: design.colors[f.key] }}>
                  <input
                    type="color"
                    value={design.colors[f.key]}
                    onChange={(e) => setColor(f.key, e.target.value)}
                    aria-label={f.label}
                  />
                </span>
                <span className="cr-main">
                  <span className="cr-label">{f.label}</span>
                  <span className="cr-sub">{f.sub}</span>
                </span>
                <span className="cr-hex">{design.colors[f.key].toUpperCase()}</span>
              </div>
            ))}
          </div>

          {/* الهوية التجارية */}
          <div className="card card--pad design-group">
            {group('image', 'الهوية التجارية', 'الشعار واسم المنشأة')}
            <ToggleRow label="إظهار الشعار" on={design.elements.logo} onChange={(v) => setElement('logo', v)} />
            {design.elements.logo && (
              <>
                <div className="field" style={{ marginTop: 12 }}>
                  <span className="field-label">حجم الشعار</span>
                  <div className="segmented">
                    {([['sm', 'صغير'], ['md', 'متوسط'], ['lg', 'كبير']] as [LogoSize, string][]).map(([v, l]) => (
                      <button key={v} type="button" className="segmented-item" data-active={design.elements.logoSize === v} onClick={() => setElement('logoSize', v)}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <span className="field-label">موضع الشعار داخل الرأس</span>
                  <div className="segmented">
                    {([['start', 'بجانب الاسم'], ['center', 'بالمنتصف'], ['end', 'عند الرقم']] as [LogoPosition, string][]).map(([v, l]) => (
                      <button key={v} type="button" className="segmented-item" data-active={design.elements.logoPosition === v} onClick={() => setElement('logoPosition', v)}>{l}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {!meta.company.logo && (
              <p className="hint" style={{ marginTop: 10 }}>
                لم ترفع شعارًا بعد — يمكنك رفعه من قسم «المنشأة والتوقيع».
              </p>
            )}
            <div style={{ marginTop: 4 }}>
              <ToggleRow label="إظهار اسم المنشأة" on={design.elements.companyName} onChange={(v) => setElement('companyName', v)} />
            </div>
          </div>

          {/* محتوى الفاتورة */}
          <div className="card card--pad design-group">
            {group('receipt', 'محتوى الفاتورة', 'إظهار/إخفاء العناصر الاختيارية — تبقى القيم المحاسبية الأساسية ظاهرة دائمًا')}
            {CONTENT_TOGGLES.map((t) => (
              <ToggleRow key={t.key} label={t.label} sub={t.sub} on={design.elements[t.key]} onChange={(v) => setElement(t.key, v)} />
            ))}
          </div>

          {/* النصوص */}
          <div className="card card--pad design-group">
            {group('type', 'نصوص الفاتورة', 'العنوان والتذييل والشروط')}
            <p className="hint" style={{ marginTop: -2, marginBottom: 10 }}>
              لكل نوع مستند عنوانه الخاص (لأن أنواع الفواتير مختلفة). اترك الحقل فارغًا لاستخدام العنوان الافتراضي.
            </p>
            <div className="stack-sm">
              {TITLE_FIELDS.map((f) => (
                <div className="field" key={f.key}>
                  <label className="field-label" htmlFor={`inv-title-${f.key}`}>{f.label}</label>
                  <input
                    id={`inv-title-${f.key}`}
                    className="input"
                    value={design.titles[f.key]}
                    onChange={(e) => patch({ titles: { ...design.titles, [f.key]: e.target.value } })}
                    placeholder={DEFAULT_TITLES[f.key]}
                    maxLength={40}
                  />
                </div>
              ))}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label className="field-label" htmlFor="inv-footer">رسالة الشكر / التذييل</label>
              <input
                id="inv-footer"
                className="input"
                value={design.footerText}
                onChange={(e) => patch({ footerText: e.target.value })}
                placeholder="شكراً لتعاملكم معنا"
                maxLength={80}
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label className="field-label" htmlFor="inv-terms">
                الشروط والأحكام الافتراضية
                <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(تُطبع في كل فاتورة)</span>
              </label>
              <textarea
                id="inv-terms"
                className="textarea"
                rows={2}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="مثال: الدفع خلال 14 يوم من تاريخ الفاتورة."
              />
            </div>
            <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={saveTerms}>
              <Icon name="check" />
              حفظ الشروط الافتراضية
            </button>
          </div>

          {/* استعادة */}
          <button type="button" className="btn btn--tint-danger btn--block" onClick={() => setShowReset(true)}>
            <Icon name="refresh" />
            استعادة التصميم الافتراضي
          </button>
        </>
      )}

      <ConfirmModal
        isOpen={showReset}
        variant="danger"
        icon={<Icon name="refresh" />}
        title="استعادة التصميم الافتراضي"
        message={'سيتم إرجاع القالب والألوان وعناصر الظهور إلى الإعدادات الافتراضية.\n\nلن تتأثر أي بيانات أو قيم محاسبية في فواتيرك.\n\nهل تريد المتابعة؟'}
        confirmLabel="نعم، استعادة الافتراضي"
        cancelLabel="تراجع"
        onConfirm={doReset}
        onCancel={() => setShowReset(false)}
      />
    </div>
  )
}

function ToggleRow({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="toggle-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="tr-main">
        <span className="tr-label">{label}</span>
        {sub && <span className="tr-sub">{sub}</span>}
      </span>
      <span className="switch" data-on={on} />
    </button>
  )
}
