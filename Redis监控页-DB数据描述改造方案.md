# Redis 监控页 —— DB 数据描述改造方案（前端）

## 一、背景与目标

系统监控 → Redis 监控页的 DB 列表中，「类型」「消息类型」两列此前是**前端硬编码**的：
- 「类型」按 DB 编号猜（DB0=DECODED / DB1=RAW / DB2=SYSTEM / 其余=UNKNOWN）；
- 「消息类型」直接取实例配置的 `purpose`，导致同一端口所有 DB 显示同一句话（如 6383 全是「Flink流处理」），与实际存储的数据对不上。

**目标**：改为由后端 JSON 字典驱动。前端按「端口 + DB 号」向后端接口查询每个 DB 的类型与描述：
- **查到** → 显示后端返回的 `type` / `messageType`；
- **查不到** → 两列都显示「未定义」。

后端 JSON 可随时增删条目，**改描述无需重新打包前端**。前端不再预设任何端口范围、不做任何硬编码推断。

---

## 二、后端接口（已上线，前端直接调用即可）

- **方法 / 路径**：`GET /api/v1/redis-dbdict`
- **完整地址**：`{API 网关 BASE_URL}/redis-dbdict`（网关 BASE_URL 与现有其他接口一致，例如 `http://<gateway>:8080/api/v1`）
- **鉴权**：公开只读，无需 API Key（与监控页现有 Prometheus 查询调用方式一致）
- **返回**：`200`，`application/json`
- **实时读文件**：后端每次请求实时读取 JSON，字典更新后前端刷新页面即生效。

### 返回结构

```json
{
  "instances": {
    "<端口>": {
      "<DB号>": { "type": "字符串", "messageType": "字符串" }
    }
  }
}
```

- `instances` 下的 key 是 **Redis 端口号（字符串）**，如 `"6383"`；
- 每个端口下的 key 是 **DB 号（字符串）**，如 `"6"`；
- 每个 DB 条目含 `type`（用于彩色标签）与 `messageType`（详细数据描述）。
- 未在此结构中出现的端口 / DB，前端按「未定义」处理。

### 返回示例（当前线上真实返回）

```json
{
  "instances": {
    "6383": {
      "4":  { "type": "行情",     "messageType": "后复权因子（key: hfq:交易所.代码）" },
      "5":  { "type": "行情",     "messageType": "个股按日聚合数据（key: 交易所.代码:交易日）" },
      "6":  { "type": "行情",     "messageType": "A股分钟级行情（key: 交易所.代码:交易日:分钟时间戳）" },
      "7":  { "type": "行情",     "messageType": "A股分钟级行情-副本/衍生（key: 交易所.代码:交易日:分钟时间戳）" },
      "8":  { "type": "行情",     "messageType": "指数/中证行业成分按日数据（key: 指数或行业名:交易日）" },
      "9":  { "type": "基础数据", "messageType": "申万行业分类（key: sw_industry:行业代码）" },
      "10": { "type": "基础数据", "messageType": "ST股票名单按日快照（key: st_stocks:交易日）" }
    }
  }
}
```

> 注意：`type` 是自由字符串（可能是 `行情`、`基础数据`、也可能是 `DECODED`/`RAW`/`SYSTEM` 等），前端标签颜色映射需容错——匹配不到就用中性/灰色，不要报错。

---

## 三、前端改造点

监控页 Redis DB 列表数据来自一个数据加载逻辑（React 项目为 `useRedisDB` hook，Vue 项目为页面组件的 `fetchDBData`）。核心改造是：**加载 DB 列表前，先拉一次字典；渲染每行时用「端口+DB号」查字典决定两列内容。**

### 3.1 新增：拉取字典

在页面/hook 初始化时请求一次字典（字典相对稳定，不需要跟随监控数据每隔几秒轮询）：

```ts
// 字典结构：{ 端口: { DB号: { type, messageType } } }
type DBDictEntry = { type?: string; messageType?: string }
let dbDict: Record<string, Record<string, DBDictEntry>> = {}

async function fetchDBDict() {
  try {
    const res = await fetch(`${API_BASE_URL}/redis-dbdict`)
    const json = await res.json()
    dbDict = json?.instances || {}
  } catch (e) {
    console.error('获取 Redis DB 数据字典失败:', e)
    dbDict = {}   // 拉取失败 → 全部按「未定义」显示
  }
}
```

