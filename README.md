# dsh-desktop

Electron desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

This repository is **not a fork** of deepseek-harness. It is a thin consumer: it
depends on the published `@deepseek-ai/dsh` CLI and wraps the Web surface in an
Electron window. Upgrading dsh is a version bump, not a merge.

## What works

The startup chain is proven end to end, both from source and as a packaged app:

```text
double-click → Electron main → spawn `dsh --profile web` (Electron's own Node)
→ read printed URL → BrowserWindow loads the served frontend
```

- **Phase 0 (POC)** — spawn + URL capture + window load, both spawn paths.
- **Phase 1 (packaging)** — electron-builder NSIS `Setup.exe` with desktop and
  start-menu shortcuts; single-instance lock; process-tree shutdown.
- **Phase 2 (CI)** — GitHub Actions builds the installer on Windows and publishes
  it to a GitHub Release on `v*` tags.

### Key findings baked into the build

- Electron 39 bundles Node 22.22.1, which satisfies dsh's engine floor
  (`^22.19 || >=24`), so the packaged app spawns dsh with Electron's own Node —
  no system Node required.
- The spawn passes `--expose-internals` so dsh's module loader reaches Node
  internals directly instead of through the ABI-bound
  `node-addon-require-builtin` addon.
- `node-pty` and `koffi` are Node-API (ABI-stable), so `npmRebuild: false` keeps
  them loadable under Electron unchanged.
- `--port 0` lets the OS pick a free port; the app reads the real URL from dsh's
  printed `dsh web:` line.
- `asar: false` because the spawned dsh process reads `node_modules` from disk
  directly.

### Maintenance: the explicit `@deepseek-ai/*` dependencies

`package.json` declares many `@deepseek-ai/dsh-*` packages in addition to the
`@deepseek-ai/dsh` CLI. That list is not optional: dsh declares those packages
as **peerDependencies** (imported at runtime), and electron-builder only bundles
the production `dependencies` graph, so it drops peer deps. If a dsh version
bump adds a new runtime import, add the missing `@deepseek-ai/*` package here too
— compare the packaged `resources/app/node_modules/@deepseek-ai` against the dev
`node_modules/@deepseek-ai` to find gaps.

## Install & run

```sh
npm install
npm start                 # visible window
POC_HEADLESS=1 npm start  # hidden; auto-quits after the page loads (CI smoke)
```

On a machine whose npm registry is a China mirror (e.g. `registry.npmmirror.com`),
the Electron binary download from GitHub stalls; point it at the mirror:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## Build the installer

```sh
npm run build
```

Outputs `dist/DSH Desktop Setup 0.1.0.exe` (NSIS; installs desktop + start-menu
shortcuts). On a China-mirror machine, add the binaries mirror for the NSIS
tooling download:

```sh
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ npm run build
```

## Env flags (dev/debug)

- `POC_SYSTEM_NODE=1` — spawn dsh with the system `node` instead of Electron's
  bundled Node (a packaged app must NOT use this).
- `POC_HEADLESS=1` — hide the window and quit once the page loads.
- `POC_AUTO_QUIT_MS=N` — quit after N ms regardless.

The packaged app shares the CLI's default dsh home (`~/.dsh`), so its sessions
and config are the same as `dsh web`; dev uses an isolated `.dsh-home/`.

## Release

Push a `v*` tag (e.g. `v0.1.0`) to trigger the `build` workflow: it builds the
installer on `windows-latest` and publishes `Setup.exe` to a GitHub Release. You
can also run the workflow manually from the Actions tab.

## Roadmap

- Phase 3 — open-source polish: application icon, third-party notices, install
  docs.
