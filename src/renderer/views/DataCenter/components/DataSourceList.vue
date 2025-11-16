<template>
  <div class="data-source-list">
    <div class="list-header">
      <h3>数据源列表</h3>
      <el-tag v-if="selectedSource" type="success" size="small">
        已选: {{ selectedSource.code || selectedSource.table_name }}
      </el-tag>
    </div>

    <div class="list-content">
      <el-scrollbar height="100%">
        <div
          v-for="source in dataSources"
          :key="source.code || source.table_name"
          class="source-item"
          :class="{ active: isSelected(source) }"
          @click="handleSelect(source)"
        >
          <div class="source-info">
            <div class="source-name">
              <el-icon class="source-icon">
                <component :is="getIcon(source)" />
              </el-icon>
              <span class="name-text">{{ getSourceName(source) }}</span>
            </div>
            <div class="source-code">
              {{ getSourceCode(source) }}
            </div>
            <div class="source-meta">
              <el-tag v-if="activeTab === 'market'" size="small" type="primary">
                {{ source.market || '未知' }}
              </el-tag>
              <el-tag v-if="activeTab === 'static' || activeTab === 'processed'" size="small" :type="activeTab === 'processed' ? 'warning' : 'success'">
                {{ source.category || '未分类' }}
              </el-tag>
              <el-tag size="small" class="field-count">
                {{ getFieldCount(source) }} 字段
              </el-tag>
            </div>
          </div>
        </div>

        <el-empty 
          v-if="dataSources.length === 0" 
          description="暂无数据源"
          :image-size="100"
        />
      </el-scrollbar>
    </div>

    <div class="list-footer">
      <span class="total-count">共 {{ dataSources.length }} 个数据源</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// import { computed } from 'vue'  // 未使用
import { DataLine, Document } from '@element-plus/icons-vue'

const props = defineProps<{
  dataSources: any[]
  selectedSource: any
  activeTab: 'market' | 'static' | 'processed' | 'mirror'
}>()

const emit = defineEmits<{
  select: [source: any]
}>()

// 判断是否选中
const isSelected = (source: any) => {
  if (!props.selectedSource) return false
  const sourceId = source.code || source.table_name
  const selectedId = props.selectedSource.code || props.selectedSource.table_name
  return sourceId === selectedId
}

// 获取数据源名称
const getSourceName = (source: any) => {
  return source.name || source.table_comment || source.table_name || '未知'
}

// 获取数据源代码
const getSourceCode = (source: any) => {
  return source.code || source.table_name || ''
}

// 获取字段数量
const getFieldCount = (source: any) => {
  return source.field_count || source.fields?.length || 0
}

// 获取图标
const getIcon = (_source: any) => {
  return props.activeTab === 'market' ? DataLine : Document
}

// 选择数据源
const handleSelect = (source: any) => {
  emit('select', source)
}
</script>

<style lang="scss" scoped>
.data-source-list {
  height: 100%;
  display: flex;
  flex-direction: column;

  .list-header {
    padding: 15px;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .list-content {
    flex: 1;
    overflow: hidden;

    .source-item {
      padding: 12px 15px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #f5f7fa;
      }

      &.active {
        background: #ecf5ff;
        border-left: 3px solid #409eff;

        .source-name .name-text {
          color: #409eff;
          font-weight: 600;
        }
      }

      .source-info {
        .source-name {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;

          .source-icon {
            color: #909399;
          }

          .name-text {
            font-size: 14px;
            font-weight: 500;
            color: #303133;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        .source-code {
          font-size: 12px;
          color: #909399;
          margin-bottom: 6px;
          font-family: 'Consolas', monospace;
        }

        .source-meta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;

          .field-count {
            background: #f0f0f0;
            color: #606266;
            border: none;
          }
        }
      }
    }
  }

  .list-footer {
    padding: 10px 15px;
    border-top: 1px solid #e4e7ed;
    background: #fafafa;

    .total-count {
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>


