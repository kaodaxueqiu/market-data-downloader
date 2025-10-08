# 客户端自动更新接口文档

## 📋 概述

为 Electron 桌面应用（Market Data Downloader）提供自动更新服务。

**服务器地址**: `http://61.151.241.233:8080`

**认证方式**: 无需认证，公开访问

---

## 🔌 接口列表

### 1. 获取最新版本信息

获取当前最新版本号、下载链接、更新说明等信息。

#### 请求

```
GET /api/v1/client/version/latest
```

#### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "version": "1.3.3",
    "release_date": "2025-10-08T18:00:00Z",
    "release_notes": "## 🎉 v1.3.3 更新内容\n\n### 新功能\n- ✅ 自动更新功能\n- ✅ 菜单优化为子菜单结构",
    "downloads": {
      "windows": {
        "url": "http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3.exe",
        "size": 73012224,
        "md5": "abc123def456..."
      },
      "mac_intel": {
        "url": "http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3-mac.zip",
        "size": 107020288,
        "md5": "def456..."
      },
      "mac_arm64": {
        "url": "http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3-arm64-mac.zip",
        "size": 102040576,
        "md5": "ghi789..."
      }
    },
    "minimum_version": "1.0.0",
    "force_update": false
  }
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | string | 最新版本号（如 "1.3.3"） |
| `release_date` | string | 发布时间（ISO 8601 格式） |
| `release_notes` | string | 更新说明（支持 Markdown） |
| `downloads.windows.url` | string | Windows 版本下载地址 |
| `downloads.windows.size` | number | 文件大小（字节） |
| `downloads.windows.md5` | string | MD5 校验值 |
| `downloads.mac_intel.url` | string | macOS Intel 版本下载地址 |
| `downloads.mac_arm64.url` | string | macOS ARM64 版本下载地址 |
| `minimum_version` | string | 最低支持版本（低于此版本建议强制更新） |
| `force_update` | boolean | 是否强制更新 |

---

### 2. 下载文件

下载客户端安装包。

#### 请求

```
GET /downloads/{filename}
```

#### 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `filename` | string | 是 | 文件名（从版本信息接口获取） |

#### 示例

```
GET /downloads/Market-Data-Downloader-1.3.3.exe
```

#### 响应

- **Content-Type**: `application/octet-stream`
- **Content-Disposition**: `attachment; filename="Market-Data-Downloader-1.3.3.exe"`
- 返回文件二进制流
- **支持断点续传**（Accept-Ranges: bytes）

#### 错误响应

**文件不存在（404）:**
```json
{
  "code": 404,
  "message": "文件不存在"
}
```

**非法文件名（400）:**
```json
{
  "code": 400,
  "message": "非法文件名"
}
```

---

### 3. 获取文件信息（可选）

获取文件详细信息，用于调试或显示下载前的文件信息。

#### 请求

```
GET /api/v1/client/file-info/{filename}
```

#### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "filename": "Market-Data-Downloader-1.3.3.exe",
    "size": 73012224,
    "md5": "abc123def456...",
    "modified_at": "2025-10-08T18:00:00Z"
  }
}
```

---

## 💻 前端集成示例

### Electron 主进程代码

```javascript
const { app, dialog } = require('electron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPDATE_SERVER = 'http://61.151.241.233:8080';
const CURRENT_VERSION = app.getVersion(); // 如 "1.3.2"

// 1. 检查更新
async function checkForUpdates() {
  try {
    const response = await axios.get(`${UPDATE_SERVER}/api/v1/client/version/latest`);
    
    if (response.data.code !== 200) {
      console.error('检查更新失败:', response.data.message);
      return null;
    }
    
    const latestVersion = response.data.data.version;
    
    // 比较版本号
    if (compareVersions(latestVersion, CURRENT_VERSION) > 0) {
      return response.data.data; // 返回更新信息
    }
    
    return null; // 已是最新版本
  } catch (error) {
    console.error('检查更新异常:', error);
    return null;
  }
}

// 2. 下载更新
async function downloadUpdate(updateInfo) {
  const platform = process.platform;
  let downloadInfo;
  
  // 根据平台选择下载地址
  if (platform === 'win32') {
    downloadInfo = updateInfo.downloads.windows;
  } else if (platform === 'darwin') {
    const arch = process.arch;
    downloadInfo = arch === 'arm64' 
      ? updateInfo.downloads.mac_arm64 
      : updateInfo.downloads.mac_intel;
  } else {
    throw new Error('不支持的平台');
  }
  
  const downloadUrl = downloadInfo.url;
  const expectedMD5 = downloadInfo.md5;
  const fileSize = downloadInfo.size;
  
  // 下载文件
  const filename = path.basename(downloadUrl);
  const downloadPath = path.join(app.getPath('temp'), filename);
  
  console.log('开始下载:', downloadUrl);
  
  const writer = fs.createWriteStream(downloadPath);
  
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'stream',
    onDownloadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / fileSize
      );
      console.log(`下载进度: ${percentCompleted}%`);
      // 可以通过 IPC 发送进度给渲染进程
      // mainWindow.webContents.send('download-progress', percentCompleted);
    }
  });
  
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      // 验证 MD5
      if (expectedMD5) {
        const fileMD5 = calculateMD5(downloadPath);
        if (fileMD5 !== expectedMD5) {
          reject(new Error('文件校验失败'));
          return;
        }
      }
      resolve(downloadPath);
    });
    writer.on('error', reject);
  });
}

