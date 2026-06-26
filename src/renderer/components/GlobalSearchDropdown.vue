<template>
  <div v-if="visible" class="global-search-dropdown">
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>搜索中...</span>
    </div>

    <div v-else-if="!results || totalCount === 0" class="empty-state">
      <el-icon><Search /></el-icon>
      <span>未找到匹配结果</span>
    </div>

    <div v-else class="results-container">
      <!-- 按引擎分组 -->
      <div v-for="engineGroup in groupedResults" :key="engineGroup.engine" class="result-section">
        <div class="section-header">
          <el-icon><Coin v-if="engineGroup.engine === 'postgresql'" /><DataLine v-else /></el-icon>
          <span>{{ engineGroup.engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse' }}</span>
        </div>

        <!-- 按库分组 -->
        <div v-for="dbGroup in engineGroup.databases" :key="dbGroup.database" class="db-group">
          <div class="db-header">
            <el-tag size="small" type="info">{{ dbGroup.database }}</el-tag>
            <span class="db-count">{{ dbGroup.results.length }} 条</span>
          </div>
          <div
            v-for="(item, idx) in dbGroup.results"
            :key="idx"
            class="result-item"
            @click="handleSelect(item, engineGroup.engine, dbGroup.database)"
          >
            <div class="item-header">
              <span class="item-title">{{ item.table_comment || item.table_name }}</span>
              <span class="item-code">{{ item.table_name }}</span>
            </div>
            <div class="item-meta">
              <el-tag v-if="item.match_type === 'field'" size="small" type="primary">
                字段: {{ item.match_field || item.match_field_en }}
              </el-tag>
              <el-tag v-else size="small" type="success">表名匹配</el-tag>
              <span v-if="item.category" class="item-category">{{ item.category }}</span>
              <span class="item-score">匹配度: {{ Math.round(item.match_score) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="search-footer">
        <span>共找到 {{ totalCount }} 条结果</span>
        <span v-if="results?.search_time_ms" class="search-time">耗时: {{ results.search_time_ms }}ms</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Loading, Search, DataLine, Coin } from '@element-plus/icons-vue'

const props = defineProps<{
  visible: boolean
  results: any | null
  loading: boolean
}>()

const emit = defineEmits<{
  select: [result: any, engine: string, database: string]
  close: []
}>()

// 新版接口：results.data.results[] = [{ engine, database, table_name, ... }]
// 兼容旧版：results.data.static/processed/mirror/market
const groupedResults = computed(() => {
  if (!props.results) return []
  const data = props.results.data

  // 新格式：{ results: [...] }
  if (Array.isArray(data?.results)) {
    const map = new Map<string, Map<string, any[]>>()
    for (const item of data.results) {
      const eng = item.engine || 'postgresql'
      const db = item.database || ''
      if (!map.has(eng)) map.set(eng, new Map())
      const dbMap = map.get(eng)!
      if (!dbMap.has(db)) dbMap.set(db, [])
      dbMap.get(db)!.push(item)
    }
    return Array.from(map.entries()).map(([engine, dbMap]) => ({
      engine,
      databases: Array.from(dbMap.entries()).map(([database, results]) => ({ database, results }))
    }))
  }

  // 旧格式兼容（静态/加工/镜像）
  const groups: any[] = []
  const pgResults: any[] = []
  const chResults: any[] = []
  if (data?.static?.results) pgResults.push(...data.static.results.map((r: any) => ({ ...r, database: 'finance_db' })))
  if (data?.processed?.results) chResults.push(...data.processed.results.map((r: any) => ({ ...r, database: 'market_mart' })))
  if (data?.mirror?.results) chResults.push(...data.mirror.results.map((r: any) => ({ ...r, database: 'market_data' })))

  if (pgResults.length) {
    const dbMap = new Map<string, any[]>()
    pgResults.forEach(r => { if (!dbMap.has(r.database)) dbMap.set(r.database, []); dbMap.get(r.database)!.push(r) })
    groups.push({ engine: 'postgresql', databases: Array.from(dbMap.entries()).map(([database, results]) => ({ database, results })) })
  }
  if (chResults.length) {
    const dbMap = new Map<string, any[]>()
    chResults.forEach(r => { if (!dbMap.has(r.database)) dbMap.set(r.database, []); dbMap.get(r.database)!.push(r) })
    groups.push({ engine: 'clickhouse', databases: Array.from(dbMap.entries()).map(([database, results]) => ({ database, results })) })
  }
  return groups
})

const totalCount = computed(() => {
  return groupedResults.value.reduce((s, eg) =>
    s + eg.databases.reduce((s2: number, dg: any) => s2 + dg.results.length, 0), 0)
})

const handleSelect = (result: any, engine: string, database: string) => {
  emit('select', result, engine, database)
}
</script>

<style lang="scss" scoped>
.global-search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  z-index: 1000;
  max-height: 560px;
  overflow-y: auto;

  .loading-state, .empty-state {
    padding: 36px 20px;
    text-align: center;
    color: #909399;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    .el-icon { font-size: 28px; }
  }

  .results-container {
    .result-section {
      border-bottom: 1px solid #f0f0f0;
      &:last-child { border-bottom: none; }

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: #f5f7fa;
        font-size: 13px;
        font-weight: 600;
        color: #303133;
        .el-icon { color: #409eff; }
      }

      .db-group {
        .db-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px 4px 24px;
          background: #fafafa;
          .db-count { font-size: 11px; color: #909399; }
        }

        .result-item {
          padding: 10px 16px 10px 24px;
          cursor: pointer;
          border-bottom: 1px solid #f5f5f5;
          transition: background 0.15s;

          &:last-child { border-bottom: none; }
          &:hover { background: #f5f7fa; }

          .item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
            .item-title { font-size: 13px; font-weight: 500; color: #303133; }
            .item-code { font-size: 11px; color: #909399; font-family: 'Consolas', monospace; }
          }

          .item-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            .item-category { font-size: 11px; color: #606266; }
            .item-score { font-size: 11px; color: #909399; margin-left: auto; }
          }
        }
      }
    }

    .search-footer {
      display: flex;
      justify-content: space-between;
      padding: 8px 16px;
      font-size: 12px;
      color: #909399;
      background: #fafafa;
      .search-time { color: #c0c4cc; }
    }
  }
}
</style>
