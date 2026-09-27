import { useRef, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import { DEFAULT_META, currencySymbol } from '../lib/types'
import type { Meta } from '../lib/types'
import { TRASH_RETENTION_MS } from '../lib/db'
import { downloadJsonBackup, downloadInvoicesCsv } from '../lib/backup'
import Select from '../components/Select'
import ConfirmModal from '../components/ConfirmModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import SignaturePad from '../components/SignaturePad'
import { usePWAInstall } from '../lib/usePWAInstall'

export default function Settings({ onLocked }: { onLocked: () => void }) {
  const { meta, invoices, trash, updateMeta, importAll, restoreInvoice, deleteForever, emptyTrash } = useAppData()
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState(meta.company.name)
  const [defaultTerms, setDefaultTerms] = useState(meta.defaultTerms ?? '')
  const [newCur, setNewCur] = useState('')
  const [rateDraft, setRateDraft] = useState<Record<string, number>>({ ...meta.rates })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

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

  async function handleInstallClick() {
    setInstallBusy(true)
    try {
      const res = await install()
      if (res === true) return
      // لا يوجد prompt أصلي (iOS أو متصفح غير داعم) → تعليمات يدوية
      setShowInstallHelp(true)
    } finally {
      setInstallBusy(false)
    }
  }

  async function saveCompanyName() {
    await updateMeta('company', { ...meta.company, name: companyName })
    await updateMeta('defaultTerms', defaultTerms.trim())
    toast('تم حفظ بيانات الشركة')
  }

  async function handleSignatureFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      await updateMeta('company', { ...meta.company, signature: reader.result as string })
      toast('تم رفع صورة التوقيع')
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
      toast('تم رفع شعار الشركة')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function confirmDeleteLogo() {
    await updateMeta('company', { ...meta.company, logo: undefined })
    toast('تم حذف شعار الشركة', 'danger')
    setShowDeleteLogoModal(false)
  }

  async function saveRates() {
    await updateMeta('rates', { ...meta.rates, ...rateDraft })
    toast('تم حفظ أسعار الصرف')
  }

  async function addCurrency() {
    const code = newCur.trim().toUpperCase()
    if (!/^[A-Z]{2,4}$/.test(code)) return toast('يرجى إدخال رمز عملة صحيح (٢-٤ أحرف)', 'danger')
    if (meta.currencies.includes(code)) return toast('هذه العملة مضافة مسبقًا', 'danger')
    await updateMeta('currencies', [...meta.currencies, code])
    await updateMeta('rates', { ...meta.rates, [code]: 1 })
    setRateDraft((r) => ({ ...r, [code]: 1 }))
    setNewCur('')
    toast('تمت إضافة عملة ' + code)
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
    toast('تم حذف عملة ' + code, 'danger')
    setPendingDeleteCurrency(null)
  }

  async function confirmDeleteSignature() {
    await updateMeta('company', { ...meta.company, signature: undefined })
    toast('تم حذف صورة التوقيع', 'danger')
    setShowDeleteSignatureModal(false)
  }

  async function handleSaveHandSignature(dataUrl: string) {
    await updateMeta('company', { ...meta.company, signature: dataUrl })
    setShowSignaturePad(false)
    toast('تم حفظ التوقيع بخط اليد')
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
    toast('تم الحذف النهائي', 'danger')
    setPendingForeverDelete(null)
  }

  async function confirmEmptyTrash() {
    await emptyTrash()
    toast('تم إفراغ سلة المحذوفات', 'danger')
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
    // reset file input so the same file can be picked again if desired
    e.target.value = ''
  }

  async function confirmImportBackup() {
    if (!pendingImportData) return
    await importAll(pendingImportData)
    toast('تم استيراد النسخة الاحتياطية بنجاح')
    setPendingImportData(null)
  }

  return (
    <div className="space-y-4">
      {/* Theme */}
      <div className="card p-4">
        <h3 className="mb-3 font-bold">🎨 المظهر</h3>
        <div className="flex gap-2.5">
          {([
            { id: 'gold', name: 'ذهبي 🌙', bg: 'linear-gradient(135deg,#ffb020,#ff7a3d)' },
            { id: 'blue', name: 'أزرق ليلي 🌙', bg: 'linear-gradient(135deg,#2e8bff,#8b5cf6)' },
            { id: 'light', name: 'فاتح ☀️', bg: 'linear-gradient(135deg,#ffffff,#94a3b8)' },
          ] as const).map((t) => (
            <div
              key={t.id}
              onClick={() => updateMeta('theme', t.id).then(() => toast('تم تغيير المظهر'))}
              className={`flex-1 cursor-pointer rounded-2xl border-2 p-3.5 text-center text-sm font-bold ${
                meta.theme === t.id ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              <div
                className="mb-1.5 h-7 w-full rounded-lg border border-black/10"
                style={{ background: t.bg }}
              />
              {t.name}
            </div>
          ))}
        </div>
      </div>

      {/* Company Info */}
      <div className="card p-4">
        <h3 className="mb-3 font-bold">🏢 الشركة والتوقيع</h3>
        <label className="mb-1 block text-xs text-[var(--muted)]">اسم الشركة</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2"
        />
        <label className="mb-1 block text-xs text-[var(--muted)]">الشروط والأحكام الافتراضية (تُطبع تلقائياً في كل فاتورة)</label>
        <textarea
          value={defaultTerms}
          onChange={(e) => setDefaultTerms(e.target.value)}
          placeholder="مثال: الدفع خلال 14 يوم من تاريخ الفاتورة. البضاعة المباعة لا ترد ولا تستبدل."
          rows={2}
          className="mb-3 w-full resize-none rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm"
        />
        <label className="mb-1 block text-xs text-[var(--muted)]">شعار الشركة (يظهر في الفواتير المطبوعة)</label>
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="btn-brand cursor-pointer rounded-xl px-4 py-2 text-sm font-bold">
            🖼️ {meta.company.logo ? 'تغيير الشعار' : 'رفع الشعار'}
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
          </label>
        </div>
        {meta.company.logo && (
          <div className="mb-3">
            <p className="mb-1 text-xs text-[var(--muted)]">الشعار الحالي:</p>
            <div className="flex items-center gap-3">
              <img src={meta.company.logo} className="max-h-16 max-w-32 rounded-lg bg-white p-1" alt="الشعار" />
              <button
                onClick={() => setShowDeleteLogoModal(true)}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-[var(--danger)] hover:bg-red-500/20 transition-colors"
                title="حذف الشعار"
              >
                🗑️ حذف الشعار
              </button>
            </div>
          </div>
        )}
        <label className="mb-1 block text-xs text-[var(--muted)]">التوقيع المعتمد</label>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowSignaturePad(true)}
            className="btn-brand rounded-xl px-4 py-2 text-sm font-bold"
          >
            ✍️ {meta.company.signature ? 'إعادة الرسم بخط اليد' : 'ارسم توقيعك بخط اليد'}
          </button>
          <label className="cursor-pointer rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-white/5 transition-colors">
            📁 رفع صورة
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSignatureFile} className="hidden" />
          </label>
        </div>
        {meta.company.signature && (
          <div className="mb-3">
            <p className="mb-1 text-xs text-[var(--muted)]">التوقيع الحالي:</p>
            <div className="flex items-center gap-3">
              <img src={meta.company.signature} className="max-h-16 rounded-lg bg-white p-1" alt="التوقيع" />
              <button
                onClick={() => setShowDeleteSignatureModal(true)}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-[var(--danger)] hover:bg-red-500/20 transition-colors"
                title="حذف صورة التوقيع"
              >
                🗑️ حذف التوقيع
              </button>
            </div>
          </div>
        )}
        <button onClick={saveCompanyName} className="btn-brand mt-1 rounded-xl px-5 py-2.5 font-bold">
          حفظ بيانات الشركة
        </button>
      </div>

      {/* Print template */}
      <div className="card p-4">
        <h3 className="mb-1 font-bold">🖨️ قالب الطباعة</h3>
        <p className="mb-3 text-xs text-[var(--muted)]">يُطبق على تصدير PDF/PNG والطباعة المباشرة.</p>
        <div className="flex gap-2.5">
          {([
            { id: 'modern', name: 'حديث', desc: 'ملوّن متدرج', bg: 'linear-gradient(135deg,#b37800,#ffb020)' },
            { id: 'classic', name: 'كلاسيكي', desc: 'رسمي أبيض', bg: 'linear-gradient(180deg,#ffffff,#9ca3af)' },
          ] as const).map((t) => (
            <div
              key={t.id}
              onClick={() => updateMeta('printTemplate', t.id).then(() => toast('تم تغيير قالب الطباعة'))}
              className={`flex-1 cursor-pointer rounded-2xl border-2 p-3.5 text-center text-sm font-bold ${
                meta.printTemplate === t.id ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-[var(--border)] text-[var(--muted)]'
              }`}
            >
              <div className="mb-1.5 flex h-12 w-full items-center justify-center rounded-lg border border-black/10 bg-white" style={{ background: t.bg }}>
                <span style={{ fontSize: 20 }}>🧾</span>
              </div>
              <div>{t.name}</div>
              <div className="text-[11px] font-normal text-[var(--muted)]">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Currencies & Rates */}
      <div className="card p-4">
        <h3 className="mb-2 font-bold">💱 العملات وأسعار الصرف</h3>
        <p className="mb-2 text-xs text-[var(--muted)]">العملة الأساس هي الشيكل (ILS). أضف أو احذف عملات أخرى وحدد قيمتها مقابل الشيكل.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {meta.currencies.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/5 px-3 py-1.5 text-sm">
              {c}
              {c !== 'ILS' && (
                <button
                  onClick={() => handleRequestRemoveCurrency(c)}
                  className="text-[var(--danger)] hover:opacity-80 transition-opacity font-bold"
                  title={`حذف عملة ${c}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        <div className="mb-3 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-[var(--muted)]">رمز عملة جديدة (مثال: EGP)</label>
            <input
              value={newCur}
              onChange={(e) => setNewCur(e.target.value)}
              maxLength={4}
              placeholder="EGP"
              className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 uppercase"
            />
          </div>
          <button onClick={addCurrency} className="rounded-xl border border-[var(--border)] px-4 py-2 font-semibold">
            إضافة
          </button>
        </div>
        {meta.currencies
          .filter((c) => c !== 'ILS')
          .map((c) => (
            <div key={c} className="mb-2">
              <label className="mb-1 block text-xs text-[var(--muted)]">قيمة {c} مقابل شيكل واحد</label>
              <input
                type="number"
                step="0.01"
                value={rateDraft[c] ?? 1}
                onChange={(e) => setRateDraft((r) => ({ ...r, [c]: Number(e.target.value) }))}
                className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2"
              />
            </div>
          ))}
        <button onClick={saveRates} className="btn-brand mt-1 rounded-xl px-5 py-2.5 font-bold">
          حفظ أسعار الصرف
        </button>
      </div>

      {/* Backup & Restore */}
      <div className="card p-4">
        <h3 className="mb-2 font-bold">💾 النسخ الاحتياطي والاستعادة</h3>
        <p className="mb-3 text-xs text-[var(--muted)]">
          صدّر جميع فواتيرك وبياناتك كملف JSON، أو استعد نسخة محفوظة سابقًا.
          {meta.lastBackupAt
            ? ` آخر نسخة: ${new Date(meta.lastBackupAt).toLocaleDateString('en-US')}`
            : ' لم تُنشأ أي نسخة بعد.'}
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setShowExportModal(true)} className="btn-brand rounded-xl px-4 py-2 font-bold">
            ⬇️ تصدير نسخة احتياطية
          </button>
          <label className="cursor-pointer rounded-xl border border-[var(--border)] px-4 py-2 font-semibold hover:bg-white/5 transition-colors">
            📥 استيراد نسخة
            <input ref={importRef} type="file" accept="application/json,.json" onChange={onImportFileSelected} className="hidden" />
          </label>
          <button
            onClick={handleExportCsv}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          >
            📊 تصدير Excel/CSV
          </button>
        </div>
        <label className="mb-1 block text-xs text-[var(--muted)]">نسخة احتياطية تلقائية (تنزيل عند فتح التطبيق عند استحقاقها)</label>
        <Select
          value={meta.autoBackup}
          ariaLabel="النسخ التلقائي"
          onChange={(v) => updateMeta('autoBackup', v as Meta['autoBackup']).then(() => toast('تم حفظ إعداد النسخ التلقائي'))}
          options={[
            { value: 'weekly', label: 'أسبوعية (موصى بها) 💾' },
            { value: 'monthly', label: 'شهرية 🗓️' },
            { value: 'off', label: 'إيقاف ⛔' },
          ]}
        />
      </div>

      {/* Trash */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">🗑️ سلة المحذوفات ({trash.length})</h3>
          {trash.length > 0 && (
            <button
              onClick={() => setShowEmptyTrashModal(true)}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-[var(--danger)] hover:bg-red-500/20 transition-colors"
            >
              إفراغ الكل
            </button>
          )}
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">الفواتير المحذوفة تُحفظ هنا 30 يوماً قبل حذفها نهائياً تلقائياً.</p>
        {trash.length === 0 ? (
          <p className="py-2 text-center text-sm text-[var(--muted)]">السلة فارغة ✨</p>
        ) : (
          <div className="space-y-2">
            {trash.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-black/10 p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">
                    #{String(r.invoice.id).padStart(4, '0')} — {r.invoice.party}
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {r.invoice.total.toLocaleString('en-US')} {currencySymbol(r.invoice.currency)} · متبقٍ {daysLeft(r.deletedAt)} يوم
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => handleRestore(r.id)}
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    ↩️ استعادة
                  </button>
                  <button
                    onClick={() => setPendingForeverDelete(r.id)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-[var(--danger)] hover:bg-red-500/20 transition-colors"
                  >
                    حذف نهائي
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install App */}
      <div className="card p-4">
        <h3 className="mb-2 font-bold">📲 تثبيت التطبيق على الهاتف</h3>
        <p className="mb-1 text-xs text-[var(--muted)]" style={{ lineHeight: 1.8 }}>
          ثبّت التطبيق كأيقونة على شاشتك الرئيسية للوصول السريع والعمل دون إنترنت.
          🔒 بياناتك (الفواتير + التوقيع) محفوظة محلياً على جهازك في IndexedDB ولا تغادر هاتفك، ومحمية برمز PIN.
        </p>
        <div className="mb-3 flex items-center gap-2 text-xs font-bold">
          <span style={{
            display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
            background: installed ? '#22c9a3' : '#ffb020',
            boxShadow: installed ? '0 0 8px #22c9a3' : '0 0 8px #ffb020',
          }} />
          <span className={installed ? 'text-emerald-400' : 'text-amber-400'}>
            {installed ? 'التطبيق مثبّت ✅' : 'غير مثبّت بعد — يعمل من المتصفح'}
          </span>
        </div>
        {!installed && (
          <>
            <button
              onClick={handleInstallClick}
              disabled={installBusy}
              className="btn-brand rounded-xl px-4 py-2 font-bold"
            >
              {installBusy ? 'جارٍ...' : isIOS ? '📲 طريقة التثبيت على iPhone' : '⬇️ تثبيت التطبيق الآن'}
            </button>
            {showInstallHelp && (
              <div className="mt-3 rounded-xl border border-[var(--border)] bg-black/20 p-3 text-xs" style={{ lineHeight: 2 }}>
                {isIOS ? (
                  <>
                    <div className="mb-1 font-bold">📲 التثبيت على iPhone:</div>
                    <div>1️⃣ اضغط زر المشاركة في سفاري (مربع بسهم للأعلى)</div>
                    <div>2️⃣ اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة»</div>
                  </>
                ) : (
                  <>
                    <div className="mb-1 font-bold">📲 التثبيت من متصفح الهاتف:</div>
                    <div>• افتح التطبيق من <b>Chrome على الهاتف</b> (وليس من داخل تطبيقات التواصل).</div>
                    <div>• من قائمة النقاط ⋮ اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.</div>
                    {!canNativePrompt && <div className="text-[var(--muted)]">• زر التثبيت التلقائي يظهر بعد زيارة الصفحة من Chrome.</div>}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Security & Logout */}
      <div className="card p-4">
        <h3 className="mb-3 font-bold">🔒 الأمان وتسجيل الخروج</h3>
        <label className="mb-1 block text-xs text-[var(--muted)]">قفل تلقائي بعد خمول</label>
        <Select
          value={String(meta.autoLockMinutes)}
          ariaLabel="القفل التلقائي"
          onChange={(v) => updateMeta('autoLockMinutes', Number(v)).then(() => toast('تم حفظ إعداد القفل التلقائي'))}
          options={[
            { value: '0', label: 'إيقاف القفل التلقائي ⛔' },
            { value: '2', label: 'بعد دقيقتين ⏱️' },
            { value: '5', label: 'بعد 5 دقائق 🔒' },
            { value: '10', label: 'بعد 10 دقائق 🔒' },
            { value: '15', label: 'بعد 15 دقيقة 🔒' },
          ]}
        />
        <div className="h-3" />
        <p className="mb-3 text-xs text-[var(--muted)]">🛡️ الحماية من التخمين: بعد 5 محاولات PIN خاطئة يُقفل الدخول مؤقتاً بمدة تصاعدية.</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowResetPinModal(true)}
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 font-bold text-red-400 hover:bg-red-500/20 transition-colors"
          >
            🔑 إعادة تعيين رمز الدخول
          </button>
          <button
            onClick={() => setShowLockModal(true)}
            className="rounded-xl border border-[var(--border)] bg-white/5 px-4 py-2.5 font-bold text-[var(--text)] hover:bg-white/10 transition-colors"
          >
            🚪 تسجيل الخروج (قفل التطبيق)
          </button>
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* 1. Delete Currency Modal — مخصص للحذف */}
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

      {/* 2. Reset PIN Modal */}
      <ConfirmModal
        isOpen={showResetPinModal}
        variant="danger"
        icon="🔑"
        title="إعادة تعيين رمز الدخول PIN"
        message="سيتم مسح رمز الدخول القديم فوراً، مع الحفاظ التام على فواتيرك وبياناتك. ستتم مطالبتك بتعيين رمز PIN جديد عند الدخول القادم. هل تريد المتابعة؟"
        confirmLabel="نعم، إعادة التعيين"
        cancelLabel="تراجع"
        onConfirm={confirmResetPin}
        onCancel={() => setShowResetPinModal(false)}
      />

      {/* 3. Export Backup Modal */}
      <ConfirmModal
        isOpen={showExportModal}
        variant="info"
        icon="💾"
        title="تصدير نسخة احتياطية"
        message={`سيتم تنزيل ملف JSON آمن يحتوي على كافة فواتيرك (${invoices.length} فاتورة) وإعدادات الشركة وأسعار الصرف للاحتفاظ بها. هل تريد بدء التنزيل؟`}
        confirmLabel="تنزيل الملف الآن"
        cancelLabel="إلغاء"
        onConfirm={handleConfirmExportBackup}
        onCancel={() => setShowExportModal(false)}
      />

      {/* 4. Import Backup Modal */}
      <ConfirmModal
        isOpen={!!pendingImportData}
        variant="warning"
        icon="⚠️"
        title="استبدال البيانات الحالية"
        message={`تحذير مهم: سيؤدي استيراد هذا الملف إلى استبدال كافة الفواتير الحالية بالبيانات الموجودة في النسخة المستوردة (${pendingImportData?.invoices?.length ?? 0} فاتورة).\n\nهل أنت متأكد من رغبتك في المتابعة؟`}
        confirmLabel="نعم، استبدل البيانات"
        cancelLabel="إلغاء وتراجع"
        onConfirm={confirmImportBackup}
        onCancel={() => setPendingImportData(null)}
      />

      {/* 5. Lock / Logout Modal */}
      <ConfirmModal
        isOpen={showLockModal}
        variant="warning"
        icon="🚪"
        title="تسجيل الخروج"
        message="هل أنت متأكد من قفل التطبيق وتسجيل الخروج؟ ستحتاج لإدخال رمز الدخول PIN للوصول إلى النظام مجدداً."
        confirmLabel="قفل التطبيق الآن"
        cancelLabel="البقاء مسجلاً"
        onConfirm={() => {
          setShowLockModal(false)
          onLocked()
        }}
        onCancel={() => setShowLockModal(false)}
      />

      {/* 6. Delete Signature Modal — مخصص للحذف */}
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

      {/* 7. Hand signature pad */}
      <SignaturePad
        isOpen={showSignaturePad}
        initialSignature={meta.company.signature}
        onSave={handleSaveHandSignature}
        onClose={() => setShowSignaturePad(false)}
      />

      {/* 7b. Delete Logo Modal — مخصص للحذف */}
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

      {/* 8. Permanent delete from trash — مخصص للحذف */}
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

      {/* 9. Empty trash */}
      <ConfirmModal
        isOpen={showEmptyTrashModal}
        variant="danger"
        icon="🗑️"
        title={`إفراغ سلة المحذوفات (${trash.length})`}
        message="سيتم حذف جميع الفواتير في السلة نهائياً وبلا رجعة. هل تريد المتابعة؟"
        confirmLabel="نعم، إفراغ السلة"
        cancelLabel="تراجع"
        onConfirm={confirmEmptyTrash}
        onCancel={() => setShowEmptyTrashModal(false)}
      />
    </div>
  )
}
