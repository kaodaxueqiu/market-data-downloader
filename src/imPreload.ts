const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('imWindowControl', {
  minimize: () => ipcRenderer.send('im:minimize'),
  maximize: () => ipcRenderer.send('im:maximize'),
  close: () => ipcRenderer.send('im:close'),
  isMaximized: () => ipcRenderer.sendSync('im:isMaximized'),
  platform: process.platform === 'win32' ? 3 : process.platform === 'darwin' ? 4 : 7,
})
