interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  ariaLabel?: string
}

/**
 * Select مخصص للثيم الغامق:
 * سهم مخصص، توهج عند التركيز، وخيارات بخلفية داكنة.
 */
export default function Select({ value, onChange, options, ariaLabel }: Props) {
  return (
    <span className="select-wrap">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className="select-box"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="select-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
