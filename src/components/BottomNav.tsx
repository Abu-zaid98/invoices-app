import { useAppData } from '../lib/AppDataContext'
import { dueBucket } from '../lib/types'

export type Route = 'dashboard' | 'new' | 'invoices' | 'reports' | 'settings' | 'detail' | 'statement'

const items: { r: Route; icon: string; label: string }[] = [
  { r: 'dashboard', icon: '🏠', label: 'الرئيسية' },
  { r: 'new', icon: '➕', label: 'جديد' },
  { r: 'invoices', icon: '🧾', label: 'الفواتير' },
  { r: 'reports', icon: '📊', label: 'التقارير' },
  { r: 'settings', icon: '⚙️', label: 'الإعدادات' },
]

export default function BottomNav({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  // شارة المستحقات (متأخرة + اليوم + غداً) على تبويب الفواتير
  const { invoices } = useAppData()
  const dueCount = invoices.filter((i) => dueBucket(i) != null).length

  return (
    <div
      className="bottom-nav fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-[var(--border)] px-1 py-2 backdrop-blur-xl"
      style={{
        paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {items.map((it) => (
        <button
          key={it.r}
          onClick={() => onNavigate(it.r)}
          className={`relative flex max-w-20 flex-1 flex-col items-center gap-0.5 rounded-xl py-1 text-[11px] ${
            route === it.r ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
          }`}
        >
          <span className={`text-xl ${route === it.r ? '' : 'opacity-70 grayscale'}`}>{it.icon}</span>
          {it.r === 'invoices' && dueCount > 0 && (
            <span
              className="absolute right-1/2 top-0 flex h-5 min-w-5 translate-x-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white"
              style={{ boxShadow: '0 0 10px rgba(220,38,38,0.7)' }}
            >
              {dueCount > 99 ? '99+' : dueCount}
            </span>
          )}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  )
}
