import { app, BrowserWindow } from 'electron';
import path from 'path';
import { createCapturer } from './capturer';

const devRendererUrl = process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL;
const capturer = createCapturer();

const loadRenderer = (win: BrowserWindow, hash = '') => {
  const entry = capturer.getRendererEntry(hash);
  if (!entry) {
    throw new Error('未找到 renderer 入口，请先执行构建。');
  }
  if (entry.startsWith('http')) {
    void win.loadURL(entry);
    return;
  }
  if (entry.includes('#')) {
    const [filePath, anchor] = entry.split('#');
    void win.loadFile(filePath, { hash: anchor });
    return;
  }
  if (hash) {
    void win.loadFile(entry, { hash: hash.replace(/^#/, '') });
  } else {
    void win.loadFile(entry);
  }
};

const createWindow = () => {
  const preload =
    capturer.getPreloadPath() || path.join(__dirname, '..', 'preload', 'index.js');

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  loadRenderer(mainWindow);
  if (devRendererUrl) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

app.whenReady().then(() => {
  capturer.registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
