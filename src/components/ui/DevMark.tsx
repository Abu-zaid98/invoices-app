interface DevMarkProps {
  /** طول ضلع الشعار بالبكسل */
  size?: number
  /** أنصاف الأقطار (افتراضياً ~32% من المقاس) */
  radius?: number
  /** الأحرف داخل الشعار (افتراضياً MJ) */
  label?: string
  /** رابط صورة شعار جاهزة — إن مُرِّر تُستخدَم بدل الأحرف */
  src?: string
  /** وصف بديل عند استخدام صورة */
  alt?: string
  className?: string
}

/**
 * DevMark — شعار المطوّر (اختصار الاسم بخط ثقيل داخل مربّع متدرّج).
 *
 * لماذا لا نستخدم أيقونة سند رقيقة هنا؟ لأن الشعار يجب أن «يدلّ على شيء»
 * ويُقرأ من النظرة الأولى كعلامة شخصية، لا كعنصر ديكوري باهت.
 * وإن توفّرت صورة شعار حقيقية، مرّر `src` فتُستخدَم مباشرة.
 */
export default function DevMark({
  size = 52,
  radius,
  label = 'MJ',
  src,
  alt = 'شعار المطوّر',
  className = '',
}: DevMarkProps) {
  const r = radius ?? Math.round(size * 0.32)

  if (src) {
    return (
      <img
        className={`dev-mark dev-mark--img ${className}`.trim()}
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: r }}
      />
    )
  }

  return (
    <span
      className={`dev-mark ${className}`.trim()}
      style={{ width: size, height: size, borderRadius: r, fontSize: Math.round(size * 0.34) }}
      aria-hidden="true"
    >
      <span className="dev-mark-txt">{label}</span>
    </span>
  )
}
