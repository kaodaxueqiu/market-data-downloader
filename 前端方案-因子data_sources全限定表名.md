# 前端方案：因子 data_sources 保存全限定表名（库.表）

> 配合本次「回测两入口行为不一致」根因修复。后端已完成网关精确定位 + 历史数据迁移，前端需在**保存因子时就用全限定表名**，从源头保证数据干净。

## 一、问题背景

同一个因子从「我的因子」和「单因子回测」两个入口提交，后端产出不一致。根因链：

1. 因子定义里 `data_sources` 的表名存的是**裸表名**（如 `zz_500D`），没有库前缀
2. 网关旧逻辑 `inferDataSourceDB` 按"没前缀就算 PG"**猜**库，把 `zz_500D` 猜成 `postgresql`（实际它在 CH 的 `market_mart` 库）
3. 导致两个入口传给引擎的 `data_sources` 不一致（table 名 + database 都不同）

**后端已修复**：
- 网关 `resolveTableLocation` 改为查 ClickHouse `system.tables` **精确定位**，裸名补全限定名，定位不到直接报错拒绝提交（不再猜）
- 保存因子时也做标准化（`normalizeDataSourcesForStore`）
- 历史 560 行脏数据已迁移为全限定名

**前端要做的**：保存因子时，`data_sources` 的 key 直接用**全限定表名 `库.表`**，而不是裸表名。这样存储层从源头就是干净的。

## 二、根因定位（前端侧）

问题在 [MyFactors.vue](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue) 两处：

### 2.1 选表时丢弃了库名

[MyFactors.vue:2084-2088](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L2084-L2088)：

```typescript
const selectSearchResult = async (item: any) => {
  const source = dataSources.value[currentSearchIndex.value]
  source.table = item.table_name      // ← 只取裸表名，丢了 item.database
  source.engine = item.engine
  source.database = item.database      // database 存到了 source 上，但下面 buildDataSources 没用它组 key
  ...
}
```

搜索结果 `item` 里明明有 `item.database`（库名，如 `market_mart`）和 `item.table_name`（裸名 `zz_500D`），但 `source.table` 只存了裸名。

### 2.2 组装 data_sources 时用裸名做 key

[MyFactors.vue:2190-2209](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L2190-L2209)：

```typescript
const buildDataSources = () => {
  const result: Record<string, any> = {}
  for (const source of dataSources.value) {
    if (source.table && source.fields.length > 0 && ...) {
      const dsConfig: any = { date_field, code_field, fields }
      ...
      result[source.table] = dsConfig   // ← key 用裸名 source.table，丢了库前缀
    }
  }
  return ...
}
```

## 三、修改方案

### 3.1 选表时组装全限定表名

改 [MyFactors.vue:2084-2088](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L2084) `selectSearchResult`：把库名拼进 `source.table`（若搜索结果已带前缀则不重复拼）。

```typescript
const selectSearchResult = async (item: any) => {
  const source = dataSources.value[currentSearchIndex.value]
  // 全限定表名：库.表。ClickHouse 需要库前缀才能唯一定位；PG 表保持原样（schema.table 或裸名）。
  const db = item.database || ''
  const rawTable = item.table_name || ''
  source.table = (db && !rawTable.includes('.')) ? `${db}.${rawTable}` : rawTable
  source.engine = item.engine
  source.database = item.database
  source.fields = []
  ...
}
```

> 说明：CH 表的 `item.database` 是库名（`market_mart` 等），拼成 `market_mart.zz_500D`。若 `table_name` 已含 `.`（已是全限定名）则不重复拼。

### 3.2 buildDataSources 保持不变

`result[source.table]` 此时 `source.table` 已经是全限定名，无需再改。

### 3.3 回填/编辑因子时的兼容

编辑已有因子时，`data_sources` 从后端读回来填充到 `dataSources.value`。历史数据已迁移为全限定名，回填的 `source.table` 会是 `market_mart.zz_500D`，直接展示即可，无需特殊处理。

**但要注意获取字段的调用**——[MyFactors.vue:2126](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L2126)：

```typescript
const result = await window.electronAPI.dbdict.getTableFields(source.engine, source.database, source.table)
```

如果 `source.table` 现在带库前缀（`market_mart.zz_500D`），要确认 `getTableFields` 的第三个参数期望的是**裸表名还是全限定名**。若它内部再拼 `database.table`，传全限定名会变成 `market_mart.market_mart.zz_500D` 出错。

**建议**：调用 `getTableFields` 时传裸表名（去掉库前缀），因为 database 已单独作为第二个参数传了：

```typescript
const bareTable = source.table.includes('.') ? source.table.split('.').pop()! : source.table
const result = await window.electronAPI.dbdict.getTableFields(source.engine, source.database, bareTable)
```

## 四、其它入口一并核对

`MyFactors.vue` 里还有几处硬编码 `database: 'clickhouse'` 的默认值（[2038](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L2038)、[2144](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L2144)、[2218](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L2218)、[3167](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/MyFactors.vue#L3167)），这些只是空表单初值，不影响，无需改。

「单因子回测」入口（[SubmitContent.vue](file:///opt/market-data-downloader/src/renderer/views/FactorLibrary/Backtest/SubmitContent.vue)）已经用带前缀的 `market_mart.zz_500D`，行为正确，无需改。

## 五、验证

改完后新建/编辑一个因子，选 `zz_500D` 表，保存后查数据库：

```sql
SELECT jsonb_object_keys(data_sources) FROM factor_metadata WHERE factor_id='xxx';
-- 期望：market_mart.zz_500D（带库前缀），不是裸的 zz_500D
```

然后从「我的因子」和「单因子回测」两个入口分别提交同一因子，两个任务的 `task_config.data_sources` 应完全一致。

## 六、改动清单

| 文件 | 改动 | 说明 |
|------|------|------|
| `MyFactors.vue` `selectSearchResult` | 组装全限定表名 `库.表` | 核心修复 |
| `MyFactors.vue` `getTableFields` 调用 | 传裸表名（剥掉库前缀） | 避免重复拼接 |

**只改 1 个文件 2 处，约 6 行。**
