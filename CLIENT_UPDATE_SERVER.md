# 📦 客户端自动更新服务器实现文档

## 📋 需求概述

为Electron桌面应用（Market Data Downloader）提供自动更新服务，替代GitHub Releases方案。

**为什么要自建？**
- ✅ 国内访问稳定快速
- ✅ 完全可控，不依赖第三方
- ✅ 可以统计下载次数和用户分布
- ✅ 发布流程简单（直接上传文件）

---

## 🎯 需要实现的功能

### 1. 版本信息查询接口
### 2. 文件下载接口
### 3. 文件存储目录

---

## 📡 接口定义

### 接口1：获取最新版本信息

**请求：**
```
GET http://61.151.241.233:8080/api/v1/client/version/latest
```

**响应：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "version": "1.3.3",
    "release_date": "2025-10-08T10:30:00Z",
    "release_notes": "修复自动更新功能，优化界面",
    "downloads": {
      "windows": {
        "url": "http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3.exe",
        "size": 73012224,
        "md5": "abc123..."
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

**字段说明：**
- `version`: 最新版本号（如"1.3.3"）
- `release_date`: 发布时间（ISO 8601格式）
- `release_notes`: 更新说明（支持markdown，前端会展示）
- `downloads.windows.url`: Windows版本下载地址（完整URL）
- `downloads.windows.size`: 文件大小（字节）
- `downloads.windows.md5`: MD5校验值（可选，用于验证文件完整性）
- `minimum_version`: 最低支持版本（低于此版本强制更新）
- `force_update`: 是否强制更新（true时客户端必须更新）

---

### 接口2：文件下载

**请求：**
```
GET http://61.151.241.233:8080/downloads/{filename}
```

**示例：**
```
GET http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3.exe
```

**响应：**
- Content-Type: `application/octet-stream`
- Content-Disposition: `attachment; filename="Market-Data-Downloader-1.3.3.exe"`
- 直接返回文件二进制流

**安全考虑：**
- 验证filename参数，防止路径穿越攻击（如`../../../`）
- 只允许下载`.exe`和`.zip`文件
- 可选：验证API Key或IP白名单

---

## 📂 文件存储结构

### 目录结构：
```
/opt/api_gateway/downloads/
├── version.json                              # 版本信息文件
├── Market-Data-Downloader-1.3.3.exe         # Windows版本
├── Market-Data-Downloader-1.3.3-mac.zip     # macOS Intel版本
├── Market-Data-Downloader-1.3.3-arm64-mac.zip # macOS ARM版本
├── Market-Data-Downloader-1.3.2.exe         # 旧版本（保留）
└── Market-Data-Downloader-1.3.2-mac.zip
```

### version.json 格式：
```json
{
  "latest": {
    "version": "1.3.3",
    "release_date": "2025-10-08T10:30:00Z",
    "release_notes": "## 🎉 新功能\n- 自动更新功能\n- 菜单优化\n\n## 🐛 修复\n- 修复闪退问题",
    "downloads": {
      "windows": {
        "filename": "Market-Data-Downloader-1.3.3.exe",
        "size": 73012224,
        "md5": "abc123def456..."
      },
      "mac_intel": {
        "filename": "Market-Data-Downloader-1.3.3-mac.zip",
        "size": 107020288,
        "md5": "def456..."
      },
      "mac_arm64": {
        "filename": "Market-Data-Downloader-1.3.3-arm64-mac.zip",
        "size": 102040576,
        "md5": "ghi789..."
      }
    },
    "minimum_version": "1.0.0",
    "force_update": false
  },
  "history": [
    {
      "version": "1.3.2",
      "release_date": "2025-10-07T15:00:00Z"
    },
    {
      "version": "1.3.1",
      "release_date": "2025-10-07T14:00:00Z"
    }
  ]
}
```

---

## 💻 后端实现建议（Go语言）

### 代码位置：
```
1234/api_gateway/internal/rest/client_update.go
```

### 接口实现示例：

```go
package rest

import (
    "encoding/json"
    "net/http"
    "os"
    "path/filepath"
    "strings"
    
    "github.com/gin-gonic/gin"
)

const downloadsDir = "/opt/api_gateway/downloads"

// 获取最新版本信息
func GetLatestVersion(c *gin.Context) {
    // 读取version.json
    data, err := os.ReadFile(filepath.Join(downloadsDir, "version.json"))
    if err != nil {
        c.JSON(500, gin.H{"code": 500, "message": "读取版本信息失败"})
        return
    }
    
    var versionInfo map[string]interface{}
    if err := json.Unmarshal(data, &versionInfo); err != nil {
        c.JSON(500, gin.H{"code": 500, "message": "解析版本信息失败"})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 200,
        "message": "success",
        "data": versionInfo["latest"],
    })
}

// 下载文件
func DownloadFile(c *gin.Context) {
    filename := c.Param("filename")
    
    // 安全检查：防止路径穿越
    if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
        c.JSON(400, gin.H{"code": 400, "message": "非法文件名"})
        return
    }
    
    // 只允许特定扩展名
    ext := filepath.Ext(filename)
    if ext != ".exe" && ext != ".zip" {
        c.JSON(400, gin.H{"code": 400, "message": "不支持的文件类型"})
        return
    }
    
    // 文件路径
    filePath := filepath.Join(downloadsDir, filename)
    
    // 检查文件是否存在
    if _, err := os.Stat(filePath); os.IsNotExist(err) {
        c.JSON(404, gin.H{"code": 404, "message": "文件不存在"})
        return
    }
    
    // 设置响应头
    c.Header("Content-Description", "File Transfer")
    c.Header("Content-Transfer-Encoding", "binary")
    c.Header("Content-Disposition", "attachment; filename="+filename)
    c.Header("Content-Type", "application/octet-stream")
    
    // 返回文件
    c.File(filePath)
    
    // 记录下载日志（可选）
    log.Printf("文件下载: %s, IP: %s", filename, c.ClientIP())
}
```

### 路由注册：

在 `api_gateway/internal/rest/router.go` 中添加：

```go
// 客户端更新相关路由（不需要API Key验证）
client := router.Group("/api/v1/client")
{
    client.GET("/version/latest", GetLatestVersion)
}

// 文件下载（不需要API Key验证）
router.GET("/downloads/:filename", DownloadFile)
```

---

## 📝 发布新版本的流程

### 步骤：

1. **本地打包新版本**
   ```bash
   cd market-data-downloader
   npm run build:win   # 生成Windows版本
   npm run build:mac   # 生成macOS版本（需要在Mac上）
   ```

2. **上传文件到服务器**
   ```bash
   scp dist/*.exe root@61.151.241.233:/opt/api_gateway/downloads/
   scp dist/*-mac.zip root@61.151.241.233:/opt/api_gateway/downloads/
   ```

3. **更新version.json**
   ```bash
   # SSH到服务器
   ssh root@61.151.241.233
   
   # 编辑version.json
   vi /opt/api_gateway/downloads/version.json
   
   # 修改版本号、下载URL、更新说明等
   ```

4. **完成！** 客户端会自动检测到新版本

---

## 🔒 安全建议

### 可选安全措施：

1. **API Key验证**（如果只给特定客户）
   ```go
   func GetLatestVersion(c *gin.Context) {
       apiKey := c.GetHeader("X-API-Key")
       if !validateAPIKey(apiKey) {
           c.JSON(401, gin.H{"code": 401, "message": "未授权"})
           return
       }
       // ... 继续处理
   }
   ```

2. **IP白名单**
   ```go
   allowedIPs := []string{"192.168.1.0/24", "10.0.0.0/8"}
   if !isAllowedIP(c.ClientIP(), allowedIPs) {
       c.JSON(403, gin.H{"code": 403, "message": "访问被拒绝"})
       return
   }
   ```

3. **文件完整性校验**
   - 生成MD5值存入version.json
   - 客户端下载后验证MD5

4. **限流**
   ```go
   // 防止恶意下载消耗带宽
   limiter := rate.NewLimiter(rate.Limit(10), 100) // 每秒10个请求
   ```

---

## 📊 可选功能：统计分析

### 下载统计接口：
```go
// 记录每次下载
type DownloadLog struct {
    Version   string    `json:"version"`
    Platform  string    `json:"platform"`
    IP        string    `json:"ip"`
    UserAgent string    `json:"user_agent"`
    Time      time.Time `json:"time"`
}

// 保存到数据库或日志文件
func logDownload(filename, ip, ua string) {
    // 实现下载统计逻辑
}
```

### 统计查询接口：
```
GET /api/v1/client/stats
返回：各版本下载次数、活跃用户数等
```

---

## 🧪 测试方法

### 测试接口是否正常：

1. **测试版本查询：**
   ```bash
   curl http://61.151.241.233:8080/api/v1/client/version/latest
   ```
   应该返回JSON格式的版本信息

2. **测试文件下载：**
   ```bash
   curl -O http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3.exe
   ```
   应该能成功下载exe文件

3. **测试非法文件名：**
   ```bash
   curl http://61.151.241.233:8080/downloads/../../../etc/passwd
   ```
   应该返回400或404错误

---

## 📦 初始version.json模板

请在服务器创建：`/opt/api_gateway/downloads/version.json`

```json
{
  "latest": {
    "version": "1.3.3",
    "release_date": "2025-10-08T18:00:00Z",
    "release_notes": "## 🎉 v1.3.3 更新内容\n\n### 新功能\n- ✅ 自动更新功能\n- ✅ 菜单优化为子菜单结构\n- ✅ 数据字典改为苹果风格卡片\n- ✅ 一排5个卡片展示\n\n### 界面优化\n- ✅ DECODED/RAW按钮美化\n- ✅ 卡片悬停效果优化\n- ✅ 分类标签彩色化\n\n### 下载说明\n- Windows: 直接运行exe文件\n- macOS: 解压zip后，右键打开",
    "downloads": {
      "windows": {
        "filename": "Market-Data-Downloader-1.3.3.exe",
        "size": 73012224,
        "md5": ""
      },
      "mac_intel": {
        "filename": "Market-Data-Downloader-1.3.3-mac.zip",
        "size": 107020288,
        "md5": ""
      },
      "mac_arm64": {
        "filename": "Market-Data-Downloader-1.3.3-arm64-mac.zip",
        "size": 102040576,
        "md5": ""
      }
    },
    "minimum_version": "1.0.0",
    "force_update": false
  },
  "history": []
}
```

---

## 🛠️ 实现步骤

### Step 1: 创建downloads目录
```bash
mkdir -p /opt/api_gateway/downloads
chmod 755 /opt/api_gateway/downloads
```

### Step 2: 添加路由和处理函数
在 `api_gateway/internal/rest/` 目录下创建 `client_update.go`

### Step 3: 注册路由
在 `router.go` 中添加路由映射

### Step 4: 重启API网关
```bash
cd /opt/api_gateway
./scripts/stop.sh
./scripts/start.sh
```

### Step 5: 上传第一个版本文件
```bash
# 上传exe
scp Market-Data-Downloader-1.3.3.exe root@61.151.241.233:/opt/api_gateway/downloads/

# 上传mac版本
scp Market-Data-Downloader-1.3.3-mac.zip root@61.151.241.233:/opt/api_gateway/downloads/
scp Market-Data-Downloader-1.3.3-arm64-mac.zip root@61.151.241.233:/opt/api_gateway/downloads/

# 创建version.json
vi /opt/api_gateway/downloads/version.json
# 粘贴上面的JSON模板
```

### Step 6: 测试接口
```bash
curl http://61.151.241.233:8080/api/v1/client/version/latest
curl -I http://61.151.241.233:8080/downloads/Market-Data-Downloader-1.3.3.exe
```

---

## 🚀 客户端调用说明

客户端会：

1. **定期检查更新**（启动时 + 用户手动点击）
   ```javascript
   const response = await fetch('http://61.151.241.233:8080/api/v1/client/version/latest')
   const data = await response.json()
   
   if (data.code === 200) {
     const serverVersion = data.data.version
     const currentVersion = "1.3.2"
     
     if (serverVersion > currentVersion) {
       // 提示用户有新版本
       // 显示更新说明
       // 询问是否下载
     }
   }
   ```

2. **下载新版本**
   ```javascript
   const downloadUrl = data.data.downloads.windows.url
   // 使用Electron的download API下载
   // 显示下载进度条
   ```

3. **安装并重启**
   ```javascript
   // 下载完成后
   // 关闭当前应用
   // 运行新版本exe
   // 删除旧版本
   ```

---

## ⚙️ 配置项

### Nginx配置（如果使用Nginx）

```nginx
# 大文件支持
client_max_body_size 200M;

# 下载超时
proxy_read_timeout 300s;
send_timeout 300s;

# 下载接口
location /downloads/ {
    alias /opt/api_gateway/downloads/;
    autoindex off;
    
    # 只允许下载特定文件
    location ~ \.(exe|zip)$ {
        add_header Content-Disposition 'attachment';
        add_header Access-Control-Allow-Origin *;
    }
}
```

---

## 📈 监控建议

### 需要监控的指标：

1. **下载次数统计**
   - 按版本统计下载量
   - 按平台统计（Windows/macOS）
   - 按日期统计

2. **活跃用户**
   - 每日检查更新的IP数
   - 版本分布（多少用户用哪个版本）

3. **错误监控**
   - 下载失败次数
   - 404错误（文件不存在）
   - 网络超时

### 日志记录：
```
[2025-10-08 18:30:15] INFO 版本查询 IP=192.168.1.100 CurrentVersion=1.3.2
[2025-10-08 18:30:20] INFO 文件下载 File=Market-Data-Downloader-1.3.3.exe IP=192.168.1.100 Size=73MB
```

---

## 🎯 工作量评估

- **接口开发**: 30分钟
- **测试验证**: 15分钟
- **部署上线**: 15分钟
- **总计**: **约1小时**

---

## ❓ FAQ

### Q1: version.json谁来维护？
**A**: 手动维护或者做一个管理后台。建议初期手动维护，格式很简单。

### Q2: 如何生成MD5值？
**A**: 
```bash
md5sum Market-Data-Downloader-1.3.3.exe
# 输出: abc123def456... Market-Data-Downloader-1.3.3.exe
```

### Q3: 旧版本文件要删除吗？
**A**: 建议保留最近3个版本，以防用户需要回滚。

### Q4: 需要HTTPS吗？
**A**: 建议使用HTTPS，但HTTP也可以工作。如果用HTTPS，需要配置SSL证书。

### Q5: 带宽消耗大吗？
**A**: 每个exe约70MB，如果100个客户同时更新，需要7GB流量。建议：
- 限流控制
- 非高峰期推送更新通知
- 分批推送（先给一部分用户）

---

## 📞 联系方式

实现过程中有任何问题，请联系前端开发团队。

**预计完成时间**: 1小时
**优先级**: 高
**依赖**: 无

---

**文档版本**: v1.0
**创建日期**: 2025-10-08
**作者**: 前端团队

