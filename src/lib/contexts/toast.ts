import { createContext } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastContextValue {
  toast: (message: string, kind?: 'success' | 'danger', action?: ToastAction) => void
}

/**
 * سياق الإشعارات — موضوع في وحدة مستقلّة عن المزوّد **عن قصد**.
 *
 * السبب: HMR في وضع التطوير يُعيد تنفيذ وحدةٍ ما عند تغيّر أي من تبعياتها.
 * و`useToast.tsx` يستورد `Icon`، فأي تعديل على `Icon.tsx` كان يُعيد تنفيذ
 * `useToast.tsx` ويُنشئ **سياقاً جديداً**، بينما `ToastProvider` المثبَّت في
 * الشجرة ما زال يحمل السياق القديم → يُصبح `useContext` فارغاً ويرمي:
 * «useToast must be used within ToastProvider».
 *
 * بإبقاء `createContext` هنا (وحدة لا تستورد شيئاً سوى React) تبقى هوية
 * السياق ثابتة مهما تغيّرت وحدات المزوّد أو تبعياتها، فيختفي هذا الخطأ كلياً.
 */
export const ToastContext = createContext<ToastContextValue | null>(null)
