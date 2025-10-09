# SDK下载功能需求文档

## 📋 1. 功能概述

在 Market Data Downloader 客户端工具中新增 **SDK下载** 功能，方便客户直接从客户端工具下载最新的SDK开发包。

**设计原则：** 复用现有的客户端自动更新服务架构，保持接口风格一致。

---

## 🎯 2. 业务需求

### 2.1 功能目标
- 客户可通过客户端工具查看可用的SDK列表
- 客户可直接下载最新版本的SDK开发包
- 支持多种语言的SDK（Python、Java、C++等）
- 后端只需更新固定目录中的文件，无需修改代码

### 2.2 使用场景
1. 客户打开客户端，点击"SDK下载"菜单
2. 查看所有可用SDK的版本信息
3. 点击下载按钮，自动下载SDK压缩包
4. 解压后即可使用SDK进行开发

---

## 🔌 3. 后端接口需求

### 3.1 获取SDK版本列表

#### 接口定义
```
GET /api/v1/sdk/versions
```

#### 请求参数
无

#### 响应示例
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "sdks": [
      {
        "type": "python",
        "name": "Python SDK",
        "version": "1.0.0",
        "release_date": "2025-10-09T10:00:00Z",
        "description": "Python数据接口SDK，支持REST API和WebSocket",
        "download_url": "http://61.151.241.233:8080/downloads/sdk/python-sdk-v1.0.0.zip",
        "size": 2048000,
        "md5": "abc123def456...",
        "doc_url": "http://61.151.241.233:8080/docs/python-sdk.html"
      },
      {
        "type": "java",
        "name": "Java SDK",
        "version": "1.0.0",
        "release_date": "2025-10-09T10:00:00Z",
        "description": "Java数据接口SDK，基于Spring Boot",
        "download_url": "http://61.151.241.233:8080/downloads/sdk/java-sdk-v1.0.0.zip",
        "size": 3145728,
        "md5": "def456ghi789...",
        "doc_url": "http://61.151.241.233:8080/docs/java-sdk.html"
      },
      {
        "type": "cpp",
        "name": "C++ SDK",
        "version": "1.0.0",
        "release_date": "2025-10-09T10:00:00Z",
        "description": "C++数据接口SDK，低延迟高性能",
        "download_url": "http://61.151.241.233:8080/downloads/sdk/cpp-sdk-v1.0.0.zip",
        "size": 1572864,
        "md5": "ghi789jkl012...",
        "doc_url": "http://61.151.241.233:8080/docs/cpp-sdk.html"
      }
    ],
    "update_time": "2025-10-09T10:00:00Z"
  }
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | SDK类型标识（python/java/cpp） |
| name | string | 是 | SDK显示名称 |
| version | string | 是 | 版本号（语义化版本，如1.0.0） |
| release_date | string | 是 | 发布日期（ISO 8601格式） |
| description | string | 是 | SDK简介 |
| download_url | string | 是 | 下载地址（完整URL） |
| size | integer | 是 | 文件大小（字节） |
| md5 | string | 是 | 文件MD5校验值 |
| doc_url | string | 否 | 文档地址（可选） |

---

### 3.2 下载SDK文件

#### 接口定义
```
GET /downloads/sdk/{filename}
```

#### 请求参数
- `filename`: SDK文件名（如：python-sdk-v1.0.0.zip）

#### 响应
- 成功：返回文件流（application/octet-stream）
- 失败：返回404错误

#### 响应头
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="python-sdk-v1.0.0.zip"
Content-Length: 2048000
```

---

## 📁 4. 服务器目录规划

### 4.1 目录结构

建议在服务器上创建以下目录结构：

```
/opt/demo/rest/
├── downloads/              # 现有的客户端更新目录
│   └── Market-Data-Downloader-1.3.9.exe
└── sdk/                    # 新增SDK目录
    ├── sdk-versions.json   # SDK版本信息配置文件
    ├── python-sdk-v1.0.0.zip
    ├── java-sdk-v1.0.0.zip
    └── cpp-sdk-v1.0.0.zip
