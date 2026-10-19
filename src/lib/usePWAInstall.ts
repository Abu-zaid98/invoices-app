import { useCallback, useEffect, useRef, useState } from 'react'

/** حدث التثبيت الذي يطلقه المتصفح (Chrome / Edge / Samsung) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PWAPlatform = 'ios' | 'android' | 'desktop'

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

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function detectPlatform(): PWAPlatform {
  if (typeof navigator === 'undefined') return 'desktop'
  if (isIOSDevice()) return 'ios'
  if (/android|harmonyos/i.test(navigator.userAgent)) return 'android'
  // بعض المتصفحات على الهاتف لا تُعلن عن النظام بوضوح
  if (/mobile/i.test(navigator.userAgent)) return 'android'
  return 'desktop'
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

/**
 * منطق تثبيت PWA.
 * - أندرويد: زر تثبيت أصلي عبر beforeinstallprompt، وإن لم يتوفر نعرض خطوات يدوية.
 * - iPhone: خطوات يدوية (سفاري ← إضافة إلى الشاشة الرئيسية).
 * - الحاسوب: لا إظهار تلقائي (متاح يدوياً من الإعدادات).
 */
export function usePWAInstall(autoDelayMs = 2200) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(() => isStandalone())
  const [visible, setVisible] = useState(false)
  const platform = detectPlatform()
  const ios = platform === 'ios'
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

  // إظهار تلقائي مرة واحدة عند فتح التطبيق (الجوال فقط، وما لم يُثبَّت أو يُرفض مؤخراً)
  useEffect(() => {
    if (installed) return
    if (platform === 'desktop') return
    if (cooldownActive()) return
    timer.current = window.setTimeout(() => {
      // قد يكون المستخدم أغلق الإشعار قبل انتهاء المهلة
      if (!cooldownActive()) setVisible(true)
    }, autoDelayMs)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [installed, platform, autoDelayMs])

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }, [])

  const openManual = useCallback(() => setVisible(true), [])

  const close = useCallback(() => setVisible(false), [])

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
    platform,
    canNativePrompt: !!deferred,
    install,
    dismiss,
    close,
    openManual,
    setVisible,
  }
}
