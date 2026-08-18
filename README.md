# dsh-desktop

English | [中文](README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![build](https://github.com/shi-YangYang/dsh-desktop/actions/workflows/build.yml/badge.svg)](https://github.com/shi-YangYang/dsh-desktop/actions/workflows/build.yml)

Electron desktop shell for DeepSeek Harness

dsh-desktop wraps the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web surface in an Electron window, so you launch dsh by double-clicking instead of running a command — no CLI required.

It is **not a fork** of deepseek-harness. It is a thin consumer that depends on the published `@deepseek-ai/dsh` CLI — upgrading dsh is a version bump, not a merge.

## Table of Contents

- [Security](#security)
- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [Build](#build)
- [Release](#release)
- [Maintenance](#maintenance)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Security

Report security vulnerabilities privately via a [GitHub security advisory](https://github.com/shi-YangYang/dsh-desktop/security/advisories/new) or to [@shi-YangYang](https://github.com/shi-YangYang).

## Background

DeepSeek Harness (`dsh`) ships as a CLI and a Web app. dsh-desktop gives it a desktop form: an Electron window that boots the `dsh` backend and loads the Web surface, so you launch it by double-clicking instead of running a command.

The packaged app is self-contained: it bundles the `dsh` backend and Electron's own Node runtime, so end users need neither Node nor the `dsh` CLI. It shares the CLI's `~/.dsh` home, so sessions and configuration are the same across both.

## Install

### End users

1. Download `DSH Desktop Setup <version>.exe` from the latest GitHub Release.
2. Run it and follow the prompts; it creates desktop and start-menu shortcuts.
3. Double-click the shortcut to launch.

To uninstall, run `Uninstall DSH Desktop.exe` in the install directory, or remove it from *Settings → Apps*.

### Developers

```sh
npm install
npm start
```

On a machine whose npm registry is a China mirror (e.g. `registry.npmmirror.com`), the Electron binary download from GitHub stalls; point it at the mirror:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## Usage

```text
double-click → Electron main → spawn `dsh --profile web` (Electron's own Node)
→ read printed URL → BrowserWindow loads the served frontend
```

The packaged app shares the CLI's default dsh home (`~/.dsh`); dev uses an isolated `.dsh-home/`.

Dev/debug environment variables:

- `POC_SYSTEM_NODE=1` — spawn dsh with the system `node` instead of Electron's bundled Node (a packaged app must NOT use this).
- `POC_HEADLESS=1` — hide the window and quit once the page loads (CI smoke).
- `POC_AUTO_QUIT_MS=N` — quit after N ms regardless.

## Build

```sh
npm run build
```

Outputs `dist/DSH Desktop Setup <version>.exe` (NSIS; installs desktop + start-menu shortcuts). On a China-mirror machine, add the binaries mirror for the NSIS tooling download:

```sh
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ npm run build
```

The app icon (`build/icon.ico`) and third-party notices (`THIRD_PARTY_NOTICES.md`) are generated with `node scripts/make-icon.mjs` and `node scripts/make-notices.mjs`, and ship inside the installer.

## Release

Push a `v*` tag (e.g. `v0.1.0`) to trigger the `build` workflow, which builds the installer on `windows-latest` and publishes `Setup.exe` to a GitHub Release. The workflow can also be run manually from the Actions tab.

## Maintenance

The build relies on a few facts about dsh's packaging:

- Electron 39 bundles Node 22.22.1, which satisfies dsh's engine floor (`^22.19 || >=24`), so the packaged app spawns dsh with Electron's own Node — no system Node required.
- The spawn passes `--expose-internals` so dsh's module loader reaches Node internals directly instead of through the ABI-bound `node-addon-require-builtin` addon.
- `node-pty` and `koffi` are Node-API (ABI-stable), so `npmRebuild: false` keeps them loadable under Electron unchanged.
- `--port 0` lets the OS pick a free port; the app reads the real URL from dsh's printed `dsh web:` line.
- `asar: false` because the spawned dsh process reads `node_modules` from disk directly.
- The Windows directory picker worker (`@deepseek-ai/dsh-host-directory-picker-native`) spawns itself via `process.execPath`, which under Electron is the Electron binary. A `patch-package` patch (`patches/`) forces `ELECTRON_RUN_AS_NODE=1` on that worker spawn so it boots as Node, and fixes the folder-path read so it measures the returned string instead of overrunning its buffer; drop the patch once an upstream dsh release carries the fixes and the `@deepseek-ai/dsh-*` versions are bumped.

`package.json` declares many `@deepseek-ai/dsh-*` packages in addition to the `@deepseek-ai/dsh` CLI. That list is not optional: dsh declares those packages as **peerDependencies** (imported at runtime), and electron-builder only bundles the production `dependencies` graph, so it drops peer deps. If a dsh version bump adds a new runtime import, add the missing `@deepseek-ai/*` package here too — compare the packaged `resources/app/node_modules/@deepseek-ai` against the dev `node_modules/@deepseek-ai` to find gaps.

## Maintainers

[@shi-YangYang](https://github.com/shi-YangYang).

## Contributing

Questions and pull requests are welcome — [open an issue](https://github.com/shi-YangYang/dsh-desktop/issues) or submit a PR.

Please keep the README bilingual: update `README.md` (English) and `README.zh.md` (Chinese) together. Patches to bundled dependencies go in `patches/` via `patch-package`.

## License

[MIT](LICENSE) © shi-YangYang
