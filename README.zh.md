# dsh-desktop

[English](README.md) | 中文

> DeepSeek Harness 的 Electron 桌面壳 —— 双击即可启动 dsh,无需命令行。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![build](https://github.com/shi-YangYang/dsh-desktop/actions/workflows/build.yml/badge.svg)](https://github.com/shi-YangYang/dsh-desktop/actions/workflows/build.yml)

dsh-desktop 用 Electron 窗口封装了 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web 界面。

它**不是** deepseek-harness 的 fork,而是一个薄薄的消费方:依赖已发布的 `@deepseek-ai/dsh` CLI —— 升级 dsh 只是改个版本号,而不是 merge。

## 目录

- [背景](#背景)
- [安装](#安装)
- [使用](#使用)
- [构建](#构建)
- [发布](#发布)
- [维护](#维护)
- [维护者](#维护者)
- [许可证](#许可证)

## 背景

DeepSeek Harness(dsh)以 CLI 和 Web 应用两种形态发布。dsh-desktop 给它加上桌面形态:一个 Electron 窗口启动 `dsh` 后端并加载 Web 界面,让你双击即可启动,而不是敲命令。

打包后的应用完全自包含:内置 `dsh` 后端和 Electron 自带的 Node 运行时,最终用户既不需要 Node 也不需要 `dsh` CLI。它与 CLI 共享 `~/.dsh` 目录,因此会话和配置在两处是一致的。

## 安装

### 最终用户

1. 从最新的 GitHub Release 下载 `DSH Desktop Setup <version>.exe`。
2. 运行并按提示操作;安装器会创建桌面和开始菜单快捷方式。
3. 双击快捷方式启动。

卸载:运行安装目录里的 `Uninstall DSH Desktop.exe`,或在 *设置 → 应用* 中移除。

### 开发者

```sh
npm install
npm start
```

如果本机 npm 用了中国镜像(例如 `registry.npmmirror.com`),Electron 二进制从 GitHub 下载会卡住;改成走镜像:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## 使用

```text
双击 → Electron 主进程 → 用 Electron 自带的 Node 启动 `dsh --profile web`
→ 读取打印出的 URL → BrowserWindow 加载前端
```

打包后的应用共享 CLI 默认的 dsh 目录(`~/.dsh`);开发模式用隔离的 `.dsh-home/`。

开发/调试环境变量:

- `POC_SYSTEM_NODE=1` — 用系统 `node` 而非 Electron 内置 Node 启动 dsh(打包版**绝不能**用这个)。
- `POC_HEADLESS=1` — 隐藏窗口,页面加载完即退出(CI 冒烟)。
- `POC_AUTO_QUIT_MS=N` — 无论是否加载完,N 毫秒后退出。

## 构建

```sh
npm run build
```

产物是 `dist/DSH Desktop Setup 0.1.0.exe`(NSIS;安装桌面 + 开始菜单快捷方式)。中国镜像的机器上,给 NSIS 工具下载加二进制镜像:

```sh
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ npm run build
```

应用图标(`build/icon.ico`)和第三方声明(`THIRD_PARTY_NOTICES.md`)由 `node scripts/make-icon.mjs` 和 `node scripts/make-notices.mjs` 生成,并随安装包一起分发。

## 发布

推送一个 `v*` 标签(例如 `v0.1.0`)触发 `build` workflow:它在 `windows-latest` 上构建安装包,并把 `Setup.exe` 发布到 GitHub Release。也可以在 Actions 页手动运行该 workflow。

## 维护

构建依赖 dsh 打包方式的几个事实:

- Electron 39 内置 Node 22.22.1,满足 dsh 的引擎下限(`^22.19 || >=24`),所以打包版用 Electron 自带的 Node 启动 dsh —— 无需系统 Node。
- 启动时传 `--expose-internals`,让 dsh 的模块加载器直接读取 Node 内部,而不是走 ABI 绑定的 `node-addon-require-builtin` 原生插件。
- `node-pty` 和 `koffi` 是 Node-API(ABI 稳定),所以 `npmRebuild: false` 让它们在 Electron 下原样加载。
- `--port 0` 让操作系统分配空闲端口;应用从 dsh 打印的 `dsh web:` 行读取真实 URL。
- `asar: false`,因为启动出来的 dsh 进程要直接读磁盘上的 `node_modules`。

`package.json` 里除了 `@deepseek-ai/dsh` CLI 之外,还声明了很多 `@deepseek-ai/dsh-*` 包。这份清单不是可有可无的:dsh 把这些包声明为 **peerDependencies**(运行时 import),而 electron-builder 只打包生产 `dependencies` 图,会漏掉 peer 依赖。如果升级 dsh 版本后新增了运行时 import,就要把缺失的 `@deepseek-ai/*` 包也加进来 —— 对比打包后的 `resources/app/node_modules/@deepseek-ai` 和开发环境的 `node_modules/@deepseek-ai` 即可找出缺口。

## 维护者

[@shi-YangYang](https://github.com/shi-YangYang)。

## 许可证

[MIT](LICENSE) © shi-YangYang
