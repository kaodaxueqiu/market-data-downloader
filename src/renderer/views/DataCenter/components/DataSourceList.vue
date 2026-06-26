<template>
  <div class="data-source-list">
    <div class="list-header">
      <h3>数据表</h3>
      <el-tag v-if="selectedSource" type="success" size="small">
        已选: {{ selectedSource.table_name }}
      </el-tag>
    </div>

    <div class="list-content">
      <el-scrollbar height="100%">
        <div
          v-for="source in dataSources"
          :key="source.table_name"
          class="source-item"
          :class="{ active: isSelected(source) }"
          @click="handleSelect(source)"
        >
          <div class="source-info">
            <div class="source-name">
              <el-icon class="source-icon"><Document /></el-icon>
              <span class="name-text">{{ source.table_comment || source.table_name }}</span>
            </div>
            <div class="source-code">{{ source.table_name }}</div>
            <div class="source-meta">
              <el-tag v-if="source.category" size="small" :type="engine === 'postgresql' ? 'success' : 'warning'">
                {{ source.category }}
              </el-tag>
              <el-tag size="small" class="field-count">{{ source.field_count || 0 }} 字段</el-tag>
            </div>
          </div>
        </div>

        <el-empty
          v-if="dataSources.length === 0"
          description="暂无数据表"
          :image-size="80"
        />
      </el-scrollbar>
    </div>

    <div class="list-footer">
      <span class="total-count">共 {{ dataSources.length }} 张表</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'

const props = defineProps<{
  dataSources: any[]
  selectedSource: any
  engine: string
}>()

const emit = defineEmits<{ select: [source: any] }>()

const isSelected = (source: any) =>
  props.selectedSource?.table_name === source.table_name

const handleSelect = (source: any) => emit('select', source)
</script>

<style lang="scss" scoped>
.data-source-list {
  height: 100%;
  display: flex;
  flex-direction: column;

  .list-header {
    padding: 14px 15px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    h3 { margin: 0; font-size: 15px; font-weight: 600; color: #303133; }
  }

  .list-content {
    flex: 1;
    overflow: hidden;

    .source-item {
      padding: 10px 14px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: background 0.15s;

      &:hover { background: #f5f7fa; }

      &.active {
        background: #ecf5ff;
        border-left: 3px solid #409eff;
        .source-name .name-text { color: #409eff; font-weight: 600; }
      }

      .source-info {
        .source-name {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
          .source-icon { color: #909399; }
          .name-text {
            font-size: 13px;
            font-weight: 500;
            color: #303133;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
        .source-code {
          font-size: 11px;
          color: #909399;
          margin-bottom: 5px;
          font-family: 'Consolas', monospace;
        }
        .source-meta {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          .field-count { background: #f0f0f0; color: #606266; border: none; }
        }
      }
    }
  }

  .list-footer {
    padding: 8px 14px;
    border-top: 1px solid #e4e7ed;
    background: #fafafa;
    flex-shrink: 0;
    .total-count { font-size: 12px; color: #909399; }
  }
}
</style>