```

### 4.2 配置文件格式

`sdk-versions.json` 文件内容：

```json
{
  "sdks": [
    {
      "type": "python",
      "name": "Python SDK",
      "version": "1.0.0",
      "release_date": "2025-10-09T10:00:00Z",
      "description": "Python数据接口SDK，支持REST API和WebSocket",
      "filename": "python-sdk-v1.0.0.zip",
      "doc_url": "http://61.151.241.233:8080/docs/python-sdk.html"
    },
    {
      "type": "java",
      "name": "Java SDK",
      "version": "1.0.0",
      "release_date": "2025-10-09T10:00:00Z",
      "description": "Java数据接口SDK，基于Spring Boot",
      "filename": "java-sdk-v1.0.0.zip",
      "doc_url": "http://61.151.241.233:8080/docs/java-sdk.html"
    },
    {
      "type": "cpp",
      "name": "C++ SDK",
      "version": "1.0.0",
      "release_date": "2025-10-09T10:00:00Z",
      "description": "C++数据接口SDK，低延迟高性能",
      "filename": "cpp-sdk-v1.0.0.zip",
      "doc_url": "http://61.151.241.233:8080/docs/cpp-sdk.html"
    }
  ],
  "update_time": "2025-10-09T10:00:00Z"
}
```

---

## 🔧 5. 实现建议

### 5.1 接口实现逻辑

#### `/api/v1/sdk/versions` 接口

```
1. 读取 /opt/demo/rest/sdk/sdk-versions.json 文件
2. 解析JSON内容
3. 遍历每个SDK配置：
   - 读取对应的zip文件信息（大小、MD5）
   - 拼接download_url（服务器地址 + /downloads/sdk/ + filename）
