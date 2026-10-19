/**
 * أدوات تنسيق موحّدة (التاريخ) — وحدة نقية بلا أي اعتماديات،
 * تُستخدَم في الواجهة + الطباعة + PDF/PNG + التصدير لضمان صيغة واحدة.
 *
 * الصيغة المعتمدة: DD/MM/YYYY بالأرقام اللاتينية (مثال: 19/10/2026).
 */

export const WEEKDAYS_AR = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
] as const

/** أسماء مختصرة لأيام الأسبوع — لرأس شبكة منتقي التاريخ */
export const WEEKDAYS_AR_SHORT = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'] as const

/** أسماء الأشهر الميلادية بالعربية — بالترتيب (يناير = 0) */
export const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** DD/MM/YYYY */
export function formatDate(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** YYYY-MM-DD (قيمة حقول التاريخ) → DD/MM/YYYY */
export function formatISODate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return '—'
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** تاريخ اليوم بصيغة YYYY-MM-DD */
export function isoToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** DD/MM/YYYY — HH:mm */
export function formatDateTime(ts: number | null | undefined): string {
  if (ts == null) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatDate(ts)} — ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** يوم الأسبوع + التاريخ الرقمي لليوم الحالي */
export function todayLabel(now: Date = new Date()): { weekday: string; date: string } {
  return { weekday: WEEKDAYS_AR[now.getDay()], date: formatDate(now.getTime()) }
}
