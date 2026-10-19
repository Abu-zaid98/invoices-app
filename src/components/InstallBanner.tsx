import { useState } from 'react'
import { usePWAInstall } from '../lib/usePWAInstall'
import Modal from './ui/Modal'
import Icon from './ui/Icon'

const IOS_STEPS = [
  'افتح التطبيق من متصفح سفاري (Safari) على الآيفون.',
  'اضغط زر المشاركة ⬆️ في شريط سفاري السفلي.',
  'اختر «إضافة إلى الشاشة الرئيسية».',
  'اضغط «إضافة» — ستظهر أيقونة التطبيق بين تطبيقاتك.',
]

const ANDROID_STEPS = [
  'افتح التطبيق من متصفح Chrome (لا من داخل تطبيقات التواصل).',
  'اضغط قائمة النقاط الثلاث ⋮ أعلى المتصفح.',
  'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
  'اضغط «تثبيت» — ستظهر أيقونة التطبيق على شاشتك.',
]

/**
 * إشعار تثبيت التطبيق (يظهر عند فتح التطبيق على الجوال)
 * - أندرويد + Chrome: زر تثبيت مباشر عبر نافذة المتصفح.
 * - بدونه أو على iPhone: خطوات التثبيت اليدوية داخل نافذة.
 */
export default function InstallBanner() {
  const { visible, isIOS, canNativePrompt, install, dismiss } = usePWAInstall()
  const [showHelp, setShowHelp] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleInstall() {
    setBusy(true)
    try {
      const res = await install()
      if (res !== true) setShowHelp(true)
    } finally {
      setBusy(false)
    }
  }

  const steps = isIOS ? IOS_STEPS : ANDROID_STEPS
  const buttonLabel = isIOS || !canNativePrompt ? 'طريقة التثبيت' : 'تثبيت الآن'

  return (
    <>
      <Modal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        variant="center"
        size="sm"
        align="center"
        title={isIOS ? 'التثبيت على iPhone' : 'التثبيت على Android'}
        icon={<Icon name="download" />}
        iconTone="info"
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => { setShowHelp(false); dismiss() }}
          >
            فهمت، شكراً
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {steps.map((t, i) => (
            <div key={i} className="modal-note" style={{ justifyContent: 'flex-start', fontWeight: 500, alignItems: 'flex-start' }}>
              <span className="step-num">{i + 1}</span>
              <span>{t}</span>
            </div>
          ))}
          <p className="hint" style={{ textAlign: 'center', marginTop: 4 }}>
            🔒 بياناتك تبقى على جهازك (IndexedDB) وتعمل دون إنترنت بعد أول تحميل
          </p>
        </div>
      </Modal>

      {visible && (
        <div className="pwa-toast pwa-toast--brand" role="dialog" aria-label="تثبيت التطبيق">
          <div className="pwa-toast-head">
            <span className="pwa-toast-icon">
              <Icon name="download" />
            </span>
            <div className="pwa-toast-main">
              <div className="pwa-toast-title">ثبّت التطبيق على هاتفك</div>
              <div className="pwa-toast-sub">وصول سريع من الشاشة الرئيسية · يعمل دون إنترنت</div>
            </div>
            <button type="button" className="pwa-toast-x" onClick={dismiss} aria-label="إغلاق">
              <Icon name="x" />
            </button>
          </div>
          <div className="pwa-toast-actions">
            <button type="button" className="btn btn--sm pwa-toast-btn" onClick={handleInstall} disabled={busy}>
              <Icon name="download" size={15} />
              {busy ? 'جارٍ...' : buttonLabel}
            </button>
            <button type="button" className="btn btn--sm pwa-toast-ghost" onClick={dismiss}>
              لاحقاً
            </button>
          </div>
        </div>
      )}
    </>
  )
}
