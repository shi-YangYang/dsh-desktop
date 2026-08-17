# dsh-desktop

Electron desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This repository is **not a fork** of deepseek-harness. It is a thin consumer: it
depends on the published `@deepseek-ai/dsh` CLI and wraps the Web surface in an
Electron window. Upgrading dsh is a version bump, not a merge.

## Phase 0 — VERIFIED

The startup chain is proven end to end:

```text
double-click → Electron main → spawn `dsh --profile web` → read printed URL
→ BrowserWindow loads the served frontend
```

Both spawn paths pass (headless smoke, `did-finish-load` + clean quit):

| Path | Result |
|---|---|
| system `node` (v24.9.0) | ✅ loads |
| Electron bundled Node (v22.22.1) | ✅ loads with `--expose-internals` |

### Findings (the answers Phase 0 set out to get)

- **Electron 39.8.10 bundles Node 22.22.1**, which satisfies dsh's engine floor
  (`^22.19 || >=24`). The self-contained packaged app can use Electron's own
  Node — no separate Node install needed.
- **`--expose-internals` is required** when spawning dsh with Electron's Node.
  dsh's module loader reaches Node internals two ways: the `--expose-internals`
  flag, or the `node-addon-require-builtin` native addon. The addon is ABI-bound
  to the Node that built it (here system Node 24, ABI 137), so it cannot load
  under Electron's Node (ABI 140). Passing `--expose-internals` takes the flag
  path and sidesteps the addon entirely.
- **`node-pty` and `koffi` are Node-API (ABI-stable)** and load under Electron
  unchanged, so no `@electron/rebuild` pass is needed.
- **`--port 0` works**: dsh lets the OS pick a free port, so multiple instances
  never collide; the POC reads the real URL from dsh's printed `dsh web:` line.

## Install

```sh
npm install
npm start                 # visible window
POC_HEADLESS=1 npm start  # hidden; auto-quits after the page loads (CI smoke)
```

On a machine whose npm registry is a China mirror (e.g. `registry.npmmirror.com`),
the Electron binary download from GitHub stalls; point it at the mirror for the
install:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

Env flags for `electron/main.mjs`:

- `POC_ELECTRON_NODE=1` — spawn dsh with Electron's bundled Node (the packaged
  app's real path) instead of the system `node`.
- `POC_HEADLESS=1` — hide the window and quit once the page loads.
- `POC_AUTO_QUIT_MS=N` — quit after N ms regardless.

The POC keeps an isolated dsh home at `.dsh-home/` so it never touches a real
`~/.dsh` profile store.

## Roadmap

- Phase 1 — electron-builder NSIS `Setup.exe` with desktop/start-menu shortcuts;
  single-instance lock and clean backend shutdown (Windows process-tree kill).
- Phase 2 — CI build + release.
- Phase 3 — open-source polish (architecture diagram, third-party notices,
  install docs).
