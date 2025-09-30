<template>
  <div class="detail-content">
    <!-- 基本信息 -->
    <el-descriptions :column="3" border class="info-section">
      <el-descriptions-item label="数据源编码">
        {{ source.code }}
      </el-descriptions-item>
      <el-descriptions-item label="市场">
        {{ source.market }}
      </el-descriptions-item>
      <el-descriptions-item label="交易所">
        {{ source.exchange || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="数据类型">
        {{ source.data_type }}
      </el-descriptions-item>
      <el-descriptions-item label="更新频率">
        {{ source.update_frequency }}
      </el-descriptions-item>
      <el-descriptions-item label="Redis端口">
        {{ source.redis_port }}
      </el-descriptions-item>
      <el-descriptions-item label="RAW库">
        DB{{ source.raw_db }}
      </el-descriptions-item>
      <el-descriptions-item label="DECODED库">
        DB{{ source.decoded_db }}
      </el-descriptions-item>
      <el-descriptions-item label="字段总数">
        {{ source.field_count }} 个
      </el-descriptions-item>
    </el-descriptions>

    <!-- 格式切换 -->
    <el-radio-group v-model="formatType" class="format-selector">
      <el-radio-button value="decoded">JSON格式</el-radio-button>
      <el-radio-button value="raw">二进制格式</el-radio-button>
      <el-radio-button value="code">解析代码</el-radio-button>
    </el-radio-group>

    <!-- DECODED格式 -->
    <div v-if="formatType === 'decoded'" v-loading="formatLoading">
      <div v-if="decodedFormat" class="format-content">
        <el-descriptions :column="2" border class="mb-20">
          <el-descriptions-item label="格式">{{ decodedFormat.format }}</el-descriptions-item>
          <el-descriptions-item label="编码">{{ decodedFormat.encoding }}</el-descriptions-item>
          <el-descriptions-item label="Key模式" :span="2">
            <el-text type="info" style="font-family: monospace">
              {{ decodedFormat.key_pattern }}
            </el-text>
          </el-descriptions-item>
        </el-descriptions>

        <h4>字段说明</h4>
        <el-table :data="decodedFormat.fields" stripe max-height="400">
          <el-table-column prop="name" label="字段名" width="180">
            <template #default="scope">
              <el-text style="font-family: monospace">{{ scope.row.name }}</el-text>
            </template>
          </el-table-column>
          <el-table-column prop="cn_name" label="中文名" width="150" />
          <el-table-column prop="type" label="类型" width="100">
            <template #default="scope">
              <el-tag size="small">{{ scope.row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" />
          <el-table-column prop="example" label="示例" width="150">
            <template #default="scope">
              <el-text type="info" size="small">{{ scope.row.example }}</el-text>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="decodedFormat.example" class="example-section">
          <h4>JSON示例</h4>
          <pre class="json-example">{{ JSON.stringify(decodedFormat.example, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- RAW格式 -->
    <div v-if="formatType === 'raw'" v-loading="formatLoading">
      <div v-if="rawFormat" class="format-content">
        <el-descriptions :column="3" border class="mb-20">
          <el-descriptions-item label="总大小">{{ rawFormat.total_size }} bytes</el-descriptions-item>
          <el-descriptions-item label="字节序">{{ rawFormat.byte_order }}</el-descriptions-item>
          <el-descriptions-item label="消息头">{{ rawFormat.header_size }} bytes</el-descriptions-item>
        </el-descriptions>

        <h4>消息体字段</h4>
        <el-table :data="rawFormat.body_fields" stripe max-height="400">
          <el-table-column prop="name" label="字段名" width="180">
            <template #default="scope">
              <el-text style="font-family: monospace">{{ scope.row.name }}</el-text>
            </template>
          </el-table-column>
          <el-table-column prop="cn_name" label="中文名" width="150" />
          <el-table-column prop="type" label="类型" width="100">
            <template #default="scope">
              <el-tag size="small">{{ scope.row.type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="offset" label="偏移" width="80" />
          <el-table-column prop="size" label="大小" width="80" />
          <el-table-column prop="unit" label="单位" width="100" />
          <el-table-column prop="formula" label="公式" />
          <el-table-column prop="description" label="说明" />
        </el-table>
      </div>
    </div>

    <!-- 解析代码 -->
    <div v-if="formatType === 'code'" v-loading="formatLoading">
      <div class="code-selector">
        <el-select v-model="codeLanguage" @change="loadParserCode">
          <el-option label="Python" value="python" />
          <el-option label="Go" value="go" />
          <el-option label="C++" value="cpp" />
          <el-option label="Java" value="java" />
        </el-select>
        <el-button @click="copyCode" type="primary" size="small">
          <el-icon><CopyDocument /></el-icon>
          复制代码
        </el-button>
      </div>
      <pre v-if="parserCode" class="code-block">{{ parserCode }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'

// Props
const props = defineProps<{
  source: {
    code: string
    name: string
    market: string
    exchange: string
    data_type: string
    update_frequency: string
    redis_port: number
    raw_db: number
    decoded_db: number
    field_count: number
    enabled_count: number
  }
}>()

// 状态
const formatLoading = ref(false)
const formatType = ref('decoded')
const codeLanguage = ref('python')

// 数据
const decodedFormat = ref<any>(null)
const rawFormat = ref<any>(null)
const parserCode = ref<string>('')

// 加载DECODED格式
const loadDecodedFormat = async () => {
  formatLoading.value = true
  try {
    const result = await window.electronAPI.dictionary.getDecodedFormat(props.source.code)
    if (result.code === 200) {
      decodedFormat.value = result.data
    }
  } catch (error: any) {
    console.error('加载DECODED格式失败:', error)
    ElMessage.error(error.message || '加载格式失败')
  } finally {
    formatLoading.value = false
  }
}

// 加载RAW格式
const loadRawFormat = async () => {
  formatLoading.value = true
  try {
    const result = await window.electronAPI.dictionary.getRawFormat(props.source.code)
    if (result.code === 200) {
      rawFormat.value = result.data
    }
  } catch (error: any) {
    console.error('加载RAW格式失败:', error)
    ElMessage.error(error.message || '加载格式失败')
  } finally {
    formatLoading.value = false
  }
}

// 加载解析代码
const loadParserCode = async () => {
  formatLoading.value = true
  try {
    const result = await window.electronAPI.dictionary.getCode(props.source.code, codeLanguage.value)
    if (result.code === 200) {
      parserCode.value = result.data.code
    }
  } catch (error: any) {
    console.error('加载解析代码失败:', error)
    ElMessage.error(error.message || '加载解析代码失败')
  } finally {
    formatLoading.value = false
  }
}


// 复制代码
const copyCode = () => {
  if (parserCode.value) {
    navigator.clipboard.writeText(parserCode.value).then(() => {
      ElMessage.success('代码已复制到剪贴板')
    }).catch(() => {
      ElMessage.error('复制失败')
    })
  }
}

// 监听格式类型变化
const handleFormatChange = () => {
  switch (formatType.value) {
    case 'decoded':
      if (!decodedFormat.value) loadDecodedFormat()
      break
    case 'raw':
      if (!rawFormat.value) loadRawFormat()
      break
    case 'code':
      if (!parserCode.value) loadParserCode()
      break
  }
}

// 监听formatType变化
watch(formatType, handleFormatChange)

// 初始化
onMounted(() => {
  loadDecodedFormat()
})
</script>

<style scoped lang="scss">
.detail-content {
  .info-section {
    margin-bottom: 20px;
  }

  .format-selector {
    margin: 20px 0;
  }

  .format-content {
    h4 {
      margin: 20px 0 10px 0;
      font-size: 16px;
      font-weight: 500;
    }

    .mb-20 {
      margin-bottom: 20px;
    }

    .example-section {
      margin-top: 30px;
    }

    .json-example,
    .hex-data,
    .code-block {
      background-color: #f5f7fa;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 400px;
    }

    .hex-data {
      white-space: pre;
    }

    .code-selector {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }
  }
}

// 深色模式适配
@media (prefers-color-scheme: dark) {
  .detail-content {
    .json-example,
    .hex-data,
    .code-block {
      background-color: #1d1e1f;
    }
  }
}
</style>
