# WebSocket 实时订阅数据源处理规范

**版本**: v1.0  
**更新时间**: 2025-11-03  
**适用版本**: 1.6.8+

---

## 📌 概述

WebSocket实时订阅功能支持55个数据源的实时行情推送和CSV写入。由于数据源来自不同的系统（receiver_v2 和 Flink），数据格式存在差异，需要前端统一处理。

---

## 🔍 数据源分类

### 分类1：快照数据（53个数据源）- receiver_v2

#### 数据源列表

| 分类 | 数据源编码 | 数量 | 说明 |
|------|----------|------|------|
| **深圳市场** | ZZ-01 ~ ZZ-14 | 14个 | 股票快照、逐笔、债券等 |
| **上海市场** | ZZ-31 ~ ZZ-39 | 9个 | 股票快照、逐笔、债券等 |
| **期货市场** | ZZ-61 ~ ZZ-73 | 13个 | 中金所、上期所、郑商所、大商所、广期所 |
| **期权市场** | ZZ-91 ~ ZZ-103 | 13个 | 各交易所期权快照 |
| **陆港通** | ZZ-104 ~ ZZ-107 | 4个 | 港股通资金流向、额度 |

#### 数据特征

| 特性 | 说明 |
|------|------|
| **数据来源** | receiver_v2（Go语言接收器） |
| **Redis存储** | Stream类型（支持时间范围查询） |
| **字段命名** | **中文为主**（`证券代码`, `开盘价`, `最新价`），少数英文（`IOPV`, `zz_date`） |
| **数据结构** | **扁平结构**（1层JSON） |
| **推送频率** | 每3秒推送一次（实时） |
| **WebSocket Channel** | `DECODED/ZZ-XX/SZ.000001/20251103/1032`（**带时间戳后缀**） |
| **订阅Pattern** | `DECODED/ZZ-XX/SZ.000001/*`（**需要通配符**） |

#### WebSocket推送格式示例（ZZ-01）

```json
{
  "type": "data",
  "mode": "pubsub",
  "pattern": "DECODED/ZZ-01/*",
  "channel": "DECODED/ZZ-01/SZ.000001/20251103/1054",
  "data": "{\"证券代码\":\"SZ.000001\",\"最新价\":11.40,\"开盘价\":11.34,...}",
  "timestamp": 1730556123456
}
```

**注意**：`data` 字段是 **JSON字符串**，需要解析：
```javascript
const actualData = JSON.parse(message.data)
console.log(actualData.证券代码)  // "SZ.000001"
console.log(actualData.最新价)    // 11.40
```

---

### 分类2：K线数据（2个数据源）- Flink

#### 数据源列表

| 数据源编码 | 名称 | 说明 |
|----------|------|------|
| **ZZ-5001** | 沪深A股1分钟K线 | 股票K线数据 |
| **ZZ-6001** | 期货1分钟K线 | 期货合约K线数据 |

#### 数据特征

| 特性 | 说明 |
|------|------|
| **数据来源** | Flink（实时计算引擎） |
| **Redis存储** | String类型（直接存储JSON） |
| **字段命名** | **全英文驼峰**（`stockCode`, `openPrice`, `closePrice`） |
| **数据结构** | **嵌套结构**（2层JSON：`key` + `data`） |
| **推送频率** | 每分钟推送一次（整分钟，如10:31:00） |
| **WebSocket Channel** | `KLINE-1M/ZZ-5001/SZ.000001`（**无时间戳后缀**） |
| **订阅Pattern** | `KLINE-1M/ZZ-5001/SZ.000001/*`（后端自适应，带不带通配符都可以） |

#### WebSocket推送格式示例（ZZ-5001）

```json
{
  "type": "data",
  "mode": "pubsub",
  "pattern": "KLINE-1M/ZZ-5001/*",
  "channel": "KLINE-1M/ZZ-5001/SZ.000001",
  "data": "{\"key\":\"KLINE-1M/ZZ-5001/SZ.000001/20251103/1053\",\"data\":{\"stockCode\":\"SZ.000001\",\"openPrice\":11.4,...}}",
  "timestamp": 1730556123456
}
```

**注意**：`data` 字段是 **JSON字符串**，解析后是**嵌套结构**：
```javascript
const parsed = JSON.parse(message.data)
console.log(parsed.key)              // "KLINE-1M/ZZ-5001/SZ.000001/..."
console.log(parsed.data)             // { stockCode: "SZ.000001", ... }
console.log(parsed.data.stockCode)   // "SZ.000001"
console.log(parsed.data.openPrice)   // 11.4
```

**必须提取嵌套的 `data.data` 才能访问实际字段！**

---

## 🔑 关键差异对比

