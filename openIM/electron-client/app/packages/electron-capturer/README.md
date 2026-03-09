# Electron Capturer

Electron + React + Konva 的桌面截屏与标注 overlay，已整理成可复用的 npm 包，可在其它 Electron 应用内通过 API 直接拉起截屏 UI。

## 快速集成到现有 Electron 应用

1. 安装（发布后可直接 `pnpm add @openim/electron-capturer`，当前仓库可本地 link/安装）

```bash
pnpm install
pnpm run build   # 生成 dist + dist-electron（发包时需要）
```

2. 主进程注册 IPC

```ts
// main.ts
import { app } from "electron";
import { createCapturer } from "@openim/electron-capturer";

const capturer = createCapturer({
  // 可选：自定义保存逻辑
  // onSave: async (dataUrl) => ({ canceled: false, filePath: await saveSomewhere(dataUrl) })
  // 可选：多语言/文案覆盖
  // texts: {
  //   escHint: 'Press Esc to exit',
  //   loading: 'Loading…',
  //   toolbar: { save: 'Save', copy: 'Copy', cancel: 'Cancel', confirm: 'Done' }
  // }
});

app.whenReady().then(() => {
  capturer.registerIpc();
});
```

3. BrowserWindow 使用内置 preload（暴露 `window.electronCapturer`）

```ts
const preload = require.resolve("@openim/electron-capturer/preload");
const win = new BrowserWindow({
  webPreferences: {
    preload,
    contextIsolation: true,
    sandbox: false,
  },
});
```

4. 渲染进程调用 API

```ts
// renderer
await window.electronCapturer?.startOverlay(); // 拉起全屏 overlay 截屏
await window.electronCapturer?.startOverlay({ hideCurrentWindow: true }); // 启动时先隐藏当前窗口
await window.electronCapturer?.startOverlay({ thumbnailScale: 0.4 }); // 降低分辨率以加快抓取
await window.electronCapturer?.closeOverlay(); // 关闭
await window.electronCapturer?.switchOverlayScreen(displayId); // 多屏切换
window.electronCapturer?.onOverlayInit((payload) => {
  /* 收到主进程下发的截图数据 */
});
window.electronCapturer?.onCaptureResult?.(({ dataUrl }) => {
  /* 拿到标注后的图片 */
});
```

Overlay 窗口的 UI 与交互已内置在包里的 renderer（默认加载首页 `dist-electron/renderer/index.html`），无需额外配置。`createCapturer` 会自动根据 `ELECTRON_RENDERER_URL` / `VITE_DEV_SERVER_URL` 走开发模式，否则读取打包后的页面与 preload。

## 仓库开发/构建

- `pnpm run dev`：electron-vite 开发模式（示例应用会加载同一套 renderer）。
- `pnpm run build`：输出 `dist`（npm 包入口，含类型声明）与 `dist-electron`（main/preload/renderer 运行文件）。
- 其它：`npm run build:web` 生成纯 Web 版本，`build:win/mac/linux` 用 electron-builder 打包示例应用。

## 包含的功能

- 主进程 desktopCapturer 捕获全屏、多显示器 thumbnail 并下发到 overlay。
- 透明 overlay（frameless + alwaysOnTop），React + Konva 支持矩形、画笔、箭头、文字、马赛克、撤销/重做、区域导出与保存。
- 预设 IPC：`capture:screens`、`overlay:start/close/switch-screen/lower/raise`、`capture:save`，配套 `window.electronCapturer` API。

## Demo 项目（本地 link 测试）

仓库内 `demo-app/` 是一个最小 Electron 项目，依赖本包的预置 preload 与 overlay：

```bash
pnpm run build      # 在包根目录生成 dist + dist-electron
cd demo-app
pnpm install        # demo 的 package.json 使用 "file:.." 直接引用上级目录
pnpm start          # 打开 demo，点击“开始截屏”调用 overlay
```
