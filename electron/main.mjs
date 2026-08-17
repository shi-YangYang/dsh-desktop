/**
 * Phase 0 POC: spawn the published `dsh` CLI (web profile), read the canonical
 * URL it prints, and load it in a BrowserWindow. Proves the double-click
 * startup chain end to end and reports the Electron-bundled Node version —
 * the #1 unknown, because dsh's engines require Node ^22.19 || >=24.
 *
 * Env flags:
 *   POC_ELECTRON_NODE=1  spawn dsh with Electron's bundled Node (the packaged
 *                        app's real path) instead of the system `node`.
 *   POC_HEADLESS=1       hide the window and quit once the page loads
 *                        (automated verification).
 *   POC_AUTO_QUIT_MS=N   quit after N ms regardless (smoke guard).
 */

import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Isolated dsh home so the POC never touches a real `~/.dsh` profile store. */
const DSH_HOME = path.join(REPO_ROOT, '.dsh-home')

/** The installed dsh CLI entry (published package `@deepseek-ai/dsh`, bin `dsh`). */
const DSH_BIN = require.resolve('@deepseek-ai/dsh/lib/bin.js')

const HEADLESS = process.env.POC_HEADLESS === '1'
const USE_ELECTRON_NODE = process.env.POC_ELECTRON_NODE === '1'
const AUTO_QUIT_MS = Number(process.env.POC_AUTO_QUIT_MS ?? '0')

/** @type {import('node:child_process').ChildProcess | undefined} */
let backend

/**
 * Spawn `dsh --profile web` and resolve once it prints its URL. `--port 0`
 * lets the OS pick a free port, so two instances never collide.
 */
function startBackend() {
  mkdirSync(DSH_HOME, { recursive: true })
  const executable = USE_ELECTRON_NODE ? process.execPath : 'node'
  const env = USE_ELECTRON_NODE
    ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    : process.env
  // --expose-internals lets dsh's module loader reach Node internals directly,
  // instead of through the ABI-specific `node-addon-require-builtin` native
  // addon. Without it, spawning via Electron's bundled Node (a different ABI
  // than the system Node the addon was built against) fails at HMR boot.
  const child = spawn(executable, ['--expose-internals', DSH_BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', '0'], {
    env: { ...env, DSH_HOME },
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

function stopBackend() {
  if (backend !== undefined) {
    backend.kill()
    backend = undefined
  }
}

app.whenReady().then(async () => {
  console.log('[poc] electron version:', process.versions.electron)
  console.log('[poc] electron bundled node:', process.versions.node)
  console.log('[poc] spawn via:', USE_ELECTRON_NODE ? 'electron-bundled-node' : 'system-node')
  console.log('[poc] dsh bin:', DSH_BIN)

  let entry
  try {
    entry = await startBackend()
  } catch (error) {
    console.error('[poc] backend failed:', error)
    app.exit(1)
    return
  }
  backend = entry.child
  console.log('[poc] dsh url:', entry.url)

  const win = new BrowserWindow({ width: 1200, height: 800, show: !HEADLESS })
  win.webContents.on('did-finish-load', () => {
    console.log('[poc] page loaded:', win.webContents.getURL())
    if (HEADLESS) {
      console.log('[poc] HEADLESS verification passed; quitting')
      stopBackend()
      app.quit()
    }
  })
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error('[poc] load failed:', code, desc, url)
    stopBackend()
    app.exit(1)
  })
  await win.loadURL(entry.url)

  if (AUTO_QUIT_MS > 0) {
    setTimeout(() => {
      console.log('[poc] auto-quit')
      stopBackend()
      app.quit()
    }, AUTO_QUIT_MS)
  }
})

app.on('window-all-closed', () => {
  stopBackend()
  app.quit()
})
