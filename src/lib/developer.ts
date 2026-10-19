/**
 * بيانات المطوّر / حقوق الملكية الفكرية — مصدر واحد يظهر في:
 *  - صفحة الدخول (توقيع مختصر)
 *  - الإعدادات → «حول المطوّر»
 *
 * عدّل هذا الملف فقط لتغيير أي معلومة (الاسم، الرقم، الأعمال، رابط ميزان).
 */
import type { IconName } from '../components/ui/Icon'

/** الرقم بصيغة دولية بلا «+» ولا أصفار بادئة (صيغة wa.me) */
const WHATSAPP = '972592133357'

/** الرابط المباشر لميزان (اتركه '' لعرض زر «اطلب رابط التجربة» عبر واتساب) */
const MIZAN_URL = 'https://mezanapp.vercel.app/'

const NAME = 'م. محمد الجوجو'

export interface DevWork {
  /** لون الشعار (يُبنى منه التدرّج) */
  tone: DevTone
  /** أيقونة الشعار */
  icon: IconName
  title: string
  desc: string
}

export type DevTone = 'blue' | 'violet' | 'green' | 'amber' | 'teal' | 'rose'

export interface DevSkill {
  icon: IconName
  label: string
}

export interface Developer {
  name: string
  shortName: string
  initials: string
  /** صورة شعار المطوّر (رابط أو صورة مضمنة) — اتركه '' لاستخدام شعار الأحرف */
  avatar: string
  role: string
  tagline: string
  whatsapp: string
  whatsappDisplay: string
  bio: string[]
  works: DevWork[]
  skills: DevSkill[]
  mizan: { name: string; tagline: string; desc: string; url: string }
  copyright: string
  legal: string
}

export const DEVELOPER: Developer = {
  name: NAME,
  shortName: 'محمد الجوجو',
  initials: 'MJ',
  avatar: '',
  role: 'مهندس برمجيات — تطبيقات ويب وأنظمة إدارية ومحاسبية',
  tagline: 'تصميم وتطوير تطبيق «فواتيري»',
  whatsapp: WHATSAPP,
  whatsappDisplay: '00972 592 133 357',
  bio: [
    'مهندس برمجيات متخصّص في بناء تطبيقات الويب والأنظمة الإدارية والمحاسبية. أعمل على تصميم وتطوير حلول عملية للشركات والمتاجر: من المتاجر الإلكترونية والمنيو الرقمي، إلى الأنظمة المحاسبية وأنظمة إدارة المخزون والفواتير.',
    'أهتم بالتفاصيل وبسرعة الأداء وبأن يبقى البرنامج سهل الاستخدام، ويعمل حتى مع انقطاع الإنترنت. «فواتيري» أحد أعمالي: نظام فواتير يعمل بالكامل على جهازك، بتصميم فاتورة قابل للتخصيص بالكامل وطباعة عربية دقيقة (PDF / PNG).',
  ],
  works: [
    {
      icon: 'shoppingBag',
      tone: 'violet',
      title: 'المتاجر الإلكترونية',
      desc: 'متاجر متعددة الأقسام مع سلة شراء، طلبات، مخزون، كوبونات، ولوحة تحكم كاملة.',
    },
    {
      icon: 'qrCode',
      tone: 'amber',
      title: 'المنيو الرقمي',
      desc: 'قائمة طعام رقمية بـ QR للمطاعم والكافيهات: أقسام وأصناف وأسعار وطلب مباشر عبر واتساب.',
    },
    {
      icon: 'layout',
      tone: 'blue',
      title: 'برامج إدارية',
      desc: 'إدارة العملاء والعقود والمخزون والموظفين مع تقارير وصلاحيات مستخدمين.',
    },
    {
      icon: 'calculator',
      tone: 'green',
      title: 'برامج محاسبية',
      desc: 'قيود وسندات قبض وصرف وحسابات وميزان مراجعة وتقارير مالية.',
    },
    {
      icon: 'globe',
      tone: 'rose',
      title: 'تطبيقات ويب تعمل دون إنترنت (PWA)',
      desc: 'تطبيقات تُثبَّت على الجوال كالتطبيقات الأصلية وتحفظ بياناتك على جهازك.',
    },
  ],
  skills: [
    { icon: 'code', label: 'تطبيقات ويب حديثة (React)' },
    { icon: 'palette', label: 'تصميم واجهات UI/UX' },
    { icon: 'globe', label: 'واجهات عربية RTL' },
    { icon: 'phone', label: 'تطبيقات جوال PWA' },
    { icon: 'bank', label: 'قواعد بيانات وإدارتها' },
    { icon: 'file', label: 'تقارير وطباعة PDF و PNG' },
    { icon: 'chart', label: 'تقارير وتحليل بيانات' },
    { icon: 'shield', label: 'أمان وحماية بيانات' },
    { icon: 'wallet', label: 'أنظمة مالية ومحاسبية' },
    { icon: 'tag', label: 'أنظمة نقاط بيع ومخزون' },
  ],
  mizan: {
    name: 'ميزان',
    tagline: 'نظام المبيعات والمخزون والفواتير',
    desc: 'نظام «ميزان» لإدارة المبيعات والمخزون والفواتير مع تقارير تفصيلية — متاح للتجربة المباشرة.',
    url: MIZAN_URL,
  },
  copyright: `© ${new Date().getFullYear()} ${NAME} — جميع الحقوق محفوظة`,
  legal:
    'جميع حقوق الملكية الفكرية لتطبيق «فواتيري» — التصميم والواجهات والكود المصدري والهوية البصرية — محفوظة للمهندس محمد الجوجو. لا يجوز نسخ أو إعادة استخدام أو إعادة نشر أي جزء منه دون إذن كتابي مسبق.',
}

/**
 * سطر حقوق المطوّر في تذييل الفاتورة — مصدر واحد لكل المخرجات:
 * HTML (معاينة + طباعة) و Canvas (PNG / PDF).
 */
export const INVOICE_CREDIT = `تصميم وتطوير: ${NAME}`

/** رابط واتساب مع رسالة مُعدّة مسبقاً */
export function whatsappLink(text = 'مرحباً م. محمد الجوجو، لدي استفسار حول تطبيق «فواتيري».'): string {
  return `https://wa.me/${DEVELOPER.whatsapp}?text=${encodeURIComponent(text)}`
}

/** رابط تجربة «ميزان» — وإن لم يُحدَّد نعود إلى واتساب لطلب الرابط */
export function mizanLink(requestText = 'مرحباً م. محمد الجوجو، أرغب بتجربة برنامج «ميزان» — أرجو إرسال رابط التجربة.'): string {
  return DEVELOPER.mizan.url || whatsappLink(requestText)
}
