import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import { currencySymbol, PAYMENT_META, PAYMENT_METHOD_META, calcTotals } from '../lib/types'
import type { DiscountType, Invoice, InvoiceItem, InvoiceType, PaymentMethod, PaymentStatus } from '../lib/types'
import { buildItemCatalog, buildParties } from '../lib/directory'
import { fileToResizedDataURL } from '../lib/image'
import { clearFormDraft, loadFormDraft, saveFormDraft } from '../lib/formDraft'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  editingInvoice: Invoice | null
  /** تعبئة مسبقة لفاتورة جديدة (من الزر العائم: آخر عميل) */
  draft?: { party: string; type: InvoiceType; currency: string } | null
  onDone: (savedId: number) => void
  onCancel: () => void
}

const emptyItem = (): InvoiceItem => ({ name: '', qty: 0, price: 0, specs: '' })

// Map currency code → flag emoji + label
const CURRENCY_META: Record<string, { flag: string; label: string }> = {
  ILS: { flag: '🇵🇸', label: 'شيكل' },
  USD: { flag: '🇺🇸', label: 'دولار' },
  JOD: { flag: '🇯🇴', label: 'دينار' },
  EUR: { flag: '🇪🇺', label: 'يورو' },
}

export default function InvoiceForm({ editingInvoice, draft, onDone, onCancel }: Props) {
  const { meta, invoices, saveInvoice, updateMeta } = useAppData()
  const { toast } = useToast()

  // مسودة مستعادة (لفاتورة جديدة فقط) — الأولوية: تعديل > مسودة الزر العائم > مسودة محفوظة
  const [storedDraft] = useState(() => (editingInvoice ? null : draft ? null : loadFormDraft()))
  const savedRef = useRef(false)
  const restoreToastShown = useRef(false)

  const [type, setType] = useState<InvoiceType>(editingInvoice?.type ?? draft?.type ?? storedDraft?.type ?? 'purchase')
  const [party, setParty] = useState(editingInvoice?.party ?? draft?.party ?? storedDraft?.party ?? '')
  const [currency, setCurrency] = useState(editingInvoice?.currency ?? draft?.currency ?? storedDraft?.currency ?? meta.currency)
  const [items, setItems] = useState<InvoiceItem[]>(
    editingInvoice?.items.length ? editingInvoice.items : storedDraft?.items?.length ? storedDraft.items : [emptyItem()],
  )
  const [payStatus, setPayStatus] = useState<PaymentStatus>(editingInvoice?.paymentStatus ?? storedDraft?.payStatus ?? 'unpaid')
  const [paidStr, setPaidStr] = useState(editingInvoice ? String(editingInvoice.paidAmount || '') : storedDraft?.paidStr ?? '')
  const [dueStr, setDueStr] = useState(
    editingInvoice?.dueDate ? new Date(editingInvoice.dueDate).toISOString().slice(0, 10) : storedDraft?.dueStr ?? '',
  )
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(editingInvoice?.payMethod ?? storedDraft?.payMethod ?? null)
  const [partyFocus, setPartyFocus] = useState(false)
  const [itemFocusIdx, setItemFocusIdx] = useState<number | null>(null)
  const [discountMode, setDiscountMode] = useState<'none' | DiscountType>(
    editingInvoice?.discountType ?? storedDraft?.discountMode ?? 'none',
  )
  const [discountStr, setDiscountStr] = useState(
    editingInvoice?.discountValue ? String(editingInvoice.discountValue) : storedDraft?.discountStr ?? '',
  )
  const [taxStr, setTaxStr] = useState(
    editingInvoice?.taxPercent ? String(editingInvoice.taxPercent) : storedDraft?.taxStr ?? '',
  )
  const [notes, setNotes] = useState(editingInvoice?.notes ?? storedDraft?.notes ?? '')
  const [attachment, setAttachment] = useState<string | undefined>(editingInvoice?.attachment ?? storedDraft?.attachment)
  const [attachmentBusy, setAttachmentBusy] = useState(false)
  const [showDeleteAttachmentModal, setShowDeleteAttachmentModal] = useState(false)
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null)
  const [showDiscardModal, setShowDiscardModal] = useState(false)

  useEffect(() => {
    if (!editingInvoice && draft) {
      setType(draft.type)
      setParty(draft.party)
      setCurrency(draft.currency)
    }
  }, [draft, editingInvoice])

  const restoredHint = !!storedDraft && (storedDraft.party.trim() !== '' || storedDraft.items.some((it) => it.name || it.qty || it.price))

  // تنبيه استعادة المسودة مرة واحدة (الحارس يمنع التكرار مع StrictMode)
  useEffect(() => {
    if (restoredHint && !restoreToastShown.current) {
      restoreToastShown.current = true
      toast('تمت استعادة مسودتك غير المحفوظة 📝')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // حفظ تلقائي للمسودة (فاتورة جديدة فقط) مع debounce
  useEffect(() => {
    if (editingInvoice || savedRef.current) return
    const t = setTimeout(() => {
      saveFormDraft({ type, party, currency, items, payStatus, paidStr, dueStr, discountMode, discountStr, taxStr, notes, payMethod, attachment })
    }, 400)
    return () => clearTimeout(t)
  }, [editingInvoice, type, party, currency, items, payStatus, paidStr, dueStr, discountMode, discountStr, taxStr, notes, payMethod, attachment])

  useEffect(() => {
    if (editingInvoice) {
      setType(editingInvoice.type)
      setParty(editingInvoice.party)
      setCurrency(editingInvoice.currency)
      setItems(editingInvoice.items.length ? editingInvoice.items : [emptyItem()])
      setPayStatus(editingInvoice.paymentStatus ?? 'unpaid')
      setPaidStr(editingInvoice.paidAmount ? String(editingInvoice.paidAmount) : '')
      setPayMethod(editingInvoice.payMethod ?? null)
      setDueStr(editingInvoice.dueDate ? new Date(editingInvoice.dueDate).toISOString().slice(0, 10) : '')
      setDiscountMode(editingInvoice.discountType ?? 'none')
      setDiscountStr(editingInvoice.discountValue ? String(editingInvoice.discountValue) : '')
      setTaxStr(editingInvoice.taxPercent ? String(editingInvoice.taxPercent) : '')
      setNotes(editingInvoice.notes ?? '')
      setAttachment(editingInvoice.attachment)
    }
  }, [editingInvoice])

  const validItems = useMemo(
    () => items.filter((it) => it.name && it.qty && it.price),
    [items],
  )

  const liveTotal = useMemo(
    () => validItems.reduce((s, it) => s + Number(it.qty) * Number(it.price), 0),
    [validItems],
  )

  const breakdown = useMemo(
    () => calcTotals(
      validItems,
      discountMode === 'none' ? null : discountMode,
      Number(discountStr) || 0,
      Number(taxStr) || 0,
    ),
    [validItems, discountMode, discountStr, taxStr],
  )

  // اقتراحات العملاء/الموردين من الفواتير السابقة (نفس النوع أولاً)
  const partySuggestions = useMemo(() => {
    const q = party.trim().toLowerCase()
    return buildParties(invoices, type)
      .filter((p) => p.name.toLowerCase() !== q && (!q || p.name.toLowerCase().includes(q)))
      .slice(0, 5)
  }, [invoices, type, party])

  const itemCatalog = useMemo(() => buildItemCatalog(invoices), [invoices])

  function itemSuggestions(idx: number) {
    const q = (items[idx]?.name || '').trim().toLowerCase()
    if (!q) return itemCatalog.slice(0, 5)
    return itemCatalog.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 5)
  }

  async function handleAttachmentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAttachmentBusy(true)
    try {
      const url = await fileToResizedDataURL(file)
      setAttachment(url)
      toast('تم إرفاق الصورة')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر إرفاق الصورة', 'danger')
    } finally {
      setAttachmentBusy(false)
    }
  }

  function confirmDeleteAttachment() {
    setAttachment(undefined)
    setShowDeleteAttachmentModal(false)
    toast('تم حذف المرفق', 'danger')
  }

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
    toast('تمت إضافة صنف جديد')
  }

  function removeItem(idx: number) {
    if (items.length <= 1) {
      toast('لا يمكن حذف الصنف الوحيد', 'danger')
      return
    }
    // فتح مودال تأكيد الحذف بدل الحذف المباشر
    setPendingRemoveIndex(idx)
  }

  function confirmRemoveItem() {
    if (pendingRemoveIndex == null) return
    setItems((prev) => prev.filter((_, i) => i !== pendingRemoveIndex))
    toast('تم حذف الصنف', 'danger')
    setPendingRemoveIndex(null)
  }

  async function handleSave() {
    const cleanItems = items.filter((it) => it.name && it.qty && it.price)
    if (!party.trim() || cleanItems.length === 0) {
      toast('يرجى إدخال الاسم وصنف واحد على الأقل', 'danger')
      return
    }
    const bt = calcTotals(
      cleanItems,
      discountMode === 'none' ? null : discountMode,
      Number(discountStr) || 0,
      Number(taxStr) || 0,
    )
    const total = bt.total
    // حساب الدفعة حسب الحالة
    let paidAmount = 0
    if (payStatus === 'paid') paidAmount = total
    else if (payStatus === 'partial') {
      paidAmount = Math.min(total, Math.max(0, Number(paidStr) || 0))
      if (paidAmount <= 0) {
        toast('أدخل المبلغ المدفوع أو اختر حالة دفع أخرى', 'danger')
        return
      }
    }
    const dueDate = dueStr ? new Date(dueStr + 'T00:00:00').getTime() : null
    const discountType = discountMode === 'none' ? null : discountMode
    const discountValue = discountType ? Number(discountStr) || 0 : 0
    const taxPercent = Number(taxStr) || 0
    const invoice: Invoice = editingInvoice
      ? { ...editingInvoice, type, party: party.trim(), currency, items: cleanItems, total, paidAmount, payMethod, attachment, dueDate, discountType, discountValue, taxPercent, notes: notes.trim() }
      : { id: meta.nextId, type, party: party.trim(), currency, date: Date.now(), items: cleanItems, total, paymentStatus: 'unpaid', paidAmount, payments: [], payMethod, attachment, dueDate, discountType, discountValue, taxPercent, notes: notes.trim() }
    await saveInvoice(invoice)
    if (!editingInvoice) await updateMeta('nextId', meta.nextId + 1)
    savedRef.current = true
    clearFormDraft()
    toast(editingInvoice ? 'تم تحديث الفاتورة بنجاح' : 'تم حفظ الفاتورة بنجاح')
    onDone(invoice.id)
  }

  const inputCls =
    'w-full rounded-xl border border-[var(--border)] bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] transition-colors'

  const pendingItem = pendingRemoveIndex != null ? items[pendingRemoveIndex] : null

  // عند التعديل ووجود سجل دفعات: تُدار الدفعات من صفحة الفاتورة لا من هنا
  const hasHistory = !!editingInvoice?.payments?.length

  function BreakRow({ label, value, currency: cur }: { label: string; value: number; currency: string }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 4 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontWeight: 700, color: value < 0 ? '#5eead4' : 'var(--text)' }}>
          {value.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(cur)}
        </span>
      </div>
    )
  }

  function handleCancelClick() {
    // عند التعديل: تأكيد تجاهل التغييرات. عند الإنشاء: إلغاء مباشر إذا الحقول فارغة وإلا تأكيد.
    const isDirty = party.trim() !== '' || items.some((it) => it.name || it.qty || it.price) || paidStr !== '' || dueStr !== '' || discountStr !== '' || taxStr !== '' || notes.trim() !== '' || payMethod !== null || attachment !== (editingInvoice?.attachment ?? undefined)
    if (editingInvoice || isDirty) setShowDiscardModal(true)
    else onCancel()
  }

  return (
    <>
    <div className="card p-4">
      {/* Title */}
      <h3 className="mb-4 text-base font-black brand-text">
        {editingInvoice ? `✏️ تعديل الفاتورة #${editingInvoice.id}` : '🆕 فاتورة جديدة'}
      </h3>
      {restoredHint && !editingInvoice && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
          📝 مسودة مستعادة — بياناتك محفوظة تلقائياً حتى بعد التنقل
        </div>
      )}

      {/* Type toggle */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-black/20 p-1.5">
        {(['purchase', 'sale'] as InvoiceType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            style={{
              borderRadius: 12,
              padding: '9px 12px',
              fontSize: 13,
              fontWeight: type === t ? 800 : 500,
              border: 'none',
              cursor: 'pointer',
              transition: 'all .2s',
              background:
                type === t
                  ? 'linear-gradient(135deg, var(--accent), var(--accent2))'
                  : 'transparent',
              color: type === t ? '#fff' : 'var(--muted)',
              boxShadow: type === t ? '0 4px 14px rgba(34,201,163,.3)' : 'none',
            }}
          >
            {t === 'purchase' ? '🛒 شراء (من المورد)' : '📦 بيع (للمستهلك)'}
          </button>
        ))}
      </div>

      {/* Party name + autocomplete from directory */}
      <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
        {type === 'purchase' ? 'اسم المورد' : 'اسم العميل'}
      </label>
      <div className="relative mb-4">
        <input
          value={party}
          onChange={(e) => setParty(e.target.value)}
          onFocus={() => setPartyFocus(true)}
          onBlur={() => setTimeout(() => setPartyFocus(false), 150)}
          placeholder="مثال: Mega Power"
          className={inputCls}
        />
        {partyFocus && partySuggestions.length > 0 && (
          <div className="drop-menu">
            {partySuggestions.map((p) => (
              <button
                key={p.name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setParty(p.name); setPartyFocus(false) }}
                className="drop-item"
              >
                <span className="font-semibold">👤 {p.name}</span>
                <span className="sub">{p.invoiceCount} فواتير</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Currency Selector (Premium Pill Buttons) ────────────────── */}
      <label className="mb-2 block text-xs font-semibold text-[var(--muted)]">العملة</label>
      <div className="mb-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${meta.currencies.length}, 1fr)` }}>
        {meta.currencies.map((c) => {
          const cm = CURRENCY_META[c] ?? { flag: '💱', label: c }
          const isSelected = currency === c
          const sym = currencySymbol(c)
          return (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '10px 6px',
                borderRadius: 14,
                border: isSelected
                  ? '1.5px solid var(--brand)'
                  : '1.5px solid var(--border)',
                background: isSelected
                  ? 'var(--brand-chip)'
                  : 'var(--chip)',
                cursor: 'pointer',
                transition: 'all .2s',
                boxShadow: isSelected ? '0 4px 16px var(--brand-glow)' : 'none',
              }}
            >
              {/* Flag */}
              <span style={{ fontSize: 20, lineHeight: 1 }}>{cm.flag}</span>
              {/* Symbol */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: isSelected ? 'var(--brand)' : 'var(--text)',
                  lineHeight: 1,
                }}
              >
                {sym}
              </span>
              {/* Label */}
              <span
                style={{
                  fontSize: 10,
                  color: isSelected ? 'var(--brand)' : 'var(--muted)',
                  fontWeight: isSelected ? 700 : 500,
                  lineHeight: 1,
                }}
              >
                {c}
              </span>
              {/* Selected dot */}
              {isSelected && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--brand)',
                    marginTop: 2,
                    boxShadow: '0 0 6px var(--brand)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ─── Payment status ─── */}
      {hasHistory ? (
        <div className="mb-3 rounded-xl border border-[var(--border)] bg-black/10 p-3 text-xs text-[var(--muted)]" style={{ lineHeight: 1.8 }}>
          💵 لهذه الفاتورة سجل دفعات ({editingInvoice?.payments?.length}) — تُدار إضافته والتراجع عنه من صفحة الفاتورة بعد الحفظ.
        </div>
      ) : (
      <>
      <label className="mb-2 block text-xs font-semibold text-[var(--muted)]">حالة الدفع</label>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(['paid', 'partial', 'unpaid'] as PaymentStatus[]).map((s) => {
          const active = payStatus === s
          return (
            <button
              key={s}
              onClick={() => setPayStatus(s)}
              style={{
                padding: '9px 6px', borderRadius: 12, fontSize: 12.5, fontWeight: active ? 800 : 500,
                border: active ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                background: active ? 'var(--brand-chip)' : 'var(--chip)',
                color: active ? 'var(--brand)' : 'var(--muted)',
                cursor: 'pointer', transition: 'all .2s',
                boxShadow: active ? '0 4px 14px var(--brand-glow)' : 'none',
              }}
            >
              {PAYMENT_META[s].icon} {PAYMENT_META[s].label}
            </button>
          )
        })}
      </div>
      {payStatus === 'partial' && !hasHistory && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">المبلغ المدفوع ({currencySymbol(currency)})</label>
            <input
              type="number" min={0} value={paidStr}
              inputMode="decimal"
              onChange={(e) => setPaidStr(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">تاريخ الاستحقاق (اختياري)</label>
            <input
              type="date" value={dueStr}
              onChange={(e) => setDueStr(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      )}
      {payStatus === 'unpaid' && !hasHistory && (
        <div className="mb-3">
          <label className="mb-1 block text-xs text-[var(--muted)]">تاريخ الاستحقاق (اختياري — للتنبيه بالمتأخرات)</label>
          <input
            type="date" value={dueStr}
            onChange={(e) => setDueStr(e.target.value)}
            className={inputCls}
          />
        </div>
      )}
      </>)}
      {/* ─── Payment method ─── */}
      {!hasHistory && (
        <>
          <label className="mb-2 block text-xs font-semibold text-[var(--muted)]">طريقة الدفع (اختياري)</label>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {(['cash', 'transfer', 'check', 'other'] as PaymentMethod[]).map((m) => {
              const active = payMethod === m
              return (
                <button
                  key={m}
                  onClick={() => setPayMethod(active ? null : m)}
                  style={{
                    padding: '8px 4px', borderRadius: 12, fontSize: 12, fontWeight: active ? 800 : 500,
                    border: active ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                    background: active ? 'var(--brand-chip)' : 'var(--chip)',
                    color: active ? 'var(--brand)' : 'var(--muted)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {PAYMENT_METHOD_META[m].icon} {PAYMENT_METHOD_META[m].label}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Items */}
      <h3 className="mb-3 text-sm font-black">الأصناف</h3>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[var(--border)] bg-black/10 p-3"
          >
            {/* Row: name + qty + price + delete */}
            <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,2fr) 80px 80px 36px' }}>
              <div className="relative">
                <input
                  value={it.name}
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  onFocus={() => setItemFocusIdx(idx)}
                  onBlur={() => setTimeout(() => setItemFocusIdx((v) => (v === idx ? null : v)), 150)}
                  placeholder="اسم الصنف"
                  className={inputCls}
                />
                {itemFocusIdx === idx && itemSuggestions(idx).length > 0 && (
                  <div className="drop-menu">
                    {itemSuggestions(idx).map((c) => (
                      <button
                        key={c.name}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          updateItem(idx, { name: c.name, price: c.lastPrice, specs: it.specs || c.specs })
                          setItemFocusIdx(null)
                        }}
                        className="drop-item"
                      >
                        <span className="font-semibold">📦 {c.name}</span>
                        <span className="sub">
                          {c.lastPrice.toLocaleString('en-US')} {currencySymbol(c.currency)} · ×{c.usageCount}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={it.qty || ''}
                onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                placeholder="الكمية"
                className={inputCls}
              />
              <input
                type="number"
                inputMode="decimal"
                value={it.price || ''}
                onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                placeholder="السعر"
                className={inputCls}
              />
              <button
                onClick={() => removeItem(idx)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgba(255,90,95,.3)',
                  background: 'rgba(255,90,95,.1)',
                  color: 'var(--danger)',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  alignSelf: 'center',
                }}
              >
                ✕
              </button>
            </div>
            {/* Specs */}
            <input
              value={it.specs}
              onChange={(e) => updateItem(idx, { specs: e.target.value })}
              placeholder="مواصفات إضافية (اختياري)"
              className={`${inputCls} mt-2`}
              style={{ fontSize: 12 }}
            />
            {/* Live subtotal */}
            {it.qty > 0 && it.price > 0 && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontWeight: 700,
                  textAlign: 'left',
                }}
              >
                الإجمالي: {(it.qty * it.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add item */}
      <button
        onClick={addItem}
        style={{
          marginTop: 10,
          width: '100%',
          padding: '10px',
          borderRadius: 12,
          border: '1.5px dashed var(--dashed)',
          background: 'var(--chip)',
          color: 'var(--muted)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all .2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--dashed)')}
      >
        + إضافة صنف
      </button>

      {/* ─── Discount / Tax / Notes ─── */}
      <h3 className="mb-2 mt-5 text-sm font-black">🏷️ الخصم والضريبة</h3>
      <div className="rounded-xl border border-[var(--border)] bg-black/10 p-3">
        <div className="mb-2 grid grid-cols-3 gap-2">
          {(['none', 'percent', 'amount'] as const).map((m) => {
            const active = discountMode === m
            return (
              <button
                key={m}
                onClick={() => setDiscountMode(m)}
                style={{
                  padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: active ? 800 : 500,
                  border: active ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                  background: active ? 'var(--brand-chip)' : 'var(--chip)',
                  color: active ? 'var(--brand)' : 'var(--muted)',
                  cursor: 'pointer', transition: 'all .2s',
                }}
              >
                {m === 'none' ? 'بدون خصم' : m === 'percent' ? 'خصم %' : 'خصم مبلغ'}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">
              {discountMode === 'percent' ? 'نسبة الخصم %' : discountMode === 'amount' ? `قيمة الخصم (${currencySymbol(currency)})` : 'الخصم'}
            </label>
            <input
              type="number" min={0} value={discountStr}
              inputMode="decimal"
              onChange={(e) => setDiscountStr(e.target.value)}
              disabled={discountMode === 'none'}
              placeholder="0"
              className={inputCls}
              style={discountMode === 'none' ? { opacity: 0.4 } : undefined}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--muted)]">الضريبة % (بعد الخصم)</label>
            <input
              type="number" min={0} max={100} value={taxStr}
              inputMode="decimal"
              onChange={(e) => setTaxStr(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="mb-1 block text-xs text-[var(--muted)]">ملاحظات (تظهر في الفاتورة المطبوعة)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: الدفع خلال 14 يوم، الأسعار شاملة التوصيل..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* ─── Attachment (optional) ─── */}
      <h3 className="mb-2 mt-5 text-sm font-black">📎 مرفق اختياري (صورة إشعار الحوالة)</h3>
      {!attachment ? (
        <label
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed px-4 py-3 text-sm font-bold text-[var(--muted)] transition-colors"
          style={{ borderColor: 'var(--dashed)', background: 'var(--chip)' }}
        >
          {attachmentBusy ? '⏳ جارٍ معالجة الصورة...' : '📷 إرفاق صورة من الجهاز'}
          <input type="file" accept="image/*" onChange={handleAttachmentFile} className="hidden" disabled={attachmentBusy} />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-black/10 p-3">
          <img src={attachment} className="h-16 w-16 rounded-lg object-cover" alt="المرفق" />
          <div className="flex-1 text-xs text-[var(--muted)]">تم إرفاق صورة (تُحفظ مع الفاتورة ولا تُطبع)</div>
          <label
            className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-bold hover:bg-white/10 transition-colors"
            title="استبدال الصورة"
          >
            🔄 تغيير
            <input type="file" accept="image/*" onChange={handleAttachmentFile} className="hidden" disabled={attachmentBusy} />
          </label>
          <button
            onClick={() => setShowDeleteAttachmentModal(true)}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-[var(--danger)] hover:bg-red-500/20 transition-colors"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Live breakdown */}
      {liveTotal > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 16px',
            borderRadius: 14,
            background: 'var(--total-bg)',
            border: '1px solid var(--total-border)',
          }}
        >
          <BreakRow label="المجموع الفرعي" value={breakdown.subtotal} currency={currency} />
          {breakdown.discountAmount > 0 && (
            <BreakRow label={`الخصم${discountMode === 'percent' ? ` (${Number(discountStr) || 0}%)` : ''}`} value={-breakdown.discountAmount} currency={currency} />
          )}
          {breakdown.taxAmount > 0 && (
            <BreakRow label={`الضريبة (${Number(taxStr) || 0}%)`} value={breakdown.taxAmount} currency={currency} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--total-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>المجموع الكلي</span>
            <span style={{ fontSize: 18, fontWeight: 900 }} className="accent-text">
              {breakdown.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              {currencySymbol(currency)}
            </span>
          </div>
        </div>
      )}
      {breakdown.total > 0 && payStatus === 'partial' && !hasHistory && Number(paidStr) > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', textAlign: 'left' }}>
          المتبقي: <b style={{ color: 'var(--brand)' }}>
            {Math.max(0, breakdown.total - Number(paidStr)).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
          </b>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={handleSave}
          className="btn-brand flex-1 rounded-xl py-3 font-extrabold shadow-lg"
          style={{ fontSize: 14 }}
        >
          {editingInvoice ? '💾 حفظ التعديلات' : '✅ حفظ الفاتورة'}
        </button>
        {editingInvoice && (
          <button
            onClick={handleCancelClick}
            className="rounded-xl border border-[var(--border)] px-5 py-3"
            style={{ fontSize: 14 }}
          >
            إلغاء
          </button>
        )}
      </div>
    </div>

      {/* مودال حذف المرفق */}
      <DeleteConfirmModal
        isOpen={showDeleteAttachmentModal}
        title="حذف المرفق"
        itemName="صورة المرفق الحالية"
        message="هل أنت متأكد من حذف الصورة المرفقة بهذه الفاتورة؟"
        confirmLabel="نعم، احذف المرفق"
        cancelLabel="تراجع"
        onConfirm={confirmDeleteAttachment}
        onCancel={() => setShowDeleteAttachmentModal(false)}
      />

      {/* مودال حذف صنف — مخصص */}      <DeleteConfirmModal
        isOpen={pendingRemoveIndex != null}
        title="حذف الصنف"
        itemName={pendingItem?.name ? `صنف "${pendingItem.name}"` : `الصنف رقم ${(pendingRemoveIndex ?? 0) + 1}`}
        itemMeta={
          pendingItem && pendingItem.qty > 0 && pendingItem.price > 0
            ? `الكمية: ${pendingItem.qty} · الإجمالي: ${(pendingItem.qty * pendingItem.price).toLocaleString('en-US')} ${currencySymbol(currency)}`
            : undefined
        }
        message="هل أنت متأكد من حذف هذا الصنف من الفاتورة؟"
        confirmLabel="نعم، احذف الصنف"
        cancelLabel="تراجع"
        onConfirm={confirmRemoveItem}
        onCancel={() => setPendingRemoveIndex(null)}
      />

      {/* مودال تجاهل التغييرات */}
      <ConfirmModal
        isOpen={showDiscardModal}
        variant="warning"
        icon="📝"
        title={editingInvoice ? 'تجاهل التعديلات؟' : 'تجاهل الفاتورة الجديدة؟'}
        message="لديك بيانات غير محفوظة. هل تريد تجاهلها والخروج دون حفظ؟"
        confirmLabel="نعم، تجاهل"
        cancelLabel="متابعة التحرير"
        onConfirm={() => {
          setShowDiscardModal(false)
          clearFormDraft()
          onCancel()
        }}
        onCancel={() => setShowDiscardModal(false)}
      />
    </>
  )
}