4. 返回完整的SDK列表
```

**伪代码：**
```go
func GetSDKVersions(c *gin.Context) {
    // 1. 读取配置文件
    configPath := "/opt/demo/rest/sdk/sdk-versions.json"
    data, err := ioutil.ReadFile(configPath)
    
    // 2. 解析JSON
    var config SDKConfig
    json.Unmarshal(data, &config)
    
    // 3. 补充文件信息
    for i, sdk := range config.SDKs {
        filePath := "/opt/demo/rest/sdk/" + sdk.Filename
        
        // 获取文件大小
        fileInfo, _ := os.Stat(filePath)
        config.SDKs[i].Size = fileInfo.Size()
        
        // 计算MD5
        config.SDKs[i].MD5 = calculateMD5(filePath)
        
        // 拼接下载URL
        config.SDKs[i].DownloadURL = "http://61.151.241.233:8080/downloads/sdk/" + sdk.Filename
    }
    
    // 4. 返回响应
    c.JSON(200, gin.H{
        "code": 200,
        "message": "success",
        "data": config,
    })
}
```

#### `/downloads/sdk/{filename}` 接口

```
1. 验证filename参数（防止路径遍历攻击）
2. 构建完整文件路径：/opt/demo/rest/sdk/{filename}
3. 检查文件是否存在
4. 设置响应头（Content-Type, Content-Disposition）
5. 返回文件流
```

**伪代码：**
```go
func DownloadSDK(c *gin.Context) {
    filename := c.Param("filename")
    
    // 1. 安全检查（防止 ../ 路径遍历）
    if strings.Contains(filename, "..") {
        c.JSON(400, gin.H{"error": "invalid filename"})
        return
    }
    
    // 2. 构建文件路径
    filePath := "/opt/demo/rest/sdk/" + filename
    
    // 3. 检查文件存在
    if _, err := os.Stat(filePath); os.IsNotExist(err) {
        c.JSON(404, gin.H{"error": "file not found"})
        return
    }
    
    // 4. 设置响应头并返回文件
    c.Header("Content-Description", "File Transfer")
    c.Header("Content-Disposition", "attachment; filename="+filename)
    c.File(filePath)
}
```

### 5.2 更新SDK流程

**后端运维人员更新SDK的步骤：**

1. 准备新版本SDK文件（如：`python-sdk-v1.1.0.zip`）
2. 将文件上传到服务器：`/opt/demo/rest/sdk/`
3. 修改 `sdk-versions.json` 配置文件：
   ```json
   {
     "type": "python",
     "name": "Python SDK",
     "version": "1.1.0",  // 更新版本号
     "filename": "python-sdk-v1.1.0.zip"  // 更新文件名
   }
   ```
4. 保存配置文件
5. 客户端会自动读取最新配置

**无需重启服务，无需修改代码！**

---

## 🔒 6. 安全考虑

### 6.1 路径安全
- 验证filename参数，禁止 `../` 路径遍历
- 只允许访问 `/opt/demo/rest/sdk/` 目录下的文件

### 6.2 文件校验
- 提供MD5值供客户端验证文件完整性
- 防止文件在传输过程中损坏

### 6.3 访问控制（可选）
- 目前设计为公开访问
- 如需限制，可考虑：
  - 要求API Key认证
  - IP白名单限制
  - 下载次数限制

---

## 📊 7. 监控建议

### 7.1 日志记录
记录以下信息：
- SDK下载请求（时间、IP、SDK类型、版本）
- 下载成功/失败状态
- 错误信息

### 7.2 统计指标
- 各SDK下载次数
- 各版本下载次数
- 下载流量统计

---

## 🧪 8. 测试用例

### 8.1 接口测试

#### 测试1：获取SDK列表
```bash
curl http://61.151.241.233:8080/api/v1/sdk/versions
```
**预期结果：** 返回所有SDK的版本信息

#### 测试2：下载Python SDK
```bash
curl -O http://61.151.241.233:8080/downloads/sdk/python-sdk-v1.0.0.zip
```
**预期结果：** 成功下载文件

#### 测试3：下载不存在的文件
```bash
curl http://61.151.241.233:8080/downloads/sdk/nonexistent.zip
```
**预期结果：** 返回404错误

#### 测试4：路径遍历攻击
```bash
curl http://61.151.241.233:8080/downloads/sdk/../../../etc/passwd
```
**预期结果：** 返回400或403错误，不返回任何系统文件

---

## 📝 9. 前端对接说明

前端会调用以下接口：

1. **加载SDK列表页面时：**
   ```javascript
   GET /api/v1/sdk/versions
   ```
   
2. **用户点击下载按钮时：**
   ```javascript
   // 从返回的 download_url 下载
   window.electronAPI.downloadFile(sdk.download_url, savePath)
   ```

前端会显示：
- SDK名称、版本号
- 文件大小（格式化为MB）
- 下载按钮
- 文档链接（如有）

---

## 🗓️ 10. 开发排期建议

| 任务 | 预计时间 | 负责人 |
|------|----------|--------|
| 后端接口开发 | 2小时 | 后端团队 |
| 服务器目录创建 | 10分钟 | 运维 |
| 接口联调测试 | 30分钟 | 前后端 |
| 上线部署 | 20分钟 | 运维 |

---

## 📞 11. 联系方式

如有疑问，请联系：
- **前端负责人**: [姓名]
- **需求文档作者**: AI Assistant

---

## 📌 12. 附录

### 12.1 参考文档
- [客户端自动更新API文档](CLIENT_UPDATE_API.md)
- [API网关接口规范](../api_gateway/docs/)

### 12.2 相关issue/PR
- 相关需求讨论: [链接]
- 前端实现PR: [将在实现后添加]

---

**文档版本**: v1.0  
**创建日期**: 2025-10-09  
**最后更新**: 2025-10-09  

