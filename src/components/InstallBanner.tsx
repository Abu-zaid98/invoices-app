import { useState } from 'react'
import { usePWAInstall } from '../lib/usePWAInstall'

/**
 * InstallBanner — بانر تثبيت PWA — تصميم Apple
 * - أندرويد/Chrome: زر تثبيت مباشر عبر beforeinstallprompt
 * - iPhone: خطوات يدوية (مشاركة → إضافة إلى الشاشة الرئيسية)
 */
export default function InstallBanner() {
  const { visible, isIOS, canNativePrompt, install, dismiss } = usePWAInstall()
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!visible && !showIOSHelp) return null

  async function handleInstall() {
    setBusy(true)
    try {
      const res = await install()
      if (res === 'ios') setShowIOSHelp(true)
    } finally {
      setBusy(false)
    }
  }

  // ─── نافذة تعليمات iOS ───
  if (showIOSHelp) {
    return (
      <>
        <div
          onClick={() => setShowIOSHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn .2s ease',
          }}
        />
        <div
          role="dialog" aria-modal="true" aria-label="تثبيت على iPhone"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', zIndex: 71,
            width: 'calc(100% - 48px)', maxWidth: 340,
            background: 'var(--modal-bg)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '0.5px solid var(--separator)', borderRadius: '20px',
            padding: '28px 20px 20px',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.08)',
            animation: 'scaleIn .25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            direction: 'rtl', textAlign: 'right',
          }}
        >
          <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 10 }}>📲</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', textAlign: 'center', marginBottom: 14 }}>
            التثبيت على iPhone
          </h3>
          {[
            ['1️⃣', 'اضغط زر المشاركة في شريط سفاري (مربع بسهم للأعلى)'],
            ['2️⃣', 'اختر «إضافة إلى الشاشة الرئيسية»'],
            ['3️⃣', 'اضغط «إضافة» وستجد أيقونة التطبيق بجانب تطبيقاتك'],
          ].map(([n, t]) => (
            <div key={n} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              background: 'rgba(0, 122, 255, 0.06)',
              border: '0.5px solid rgba(0, 122, 255, 0.15)',
              borderRadius: '12px', padding: '10px 12px', marginBottom: 8,
              fontSize: 13, fontWeight: 500, color: 'var(--text)', lineHeight: 1.7,
            }}>
              <span>{n}</span><span>{t}</span>
            </div>
          ))}
          <div style={{
            fontSize: 12, color: 'var(--muted)', textAlign: 'center',
            margin: '12px 0 16px', lineHeight: 1.8, fontWeight: 400,
          }}>
            🔒 بياناتك تبقى على جهازك (IndexedDB) وتعمل دون إنترنت بعد أول تحميل
          </div>
          <button
            onClick={() => { setShowIOSHelp(false); dismiss() }}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: '#007AFF', color: '#fff', fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.01em', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 122, 255, 0.25)',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            فهمت، شكراً
          </button>
        </div>
      </>
    )
  }

  // ─── البانر الرئيسي ───
  return (
    <div
      role="dialog" aria-label="تثبيت التطبيق"
      style={{
        position: 'fixed', bottom: 86, left: 0, right: 0, zIndex: 55,
        display: 'flex', justifyContent: 'center', padding: '0 16px',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        pointerEvents: 'auto',
        width: '100%', maxWidth: 508,
        background: 'var(--modal-bg)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '0.5px solid var(--separator)',
        borderRadius: '20px', padding: '14px 16px 12px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.06)',
        animation: 'slideUp .3s cubic-bezier(0.34, 1.4, 0.64, 1)',
        direction: 'rtl',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <img
            src="icon-192.png" alt="أيقونة التطبيق"
            style={{ width: 52, height: 52, borderRadius: '14px', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              📲 ثبّت التطبيق على هاتفك
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 2, fontWeight: 400 }}>
              وصول سريع من الشاشة الرئيسية · يعمل دون إنترنت · 🔒 بياناتك على جهازك فقط
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="إغلاق"
            style={{
              background: 'transparent', border: 'none', color: 'var(--muted)',
              fontSize: 16, cursor: 'pointer', padding: 4, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleInstall}
            disabled={busy || (!canNativePrompt && !isIOS)}
            title={!canNativePrompt && !isIOS ? 'افتح من متصفح الهاتف (Chrome) لرؤية زر التثبيت' : 'تثبيت التطبيق'}
            style={{
              flex: 1, padding: '11px', borderRadius: '12px', border: 'none',
              background: (busy || (!canNativePrompt && !isIOS))
                ? 'var(--separator)'
                : '#007AFF',
              color: (busy || (!canNativePrompt && !isIOS)) ? 'var(--muted)' : '#fff',
              fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
              cursor: (busy || (!canNativePrompt && !isIOS)) ? 'default' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: (busy || (!canNativePrompt && !isIOS)) ? 'none' : '0 2px 8px rgba(0, 122, 255, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {busy ? 'جارٍ...' : isIOS ? 'طريقة التثبيت 📲' : '⬇️ تثبيت الآن'}
          </button>
          <button
            onClick={dismiss}
            style={{
              padding: '11px 18px', borderRadius: '12px',
              border: '0.5px solid var(--separator)', background: 'var(--modal-field)',
              color: 'var(--text)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  )
}
