import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './ui/Icon'
import Modal from './ui/Modal'
import { MONTHS_AR, WEEKDAYS_AR, WEEKDAYS_AR_SHORT, formatDate, formatISODate, isoToday } from '../lib/format'
import { addDays, addMonths, buildMonthGrid, buildYearWindow, isoOf, parseISO, sameDay, type CalendarView } from '../lib/dateGrid'

interface Props {
  /** التاريخ بصيغة YYYY-MM-DD، والقيمة الفارغة '' تعني «بلا تاريخ» */
  value: string
  onChange: (value: string) => void
  id?: string
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  /** إظهار أزرار مسح التاريخ (زر داخل الحقل + داخل النافذة) */
  clearable?: boolean
}

/**
 * DatePicker — منتقي تاريخ مخصّص بالكامل (بديل <input type="date">).
 *
 * - الحقل زر بشكل حقول الإدخال نفسه (نفس المقاسات والألوان والتركيز).
 * - النافذة: Bottom Sheet على الهاتف ونافذة متمركزة على الشاشات الكبيرة (عبر Modal الموحّد)
 *   فترث قفل التمرير وحصر التركيز والإغلاق بـ Escape/النقر خارجها و Safe Areas.
 * - تقويم عربي RTL: الأسبوع يبدأ بالأحد (العمود الأيمن) وأسماء الأشهر بالعربية.
 * - تنقّل بالأسهم داخل الشبكة (تركيز مُتدرّج Tab مرة واحدة)، وتنقّل بالشهر/السنة/العقد.
 * - الأرقام لاتينية دائماً (tabular-nums) كباقي التطبيق.
 * - الاختيار مؤقّت حتى «تأكيد»، و«إلغاء» يترك القيمة كما كانت (لا تغيير غير مقصود).
 */
