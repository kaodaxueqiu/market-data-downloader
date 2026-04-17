'use strict';

var electron = require('electron');

const updateOnlineStatus = () => electron.ipcRenderer.invoke('openim-sdk-ipc-methods', 'networkStatusChanged');
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
electron.contextBridge.exposeInMainWorld('openIMRenderApi', {
    subscribe: (channel, callback) => {
        const subscription = (_, ...args) => callback(...args);
        electron.ipcRenderer.on(channel, subscription);
        return () => electron.ipcRenderer.removeListener(channel, subscription);
    },
    imMethodsInvoke: (method, ...args) => electron.ipcRenderer.invoke('openim-sdk-ipc-methods', method, ...args),
});
