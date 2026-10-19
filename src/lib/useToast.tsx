import { useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import Icon from '../components/ui/Icon'
import { ToastContext, type ToastAction, type ToastContextValue } from './contexts/toast'

export type { ToastAction, ToastContextValue }

interface ToastItem {
  id: number
  message: string
  kind: 'success' | 'danger'
  action?: ToastAction
}

let counter = 0

/** مدد العرض — قصيرة قدر الإمكان بلا فقدان المعنى */
const DURATION = 2200
const DURATION_ACTION = 5000
/** أقصى عدد إشعارات ظاهرة في وقت واحد */
const MAX_TOASTS = 3

/**
 * ToastProvider — إشعارات مختصرة.
 * - رسالة مكررة أثناء ظهورها لا تُضاعف (تُمدَّد مدتها فقط) لتقليل الضجيج.
 * - حدّ أعلى 3 إشعارات، والأقدم يُزال تلقائياً.
 * - أخطاء/تنبيهات بلا حدّ (kind='danger' لا تُدمج مع success).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, number>())
  /** نص الرسالة → رقم الإشعار الظاهر (لمنع التكرار) */
  const live = useRef(new Map<string, number>())

  const remove = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) {
      window.clearTimeout(t)
      timers.current.delete(id)
    }
    for (const [msg, tid] of live.current) {
      if (tid === id) live.current.delete(msg)
    }
    setItems((prev) => (prev.some((i) => i.id === id) ? prev.filter((i) => i.id !== id) : prev))
  }, [])

  const scheduleDismiss = useCallback(
    (id: number, ms: number) => {
      const t = window.setTimeout(() => remove(id), ms)
      timers.current.set(id, t)
    },
    [remove],
  )

  const toast = useCallback(
    (message: string, kind: 'success' | 'danger' = 'success', action?: ToastAction) => {
      const duration = action ? DURATION_ACTION : DURATION

      // رسالة مطابقة ظاهرة الآن → لا تُضاف مرة أخرى، نُجدّد مدتها فقط
      const existing = live.current.get(message)
      if (existing != null) {
        const t = timers.current.get(existing)
        if (t) window.clearTimeout(t)
        scheduleDismiss(existing, duration)
        return
      }

      const id = ++counter
      live.current.set(message, id)
      setItems((prev) => {
        const next = [...prev, { id, message, kind, action }]
        if (next.length > MAX_TOASTS) {
          const overflow = next.splice(0, next.length - MAX_TOASTS)
          for (const old of overflow) {
            const t = timers.current.get(old.id)
            if (t) {
              window.clearTimeout(t)
              timers.current.delete(old.id)
            }
            for (const [msg, tid] of live.current) {
              if (tid === old.id) live.current.delete(msg)
            }
          }
        }
        return next
      })
      scheduleDismiss(id, duration)
    },
    [scheduleDismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast toast--${i.kind}`}>
            <Icon name={i.kind === 'danger' ? 'alert' : 'checkCircle'} />
            <span>{i.message}</span>
            {i.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  i.action!.onClick()
                  remove(i.id)
                }}
              >
                {i.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
