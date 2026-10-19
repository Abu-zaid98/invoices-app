import Modal from './ui/Modal'
import Icon from './ui/Icon'

/**
 * DeleteConfirmModal — تأكيد إجراء خطير/حذف.
 * يميّز الخطر بصرياً، ويوضح العنصر المتأثر قبل التنفيذ.
 */
interface Props {
  isOpen: boolean
  title?: string
  itemName?: string
  itemMeta?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

export default function DeleteConfirmModal({
  isOpen,
  title = 'حذف نهائي؟',
  itemName,
  itemMeta,
  message = 'هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.',
  confirmLabel = 'نعم، احذف نهائياً',
  cancelLabel = 'تراجع',
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  return (
    <Modal
      open={isOpen}
      onClose={onCancel}
      role="alertdialog"
      variant="center"
      size="sm"
      align="center"
      busy={busy}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      title={title}
      icon={<Icon name="trash" />}
      iconTone="danger"
      footer={
        <>
          <button
            type="button"
            data-autofocus
            className="btn btn--danger btn--block"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
          <button type="button" className="btn btn--secondary btn--block" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        </>
      }
    >
      {(itemName || itemMeta) && (
        <div className="modal-note modal-note--danger" style={{ flexDirection: 'column', gap: 2, textAlign: 'center', marginBottom: 12 }}>
          {itemName && <span style={{ fontWeight: 750 }}>{itemName}</span>}
          {itemMeta && <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 500 }}>{itemMeta}</span>}
        </div>
      )}
      <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
        {message}
      </p>
    </Modal>
  )
}