// 3. 安装更新
async function installUpdate(filePath) {
  const platform = process.platform;
  
  if (platform === 'win32') {
    // Windows: 运行 exe 文件
    const { shell } = require('electron');
    await shell.openPath(filePath);
    app.quit(); // 退出当前应用
  } else if (platform === 'darwin') {
    // macOS: 解压 zip 并替换应用
    // 这里需要更复杂的逻辑，建议使用 electron-updater 库
    console.log('请手动安装:', filePath);
  }
}

// 4. 版本号比较
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

// 5. 计算 MD5
function calculateMD5(filePath) {
  const buffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('md5');
  hash.update(buffer);
  return hash.digest('hex');
}

// 6. 完整更新流程
async function performUpdate() {
  console.log('检查更新...');
  const updateInfo = await checkForUpdates();
  
  if (!updateInfo) {
    console.log('已是最新版本');
    return;
  }
  
  // 显示更新提示
  const result = await dialog.showMessageBox({
    type: 'info',
    title: '发现新版本',
    message: `发现新版本 ${updateInfo.version}`,
    detail: updateInfo.release_notes,
    buttons: ['立即更新', '稍后提醒'],
    defaultId: 0
  });
  
  if (result.response === 0) {
    try {
      console.log('下载更新...');
      const filePath = await downloadUpdate(updateInfo);
      
      console.log('准备安装...');
      await installUpdate(filePath);
    } catch (error) {
      console.error('更新失败:', error);
      dialog.showErrorBox('更新失败', error.message);
    }
  }
}

// 导出
module.exports = {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  performUpdate
};
```

### 使用方式

```javascript
// 在 main.js 中
const { performUpdate } = require('./updater');

app.on('ready', () => {
  // 应用启动时检查更新
  setTimeout(() => {
    performUpdate();
  }, 3000); // 延迟3秒检查，避免影响启动速度
});

// 或者添加菜单项让用户手动检查
const { Menu } = require('electron');

const template = [
  {
    label: '帮助',
    submenu: [
      {
        label: '检查更新',
        click: () => {
          performUpdate();
        }
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
```

---

## 🔒 安全说明

1. **接口公开访问**: 这些接口无需 API Key 认证，任何人都可以访问
2. **文件类型限制**: 只允许下载 `.exe`、`.zip`、`.dmg` 文件
3. **路径穿越防护**: 服务器会拦截包含 `..`、`/`、`\` 的文件名
4. **MD5 校验**: 建议客户端下载后验证 MD5 值，确保文件完整性
5. **断点续传**: 服务器支持 HTTP Range 请求，可以实现断点续传

---

## 📝 注意事项

1. **版本号格式**: 使用语义化版本号（如 `1.3.3`），方便比较
2. **更新说明支持 Markdown**: `release_notes` 字段支持 Markdown 格式
3. **强制更新**: 如果 `force_update` 为 `true`，建议客户端强制用户更新
4. **最低版本**: 如果当前版本低于 `minimum_version`，建议提示用户必须更新
5. **下载超时**: 文件可能较大，建议设置合理的超时时间（如 5 分钟）
6. **错误处理**: 下载失败时应给用户友好提示，可以提供重试选项

---

## 🧪 测试接口

### 使用 curl 测试

```bash
# 1. 检查版本
curl http://61.151.241.233:8080/api/v1/client/version/latest

# 2. 下载文件（测试）
curl -O http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3.exe

# 3. 获取文件信息
curl http://61.151.241.233:8080/api/v1/client/file-info/Market-Data-Downloader-1.3.3.exe
```

### 使用浏览器测试

直接在浏览器中访问：
```
http://61.151.241.233:8080/api/v1/client/version/latest
```

---

## 🛠️ 推荐库

如果不想自己实现所有逻辑，推荐使用以下 Electron 自动更新库：

- **electron-updater**: 功能强大，支持多种更新服务器
- **electron-builder**: 配合 electron-updater 使用

---

## 📞 技术支持

如有问题，请联系后端团队。

**接口版本**: v1.0  
**文档更新日期**: 2025-10-08

