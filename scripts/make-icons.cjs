/**
 * توليد أيقونات التطبيق (PNG) — بلا أي مكتبات خارجية.
 *
 * الرمز: «فاتورة/سند» بحدّ سفلي مسنّن على خلفية كحلية متدرّجة،
 * مع الأحرف MJ بشكل صغير خفيف داخل السند (نفس BrandMark في الواجهة).
 *
 * التشغيل:  node scripts/make-icons.cjs
 * المخرجات: public/icon-192.png | public/icon-512.png | public/apple-touch-icon.png | public/favicon.svg
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

/* ─────────────────────────── كاتب PNG (بدون تبعيات) ─────────────────────── */

let crcTable = null
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c
    }
  }
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** PNG بمُعدّل RGB 8-بت (بلا قناة ألفا — الخلفية ممتلئة) */
function encodePNG(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ───────────────────────────── هندسة الرسم ─────────────────────────────── */

const SS = 3

function pointInPolygon(x, y, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0]
    const yi = pts[i][1]
    const xj = pts[j][0]
    const yj = pts[j][1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function inStroke(x, y, pts, w) {
  const r = w / 2
  for (let i = 1; i < pts.length; i++) {
    if (segDist(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= r) return true
  }
  return false
}

function roundRectPts(x, y, w, h, r, steps = 10) {
  const pts = []
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  }
  pts.push([x + r, y])
  pts.push([x + w - r, y])
  arc(x + w - r, y + r, -Math.PI / 2, 0)
  pts.push([x + w, y + h - r])
  arc(x + w - r, y + h - r, 0, Math.PI / 2)
  pts.push([x + r, y + h])
  arc(x + r, y + h - r, Math.PI / 2, Math.PI)
  pts.push([x, y + r])
  arc(x + r, y + r, Math.PI, Math.PI * 1.5)
  return pts
}

/** جسم السند: زوايا علوية دائرية + حدّ سفلي مسنّن */
function docPts(x, y, w, h, r, teeth, depth, steps = 10) {
  const pts = []
  const arc = (cx, cy, a0, a1) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
  }
  pts.push([x + r, y])
  pts.push([x + w - r, y])
  arc(x + w - r, y + r, -Math.PI / 2, 0)
  pts.push([x + w, y + h])
  const seg = w / teeth
  for (let i = 1; i <= teeth; i++) {
    pts.push([x + w - seg * i, i % 2 === 1 ? y + h - depth : y + h])
  }
  pts.push([x, y + r])
  arc(x + r, y + r, Math.PI, Math.PI * 1.5)
  return pts
}

function fillShape(px, W, H, inside, color, alpha = 1) {
  const inv = 1 / (SS * SS)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hits = 0
      for (let sy = 0; sy < SS; sy++) {
        const yy = y + (sy + 0.5) / SS
        for (let sx = 0; sx < SS; sx++) {
          if (inside(x + (sx + 0.5) / SS, yy)) hits++
        }
      }
      if (!hits) continue
      const a = hits * inv * alpha
      const i = (y * W + x) * 3
      px[i] = px[i] * (1 - a) + color[0] * a
      px[i + 1] = px[i + 1] * (1 - a) + color[1] * a
      px[i + 2] = px[i + 2] * (1 - a) + color[2] * a
    }
  }
}

/* ───────────────────────────── تصميم الأيقونة ──────────────────────────── */

const BG_TOP = [0x18, 0x22, 0x3a]
const BG_BOTTOM = [0x0a, 0x0e, 0x1a]
const GLOW = [0x2f, 0x8c, 0xff]
const DOC = [0xff, 0xff, 0xff]
const BAR = [0x0a, 0x84, 0xff]
const MONO = [0xb2, 0xbd, 0xcf]

const lerp = (a, b, t) => a + (b - a) * t

