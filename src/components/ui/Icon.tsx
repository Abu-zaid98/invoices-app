import type { CSSProperties, ReactNode } from 'react'

/**
 * Icon — مجموعة أيقونات خطية موحّدة (SVG) بنمط واحد:
 * شبكة 24، سماكة 1.8، نهايات دائرية، لون يتوارث من النص (currentColor).
 * لا نستخدم مكتبات خارجية؛ الحقول الدلالية/الإيموجي تبقى داخل المحتوى فقط.
 */
export type IconName =
  | 'home' | 'receipt' | 'chart' | 'settings' | 'plus' | 'x' | 'lock' | 'moon' | 'sun' | 'menu'
  | 'check' | 'checkCircle' | 'alert' | 'info' | 'trash' | 'pencil' | 'copy' | 'share'
  | 'download' | 'upload' | 'printer' | 'search' | 'filter' | 'calendar' | 'clock' | 'user'
  | 'users' | 'wallet' | 'bank' | 'cash' | 'card' | 'arrowLeft' | 'arrowRight'
  | 'chevronLeft' | 'chevronRight' | 'chevronDown' | 'refresh' | 'image' | 'shield'
  | 'sparkles' | 'file' | 'externalLink' | 'trendingUp' | 'phone' | 'key'
  | 'delete' | 'moreHorizontal' | 'tag' | 'percent'
  | 'palette' | 'droplet' | 'eye' | 'eyeOff' | 'layout' | 'type'
  | 'code' | 'qrCode' | 'messageCircle' | 'shoppingBag' | 'utensils' | 'calculator' | 'scale' | 'briefcase' | 'globe'

