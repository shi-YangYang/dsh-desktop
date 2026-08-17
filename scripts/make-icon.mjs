/**
 * Generate `build/icon.ico` from `build/icon.svg` for electron-builder.
 * Rasterizes the SVG with sharp, then wraps the 256x256 PNG in a minimal ICO
 * container (ICO supports embedded PNG for 256px entries).
 */

import sharp from 'sharp'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const buildDir = path.join(root, 'build')
mkdirSync(buildDir, { recursive: true })

const svg = readFileSync(path.join(buildDir, 'icon.svg'))
const png = await sharp(svg).resize(256, 256).png().toBuffer()

// ICO header: reserved(2) + type=1(2) + count=1(2)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)

// Directory entry: width/height 0 means 256, planes=1, bpp=32, PNG payload.
const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0)
entry.writeUInt8(0, 1)
entry.writeUInt8(0, 2)
entry.writeUInt8(0, 3)
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(header.length + entry.length, 12)

const ico = Buffer.concat([header, entry, png])
const out = path.join(buildDir, 'icon.ico')
writeFileSync(out, ico)
console.log(`wrote ${out} (${ico.length} bytes)`)
