import { useState } from 'react'
import DevMark from './ui/DevMark'
import Icon from './ui/Icon'
import WhatsAppIcon from './ui/WhatsAppIcon'
import AboutDeveloperModal from './DeveloperProfile'
import { DEVELOPER, whatsappLink } from '../lib/developer'

/**
 * DeveloperSignature — توقيع مختصر للمطوّر يظهر أسفل صفحة الدخول،
 * مع زر تواصل مباشر عبر واتساب وزر «حول المطوّر» يفتح النبذة الكاملة.
 */
export default function DeveloperSignature() {
  const [open, setOpen] = useState(false)
  const d = DEVELOPER

  return (
    <>
      <div className="dev-sig">
        <DevMark size={40} radius={13} label={d.initials} src={d.avatar || undefined} alt={`شعار ${d.name}`} />
        <div className="dev-sig-text">
          <span className="dev-sig-label">تصميم وتطوير</span>
          <span className="dev-sig-name">{d.name}</span>
        </div>
        <div className="dev-sig-actions">
          <a
            className="btn btn--wa btn--sm"
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`تواصل عبر واتساب مع ${d.name}`}
          >
            <WhatsAppIcon size={17} />
            واتساب
          </a>
          <button
            type="button"
            className="btn btn--soft btn--sm"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            <Icon name="info" />
            حول المطوّر
          </button>
        </div>
      </div>

      <AboutDeveloperModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
