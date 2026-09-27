import { useCallback, useEffect, useRef, useState } from 'react'

/** حدث التثبيت الذي يطلقه المتصفح (Chrome / Edge / Samsung) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed-at'
const COOLDOWN_DAYS = 7

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true
  if (document.referrer.startsWith('android-app://')) return true
  return false
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function cooldownActive(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!at) return false
    return Date.now() - at < COOLDOWN_DAYS * 24 * 3600 * 1000
  } catch {
    return false
  }
}

export function usePWAInstall(autoDelayMs = 2500) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => isStandalone())
  const [visible, setVisible] = useState(false)
  const ios = isIOS()
  const timer = useRef<number | null>(null)

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setVisible(false)
      setDeferred(null)
    }
    function onDisplayChange(e: MediaQueryListEvent) {
      if (e.matches) {
        setInstalled(true)
        setVisible(false)
      }
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    const mq = window.matchMedia?.('(display-mode: standalone)')
    mq?.addEventListener?.('change', onDisplayChange)
    if (isStandalone()) setInstalled(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      mq?.removeEventListener?.('change', onDisplayChange)
    }
  }, [])

  // إظهار تلقائي مرة واحدة بعد مهلة — إذا لم يكن مثبتاً ولم يرفض مؤخراً
  useEffect(() => {
    if (installed || cooldownActive()) return
    // على أندرويد ننتظر حدث beforeinstallprompt، وعلى iOS نظهر مباشرة
    if (!ios && !deferred) return
    timer.current = window.setTimeout(() => setVisible(true), autoDelayMs)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [installed, deferred, ios, autoDelayMs])

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }, [])

  const openManual = useCallback(() => setVisible(true), [])

  /** يُرجع true إذا تم التثبيت، و'ios' إذا يجب عرض تعليمات يدوية */
  const install = useCallback(async (): Promise<true | 'ios' | false> => {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setInstalled(true)
        setVisible(false)
        setDeferred(null)
        return true
      }
      dismiss()
      return false
    }
    if (ios) return 'ios' // البانر سيعرض خطوات iOS
    return false
  }, [deferred, ios, dismiss])

  return {
    visible: visible && !installed,
    installed,
    isIOS: ios,
    canNativePrompt: !!deferred,
    install,
    dismiss,
    openManual,
    setVisible,
  }
}
