/**
 * Generates the PWA / home-screen icons for BD Alert.
 *
 * The mark is drawn from plain geometry (rounded rects + circles) and encoded
 * straight to PNG with node's zlib, so regenerating icons needs no image
 * libraries and no network. Run with: npm run icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/* ---------------------------------------------------------------- palette */

const GRADIENT_TOP = [251, 113, 133] // rose-400
const GRADIENT_BOTTOM = [190, 18, 60] // rose-700
const ICING = [255, 255, 255]
const FLAME = [253, 224, 71] // yellow-300

/* ------------------------------------------------------------ geometry ops */

/** Signed-distance style test for an axis-aligned rounded rectangle. */
const inRoundedRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

const inCircle = (x, y, cx, cy, r) => {
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

/**
 * The cake, expressed in a 0..1 art box. Returns a colour or null (transparent
 * to whatever is behind it). Order matters: later shapes paint over earlier.
 */
const cakeColorAt = (u, v) => {
  const candleXs = [0.235, 0.5, 0.765]

  // Flames sit above the candles.
  for (const cx of candleXs) {
    if (inCircle(u, v, cx, 0.115, 0.062)) return FLAME
  }
  // Candles.
  for (const cx of candleXs) {
    if (inRoundedRect(u, v, cx - 0.045, 0.16, cx + 0.045, 0.42, 0.045)) return ICING
  }
  // Icing layer with a slight overhang, then the cake body, then the plate.
  if (inRoundedRect(u, v, 0.04, 0.4, 0.96, 0.58, 0.075)) return ICING
  if (inRoundedRect(u, v, 0.11, 0.53, 0.89, 0.84, 0.06)) return ICING
  if (inRoundedRect(u, v, 0.0, 0.85, 1.0, 0.94, 0.045)) return ICING

  return null
}

/* -------------------------------------------------------------- rasterizer */

/**
 * @param {number} size        output pixel size (square)
 * @param {number} cornerRatio rounded corner radius as a fraction of size (0 = square)
 * @param {number} artScale    how much of the tile the cake occupies
 */
const renderIcon = (size, cornerRatio, artScale) => {
  const pixels = Buffer.alloc(size * size * 4)
  const samples = 4 // 4x4 supersampling
  const step = 1 / samples
  const radius = size * cornerRatio
  const artSize = size * artScale
  const artOrigin = (size - artSize) / 2

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = px + (sx + 0.5) * step
          const y = py + (sy + 0.5) * step

          if (radius > 0 && !inRoundedRect(x, y, 0, 0, size, size, radius)) continue

          // Diagonal gradient background.
          const t = (x / size + y / size) / 2
          let color = [
            GRADIENT_TOP[0] + (GRADIENT_BOTTOM[0] - GRADIENT_TOP[0]) * t,
            GRADIENT_TOP[1] + (GRADIENT_BOTTOM[1] - GRADIENT_TOP[1]) * t,
            GRADIENT_TOP[2] + (GRADIENT_BOTTOM[2] - GRADIENT_TOP[2]) * t,
          ]

          const art = cakeColorAt((x - artOrigin) / artSize, (y - artOrigin) / artSize)
          if (art) color = art

          r += color[0]
          g += color[1]
          b += color[2]
          a += 255
        }
      }

      const total = samples * samples
      const i = (py * size + px) * 4
      // Un-premultiply so antialiased edges keep their colour.
      const coverage = a / (total * 255)
      pixels[i] = coverage > 0 ? Math.round(r / (total * coverage)) : 0
      pixels[i + 1] = coverage > 0 ? Math.round(g / (total * coverage)) : 0
      pixels[i + 2] = coverage > 0 ? Math.round(b / (total * coverage)) : 0
      pixels[i + 3] = Math.round(a / total)
    }
  }

  return pixels
}

/* ------------------------------------------------------------ PNG encoding */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const pngChunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

const encodePng = (pixels, size) => {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/* --------------------------------------------------------------- favicon */

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="BD Alert">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fb7185"/>
      <stop offset="1" stop-color="#be123c"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#bg)"/>
  <g transform="translate(19 19) scale(0.62)" fill="#fff">
    <circle cx="23.5" cy="11.5" r="6.2" fill="#fde047"/>
    <circle cx="50" cy="11.5" r="6.2" fill="#fde047"/>
    <circle cx="76.5" cy="11.5" r="6.2" fill="#fde047"/>
    <rect x="19" y="16" width="9" height="26" rx="4.5"/>
    <rect x="45.5" y="16" width="9" height="26" rx="4.5"/>
    <rect x="72" y="16" width="9" height="26" rx="4.5"/>
    <rect x="4" y="40" width="92" height="18" rx="7.5"/>
    <rect x="11" y="53" width="78" height="31" rx="6"/>
    <rect x="0" y="85" width="100" height="9" rx="4.5"/>
  </g>
</svg>
`

/* ------------------------------------------------------------------- main */

const targets = [
  // name, size, corner radius ratio, art scale
  ['pwa-192x192.png', 192, 0.22, 0.6],
  ['pwa-512x512.png', 512, 0.22, 0.6],
  // Maskable icons get cropped to a circle by the platform, so keep the art small.
  ['pwa-maskable-512x512.png', 512, 0, 0.46],
  // iOS applies its own mask to the touch icon, so it must be full-bleed.
  ['apple-touch-icon.png', 180, 0, 0.6],
]

mkdirSync(OUT_DIR, { recursive: true })

for (const [name, size, corner, art] of targets) {
  const png = encodePng(renderIcon(size, corner, art), size)
  writeFileSync(join(OUT_DIR, name), png)
  console.log(`wrote public/${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)} kB)`)
}

writeFileSync(join(OUT_DIR, 'favicon.svg'), FAVICON_SVG)
console.log('wrote public/favicon.svg')
