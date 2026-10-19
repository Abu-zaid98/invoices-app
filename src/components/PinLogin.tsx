import { useEffect, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import ConfirmModal from './ConfirmModal'
import DeveloperSignature from './DeveloperSignature'
import BrandMark from './ui/BrandMark'
import Icon from './ui/Icon'

const LOCK_KEY = 'pin-lockout'
const MAX_FREE_TRIES = 5

interface LockState {
  fail: number
  until: number
}

function readLock(): LockState {
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { fail: Number(p.fail) || 0, until: Number(p.until) || 0 }
    }
  } catch {
    /* ignore */
  }
  return { fail: 0, until: 0 }
}

function writeLock(s: LockState) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** مدة القفل التصاعدية بالمللي ثانية حسب عدد الإخفاقات */
function backoffMs(fail: number): number {
  if (fail <= MAX_FREE_TRIES) return 0
  const step = fail - MAX_FREE_TRIES
  const minutes = Math.min(15, Math.pow(2, step - 1))
  return minutes * 60 * 1000
}

function fmtWait(ms: number): string {
  const s = Math.ceil(ms / 1000)
  if (s < 60) return `${s} ثانية`
  const m = Math.ceil(s / 60)
  return `${m} ${m === 1 ? 'دقيقة' : 'دقائق'}`
}

