import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  message: string
  kind: 'success' | 'danger'
  action?: ToastAction
}

interface ToastContextValue {
  toast: (message: string, kind?: 'success' | 'danger', action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const toast = useCallback((message: string, kind: 'success' | 'danger' = 'success', action?: ToastAction) => {
    const id = ++counter
    setItems((prev) => [...prev, { id, message, kind, action }])
    // مهلة أطول عند وجود زر إجراء (تراجع)
    setTimeout(() => dismiss(id), action ? 6000 : 2500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-24 left-0 right-0 z-[999] flex flex-col items-center gap-2 pointer-events-none">
        {items.map((i) => (
          <div
            key={i.id}
            className={`pointer-events-auto flex max-w-[92%] items-center gap-3 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-xl ${
              i.kind === 'danger'
                ? 'bg-gradient-to-br from-red-500/95 to-red-700/95'
                : 'bg-gradient-to-br from-emerald-500/95 to-blue-500/95'
            }`}
          >
            <span>
              {i.kind === 'danger' ? '⚠️ ' : '✅ '}
              {i.message}
            </span>
            {i.action && (
              <button
                onClick={() => {
                  i.action!.onClick()
                  dismiss(i.id)
                }}
                className="shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-black hover:bg-white/30 transition-colors"
                style={{ fontFamily: 'inherit' }}
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
