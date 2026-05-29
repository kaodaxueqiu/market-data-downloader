# 因子 Py 文件上传/下载接口需求

## 背景

「我的因子」新增了 Py 文件模式，研究员需要将因子 Python 源码文件上传到服务器，供 PM 和团队其他成员查看验证。文件存储使用 MinIO 对象存储。

## 新增接口

### 1. 上传因子源码文件

```
POST /api/v1/factor/my/{factor_id}/source
Content-Type: multipart/form-data
X-API-Key: ak_xxx
```

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | 是 | .py 文件，multipart/form-data 格式 |

**MinIO 存储路径建议**：

```
bucket: factor-sources
key: {user_name}/{factor_id}/{factor_code}.py
```

或者简化为：

```
bucket: factor-sources
key: {factor_id}.py
```

**成功响应**：

```json
{
  "success": true,
  "message": "Source file uploaded successfully",
  "data": {
    "file_name": "momentum_5d.py",
    "file_size": 1234,
    "uploaded_at": "2026-05-25T08:00:00Z"
  }
}
```

**失败响应**：

```json
{
  "success": false,
  "error": "File too large (max 1MB)" 
}
```

**约束**：
- 只接受 `.py` 后缀文件
- 文件大小限制建议 1MB（因子脚本一般很小）
- 重复上传覆盖旧文件
- 需验证 API Key 对应用户有该因子的所有权

---

### 2. 获取因子源码文件

```
GET /api/v1/factor/my/{factor_id}/source
X-API-Key: ak_xxx
```

**成功响应**（返回文件内容为文本）：

```json
{
  "success": true,
  "data": {
    "file_name": "momentum_5d.py",
    "file_size": 1234,
    "content": "import pandas as pd\nimport numpy as np\n\ndef calc_factor(df):\n    ...",
    "uploaded_at": "2026-05-25T08:00:00Z"
  }
}
```

或者直接返回文件流（Content-Type: text/plain），前端都能处理。建议返回 JSON 包装格式，方便统一错误处理。

**文件不存在时**：

```json
{
  "success": false,
  "error": "Source file not found"
}
```

---

### 3. 删除因子源码文件（可选）

```
DELETE /api/v1/factor/my/{factor_id}/source
X-API-Key: ak_xxx
```

当因子被删除时，关联的 MinIO 文件也应该清理。可以：
- 在删除因子的逻辑中自动清理（推荐）
- 或者单独提供删除接口

---

## MinIO 配置参考

```yaml
endpoint: 192.168.30.20:9000  # 根据实际地址调整
bucket: factor-sources
access_key: xxx
secret_key: xxx
```

## 前端对接方式

前端会通过 Electron 主进程：
1. 用户选择本地 .py 文件
2. 读取文件内容
3. 构造 FormData，POST 到上传接口
4. 查看源码时，GET 下载接口获取内容展示

## 验证方法

```bash
# 上传
curl -X POST http://61.151.241.233:8080/api/v1/factor/my/yuyang_372/source \
  -H "X-API-Key: ak_xxx" \
  -F "file=@/path/to/test.py"

# 下载
curl http://61.151.241.233:8080/api/v1/factor/my/yuyang_372/source \
  -H "X-API-Key: ak_xxx"

# 期望返回文件内容
```
