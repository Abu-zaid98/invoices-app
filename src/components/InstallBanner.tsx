import { useState } from 'react'
import { usePWAInstall } from '../lib/usePWAInstall'

/**
 * InstallBanner — بانر تثبيت PWA
 * - أندرويد/Chrome: زر تثبيت مباشر عبر beforeinstallprompt
 * - iPhone: خطوات يدوية (مشاركة → إضافة إلى الشاشة الرئيسية)
 * - يبرز: العمل دون إنترنت + البيانات محلية على الجهاز + قفل PIN
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
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
            animation: 'fadeIn .18s ease',
          }}
        />
        <div
          role="dialog" aria-modal="true" aria-label="تثبيت على iPhone"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)', zIndex: 71,
            width: 'calc(100% - 40px)', maxWidth: 380,
            background: 'linear-gradient(160deg,#16213a,#0d1526)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24,
            padding: '28px 22px 22px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            animation: 'confirmSlideUp .22s cubic-bezier(.34,1.56,.64,1)',
            direction: 'rtl', textAlign: 'right',
          }}
        >
          <div style={{ textAlign: 'center', fontSize: 40, marginBottom: 10 }}>📲</div>
          <h3 style={{ fontSize: 17, fontWeight: 900, color: '#f0f4ff', textAlign: 'center', marginBottom: 14 }}>
            التثبيت على iPhone
          </h3>
          {[
            ['1️⃣', 'اضغط زر المشاركة في شريط سفاري (مربع بسهم للأعلى)'],
            ['2️⃣', 'اختر «إضافة إلى الشاشة الرئيسية»'],
            ['3️⃣', 'اضغط «إضافة» وستجد أيقونة التطبيق بجانب تطبيقاتك'],
          ].map(([n, t]) => (
            <div key={n} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '10px 12px', marginBottom: 8,
              fontSize: 13, color: '#cbd5e1', lineHeight: 1.7,
            }}>
              <span>{n}</span><span>{t}</span>
            </div>
          ))}
          <div style={{
            fontSize: 12, color: '#8b96ab', textAlign: 'center',
            margin: '12px 0 16px', lineHeight: 1.8,
          }}>
            🔒 بياناتك تبقى على جهازك (IndexedDB) وتعمل دون إنترنت بعد أول تحميل
          </div>
          <button
            onClick={() => { setShowIOSHelp(false); dismiss() }}
            style={{
              width: '100%', padding: '13px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,var(--brand),var(--brand2))',
              color: '#1a1200', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            فهمت، شكراً
          </button>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
          @keyframes confirmSlideUp { from { opacity:0; transform:translate(-50%,-44%) } to { opacity:1; transform:translate(-50%,-50%) } }
        `}</style>
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
        background: 'linear-gradient(160deg,#1a2340,#0d1526)',
        border: '1px solid rgba(255,176,32,0.35)',
        borderRadius: 20, padding: '14px 14px 12px',
        boxShadow: '0 18px 50px rgba(0,0,0,0.55), 0 0 30px rgba(255,176,32,0.12)',
        animation: 'installUp .3s cubic-bezier(.34,1.4,.64,1)',
        direction: 'rtl',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <img
            src="icon-192.png" alt="أيقونة التطبيق"
            style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: '#fff' }}>
              📲 ثبّت التطبيق على هاتفك
            </div>
            <div style={{ fontSize: 12, color: '#9aa5b8', lineHeight: 1.7, marginTop: 2 }}>
              وصول سريع من الشاشة الرئيسية · يعمل دون إنترنت · 🔒 بياناتك على جهازك فقط
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="إغلاق"
            style={{
              background: 'transparent', border: 'none', color: '#8b96ab',
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
              flex: 1, padding: '11px', borderRadius: 12, border: 'none',
              background: (busy || (!canNativePrompt && !isIOS))
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg,var(--brand),var(--brand2))',
              color: (busy || (!canNativePrompt && !isIOS)) ? '#8b96ab' : '#1a1200',
              fontSize: 14, fontWeight: 800,
              cursor: (busy || (!canNativePrompt && !isIOS)) ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'جارٍ...' : isIOS ? 'طريقة التثبيت 📲' : '⬇️ تثبيت الآن'}
          </button>
          <button
            onClick={dismiss}
            style={{
              padding: '11px 18px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#8b96ab', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            لاحقاً
          </button>
        </div>
      </div>
      <style>{`
        @keyframes installUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  )
}
