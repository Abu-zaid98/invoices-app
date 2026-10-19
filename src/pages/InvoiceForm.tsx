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
import DatePicker from '../components/DatePicker'
import Icon from '../components/ui/Icon'

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
  const [showResetModal, setShowResetModal] = useState(false)

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
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر إرفاق الصورة', 'danger')
    } finally {
      setAttachmentBusy(false)
    }
  }

  function confirmDeleteAttachment() {
    setAttachment(undefined)
    setShowDeleteAttachmentModal(false)
  }

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
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

  const pendingItem = pendingRemoveIndex != null ? items[pendingRemoveIndex] : null

  // عند التعديل ووجود سجل دفعات: تُدار الدفعات من صفحة الفاتورة لا من هنا
  const hasHistory = !!editingInvoice?.payments?.length

  function BreakRow({ label, value, currency: cur }: { label: string; value: number; currency: string }) {
    return (
      <div className="row-between" style={{ fontSize: 12.5, marginTop: 6 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="amount" style={{ color: value < 0 ? 'var(--accent)' : 'var(--text)' }}>
          {value.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(cur)}
        </span>
      </div>
    )
  }

  /** هل يوجد أي شيء أدخله المستخدم (يُستخدم لتفعيل زر التفريغ ولتأكيد الإلغاء) */
  const isDirty =
    party.trim() !== '' ||
    items.some((it) => it.name || it.qty || it.price) ||
    paidStr !== '' ||
    dueStr !== '' ||
    discountStr !== '' ||
    taxStr !== '' ||
    notes.trim() !== '' ||
    payMethod !== null ||
    attachment !== (editingInvoice?.attachment ?? undefined)

  /** تفريغ كل الحقول والعودة إلى فاتورة جديدة فارغة (مع مسح المسودة المحفوظة) */
  function resetForm() {
    setType('purchase')
    setParty('')
    setCurrency(meta.currency)
    setItems([emptyItem()])
    setPayStatus('unpaid')
    setPaidStr('')
    setDueStr('')
    setPayMethod(null)
    setDiscountMode('none')
    setDiscountStr('')
    setTaxStr('')
    setNotes('')
    setAttachment(undefined)
    clearFormDraft()
    setShowResetModal(false)
    toast('تم تفريغ بيانات الفاتورة — ابدأ من جديد')
  }

  function handleCancelClick() {
    // عند التعديل: تأكيد تجاهل التغييرات. عند الإنشاء: إلغاء مباشر إذا الحقول فارغة وإلا تأكيد.
    if (editingInvoice || isDirty) setShowDiscardModal(true)
    else onCancel()
  }

  return (
    <>
      <div className="stack">
        {/* Top bar */}
        <div className="page-head">
          <button type="button" className="icon-btn icon-btn--ghost" onClick={handleCancelClick} aria-label="رجوع">
            <Icon name="arrowRight" />
          </button>
          <div className="grow" style={{ textAlign: 'center' }}>
            <div className="t-heading">{editingInvoice ? 'تعديل الفاتورة' : 'فاتورة جديدة'}</div>
            <div className="t-caption">
              {editingInvoice ? `#${String(editingInvoice.id).padStart(4, '0')}` : 'مسودة قابلة للحفظ تلقائياً'}
            </div>
          </div>
          <span style={{ width: 40 }} aria-hidden="true" />
        </div>

        {!editingInvoice && isDirty && (
          <button
            type="button"
            className="btn btn--tint-danger btn--block btn--sm"
            onClick={() => setShowResetModal(true)}
            style={{ justifyContent: 'center' }}
          >
            <Icon name="refresh" size={16} />
            تفريغ البيانات والبدء من جديد
          </button>
        )}

        {restoredHint && !editingInvoice && (
          <div className="card card--pad" style={{ background: 'var(--warning-soft)', borderColor: 'transparent', padding: 12 }}>
            <div className="inline" style={{ color: 'var(--warning)', fontWeight: 700, fontSize: 13 }}>
              <Icon name="pencil" size={16} />
              مسودة مستعادة — بياناتك محفوظة تلقائياً حتى بعد التنقل
            </div>
          </div>
        )}

        {/* النوع + الطرف + العملة */}
        <div className="card card--pad stack-sm">
          <div className="segmented" role="group" aria-label="نوع الفاتورة">
            {(['purchase', 'sale'] as InvoiceType[]).map((t) => (
              <button
                key={t}
                type="button"
                className="segmented-item"
                data-active={type === t}
                aria-pressed={type === t}
                onClick={() => setType(t)}
              >
                <Icon name={t === 'purchase' ? 'download' : 'upload'} size={17} />
                {t === 'purchase' ? 'شراء (من المورد)' : 'بيع (للمستهلك)'}
              </button>
            ))}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="f-party">
              {type === 'purchase' ? 'اسم المورد' : 'اسم العميل'}
              <span className="req">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="f-party"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                onFocus={() => setPartyFocus(true)}
                onBlur={() => setTimeout(() => setPartyFocus(false), 150)}
                placeholder="مثال: Mega Power"
                className="input"
                autoComplete="off"
              />
              {partyFocus && partySuggestions.length > 0 && (
                <div className="drop-menu">
                  {partySuggestions.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setParty(p.name); setPartyFocus(false) }}
                      className="drop-item"
                    >
                      <span className="inline-row" style={{ fontWeight: 600 }}>
                        <Icon name="user" size={15} />
                        {p.name}
                      </span>
                      <span className="sub">{p.invoiceCount} فواتير</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="field">
            <span className="field-label">العملة</span>
            <div className="choice-row">
              {meta.currencies.map((c) => {
                const cm = CURRENCY_META[c] ?? { flag: '💱', label: c }
                const isSelected = currency === c
                return (
                  <button
                    key={c}
                    type="button"
                    className="choice"
                    data-active={isSelected}
                    aria-pressed={isSelected}
                    onClick={() => setCurrency(c)}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{cm.flag}</span>
                    <span style={{ fontWeight: 800 }}>{currencySymbol(c)}</span>
                    <span style={{ fontSize: 10 }}>{c}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* الأصناف */}
        <div className="card card--pad">
          <div className="section-head">
            <span className="section-title">الأصناف</span>
            <span className="section-meta">{validItems.length} مكتمل</span>
          </div>
          <div className="stack-sm">
            {items.map((it, idx) => (
              <div className="item-card" key={idx}>
                <div className="item-head">
                  <span className="inline-row" style={{ fontWeight: 700, fontSize: 13 }}>
                    <span className="item-index">{idx + 1}</span>
                    صنف
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="btn btn--tint-danger btn--sm"
                    aria-label="حذف الصنف"
                  >
                    <Icon name="trash" size={15} />
                    حذف
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    value={it.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    onFocus={() => setItemFocusIdx(idx)}
                    onBlur={() => setTimeout(() => setItemFocusIdx((v) => (v === idx ? null : v)), 150)}
                    placeholder="اسم الصنف"
                    className="input"
                    aria-label={`اسم الصنف ${idx + 1}`}
                    autoComplete="off"
                  />
                  {itemFocusIdx === idx && itemSuggestions(idx).length > 0 && (
                    <div className="drop-menu">
                      {itemSuggestions(idx).map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            updateItem(idx, { name: c.name, price: c.lastPrice, specs: it.specs || c.specs })
                            setItemFocusIdx(null)
                          }}
                          className="drop-item"
                        >
                          <span className="inline-row" style={{ fontWeight: 600 }}>
                            <Icon name="tag" size={15} />
                            {c.name}
                          </span>
                          <span className="sub">
                            {c.lastPrice.toLocaleString('en-US')} {currencySymbol(c.currency)} · ×{c.usageCount}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor={`qty-${idx}`}>الكمية</label>
                    <input
                      id={`qty-${idx}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={it.qty || ''}
                      onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                      placeholder="0"
                      className="input input--num"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor={`price-${idx}`}>سعر الوحدة ({currencySymbol(currency)})</label>
                    <input
                      id={`price-${idx}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={it.price || ''}
                      onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                      placeholder="0"
                      className="input input--num"
                    />
                  </div>
                </div>

                <input
                  value={it.specs}
                  onChange={(e) => updateItem(idx, { specs: e.target.value })}
                  placeholder="مواصفات إضافية (اختياري)"
                  className="input"
                  style={{ fontSize: 13 }}
                  aria-label={`مواصفات الصنف ${idx + 1}`}
                />

                {it.qty > 0 && it.price > 0 && (
                  <div className="amount" style={{ fontSize: 12.5, color: 'var(--accent)', textAlign: 'left' }}>
                    الإجمالي: {(it.qty * it.price).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="btn btn--block"
            style={{ marginTop: 12, borderStyle: 'dashed', borderColor: 'var(--dashed)', color: 'var(--muted)' }}
          >
            <Icon name="plus" />
            إضافة صنف
          </button>
        </div>

        {/* حالة الدفع وطريقة الدفع */}
        <div className="card card--pad">
          <div className="section-head">
            <span className="section-title">الدفع</span>
            <span className="stat-icon g-green" style={{ width: 34, height: 34 }}>
              <Icon name="wallet" size={18} />
            </span>
          </div>

          {hasHistory ? (
            <div className="modal-note" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <span className="field-label">
                <Icon name="cash" size={14} />
                سجل دفعات موجود ({editingInvoice?.payments?.length})
              </span>
              <span className="hint">تُدار إضافة الدفعات والتراجع عنها من صفحة الفاتورة بعد الحفظ.</span>
            </div>
          ) : (
            <>
              <span className="field-label" style={{ marginBottom: 8 }}>حالة الدفع</span>
              <div className="choice-row" style={{ marginBottom: 12 }}>
                {(['paid', 'partial', 'unpaid'] as PaymentStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="choice"
                    data-active={payStatus === s}
                    aria-pressed={payStatus === s}
                    onClick={() => setPayStatus(s)}
                  >
                    <span style={{ fontSize: 15 }}>{PAYMENT_META[s].icon}</span>
                    <span>{PAYMENT_META[s].label}</span>
                  </button>
                ))}
              </div>

              {payStatus === 'partial' && (
                <div className="form-grid" style={{ marginBottom: 12 }}>
                  <div className="field">
                    <label className="field-label" htmlFor="f-paid">المبلغ المدفوع ({currencySymbol(currency)})</label>
                    <input
                      id="f-paid"
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={paidStr}
                      onChange={(e) => setPaidStr(e.target.value)}
                      placeholder="0"
                      className="input input--num"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="f-due">تاريخ الاستحقاق</label>
                    <DatePicker id="f-due" value={dueStr} onChange={setDueStr} ariaLabel="تاريخ الاستحقاق" />
                  </div>
                </div>
              )}

              {payStatus === 'unpaid' && (
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="field-label" htmlFor="f-due2">تاريخ الاستحقاق (اختياري — للتنبيه بالمتأخرات)</label>
                  <DatePicker id="f-due2" value={dueStr} onChange={setDueStr} ariaLabel="تاريخ الاستحقاق (اختياري)" />
                </div>
              )}

              <span className="field-label" style={{ marginBottom: 8 }}>طريقة الدفع (اختياري)</span>
              <div className="choice-row">
                {(['cash', 'transfer', 'check', 'other'] as PaymentMethod[]).map((m) => {
                  const active = payMethod === m
                  return (
                    <button
                      key={m}
                      type="button"
                      className="choice"
                      data-active={active}
                      aria-pressed={active}
                      onClick={() => setPayMethod(active ? null : m)}
                    >
                      <span style={{ fontSize: 15 }}>{PAYMENT_METHOD_META[m].icon}</span>
                      <span>{PAYMENT_METHOD_META[m].label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* الخصم والضريبة والملاحظات */}
        <div className="card card--pad">
          <div className="section-head">
            <span className="section-title">الخصم والضريبة</span>
            <span className="stat-icon g-amber" style={{ width: 34, height: 34 }}>
              <Icon name="percent" size={18} />
            </span>
          </div>

          <div className="segmented" style={{ marginBottom: 12 }} role="group" aria-label="نوع الخصم">
            {(['none', 'percent', 'amount'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="segmented-item"
                data-active={discountMode === m}
                aria-pressed={discountMode === m}
                onClick={() => setDiscountMode(m)}
              >
                {m === 'none' ? 'بدون خصم' : m === 'percent' ? 'خصم %' : 'خصم مبلغ'}
              </button>
            ))}
          </div>

          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label className="field-label" htmlFor="f-disc">
                {discountMode === 'percent' ? 'نسبة الخصم %' : discountMode === 'amount' ? `قيمة الخصم (${currencySymbol(currency)})` : 'الخصم'}
              </label>
              <input
                id="f-disc"
                type="number"
                min={0}
                inputMode="decimal"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                disabled={discountMode === 'none'}
                placeholder="0"
                className="input input--num"
                style={discountMode === 'none' ? { opacity: 0.45 } : undefined}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="f-tax">الضريبة % (بعد الخصم)</label>
              <input
                id="f-tax"
                type="number"
                min={0}
                max={100}
                inputMode="decimal"
                value={taxStr}
                onChange={(e) => setTaxStr(e.target.value)}
                placeholder="0"
                className="input input--num"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="f-notes">ملاحظات (تظهر في الفاتورة المطبوعة)</label>
            <textarea
              id="f-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: الدفع خلال 14 يوم، الأسعار شاملة التوصيل..."
              rows={2}
              className="textarea"
            />
          </div>
        </div>

        {/* المرفق */}
        <div className="card card--pad">
          <div className="section-head">
            <span className="section-title">مرفق اختياري</span>
            <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}>
              <Icon name="image" size={18} />
            </span>
          </div>
          <p className="hint" style={{ marginBottom: 12 }}>صورة إشعار الحوالة — تُحفظ مع الفاتورة ولا تُطبع.</p>
          {!attachment ? (
            <label
              className="btn btn--secondary btn--block"
              style={{ borderStyle: 'dashed', borderColor: 'var(--dashed)', cursor: 'pointer' }}
            >
              <Icon name="image" />
              {attachmentBusy ? 'جارٍ معالجة الصورة...' : 'إرفاق صورة من الجهاز'}
              <input type="file" accept="image/*" onChange={handleAttachmentFile} hidden disabled={attachmentBusy} />
            </label>
          ) : (
            <div className="inline" style={{ alignItems: 'flex-start' }}>
              <img src={attachment} alt="المرفق" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover' }} />
              <div className="grow">
                <div className="t-caption">تم إرفاق صورة (تُحفظ مع الفاتورة ولا تُطبع)</div>
                <div className="inline" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <label className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }} title="استبدال الصورة">
                    <Icon name="refresh" size={15} />
                    تغيير
                    <input type="file" accept="image/*" onChange={handleAttachmentFile} hidden disabled={attachmentBusy} />
                  </label>
                  <button type="button" onClick={() => setShowDeleteAttachmentModal(true)} className="btn btn--tint-danger btn--sm">
                    <Icon name="trash" size={15} />
                    حذف
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* الملخص الحي */}
        {liveTotal > 0 && (
          <div style={{ padding: '14px 18px', borderRadius: 'var(--radius-lg)', background: 'var(--total-bg)', border: '1px solid var(--total-border)' }}>
            <BreakRow label="المجموع الفرعي" value={breakdown.subtotal} currency={currency} />
            {breakdown.discountAmount > 0 && (
              <BreakRow label={`الخصم${discountMode === 'percent' ? ` (${Number(discountStr) || 0}%)` : ''}`} value={-breakdown.discountAmount} currency={currency} />
            )}
            {breakdown.taxAmount > 0 && (
              <BreakRow label={`الضريبة (${Number(taxStr) || 0}%)`} value={breakdown.taxAmount} currency={currency} />
            )}
            <div className="row-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--total-border)' }}>
              <span className="t-label">المجموع الكلي</span>
              <span className="accent-text amount-lg">
                {breakdown.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
              </span>
            </div>
          </div>
        )}
        {breakdown.total > 0 && payStatus === 'partial' && !hasHistory && Number(paidStr) > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'left' }}>
            المتبقي: <b className="amount" style={{ color: 'var(--brand)' }}>
              {Math.max(0, breakdown.total - Number(paidStr)).toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(currency)}
            </b>
          </div>
        )}

        {/* شريط الإجراءات الملاصق */}
        <div className="form-actions">
          <button type="button" onClick={handleSave} className="btn btn--primary grow" style={{ minHeight: 50, fontSize: 15.5 }}>
            <Icon name="check" />
            {editingInvoice ? 'حفظ التعديلات' : 'حفظ الفاتورة'}
          </button>
          <button type="button" onClick={handleCancelClick} className="btn btn--secondary" style={{ minHeight: 50 }}>
            إلغاء
          </button>
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

      {/* مودال حذف صنف — مخصص */}
      <DeleteConfirmModal
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

      {/* مودال تفريغ بيانات الفاتورة الجديدة */}
      <ConfirmModal
        isOpen={showResetModal}
        variant="warning"
        icon={<Icon name="refresh" />}
        title="تفريغ بيانات الفاتورة؟"
        message="سيتم مسح كل ما أدخلته في هذه الفاتورة والبدء من جديد، ولا يمكن التراجع عن هذه الخطوة."
        confirmLabel="نعم، تفريغ البيانات"
        cancelLabel="تراجع"
        onConfirm={resetForm}
        onCancel={() => setShowResetModal(false)}
      />

      {/* مودال تجاهل التغييرات */}
      <ConfirmModal
        isOpen={showDiscardModal}
        variant="warning"
        icon={<Icon name="pencil" />}
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
