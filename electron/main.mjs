/**
 * dsh-desktop main process: spawn the dsh backend (web profile) with Electron's
 * bundled Node, read the canonical URL it prints, and load it in a window.
 * Self-contained — a packaged app needs no system Node.
 *
 * Env flags (dev/debug only):
 *   POC_SYSTEM_NODE=1   spawn dsh with the system `node` instead of Electron's
 *                       bundled Node. A packaged app must NOT use this.
 *   POC_HEADLESS=1      hide the window and quit once the page loads (CI smoke).
 *   POC_AUTO_QUIT_MS=N  quit after N ms regardless (smoke guard).
 */

import { app, BrowserWindow, dialog } from 'electron'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const APP_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The installed dsh CLI entry (published package `@deepseek-ai/dsh`, bin `dsh`). */
const DSH_BIN = require.resolve('@deepseek-ai/dsh/lib/bin.js')

const HEADLESS = process.env.POC_HEADLESS === '1'
const USE_SYSTEM_NODE = process.env.POC_SYSTEM_NODE === '1'
const AUTO_QUIT_MS = Number(process.env.POC_AUTO_QUIT_MS ?? '0')

/** @type {import('node:child_process').ChildProcess | undefined} */
let backend
/** @type {BrowserWindow | undefined} */
let mainWindow

/**
 * The dsh home. A packaged app writes to the per-user data dir (the install
 * dir may be read-only); dev uses an isolated `.dsh-home` so it never touches
 * a real `~/.dsh`.
 */
function dshHome() {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'dsh-home')
    : path.join(APP_ROOT, '.dsh-home')
}

/**
 * Spawn `dsh --profile web` and resolve once it prints its URL. `--port 0`
 * lets the OS pick a free port, so two instances never collide.
 */
function startBackend() {
  mkdirSync(dshHome(), { recursive: true })
  // A packaged app has no system Node, so spawn Electron's own Node by
  // re-running the binary as Node (ELECTRON_RUN_AS_NODE=1).
  const executable = USE_SYSTEM_NODE ? 'node' : process.execPath
  const env = USE_SYSTEM_NODE
    ? process.env
    : { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  // --expose-internals lets dsh's module loader reach Node internals directly,
  // instead of through the ABI-specific `node-addon-require-builtin` native
  // addon (built for the system Node's ABI, unloadable under Electron's).
  const child = spawn(executable, ['--expose-internals', DSH_BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', '0'], {
    env: { ...env, DSH_HOME: dshHome() },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return new Promise((resolve, reject) => {
    let url
    let buffer = ''
    const scan = (chunk, tag) => {
      buffer += chunk.toString()
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim() === '') continue
        console.log(`${tag} ${line}`)
        const match = line.match(/dsh web: (http:\/\/\S+)/)
        if (match !== null) {
          url = match[1]
          resolve({ child, url })
        }
      }
    }
    child.stdout.on('data', (chunk) => scan(chunk, '[dsh]'))
    child.stderr.on('data', (chunk) => scan(chunk, '[dsh:err]'))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (url === undefined) reject(new Error(`dsh exited (code ${String(code)}) before printing its URL`))
    })
  })
}

/** Stop the dsh backend and its whole process tree (dsh spawns its own children). */
function stopBackend() {
  if (backend === undefined) return
  const pid = backend.pid
  if (pid !== undefined && process.platform === 'win32') {
    // TerminateProcess only kills the direct child; /T kills the tree.
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } else if (pid !== undefined) {
    backend.kill()
  }
  backend = undefined
}

async function startup() {
  console.log('[dsh-desktop] electron version:', process.versions.electron)
  console.log('[dsh-desktop] electron bundled node:', process.versions.node)
  console.log('[dsh-desktop] spawn via:', USE_SYSTEM_NODE ? 'system-node' : 'electron-bundled-node')
  console.log('[dsh-desktop] dsh bin:', DSH_BIN)

  let entry
  try {
    entry = await startBackend()
  } catch (error) {
    console.error('[dsh-desktop] backend failed:', error)
    if (!HEADLESS) dialog.showErrorBox('dsh-desktop: backend failed to start', String(error))
    app.exit(1)
    return
  }
  backend = entry.child
  console.log('[dsh-desktop] dsh url:', entry.url)

  mainWindow = new BrowserWindow({ width: 1200, height: 800, show: !HEADLESS })
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[dsh-desktop] page loaded:', mainWindow?.webContents.getURL())
    if (HEADLESS) {
      console.log('[dsh-desktop] HEADLESS verification passed; quitting')
      stopBackend()
      app.quit()
    }
  })
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[dsh-desktop] load failed:', code, desc, url)
    stopBackend()
    app.exit(1)
  })
  await mainWindow.loadURL(entry.url)

  if (AUTO_QUIT_MS > 0) {
    setTimeout(() => {
      console.log('[dsh-desktop] auto-quit')
      stopBackend()
      app.quit()
    }, AUTO_QUIT_MS)
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow !== undefined) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  void app.whenReady().then(startup)
}

app.on('window-all-closed', () => {
  stopBackend()
  app.quit()
})
