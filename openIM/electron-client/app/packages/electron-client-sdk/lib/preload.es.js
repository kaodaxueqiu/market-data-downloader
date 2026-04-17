import { contextBridge, ipcRenderer } from 'electron';

const updateOnlineStatus = () => ipcRenderer.invoke('openim-sdk-ipc-methods', 'networkStatusChanged');
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
contextBridge.exposeInMainWorld('openIMRenderApi', {
    subscribe: (channel, callback) => {
        const subscription = (_, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    },
    imMethodsInvoke: (method, ...args) => ipcRenderer.invoke('openim-sdk-ipc-methods', method, ...args),
});
