import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './ui/Icon'

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  ariaLabel?: string
  disabled?: boolean
  placeholder?: string
}

/**
 * قائمة اختيار مخصّصة بالكامل (ليست <select> النظام):
 * زر + قائمة منبثقة في Portal (لا تُقصّ داخل النوافذ/الحاويات)،
 * مع دعم لوحة المفاتيح، والإغلاق بالنقر خارجها أو بمفتاح Escape،
 * وانفتاح لأعلى عند ضيق المساحة أسفل — متوافقة مع RTL والوضع الداكن.
 */
export default function Select({ value, onChange, options, ariaLabel, disabled, placeholder = 'اختر…' }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number; width: number; maxH: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  function computePos() {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    const gap = 6
    const below = vh - r.bottom - gap - 8
    const above = r.top - gap - 8
    const openUp = below < 190 && above > below
    const width = Math.max(180, Math.min(r.width, r.right - 8))
    setPos({
      ...(openUp ? { bottom: vh - r.top + gap } : { top: r.bottom + gap }),
      right: Math.max(8, window.innerWidth - r.right),
      width,
      maxH: Math.max(150, Math.min(320, openUp ? above : below)),
    })
  }

  function openMenu() {
    if (disabled || options.length === 0) return
    computePos()
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }

  function close(refocus = false) {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  function pick(v: string | undefined) {
    if (v == null || v === value) return close(true)
    onChange(v)
    close(true)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(true)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(options.length - 1, a + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setActive(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setActive(options.length - 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        pick(options[active]?.value)
      } else if (e.key === 'Tab') {
        close()
      }
    }
    function onReposition() {
      computePos()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, active, options, value])

  // إبقاء الخيار النشِط داخل مجال الرؤية
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            openMenu()
          }
        }}
      >
        <span className="sel-value">{selected?.label ?? placeholder}</span>
        <Icon name="chevronDown" size={16} className="sel-chevron" />
      </button>

      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            className="select-menu"
            role="listbox"
            aria-label={ariaLabel}
            style={{ top: pos.top, bottom: pos.bottom, right: pos.right, width: pos.width, maxHeight: pos.maxH }}
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                data-idx={i}
                role="option"
                aria-selected={o.value === value}
                className="select-option"
                data-active={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
              >
                <span className="so-label">{o.label}</span>
                {o.value === value && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