> **网关地址必须引用项目现有统一常量，不要硬编码。** 本项目已有 `API_CONFIG.BASE_URL`（`src/renderer/api/constants.ts`，值即 `http://61.151.241.233:8080/api/v1`）。请 `import { API_CONFIG } from '@/api/constants'`，用 `${API_CONFIG.BASE_URL}/redis-dbdict`。切勿把 IP/端口散落到各文件，否则将来迁移地址要全局搜替换。
> 若项目里 Prometheus 是走 `/api/prometheus` 之类的代理，建议同样为本接口加一个代理路由（如 `/api/redis-dbdict` → 转发到网关 `/api/v1/redis-dbdict`），保持与现有调用风格一致、规避跨域。

### 3.2 新增：按端口+DB号查字典

```ts
function lookupDBDict(port: string, dbIndex: number): DBDictEntry | null {
  const inst = dbDict[port]
  if (!inst) return null
  return inst[String(dbIndex)] || null
}
```

### 3.3 修改：渲染每行时取值（删除旧硬编码）

**删除**原来「按 DB 编号猜类型 + 用 purpose/portMessageTypeMap 填消息类型」的整段逻辑（含 `portMessageTypeMap`、`db6382Map`、`if (dbIndex===0) DECODED ...` 等），**替换为**：

```ts
const dict = lookupDBDict(port, dbIndex)
const dataType   = dict?.type        || '未定义'
const messageType = dict?.messageType || '未定义'
```

然后照常把 `dataType` / `messageType` 写进该行数据对象。

### 3.4 调整：类型字段与标签颜色容错

- `dataType` 类型定义由联合类型 `'RAW' | 'DECODED' | 'SYSTEM' | 'UNKNOWN'` 放宽为 `string`（因为后端 `type` 是自由字符串）。
- 标签颜色映射函数需容错：匹配不到的 `type`（含「未定义」）一律用中性/灰色，切勿抛错。示例：

```ts
function getTypeTagColor(type: string): string {
  const map: Record<string, string> = {
    RAW: 'blue', DECODED: 'green', SYSTEM: 'orange',
    '未定义': 'gray', '行情': 'green', '基础数据': 'blue',
  }
  return map[type] || 'gray'
}
```

### 3.5 加载顺序

页面初始化时：**先 `await fetchDBDict()`，再加载/首刷 DB 监控数据**，保证首屏渲染时字典已就位。后续监控数据的定时轮询保持不变，无需重复拉字典（如需支持后端热更新字典，可在轮询里顺带每隔 N 次刷新一次字典，非必需）。

### 3.6 修改：顶部「类型」筛选下拉改为动态提取

页面顶部的「类型」筛选下拉原来写死了 `DECODED / RAW / SYSTEM` 选项。由于 `type` 现在是后端自由字符串（`行情`、`基础数据`… 可随时新增），**筛选选项不能再写死**，否则会重蹈「前端硬编码、与真实数据对不上」的问题。

改为**从当前已加载的 DB 列表里动态提取所有出现过的 `type`（去重）**，再加一个「全部」选项。后端 JSON 加了什么 type，下拉里就自动出现什么，且永远和表格一致；「未定义」也会自然出现在下拉里，方便单独筛出未标注的 DB。

```ts
// 动态类型选项：从当前 DB 列表提取所有 type 去重，前面加「全部」
const typeOptions = computed(() => [
  'all',
  ...Array.from(new Set(databases.value.map(d => d.dataType)))
])
```

- 下拉遍历 `typeOptions` 渲染（`all` 显示为「全部」）。
- `filterType` 的过滤逻辑不变：`filterType === 'all' || row.dataType === filterType`。

---

## 四、验收标准

1. 6383 的 DB4~DB10 显示后端 JSON 中的真实描述（如 DB6 显示「A股分钟级行情（key: …）」），不再是「Flink流处理」。
2. JSON 中**未定义**的端口/DB（如 6380、或 6383 的 DB0），「类型」「消息类型」两列均显示「未定义」。
3. 接口请求失败时，页面不报错、不白屏，全部按「未定义」降级显示。
4. 后端修改 JSON 后（不重启网关、不重新打包前端），前端刷新页面即可看到新描述。
5. 顶部「类型」筛选下拉的选项与表格中实际出现的 type 一致（如「行情」「基础数据」「未定义」），后端新增 type 后下拉自动出现，无需改前端。

---

## 五、备注

- 本方案不改变监控数值（key 数量、内存、连接数等）的现有 Prometheus 查询逻辑，只替换「类型」「消息类型」两列的取值来源。
- 后端 JSON 由运维/后端维护，路径为网关侧 `config/redis_dbdict.json`，结构自由，可持续补充其他端口的 DB 描述。
