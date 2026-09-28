import { useEffect, useRef, useState } from 'react'

interface Props {
  isOpen: boolean
  initialSignature?: string
  onSave: (dataUrl: string) => void
  onClose: () => void
}

const PEN_COLORS = [
  { value: '#1D1D1F', label: 'أسود' },
  { value: '#007AFF', label: 'أزرق' },
  { value: '#34C759', label: 'أخضر' },
]

const PEN_WIDTHS = [2, 3.5, 5]

const CANVAS_H = 200

export default function SignaturePad({ isOpen, initialSignature, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const undoStack = useRef<ImageData[]>([])

  const [penColor, setPenColor] = useState(PEN_COLORS[0].value)
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1])
  const [hasDrawn, setHasDrawn] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => {
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (!canvas || !wrap) return
      const dpr = window.devicePixelRatio || 1
      const w = wrap.clientWidth
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(CANVAS_H * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${CANVAS_H}px`
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      undoStack.current = []
      setCanUndo(false)
      setHasDrawn(false)
      setError('')

      if (initialSignature) {
        const img = new Image()
        img.onload = () => {
          const pad = 16
          const scale = Math.min((w - pad * 2) / img.width, (CANVAS_H - pad * 2) / img.height)
          const dw = img.width * scale
          const dh = img.height * scale
          ctx.drawImage(img, (w - dw) / 2, (CANVAS_H - dh) / 2, dw, dh)
          setHasDrawn(true)
        }
        img.src = initialSignature
      }
    }, 30)
    return () => clearTimeout(t)
  }, [isOpen, initialSignature])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
  }, [penColor, penWidth, isOpen])

  if (!isOpen) return null

  function pos(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function snapshot(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      undoStack.current.push(img)
      if (undoStack.current.length > 30) undoStack.current.shift()
      setCanUndo(true)
    } catch {
      /* ignore */
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    snapshot(ctx, canvas)
    drawing.current = true
    last.current = pos(e)
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    const p = last.current
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + 0.1, p.y + 0.1)
    ctx.stroke()
    setHasDrawn(true)
    setError('')
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas || !last.current) return
    const ctx = canvas.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  function endStroke() {
    drawing.current = false
    last.current = null
  }

  function handleUndo() {
    const canvas = canvasRef.current
    if (!canvas || undoStack.current.length === 0) return
    const ctx = canvas.getContext('2d')!
    const img = undoStack.current.pop()!
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.putImageData(img, 0, 0)
    ctx.restore()
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setCanUndo(undoStack.current.length > 0)
    if (undoStack.current.length === 0 && !initialSignature) setHasDrawn(false)
  }

  function handleClear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    snapshot(ctx, canvas)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    setHasDrawn(false)
    setError('')
  }

  function trimmedDataURL(): string | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')!
    const { width, height } = canvas
    let data: ImageData
    try {
      data = ctx.getImageData(0, 0, width, height)
    } catch {
      return canvas.toDataURL('image/png')
    }
    let minX = width, minY = height, maxX = -1, maxY = -1
    const d = data.data
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (d[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null
    const pad = Math.floor(12 * (window.devicePixelRatio || 1))
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(width - 1, maxX + pad)
    maxY = Math.min(height - 1, maxY + pad)
    const tw = maxX - minX + 1
    const th = maxY - minY + 1
    const out = document.createElement('canvas')
    out.width = tw
    out.height = th
    const octx = out.getContext('2d')!
    octx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th)
    return out.toDataURL('image/png')
  }

  function handleSave() {
    if (!hasDrawn) {
      setError('يرجى رسم التوقيع أولاً قبل الحفظ')
      return
    }
    const url = trimmedDataURL()
    if (!url) {
      setError('اللوحة فارغة — وقّع بإصبعك أو القلم ثم احفظ')
      return
    }
    onSave(url)
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'fadeIn .2s ease',
        }}
      />
      <div
        role="dialog" aria-modal="true" aria-label="التوقيع بخط اليد"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 61,
          width: 'calc(100% - 48px)', maxWidth: 380,
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '0.5px solid var(--separator)',
          borderRadius: '20px', padding: '24px 20px 20px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.08)',
          animation: 'scaleIn .25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          direction: 'rtl',
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', textAlign: 'center', marginBottom: 4 }}>
          ✍️ التوقيع بخط اليد
        </h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 14, fontWeight: 400 }}>
          وقّع بإصبعك أو بقلم الشاشة داخل المربع الأبيض
        </p>

        <div ref={wrapRef} style={{ width: '100%' }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
            style={{
              display: 'block', width: '100%', height: CANVAS_H,
              background: '#FFFFFF', borderRadius: '14px',
              border: '0.5px solid var(--separator)',
              boxShadow: 'var(--shadow-sm)',
              touchAction: 'none', cursor: 'crosshair',
            }}
          />
        </div>
        {!hasDrawn && (
          <div style={{
            textAlign: 'center', fontSize: 12, color: 'var(--muted)',
            marginTop: -CANVAS_H + 80, marginBottom: CANVAS_H - 95,
            pointerEvents: 'none', height: 0,
          }}>
            ✍️ وقّع هنا
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 10, fontSize: 12.5, fontWeight: 500, color: '#FF3B30',
            background: 'rgba(255, 59, 48, 0.08)', border: '0.5px solid rgba(255, 59, 48, 0.2)',
            borderRadius: '10px', padding: '8px 12px', textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => setPenColor(c.value)}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: c.value,
                  border: penColor === c.value ? '2px solid #007AFF' : '0.5px solid var(--separator)',
                  cursor: 'pointer',
                  boxShadow: penColor === c.value ? '0 0 0 3px rgba(0, 122, 255, 0.15)' : 'none',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setPenWidth(w)}
                title={`سماكة ${w}`}
                style={{
                  width: 34, height: 30, borderRadius: '10px',
                  border: penWidth === w ? '1px solid #007AFF' : '0.5px solid var(--separator)',
                  background: penWidth === w ? 'rgba(0, 122, 255, 0.08)' : 'var(--modal-field)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ width: 18, height: w, borderRadius: 99, background: 'var(--text)' }} />
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              flex: 1, padding: '10px', borderRadius: '12px',
              border: '0.5px solid var(--separator)', background: 'var(--modal-field)',
              color: canUndo ? 'var(--text)' : 'var(--muted)',
              fontSize: 13, fontWeight: 500, cursor: canUndo ? 'pointer' : 'default',
              fontFamily: 'inherit', opacity: canUndo ? 1 : 0.5,
            }}
          >
            ↩️ تراجع
          </button>
          <button
            onClick={handleClear}
            style={{
              flex: 1, padding: '10px', borderRadius: '12px',
              border: '0.5px solid rgba(255, 59, 48, 0.3)', background: 'rgba(255, 59, 48, 0.06)',
              color: '#FF3B30', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🧹 مسح
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: '#007AFF', color: '#fff', fontSize: 15, fontWeight: 600,
              letterSpacing: '-0.01em', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 122, 255, 0.25)',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            💾 حفظ التوقيع
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', borderRadius: '14px',
              border: '0.5px solid var(--separator)', background: 'var(--modal-field)',
              color: 'var(--text)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s ease',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </>
  )
}
