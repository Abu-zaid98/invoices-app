import { useEffect, useRef, useState } from 'react'

interface Props {
  isOpen: boolean
  initialSignature?: string
  onSave: (dataUrl: string) => void
  onClose: () => void
}

const PEN_COLORS = [
  { value: '#111827', label: 'أسود' },
  { value: '#1e40af', label: 'أزرق' },
  { value: '#0f766e', label: 'أخضر' },
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

  // Esc + lock scroll
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

  // Init canvas size + load existing signature for editing
  useEffect(() => {
    if (!isOpen) return
    // wait a tick so container has width
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
          // fit image inside canvas with padding
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

  // Apply pen settings live
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
      // store at CSS-pixel size (unscaled) — need to handle dpr transform:
      // simplest: save full backing store
      const dpr = window.devicePixelRatio || 1
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      void dpr
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
    // dot for tap
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
    // re-apply dpr scale for future strokes
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

  /** قص الحواف الشفافة حتى يكون التوقيع مدمجاً ويظهر بحجم مناسب في الفاتورة */
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
    if (maxX < 0) return null // blank
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
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'fadeIn .18s ease',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="التوقيع بخط اليد"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 61,
          width: 'calc(100% - 32px)', maxWidth: 420,
          background: 'linear-gradient(160deg,#16213a,#0d1526)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24, padding: '24px 20px 20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          animation: 'confirmSlideUp .22s cubic-bezier(.34,1.56,.64,1)',
          direction: 'rtl',
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 900, color: '#f0f4ff', textAlign: 'center', marginBottom: 4 }}>
          ✍️ التوقيع بخط اليد
        </h3>
        <p style={{ fontSize: 12, color: '#8b96ab', textAlign: 'center', marginBottom: 14 }}>
          وقّع بإصبعك أو بقلم الشاشة داخل المربع الأبيض
        </p>

        {/* Canvas */}
        <div ref={wrapRef} style={{ width: '100%' }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
            style={{
              display: 'block',
              width: '100%',
              height: CANVAS_H,
              background: '#fff',
              borderRadius: 16,
              border: '1.5px dashed rgba(255,176,32,0.5)',
              touchAction: 'none',
              cursor: 'crosshair',
            }}
          />
        </div>
        {!hasDrawn && (
          <div style={{
            textAlign: 'center', fontSize: 12, color: 'rgba(0,0,0,0.35)',
            marginTop: -CANVAS_H + 80, marginBottom: CANVAS_H - 95,
            pointerEvents: 'none', height: 0,
          }}>
            ✍️ وقّع هنا
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 10, fontSize: 12.5, fontWeight: 700, color: '#ff8a8e',
            background: 'rgba(255,90,95,0.1)', border: '1px solid rgba(255,90,95,0.3)',
            borderRadius: 10, padding: '7px 12px', textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Pen options */}
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
                  border: penColor === c.value ? '2.5px solid var(--brand)' : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  boxShadow: penColor === c.value ? '0 0 10px var(--brand)' : 'none',
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
                  width: 34, height: 30, borderRadius: 9,
                  border: penWidth === w ? '1.5px solid var(--brand)' : '1px solid rgba(255,255,255,0.15)',
                  background: penWidth === w ? 'rgba(255,176,32,0.15)' : 'rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ width: 18, height: w, borderRadius: 99, background: '#fff' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              flex: 1, padding: '10px', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: canUndo ? '#cbd5e1' : '#5b6678',
              fontSize: 13, fontWeight: 700, cursor: canUndo ? 'pointer' : 'default',
              fontFamily: 'inherit', opacity: canUndo ? 1 : 0.6,
            }}
          >
            ↩️ تراجع
          </button>
          <button
            onClick={handleClear}
            style={{
              flex: 1, padding: '10px', borderRadius: 12,
              border: '1px solid rgba(255,90,95,0.35)',
              background: 'rgba(255,90,95,0.1)',
              color: '#ff8a8e', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🧹 مسح
          </button>
        </div>

        {/* Save / cancel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <button
            onClick={handleSave}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg,var(--brand),var(--brand2))',
              color: '#1a1200', fontSize: 15, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(255,176,32,0.35)',
              fontFamily: 'inherit',
            }}
          >
            💾 حفظ التوقيع
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#8b96ab', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes confirmSlideUp { from { opacity:0; transform:translate(-50%,-44%) } to { opacity:1; transform:translate(-50%,-50%) } }
      `}</style>
    </>
  )
}
