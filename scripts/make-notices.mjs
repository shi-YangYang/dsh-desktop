/**
 * Generate `THIRD_PARTY_NOTICES.md` from package-lock.json — fast and
 * self-contained (no full node_modules walk). The lockfile already carries
 * each package's `version` and `license`.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
const packages = lock.packages ?? {}

/** Normalize a lockfile license value (string, `{type,url}`, or absent). */
function licenseOf(meta) {
  const lic = meta.license
  if (lic === undefined) return 'unspecified'
  if (typeof lic === 'string') return lic
  if (typeof lic.type === 'string') return lic.type
  return 'unspecified'
}

const rows = []
for (const [pkgPath, meta] of Object.entries(packages)) {
  if (pkgPath === '') continue // the project root itself
  rows.push({
    name: pkgPath.replace(/^node_modules\//, ''),
    version: meta.version ?? '',
    license: licenseOf(meta),
  })
}
rows.sort((a, b) => a.name.localeCompare(b.name))

const summary = new Map()
for (const r of rows) summary.set(r.license, (summary.get(r.license) ?? 0) + 1)

const lines = []
lines.push('# Third-Party Notices')
lines.push('')
lines.push('`dsh-desktop` bundles the third-party packages below with their source,')
lines.push('binaries, and license terms. The list is generated from')
lines.push('`package-lock.json` and covers the full install tree; the packaged app')
lines.push('ships its production subset.')
lines.push('')
lines.push('The Electron runtime additionally ships Chromium and Node.js; their')
lines.push('licenses are distributed inside the app as `LICENSE.electron.txt` and')
lines.push('`LICENSES.chromium.html`.')
lines.push('')
lines.push('## License summary')
lines.push('')
for (const [lic, count] of [...summary.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`- ${lic}: ${count}`)
}
lines.push('')
lines.push('## Packages')
lines.push('')
for (const r of rows) lines.push(`- ${r.name}@${r.version} — ${r.license}`)
lines.push('')

writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), lines.join('\n'))
console.log(`wrote THIRD_PARTY_NOTICES.md (${rows.length} packages)`)
