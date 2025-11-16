<template>
  <div v-if="visible" class="global-search-dropdown">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>搜索中...</span>
    </div>

    <!-- 无结果 -->
    <div v-else-if="!results || results.total === 0" class="empty-state">
      <el-icon><Search /></el-icon>
      <span>未找到匹配结果</span>
    </div>

    <!-- 搜索结果 -->
    <div v-else class="results-container">
      <!-- 行情数据结果 -->
      <div v-if="results.data.market && results.data.market.total > 0" class="result-section">
        <div class="section-header">
          <el-icon><DataLine /></el-icon>
          <span>行情数据</span>
          <el-tag size="small" type="primary">{{ results.data.market.total }}</el-tag>
        </div>
        <div class="result-items">
          <div
            v-for="(item, index) in results.data.market.results"
            :key="`market-${index}`"
            class="result-item"
            @click="handleSelect(item, 'market')"
          >
            <div class="item-header">
              <span class="item-title">{{ item.source_name }}</span>
              <span class="item-code">{{ item.source_code }}</span>
            </div>
            <div class="item-meta">
              <el-tag
                v-if="item.match_type === 'field'"
                size="small"
                type="primary"
              >
                字段: {{ item.match_field || item.match_field_en }}
              </el-tag>
              <el-tag v-else size="small" type="success">表名匹配</el-tag>
              <span class="item-market">{{ item.market }}</span>
              <span class="item-score">匹配度: {{ Math.round(item.match_score) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 静态元数据结果 -->
      <div v-if="results.data.static && results.data.static.total > 0" class="result-section">
        <div class="section-header">
          <el-icon><Document /></el-icon>
          <span>静态元数据</span>
          <el-tag size="small" type="success">{{ results.data.static.total }}</el-tag>
        </div>
        <div class="result-items">
          <div
            v-for="(item, index) in results.data.static.results"
            :key="`static-${index}`"
            class="result-item"
            @click="handleSelect(item, 'static')"
          >
            <div class="item-header">
              <span class="item-title">{{ item.table_comment || item.table_name }}</span>
              <span class="item-code">{{ item.table_name }}</span>
            </div>
            <div class="item-meta">
              <el-tag
                v-if="item.match_type === 'field'"
                size="small"
                type="primary"
              >
                字段: {{ item.match_field || item.match_field_en }}
              </el-tag>
              <el-tag v-else size="small" type="success">表名匹配</el-tag>
              <span v-if="item.category" class="item-category">{{ item.category }}</span>
              <span v-if="item.field_type" class="item-type">{{ item.field_type }}</span>
              <span class="item-score">匹配度: {{ Math.round(item.match_score) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 加工数据结果 -->
      <div v-if="results.data.processed && results.data.processed.total > 0" class="result-section">
        <div class="section-header">
          <el-icon><Operation /></el-icon>
          <span>加工数据</span>
          <el-tag size="small" type="warning">{{ results.data.processed.total }}</el-tag>
        </div>
        <div class="result-items">
          <div
            v-for="(item, index) in results.data.processed.results"
            :key="`processed-${index}`"
            class="result-item"
            @click="handleSelect(item, 'processed')"
          >
            <div class="item-header">
              <span class="item-title">{{ item.table_comment || item.table_name }}</span>
              <span class="item-code">{{ item.table_name }}</span>
            </div>
            <div class="item-meta">
              <el-tag
                v-if="item.match_type === 'field'"
                size="small"
                type="primary"
              >
                字段: {{ item.match_field || item.match_field_en }}
              </el-tag>
              <el-tag v-else size="small" type="success">表名匹配</el-tag>
              <span v-if="item.category" class="item-category">{{ item.category }}</span>
              <span v-if="item.field_type" class="item-type">{{ item.field_type }}</span>
              <span class="item-score">匹配度: {{ Math.round(item.match_score) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 行情镜像库结果 -->
      <div v-if="results.data.mirror && results.data.mirror.total > 0" class="result-section">
        <div class="section-header">
          <el-icon><CopyDocument /></el-icon>
          <span>行情镜像库</span>
          <el-tag size="small" type="info">{{ results.data.mirror.total }}</el-tag>
        </div>
        <div class="result-items">
          <div
            v-for="(item, index) in results.data.mirror.results"
            :key="`mirror-${index}`"
            class="result-item"
            @click="handleSelect(item, 'mirror')"
          >
            <div class="item-header">
              <span class="item-title">{{ item.table_comment || item.table_name }}</span>
              <span class="item-code">{{ item.table_name }}</span>
            </div>
            <div class="item-meta">
              <el-tag
                v-if="item.match_type === 'field'"
                size="small"
                type="primary"
              >
                字段: {{ item.match_field || item.match_field_en }}
              </el-tag>
              <el-tag v-else size="small" type="success">表名匹配</el-tag>
              <span v-if="item.category" class="item-category">{{ item.category }}</span>
              <span v-if="item.field_type" class="item-type">{{ item.field_type }}</span>
              <span class="item-score">匹配度: {{ Math.round(item.match_score) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 搜索统计 -->
      <div class="search-footer">
        <span>共找到 {{ results.total }} 条结果</span>
        <span class="search-time">耗时: {{ results.search_time_ms }}ms</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loading, Search, DataLine, Document, Operation, CopyDocument } from '@element-plus/icons-vue'

interface SearchResult {
  type: 'source' | 'table'
  match_type: 'table' | 'field' | 'comment'
  match_score: number
  match_field?: string
  match_field_en?: string
  source_code?: string
  source_name?: string
  market?: string
  table_name?: string
  table_comment?: string
  category?: string
  field_type?: string
}

interface GlobalSearchResponse {
  code: number
  message: string
  data: {
    market: { total: number; results: SearchResult[] }
    static: { total: number; results: SearchResult[] }
    processed: { total: number; results: SearchResult[] }
    mirror: { total: number; results: SearchResult[] }
  }
  total: number
  search_time_ms: number
}

defineProps<{
  visible: boolean
  results: GlobalSearchResponse | null
  loading: boolean
}>()

const emit = defineEmits<{
  select: [result: SearchResult, dataType: 'market' | 'static' | 'processed' | 'mirror']
  close: []
}>()

const handleSelect = (result: SearchResult, dataType: 'market' | 'static' | 'processed' | 'mirror') => {
  emit('select', result, dataType)
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
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 600px;
  overflow-y: auto;

  .loading-state,
  .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: #909399;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

    .el-icon {
      font-size: 32px;
    }
  }

  .results-container {
    padding: 10px 0;

    .result-section {
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: #f5f7fa;
        font-size: 14px;
        font-weight: 600;
        color: #303133;

        .el-icon {
          color: #409eff;
        }
      }

      .result-items {
        .result-item {
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
          border-bottom: 1px solid #f5f5f5;

          &:last-child {
            border-bottom: none;
          }

          &:hover {
            background: #f5f7fa;
          }

          .item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;

            .item-title {
              font-size: 14px;
              font-weight: 500;
              color: #303133;
            }

            .item-code {
              font-size: 12px;
              color: #909399;
              font-family: 'Consolas', monospace;
            }
          }

          .item-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;

            .item-market,
            .item-category,
            .item-type {
              font-size: 12px;
              color: #606266;
            }

            .item-score {
              font-size: 11px;
              color: #909399;
              margin-left: auto;
            }
          }
        }
      }
    }

    .search-footer {
      display: flex;
      justify-content: space-between;
      padding: 10px 16px;
      font-size: 12px;
      color: #909399;
      background: #fafafa;

      .search-time {
        color: #c0c4cc;
      }
    }
  }
}
</style>

