import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import { DEFAULT_META, currencySymbol } from '../lib/types'
import type { Meta } from '../lib/types'
import { TRASH_RETENTION_MS } from '../lib/db'
import { downloadJsonBackup, downloadInvoicesCsv } from '../lib/backup'
import { formatDate } from '../lib/format'
import Select from '../components/Select'
import ConfirmModal from '../components/ConfirmModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import SignaturePad from '../components/SignaturePad'
import InvoiceDesignPanel from '../components/InvoiceDesignPanel'
import { DeveloperProfile } from '../components/DeveloperProfile'
import Icon, { type IconName } from '../components/ui/Icon'
import { usePWAInstall } from '../lib/usePWAInstall'

const APP_VERSION = '0.1.0'

type SectionId =
  | 'appearance' | 'company' | 'invoice'
  | 'currencies'
  | 'data' | 'trash'
  | 'security' | 'install' | 'about' | 'developer'

interface SectionDef {
  id: SectionId
  title: string
  sub: string
  icon: IconName
  tone: string
  group: string
  keywords: string
}

const SECTIONS: SectionDef[] = [
  { id: 'appearance', title: 'المظهر', sub: 'الوضع الفاتح والداكن', icon: 'sparkles', tone: 'g-violet', group: 'التخصيص', keywords: 'theme dark light لون وضع' },
  { id: 'company', title: 'المنشأة والتوقيع', sub: 'الاسم والشعار والتوقيع المعتمد', icon: 'user', tone: 'g-blue', group: 'التخصيص', keywords: 'company logo signature اسم شعار توقيع' },
  { id: 'invoice', title: 'تصميم الفواتير', sub: 'القالب والألوان والطباعة', icon: 'printer', tone: 'g-amber', group: 'التخصيص', keywords: 'invoice template color print قالب ألوان طباعة تصميم' },
  { id: 'currencies', title: 'العملات وأسعار الصرف', sub: 'إدارة العملات وقيم التحويل', icon: 'bank', tone: 'g-green', group: 'الحسابات', keywords: 'currency rate عملة صرف تحويل' },
  { id: 'data', title: 'النسخ الاحتياطي', sub: 'تصدير واستيراد بياناتك', icon: 'download', tone: 'g-blue', group: 'البيانات', keywords: 'backup export import نسخة احتياطي تصدير استيراد csv' },
  { id: 'trash', title: 'سلة المحذوفات', sub: 'استعادة أو حذف نهائي', icon: 'trash', tone: 'g-red', group: 'البيانات', keywords: 'trash delete سلة محذوفات حذف استعادة' },
  { id: 'security', title: 'الأمان والقفل', sub: 'رمز الدخول والقفل التلقائي', icon: 'shield', tone: 'g-red', group: 'النظام', keywords: 'security pin lock أمان رمز قفل خروج' },
  { id: 'install', title: 'التثبيت على الجهاز', sub: 'ثبّت التطبيق للوصول السريع', icon: 'phone', tone: 'g-blue', group: 'النظام', keywords: 'install pwa تثبيت جهاز' },
  { id: 'about', title: 'حول البرنامج', sub: 'الإصدار ومعلومات التطبيق', icon: 'info', tone: 'g-violet', group: 'النظام', keywords: 'about version حول إصدار معلومات' },
  { id: 'developer', title: 'حول المطوّر', sub: 'م. محمد الجوجو — التواصل والدعم', icon: 'code', tone: 'g-green', group: 'النظام', keywords: 'developer about author support مطور مطوّر حول حقوق ملكية فكرية واتساب دعم تواصل مؤلف' },
]

const GROUPS = ['التخصيص', 'الحسابات', 'البيانات', 'النظام']

/** خيارات وضع الواجهة — تُعرَض كبطاقتين بمعاينة مصغّرة */
const THEME_OPTIONS = [
  { id: 'dark', name: 'داكن', icon: 'moon' },
  { id: 'light', name: 'فاتح', icon: 'sun' },
] as const

function useIsWide(query = '(min-width: 800px)') {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return wide
}

