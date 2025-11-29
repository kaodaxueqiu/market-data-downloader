import { contextBridge, ipcRenderer } from 'electron'

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPath: (name: 'desktop' | 'downloads' | 'documents') => ipcRenderer.invoke('app:getPath', name)
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
    patchPermissionConfig: (key: string, updates: any) => ipcRenderer.invoke('config:patchPermissionConfig', key, updates),
    fetchDatabaseConfig: (key: string) => ipcRenderer.invoke('config:fetchDatabaseConfig', key),
    updateDatabaseConfig: (key: string, config: any) => ipcRenderer.invoke('config:updateDatabaseConfig', key, config)
  },

  // 对话框
  dialog: {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:showOpenDialog', options)
  },

  // Shell操作
  shell: {
    showItemInFolder: (filePath: string) => 
      ipcRenderer.invoke('shell:showItemInFolder', filePath),
    openPath: (path: string) => 
      ipcRenderer.invoke('shell:openPath', path),
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

  // 🆕 WebSocket 实时订阅（任务管理模式）
  subscription: {
    connect: (apiKey: string) => ipcRenderer.invoke('subscription:connect', apiKey),
    disconnect: () => ipcRenderer.invoke('subscription:disconnect'),
    getWebSocketStatus: () => ipcRenderer.invoke('subscription:getWebSocketStatus'),
    createTask: (apiKey: string, config: any) => ipcRenderer.invoke('subscription:createTask', apiKey, config),
    stopTask: (taskId: string) => ipcRenderer.invoke('subscription:stopTask', taskId),
    disconnectTask: (taskId: string) => ipcRenderer.invoke('subscription:disconnectTask', taskId),
    getAllTasks: () => ipcRenderer.invoke('subscription:getAllTasks'),
    getTask: (taskId: string) => ipcRenderer.invoke('subscription:getTask', taskId),
    // WebSocket 事件监听
    onConnected: (callback: () => void) => ipcRenderer.on('ws:connected', callback),
    onDisconnected: (callback: () => void) => ipcRenderer.on('ws:disconnected', callback),
    onData: (callback: (event: any, data: any) => void) => ipcRenderer.on('ws:data', callback),
    onError: (callback: (event: any, error: string) => void) => ipcRenderer.on('ws:error', callback),
    onStats: (callback: (event: any, stats: any) => void) => ipcRenderer.on('ws:stats', callback),
    onSubscribed: (callback: (event: any, data: any) => void) => ipcRenderer.on('ws:subscribed', callback),
    // 移除监听器
    removeListener: (channel: string, callback: any) => ipcRenderer.removeListener(channel, callback)
  },

  // 数据库字典 (PostgreSQL 755张表 + ClickHouse)
  dbdict: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('dbdict:setApiKey', apiKey),
    getDatasources: () => ipcRenderer.invoke('dbdict:getDatasources'),
    getTables: (params?: any) => ipcRenderer.invoke('dbdict:getTables', params),
    getTableDetail: (tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
      ipcRenderer.invoke('dbdict:getTableDetail', tableName, datasource),
    getTableFields: (tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
      ipcRenderer.invoke('dbdict:getTableFields', tableName, datasource),
    getCategories: (datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
      ipcRenderer.invoke('dbdict:getCategories', datasource),
    search: (keyword: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
      ipcRenderer.invoke('dbdict:search', keyword, datasource),
    buildSQL: (params: any) => ipcRenderer.invoke('dbdict:buildSQL', params),
    getStats: (datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
      ipcRenderer.invoke('dbdict:getStats', datasource),
    exportDict: (params: any) => ipcRenderer.invoke('dbdict:export', params),
    clearCache: (datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
      ipcRenderer.invoke('dbdict:clearCache', datasource),
    downloadData: (params: any, savePath: string) => ipcRenderer.invoke('dbdict:downloadData', params, savePath),
    previewTable: (tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
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

  // 基金管理API
  fund: {
    setApiKey: (apiKey: string) => ipcRenderer.invoke('fund:setApiKey', apiKey),
    getCustodians: () => ipcRenderer.invoke('fund:getCustodians'),
    getBrokers: () => ipcRenderer.invoke('fund:getBrokers'),
    createFund: (fundData: any) => ipcRenderer.invoke('fund:createFund', fundData),
    getFundList: (params?: any) => ipcRenderer.invoke('fund:getFundList', params),
    getFundDetail: (code: string) => ipcRenderer.invoke('fund:getFundDetail', code),
    updateFund: (code: string, fundData: any) => ipcRenderer.invoke('fund:updateFund', code, fundData),
    deleteFund: (code: string) => ipcRenderer.invoke('fund:deleteFund', code),
    liquidateFund: (code: string, liquidateDate: string, reason?: string) => ipcRenderer.invoke('fund:liquidateFund', code, liquidateDate, reason),
    restoreFund: (code: string, restoreDate: string, reason?: string) => ipcRenderer.invoke('fund:restoreFund', code, restoreDate, reason),
    uploadReport: (formData: any) => ipcRenderer.invoke('fund:uploadReport', formData),
    getReportList: (params?: any) => ipcRenderer.invoke('fund:getReportList', params),
    getReportDownloadUrl: (reportId: number) => ipcRenderer.invoke('fund:getReportDownloadUrl', reportId),
    deleteReport: (reportId: number) => ipcRenderer.invoke('fund:deleteReport', reportId),
    // 净值管理
    createNav: (data: any) => ipcRenderer.invoke('fund:createNav', data),
    getNavList: (params?: any) => ipcRenderer.invoke('fund:getNavList', params),
    getNavDetail: (navId: number) => ipcRenderer.invoke('fund:getNavDetail', navId),
    updateNav: (navId: number, data: any) => ipcRenderer.invoke('fund:updateNav', navId, data),
    deleteNav: (navId: number) => ipcRenderer.invoke('fund:deleteNav', navId),
    getFundNavHistory: (code: string, params?: any) => ipcRenderer.invoke('fund:getFundNavHistory', code, params),
    getLatestNav: (code: string) => ipcRenderer.invoke('fund:getLatestNav', code),
    getNavChart: (code: string, days: number) => ipcRenderer.invoke('fund:getNavChart', code, days),
    getNavStatistics: (code: string) => ipcRenderer.invoke('fund:getNavStatistics', code),
    // 申购赎回
    createTransaction: (data: any) => ipcRenderer.invoke('fund:createTransaction', data),
    getTransactionList: (params?: any) => ipcRenderer.invoke('fund:getTransactionList', params),
    confirmTransaction: (transId: number, data: any) => ipcRenderer.invoke('fund:confirmTransaction', transId, data),
    cancelTransaction: (transId: number) => ipcRenderer.invoke('fund:cancelTransaction', transId),
    getFundTransactions: (code: string, params?: any) => ipcRenderer.invoke('fund:getFundTransactions', code, params),
    // 基础信息维护
    createCustodian: (data: any) => ipcRenderer.invoke('fund:createCustodian', data),
    updateCustodian: (id: number, data: any) => ipcRenderer.invoke('fund:updateCustodian', id, data),
    deleteCustodian: (id: number) => ipcRenderer.invoke('fund:deleteCustodian', id),
    createBroker: (data: any) => ipcRenderer.invoke('fund:createBroker', data),
    updateBroker: (id: number, data: any) => ipcRenderer.invoke('fund:updateBroker', id, data),
    deleteBroker: (id: number) => ipcRenderer.invoke('fund:deleteBroker', id),
    // 投资者管理
    createInvestor: (data: any) => ipcRenderer.invoke('fund:createInvestor', data),
    getInvestorList: (params?: any) => ipcRenderer.invoke('fund:getInvestorList', params),
    getInvestorDetail: (id: number) => ipcRenderer.invoke('fund:getInvestorDetail', id),
    updateInvestor: (id: number, data: any) => ipcRenderer.invoke('fund:updateInvestor', id, data),
    deleteInvestor: (id: number) => ipcRenderer.invoke('fund:deleteInvestor', id),
    qualifyInvestor: (id: number, data: any) => ipcRenderer.invoke('fund:qualifyInvestor', id, data),
    riskAssessInvestor: (id: number, data: any) => ipcRenderer.invoke('fund:riskAssessInvestor', id, data),
    getInvestorStatistics: () => ipcRenderer.invoke('fund:getInvestorStatistics')
  },

  // 账户/菜单管理
  account: {
    getMyMenus: () => ipcRenderer.invoke('account:getMyMenus'),
    getAllMenus: () => ipcRenderer.invoke('account:getAllMenus')
  },

  // Git 操作（本地 Git 命令）
  git: {
    // 下载代码（纯下载，不建立关联）
    clone: (repoUrl: string, localPath: string, repoFullName: string) => 
      ipcRenderer.invoke('git:clone', repoUrl, localPath, repoFullName),
    // 同步操作
    pull: (localPath: string) => ipcRenderer.invoke('git:pull', localPath),
    push: (localPath: string) => ipcRenderer.invoke('git:push', localPath),
    // 状态查看
    status: (localPath: string) => ipcRenderer.invoke('git:status', localPath),
    diff: (localPath: string, filePath?: string) => ipcRenderer.invoke('git:diff', localPath, filePath),
    diffStaged: (localPath: string, filePath?: string) => ipcRenderer.invoke('git:diffStaged', localPath, filePath),
    // 提交操作
    add: (localPath: string, files: string | string[]) => ipcRenderer.invoke('git:add', localPath, files),
    commit: (localPath: string, message: string) => ipcRenderer.invoke('git:commit', localPath, message),
    // 标签操作
    getLocalTags: (localPath: string) => ipcRenderer.invoke('git:getLocalTags', localPath),
    tagExists: (localPath: string, tagName: string) => ipcRenderer.invoke('git:tagExists', localPath, tagName),
    createTag: (localPath: string, tagName: string, message?: string) => ipcRenderer.invoke('git:createTag', localPath, tagName, message),
    pushTags: (localPath: string) => ipcRenderer.invoke('git:pushTags', localPath),
    // 关联管理（持久化）
    getLocalPath: (repoFullName: string) => ipcRenderer.invoke('git:getLocalPath', repoFullName),
    setLocalPath: (repoFullName: string, localPath: string) => ipcRenderer.invoke('git:setLocalPath', repoFullName, localPath),
    removeLocalPath: (repoFullName: string) => ipcRenderer.invoke('git:removeLocalPath', repoFullName),
    getAllLocalPaths: () => ipcRenderer.invoke('git:getAllLocalPaths'),
    // 智能关联（检测状态 + 自动初始化）
    checkLocalStatus: (localPath: string) => ipcRenderer.invoke('git:checkLocalStatus', localPath),
    initAndLink: (localPath: string, repoFullName: string, remoteUrl: string) => 
      ipcRenderer.invoke('git:initAndLink', localPath, repoFullName, remoteUrl),
    // 文件内容
    getFileContent: (localPath: string, filePath: string) => ipcRenderer.invoke('git:getFileContent', localPath, filePath),
    getRemoteFileContent: (localPath: string, filePath: string) => ipcRenderer.invoke('git:getRemoteFileContent', localPath, filePath)
  },

  // Gitea API（通过主进程调用，避免CORS）
  gitea: {
    // 仓库查询
    getOrgRepos: (org: string) => ipcRenderer.invoke('gitea:getOrgRepos', org),
    getUserRepos: (username: string) => ipcRenderer.invoke('gitea:getUserRepos', username),
    getUserAccessibleRepos: (org: string, username: string) => ipcRenderer.invoke('gitea:getUserAccessibleRepos', org, username),
    getRepo: (owner: string, repo: string) => ipcRenderer.invoke('gitea:getRepo', owner, repo),
    getBranches: (owner: string, repo: string) => ipcRenderer.invoke('gitea:getBranches', owner, repo),
    getTags: (owner: string, repo: string) => ipcRenderer.invoke('gitea:getTags', owner, repo),
    getCommits: (owner: string, repo: string, params?: any) => ipcRenderer.invoke('gitea:getCommits', owner, repo, params),
    // 仓库管理（管理员）
    createRepo: (org: string, repoData: { name: string; description?: string; private?: boolean }) => 
      ipcRenderer.invoke('gitea:createRepo', org, repoData),
    editRepo: (owner: string, repo: string, repoData: any) => ipcRenderer.invoke('gitea:editRepo', owner, repo, repoData),
    deleteRepo: (owner: string, repo: string) => ipcRenderer.invoke('gitea:deleteRepo', owner, repo),
    // 协作者管理
    getRepoCollaborators: (owner: string, repo: string) => ipcRenderer.invoke('gitea:getRepoCollaborators', owner, repo),
    addCollaborator: (owner: string, repo: string, username: string, permission?: string) => 
      ipcRenderer.invoke('gitea:addCollaborator', owner, repo, username, permission),
    removeCollaborator: (owner: string, repo: string, username: string) => 
      ipcRenderer.invoke('gitea:removeCollaborator', owner, repo, username),
    // 组织成员
    getOrgMembers: (org: string) => ipcRenderer.invoke('gitea:getOrgMembers', org),
    // 团队管理
    getOrgTeams: (org: string) => ipcRenderer.invoke('gitea:getOrgTeams', org),
    createTeam: (org: string, teamData: { name: string; description?: string; permission?: string }) => 
      ipcRenderer.invoke('gitea:createTeam', org, teamData),
    editTeam: (teamId: number, teamData: any) => ipcRenderer.invoke('gitea:editTeam', teamId, teamData),
    deleteTeam: (teamId: number) => ipcRenderer.invoke('gitea:deleteTeam', teamId),
    getTeamMembers: (teamId: number) => ipcRenderer.invoke('gitea:getTeamMembers', teamId),
    addTeamMember: (teamId: number, username: string) => ipcRenderer.invoke('gitea:addTeamMember', teamId, username),
    removeTeamMember: (teamId: number, username: string) => ipcRenderer.invoke('gitea:removeTeamMember', teamId, username),
    // 用户管理
    getAllUsers: () => ipcRenderer.invoke('gitea:getAllUsers'),
    createUser: (userData: { username: string; email: string; password: string; full_name?: string; must_change_password?: boolean }) => 
      ipcRenderer.invoke('gitea:createUser', userData),
    editUser: (username: string, userData: { full_name?: string; email?: string; active?: boolean; admin?: boolean }) => 
      ipcRenderer.invoke('gitea:editUser', username, userData),
    deleteUser: (username: string) => ipcRenderer.invoke('gitea:deleteUser', username)
  },

  // 静态数据下载 (异步任务系统 - PostgreSQL + ClickHouse)
  staticDownload: {
    createTask: (request: any, apiKey: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => 
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
        getPath: (name: 'desktop' | 'downloads' | 'documents') => Promise<string>
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
        fetchDatabaseConfig: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>
        updateDatabaseConfig: (key: string, config: any) => Promise<{ success: boolean; error?: string }>
      }
      dialog: {
        selectDirectory: () => Promise<string | null>
        showSaveDialog: (options: any) => Promise<{ canceled: boolean, filePath?: string }>
        showOpenDialog: (options: any) => Promise<{ canceled: boolean, filePaths: string[] }>
      }
      shell: {
        showItemInFolder: (filePath: string) => Promise<void>
        openPath: (path: string) => Promise<string>
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
      subscription: {
        connect: (apiKey: string) => Promise<any>
        disconnect: () => Promise<any>
        getWebSocketStatus: () => Promise<any>
        createTask: (apiKey: string, config: any) => Promise<any>
        stopTask: (taskId: string) => Promise<any>
        disconnectTask: (taskId: string) => Promise<any>
        getAllTasks: () => Promise<any[]>
        getTask: (taskId: string) => Promise<any>
        onConnected: (callback: () => void) => void
        onDisconnected: (callback: () => void) => void
        onData: (callback: (event: any, data: any) => void) => void
        onError: (callback: (event: any, error: string) => void) => void
        onStats: (callback: (event: any, stats: any) => void) => void
        onSubscribed: (callback: (event: any, data: any) => void) => void
        removeListener: (channel: string, callback: any) => void
      }
      dbdict: {
        setApiKey: (apiKey: string) => Promise<boolean>
        getDatasources: () => Promise<any>
        getTables: (params?: any) => Promise<any>
        getTableDetail: (tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<any>
        getTableFields: (tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<any>
        getCategories: (datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<any>
        search: (keyword: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<any>
        buildSQL: (params: any) => Promise<any>
        getStats: (datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<any>
        exportDict: (params: any) => Promise<any>
        clearCache: (datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<any>
        downloadData: (params: any, savePath: string) => Promise<any>
        previewTable: (tableName: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<any>
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
      fund: {
        setApiKey: (apiKey: string) => Promise<boolean>
        getCustodians: () => Promise<any>
        getBrokers: () => Promise<any>
        createFund: (fundData: any) => Promise<any>
        getFundList: (params?: any) => Promise<any>
        getFundDetail: (code: string) => Promise<any>
        updateFund: (code: string, fundData: any) => Promise<any>
        deleteFund: (code: string) => Promise<any>
        liquidateFund: (code: string, liquidateDate: string, reason?: string) => Promise<any>
        restoreFund: (code: string, restoreDate: string, reason?: string) => Promise<any>
        uploadReport: (formData: any) => Promise<any>
        getReportList: (params?: any) => Promise<any>
        getReportDownloadUrl: (reportId: number) => Promise<any>
        deleteReport: (reportId: number) => Promise<any>
        createNav: (data: any) => Promise<any>
        getNavList: (params?: any) => Promise<any>
        getNavDetail: (navId: number) => Promise<any>
        updateNav: (navId: number, data: any) => Promise<any>
        deleteNav: (navId: number) => Promise<any>
        getFundNavHistory: (code: string, params?: any) => Promise<any>
        getLatestNav: (code: string) => Promise<any>
        getNavChart: (code: string, days: number) => Promise<any>
        getNavStatistics: (code: string) => Promise<any>
        createTransaction: (data: any) => Promise<any>
        getTransactionList: (params?: any) => Promise<any>
        confirmTransaction: (transId: number, data: any) => Promise<any>
        cancelTransaction: (transId: number) => Promise<any>
        getFundTransactions: (code: string, params?: any) => Promise<any>
        createCustodian: (data: any) => Promise<any>
        updateCustodian: (id: number, data: any) => Promise<any>
        deleteCustodian: (id: number) => Promise<any>
        createBroker: (data: any) => Promise<any>
        updateBroker: (id: number, data: any) => Promise<any>
        deleteBroker: (id: number) => Promise<any>
        createInvestor: (data: any) => Promise<any>
        getInvestorList: (params?: any) => Promise<any>
        getInvestorDetail: (id: number) => Promise<any>
        updateInvestor: (id: number, data: any) => Promise<any>
        deleteInvestor: (id: number) => Promise<any>
        qualifyInvestor: (id: number, data: any) => Promise<any>
        riskAssessInvestor: (id: number, data: any) => Promise<any>
        getInvestorStatistics: () => Promise<any>
      }
      account: {
        getMyMenus: () => Promise<any>
        getAllMenus: () => Promise<any>
      }
      git: {
        clone: (repoUrl: string, localPath: string, repoFullName: string) => Promise<{ success: boolean; message?: string; data?: any; error?: string }>
        pull: (localPath: string) => Promise<{ success: boolean; message?: string; error?: string }>
        push: (localPath: string) => Promise<{ success: boolean; message?: string; error?: string }>
        status: (localPath: string) => Promise<{ success: boolean; data?: Array<{ status: string; file: string; staged: boolean; type: string }>; error?: string }>
        diff: (localPath: string, filePath?: string) => Promise<{ success: boolean; data?: string; error?: string }>
        diffStaged: (localPath: string, filePath?: string) => Promise<{ success: boolean; data?: string; error?: string }>
        add: (localPath: string, files: string | string[]) => Promise<{ success: boolean; message?: string; error?: string }>
        commit: (localPath: string, message: string) => Promise<{ success: boolean; message?: string; error?: string }>
        tagExists: (localPath: string, tagName: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>
        createTag: (localPath: string, tagName: string, message?: string) => Promise<{ success: boolean; message?: string; error?: string }>
        pushTags: (localPath: string) => Promise<{ success: boolean; message?: string; error?: string }>
        getLocalPath: (repoFullName: string) => Promise<{ success: boolean; data?: string | null; error?: string }>
        setLocalPath: (repoFullName: string, localPath: string) => Promise<{ success: boolean; error?: string }>
        removeLocalPath: (repoFullName: string) => Promise<{ success: boolean }>
        getAllLocalPaths: () => Promise<{ success: boolean; data?: Record<string, string> }>
        getFileContent: (localPath: string, filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
        getRemoteFileContent: (localPath: string, filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
      }
      gitea: {
        getOrgRepos: (org: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        getUserRepos: (username: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        getUserAccessibleRepos: (org: string, username: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        getRepo: (owner: string, repo: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getBranches: (owner: string, repo: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        getTags: (owner: string, repo: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        getCommits: (owner: string, repo: string, params?: any) => Promise<{ success: boolean; data?: any[]; error?: string }>
        createRepo: (org: string, repoData: { name: string; description?: string; private?: boolean }) => Promise<{ success: boolean; data?: any; error?: string }>
        editRepo: (owner: string, repo: string, repoData: any) => Promise<{ success: boolean; data?: any; error?: string }>
        deleteRepo: (owner: string, repo: string) => Promise<{ success: boolean; error?: string }>
        getRepoCollaborators: (owner: string, repo: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        addCollaborator: (owner: string, repo: string, username: string, permission?: string) => Promise<{ success: boolean; error?: string }>
        removeCollaborator: (owner: string, repo: string, username: string) => Promise<{ success: boolean; error?: string }>
        getOrgMembers: (org: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        // 团队管理
        getOrgTeams: (org: string) => Promise<{ success: boolean; data?: any[]; error?: string }>
        createTeam: (org: string, teamData: { name: string; description?: string; permission?: string }) => Promise<{ success: boolean; data?: any; error?: string }>
        editTeam: (teamId: number, teamData: any) => Promise<{ success: boolean; data?: any; error?: string }>
        deleteTeam: (teamId: number) => Promise<{ success: boolean; error?: string }>
        getTeamMembers: (teamId: number) => Promise<{ success: boolean; data?: any[]; error?: string }>
        addTeamMember: (teamId: number, username: string) => Promise<{ success: boolean; error?: string }>
        removeTeamMember: (teamId: number, username: string) => Promise<{ success: boolean; error?: string }>
        getAllUsers: () => Promise<{ success: boolean; data?: any[]; error?: string }>
        createUser: (userData: { username: string; email: string; password: string; full_name?: string; must_change_password?: boolean }) => Promise<{ success: boolean; data?: any; error?: string }>
        editUser: (username: string, userData: { full_name?: string; email?: string; active?: boolean; admin?: boolean }) => Promise<{ success: boolean; data?: any; error?: string }>
        deleteUser: (username: string) => Promise<{ success: boolean; error?: string }>
      }
      staticDownload: {
        createTask: (request: any, apiKey: string, datasource?: 'postgresql' | 'clickhouse' | 'clickhouse_data') => Promise<string>
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
