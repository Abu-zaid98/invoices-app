import { useEffect, useState } from 'react'
import { useAppData } from '../lib/AppDataContext'
import { useToast } from '../lib/useToast'
import ConfirmModal from './ConfirmModal'

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
      toast('تم تسجيل الدخول')
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div style={{
        width: 80, height: 80, borderRadius: '22px',
        background: 'linear-gradient(135deg, #007AFF, #5856D6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, color: '#fff', marginBottom: 24,
        boxShadow: '0 8px 24px rgba(0, 122, 255, 0.3)',
      }}>
        🔆
      </div>
      <h2 className="mt-3 text-xl font-bold" style={{ letterSpacing: '-0.02em', color: 'var(--text)' }}>
        {stage === 'setup2' ? 'أعد إدخال الرمز للتأكيد' : meta.pin ? 'أدخل رمز الدخول' : 'أنشئ رمز الدخول'}
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)', fontWeight: 400 }}>رمز رقمي (٤ أرقام أو أكثر)</p>
      {locked ? (
        <div className="my-5 rounded-2xl border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.06)] px-6 py-4 text-sm font-medium" style={{ color: '#FF3B30' }}>
          🔒 مقفل مؤقتاً لحمايتك
          <div className="mt-1 text-lg font-bold">حاول بعد {fmtWait(lockedMs)}</div>
        </div>
      ) : (
        <div className="my-5 flex gap-3">
          {Array.from({ length: dotsLen }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-all ${
                i < buffer.length ? 'scale-110' : ''
              }`}
              style={{
                borderColor: i < buffer.length ? '#007AFF' : 'var(--separator)',
                background: i < buffer.length ? '#007AFF' : 'transparent',
                boxShadow: i < buffer.length ? '0 0 12px rgba(0, 122, 255, 0.4)' : 'none',
              }}
            />
          ))}
        </div>
      )}
      <div className="grid w-[270px] grid-cols-3 gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => press(String(n))}
            className="h-16 rounded-full border text-xl font-medium transition-all active:scale-95"
            style={{
              borderColor: 'var(--separator)',
              background: 'var(--card)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => press('clear')}
          className="h-16 rounded-full border text-sm font-medium transition-all active:scale-95"
          style={{ borderColor: 'var(--separator)', background: 'var(--card)', color: 'var(--muted)', boxShadow: 'var(--shadow-sm)' }}
        >
          مسح
        </button>
        <button
          onClick={() => press('0')}
          className="h-16 rounded-full border text-xl font-medium transition-all active:scale-95"
          style={{ borderColor: 'var(--separator)', background: 'var(--card)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' }}
        >
          0
        </button>
        <button
          onClick={() => press('back')}
          className="h-16 rounded-full border text-xl font-medium transition-all active:scale-95"
          style={{ borderColor: 'var(--separator)', background: 'var(--card)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' }}
        >
          ⌫
        </button>
      </div>
      <button
        onClick={confirm}
        className="mt-4 rounded-full px-8 py-3 text-base font-semibold transition-all active:scale-95"
        style={{
          background: '#007AFF', color: '#fff',
          boxShadow: '0 4px 14px rgba(0, 122, 255, 0.25)',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        تأكيد
      </button>
      {meta.pin && (
        <p onClick={() => setShowForgotModal(true)} className="mt-4 cursor-pointer text-sm" style={{ color: 'var(--muted)', fontWeight: 400 }}>
          نسيت الرمز؟ إعادة التعيين
        </p>
      )}

      <ConfirmModal
        isOpen={showForgotModal}
        variant="warning"
        icon="🔑"
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
