import { useEffect, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import { currencySymbol, invoiceBalance, isOverdue, PAYMENT_META, PAYMENT_METHOD_META, calcTotals } from '../lib/types'
import { exportReceiptPDF } from '../lib/printInvoice'
import { formatDate } from '../lib/format'
import { shareInvoicePdf } from '../lib/invoicePdf'
import { getInvoiceQR } from '../lib/qr'
import ExportModal from '../components/ExportModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import PaymentModal from '../components/PaymentModal'
import CreditModal from '../components/CreditModal'
import Modal from '../components/ui/Modal'
import Icon from '../components/ui/Icon'

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

  if (!inv) {
    return (
      <div className="stack">
        <div className="page-head">
          <button type="button" className="icon-btn icon-btn--ghost" onClick={onBack} aria-label="رجوع">
            <Icon name="arrowRight" />
          </button>
          <span className="t-heading">الفاتورة</span>
          <span style={{ width: 40 }} aria-hidden="true" />
        </div>
        <div className="card card--flush">
          <div className="empty">
            <span className="empty-icon">
              <Icon name="alert" />
            </span>
            <div className="empty-title">الفاتورة غير موجودة</div>
          </div>
        </div>
      </div>
    )
  }

  const isSale = inv.type === 'sale'
  const credit = inv.type === 'credit'
  const creditSale = (inv.creditKind ?? 'sale') === 'sale'
  const invNum = String(inv.id).padStart(4, '0')
  const remaining = invoiceBalance(inv)
  const overdue = isOverdue(inv)
  const payMeta = PAYMENT_META[inv.paymentStatus ?? 'unpaid']
  const payPct = inv.total > 0 ? Math.min(100, ((inv.paidAmount || 0) / inv.total) * 100) : 0
  const bt = calcTotals(inv.items, inv.discountType ?? null, inv.discountValue || 0, inv.taxPercent || 0)

  const typeIcon = credit ? 'refresh' : isSale ? 'upload' : 'download'
  const typeLabel = credit ? (creditSale ? 'إشعار دائن' : 'مرتجع مشتريات') : isSale ? 'بيع' : 'شراء'

  async function confirmDelete() {
    const id = inv!.id
    await trashInvoice(id)
    setShowDeleteModal(false)
    toast('نُقلت الفاتورة إلى سلة المحذوفات', 'danger', {
      label: 'تراجع',
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
    toast('تم التراجع عن الدفعة')
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
    <div className="stack detail-doc">
      {/* Top bar */}
      <div className="page-head print:hidden">
        <button type="button" className="icon-btn icon-btn--ghost" onClick={onBack} aria-label="رجوع">
          <Icon name="arrowRight" />
        </button>
        <div className="grow" style={{ textAlign: 'center' }}>
          <div className="t-heading">فاتورة #{invNum}</div>
          <div className="t-caption">{typeLabel}</div>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowDeleteModal(true)}
          aria-label="حذف الفاتورة"
          style={{ color: 'var(--danger)' }}
        >
          <Icon name="trash" />
        </button>
      </div>

      {/* Action bar — يلتف بدل أن يُخفي أي زر على الشاشات الصغيرة */}
      <div className="action-bar print:hidden">
        {!credit && (
          <>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onEdit(inv.id)}>
              <Icon name="pencil" size={16} />
              تعديل
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => onDuplicate(inv.id)} title="إنشاء نسخة جديدة برقم جديد">
              <Icon name="copy" size={16} />
              تكرار
            </button>
            {onCreateCredit && (
              <button
                type="button"
                className="btn btn--tint-violet btn--sm"
                onClick={() => setShowCreditModal(true)}
                title="إنشاء إشعار دائن/مرتجع مرتبط بهذه الفاتورة"
              >
                <Icon name="refresh" size={16} />
                مرتجع
              </button>
            )}
          </>
        )}
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowExport(true)} title="تصدير PDF / PNG">
          <Icon name="download" size={16} />
          تصدير
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={handleShare} disabled={sharing} title="مشاركة الفاتورة">
          <Icon name="share" size={16} />
          {sharing ? 'جارٍ...' : 'مشاركة'}
        </button>
      </div>

      {/* Invoice preview card */}
      <div id="invoice-print-area" className="card card--pad">
        {/* Header row */}
        <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="inline" style={{ alignItems: 'flex-start' }}>
            {meta.company.logo && (
              <img src={meta.company.logo} alt="الشعار" style={{ maxHeight: 48, maxWidth: 96, borderRadius: 10, background: '#fff', padding: 4 }} />
            )}
            <div>
              <h2 className="brand-text" style={{ margin: 0, fontSize: 18, fontWeight: 850 }}>
                {meta.company.name || 'اسم الشركة'}
              </h2>
              <p className="t-sub" style={{ marginTop: 2 }}>
                فاتورة رقم <b style={{ color: 'var(--text)' }}>#{invNum}</b>
                {' — '}
                {formatDate(inv.date)}
              </p>
            </div>
          </div>
          <span
            className={`badge ${credit ? 'badge--violet' : isSale ? 'badge--success' : 'badge--warning'}`}
            style={{ padding: '6px 14px', fontSize: 12.5 }}
          >
            <Icon name={typeIcon} size={15} />
            {typeLabel}
          </span>
        </div>

        {/* Linked invoice (for credits) */}
        {credit && inv.linkedId != null && onOpenInvoice && (
          <button
            type="button"
            onClick={() => onOpenInvoice(inv.linkedId!)}
            className="row-between btn btn--secondary"
            style={{ width: '100%', marginTop: 14, minHeight: 46, borderRadius: 'var(--radius-md)' }}
          >
            <span className="inline-row" style={{ fontWeight: 700, color: 'var(--violet)' }}>
              <Icon name="refresh" size={16} />
              مرتبط بالفاتورة #{String(inv.linkedId).padStart(4, '0')}
            </span>
            <Icon name="chevronLeft" size={16} style={{ color: 'var(--muted)' }} />
          </button>
        )}

        {/* Party */}
        <p style={{ marginTop: 14, fontSize: 14 }}>
          <span style={{ color: 'var(--muted)' }}>{isSale ? 'العميل' : 'المورد'}:</span>{' '}
          {onOpenParty ? (
            <button
              type="button"
              onClick={() => onOpenParty(inv.party)}
              style={{ border: 0, background: 'none', padding: 0, color: 'var(--brand)', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 4 }}
              title="عرض كشف الحساب"
            >
              {inv.party}
            </button>
          ) : (
            <span style={{ fontWeight: 700 }}>{inv.party}</span>
          )}
        </p>

        {/* Items table */}
        <div className="table-scroll" style={{ marginTop: 14 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>الصنف</th>
                <th style={{ textAlign: 'center' }}>الكمية</th>
                <th style={{ textAlign: 'center' }}>السعر</th>
                <th style={{ textAlign: 'left' }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, idx) => (
                <tr key={idx}>
                  <td>
                    <span className="item-index">{idx + 1}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 650 }}>{it.name}</div>
                    {it.specs && <div className="t-caption">{it.specs}</div>}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{it.qty}</td>
                  <td className="amount" style={{ textAlign: 'center', fontWeight: 600 }}>
                    {it.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="amount" style={{ textAlign: 'left', color: 'var(--accent)' }}>
                    {(it.qty * it.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals breakdown */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 18 }}>
          <div style={{ width: '100%', maxWidth: 300, padding: '14px 18px', borderRadius: 'var(--radius-lg)', background: 'var(--total-bg)', border: '1px solid var(--total-border)' }}>
            <div className="row-between" style={{ fontSize: 12.5 }}>
              <span style={{ color: 'var(--muted)' }}>المجموع الفرعي</span>
              <span className="amount" style={{ fontWeight: 700 }}>
                {bt.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}
              </span>
            </div>
            {bt.discountAmount > 0 && (
              <div className="row-between" style={{ fontSize: 12.5, marginTop: 6 }}>
                <span style={{ color: 'var(--muted)' }}>
                  الخصم{inv.discountType === 'percent' ? ` (${inv.discountValue}%)` : ''}
                </span>
                <span className="amount" style={{ color: 'var(--success)' }}>
                  − {bt.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}
                </span>
              </div>
            )}
            {bt.taxAmount > 0 && (
              <div className="row-between" style={{ fontSize: 12.5, marginTop: 6 }}>
                <span style={{ color: 'var(--muted)' }}>الضريبة ({inv.taxPercent}%)</span>
                <span className="amount">+ {bt.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}</span>
              </div>
            )}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--total-border)' }}>
              <div className="t-caption" style={{ marginBottom: 4 }}>الإجمالي الكلي</div>
              <div className="accent-text amount-lg" style={{ fontSize: 22 }}>
                {inv.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currencySymbol(inv.currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="modal-note" style={{ marginTop: 16, flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <span className="field-label">
              <Icon name="pencil" size={14} />
              ملاحظات
            </span>
            <span style={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>{inv.notes}</span>
          </div>
        )}

        {/* Default terms */}
        {meta.defaultTerms && (
          <div
            style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--dashed)', background: 'var(--warning-soft)',
            }}
          >
            <div className="field-label" style={{ marginBottom: 4 }}>
              <Icon name="file" size={14} />
              الشروط والأحكام
            </div>
            <div className="hint" style={{ lineHeight: 1.9, whiteSpace: 'pre-line' }}>{meta.defaultTerms}</div>
          </div>
        )}

        {/* Attachment */}
        {inv.attachment && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card-2)' }}>
            <div className="field-label" style={{ marginBottom: 8 }}>
              <Icon name="image" size={14} />
              المرفق (صورة إشعار الحوالة)
            </div>
            <img
              src={inv.attachment}
              onClick={() => setShowAttachment(true)}
              style={{ maxHeight: 160, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'contain', cursor: 'zoom-in' }}
              alt="مرفق الفاتورة"
              title="اضغط للعرض المكبر"
            />
          </div>
        )}

        {/* Payment status card */}
        <div style={{ marginTop: 16, padding: 14, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--overlay-soft)' }}>
          <div className="row-between" style={{ flexWrap: 'wrap' }}>
            <span className={`badge ${inv.paymentStatus === 'paid' ? 'badge--success' : inv.paymentStatus === 'partial' ? 'badge--warning' : 'badge--danger'}`}>
              {payMeta.label}
            </span>
            {overdue ? (
              <span className="badge badge--danger">
                متأخرة منذ {formatDate(inv.dueDate!)}
              </span>
            ) : inv.dueDate != null && remaining > 0 ? (
              <span className="t-caption">الاستحقاق: {formatDate(inv.dueDate)}</span>
            ) : null}
          </div>

          <div className="progress-track" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${payPct}%` }} />
          </div>
          <div className="row-between" style={{ marginTop: 8, fontSize: 12.5 }}>
            <span style={{ color: 'var(--muted)' }}>
              المدفوع: <b className="amount" style={{ color: 'var(--success)' }}>{(inv.paidAmount || 0).toLocaleString('en-US')} {currencySymbol(inv.currency)}</b>
            </span>
            <span style={{ color: 'var(--muted)' }}>
              المتبقي: <b className="amount" style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--success)' }}>{remaining.toLocaleString('en-US')} {currencySymbol(inv.currency)}</b>
            </span>
          </div>
          {inv.payMethod && (
            <div className="t-caption" style={{ marginTop: 6 }}>
              طريقة الدفع: <b style={{ color: 'var(--text)' }}>{PAYMENT_METHOD_META[inv.payMethod].label}</b>
            </div>
          )}
          {remaining > 0 && (
            <button type="button" onClick={() => setShowPayModal(true)} className="btn btn--primary btn--block" style={{ marginTop: 12 }}>
              <Icon name="cash" />
              تسجيل دفعة
            </button>
          )}

          {/* Payment history */}
          {(inv.payments || []).length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--separator)' }}>
              <div className="field-label" style={{ marginBottom: 8 }}>
                <Icon name="receipt" size={14} />
                سجل الدفعات ({inv.payments.length})
              </div>
              <div className="pay-list">
                {[...inv.payments].sort((a, b) => b.date - a.date).map((p) => (
                  <div key={p.id} className="pay-item">
                    <div className="pay-item-main">
                      <div className="pay-item-amount">
                        + {p.amount.toLocaleString('en-US')} <span>{currencySymbol(inv.currency)}</span>
                      </div>
                      <div className="pay-item-meta">
                        {formatDate(p.date)}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                    </div>
                    <div className="pay-item-actions">
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(p.id)}
                        disabled={printingReceipt === p.id}
                        className="btn btn--secondary btn--sm"
                        title="طباعة سند قبض/دفع"
                      >
                        <Icon name="printer" size={15} />
                        سند
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingVoidId(p.id)}
                        className="btn btn--tint-danger btn--sm"
                        title="التراجع عن هذه الدفعة"
                      >
                        <Icon name="refresh" size={15} />
                        تراجع
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="row-between" style={{ alignItems: 'flex-end', marginTop: 26 }}>
          <div className="t-caption">صدرت عبر تطبيق فواتيري</div>
          <div className="inline" style={{ alignItems: 'flex-end', gap: 16 }}>
            {qrUrl && (
              <div style={{ textAlign: 'center' }}>
                <img src={qrUrl} style={{ height: 64, width: 64, borderRadius: 10, background: '#fff', padding: 4 }} alt="رمز التحقق" />
                <div className="t-caption" style={{ marginTop: 4 }}>امسح للتحقق</div>
              </div>
            )}
            {meta.company.signature && (
              <div style={{ textAlign: 'center' }}>
                <img src={meta.company.signature} style={{ maxHeight: 64, maxWidth: 160, borderRadius: 10, background: '#fff', padding: 4 }} alt="التوقيع" />
                <div className="t-caption" style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>التوقيع</div>
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
      <Modal
        open={showAttachment && !!inv.attachment}
        onClose={() => setShowAttachment(false)}
        variant="center"
        size="lg"
        align="center"
        title="المرفق"
      >
        {inv.attachment && (
          <img
            src={inv.attachment}
            style={{ maxWidth: '100%', maxHeight: '60dvh', borderRadius: 12, objectFit: 'contain', display: 'block', margin: '0 auto' }}
            alt="مرفق الفاتورة مكبر"
          />
        )}
      </Modal>

      {/* Void payment confirm */}
      <DeleteConfirmModal
        isOpen={pendingVoidId != null}
        title="التراجع عن الدفعة"
        itemName={pendingVoidEntry ? `دفعة ${pendingVoidEntry.amount.toLocaleString('en-US')} ${currencySymbol(inv.currency)}` : undefined}
        itemMeta={pendingVoidEntry ? `${formatDate(pendingVoidEntry.date)}${pendingVoidEntry.note ? ` · ${pendingVoidEntry.note}` : ''}` : undefined}
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
