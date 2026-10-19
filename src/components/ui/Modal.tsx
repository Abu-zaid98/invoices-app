import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

/* قفل تمرير الخلفية مع عدّاد عالمي — يمنع تعارض المودالات المتتابعة */
let lockCount = 0
let savedOverflow = ''
let savedPadLeft = ''
let savedPadRight = ''

function lockScroll() {
  if (lockCount === 0) {
    const body = document.body
    const gap = window.innerWidth - document.documentElement.clientWidth
    // نكتشف جهة شريط التمرير فعلياً (يسار في RTL، يمين في LTR) بدل افتراض الاتجاه
    const scrollbarOnLeft = body.getBoundingClientRect().left > 0.5
    savedOverflow = body.style.overflow
    savedPadLeft = body.style.paddingLeft
    savedPadRight = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (gap > 0) {
      if (scrollbarOnLeft) body.style.paddingLeft = `${gap}px`
      else body.style.paddingRight = `${gap}px`
    }
  }
  lockCount++
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow
    document.body.style.paddingLeft = savedPadLeft
    document.body.style.paddingRight = savedPadRight
  }
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  open: boolean
  onClose: () => void
  /** عنوان واضح يظهر في رأس النافذة */
  title?: ReactNode
  /** وصف مختصر أسفل العنوان */
  description?: ReactNode
  /** أيقونة دائرية في الرأس (تُفعِّل التوسيط تلقائياً) */
  icon?: ReactNode
  /** مظهر الأيقونة: danger/warning/info/success/violet */
  iconTone?: 'danger' | 'warning' | 'info' | 'success' | 'violet'
  /** المحتوى القابل للتمرير */
  children?: ReactNode
  /** شريط الإجراءات الثابت أسفل النافذة */
  footer?: ReactNode
  /** صفّ الإجراءات أفقياً بدل التكديس */
  footRow?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'center' | 'sheet'
  align?: 'start' | 'center'
  role?: 'dialog' | 'alertdialog'
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  showClose?: boolean
  /** أثناء تنفيذ عملية: يمنع الإغلاق العرضي */
  busy?: boolean
  /** إظهار المقبض العلوي للـ Bottom Sheet */
  grabber?: boolean
  className?: string
}

/**
 * Modal — النافذة الموحّدة لكل التطبيق.
 * - Bottom Sheet على الهاتف، نافذة متمركزة على الشاشات الأكبر.
 * - Portal إلى body (لا تتأثر بالحاويات الأب أو transform/overflow).
 * - قفل تمرير الخلفية مع تعويض عرض شريط التمرير (بلا قفزات).
 * - حصر التركيز داخل النافذة وإعادته للعنصر المُشغِّل عند الإغلاق.
 * - Escape/النقر خارج النافذة، مع السماح بمنعهما أثناء العمليات.
 * - ارتفاع محسوب بـ dvh + Safe Areas + تمرير داخلي للأجسام الطويلة.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  iconTone = 'info',
  children,
  footer,
  footRow = false,
  size = 'md',
  variant = 'center',
  align,
  role = 'dialog',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showClose = true,
  busy = false,
  grabber = false,
  className = '',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const uid = useId()
  const titleId = `${uid}-title`
  const descId = `${uid}-desc`

  const isCentered = (align ?? (icon ? 'center' : 'start')) === 'center'

  /* نُبقي أحدث القيم في refs كي لا يُعاد تشغيل تأثير الفتح/القفل عند كل render
     (المُشغِّل يمرّر onClose كـ arrow function جديد في كل مرة)، مما كان يسبب
     إعادة قفل التمرير وارتداد التركيز أثناء الكتابة داخل النافذة. */
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)
  const closeOnEscapeRef = useRef(closeOnEscape)
  onCloseRef.current = onClose
  busyRef.current = busy
  closeOnEscapeRef.current = closeOnEscape

  const requestClose = useCallback(() => {
    if (busyRef.current) return
    onCloseRef.current()
  }, [])

  /* قفل التمرير + حصر التركيز + استعادة التركيز */
  useEffect(() => {
    if (!open) return
    restoreRef.current = (document.activeElement as HTMLElement) ?? null
    lockScroll()

    const panel = panelRef.current
    const focusFirst = () => {
      if (!panel) return
      const preferred = panel.querySelector<HTMLElement>('[data-autofocus]')
      const target =
        preferred ??
        panel.querySelector<HTMLElement>(FOCUSABLE) ??
        panel
      target.focus({ preventScroll: true })
    }
    const raf = window.requestAnimationFrame(focusFirst)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscapeRef.current) {
        // لا تُغلق النافذة إذا كانت قائمة اختيار مخصّصة مفتوحة (Escape يغلقها هي أولًا)
        if (document.querySelector('.select-menu')) return
        e.preventDefault()
        requestClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === panel,
      )
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    /* على الهاتف مع لوحة المفاتيح: أبقِ الحقل المركّز ظاهراً */
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || !panel?.contains(t)) return
      window.setTimeout(() => {
        if (!panel.contains(t)) return
        const rect = t.getBoundingClientRect()
        const vv = window.visualViewport
        const viewportBottom = vv ? vv.height : window.innerHeight
        if (rect.bottom > viewportBottom - 12) {
          t.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      }, 220)
    }
    panel?.addEventListener('focusin', onFocusIn)

    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown, true)
      panel?.removeEventListener('focusin', onFocusIn)
      unlockScroll()
      const restore = restoreRef.current
      if (restore && document.contains(restore)) {
        window.setTimeout(() => restore.focus({ preventScroll: true }), 0)
      }
    }
  }, [open])

  if (!open) return null

  const panelClass = [
    'modal-panel',
    variant === 'sheet' ? 'modal-panel--sheet' : 'modal-panel--center',
    variant !== 'sheet' && size === 'sm' ? 'modal-panel--sm' : '',
    variant !== 'sheet' && size === 'lg' ? 'modal-panel--lg' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <div className={`modal-root modal-root--${variant}`}>
      <div
        className={`modal-backdrop ${variant === 'sheet' ? 'modal-backdrop--light' : ''}`}
        onClick={closeOnBackdrop ? requestClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={panelClass}
        style={{ outline: 'none' }}
      >
        {(grabber || variant === 'sheet') && <div className="modal-grabber" />}

        {(title || icon) && (
          <div className={`modal-head ${isCentered ? 'modal-head--center' : ''}`}>
            {icon && (
              <div className={`modal-icon modal-icon--${iconTone}`} aria-hidden="true">
                {icon}
              </div>
            )}
            {(title || description) && (
              <div className="modal-head-text" style={isCentered ? { textAlign: 'center' } : undefined}>
                {title && (
                  <h2 id={titleId} className="modal-title">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="modal-desc">
                    {description}
                  </p>
                )}
              </div>
            )}
            {showClose && !isCentered && (
              <button type="button" className="modal-close" onClick={requestClose} aria-label="إغلاق">
                <Icon name="x" />
              </button>
            )}
          </div>
        )}

        {children && <div className="modal-body">{children}</div>}
        {footer && <div className={`modal-foot ${footRow ? 'modal-foot--row' : ''}`}>{footer}</div>}

        {showClose && isCentered && (
          <button
            type="button"
            className="modal-close"
            onClick={requestClose}
            aria-label="إغلاق"
            style={{ position: 'absolute', top: 14, insetInlineEnd: 14 }}
          >
            <Icon name="x" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