const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.6 12 3l9 7.6" /><path d="M5.6 9.4V20a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.4" /><path d="M9.6 21v-5.4h4.8V21" /></>,
  receipt: <><path d="M6 2.8h12V21l-2.4-1.6L13.2 21 12 20.2 10.8 21 8.4 19.4 6 21V2.8z" /><path d="M9 8h6M9 11.6h6" /></>,
  chart: <><path d="M5 20V12.5M12 20V5M19 20v-9.5" /><path d="M3 20h18" /></>,
  settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  lock: <><rect x="4" y="10.4" width="16" height="10.6" rx="2.4" /><path d="M8 10.4V7a4 4 0 0 1 8 0v3.4" /></>,
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.4l2.8 2.8L16 9.6" /></>,
  alert: <><path d="M12 3.2 2.6 20h18.8L12 3.2z" /><path d="M12 9.5v4.5M12 17.3h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11.2v5M12 7.8h.01" /></>,
  trash: <><path d="M4 7h16M9 7V4.6h6V7" /><path d="M6.4 7l.9 13.1h9.4L17.6 7" /><path d="M10 11v6M14 11v6" /></>,
  pencil: <><path d="M4 20h4L20 8l-4-4L4 16v4z" /><path d="M14 6l4 4" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2.4" /><path d="M5.5 15H4.8A1.8 1.8 0 0 1 3 13.2V4.8A1.8 1.8 0 0 1 4.8 3h8.4A1.8 1.8 0 0 1 15 4.8v.7" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-3.9M8.6 13.4l6.8 3.9" /></>,
  download: <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20h16" />,
  upload: <path d="M12 21V9M7.5 13.5 12 9l4.5 4.5M4 4h16" />,
  printer: <><path d="M6 9V3h12v6" /><path d="M6 18H4.4A1.9 1.9 0 0 1 2.5 16.1v-4.2A1.9 1.9 0 0 1 4.4 10h15.2a1.9 1.9 0 0 1 1.9 1.9v4.2a1.9 1.9 0 0 1-1.9 1.9H18" /><rect x="6" y="14" width="12" height="7" rx="1.6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20.2 20.2 16 16" /></>,
  filter: <path d="M3.5 5h17l-6.6 7.6V19l-3.8 1.8v-8.2L3.5 5z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.6" /><path d="M3 9.6h18M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.4l3.6 2.1" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.6 20a7.4 7.4 0 0 1 14.8 0" /></>,
  users: <><circle cx="9" cy="8" r="3.6" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.6 3.6 0 0 1 0 6.8M18 20a6.6 6.6 0 0 0-3-5.6" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13.5" rx="3" /><path d="M3 10.6h18" /><circle cx="16.6" cy="14.8" r="1.1" /></>,
  bank: <><path d="M3 10 12 4l9 6" /><path d="M5 10v9M9.6 10v9M14.4 10v9M19 10v9" /><path d="M3 21h18" /></>,
  cash: <><rect x="2.5" y="6.5" width="19" height="11" rx="2.6" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.6h.01M18 14.4h.01" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.6" /><path d="M2.5 9.6h19" /></>,
  arrowLeft: <path d="M20 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  chevronLeft: <path d="M14.6 5 7.6 12l7 7" />,
  chevronRight: <path d="M9.4 5l7 7-7 7" />,
  chevronDown: <path d="M6 9.4 12 15.4 18 9.4" />,
  refresh: <><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" /><path d="M8 16H3v5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.6" /><circle cx="8.6" cy="9.6" r="1.8" /><path d="M21 15.4 16.6 11 7 20.6" /></>,
  shield: <><path d="M12 3l7 3v5.6c0 4.5-3 7.9-7 9.6-4-1.7-7-5.1-7-9.6V6l7-3z" /><path d="M9.4 12.2l1.8 1.8 3.4-3.6" /></>,
  sparkles: <><path d="M12 3.2 13.7 8 18 9.7 13.7 11.4 12 16.2 10.3 11.4 6 9.7 10.3 8z" /><path d="M18.5 15.2l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2L15.5 18l2.2-.8z" /></>,
  file: <><path d="M6 3h7l5 5v13H6V3z" /><path d="M13 3v5h5" /></>,
  externalLink: <><path d="M14 4h6v6M20 4l-8.5 8.5" /><path d="M18 14.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4.5" /></>,
  trendingUp: <><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18.6h2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 3l3 3M14 6l2 2" /></>,
  delete: <><path d="M20 6H9.6L4 12l5.6 6H20a1.8 1.8 0 0 0 1.8-1.8V7.8A1.8 1.8 0 0 0 20 6z" /><path d="M17 9.6 12.6 14M12.6 9.6 17 14" /></>,
  moreHorizontal: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  tag: <><path d="M3.2 11.2V4.4a1.2 1.2 0 0 1 1.2-1.2h6.8a1 1 0 0 1 .7.3l8.4 8.4a1.2 1.2 0 0 1 0 1.7l-6.5 6.5a1.2 1.2 0 0 1-1.7 0l-8.4-8.4a1 1 0 0 1-.5-.5z" /><circle cx="7.6" cy="7.6" r="1.3" /></>,
  percent: <><path d="M19 5 5 19" /><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></>,
  palette: <><path d="M12 3a9 9 0 0 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.4-.7-.4-1.1 0-1 .8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3z" /><circle cx="7.5" cy="11" r="1.2" /><circle cx="10.5" cy="7.2" r="1.2" /><circle cx="15" cy="7.8" r="1.2" /></>,
  droplet: <path d="M12 3.2s6 6.2 6 10.2a6 6 0 0 1-12 0c0-4 6-10.2 6-10.2z" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.6 5.9A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 4.1M6.4 8A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1 0 1.9-.2 2.7-.5" /><path d="M9.9 10a3 3 0 0 0 4.2 4.2" /></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2.6" /><path d="M3 9.5h18M9.5 9.5V20" /></>,
  type: <><path d="M5 6.5V4h14v2.5M12 4v16M9 20h6" /></>,
  code: <><rect x="3" y="4.4" width="18" height="15.2" rx="4" /><path d="M7.6 10.2 10 12.2l-2.4 2" /><path d="M12.4 14.4h4" /></>,
  qrCode: <><rect x="3.2" y="3.2" width="6.6" height="6.6" rx="1.8" /><rect x="14.2" y="3.2" width="6.6" height="6.6" rx="1.8" /><rect x="3.2" y="14.2" width="6.6" height="6.6" rx="1.8" /><path d="M14.2 14.2h3.2v3.2h-3.2z" /><path d="M20.4 14.2h.4M14.2 20.4h.4M18.2 20.4h2.6v-2.6" /></>,
  messageCircle: <path d="M20.6 11.6a7.8 7.8 0 0 1-8.4 7.7c-.9 0-1.7-.1-2.5-.4l-4.3 1.4 1.4-4.1a7.6 7.6 0 0 1-.8-3.4 7.8 7.8 0 0 1 7.8-8 7.8 7.8 0 0 1 6.8 6.8z" />,
  shoppingBag: <><path d="M5.5 8h13l-1 11.3a1.9 1.9 0 0 1-1.9 1.7H8.4a1.9 1.9 0 0 1-1.9-1.7z" /><path d="M9.2 8V6.7a2.8 2.8 0 0 1 5.6 0V8" /></>,
  utensils: <><path d="M7 3v7.4a2 2 0 0 0 4 0V3" /><path d="M9 10.4V21" /><path d="M16.4 3c1.7 1.7 2.4 3.7 2.4 5.5 0 1.6-.8 2.7-2.4 3V21" /></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="2.4" /><path d="M8.6 7.2h6.8" /><path d="M8.8 11.4h.01M12 11.4h.01M15.2 11.4h.01M8.8 15h.01M12 15h.01M15.2 15h.01M8.8 18.4h.01M12 18.4h.01M15.2 18.4h.01" /></>,
  scale: <><path d="M12 4.2V19" /><path d="M7.6 19.8h8.8" /><path d="M4.4 7.8h15.2" /><path d="M4.4 7.8 2.2 13.2a3.2 3.2 0 0 0 4.4 0z" /><path d="M19.6 7.8l2.2 5.4a3.2 3.2 0 0 1-4.4 0z" /></>,
  briefcase: <><rect x="3" y="7.4" width="18" height="12" rx="2.4" /><path d="M9 7.4V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8v1.6" /><path d="M3 12.2h18" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3.4 9.6h17.2M3.4 14.4h17.2" /><path d="M12 3a14.6 14.6 0 0 0 0 18 14.6 14.6 0 0 0 0-18z" /></>,
}

interface IconProps {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
  strokeWidth?: number
  title?: string
}

export default function Icon({ name, size = 24, className, style, strokeWidth = 1.8, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  )
}
