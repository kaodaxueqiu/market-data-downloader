<template>
  <div class="static-data-detail">
    <div v-if="!source" class="empty-state">
      <el-empty description="请从左侧选择数据表" :image-size="120" />
    </div>

    <div v-else class="detail-content">
      <!-- 概要卡片 -->
      <div class="summary-card">
        <div class="card-header">
          <h3>{{ source.table_comment || source.table_name }}</h3>
          <el-tag type="primary">{{ source.table_name }}</el-tag>
        </div>

        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="数据分类">
            <el-tag type="success">{{ source.category || '未分类' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="字段数量">
            <el-tag size="small">{{ source.field_count || 0 }} 个</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="数据行数" v-if="tableDetail?.row_count !== undefined">
            {{ tableDetail.row_count.toLocaleString() }} 行
          </el-descriptions-item>
          <el-descriptions-item label="数据大小" v-if="tableDetail?.data_size">
            {{ tableDetail.data_size }}
          </el-descriptions-item>
          <el-descriptions-item
            label="数据入库时间"
            v-if="tableDetail?.earliest_update_time && tableDetail?.latest_update_time"
            :span="2"
          >
            <el-text type="primary" size="small">
              {{ tableDetail.earliest_update_time }} ~ {{ tableDetail.latest_update_time }}
            </el-text>
          </el-descriptions-item>
        </el-descriptions>

        <div class="quick-actions">
          <el-button type="primary" @click="showDetailDialog = true">
            <el-icon><View /></el-icon>
            查看字段详情
          </el-button>
          <el-button type="success" @click="emit('preview')">
            <el-icon><DataLine /></el-icon>
            数据预览
          </el-button>
        </div>
      </div>
    </div>

    <!-- 字段详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      :title="`${source?.table_comment || source?.table_name || ''} - 字段详情`"
      width="1100px"
      destroy-on-close
      class="detail-dialog"
    >
      <div class="fields-panel" v-loading="fieldsLoading">
        <!-- 数据统计 -->
        <el-descriptions
          v-if="tableDetail?.row_count !== undefined || tableDetail?.earliest_update_time"
          :column="2"
          border
          class="mb-15"
        >
          <el-descriptions-item label="数据行数" v-if="tableDetail.row_count !== undefined">
            <el-text type="primary">{{ tableDetail.row_count.toLocaleString() }} 行</el-text>
          </el-descriptions-item>
          <el-descriptions-item label="数据大小" v-if="tableDetail.data_size">
            <el-text type="success">{{ tableDetail.data_size }}</el-text>
          </el-descriptions-item>
          <el-descriptions-item label="字段数量">{{ fields.length }} 个</el-descriptions-item>
          <el-descriptions-item
            label="数据入库时间范围"
            v-if="tableDetail.earliest_update_time && tableDetail.latest_update_time"
            :span="2"
          >
            <el-text type="primary">
              {{ tableDetail.earliest_update_time }} ~ {{ tableDetail.latest_update_time }}
            </el-text>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 双列字段表 -->
        <div class="fields-grid">
          <div class="grid-column">
            <el-table :data="leftFields" stripe size="small">
              <el-table-column type="index" label="#" width="50" :index="(i: number) => i + 1" />
              <el-table-column prop="column_name" label="字段名" width="170">
                <template #default="{ row }">
                  <el-text style="font-family: monospace">{{ row.column_name }}</el-text>
                  <el-tag v-if="row.is_primary_key" type="danger" size="small" style="margin-left:4px">PK</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="column_comment" label="说明" min-width="140" />
              <el-table-column prop="data_type" label="类型" width="180" show-overflow-tooltip>
                <template #default="{ row }"><el-tag size="small">{{ row.data_type }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="is_nullable" label="可空" width="60" align="center">
                <template #default="{ row }">
                  <el-icon v-if="row.is_nullable" color="#67C23A"><Check /></el-icon>
                  <el-icon v-else color="#F56C6C"><Close /></el-icon>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div class="grid-column">
            <el-table :data="rightFields" stripe size="small">
              <el-table-column type="index" label="#" width="50" :index="(i: number) => i + 1 + leftFields.length" />
              <el-table-column prop="column_name" label="字段名" width="170">
                <template #default="{ row }">
                  <el-text style="font-family: monospace">{{ row.column_name }}</el-text>
                  <el-tag v-if="row.is_primary_key" type="danger" size="small" style="margin-left:4px">PK</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="column_comment" label="说明" min-width="140" />
              <el-table-column prop="data_type" label="类型" width="180" show-overflow-tooltip>
                <template #default="{ row }"><el-tag size="small">{{ row.data_type }}</el-tag></template>
              </el-table-column>
              <el-table-column prop="is_nullable" label="可空" width="60" align="center">
                <template #default="{ row }">
                  <el-icon v-if="row.is_nullable" color="#67C23A"><Check /></el-icon>
                  <el-icon v-else color="#F56C6C"><Close /></el-icon>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Check, Close, DataLine } from '@element-plus/icons-vue'

const props = defineProps<{
  source: any
  engine: string
  database: string
}>()

const emit = defineEmits<{ preview: [] }>()

const fields = ref<any[]>([])
const fieldsLoading = ref(false)
const tableDetail = ref<any>(null)
const showDetailDialog = ref(false)

const leftFields = computed(() => {
  const half = Math.ceil(fields.value.length / 2)
  return fields.value.slice(0, half)
})

const rightFields = computed(() => {
  const half = Math.ceil(fields.value.length / 2)
  return fields.value.slice(half)
})

const loadFields = async () => {
  if (!props.source?.table_name || !props.engine || !props.database) return
  fieldsLoading.value = true
  try {
    const result = await window.electronAPI.dbdict.getTableDetail(
      props.engine, props.database, props.source.table_name
    )
    if (result.code === 200) {
      tableDetail.value = result.data
      fields.value = result.data?.columns || []
    } else {
      ElMessage.error(result.msg || '加载字段失败')
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载字段失败')
  } finally {
    fieldsLoading.value = false
  }
}

watch(() => props.source, (val) => {
  if (val) {
    loadFields()
  } else {
    fields.value = []
    tableDetail.value = null
    showDetailDialog.value = false
  }
}, { immediate: true })
</script>

<style lang="scss" scoped>
.static-data-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 15px;
  overflow-y: auto;

  .empty-state {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .detail-content {
    display: flex;
    flex-direction: column;
    gap: 15px;

    .summary-card {
      background: white;
      border-radius: 8px;
      padding: 15px;
      border: 1px solid #e4e7ed;

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        h3 { margin: 0; font-size: 15px; font-weight: 600; }
      }

      .quick-actions {
        margin-top: 14px;
        display: flex;
        gap: 10px;
        justify-content: center;
        .el-button { flex: 1; }
      }
    }
  }
}

.fields-panel {
  .fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    .grid-column { min-width: 0; }
  }
}

.mb-15 { margin-bottom: 15px; }

:global(.detail-dialog.el-dialog) {
  height: 80vh;
  display: flex;
  flex-direction: column;
  margin: 10vh auto !important;
}

:global(.detail-dialog.el-dialog .el-dialog__body) {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  min-height: 0;
}
</style>
