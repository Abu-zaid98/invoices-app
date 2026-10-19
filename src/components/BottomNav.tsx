import { useState } from 'react'
import Modal from './ui/Modal'
import Icon, { type IconName } from './ui/Icon'

export type Route = 'dashboard' | 'new' | 'invoices' | 'reports' | 'settings' | 'detail' | 'statement'

interface NavDef {
  r: Route
  icon: IconName
  label: string
}

const LEFT: NavDef[] = [
  { r: 'dashboard', icon: 'home', label: 'الرئيسية' },
  { r: 'invoices', icon: 'receipt', label: 'الفواتير' },
]
const RIGHT: NavDef[] = [
  { r: 'reports', icon: 'chart', label: 'التقارير' },
  { r: 'settings', icon: 'settings', label: 'الإعدادات' },
]

interface Props {
  route: Route
  onNavigate: (r: Route) => void
  lastPartyName: string | null
  dueCount: number
  onNew: () => void
  onLastParty: () => void
  onDue: () => void
}

/** شريط تنقل سفلي: 4 تبويبات + زر إجراءات مركزي (فاتورة جديدة/آخر عميل/المستحقات) */
export default function BottomNav({ route, onNavigate, lastPartyName, dueCount, onNew, onLastParty, onDue }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const activeRoute: Route = route === 'detail' || route === 'statement' ? 'invoices' : route

  function go(r: Route) {
    setSheetOpen(false)
    onNavigate(r)
  }

  function renderTab(it: NavDef) {
    const active = activeRoute === it.r
    return (
      <button
        key={it.r}
        type="button"
        onClick={() => go(it.r)}
        className="nav-item"
        data-active={active}
        aria-current={active ? 'page' : undefined}
      >
        <Icon name={it.icon} />
        {it.r === 'invoices' && dueCount > 0 && (
          <span className="nav-badge">{dueCount > 99 ? '99+' : dueCount}</span>
        )}
        <span>{it.label}</span>
      </button>
    )
  }

  return (
    <>
      <div className="bottom-nav">
        <nav className="bottom-nav-inner" aria-label="التنقل الرئيسي">
          {LEFT.map(renderTab)}

          <button
            type="button"
            className="nav-fab"
            data-open={sheetOpen}
            onClick={() => setSheetOpen((o) => !o)}
            aria-label={sheetOpen ? 'إغلاق الإجراءات السريعة' : 'إجراءات سريعة'}
            aria-expanded={sheetOpen}
          >
            <Icon name="plus" strokeWidth={2.2} />
          </button>

          {RIGHT.map(renderTab)}
        </nav>
      </div>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        variant="sheet"
        title="إجراءات سريعة"
        description="اختر ما تريد إنجازه الآن"
      >
        <div className="action-sheet" style={{ padding: 0 }}>
          <button type="button" className="action-item" onClick={() => { setSheetOpen(false); onNew() }}>
            <span className="action-item-icon" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
              <Icon name="plus" />
            </span>
            <span style={{ flex: 1 }}>
              <span className="action-item-title" style={{ display: 'block' }}>فاتورة جديدة</span>
              <span className="action-item-sub" style={{ display: 'block' }}>ابدأ بإنشاء فاتورة بيع أو شراء</span>
            </span>
            <Icon name="chevronLeft" size={18} style={{ color: 'var(--muted)' }} />
          </button>

          {lastPartyName && (
            <button type="button" className="action-item" onClick={() => { setSheetOpen(false); onLastParty() }}>
              <span className="action-item-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                <Icon name="user" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="action-item-title" style={{ display: 'block' }}>لآخر عميل</span>
                <span className="action-item-sub" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lastPartyName}
                </span>
              </span>
              <Icon name="chevronLeft" size={18} style={{ color: 'var(--muted)' }} />
            </button>
          )}

          <button type="button" className="action-item" onClick={() => { setSheetOpen(false); onDue() }}>
            <span className="action-item-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
              <Icon name="clock" />
            </span>
            <span style={{ flex: 1 }}>
              <span className="action-item-title" style={{ display: 'block' }}>المستحقات</span>
              <span className="action-item-sub" style={{ display: 'block' }}>
                {dueCount > 0 ? `${dueCount} فاتورة تحتاج متابعة` : 'لا توجد مستحقات قريبة'}
              </span>
            </span>
            {dueCount > 0 && <span className="badge badge--warning">{dueCount}</span>}
            <Icon name="chevronLeft" size={18} style={{ color: 'var(--muted)' }} />
          </button>
        </div>
      </Modal>
    </>
  )
}