| 特性 | 快照数据（ZZ-01~107）<br>receiver_v2 | K线数据（ZZ-5001/6001）<br>Flink |
|------|--------------------------------|---------------------------|
| **字段命名** | **中文**（`证券代码`, `最新价`） | **英文**（`stockCode`, `openPrice`） |
| **数据层级** | **1层**（扁平） | **2层**（嵌套 key+data） |
| **Channel格式** | `DECODED/ZZ-01/SZ.000001/20251103/1032` | `KLINE-1M/ZZ-5001/SZ.000001` |
| **订阅Pattern** | `DECODED/ZZ-01/SZ.000001/*` ✅ 需要`/*` | `KLINE-1M/ZZ-5001/SZ.000001` ⚠️ 后端自适应 |
| **推送频率** | 每3秒 | 每分钟（整分钟） |
| **Redis类型** | Stream | String |

---

## 💻 前端处理规范

### 1. WebSocket消息解析

#### 第1步：解析message.data（所有数据源通用）

```javascript
// websocketManager.ts 第146行
const actualData = JSON.parse(message.data)  // 解析JSON字符串
```

#### 第2步：检查嵌套结构（只有K线数据需要）

```javascript
// subscriptionSession.ts 第172-206行
let data = actualData

// K线数据特殊处理：有 key 和 data 字段
if (data.key && data.data && typeof data.data === 'object') {
  data = data.data  // 🔑 提取嵌套的 data 对象
  console.log('📦 检测到K线嵌套结构，提取 data.data')
}

// 现在 data 就是实际数据了
// 快照：{ "证券代码": "SZ.000001", "最新价": 11.40, ... }
// K线：{ "stockCode": "SZ.000001", "openPrice": 11.40, ... }
```

### 2. 订阅Pattern构建

