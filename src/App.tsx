import { useEffect, useMemo, useRef, useState } from 'react'
import { AppDataProvider, useAppData } from './lib/AppDataContext'
import { ToastProvider, useToast } from './lib/useToast'
import { downloadJsonBackup } from './lib/backup'
import { dueBucket } from './lib/types'
import { todayLabel } from './lib/format'
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
import OnlineIndicator from './components/OnlineIndicator'
import UpdatePrompt from './components/UpdatePrompt'
import Icon from './components/ui/Icon'
import BrandMark from './components/ui/BrandMark'

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
      <div className="app-shell" style={{ paddingTop: 'calc(68px + env(safe-area-inset-top, 0px))' }}>
        <div className="page">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 13 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ width: '40%', height: 18, marginBottom: 8 }} />
              <div className="skeleton" style={{ width: '60%', height: 11 }} />
            </div>
          </div>
          <div className="grid-2">
            <div className="skeleton" style={{ height: 118 }} />
            <div className="skeleton" style={{ height: 118 }} />
          </div>
          <div className="skeleton" style={{ height: 92 }} />
          <div className="skeleton" style={{ height: 180 }} />
        </div>
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
  const today = todayLabel()

  function toggleTheme() {
    const next = meta.theme === 'light' ? 'dark' : 'light'
    // بلا إشعار: التغيير ظاهر فوراً في كل الواجهة
    updateMeta('theme', next).catch(() => {})
  }

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

  const dueTotal = dueCounts.overdue + dueCounts.today + dueCounts.tomorrow

  return (
    <div className="app-shell" style={{ paddingTop: 'calc(68px + env(safe-area-inset-top, 0px))' }}>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-brand">
            <span className="app-logo">
              <BrandMark size={22} />
            </span>
            <h1 className="brand-text app-brand">فواتيري</h1>
          </div>

          <div className="app-header-date" title={`${today.weekday} · ${today.date}`}>
            <span className="ahd-weekday">{today.weekday}</span>
            <span className="ahd-sep" aria-hidden="true">·</span>
            <span className="ahd-date">{today.date}</span>
          </div>

          <div className="app-header-actions">
            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn"
              aria-label={meta.theme === 'light' ? 'التبديل للوضع الداكن' : 'التبديل للوضع الفاتح'}
            >
              <Icon name={meta.theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="icon-btn"
              aria-label="قفل التطبيق"
            >
              <Icon name="lock" />
            </button>
          </div>
        </div>
      </header>

      <div style={{ marginBottom: 10 }}>
        <OnlineIndicator />
      </div>

      <main className="page animate-page" key={route}>
        {route === 'dashboard' && (
          <Dashboard
            onOpenInvoice={(id) => {
              setSelectedId(id)
              setRoute('detail')
            }}
            onOpenOverdue={openDueList}
            onOpenInvoices={() => navigate('invoices')}
          />
        )}
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
      </main>

      <BottomNav
        route={route}
        onNavigate={navigate}
        lastPartyName={lastPartyName}
        dueCount={dueTotal}
        onNew={() => { if (route !== 'new') navigate('new') }}
        onLastParty={newForLastParty}
        onDue={openDueList}
      />

      {/* إشعارات PWA (تحديث + تثبيت) — مُكدَّسة فوق شريط التنقّل */}
      <div className="pwa-notices">
        <UpdatePrompt />
        <InstallBanner />
      </div>

      {/* Due reminder modal */}
      <ConfirmModal
        isOpen={showDueReminder}
        variant="warning"
        icon={<Icon name="clock" />}
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
        icon={<Icon name="lock" />}
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
