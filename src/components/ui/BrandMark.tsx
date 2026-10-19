import type { CSSProperties } from 'react'

interface BrandMarkProps {
  /** ارتفاع/عرض الرمز بالبكسل (يُتجاهل إن مُرِّر style) */
  size?: number
  className?: string
  style?: CSSProperties
  /** إظهار الأحرف MJ داخل الرمز (تصبح باهتة تلقائياً في المقاسات الصغيرة) */
  monogram?: boolean
}

/**
 * BrandMark — رمز العلامة الرسمي للتطبيق: «فاتورة/سند» بحدّ سفلي مسنّن
 * (نفس أسلوب أيقونات التطبيق: خط 1.7، currentColor) مع الأحرف MJ بشكل
 * صغير خفيف داخل الرمز.
 *
 * يُستخدَم في شريط التطبيق، وفي العلامة المائية للفاتورة (نسخة ممتلئة)،
 * وفي أيقونات التطبيق (public/icon-*.png).
 */
export default function BrandMark({ size = 24, className, style, monogram = true }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* جسم السند بحدّ سفلي مسنّن */}
      <path d="M6.1 3.6A2 2 0 0 1 8.1 1.7h7.8a2 2 0 0 1 2 1.9v17.1l-1.95-1.25-1.95 1.25-1.95-1.25L10.1 20.7 8.15 19.45 6.1 20.7z" />
      {/* أسطر المحتوى */}
      <path d="M8.7 6.5h6.6M8.7 9.4h6.6" />
      {/* الأحرف MJ — صغيرة وخافتة */}
      {monogram && (
        <text
          x="12"
          y="15.9"
          textAnchor="middle"
          fontSize="5.2"
          fontWeight="700"
          letterSpacing="-0.2"
          fill="currentColor"
          stroke="none"
          opacity="0.7"
          style={{ fontFamily: 'Cairo, system-ui, sans-serif' }}
        >
          MJ
        </text>
      )}
    </svg>
  )
}
