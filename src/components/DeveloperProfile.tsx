import DevMark from './ui/DevMark'
import Icon from './ui/Icon'
import Modal from './ui/Modal'
import WhatsAppIcon from './ui/WhatsAppIcon'
import { DEVELOPER, mizanLink, whatsappLink } from '../lib/developer'

const APP_VERSION = '0.1.0'

/**
 * DeveloperProfile — التوقيع الكامل للمطوّر وحقوق الملكية الفكرية.
 *
 * يُعرَض في مكانين من نفس المصدر:
 *  - الإعدادات → قسم «حول المطوّر» (كسفحة كاملة داخل الإعدادات).
 *  - صفحة الدخول → عبر نافذة AboutDeveloperModal.
 */
export function DeveloperProfile() {
  const d = DEVELOPER
  const wa = whatsappLink()
  const mizan = mizanLink()
  const hasMizanUrl = Boolean(d.mizan.url)

  return (
    <div className="stack">
      {/* ── الهوية ── */}
      <div className="card card--pad dev-hero">
        <DevMark size={60} label={d.initials} src={d.avatar || undefined} alt={`شعار ${d.name}`} />
        <div className="dev-hero-main">
          <span className="dev-name">{d.name}</span>
          <span className="dev-role">{d.role}</span>
        </div>
        <div className="dev-hero-actions">
          <a
            className="btn btn--wa btn--sm"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`تواصل عبر واتساب مع ${d.name}`}
          >
            <WhatsAppIcon size={18} />
            تواصل عبر واتساب
          </a>
        </div>
      </div>

      {/* ── نبذة مختصرة ── */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">نبذة مختصرة</span>
          <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}>
            <Icon name="user" size={18} />
          </span>
        </div>
        {d.bio.map((p) => (
          <p className="dev-p" key={p.slice(0, 28)}>
            {p}
          </p>
        ))}
      </div>

      {/* ── أعمال وبرامج ── */}
      <div className="card card--flush">
        <div className="dev-head">
          <span className="section-title">أعمال وبرامج قمت بتطويرها</span>
          <span className="stat-icon g-violet" style={{ width: 34, height: 34 }}>
            <Icon name="briefcase" size={18} />
          </span>
        </div>
        <div className="dev-list">
          {d.works.map((w) => (
            <div className="dev-item" key={w.title}>
              <span className={`dev-logo dev-logo--${w.tone}`} aria-hidden="true">
                <Icon name={w.icon} size={23} strokeWidth={1.9} />
              </span>
              <div className="dev-item-main">
                <span className="dev-item-title">{w.title}</span>
                <p className="dev-item-desc">{w.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── الخبرات والتقنيات ── */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">الخبرات والتقنيات</span>
          <span className="stat-icon g-blue" style={{ width: 34, height: 34 }}>
            <Icon name="code" size={18} />
          </span>
        </div>
        <div className="dev-skills">
          {d.skills.map((s) => (
            <span className="dev-skill" key={s.label}>
              <Icon name={s.icon} size={15} />
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── برنامج ميزان (للتجربة) ── */}
      <div className="card card--pad dev-mizan">
        <span className="dev-logo dev-logo--teal" aria-hidden="true">
          <Icon name="scale" size={23} strokeWidth={1.9} />
        </span>
        <div className="dev-item-main">
          <span className="dev-item-title" style={{ fontSize: 15 }}>
            {d.mizan.name}
          </span>
          <span className="dev-item-desc">{d.mizan.tagline}</span>
          <p className="dev-item-desc" style={{ marginTop: 6 }}>
            {d.mizan.desc}
          </p>
        </div>
        <div className="dev-hero-actions">
          <a
            className={hasMizanUrl ? 'btn btn--secondary btn--sm' : 'btn btn--wa btn--sm'}
            href={mizan}
            target="_blank"
            rel="noopener noreferrer"
          >
            {hasMizanUrl ? <Icon name="externalLink" /> : <WhatsAppIcon size={18} />}
            {hasMizanUrl ? 'تجربة برنامج ميزان' : 'اطلب رابط التجربة'}
          </a>
        </div>
      </div>

      {/* ── حقوق الملكية ── */}
      <div className="card card--pad">
        <div className="section-head">
          <span className="section-title">حقوق الملكية الفكرية</span>
          <span className="stat-icon g-green" style={{ width: 34, height: 34 }}>
            <Icon name="shield" size={18} />
          </span>
        </div>
        <p className="dev-legal">{d.legal}</p>
        <div className="dev-copy">
          <div className="row-between" style={{ gap: 12 }}>
            <span>{d.copyright}</span>
            <span className="amount" dir="ltr" style={{ color: 'var(--muted)', fontWeight: 700 }}>
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>

      <p className="hint" style={{ textAlign: 'center' }}>
        لأي استفسار أو دعم فني أو طلب تطوير مشابه — تواصل مباشرة عبر واتساب.
      </p>
    </div>
  )
}

/** نافذة «حول المطوّر» — تُستخدم من صفحة الدخول */
export default function AboutDeveloperModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      size="lg"
      title="حول المطوّر"
      description="تصميم وتطوير تطبيق «فواتيري»"
    >
      <DeveloperProfile />
    </Modal>
  )
}
