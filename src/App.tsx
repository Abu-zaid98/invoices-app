import { useEffect, useMemo, useRef, useState } from 'react'
import { AppDataProvider, useAppData } from './lib/AppDataContext'
import { ToastProvider, useToast } from './lib/useToast'
import { downloadJsonBackup } from './lib/backup'
import { dueBucket } from './lib/types'
import PinLogin from './components/PinLogin'
import BottomNav, { type Route } from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import InvoiceForm from './pages/InvoiceForm'
import InvoicesList, { type PayFilter } from './pages/InvoicesList'
import type { InvoiceType } from './lib/types'
import InvoiceDetail from './pages/InvoiceDetail'
import Reports from './pages/Reports'
import PartyStatement from './pages/PartyStatement'
import Settings from './pages/Settings'
import ConfirmModal from './components/ConfirmModal'
import InstallBanner from './components/InstallBanner'
import Fab from './components/Fab'
import OnlineIndicator from './components/OnlineIndicator'
import UpdatePrompt from './components/UpdatePrompt'

function Shell() {
  const { loaded, meta, invoices, saveInvoice, updateMeta } = useAppData()
  const { toast } = useToast()
  const [unlocked, setUnlocked] = useState(false)
  const [route, setRoute] = useState<Route>('dashboard')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedParty, setSelectedParty] = useState<string | null>(null)
  const [partyReturn, setPartyReturn] = useState<Route>('reports')
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showDueReminder, setShowDueReminder] = useState(false)
  const [listPreset, setListPreset] = useState<{ filter: PayFilter; key: number } | null>(null)
  const [formDraft, setFormDraft] = useState<{ party: string; type: InvoiceType; currency: string } | null>(null)
  const autoBackupDone = useRef(false)
  const dueReminderShown = useRef(false)

  // نسخة احتياطية تلقائية عند الاستحقاق (مرة واحدة لكل تشغيل)
  useEffect(() => {
    if (!loaded || !unlocked || autoBackupDone.current) return
    if (meta.autoBackup === 'off' || invoices.length === 0) return
    const interval = meta.autoBackup === 'weekly' ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000
    if (meta.lastBackupAt && Date.now() - meta.lastBackupAt < interval) return
    autoBackupDone.current = true
    try {
      downloadJsonBackup(meta, invoices)
      updateMeta('lastBackupAt', Date.now()).catch(() => {})
      toast('تم إنشاء نسخة احتياطية تلقائية 💾')
    } catch {
      /* تجاهل فشل التنزيل التلقائي */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, unlocked])

  // قفل تلقائي بعد خمول
  useEffect(() => {
    if (!loaded || !unlocked || !meta.autoLockMinutes) return
    let timer: number | undefined
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setUnlocked(false), meta.autoLockMinutes * 60 * 1000)
    }
    reset()
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [loaded, unlocked, meta.autoLockMinutes])

  // تذكير الاستحقاقات مرة واحدة بعد كل فتح للقفل
  useEffect(() => {
    if (!loaded || !unlocked) {
      if (!unlocked) dueReminderShown.current = false
      return
    }
    if (dueReminderShown.current || invoices.length === 0) return
    dueReminderShown.current = true
    const hasDue = invoices.some((i) => dueBucket(i) != null)
    if (hasDue) {
      const t = window.setTimeout(() => setShowDueReminder(true), 1200)
      return () => window.clearTimeout(t)
    }
  }, [loaded, unlocked, invoices])

  const dueCounts = useMemo(() => {
    let overdue = 0
    let today = 0
    let tomorrow = 0
    for (const inv of invoices) {
      const b = dueBucket(inv)
      if (b === 'overdue') overdue++
      else if (b === 'today') today++
      else if (b === 'tomorrow') tomorrow++
    }
    return { overdue, today, tomorrow }
  }, [invoices])

  if (!loaded) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[540px] flex-col gap-3 px-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}>
        <div className="flex items-center gap-2.5">
          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 13 }} />
          <div className="flex-1">
            <div className="skeleton mb-2" style={{ width: '40%', height: 20 }} />
            <div className="skeleton" style={{ width: '60%', height: 12 }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton" style={{ height: 120 }} />
          <div className="skeleton" style={{ height: 120 }} />
        </div>
        <div className="skeleton" style={{ height: 90 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    )
  }

  if (!unlocked) {
    return <PinLogin onUnlock={() => setUnlocked(true)} />
  }

  function navigate(r: Route) {
    if (r === 'new') {
      setEditingId(null)
      setFormDraft(null)
    }
    if (r === 'invoices') setListPreset(null)
    setRoute(r)
  }

  /** فاتورة جديدة لآخر عميل تعاملت معه (فواتير بيع/شراء فقط) */
  function newForLastParty() {
    const docs = invoices.filter((i) => i.type !== 'credit')
    if (docs.length === 0) {
      setEditingId(null)
      setFormDraft(null)
      setRoute('new')
      return
    }
    const last = [...docs].sort((a, b) => b.date - a.date)[0]
    setEditingId(null)
    setFormDraft({ party: last.party, type: last.type, currency: last.currency })
    setRoute('new')
  }

  const lastPartyName = (() => {
    const docs = invoices.filter((i) => i.type !== 'credit')
    return docs.length > 0 ? [...docs].sort((a, b) => b.date - a.date)[0].party : null
  })()

  function dueReminderText(): string {
    const parts: string[] = []
    if (dueCounts.overdue > 0) parts.push(`⚠️ ${dueCounts.overdue} متأخرة عن موعدها`)
    if (dueCounts.today > 0) parts.push(`📌 ${dueCounts.today} تستحق اليوم`)
    if (dueCounts.tomorrow > 0) parts.push(`📅 ${dueCounts.tomorrow} تستحق غداً`)
    return parts.join('\n')
  }

  function openDueList() {
    setShowDueReminder(false)
    setListPreset((p) => ({ filter: 'overdue', key: (p?.key ?? 0) + 1 }))
    setRoute('invoices')
  }

  function openParty(name: string, from: Route = 'reports') {
    setSelectedParty(name)
    setPartyReturn(from === 'statement' ? 'reports' : from)
    setRoute('statement')
  }

  // ─── تاريخ اليوم + تبديل الثيم ───
  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  const AR_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

  function todayLabel(): { weekday: string; date: string } {
    const now = new Date()
    return {
      weekday: AR_WEEKDAYS[now.getDay()],
      date: `${now.getDate()} ${AR_MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    }
  }

  function toggleTheme() {
    const next = meta.theme === 'light' ? 'dark' : 'light'
    updateMeta('theme', next).then(() =>
      toast(next === 'light' ? 'تم التبديل للوضع الفاتح ☀️' : 'تم التبديل للوضع الداكن 🌙'),
    )
  }

  const today = todayLabel()

  const editingInvoice = editingId != null ? invoices.find((i) => i.id === editingId) ?? null : null

  /** تكرار فاتورة: نسخة جديدة برقم وتاريخ جديدين، والدفع يُصفَّر */
  async function handleDuplicate(id: number) {
    const src = invoices.find((i) => i.id === id)
    if (!src) return
    const copy = {
      ...src,
      id: meta.nextId,
      date: Date.now(),
      items: src.items.map((it) => ({ ...it })),
      paymentStatus: 'unpaid' as const,
      paidAmount: 0,
      payments: [],
      attachment: undefined,
      dueDate: null,
    }
    await saveInvoice(copy)
    await updateMeta('nextId', meta.nextId + 1)
    toast(`تم تكرار الفاتورة كرقم #${String(copy.id).padStart(4, '0')}`)
    setSelectedId(copy.id)
    setRoute('detail')
  }

  /** إشعار دائن/مرتجع مرتبط بفاتورة — مطبَّق فوراً على الحساب */
  async function handleCreateCredit(id: number, amount: number, reason: string) {
    const src = invoices.find((i) => i.id === id)
    if (!src || src.type === 'credit') return
    const creditKind = src.type
    const label = reason || (creditKind === 'sale' ? 'مرتجع بضاعة' : 'مرتجع للمورد')
    const now = Date.now()
    const credit = {
      id: meta.nextId,
      type: 'credit' as const,
      creditKind,
      linkedId: src.id,
      party: src.party,
      currency: src.currency,
      date: now,
      items: [{ name: `↩️ ${label}`, qty: 1, price: amount, specs: `مرتبط بالفاتورة #${String(src.id).padStart(4, '0')}` }],
      total: amount,
      paymentStatus: 'paid' as const,
      paidAmount: amount,
      payments: [{ id: `auto-${now}`, amount, date: now, note: 'إشعار مطبَّق' }],
      payMethod: null,
      dueDate: null,
      discountType: null,
      discountValue: 0,
      taxPercent: 0,
      notes: `${label} — مرتبط بالفاتورة #${String(src.id).padStart(4, '0')}`,
    }
    await saveInvoice(credit)
    await updateMeta('nextId', meta.nextId + 1)
    toast('تم إنشاء الإشعار وتطبيقه على الحساب ↩️')
    setSelectedId(credit.id)
    setRoute('detail')
  }

  return (
    <div
      className="mx-auto max-w-[540px] px-4 pb-28"
      style={{ paddingTop: 'calc(74px + env(safe-area-inset-top, 0px))' }}
    >
      <header className="app-header fixed inset-x-0 top-0 z-40">
        <div
          className="mx-auto max-w-[540px] px-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <span className="app-logo">🧾</span>
              <div>
                <h2 className="text-[19px] font-bold leading-tight brand-text" style={{ letterSpacing: '-0.02em' }}>فواتيري</h2>
                <div className="flex items-center gap-1 text-[11px] leading-tight text-[var(--muted)]">
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{today.weekday}</span>
                  <span>·</span>
                  <span>{today.date}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="icon-btn"
                title={meta.theme === 'light' ? 'تبديل للوضع الداكن 🌙' : 'تبديل للوضع الفاتح ☀️'}
              >
                <span>{meta.theme === 'light' ? '🌙' : '☀️'}</span>
              </button>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="icon-btn"
                title="قفل التطبيق وتسجيل الخروج"
              >
                <span>🔒</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="mb-2 flex justify-center empty:hidden">
        <OnlineIndicator />
      </div>

      {route === 'dashboard' && <Dashboard />}
      {route === 'new' && (
        <InvoiceForm
          editingInvoice={editingInvoice}
          draft={formDraft}
          onDone={(id) => {
            setEditingId(null)
            setFormDraft(null)
            setSelectedId(id)
            setRoute('detail')
          }}
          onCancel={() => {
            setEditingId(null)
            setFormDraft(null)
            setRoute('invoices')
          }}
        />
      )}
      {route === 'invoices' && (
        <InvoicesList
          key={listPreset?.key ?? 0}
          initialPayFilter={listPreset?.filter ?? 'all'}
          onOpen={(id) => {
            setSelectedId(id)
            setRoute('detail')
          }}
        />
      )}
      {route === 'detail' && selectedId != null && (
        <InvoiceDetail
          invoiceId={selectedId}
          onBack={() => setRoute('invoices')}
          onEdit={(id) => {
            setEditingId(id)
            setRoute('new')
          }}
          onDuplicate={handleDuplicate}
          onOpenParty={(name) => openParty(name, 'invoices')}
          onCreateCredit={handleCreateCredit}
          onOpenInvoice={(id) => {
            setSelectedId(id)
            setRoute('detail')
          }}
        />
      )}
      {route === 'statement' && selectedParty != null && (
        <PartyStatement
          partyName={selectedParty}
          onBack={() => setRoute(partyReturn)}
          onOpenInvoice={(id) => {
            setSelectedId(id)
            setRoute('detail')
          }}
        />
      )}
      {route === 'reports' && <Reports onOpenParty={(name) => openParty(name, 'reports')} />}
      {route === 'settings' && <Settings onLocked={() => setUnlocked(false)} />}

      <BottomNav route={route} onNavigate={navigate} />

      {/* PWA install banner */}
      <InstallBanner />

      {/* PWA update prompt */}
      <UpdatePrompt />

      {/* Quick actions FAB */}
      <Fab
        hidden={route === 'new'}
        lastPartyName={lastPartyName}
        dueCount={dueCounts.overdue + dueCounts.today + dueCounts.tomorrow}
        onNew={() => navigate('new')}
        onLastParty={newForLastParty}
        onDue={openDueList}
      />

      {/* Due reminder modal */}
      <ConfirmModal
        isOpen={showDueReminder}
        variant="warning"
        icon="⏰"
        title="تذكير الاستحقاقات"
        message={`${dueReminderText()}\n\nهل تريد عرضها الآن؟`}
        confirmLabel="عرض المستحقات"
        cancelLabel="لاحقاً"
        onConfirm={openDueList}
        onCancel={() => setShowDueReminder(false)}
      />

      {/* Logout confirmation modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        variant="warning"
        icon="🔒"
        title="تسجيل الخروج وقفل التطبيق"
        message="هل تريد قفل التطبيق؟ ستحتاج إلى إدخال رمز الدخول PIN للوصول إلى النظام مجدداً."
        confirmLabel="قفل التطبيق الآن"
        cancelLabel="إلغاء"
        onConfirm={() => {
          setShowLogoutModal(false)
          setUnlocked(false)
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppDataProvider>
        <Shell />
      </AppDataProvider>
    </ToastProvider>
  )
}
