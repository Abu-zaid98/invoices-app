import { useEffect, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import { currencySymbol, invoiceBalance, isOverdue, PAYMENT_META, PAYMENT_METHOD_META, calcTotals } from '../lib/types'
import { exportReceiptPDF } from '../lib/printInvoice'
import { shareInvoicePdf } from '../lib/invoicePdf'
import { getInvoiceQR } from '../lib/qr'
import ExportModal from '../components/ExportModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import PaymentModal from '../components/PaymentModal'
import CreditModal from '../components/CreditModal'

interface Props {
  invoiceId: number
  onBack: () => void
  onEdit: (id: number) => void
  onDuplicate: (id: number) => void
  onOpenParty?: (name: string) => void
  onCreateCredit?: (id: number, amount: number, reason: string) => void
  onOpenInvoice?: (id: number) => void
}

export default function InvoiceDetail({ invoiceId, onBack, onEdit, onDuplicate, onOpenParty, onCreateCredit, onOpenInvoice }: Props) {
  const { invoices, meta, trashInvoice, restoreInvoice, recordPayment, voidPayment } = useAppData()
  const { toast } = useToast()
  const [showExport, setShowExport] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [printingReceipt, setPrintingReceipt] = useState<string | null>(null)
  const [pendingVoidId, setPendingVoidId] = useState<string | null>(null)
  const [showAttachment, setShowAttachment] = useState(false)
  const [qrUrl, setQrUrl] = useState('')

  const inv = invoices.find((i) => i.id === invoiceId)

  // QR التحقق — يُعاد توليده عند تغيّر بيانات الفاتورة
  useEffect(() => {
    if (!inv) return
    let alive = true
    setQrUrl('')
    getInvoiceQR(inv)
      .then((url) => { if (alive) setQrUrl(url) })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id, inv?.total, inv?.currency, inv?.paymentStatus, inv?.paidAmount])

  if (!inv) return <div className="card p-4 text-center text-[var(--muted)]">الفاتورة غير موجودة</div>

  const isSale = inv.type === 'sale'
  const credit = inv.type === 'credit'
  const creditSale = (inv.creditKind ?? 'sale') === 'sale'
  const invNum = String(inv.id).padStart(4, '0')
  const remaining = invoiceBalance(inv)
  const overdue = isOverdue(inv)
  const payMeta = PAYMENT_META[inv.paymentStatus ?? 'unpaid']
  const payPct = inv.total > 0 ? Math.min(100, ((inv.paidAmount || 0) / inv.total) * 100) : 0
  const bt = calcTotals(inv.items, inv.discountType ?? null, inv.discountValue || 0, inv.taxPercent || 0)

  async function confirmDelete() {
    const id = inv!.id
    await trashInvoice(id)
    setShowDeleteModal(false)
    toast('نُقلت الفاتورة إلى سلة المحذوفات', 'danger', {
      label: '↩️ تراجع',
      onClick: () => restoreInvoice(id).then(() => toast('تمت استعادة الفاتورة')),
    })
    onBack()
  }

  async function handleRecordPayment(amount: number, note: string) {
    await recordPayment(inv!.id, amount, note)
    setShowPayModal(false)
    toast('تم تسجيل الدفعة بنجاح')
  }

  async function handleCreateCredit(amount: number, reason: string) {
    setShowCreditModal(false)
    await onCreateCredit?.(inv!.id, amount, reason)
  }

  async function handlePrintReceipt(entryId: string) {
    const entry = (inv!.payments || []).find((p) => p.id === entryId)
    if (!entry || printingReceipt) return
    setPrintingReceipt(entryId)
    try {
      await exportReceiptPDF(entry, inv!, meta)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّرت الطباعة', 'danger')
    } finally {
      setPrintingReceipt(null)
    }
  }

  async function confirmVoidPayment() {
    if (pendingVoidId == null) return
    await voidPayment(inv!.id, pendingVoidId)
    setPendingVoidId(null)
    toast('تم التراجع عن الدفعة', 'danger')
  }

  const pendingVoidEntry = pendingVoidId != null ? (inv.payments || []).find((p) => p.id === pendingVoidId) : null

  /** مشاركة الفاتورة: ملف PDF عبر Web Share، أو تنزيله */
  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      const res = await shareInvoicePdf(inv!, meta)
      if (res === 'downloaded') toast('تم تنزيل ملف PDF')
    } catch {
      // إلغاء المستخدم — لا شيء، أو نسخ احتياطي نصي
      try {
        const text = `🧾 فاتورة #${invNum} — ${inv!.party}\nالإجمالي: ${inv!.total.toLocaleString('en-US')} ${currencySymbol(inv!.currency)}\nالحالة: ${PAYMENT_META[inv!.paymentStatus ?? 'unpaid'].label}`
        if (navigator.share) {
          await navigator.share({ title: `فاتورة #${invNum}`, text })
        } else {
          await navigator.clipboard.writeText(text)
          toast('تم نسخ ملخص الفاتورة')
        }
      } catch {
        /* تجاهل إلغاء المستخدم */
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div>
      {/* Action bar */}
      <div className="card mb-3 flex flex-wrap items-center justify-between gap-2 p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onBack}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            ← رجوع
          </button>
          {!credit && (
            <>
              <button
                onClick={() => onEdit(inv.id)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-white/5 transition-colors"
              >
                ✏️ تعديل
              </button>
              <button
                onClick={() => onDuplicate(inv.id)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-white/5 transition-colors"
                title="إنشاء نسخة جديدة من هذه الفاتورة برقم جديد"
              >
                📋 تكرار
              </button>
              {onCreateCredit && (
                <button
                  onClick={() => setShowCreditModal(true)}
                  className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-300 hover:bg-violet-500/20 transition-colors"
                  title="إنشاء إشعار دائن/مرتجع مرتبط بهذه الفاتورة"
                >
                  ↩️ مرتجع
                </button>
              )}
            </>
          )}

          {/* Premium Export Button */}
          <button
            onClick={() => setShowExport(true)}
            className="btn-brand rounded-xl px-5 py-2 text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
            style={{
              boxShadow: '0 4px 16px rgba(255,176,32,0.3)',
            }}
          >
            <span>⬇️</span>
            تصدير PDF / PNG
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-60"
            title="مشاركة الفاتورة"
          >
            {sharing ? '⏳ جارٍ...' : '📤 مشاركة'}
          </button>
        </div>

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm font-bold text-[var(--danger)] hover:bg-red-500/20 transition-colors"
          title="حذف هذه الفاتورة"
        >
          🗑️ حذف
        </button>
      </div>

      {/* Invoice preview card */}
      <div id="invoice-print-area" className="card relative overflow-hidden p-5">
        {/* Single soft top wash */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40"
          style={{
            background: `linear-gradient(180deg, ${isSale ? 'rgba(34,201,163,.08)' : 'rgba(255,176,32,.08)'}, transparent)`,
          }}
        />

        {/* Header row */}
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {meta.company.logo && (
              <img src={meta.company.logo} className="max-h-12 max-w-24 rounded-lg bg-white p-1" alt="الشعار" />
            )}
            <div>
              <h2 className="mb-0.5 text-lg font-black brand-text">🧾 {meta.company.name || 'اسم الشركة'}</h2>
              <p className="text-sm text-[var(--muted)]">
                فاتورة رقم <span className="font-bold text-[var(--text)]">#{invNum}</span>
                {' — '}
                {new Date(inv.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              credit
                ? 'bg-violet-500/20 text-violet-300'
                : isSale ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {credit ? (creditSale ? '↩️ إشعار دائن' : '↩️ مرتجع مشتريات') : isSale ? '📦 بيع' : '🛒 شراء'}
          </span>
        </div>

        {/* Linked invoice (for credits) */}
        {credit && inv.linkedId != null && onOpenInvoice && (
          <button
            onClick={() => onOpenInvoice(inv.linkedId!)}
            className="relative z-10 mt-3 flex w-full items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm hover:bg-violet-500/15 transition-colors"
          >
            <span className="font-bold text-violet-200">
              ↩️ مرتبط بالفاتورة #{String(inv.linkedId).padStart(4, '0')}
            </span>
            <span className="text-xs text-violet-300/70">عرض الأصل ←</span>
          </button>
        )}

        {/* Party */}
        <p className="relative z-10 mt-3 text-sm">
          <span className="text-[var(--muted)]">{isSale ? 'العميل' : 'المورد'}:</span>{' '}
          {onOpenParty ? (
            <button onClick={() => onOpenParty(inv.party)} className="font-bold text-[var(--brand)] underline decoration-dotted underline-offset-4 hover:opacity-80" title="عرض كشف الحساب">
              {inv.party} 📊
            </button>
          ) : (
            <span className="font-bold">{inv.party}</span>
          )}
        </p>

        {/* Items table */}
        <table className="relative z-10 mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="border-b border-[var(--border)] pb-2 pt-1 text-right">#</th>
              <th className="border-b border-[var(--border)] pb-2 pt-1 text-right">الصنف</th>
              <th className="border-b border-[var(--border)] pb-2 pt-1 text-right">الكمية</th>
              <th className="border-b border-[var(--border)] pb-2 pt-1 text-right">سعر الوحدة</th>
              <th className="border-b border-[var(--border)] pb-2 pt-1 text-right">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, idx) => (
              <tr key={idx}>
                <td className="border-b border-[var(--border)] py-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                    {idx + 1}
                  </span>
                </td>
                <td className="border-b border-[var(--border)] py-2">
                  <div className="font-semibold">{it.name}</div>
                  {it.specs && <div className="text-xs text-[var(--muted)]">{it.specs}</div>}
                </td>
                <td className="border-b border-[var(--border)] py-2">{it.qty}</td>
                <td className="border-b border-[var(--border)] py-2">
                  {it.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="border-b border-[var(--border)] py-2 font-bold text-[var(--accent)]">
                  {(it.qty * it.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals breakdown */}
        <div className="relative z-10 mt-5 flex justify-end">
          <div
            className="w-full max-w-64 rounded-2xl border border-[var(--border)] px-6 py-4"
            style={{ background: 'rgba(255,176,32,0.07)' }}
          >
            <div className="flex justify-between text-xs text-[var(--muted)]">
              <span>المجموع الفرعي</span>
              <span className="font-bold text-[var(--text)]">{bt.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}</span>
            </div>
            {bt.discountAmount > 0 && (
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-[var(--muted)]">
                  الخصم{inv.discountType === 'percent' ? ` (${inv.discountValue}%)` : ''}
                </span>
                <span className="font-bold text-emerald-400">− {bt.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}</span>
              </div>
            )}
            {bt.taxAmount > 0 && (
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-[var(--muted)]">الضريبة ({inv.taxPercent}%)</span>
                <span className="font-bold text-[var(--text)]">+ {bt.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}</span>
              </div>
            )}
            <div className="mt-2 border-t border-[var(--border)] pt-2">
              <div className="text-xs text-[var(--muted)] mb-1">الإجمالي الكلي</div>
              <div className="accent-text text-2xl font-black">
                {inv.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="relative z-10 mt-4 rounded-xl border border-[var(--border)] bg-black/10 p-3 text-sm">
            <div className="mb-1 text-xs font-bold text-[var(--muted)]">📝 ملاحظات</div>
            <div className="whitespace-pre-line leading-7">{inv.notes}</div>
          </div>
        )}

        {/* Default terms */}
        {meta.defaultTerms && (
          <div className="relative z-10 mt-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <div className="mb-1 text-xs font-bold text-[var(--muted)]">📜 الشروط والأحكام</div>
            <div className="whitespace-pre-line text-xs leading-7 text-[var(--muted)]">{meta.defaultTerms}</div>
          </div>
        )}

        {/* Attachment */}
        {inv.attachment && (
          <div className="relative z-10 mt-3 rounded-xl border border-[var(--border)] bg-black/10 p-3">
            <div className="mb-2 text-xs font-bold text-[var(--muted)]">📎 المرفق (صورة إشعار الحوالة)</div>
            <img
              src={inv.attachment}
              onClick={() => setShowAttachment(true)}
              className="max-h-40 cursor-zoom-in rounded-lg border border-[var(--border)] object-contain"
              alt="مرفق الفاتورة"
              title="اضغط للعرض المكبر"
            />
          </div>
        )}

        {/* Payment status card */}
        <div className="relative z-10 mt-4 rounded-2xl border border-[var(--border)] p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                inv.paymentStatus === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : inv.paymentStatus === 'partial'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/15 text-red-400'
              }`}
            >
              {payMeta.icon} {payMeta.label}
            </span>
            {overdue ? (
              <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300">
                ⚠️ متأخرة منذ {new Date(inv.dueDate!).toLocaleDateString('en-US')}
              </span>
            ) : inv.dueDate != null && remaining > 0 ? (
              <span className="text-xs text-[var(--muted)]">
                الاستحقاق: {new Date(inv.dueDate).toLocaleDateString('en-US')}
              </span>
            ) : null}
          </div>
          {/* Progress */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{
                width: `${payPct}%`,
                background: 'linear-gradient(90deg,var(--accent),var(--accent2))',
                transition: 'width .3s',
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
            <span>المدفوع: <b className="text-emerald-400">{(inv.paidAmount || 0).toLocaleString('en-US')} {currencySymbol(inv.currency)}</b></span>
            <span>المتبقي: <b className={remaining > 0 ? 'text-red-400' : 'text-emerald-400'}>{remaining.toLocaleString('en-US')} {currencySymbol(inv.currency)}</b></span>
          </div>
          {inv.payMethod && (
            <div className="mt-1.5 text-xs text-[var(--muted)]">
              طريقة الدفع: <b className="text-[var(--text)]">{PAYMENT_METHOD_META[inv.payMethod].icon} {PAYMENT_METHOD_META[inv.payMethod].label}</b>
            </div>
          )}
          {remaining > 0 && (
            <button
              onClick={() => setShowPayModal(true)}
              className="btn-brand mt-3 w-full rounded-xl py-2.5 text-sm font-bold"
            >
              💵 تسجيل دفعة
            </button>
          )}
          {/* Payment history */}
          {(inv.payments || []).length > 0 && (
            <div className="mt-3 border-t border-[var(--border)] pt-2">
              <div className="mb-1.5 text-xs font-bold text-[var(--muted)]">🧾 سجل الدفعات ({inv.payments.length})</div>
              <div className="space-y-1.5">
                {[...inv.payments].sort((a, b) => b.date - a.date).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-400">+ {p.amount.toLocaleString('en-US')} {currencySymbol(inv.currency)}</span>
                      <span className="text-[var(--muted)]"> · {new Date(p.date).toLocaleDateString('en-US')}</span>
                      {p.note && <span className="text-[var(--muted)]"> · {p.note}</span>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handlePrintReceipt(p.id)}
                        disabled={printingReceipt === p.id}
                        className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] font-bold text-[var(--muted)] hover:bg-white/10 transition-colors disabled:opacity-60"
                        title="طباعة سند قبض/دفع"
                      >
                        {printingReceipt === p.id ? '⏳' : '🖨️ سند'}
                      </button>
                      <button
                        onClick={() => setPendingVoidId(p.id)}
                        className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-[var(--danger)] hover:bg-red-500/20 transition-colors"
                        title="التراجع عن هذه الدفعة"
                      >
                        ↩️ تراجع
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 mt-8 flex items-end justify-between gap-3">
          <div className="text-xs text-[var(--muted)]">صدرت عبر تطبيق فواتيري 🧾</div>
          <div className="flex items-end gap-4">
            {qrUrl && (
              <div className="text-center">
                <img src={qrUrl} className="h-16 w-16 rounded-lg bg-white p-1" alt="رمز التحقق" />
                <div className="mt-1 text-[10px] text-[var(--muted)]">امسح للتحقق</div>
              </div>
            )}
            {meta.company.signature && (
              <div className="text-center">
                <img src={meta.company.signature} className="max-h-16 max-w-40 rounded-lg bg-white p-1" alt="التوقيع" />
                <div className="mt-1 border-t border-[var(--border)] pt-1 text-xs text-[var(--muted)]">التوقيع</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          invoice={inv}
          meta={meta}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayModal}
        invoice={inv}
        onConfirm={handleRecordPayment}
        onClose={() => setShowPayModal(false)}
      />

      {/* Credit Modal */}
      {onCreateCredit && (
        <CreditModal
          isOpen={showCreditModal}
          invoice={inv}
          onConfirm={handleCreateCredit}
          onClose={() => setShowCreditModal(false)}
        />
      )}

      {/* Attachment lightbox */}
      {showAttachment && inv.attachment && (
        <div
          onClick={() => setShowAttachment(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <img
            src={inv.attachment}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, objectFit: 'contain' }}
            alt="مرفق الفاتورة مكبر"
          />
          <button
            onClick={() => setShowAttachment(false)}
            aria-label="إغلاق"
            style={{
              position: 'fixed', top: 16, left: 16,
              width: 40, height: 40, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 18, cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Void payment confirm */}
      <DeleteConfirmModal
        isOpen={pendingVoidId != null}
        title="التراجع عن الدفعة"
        itemName={pendingVoidEntry ? `دفعة ${pendingVoidEntry.amount.toLocaleString('en-US')} ${currencySymbol(inv.currency)}` : undefined}
        itemMeta={pendingVoidEntry ? `${new Date(pendingVoidEntry.date).toLocaleDateString('en-US')}${pendingVoidEntry.note ? ` · ${pendingVoidEntry.note}` : ''}` : undefined}
        message="سيتم حذف هذه الدفعة من السجل وإعادة حساب المتبقي. هل تريد المتابعة؟"
        confirmLabel="نعم، تراجع عن الدفعة"
        cancelLabel="إلغاء"
        onConfirm={confirmVoidPayment}
        onCancel={() => setPendingVoidId(null)}
      />

      {/* Delete Confirmation Modal — مخصص للحذف */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        title="نقل الفاتورة إلى السلة"
        itemName={`فاتورة #${invNum} — "${inv.party}"`}
        itemMeta={`${inv.total.toLocaleString('en-US')} ${currencySymbol(inv.currency)} · ${credit ? 'إشعار دائن' : isSale ? 'بيع' : 'شراء'}`}
        message="سيتم نقل هذه الفاتورة إلى سلة المحذوفات ويمكن استعادتها خلال 30 يوماً من الإعدادات."
        confirmLabel="نعم، انقل إلى السلة"
        cancelLabel="تراجع"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  )
}