```javascript
// subscriptionSession.ts 第134-160行

function buildSubscriptionPatterns(sourceCode: string, symbols: string[]) {
  // K线数据（ZZ-5001, ZZ-6001）
  if (sourceCode === 'ZZ-5001' || sourceCode === 'ZZ-6001') {
    if (symbols.length === 0) {
      return [`KLINE-1M/${sourceCode}/*`]  // 订阅全部
    } else {
      return symbols.map(s => `KLINE-1M/${sourceCode}/${s}`)  // 订阅指定股票
    }
  }
  
  // 快照数据（ZZ-01 ~ ZZ-107）
  if (symbols.length === 0) {
    return [`DECODED/${sourceCode}/*`]  // 订阅全部
  } else {
    return symbols.map(s => `DECODED/${sourceCode}/${s}/*`)  // 订阅指定股票（需要/*）
  }
}
```

### 3. 字段名映射处理

由于快照数据用中文字段，K线数据用英文字段，需要**同时支持两种查找方式**：

```javascript
// subscriptionSession.ts 第211-225行

// 用户选择的字段（英文名）：openPrice, lastPrice
// 字段映射（英文→中文）：openPrice → 开盘价, lastPrice → 最新价

this.config.fields.forEach(field => {
  const chineseFieldName = this.fieldMapping.get(field) || field
  
  // 🔑 关键：先英文再中文
  // 1. 先尝试英文名（K线数据用英文）
  // 2. 再尝试中文名（快照数据用中文）
  const value = data[field] ?? data[chineseFieldName] ?? '-'
  
  rowData[field] = value
})
```

**查找顺序很重要：**
- **ZZ-5001**：`data[field]` 直接匹配成功 ✅（因为字段名是英文）
- **ZZ-01**：`data[field]` 失败 → `data[chineseFieldName]` 成功 ✅（因为字段名是中文）

### 4. 股票代码提取

```javascript
// subscriptionSession.ts 第275-321行

function extractSymbol(data: any, channel: string) {
  // 1. 优先从数据中提取
  if (data.stockCode) return data.stockCode        // K线数据
  if (data.contractCode) return data.contractCode  // 期货K线
  if (data.证券代码) return data.证券代码            // 快照数据
  
  // 2. 从channel中提取（兜底方案）
  // K线格式：KLINE-1M/ZZ-5001/SZ.000001
  let match = channel.match(/KLINE-1M\/ZZ-\d+\/([^/]+)/)
  if (match) return match[1]
  
  // 快照格式：DECODED/ZZ-01/SZ.000001/20251103/1032
  match = channel.match(/DECODED\/ZZ-\d+\/([^/]+)/)
  if (match) return match[1]
  
  return null
}
```

### 5. CSV写入优化

```javascript
// csvWriter.ts 第176-210行

// 1. 时间戳格式化
if (typeof value === 'number' && value > 1000000000000) {
  value = `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

// 2. 数组/对象序列化
if (typeof value === 'object' && value !== null) {
  value = JSON.stringify(value)  // 防止显示[object Object]
}

// 3. 时间格式修复（防止Excel错误解析）
if (/^\d{1,2}\.\d{2}\.\d{2}/.test(value)) {
  value = value.replace(/\./g, ':')  // 11.12.09 → 11:12:09
}

// 4. 时间字段加单引号（强制Excel识别为文本）
if (/^\d{1,2}:\d{2}:\d{2}/.test(value)) {
  value = `'${value}`  // '11:12:09
}
```

---

## 🚀 未来新增数据源规范

### 方案A：推荐使用Flink模式（统一为英文字段）

**优点**：
- ✅ 字段名统一（全英文驼峰）
- ✅ 便于前端处理（不需要中英文映射）
- ✅ 便于跨语言使用（Python、Java等）
- ✅ 符合国际惯例

**建议的字段命名规范**：
```
股票代码: stockCode (或 securityId)
期货代码: contractCode
开盘价: openPrice (或 open)
收盘价: closePrice (或 close)
最高价: high
最低价: low
成交量: volume
成交额: amount (或 turnover)
时间戳: timestamp (或 updateTime)
```

**数据结构**：
```json
{
  "key": "DECODED/ZZ-XX/SZ.000001/...",
  "data": {
    "stockCode": "SZ.000001",
    "openPrice": 11.40,
    "closePrice": 11.41,
    ...
  }
}
```

**订阅Pattern**: `DECODED/ZZ-XX/SZ.000001` 或 `DECODED/ZZ-XX/SZ.000001/*`（后端自适应）

---

### 方案B：如果必须使用中文字段（兼容现有receiver_v2）

**如果由于历史原因必须使用中文字段，请遵循以下规范：**

**字段定义必须同时提供中英文：**
```yaml
# /opt/api_gateway/decoded_fields/zz_XX.yaml
fields:
  - name_en: security_id      # 英文名（下划线）
    name_cn: 证券代码          # 中文名
    
  - name_en: last_price
    name_cn: 最新价
    
  - name_en: open_price
    name_cn: 开盘价
```

**实际推送数据使用中文字段名**：
```json
{
  "证券代码": "SZ.000001",
  "最新价": 11.40,
  "开盘价": 11.34
}
```

**前端会自动通过字段定义API获取映射关系，进行转换。**

---

### 方案C：混合模式（不推荐）

如果数据中既有中文字段又有英文字段（如当前的ZZ-01），前端代码已经能处理，但**不推荐未来继续使用这种模式**，会增加维护复杂度。

---

## 📖 前端处理流程总结

### 完整的数据处理管道

```
WebSocket消息接收
  ↓
JSON.parse(message.data) ←─ websocketManager第146行
  ↓
检查嵌套结构 ←─ subscriptionSession第172-206行
  ↓ (K线数据提取data.data)
  ↓
提取股票代码 ←─ subscriptionSession第275-321行
  ↓
字段值提取（英文→中文映射） ←─ subscriptionSession第211-225行
  ↓
CSV写入（数组序列化、时间格式化） ←─ csvWriter第167-210行
  ↓
文件保存（.writing文件夹 + 预览文件）
```

### 关键代码位置

| 功能 | 文件 | 行号 | 说明 |
|------|------|------|------|
| WebSocket连接 | websocketManager.ts | 70-72 | API Key通过URL参数传递 |
| 消息分发 | websocketManager.ts | 143-163 | 第1次JSON解析和分发 |
| Pattern构建 | subscriptionSession.ts | 134-160 | 区分K线和快照 |
| 嵌套数据提取 | subscriptionSession.ts | 172-206 | K线数据提取data.data |
| 字段值提取 | subscriptionSession.ts | 211-225 | 先英文再中文 |
| 股票代码提取 | subscriptionSession.ts | 275-321 | 支持多种格式 |
| CSV写入 | csvWriter.ts | 167-210 | 数组序列化、时间格式化 |

---

## ⚠️ 重要注意事项

### 1. 字段定义API必须准确

**所有数据源的字段定义必须通过API提供**：
```
GET /api/v1/dictionary/sources/{CODE}/fields
```

返回格式：
```json
{
  "code": 200,
  "data": [
    {
      "name": "security_id",     // 英文名（前端用于选择字段）
      "name_en": "security_id",
      "name_cn": "证券代码",      // 中文名（用于映射）
      "type": "string",
      "enabled": true
    }
  ]
}
```

**前端依赖这个API来构建字段映射**（`name → cn_name`）。

### 2. 数据推送的字段名必须一致

**字段定义API返回的字段名** 和 **WebSocket推送的实际字段名** 必须一致！

- **快照数据**：字段定义说是`证券代码`，推送的数据也必须用`证券代码`
- **K线数据**：字段定义说是`stockCode`，推送的数据也必须用`stockCode`

### 3. K线数据的嵌套结构是强制的

如果新增类似K线的数据源，必须使用嵌套结构：
```json
{
  "key": "...",
  "data": { 实际数据字段 }
}
```

前端会自动检测并提取 `data.data`。

### 4. 推送频率说明

- **实时快照**：每3秒推送 → 适合实时监控
- **K线数据**：每分钟推送 → 等到整分钟才有新数据

新增数据源时需要明确推送频率，避免用户误解。

---

## 🔧 v1.6.7 修复的问题

### 问题1：WebSocket连接失败（401 Unauthorized）

**原因**：尝试通过headers传递API Key，但WebSocket协议不支持自定义headers。

**修复**：
```javascript
// ❌ 错误
new WebSocket('ws://...', { headers: { 'X-API-Key': apiKey } })

// ✅ 正确
new WebSocket(`ws://...?api_key=${apiKey}`)
```

### 问题2：订阅成功但收不到数据（Pattern不匹配）

**原因**：
- 前端发送简化pattern：`ZZ-01/SZ.000001`
- 后端规范化为：`DECODED/ZZ-01/SZ.000001/*`
- 前端注册handler时用的key也是简化格式：`ZZ-01/SZ.000001`
- 后端推送时用规范化格式：`DECODED/ZZ-01/SZ.000001/*`
- **不匹配！** → handler收不到消息

**修复**：前端直接使用完整格式注册handler
```javascript
// 快照数据
patterns = symbols.map(s => `DECODED/${sourceCode}/${s}/*`)

// K线数据
patterns = symbols.map(s => `KLINE-1M/${sourceCode}/${s}`)
```

### 问题3：CSV数据全是"-"（字段名不匹配）

**原因**：
- 前端选择字段时用英文名：`last_price`, `open_price`
- 快照数据推送的是中文名：`最新价`, `开盘价`
- **完全匹配不上！**

**修复**：同时支持英文和中文字段名查找
```javascript
const chineseFieldName = this.fieldMapping.get(field) || field
const value = data[field] ?? data[chineseFieldName] ?? '-'
```

### 问题4：数组字段显示"[object Object]"

**修复**：JSON序列化
```javascript
if (typeof value === 'object' && value !== null) {
  value = JSON.stringify(value)
}
```

### 问题5：时间在Excel中显示错误

**原因**：
- 后端推送：`11.12.09`（点号格式）
- Excel自动解析为时间，但显示成 `12.09.0`（只有分:秒）

**修复**：
```javascript
// 1. 点号转冒号
if (/^\d{1,2}\.\d{2}\.\d{2}/.test(value)) {
  value = value.replace(/\./g, ':')  // 11.12.09 → 11:12:09
}

// 2. 加单引号前缀（强制Excel识别为文本）
if (/^\d{1,2}:\d{2}:\d{2}/.test(value)) {
  value = `'${value}`  // '11:12:09
}
```

---

## 📊 ClickHouse数据下载股票代码筛选

### 新增功能

**所有ClickHouse数据源**都支持按股票/期货代码筛选：

#### UI部分
- ✅ 显示"股票/期货代码（可选）"输入框
- ✅ 支持输入数字代码自动补全（`000001` → `SZ.000001`）
- ✅ 支持多个代码（逗号分隔）
- ✅ 留空下载全部数据

#### 后端参数
```json
{
  "table_name": "zz_5001",
  "format": "csv",
  "date_range": {
    "start_date": "2025-11-03",
    "end_date": "2025-11-03"
  },
  "symbols": ["SZ.000001", "SH.600000"]  // 🆕 新增
}
```

#### 效果
- 不筛选：~750万条，~2GB
- 筛选2只股票：~240条，~72KB
- **数据量减少99.9%！**

---

## 🎯 建议和最佳实践

### 1. 未来数据源统一为英文字段

**强烈建议**未来所有新增数据源使用**英文驼峰命名**：
- ✅ 便于维护
- ✅ 跨语言兼容
- ✅ 符合行业标准
- ✅ 避免编码问题

### 2. 统一嵌套结构

建议所有数据源统一使用嵌套结构：
```json
{
  "key": "数据唯一标识",
  "data": { 实际字段 }
}
```

**优点**：
- 便于后续扩展metadata
- 便于数据溯源
- 前端处理逻辑统一

### 3. 明确推送频率

在数据源文档中明确标注推送频率：
- 实时快照：每3秒
- K线数据：每分钟
- 新增数据源：需明确说明

### 4. Channel格式规范

建议统一Channel格式：
```
{DATA_TYPE}/{SOURCE_CODE}/{SYMBOL}[/DATE/TIME]
```

示例：
- `DECODED/ZZ-01/SZ.000001/20251103/1032`
- `KLINE-1M/ZZ-5001/SZ.000001`

---

## 📞 技术支持

如有问题，请联系开发团队。

---

**文档版本**: v1.0  
**更新时间**: 2025-11-03  
**适用平台**: 资舟量化研究平台 v1.6.8+