export default function DatePicker({
  value,
  onChange,
  id,
  ariaLabel = 'اختيار التاريخ',
  placeholder = 'اختر التاريخ',
  disabled = false,
  clearable = true,
}: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<CalendarView>('days')
  /** الشهر/السنة المعروضان في الشبكة */
  const [viewDate, setViewDate] = useState<Date>(() => parseISO(value) ?? new Date())
  /** التاريخ المرشّح (يُثبَّت بزر تأكيد) */
  const [draft, setDraft] = useState(value)
  const gridRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)

  const today = new Date()

  const cells = useMemo(() => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate])

  const years = useMemo(() => buildYearWindow(viewDate.getFullYear()), [viewDate])

  /** الخلية التي تستقبل Tab وإليه يعود التركيز بعد التنقّل بالأسهم */
  const cursorIso = draft || isoToday(today)
  const focusIso = cells.some((c) => isoOf(c) === cursorIso) ? cursorIso : isoOf(cells[0])
  /** التاريخ المرشّح ككائن (لتمييز الشهر/السنة في العرضين الآخرين) */
  const draftDate = parseISO(draft)

  // بعد التنقّل بالأسهم: انقل التركيز إلى الخلية الجديدة
  useEffect(() => {
    const iso = pendingFocus.current
    if (!iso) return
    pendingFocus.current = null
    gridRef.current?.querySelector<HTMLElement>(`[data-iso="${iso}"]`)?.focus()
  }, [draft, viewDate])

  function openPicker() {
    if (disabled) return
    const base = parseISO(value) ?? new Date()
    setViewDate(new Date(base.getFullYear(), base.getMonth(), 1))
    setDraft(value)
    setView('days')
    setOpen(true)
  }

  function step(dir: 1 | -1) {
    const y = viewDate.getFullYear()
    const m = viewDate.getMonth()
    if (view === 'days') {
      const next = addMonths(viewDate, dir)
      setViewDate(next)
      // أبقِ التركيز داخل الشبكة بعد تبديل الشهر (الخلايا القديمة تُستبدل)
      const firstOfMonth = buildMonthGrid(next.getFullYear(), next.getMonth()).find((d) => d.getDate() === 1)
      if (firstOfMonth) pendingFocus.current = isoOf(firstOfMonth)
    } else if (view === 'months') setViewDate(addMonths(viewDate, dir * 12))
    else setViewDate(new Date(y + dir * 12, m, 1))
  }

  function moveCursor(days: number) {
    const from = parseISO(draft) ?? parseISO(value) ?? today
    const next = addDays(from, days)
    if (next.getFullYear() !== viewDate.getFullYear() || next.getMonth() !== viewDate.getMonth()) {
      setViewDate(new Date(next.getFullYear(), next.getMonth(), 1))
    }
    const iso = isoOf(next)
    pendingFocus.current = iso
    setDraft(iso)
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    // في RTL: السهم الأيمن يعود يوماً للخلف، والأيسر يتقدّم يوماً
    const map: Record<string, number> = { ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7 }
    const delta = map[e.key]
    if (delta === undefined) return
    e.preventDefault()
    moveCursor(delta)
  }

  function pickToday() {
    setDraft(isoToday(today))
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setView('days')
  }

  function confirm() {
    if (draft !== value) onChange(draft)
    setOpen(false)
  }

  function clear() {
    if (value !== '') onChange('')
  }

  const monthLabel = `${MONTHS_AR[viewDate.getMonth()]} ${viewDate.getFullYear()}`
  const title = view === 'days' ? monthLabel : view === 'months' ? String(viewDate.getFullYear()) : `${years[0]} - ${years[11]}`

  return (
    <>
      <div className="date-field">
        <button
          id={id}
          type="button"
          className={`date-trigger${clearable && value ? ' date-trigger--clearable' : ''}`}
          onClick={openPicker}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
        >
          <Icon name="calendar" size={17} className="dt-icon" />
          <span className={`dt-value${value ? '' : ' dt-value--empty'}`}>{value ? formatISODate(value) : placeholder}</span>
        </button>

        {clearable && value && !disabled && (
          <button type="button" className="dt-clear" onClick={clear} aria-label="مسح التاريخ" title="مسح التاريخ">
            <Icon name="x" size={15} />
          </button>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="اختيار التاريخ"
        variant="sheet"
        className="dp-modal"
        footer={
          <div className="dp-foot">
            <div className="dp-foot-group">
              <button type="button" className="btn btn--secondary btn--sm" onClick={pickToday}>
                اليوم
              </button>
              {clearable && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft('')}>
                  مسح
                </button>
              )}
            </div>
            <div className="dp-foot-group">
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(false)}>
                إلغاء
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={confirm} disabled={draft === value}>
                تأكيد
              </button>
            </div>
          </div>
        }
      >
        <div className="dp">
          <div className="dp-nav">
            <button type="button" className="dp-nav-btn" onClick={() => step(-1)} aria-label="السابق">
              <Icon name="chevronRight" size={18} />
            </button>
            <button
              type="button"
              className="dp-title"
              onClick={() => setView((v) => (v === 'days' ? 'months' : v === 'months' ? 'years' : 'days'))}
              aria-label="تغيير الشهر أو السنة"
            >
              {title}
              <Icon name="chevronDown" size={15} />
            </button>
            <button type="button" className="dp-nav-btn" onClick={() => step(1)} aria-label="التالي">
              <Icon name="chevronLeft" size={18} />
            </button>
          </div>

          {view === 'days' && (
            <>
              <div className="dp-week" aria-hidden="true">
                {WEEKDAYS_AR_SHORT.map((w) => (
                  <span key={w} className="dp-week-day">
                    {w}
                  </span>
                ))}
              </div>
              <div className="dp-grid" ref={gridRef} onKeyDown={onGridKeyDown}>
                {cells.map((c) => {
                  const iso = isoOf(c)
                  const isSelected = draft === iso
                  const isToday = sameDay(c, today)
                  const isFocus = iso === focusIso
                  return (
                    <button
                      key={iso}
                      type="button"
                      className="dp-day"
                      data-iso={iso}
                      data-outside={c.getMonth() !== viewDate.getMonth()}
                      data-today={isToday}
                      data-selected={isSelected}
                      aria-pressed={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={`${WEEKDAYS_AR[c.getDay()]} ${formatDate(c.getTime())}`}
                      tabIndex={isFocus ? 0 : -1}
                      data-autofocus={isFocus ? '' : undefined}
                      onClick={() => setDraft(iso)}
                    >
                      {c.getDate()}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {view === 'months' && (
            <div className="dp-cells">
              {MONTHS_AR.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className="dp-cell"
                  data-selected={!!draftDate && draftDate.getMonth() === i && draftDate.getFullYear() === viewDate.getFullYear()}
                  aria-pressed={!!draftDate && draftDate.getMonth() === i && draftDate.getFullYear() === viewDate.getFullYear()}
                  onClick={() => {
                    setViewDate(new Date(viewDate.getFullYear(), i, 1))
                    setView('days')
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {view === 'years' && (
            <div className="dp-cells">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  className="dp-cell"
                  data-selected={!!draftDate && draftDate.getFullYear() === y}
                  aria-pressed={!!draftDate && draftDate.getFullYear() === y}
                  onClick={() => {
                    setViewDate(new Date(y, viewDate.getMonth(), 1))
                    setView('months')
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