export default function Settings({ onLocked }: { onLocked: () => void }) {
  const { meta, invoices, trash, updateMeta, importAll, restoreInvoice, deleteForever, emptyTrash } = useAppData()
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState(meta.company.name)
  const [newCur, setNewCur] = useState('')
  const [rateDraft, setRateDraft] = useState<Record<string, number>>({ ...meta.rates })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const isWide = useIsWide()
  const [active, setActive] = useState<SectionId | null>(isWide ? 'appearance' : null)
  const [q, setQ] = useState('')
  // حماية من فقدان تعديلات غير محفوظة عند مغادرة القسم
  const [leaveTarget, setLeaveTarget] = useState<{ id: SectionId | null } | null>(null)

  const dirty =
    (active === 'company' && companyName.trim() !== (meta.company.name ?? '').trim()) ||
    (active === 'currencies' && meta.currencies.some((c) => (rateDraft[c] ?? 1) !== (meta.rates[c] ?? 1)))

  function goTo(id: SectionId | null) {
    if (dirty) {
      setLeaveTarget({ id })
      return
    }
    setActive(id)
    setQ('')
  }

  function confirmLeave() {
    setCompanyName(meta.company.name)
    setRateDraft({ ...meta.rates })
    setActive(leaveTarget?.id ?? null)
    setLeaveTarget(null)
    setQ('')
  }

  // Confirmation modal states
  const [pendingDeleteCurrency, setPendingDeleteCurrency] = useState<string | null>(null)
  const [showResetPinModal, setShowResetPinModal] = useState(false)
  const [pendingImportData, setPendingImportData] = useState<{ meta: Meta; invoices: any[] } | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showLockModal, setShowLockModal] = useState(false)
  const [showDeleteSignatureModal, setShowDeleteSignatureModal] = useState(false)
  const [showDeleteLogoModal, setShowDeleteLogoModal] = useState(false)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const [pendingForeverDelete, setPendingForeverDelete] = useState<number | null>(null)
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false)
  const { installed, isIOS, canNativePrompt, install } = usePWAInstall(999999999)
  const [installBusy, setInstallBusy] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return SECTIONS
    return SECTIONS.filter((s) => `${s.title} ${s.sub} ${s.keywords}`.toLowerCase().includes(query))
  }, [q])

  async function handleInstallClick() {
    setInstallBusy(true)
    try {
      const res = await install()
      if (res === true) return
      setShowInstallHelp(true)
    } finally {
      setInstallBusy(false)
    }
  }

  async function saveCompany() {
    try {
      await updateMeta('company', { ...meta.company, name: companyName.trim() })
      toast('تم حفظ بيانات المنشأة')
    } catch {
      toast('تعذّر الحفظ — تحقق من مساحة التخزين وأعد المحاولة', 'danger')
    }
  }

  async function handleSignatureFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      await updateMeta('company', { ...meta.company, signature: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('يرجى اختيار ملف صورة', 'danger')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      await updateMeta('company', { ...meta.company, logo: reader.result as string })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function confirmDeleteLogo() {
    await updateMeta('company', { ...meta.company, logo: undefined })
    setShowDeleteLogoModal(false)
  }

  async function saveRates() {
    try {
      await updateMeta('rates', { ...meta.rates, ...rateDraft })
      toast('تم حفظ أسعار الصرف')
    } catch {
      toast('تعذّر الحفظ — تحقق من مساحة التخزين وأعد المحاولة', 'danger')
    }
  }

  async function addCurrency() {
    const code = newCur.trim().toUpperCase()
    if (!/^[A-Z]{2,4}$/.test(code)) return toast('يرجى إدخال رمز عملة صحيح (٢-٤ أحرف)', 'danger')
    if (meta.currencies.includes(code)) return toast('هذه العملة مضافة مسبقًا', 'danger')
    await updateMeta('currencies', [...meta.currencies, code])
    await updateMeta('rates', { ...meta.rates, [code]: 1 })
    setRateDraft((r) => ({ ...r, [code]: 1 }))
    setNewCur('')
  }

  function handleRequestRemoveCurrency(code: string) {
    if (invoices.some((i) => i.currency === code)) {
      return toast('لا يمكن حذف عملة مستخدمة في فواتير موجودة', 'danger')
    }
    setPendingDeleteCurrency(code)
  }

  async function confirmRemoveCurrency() {
    if (!pendingDeleteCurrency) return
    const code = pendingDeleteCurrency
    await updateMeta('currencies', meta.currencies.filter((c) => c !== code))
    const rates = { ...meta.rates }
    delete rates[code]
    await updateMeta('rates', rates)
    if (meta.currency === code) await updateMeta('currency', 'ILS')
    setPendingDeleteCurrency(null)
  }

  async function confirmDeleteSignature() {
    await updateMeta('company', { ...meta.company, signature: undefined })
    setShowDeleteSignatureModal(false)
  }

  async function handleSaveHandSignature(dataUrl: string) {
    await updateMeta('company', { ...meta.company, signature: dataUrl })
    setShowSignaturePad(false)
  }

  async function confirmResetPin() {
    await updateMeta('pin', null)
    toast('تم إعادة تعيين رمز الدخول')
    setShowResetPinModal(false)
    onLocked()
  }

  async function handleConfirmExportBackup() {
    downloadJsonBackup(meta, invoices)
    await updateMeta('lastBackupAt', Date.now())
    setShowExportModal(false)
    toast('تم تحميل النسخة الاحتياطية بنجاح')
  }

  function handleExportCsv() {
    if (invoices.length === 0) return toast('لا توجد فواتير لتصديرها', 'danger')
    downloadInvoicesCsv(invoices)
    toast('تم تصدير ملف Excel/CSV بنجاح')
  }

  async function confirmForeverDelete() {
    if (pendingForeverDelete == null) return
    await deleteForever(pendingForeverDelete)
    toast('تم الحذف النهائي')
    setPendingForeverDelete(null)
  }

  async function confirmEmptyTrash() {
    await emptyTrash()
    toast('تم إفراغ سلة المحذوفات')
    setShowEmptyTrashModal(false)
  }

  async function handleRestore(id: number) {
    await restoreInvoice(id)
    toast('تمت استعادة الفاتورة بنجاح')
  }

  function daysLeft(deletedAt: number): number {
    return Math.max(0, Math.ceil((TRASH_RETENTION_MS - (Date.now() - deletedAt)) / (24 * 3600 * 1000)))
  }

  function onImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!parsed || !Array.isArray(parsed.invoices)) throw new Error('bad')
        const importedMeta: Meta = { ...DEFAULT_META, ...parsed.meta }
        setPendingImportData({ meta: importedMeta, invoices: parsed.invoices })
      } catch {
        toast('الملف غير صالح كنسخة احتياطية', 'danger')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function confirmImportBackup() {
    if (!pendingImportData) return
    await importAll(pendingImportData)
    toast('تم استيراد النسخة الاحتياطية بنجاح')
    setPendingImportData(null)
  }

  // ─── محتوى الأقسام ──────────────────────────────────────────────────────────

  /** تنقّل لوحة المفاتيح بين وضعي الواجهة (مجموعة أزرار radio) */
  function onThemeKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const group = e.currentTarget
    const next = meta.theme === 'dark' ? 'light' : 'dark'
    updateMeta('theme', next).catch(() => {})
    requestAnimationFrame(() => group.querySelector<HTMLElement>(`[data-mode-id="${next}"]`)?.focus())
  }

  const appearanceSection = (
    <div className="card card--pad">
      <div className="section-head">
        <span className="section-title">وضع الواجهة</span>
        <span className="stat-icon g-violet" style={{ width: 34, height: 34 }}><Icon name="sparkles" size={18} /></span>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>اختر الشكل المريح لعينك — يُحفظ التغيير فورًا.</p>

      <div className="theme-grid" role="radiogroup" aria-label="وضع الواجهة" onKeyDown={onThemeKey}>
        {THEME_OPTIONS.map((t) => {
          const on = meta.theme === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`وضع ${t.name}`}
              data-active={on}
              data-mode-id={t.id}
              tabIndex={on ? 0 : -1}
              className="theme-opt"
              onClick={() => updateMeta('theme', t.id).catch(() => {})}
            >
              <span className="theme-opt-preview" data-mode={t.id} aria-hidden="true">
                <span className="thm-head">
                  <span className="thm-logo" />
                  <span className="thm-line thm-line--sm" />
                </span>
                <span className="thm-body">
                  <span className="thm-line thm-line--lg thm-line--strong" />
                  <span className="thm-line thm-line--md" />
                </span>
                <span className="thm-foot">
                  <span className="thm-pill" />
                  <span className="thm-pill thm-pill--ghost" />
                </span>
              </span>

              <span className="theme-opt-label">
                <Icon name={t.icon} size={15} />
                {t.name}
              </span>

              {on && (
                <span className="theme-opt-check" aria-hidden="true">
                  <Icon name="check" size={13} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  const companySection = (
    <div className="card card--pad">
      <div className="section-head">
        <span className="section-title">المنشأة والتوقيع</span>
        <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}><Icon name="user" size={18} /></span>
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="company-name">اسم الشركة / المنشأة</label>
        <input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input" placeholder="اسم منشأتك كما يظهر على الفواتير" />
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="field-label">شعار الشركة</span>
        <label className="btn btn--secondary btn--block" style={{ cursor: 'pointer' }}>
          <Icon name="image" />
          {meta.company.logo ? 'تغيير الشعار' : 'رفع الشعار'}
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFile} hidden />
        </label>
        {meta.company.logo && (
          <div className="inline" style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <img src={meta.company.logo} alt="الشعار" style={{ maxHeight: 64, maxWidth: 130, borderRadius: 10, background: '#fff', padding: 4 }} />
            <button type="button" onClick={() => setShowDeleteLogoModal(true)} className="btn btn--tint-danger btn--sm">
              <Icon name="trash" size={16} />
              حذف الشعار
            </button>
          </div>
        )}
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <span className="field-label">التوقيع المعتمد</span>
        <div className="inline" style={{ flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setShowSignaturePad(true)} className="btn btn--secondary btn--sm">
            <Icon name="pencil" size={16} />
            {meta.company.signature ? 'إعادة الرسم' : 'ارسم توقيعك'}
          </button>
          <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
            <Icon name="image" size={16} />
            رفع صورة
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSignatureFile} hidden />
          </label>
        </div>
        {meta.company.signature && (
          <div className="inline" style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <img src={meta.company.signature} alt="التوقيع" style={{ maxHeight: 64, borderRadius: 10, background: '#fff', padding: 4 }} />
            <button type="button" onClick={() => setShowDeleteSignatureModal(true)} className="btn btn--tint-danger btn--sm">
              <Icon name="trash" size={16} />
              حذف التوقيع
            </button>
          </div>
        )}
      </div>
      <button type="button" onClick={saveCompany} className="btn btn--primary btn--block">
        <Icon name="check" />
        حفظ بيانات المنشأة
      </button>
    </div>
  )

  const currenciesSection = (
    <div className="card card--pad">
      <div className="section-head">
        <span className="section-title">العملات وأسعار الصرف</span>
        <span className="stat-icon g-green" style={{ width: 34, height: 34 }}><Icon name="bank" size={18} /></span>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>العملة الأساس هي الشيكل (ILS). أضف أو احذف عملات وحدّد قيمتها مقابل الشيكل.</p>
      <div className="inline" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
        {meta.currencies.map((c) => (
          <span key={c} className="chip" style={{ cursor: 'default' }}>
            {c} {currencySymbol(c)}
            {c !== 'ILS' && (
              <button type="button" onClick={() => handleRequestRemoveCurrency(c)} aria-label={`حذف عملة ${c}`} style={{ border: 0, background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <Icon name="x" size={14} />
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label className="field-label" htmlFor="new-cur">رمز عملة جديدة (مثال: EGP)</label>
        <div className="inline">
          <input id="new-cur" value={newCur} onChange={(e) => setNewCur(e.target.value)} maxLength={4} placeholder="EGP" className="input" style={{ textTransform: 'uppercase', flex: 1, minWidth: 0 }} />
          <button type="button" onClick={addCurrency} className="btn btn--secondary">
            <Icon name="plus" size={17} />
            إضافة
          </button>
        </div>
      </div>
      {meta.currencies.filter((c) => c !== 'ILS').length > 0 && (
        <div className="stack-sm" style={{ marginBottom: 14 }}>
          {meta.currencies.filter((c) => c !== 'ILS').map((c) => (
            <div className="field" key={c}>
              <label className="field-label" htmlFor={`rate-${c}`}>قيمة {c} مقابل شيكل واحد</label>
              <input id={`rate-${c}`} type="number" inputMode="decimal" step="0.01" value={rateDraft[c] ?? 1} onChange={(e) => setRateDraft((r) => ({ ...r, [c]: Number(e.target.value) }))} className="input" />
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={saveRates} className="btn btn--primary btn--block">
        <Icon name="check" />
        حفظ أسعار الصرف
      </button>
    </div>
  )

  const dataSection = (
    <div className="card card--pad">
      <div className="section-head">
        <span className="section-title">النسخ الاحتياطي والاستعادة</span>
        <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}><Icon name="download" size={18} /></span>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>
        صدّر جميع فواتيرك وبياناتك كملف JSON، أو استعد نسخة محفوظة سابقًا.
        {meta.lastBackupAt ? ` آخر نسخة: ${formatDate(meta.lastBackupAt)}` : ' لم تُنشأ أي نسخة بعد.'}
      </p>
      <div className="stack-sm" style={{ marginBottom: 14 }}>
        <button type="button" onClick={() => setShowExportModal(true)} className="btn btn--primary btn--block">
          <Icon name="download" />
          تصدير نسخة احتياطية
        </button>
        <label className="btn btn--secondary btn--block" style={{ cursor: 'pointer' }}>
          <Icon name="upload" />
          استيراد نسخة
          <input ref={importRef} type="file" accept="application/json,.json" onChange={onImportFileSelected} hidden />
        </label>
        <button type="button" onClick={handleExportCsv} className="btn btn--secondary btn--block">
          <Icon name="chart" />
          تصدير Excel/CSV
        </button>
      </div>
      <label className="field-label" style={{ marginBottom: 6 }}>نسخة احتياطية تلقائية</label>
      <Select
        value={meta.autoBackup}
        ariaLabel="النسخ التلقائي"
        onChange={(v) => updateMeta('autoBackup', v as Meta['autoBackup']).catch(() => {})}
        options={[
          { value: 'weekly', label: 'أسبوعية (موصى بها)' },
          { value: 'monthly', label: 'شهرية' },
          { value: 'off', label: 'إيقاف' },
        ]}
      />
    </div>
  )

  const trashSection = (
    <div className="card card--pad">
      <div className="section-head">
        <span className="section-title">سلة المحذوفات ({trash.length})</span>
        {trash.length > 0 && (
          <button type="button" onClick={() => setShowEmptyTrashModal(true)} className="btn btn--tint-danger btn--sm">
            <Icon name="trash" size={16} />
            إفراغ الكل
          </button>
        )}
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>الفواتير المحذوفة تُحفظ هنا 30 يوماً قبل حذفها نهائياً تلقائياً.</p>
      {trash.length === 0 ? (
        <div className="empty" style={{ padding: '18px 12px' }}>
          <span className="empty-icon" style={{ width: 50, height: 50 }}><Icon name="trash" size={24} /></span>
          <div className="empty-text">السلة فارغة</div>
        </div>
      ) : (
        <div className="list" style={{ margin: '0 -4px' }}>
          {trash.map((r) => (
            <div key={r.id} className="row" style={{ paddingInline: 4, alignItems: 'flex-start' }}>
              <span className="stat-icon g-red" style={{ marginTop: 2 }}><Icon name="receipt" size={19} /></span>
              <span className="row-main">
                <span className="row-title truncate" style={{ display: 'block' }}>#{String(r.invoice.id).padStart(4, '0')} — {r.invoice.party}</span>
                <span className="row-sub" style={{ display: 'block' }}>{r.invoice.total.toLocaleString('en-US')} {currencySymbol(r.invoice.currency)} · متبقٍ {daysLeft(r.deletedAt)} يوم</span>
                <span className="inline" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => handleRestore(r.id)} className="btn btn--sm" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                    <Icon name="refresh" size={15} />
                    استعادة
                  </button>
                  <button type="button" onClick={() => setPendingForeverDelete(r.id)} className="btn btn--tint-danger btn--sm">
                    <Icon name="trash" size={15} />
                    حذف نهائي
                  </button>
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const securitySection = (
    <div className="stack">
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">القفل التلقائي</span>
          <span className="stat-icon g-red" style={{ width: 34, height: 34 }}><Icon name="shield" size={18} /></span>
        </div>
        <label className="field-label" style={{ marginBottom: 6 }}>قفل تلقائي بعد خمول</label>
        <Select
          value={String(meta.autoLockMinutes)}
          ariaLabel="القفل التلقائي"
          onChange={(v) => updateMeta('autoLockMinutes', Number(v)).catch(() => {})}
          options={[
            { value: '0', label: 'إيقاف القفل التلقائي' },
            { value: '2', label: 'بعد دقيقتين' },
            { value: '5', label: 'بعد 5 دقائق' },
            { value: '10', label: 'بعد 10 دقائق' },
            { value: '15', label: 'بعد 15 دقيقة' },
          ]}
        />
        <p className="hint" style={{ marginTop: 10 }}>بعد 5 محاولات PIN خاطئة يُقفل الدخول مؤقتاً بمدة تصاعدية.</p>
      </div>
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">رمز الدخول والجلسة</span>
          <span className="stat-icon g-red" style={{ width: 34, height: 34 }}><Icon name="key" size={18} /></span>
        </div>
        <div className="stack-sm">
          <button type="button" onClick={() => setShowResetPinModal(true)} className="btn btn--tint-danger btn--block">
            <Icon name="key" />
            إعادة تعيين رمز الدخول
          </button>
          <button type="button" onClick={() => setShowLockModal(true)} className="btn btn--secondary btn--block">
            <Icon name="lock" />
            تسجيل الخروج (قفل التطبيق)
          </button>
        </div>
      </div>
    </div>
  )

  const installSection = (
    <div className="card card--pad">
      <div className="section-head">
        <span className="section-title">تثبيت التطبيق</span>
        <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}><Icon name="phone" size={18} /></span>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>
        ثبّت التطبيق كأيقونة على شاشتك الرئيسية للوصول السريع والعمل دون إنترنت.
      </p>
      <div className="inline" style={{ marginBottom: 12, fontWeight: 700, fontSize: 12.5 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: installed ? 'var(--success)' : 'var(--warning)', boxShadow: `0 0 8px ${installed ? 'var(--success)' : 'var(--warning)'}` }} />
        <span style={{ color: installed ? 'var(--success)' : 'var(--warning)' }}>{installed ? 'التطبيق مثبّت' : 'غير مثبّت بعد — يعمل من المتصفح'}</span>
      </div>
      {!installed && (
        <>
          <button type="button" onClick={handleInstallClick} disabled={installBusy} className="btn btn--primary btn--block">
            <Icon name="download" />
            {installBusy ? 'جارٍ...' : isIOS ? 'طريقة التثبيت على iPhone' : 'تثبيت التطبيق الآن'}
          </button>
          {showInstallHelp && (
            <div className="modal-note" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'stretch', gap: 6, lineHeight: 1.9 }}>
              {isIOS ? (
                <>
                  <b>التثبيت على iPhone:</b>
                  <span className="hint">1) اضغط زر المشاركة في سفاري (مربع بسهم للأعلى).</span>
                  <span className="hint">2) اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</span>
                </>
              ) : (
                <>
                  <b>التثبيت من متصفح الهاتف:</b>
                  <span className="hint">• افتح التطبيق من Chrome على الهاتف (وليس من داخل تطبيقات التواصل).</span>
                  <span className="hint">• من قائمة النقاط ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</span>
                  {!canNativePrompt && <span className="hint">• زر التثبيت التلقائي يظهر بعد زيارة الصفحة من Chrome.</span>}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )

  const aboutSection = (
    <div className="stack">
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">حول البرنامج</span>
          <span className="stat-icon g-violet" style={{ width: 34, height: 34 }}><Icon name="info" size={18} /></span>
        </div>
        <div className="row-between" style={{ padding: '8px 0' }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>التطبيق</span>
          <span style={{ fontWeight: 750 }}>فواتيري</span>
        </div>
        <div className="row-between" style={{ padding: '8px 0', borderTop: '1px solid var(--separator)' }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>الإصدار</span>
          <span style={{ fontWeight: 750, direction: 'ltr' }}>{APP_VERSION}</span>
        </div>
        <div className="row-between" style={{ padding: '8px 0', borderTop: '1px solid var(--separator)' }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>عدد الفواتير</span>
          <span className="amount" style={{ fontWeight: 750 }}>{invoices.length.toLocaleString('en-US')}</span>
        </div>
        <div className="row-between" style={{ padding: '8px 0', borderTop: '1px solid var(--separator)' }}>
          <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>الفواتير في السلة</span>
          <span className="amount" style={{ fontWeight: 750 }}>{trash.length.toLocaleString('en-US')}</span>
        </div>
      </div>
      <div className="card card--pad">
        <div className="inline" style={{ alignItems: 'flex-start', gap: 10 }}>
          <span className="stat-icon g-green" style={{ width: 34, height: 34 }}><Icon name="shield" size={18} /></span>
          <p className="hint" style={{ margin: 0 }}>
            خصوصيتك أولًا: بياناتك (الفواتير والتوقيع والشعار) محفوظة محليًا على جهازك في IndexedDB ولا تغادر هاتفك، ومحمية برمز PIN.
          </p>
        </div>
      </div>
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">المطوّر وحقوق الملكية</span>
          <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}><Icon name="code" size={18} /></span>
        </div>
        <p className="hint" style={{ margin: '0 0 12px' }}>
          تصميم وتطوير: م. محمد الجوجو — للتواصل والدعم أو لطلب برنامج مشابه.
        </p>
        <button type="button" className="btn btn--secondary btn--block" onClick={() => goTo('developer')}>
          <Icon name="user" />
          حول المطوّر
          <Icon name="arrowLeft" />
        </button>
      </div>
    </div>
  )

  function renderSection(id: SectionId) {
    switch (id) {
      case 'appearance': return appearanceSection
      case 'company': return companySection
      case 'invoice':
        return <InvoiceDesignPanel meta={meta} updateMeta={updateMeta} toast={toast} />
      case 'currencies': return currenciesSection
      case 'data': return dataSection
      case 'trash': return trashSection
      case 'security': return securitySection
      case 'install': return installSection
      case 'about': return aboutSection
      case 'developer': return <DeveloperProfile />
    }
  }

  const searchBox = (
    <div className="search settings-search">
      <Icon name="search" size={18} />
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في الإعدادات…" aria-label="بحث في الإعدادات" />
    </div>
  )

  function sectionList(items: SectionDef[], current: SectionId | null, onPick: (id: SectionId) => void) {
    return (
      <div className="card card--flush">
        <div className="settings-list">
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              className="settings-item"
              data-active={current === s.id}
              onClick={() => onPick(s.id)}
              aria-current={current === s.id ? 'true' : undefined}
            >
              <span className={`stat-icon ${s.tone}`}><Icon name={s.icon} /></span>
              <span className="si-main">
                <span className="si-title" style={{ display: 'block' }}>{s.title}</span>
                <span className="si-sub" style={{ display: 'block' }}>{s.sub}</span>
              </span>
              {s.id === 'trash' && trash.length > 0 && <span className="si-badge">{trash.length > 99 ? '99+' : trash.length}</span>}
              <Icon name="chevronLeft" size={17} className="si-chevron" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  const hero = (
    <div className="settings-hero">
      <h2>الإعدادات</h2>
      <p>خصّص فواتيرك ومظهر التطبيق، وأدر عملاتك وبياناتك بأمان.</p>
    </div>
  )

  const modals = (
    <>
      <DeleteConfirmModal
        isOpen={!!pendingDeleteCurrency}
        title="حذف العملة"
        itemName={pendingDeleteCurrency ? `عملة (${pendingDeleteCurrency})` : undefined}
        itemMeta="سيتم إزالتها من قائمة العملات وأسعار الصرف"
        message="هل أنت متأكد من حذف هذه العملة من القائمة؟"
        confirmLabel="نعم، احذف العملة"
        cancelLabel="إلغاء"
        onConfirm={confirmRemoveCurrency}
        onCancel={() => setPendingDeleteCurrency(null)}
      />
      <ConfirmModal
        isOpen={showResetPinModal}
        variant="danger"
        icon={<Icon name="key" />}
        title="إعادة تعيين رمز الدخول PIN"
        message="سيتم مسح رمز الدخول القديم فوراً، مع الحفاظ التام على فواتيرك وبياناتك. ستتم مطالبتك بتعيين رمز PIN جديد عند الدخول القادم. هل تريد المتابعة؟"
        confirmLabel="نعم، إعادة التعيين"
        cancelLabel="تراجع"
        onConfirm={confirmResetPin}
        onCancel={() => setShowResetPinModal(false)}
      />
      <ConfirmModal
        isOpen={showExportModal}
        variant="info"
        icon={<Icon name="download" />}
        title="تصدير نسخة احتياطية"
        message={`سيتم تنزيل ملف JSON آمن يحتوي على كافة فواتيرك (${invoices.length} فاتورة) وإعدادات الشركة وأسعار الصرف للاحتفاظ بها. هل تريد بدء التنزيل؟`}
        confirmLabel="تنزيل الملف الآن"
        cancelLabel="إلغاء"
        onConfirm={handleConfirmExportBackup}
        onCancel={() => setShowExportModal(false)}
      />
      <ConfirmModal
        isOpen={!!pendingImportData}
        variant="warning"
        icon={<Icon name="upload" />}
        title="استبدال البيانات الحالية"
        message={`تحذير مهم: سيؤدي استيراد هذا الملف إلى استبدال كافة الفواتير الحالية بالبيانات الموجودة في النسخة المستوردة (${pendingImportData?.invoices?.length ?? 0} فاتورة).\n\nهل أنت متأكد من رغبتك في المتابعة؟`}
        confirmLabel="نعم، استبدل البيانات"
        cancelLabel="إلغاء وتراجع"
        onConfirm={confirmImportBackup}
        onCancel={() => setPendingImportData(null)}
      />
      <ConfirmModal
        isOpen={showLockModal}
        variant="warning"
        icon={<Icon name="lock" />}
        title="تسجيل الخروج"
        message="هل أنت متأكد من قفل التطبيق وتسجيل الخروج؟ ستحتاج لإدخال رمز الدخول PIN للوصول إلى النظام مجدداً."
        confirmLabel="قفل التطبيق الآن"
        cancelLabel="البقاء مسجلاً"
        onConfirm={() => { setShowLockModal(false); onLocked() }}
        onCancel={() => setShowLockModal(false)}
      />
      <DeleteConfirmModal
        isOpen={showDeleteSignatureModal}
        title="حذف صورة التوقيع"
        itemName="صورة توقيع الشركة"
        itemMeta="ستُزال من جميع الفواتير المطبوعة مستقبلاً"
        message="هل أنت متأكد من حذف صورة التوقيع الحالية؟"
        confirmLabel="نعم، احذف التوقيع"
        cancelLabel="إلغاء"
        onConfirm={confirmDeleteSignature}
        onCancel={() => setShowDeleteSignatureModal(false)}
      />
      <SignaturePad
        isOpen={showSignaturePad}
        initialSignature={meta.company.signature}
        onSave={handleSaveHandSignature}
        onClose={() => setShowSignaturePad(false)}
      />
      <DeleteConfirmModal
        isOpen={showDeleteLogoModal}
        title="حذف شعار الشركة"
        itemName="شعار الشركة الحالي"
        itemMeta="سيُزال من جميع الفواتير المطبوعة مستقبلاً"
        message="هل أنت متأكد من حذف الشعار؟"
        confirmLabel="نعم، احذف الشعار"
        cancelLabel="إلغاء"
        onConfirm={confirmDeleteLogo}
        onCancel={() => setShowDeleteLogoModal(false)}
      />
      <DeleteConfirmModal
        isOpen={pendingForeverDelete != null}
        title="حذف نهائي بلا رجعة"
        itemName={pendingForeverDelete != null ? `فاتورة #${String(pendingForeverDelete).padStart(4, '0')}` : undefined}
        itemMeta="ستُحذف من سلة المحذوفات نهائياً ولا يمكن استعادتها"
        message="هل أنت متأكد من الحذف النهائي لهذه الفاتورة؟"
        confirmLabel="نعم، احذف نهائياً"
        cancelLabel="تراجع"
        onConfirm={confirmForeverDelete}
        onCancel={() => setPendingForeverDelete(null)}
      />
      <ConfirmModal
        isOpen={showEmptyTrashModal}
        variant="danger"
        icon={<Icon name="trash" />}
        title={`إفراغ سلة المحذوفات (${trash.length})`}
        message="سيتم حذف جميع الفواتير في السلة نهائياً وبلا رجعة. هل تريد المتابعة؟"
        confirmLabel="نعم، إفراغ السلة"
        cancelLabel="تراجع"
        onConfirm={confirmEmptyTrash}
        onCancel={() => setShowEmptyTrashModal(false)}
      />
      <ConfirmModal
        isOpen={!!leaveTarget}
        variant="warning"
        icon={<Icon name="alert" />}
        title="تعديلات غير محفوظة"
        message="لديك تعديلات لم تُحفظ في هذا القسم. إذا غادرت الآن ستفقد هذه التغييرات. هل تريد المغادرة دون حفظ؟"
        confirmLabel="مغادرة دون حفظ"
        cancelLabel="البقاء هنا"
        onConfirm={confirmLeave}
        onCancel={() => setLeaveTarget(null)}
      />
    </>
  )

  // ─── Versions: سطح المكتب (قائمة جانبية + محتوى) ────────────────────────────
  if (isWide) {
    const current = active ?? SECTIONS[0].id
    return (
      <div className="settings-layout">
        <aside className="settings-nav stack">
          {hero}
          {searchBox}
          {filtered.length === 0 ? (
            <div className="card card--pad"><p className="hint">لا نتائج مطابقة.</p></div>
          ) : (
            sectionList(filtered, current, (id) => goTo(id))
          )}
        </aside>
        <div className="stack-lg" key={current}>
          <div>
            <h2 className="t-title" style={{ margin: 0 }}>{SECTIONS.find((s) => s.id === current)?.title}</h2>
            <p className="section-meta">{SECTIONS.find((s) => s.id === current)?.sub}</p>
          </div>
          {renderSection(current)}
        </div>
        {modals}
      </div>
    )
  }

  // ─── الهاتف: قائمة أقسام → صفحة فرعية ───────────────────────────────────────
  if (active) {
    const def = SECTIONS.find((s) => s.id === active)
    return (
      <div className="stack-lg">
        <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start', paddingInline: 6, marginInlineStart: -6 }} onClick={() => goTo(null)}>
          <Icon name="chevronRight" size={17} />
          الإعدادات
        </button>
        <div>
          <h2 className="t-title" style={{ margin: 0 }}>{def?.title}</h2>
          <p className="section-meta">{def?.sub}</p>
        </div>
        {renderSection(active)}
        {modals}
      </div>
    )
  }

  return (
    <div className="stack-lg">
      {hero}
      {searchBox}
      {filtered.length === 0 ? (
        <div className="card card--pad"><p className="hint">لا نتائج مطابقة لبحثك.</p></div>
      ) : (
        GROUPS.map((g) => {
          const items = filtered.filter((s) => s.group === g)
          if (items.length === 0) return null
          return (
            <div key={g}>
              <div className="settings-group-label">{g}</div>
              {sectionList(items, null, (id) => goTo(id))}
            </div>
          )
        })
      )}
      {modals}
    </div>
  )
}