export default function PinLogin({ onUnlock }: { onUnlock: () => void }) {
  const { meta, updateMeta } = useAppData()
  const { toast } = useToast()
  const [buffer, setBuffer] = useState('')
  const [stage, setStage] = useState<'setup1' | 'setup2' | 'login'>(meta.pin ? 'login' : 'setup1')
  const [tempPin, setTempPin] = useState('')
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [lock, setLock] = useState<LockState>(() => readLock())
  const [now, setNow] = useState(Date.now())

  const lockedMs = Math.max(0, lock.until - now)
  const locked = lockedMs > 0

  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [locked])

  function press(key: string) {
    if (locked) return
    if (key === 'clear') return setBuffer('')
    if (key === 'back') return setBuffer((b) => b.slice(0, -1))
    setBuffer((b) => (b.length < 8 ? b + key : b))
  }

  /** تبديل الثيم متاح قبل الدخول — تُحفظ القيمة في بيانات التطبيق كالمعتاد */
  function toggleTheme() {
    updateMeta('theme', meta.theme === 'light' ? 'dark' : 'light').catch(() => {})
  }

  async function confirm() {
    if (locked) return toast(`الدخول مقفل مؤقتاً — حاول بعد ${fmtWait(lockedMs)}`, 'danger')
    if (buffer.length < 4) return toast('الرمز يجب أن يكون ٤ أرقام على الأقل', 'danger')
    if (!meta.pin) {
      if (stage === 'setup1') {
        setTempPin(buffer)
        setBuffer('')
        setStage('setup2')
        return
      }
      if (buffer !== tempPin) {
        toast('الرمزان غير متطابقين، حاول مجددًا', 'danger')
        setBuffer('')
        setTempPin('')
        setStage('setup1')
        return
      }
      await updateMeta('pin', tempPin)
      toast('تم تعيين رمز الدخول بنجاح')
      onUnlock()
      return
    }
    if (buffer === meta.pin) {
      writeLock({ fail: 0, until: 0 })
      setLock({ fail: 0, until: 0 })
      onUnlock()
    } else {
      const fail = lock.fail + 1
      const wait = backoffMs(fail)
      const next: LockState = { fail, until: wait > 0 ? Date.now() + wait : 0 }
      writeLock(next)
      setLock(next)
      setNow(Date.now())
      if (wait > 0) {
        toast(`محاولات خاطئة متكررة — مقفل لمدة ${fmtWait(wait)}`, 'danger')
      } else {
        toast(`رمز غير صحيح (محاولة ${fail}/${MAX_FREE_TRIES})`, 'danger')
      }
      setBuffer('')
    }
  }

  async function confirmForgot() {
    await updateMeta('pin', null)
    setBuffer('')
    setTempPin('')
    setStage('setup1')
    setShowForgotModal(false)
    writeLock({ fail: 0, until: 0 })
    setLock({ fail: 0, until: 0 })
    toast('يمكنك الآن تعيين رمز جديد')
  }

  const dotsLen = Math.max(4, buffer.length)

  const title = stage === 'setup2' ? 'أعد إدخال الرمز للتأكيد' : meta.pin ? 'أدخل رمز الدخول' : 'أنشئ رمز الدخول'
  const subtitle = stage === 'setup2' ? 'الخطوة الثانية — تأكيد الرمز' : 'رمز رقمي من ٤ أرقام أو أكثر'
  const isLight = meta.theme === 'light'

  return (
    <div
      className="stack animate-in"
      style={{
        position: 'relative',
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(28px + env(safe-area-inset-top, 0px)) 24px calc(28px + env(safe-area-inset-bottom, 0px))',
        textAlign: 'center',
      }}
    >
      <button
        type="button"
        className="icon-btn pin-theme"
        onClick={toggleTheme}
        aria-label={isLight ? 'التبديل للوضع الداكن' : 'التبديل للوضع الفاتح'}
        title={isLight ? 'الوضع الداكن' : 'الوضع الفاتح'}
      >
        <Icon name={isLight ? 'moon' : 'sun'} />
      </button>

      <span className="app-logo" style={{ width: 76, height: 76, borderRadius: 24, margin: '0 auto 6px' }}>
        <BrandMark size={36} style={{ width: 36, height: 36 }} />
      </span>

      <div>
        <h2 className="t-title" style={{ margin: 0 }}>
          {title}
        </h2>
        <p className="t-sub" style={{ marginTop: 4 }}>
          {subtitle}
        </p>
      </div>

      {locked ? (
        <div
          className="card card--pad"
          style={{ background: 'var(--danger-soft)', borderColor: 'transparent', color: 'var(--danger)', width: 'min(320px, 88vw)' }}
        >
          <div className="inline" style={{ justifyContent: 'center', fontWeight: 700 }}>
            <Icon name="lock" size={18} />
            مقفل مؤقتاً لحمايتك
          </div>
          <div className="amount-lg" style={{ marginTop: 4 }}>
            حاول بعد {fmtWait(lockedMs)}
          </div>
        </div>
      ) : (
        <div
          className="inline"
          style={{ justifyContent: 'center', gap: 12, minHeight: 24 }}
          role="status"
          aria-label={`${buffer.length} من الأرقام مُدخلة`}
        >
          {Array.from({ length: dotsLen }).map((_, i) => (
            <span key={i} className="pin-dot" data-on={i < buffer.length} />
          ))}
        </div>
      )}

      <div className="keypad" role="group" aria-label="لوحة الأرقام" dir="ltr">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            className="keypad-key keypad-key--num"
            onClick={() => press(String(n))}
            disabled={locked}
            aria-label={`الرقم ${n}`}
          >
            <span lang="en">{n}</span>
          </button>
        ))}
        <button
          type="button"
          className="keypad-key keypad-key--clear"
          onClick={() => press('clear')}
          disabled={locked}
          aria-label="مسح الكل"
        >
          C
        </button>
        <button
          type="button"
          className="keypad-key keypad-key--num"
          onClick={() => press('0')}
          disabled={locked}
          aria-label="الرقم 0"
        >
          <span lang="en">0</span>
        </button>
        <button type="button" className="keypad-key keypad-key--danger" onClick={() => press('back')} disabled={locked} aria-label="حذف رقم" title="حذف رقم واحد">
          <Icon name="delete" size={22} />
        </button>
      </div>

      <button
        type="button"
        className="btn btn--primary btn--lg"
        style={{ width: 'min(300px, 86vw)' }}
        onClick={confirm}
        disabled={locked}
      >
        <Icon name="check" />
        تأكيد
      </button>

      {meta.pin && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowForgotModal(true)}>
          نسيت الرمز؟ إعادة التعيين
        </button>
      )}

      <DeveloperSignature />

      <ConfirmModal
        isOpen={showForgotModal}
        variant="warning"
        icon={<Icon name="key" />}
        title="إعادة تعيين رمز الدخول؟"
        message="سيتم مسح رمز الدخول الحالي وستتمكن من تعيين رمز جديد. فواتيرك وبياناتك محفوظة ولن تُمس. هل تريد المتابعة؟"
        confirmLabel="نعم، إعادة التعيين"
        cancelLabel="تراجع"
        onConfirm={confirmForgot}
        onCancel={() => setShowForgotModal(false)}
      />
    </div>
  )
}
