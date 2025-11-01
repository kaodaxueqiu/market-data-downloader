import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },

  // 配置管理
  config: {
    get: (key?: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
    getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
    saveApiKey: (apiKey: string, name: string, isDefault: boolean) => 
      ipcRenderer.invoke('config:saveApiKey', apiKey, name, isDefault),
    saveApiKeyWithCredentials: (apiKey: string, name: string, isDefault: boolean) => 
      ipcRenderer.invoke('config:saveApiKeyWithCredentials', apiKey, name, isDefault),
    deleteApiKey: (id: string) => ipcRenderer.invoke('config:deleteApiKey', id),
    getFullApiKey: (id: string) => ipcRenderer.invoke('config:getFullApiKey', id),
    getDatabaseCredentials: (id: string) => ipcRenderer.invoke('config:getDatabaseCredentials', id),
    // 🆕 菜单权限相关
    getMenuPermissions: (apiKeyId: string) => ipcRenderer.invoke('config:getMenuPermissions', apiKeyId),
    refreshMenuPermissions: (apiKeyId: string) => ipcRenderer.invoke('config:refreshMenuPermissions', apiKeyId),
    refreshDefaultKeyPermissions: () => ipcRenderer.invoke('config:refreshDefaultKeyPermissions'),
    // 🆕 管理接口
    fetchAllApiKeys: () => ipcRenderer.invoke('config:fetchAllApiKeys'),
    fetchApiKeyDetail: (key: string) => ipcRenderer.invoke('config:fetchApiKeyDetail', key),
    createApiKey: (data: any) => ipcRenderer.invoke('config:createApiKey', data),
    updateApiKey: (key: string, data: any) => ipcRenderer.invoke('config:updateApiKey', key, data),
    deleteApiKeyAdmin: (key: string) => ipcRenderer.invoke('config:deleteApiKeyAdmin', key),
    revokeApiKey: (key: string) => ipcRenderer.invoke('config:revokeApiKey', key),
    reactivateApiKey: (key: string) => ipcRenderer.invoke('config:reactivateApiKey', key),
    fetchPermissionConfig: (key: string) => ipcRenderer.invoke('config:fetchPermissionConfig', key),
    fetchPermissionRegistry: () => ipcRenderer.invoke('config:fetchPermissionRegistry'),
    patchPermissionConfig: (key: string, updates: any) => ipcRenderer.invoke('config:patchPermissionConfig', key, updates)
  },

  // 对话框
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:showSaveDialog', options)
  },

  // Shell操作
  shell: {
    showItemInFolder: (filePath: string) => 
      ipcRenderer.invoke('shell:showItemInFolder', filePath),
    downloadFile: (url: string, savePath: string, onProgress?: (percent: number) => void) => {
      // 监听下载进度
      if (onProgress) {
        const progressHandler = (_event: any, data: any) => {
          if (data.url === url) {
            onProgress(data.percent)
          }
        }
        ipcRenderer.on('shell:download-progress', progressHandler)
      }
      return ipcRenderer.invoke('shell:downloadFile', url, savePath)
    },
    calculateMD5: (filePath: string) => 
      ipcRenderer.invoke('shell:calculateMD5', filePath)
  },

  // 下载管理 - 基于异步任务系统
  download: {
    // 新的任务系统API
    query: (params: any) => ipcRenderer.invoke('download:query', params),
    createTask: (params: any) => ipcRenderer.invoke('download:createTask', params),
    getTasks: () => ipcRenderer.invoke('download:getTasks'),
    getTask: (taskId: string) => ipcRenderer.invoke('download:getTask', taskId),
    cancelTask: (taskId: string) => ipcRenderer.invoke('download:cancelTask', taskId),
    downloadTaskFile: (taskId: string, filePath: string) => 
      ipcRenderer.invoke('download:downloadTaskFile', taskId, filePath),
    clearCompleted: () => ipcRenderer.invoke('download:clearCompleted'),
    
    // 兼容旧接口
    start: (params: any) => ipcRenderer.invoke('download:start', params),
    getProgress: (taskId: string) => ipcRenderer.invoke('download:getProgress', taskId),
    pause: (taskId: string) => ipcRenderer.invoke('download:pause', taskId),
    resume: (taskId: string) => ipcRenderer.invoke('download:resume', taskId),
    cancel: (taskId: string) => ipcRenderer.invoke('download:cancel', taskId),
    getHistory: () => ipcRenderer.invoke('download:getHistory'),
    clearHistory: (olderThanDays: number) => 
      ipcRenderer.invoke('download:clearHistory', olderThanDays)
  },

  // 数据字典 (53个数据源)
  dictionary: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('dictionary:setApiKey', apiKey),
    getMarkets: () => ipcRenderer.invoke('dictionary:getMarkets'),
    getSources: (market?: string) => ipcRenderer.invoke('dictionary:getSources', market),
    getSourceDetail: (code: string) => ipcRenderer.invoke('dictionary:getSourceDetail', code),
    getDecodedFormat: (code: string) => ipcRenderer.invoke('dictionary:getDecodedFormat', code),
    getRawFormat: (code: string) => ipcRenderer.invoke('dictionary:getRawFormat', code),
    getFields: (code: string, enabledOnly?: boolean) => ipcRenderer.invoke('dictionary:getFields', code, enabledOnly),
    search: (keyword: string) => ipcRenderer.invoke('dictionary:search', keyword),
    compare: (sourceCodes: string[]) => ipcRenderer.invoke('dictionary:compare', sourceCodes),
    getCode: (code: string, language: string) => ipcRenderer.invoke('dictionary:getCode', code, language),
    previewSource: (code: string) => ipcRenderer.invoke('dictionary:previewSource', code)
  },

  // 🆕 全局搜索
  search: {
    global: (keyword: string, limit?: number) => ipcRenderer.invoke('search:global', keyword, limit)
  },

  // 数据库字典 (PostgreSQL 755张表 + ClickHouse)
  dbdict: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('dbdict:setApiKey', apiKey),
    getTables: (params?: any) => ipcRenderer.invoke('dbdict:getTables', params),
    getTableDetail: (tableName: string, datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('dbdict:getTableDetail', tableName, datasource),
    getTableFields: (tableName: string, datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('dbdict:getTableFields', tableName, datasource),
    getCategories: (datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('dbdict:getCategories', datasource),
    search: (keyword: string, datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('dbdict:search', keyword, datasource),
    buildSQL: (params: any) => ipcRenderer.invoke('dbdict:buildSQL', params),
    getStats: (datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('dbdict:getStats', datasource),
    exportDict: (params: any) => ipcRenderer.invoke('dbdict:export', params),
    clearCache: (datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('dbdict:clearCache', datasource),
    downloadData: (params: any, savePath: string) => ipcRenderer.invoke('dbdict:downloadData', params, savePath),
    previewTable: (tableName: string, datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('dbdict:previewTable', tableName, datasource)
  },
  
  // 因子库API
  factor: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('factor:setApiKey', apiKey),
    getCategories: () => ipcRenderer.invoke('factor:getCategories'),
    getTags: (tagType?: string) => ipcRenderer.invoke('factor:getTags', tagType),
    getFactorList: (params: any) => ipcRenderer.invoke('factor:getFactorList', params),
    getFactorDetail: (factorId: number) => ipcRenderer.invoke('factor:getFactorDetail', factorId),
    downloadFactorData: (params: any) => ipcRenderer.invoke('factor:downloadFactorData', params),
    getFactorPerformance: (factorId: number, days?: number) => ipcRenderer.invoke('factor:getFactorPerformance', factorId, days)
  },

  // 静态数据下载 (异步任务系统 - PostgreSQL + ClickHouse)
  staticDownload: {
    createTask: (request: any, apiKey: string, datasource?: 'postgresql' | 'clickhouse') => 
      ipcRenderer.invoke('staticDownload:createTask', request, apiKey, datasource),
    getTaskStatus: (taskId: string, apiKey: string) => ipcRenderer.invoke('staticDownload:getTaskStatus', taskId, apiKey),
    downloadFile: (fileId: string, savePath: string, fileName: string, apiKey: string) => 
      ipcRenderer.invoke('staticDownload:downloadFile', fileId, savePath, fileName, apiKey)
  },

  // 自动更新
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
    quitAndInstall: (filePath: string) => ipcRenderer.invoke('updater:quitAndInstall', filePath)
  },

  // 事件监听
  on: (channel: string, callback: Function) => {
    const validChannels = [
      'download:start',
      'download:progress', 
      'download:complete',
      'download:completed',  // 添加completed事件
      'download:error',
      'download:pause',
      'download:resume',
      'download:cancel',
      'download:task-created',  // 新增任务事件
      'download:task-updated',
      'download:tasks-cleared',
      // 更新事件
      'updater:checking',
      'updater:update-available',
      'updater:update-not-available',
      'updater:download-progress',
      'updater:update-downloaded',
      'updater:error',
      'updater:start-download',
      // SDK下载进度
      'shell:download-progress'
    ]
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  // 移除事件监听
  off: (channel: string, callback: Function) => {
    ipcRenderer.removeListener(channel, callback as any)
  }
})

// 类型定义
declare global {
  interface Window {
    electronAPI: {
      app: {
        getVersion: () => Promise<string>
      }
      config: {
        get: (key?: string) => Promise<any>
        set: (key: string, value: any) => Promise<void>
        getApiKeys: () => Promise<any[]>
        saveApiKey: (apiKey: string, name: string, isDefault: boolean) => Promise<string>
        saveApiKeyWithCredentials: (apiKey: string, name: string, isDefault: boolean) => Promise<any>
        deleteApiKey: (id: string) => Promise<boolean>
        getFullApiKey: (id: string) => Promise<string | null>
        getDatabaseCredentials: (id: string) => Promise<any>
        // 🆕 菜单权限相关
        getMenuPermissions: (apiKeyId: string) => Promise<string[]>
        refreshMenuPermissions: (apiKeyId: string) => Promise<{ success: boolean; menuPermissions?: string[]; error?: string }>
        refreshDefaultKeyPermissions: () => Promise<{ success: boolean; menuPermissions?: string[]; error?: string }>
        // 🆕 管理接口
        fetchAllApiKeys: () => Promise<{ success: boolean; data?: any[]; total?: number; error?: string }>
        fetchApiKeyDetail: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>
        createApiKey: (data: any) => Promise<{ success: boolean; data?: any; error?: string }>
        updateApiKey: (key: string, data: any) => Promise<{ success: boolean; error?: string }>
        deleteApiKeyAdmin: (key: string) => Promise<{ success: boolean; error?: string }>
        revokeApiKey: (key: string) => Promise<{ success: boolean; error?: string }>
        reactivateApiKey: (key: string) => Promise<{ success: boolean; error?: string }>
        fetchPermissionConfig: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>
        fetchPermissionRegistry: () => Promise<{ success: boolean; data?: any; error?: string }>
        patchPermissionConfig: (key: string, updates: any) => Promise<{ success: boolean; error?: string }>
      }
      dialog: {
        selectDirectory: () => Promise<string | null>
        showSaveDialog: (options: any) => Promise<{ canceled: boolean, filePath?: string }>
      }
      shell: {
        showItemInFolder: (filePath: string) => Promise<void>
        downloadFile: (url: string, savePath: string, onProgress?: (percent: number) => void) => Promise<{ path: string, size: number }>
        calculateMD5: (filePath: string) => Promise<string>
      }
      download: {
        // 新的任务系统API
        query: (params: any) => Promise<any>
        createTask: (params: any) => Promise<string>
        getTasks: () => Promise<any[]>
        getTask: (taskId: string) => Promise<any>
        cancelTask: (taskId: string) => Promise<void>
        downloadTaskFile: (taskId: string, filePath: string) => Promise<void>
        clearCompleted: () => Promise<void>
        // 兼容旧接口
        start: (params: any) => Promise<string>
        getProgress: (taskId: string) => Promise<any>
        pause: (taskId: string) => Promise<boolean>
        resume: (taskId: string) => Promise<boolean>
        cancel: (taskId: string) => Promise<boolean>
        getHistory: () => Promise<any[]>
        clearHistory: (olderThanDays: number) => Promise<number>
      }
      dictionary: {
        setApiKey: (apiKey: string) => Promise<boolean>
        getMarkets: () => Promise<any>
        getSources: (market?: string) => Promise<any>
        getSourceDetail: (code: string) => Promise<any>
        getDecodedFormat: (code: string) => Promise<any>
        getRawFormat: (code: string) => Promise<any>
        getFields: (code: string, enabledOnly?: boolean) => Promise<any>
        search: (keyword: string) => Promise<any>
        compare: (sourceCodes: string[]) => Promise<any>
        getCode: (code: string, language: string) => Promise<any>
        previewSource: (code: string) => Promise<any>
      }
      search: {
        global: (keyword: string, limit?: number) => Promise<any>
      }
      dbdict: {
        setApiKey: (apiKey: string) => Promise<boolean>
        getTables: (params?: any) => Promise<any>
        getTableDetail: (tableName: string, datasource?: 'postgresql' | 'clickhouse') => Promise<any>
        getTableFields: (tableName: string, datasource?: 'postgresql' | 'clickhouse') => Promise<any>
        getCategories: (datasource?: 'postgresql' | 'clickhouse') => Promise<any>
        search: (keyword: string, datasource?: 'postgresql' | 'clickhouse') => Promise<any>
        buildSQL: (params: any) => Promise<any>
        getStats: (datasource?: 'postgresql' | 'clickhouse') => Promise<any>
        exportDict: (params: any) => Promise<any>
        clearCache: (datasource?: 'postgresql' | 'clickhouse') => Promise<any>
        downloadData: (params: any, savePath: string) => Promise<any>
        previewTable: (tableName: string, datasource?: 'postgresql' | 'clickhouse') => Promise<any>
      }
      factor: {
        setApiKey: (apiKey: string) => Promise<boolean>
        getCategories: () => Promise<any>
        getTags: (tagType?: string) => Promise<any>
        getFactorList: (params: any) => Promise<any>
        getFactorDetail: (factorId: number) => Promise<any>
        downloadFactorData: (params: any) => Promise<any>
        getFactorPerformance: (factorId: number, days?: number) => Promise<any>
      }
      staticDownload: {
        createTask: (request: any, apiKey: string, datasource?: 'postgresql' | 'clickhouse') => Promise<string>
        getTaskStatus: (taskId: string, apiKey: string) => Promise<any>
        downloadFile: (fileId: string, savePath: string, fileName: string, apiKey: string) => Promise<string>
      }
      updater: {
        checkForUpdates: () => Promise<any>
        downloadUpdate: () => Promise<any>
        quitAndInstall: (filePath: string) => Promise<boolean>
      }
      on: (channel: string, callback: Function) => void
      off: (channel: string, callback: Function) => void
    }
  }
}