function renderIcon(size) {
  const W = size
  const H = size
  const px = Buffer.alloc(W * H * 3)
  const U = size // 1 وحدة = كامل الأيقونة

  // 1) خلفية متدرّجة + توهّج علوي أزرق
  for (let y = 0; y < H; y++) {
    const t = H > 1 ? y / (H - 1) : 0
    for (let x = 0; x < W; x++) {
      let r = lerp(BG_TOP[0], BG_BOTTOM[0], t)
      let g = lerp(BG_TOP[1], BG_BOTTOM[1], t)
      let b = lerp(BG_TOP[2], BG_BOTTOM[2], t)
      const dx = (x - W * 0.5) / W
      const dy = (y - H * 0.1) / H
      const d = Math.hypot(dx, dy)
      const glow = Math.max(0, 1 - d / 0.8) ** 2 * 0.32
      r = lerp(r, GLOW[0], glow)
      g = lerp(g, GLOW[1], glow)
      b = lerp(b, GLOW[2], glow)
      const i = (y * W + x) * 3
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
    }
  }

  // 2) جسم السند (أبيض)
  const dx0 = 0.293 * U
  const dy0 = 0.185 * U
  const dw = 0.414 * U
  const dh = 0.63 * U
  const doc = docPts(dx0, dy0, dw, dh, 0.055 * U, 8, 0.03 * U)
  fillShape(px, W, H, (x, y) => pointInPolygon(x, y, doc), DOC)

  // 3) أسطر المحتوى (أزرق العلامة)
  const bx = 0.368 * U
  const bw = 0.264 * U
  const bars = [
    { x: bx, y: 0.27 * U, w: bw, h: 0.032 * U, r: 0.016 * U },
    { x: bx, y: 0.345 * U, w: bw, h: 0.021 * U, r: 0.0105 * U },
    { x: bx, y: 0.396 * U, w: bw * 0.73, h: 0.021 * U, r: 0.0105 * U },
  ]
  for (const bar of bars) {
    const pts = roundRectPts(bar.x, bar.y, bar.w, bar.h, bar.r)
    fillShape(px, W, H, (x, y) => pointInPolygon(x, y, pts), BAR)
  }

  // 4) الأحرف MJ — صغيرة وخافتة داخل السند
  const sw = 0.016 * U
  const M = [
    [0.452 * U, 0.66 * U],
    [0.452 * U, 0.575 * U],
    [0.473 * U, 0.625 * U],
    [0.494 * U, 0.575 * U],
    [0.494 * U, 0.66 * U],
  ]
  const J = [
    [0.548 * U, 0.575 * U],
    [0.548 * U, 0.636 * U],
    [0.533 * U, 0.66 * U],
    [0.524 * U, 0.644 * U],
    [0.524 * U, 0.612 * U],
  ]
  fillShape(px, W, H, (x, y) => inStroke(x, y, M, sw) || inStroke(x, y, J, sw), MONO)

  return encodePNG(W, H, px)
}

/** نسخة SVG مطابقة (لفافات المتصفح) */
function renderSVG() {
  const docPath =
    'M8.352 4.44H15.648A1.32 1.32 0 0 1 16.968 5.76V19.56L15.726 18.84 14.484 19.56 13.242 18.84 12 19.56 10.758 18.84 9.516 19.56 8.274 18.84 7.032 19.56V5.76A1.32 1.32 0 0 1 8.352 4.44Z'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#18223a"/>
      <stop offset="1" stop-color="#0a0e1a"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.1" r="0.8">
      <stop offset="0" stop-color="#2f8cff" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#2f8cff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="24" height="24" fill="url(#bg)"/>
  <rect width="24" height="24" fill="url(#glow)"/>
  <path d="${docPath}" fill="#fff"/>
  <rect x="8.83" y="6.48" width="6.34" height="0.77" rx="0.38" fill="#0a84ff"/>
  <rect x="8.83" y="8.28" width="6.34" height="0.5" rx="0.25" fill="#0a84ff"/>
  <rect x="8.83" y="9.5" width="4.63" height="0.5" rx="0.25" fill="#0a84ff"/>
  <g stroke="#b2bdcf" stroke-width="0.38" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M10.85 15.84V13.8l0.5 1.2 0.51-1.2v2.04"/>
    <path d="M13.15 13.8v1.46l-0.36 0.58-0.22-0.38v-0.77"/>
  </g>
</svg>
`
}

/* ─────────────────────────────── التشغيل ────────────────────────────────── */

const outDir = path.join(__dirname, '..', 'public')
fs.mkdirSync(outDir, { recursive: true })

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]

for (const [name, size] of targets) {
  const buf = renderIcon(size)
  fs.writeFileSync(path.join(outDir, name), buf)
  console.log(`${name}  ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`)
}

fs.writeFileSync(path.join(outDir, 'favicon.svg'), renderSVG(), 'utf8')
console.log('favicon.svg')
