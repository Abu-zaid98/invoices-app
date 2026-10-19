import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant =
  | 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'success'
  | 'tint-danger' | 'tint-brand' | 'tint-violet'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  /** أيقونة تُعرض قبل النص */
  icon?: ReactNode
  loading?: boolean
  children?: ReactNode
}

/** زر موحّد يعتمد على نظام التصميم (.btn) — يضمن أحجام لمس وحالات متطابقة */
export default function Button({
  variant = 'soft',
  size = 'md',
  block = false,
  icon,
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 17,
        height: 17,
        border: '2.4px solid rgba(255,255,255,0.35)',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        animation: 'spin .7s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}
