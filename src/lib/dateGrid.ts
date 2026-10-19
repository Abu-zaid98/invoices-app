/**
 * حسابات التقويم النقية لمنتقي التاريخ — وحدة بلا أي اعتماديات (ولا DOM)،
 * فتُختبر وحدها وتُستخدَم من الواجهة فقط.
 *
 * كل التعاملات بالتاريخ المحلي (وليس UTC) حتى لا ينزاح اليوم في المناطق
 * الزمنية المختلفة.
 */

/** أول عمود في الشبكة: الأحد — مطابق لترتيب WEEKDAYS_AR */
export const WEEK_START = 0
/** عدد خلايا الشبكة: 6 أسابيع تكفي دائماً لعرض أي شهر كاملاً */
export const GRID_CELLS = 42

export type CalendarView = 'days' | 'months' | 'years'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD من كائن تاريخ محلي */
export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** تحويل YYYY-MM-DD إلى تاريخ محلي (null إذا كانت الصيغة غير صحيحة) */
export function parseISO(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  // يرفض تواريخ غير موجودة مثل 2026-02-31 (تُصحّح تلقائياً إلى مارس)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * شبكة الشهر: 42 خلية تبدأ من الأحد الذي يسبق/يوافق أول الشهر،
 * فتشمل دائماً كل أيام الشهر مع أيام مجاورة لإكمال الأسابيع.
 */
export function buildMonthGrid(year: number, month: number, cells: number = GRID_CELLS): Date[] {
  const offset = (new Date(year, month, 1).getDay() - WEEK_START + 7) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: cells }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

/** نافذة السنوات المعروضة في عرض «السنة» (12 سنة تبدأ من مضاعف 12) */
export function buildYearWindow(year: number, size = 12): number[] {
  const base = Math.floor(year / 12) * 12
  return Array.from({ length: size }, (_, i) => base + i)
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1)
}
