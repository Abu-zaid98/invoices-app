import type { ReactNode } from 'react'
import Modal from './ui/Modal'
import Icon from './ui/Icon'

interface Props {
  isOpen: boolean
  variant?: 'danger' | 'warning' | 'info'
  /** أيقونة مخصصة (اختياري) — وإلا تُشتق من النوع */
  icon?: ReactNode
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  /** منع الإغلاق أثناء عملية جارية */
  busy?: boolean
}

const TONE: Record<NonNullable<Props['variant']>, { icon: 'alert' | 'info'; tone: 'danger' | 'warning' | 'info'; confirm: 'danger' | 'primary' }> = {
  danger: { icon: 'alert', tone: 'danger', confirm: 'danger' },
  warning: { icon: 'alert', tone: 'warning', confirm: 'primary' },
  info: { icon: 'info', tone: 'info', confirm: 'primary' },
}

/** نافذة تأكيد بسيطة: عنوان مباشر + وصف مختصر + زرّان واضحان */
export default function ConfirmModal({
  isOpen,
  variant = 'danger',
  icon,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  const v = TONE[variant]

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
      description={message}
      icon={icon ?? <Icon name={v.icon} />}
      iconTone={v.tone}
      footer={
        <>
          <button
            type="button"
            data-autofocus
            className={`btn btn--block ${v.confirm === 'danger' ? 'btn--danger' : 'btn--primary'}`}
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
    />
  )
}
