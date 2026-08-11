<template>
  <div class="engine-config-page">
    <!-- 三级 tab 导航 -->
    <div class="content-card nav-card">
    <div class="nav-tabs">
      <button
        v-if="hasPermission('cache_management')"
        class="nav-tab"
        :class="{ active: activeTab === 'cache' }"
        @click="switchTab('cache')"
      >
        <el-icon><Coin /></el-icon>
        <span>数据缓存管理</span>
      </button>
      <button
        v-if="hasPermission('factor_dict_sync')"
        class="nav-tab"
        :class="{ active: activeTab === 'dict-sync' }"
        @click="switchTab('dict-sync')"
      >
        <el-icon><Refresh /></el-icon>
        <span>因子字典同步</span>
      </button>
      <button
        v-if="hasPermission('admission_config')"
        class="nav-tab"
        :class="{ active: activeTab === 'admission-config' }"
        @click="switchTab('admission-config')"
      >
        <el-icon><Document /></el-icon>
        <span>入库审核配置</span>
      </button>
      <button
        v-if="hasPermission('quota_config')"
        class="nav-tab"
        :class="{ active: activeTab === 'quota-config' }"
        @click="switchTab('quota-config')"
      >
        <el-icon><Histogram /></el-icon>
        <span>并发配额</span>
      </button>
    </div>
    </div>

    <!-- tab 内容 -->
      <CacheManagerMain v-if="activeTab === 'cache'" />

      <el-scrollbar v-else class="content-card content-body">
      <div v-if="activeTab === 'dict-sync'" class="dict-sync-panel">
        <div class="dict-sync-desc">
          从回测引擎拉取最新算子清单并更新因子字典。同步后可在因子表达式中使用最新算子。
        </div>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="syncing"
          @click="handleSync"
        >
          同步最新因子字典
        </el-button>
        <div v-if="lastSyncResult" class="dict-sync-result">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="同步数量">{{ lastSyncResult.synced_count }}</el-descriptions-item>
            <el-descriptions-item label="数据来源">{{ lastSyncResult.source }}</el-descriptions-item>
            <el-descriptions-item label="结果">{{ lastSyncResult.message }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <div v-else-if="activeTab === 'admission-config'" class="admission-config-panel">
        <div class="admission-desc">
          编辑入库审核标准 admission.yaml（分档阈值、样本区间、CNE6、成本等）。
          保存后经网关校验，<strong>下一个入库审核任务生效</strong>。
        </div>
        <div class="editor-toolbar">
          <el-button :icon="Refresh" @click="loadAdmissionYaml" :loading="admissionLoading">重新加载</el-button>
          <el-button type="primary" :icon="Check" @click="saveAdmissionYaml" :loading="admissionSaving" :disabled="!isDirty">保存</el-button>
        </div>
        <div ref="yamlEditorRef" class="yaml-editor"></div>
        <div v-if="admissionError" class="admission-error">
          <el-alert type="error" :closable="false" :title="admissionError" />
        </div>
      </div>

      <div v-else-if="activeTab === 'quota-config'" class="admission-config-panel">
        <div class="admission-desc">
          编辑并发配额 quota.yaml（<code>defaultMaxPods</code> 为默认并发，<code>userQuotas</code> 为各用户中文名对应的并发上限，范围 1~50）。
          保存后经网关校验，<strong>调度器将在 1 分钟内生效</strong>。
        </div>
        <div class="editor-toolbar">
          <el-button :icon="Refresh" @click="loadQuotaYaml" :loading="quotaLoading">重新加载</el-button>
          <el-button type="primary" :icon="Check" @click="saveQuotaYaml" :loading="quotaSaving" :disabled="!quotaIsDirty">保存</el-button>
        </div>
        <div ref="quotaEditorRef" class="yaml-editor"></div>
        <div v-if="quotaError" class="admission-error">
          <el-alert type="error" :closable="false" :title="quotaError" />
        </div>
      </div>
        </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Coin, Refresh, Document, Check, Histogram } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { EditorView, basicSetup } from 'codemirror'
import { yaml as yamlLang } from '@codemirror/lang-yaml'
import CacheManagerMain from '../CacheManager/Main.vue'

const route = useRoute()
const router = useRouter()

const activeTab = ref<'cache' | 'dict-sync' | 'admission-config' | 'quota-config'>('cache')

// 菜单权限（从 App.vue 注入）
const menuPermissions = inject<{ value: string[] }>('menuPermissions', { value: [] })
const hasPermission = (menuId: string): boolean => {
  const permissions = menuPermissions.value || []
  if (permissions.length === 0) return true
  return permissions.includes(menuId)
}

const availableTabs = computed(() => {
  const tabs: string[] = []
  if (hasPermission('cache_management')) tabs.push('cache')
  if (hasPermission('factor_dict_sync')) tabs.push('dict-sync')
  if (hasPermission('admission_config')) tabs.push('admission-config')
  if (hasPermission('quota_config')) tabs.push('quota-config')
  return tabs
})

// 根据路由设置 tab
const setTabFromRoute = () => {
  if (route.path.includes('/engine-config/dict-sync') && hasPermission('factor_dict_sync')) {
    activeTab.value = 'dict-sync'
  } else if (route.path.includes('/engine-config/admission-config') && hasPermission('admission_config')) {
    activeTab.value = 'admission-config'
  } else if (route.path.includes('/engine-config/quota-config') && hasPermission('quota_config')) {
    activeTab.value = 'quota-config'
  } else if (route.path.includes('/engine-config/cache') && hasPermission('cache_management')) {
    activeTab.value = 'cache'
  } else if (availableTabs.value.length > 0) {
    activeTab.value = availableTabs.value[0] as 'cache' | 'dict-sync' | 'admission-config' | 'quota-config'
  }
}

const switchTab = (tab: 'cache' | 'dict-sync' | 'admission-config' | 'quota-config') => {
  const routeMap: Record<string, string> = {
    cache: '/factor-library/engine-config/cache',
    'dict-sync': '/factor-library/engine-config/dict-sync',
    'admission-config': '/factor-library/engine-config/admission-config',
    'quota-config': '/factor-library/engine-config/quota-config'
  }
  if (routeMap[tab]) {
    activeTab.value = tab
    router.push(routeMap[tab])
  }
}

watch(() => route.path, () => {
  setTabFromRoute()
}, { immediate: true })

// ===== 因子字典同步 =====
const syncing = ref(false)
const lastSyncResult = ref<{ synced_count: number; source: string; message: string } | null>(null)

const handleSync = async () => {
  syncing.value = true
  try {
    const result = await window.electronAPI.factor.syncExpressionCatalog()
    if (result.success && result.data) {
      lastSyncResult.value = result.data
      ElMessage.success(result.data.message || '同步成功')
    } else {
      ElMessage.error(result.error || '同步失败')
    }
  } catch (e: any) {
    ElMessage.error('同步失败: ' + (e.message || e))
  } finally {
    syncing.value = false
  }
}

// ===== 入库审核配置 =====
const yamlEditorRef = ref<HTMLElement>()
let yamlEditor: EditorView | null = null
const admissionLoading = ref(false)
const admissionSaving = ref(false)
const admissionError = ref('')
// 记录加载时的原始内容，用于判断是否有改动
const originalYaml = ref('')
const isDirty = ref(false)

const initEditor = (initialValue = '') => {
  if (!yamlEditorRef.value || yamlEditor) return
  yamlEditor = new EditorView({
    doc: initialValue,
    extensions: [
      basicSetup,
      yamlLang(),
      // 监听文档变化，实时更新是否有改动
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isDirty.value = update.state.doc.toString() !== originalYaml.value
        }
      })
    ],
    parent: yamlEditorRef.value
  })
}

const setEditorValue = (value: string) => {
  if (!yamlEditor) return
  yamlEditor.dispatch({
    changes: { from: 0, to: yamlEditor.state.doc.length, insert: value }
  })
}

const loadAdmissionYaml = async () => {
  admissionLoading.value = true
  admissionError.value = ''
  try {
    const res = await window.electronAPI.backtest.getAdmissionConfig()
    if (res.success) {
      const yaml = res.data?.yaml || ''
      setEditorValue(yaml)
      // 记录原始内容，重置改动状态
      originalYaml.value = yaml
      isDirty.value = false
    } else {
      admissionError.value = res.error || '加载失败'
    }
  } catch (e: any) {
    admissionError.value = e.message || '加载失败'
  } finally {
    admissionLoading.value = false
  }
}

const saveAdmissionYaml = async () => {
  const yaml = yamlEditor?.state.doc.toString() || ''
  admissionSaving.value = true
  admissionError.value = ''
  try {
    const res = await window.electronAPI.backtest.saveAdmissionConfig(yaml)
    if (res.success) {
      ElMessage.success('已保存，下一个入库审核任务生效')
      // 保存成功后，当前内容成为新的原始内容
      originalYaml.value = yaml
      isDirty.value = false
    } else {
      admissionError.value = res.error || '保存失败：yaml 校验未通过'
    }
  } catch (e: any) {
    admissionError.value = e.message || '保存失败'
  } finally {
    admissionSaving.value = false
  }
}

// ===== 并发配额配置 =====
const quotaEditorRef = ref<HTMLElement>()
let quotaEditor: EditorView | null = null
const quotaLoading = ref(false)
const quotaSaving = ref(false)
const quotaError = ref('')
// 记录加载时的原始内容，用于判断是否有改动
const originalQuotaYaml = ref('')
const quotaIsDirty = ref(false)

const initQuotaEditor = (initialValue = '') => {
  if (!quotaEditorRef.value || quotaEditor) return
  quotaEditor = new EditorView({
    doc: initialValue,
    extensions: [
      basicSetup,
      yamlLang(),
      // 监听文档变化，实时更新是否有改动
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          quotaIsDirty.value = update.state.doc.toString() !== originalQuotaYaml.value
        }
      })
    ],
    parent: quotaEditorRef.value
  })
}

const setQuotaEditorValue = (value: string) => {
  if (!quotaEditor) return
  quotaEditor.dispatch({
    changes: { from: 0, to: quotaEditor.state.doc.length, insert: value }
  })
}

const loadQuotaYaml = async () => {
  quotaLoading.value = true
  quotaError.value = ''
  try {
    const res = await window.electronAPI.backtest.getQuotaConfig()
    if (res.success) {
      const yaml = res.data?.yaml || ''
      setQuotaEditorValue(yaml)
      // 记录原始内容，重置改动状态
      originalQuotaYaml.value = yaml
      quotaIsDirty.value = false
    } else {
      quotaError.value = res.error || '加载失败'
    }
  } catch (e: any) {
    quotaError.value = e.message || '加载失败'
  } finally {
    quotaLoading.value = false
  }
}

const saveQuotaYaml = async () => {
  const yaml = quotaEditor?.state.doc.toString() || ''
  quotaSaving.value = true
  quotaError.value = ''
  try {
    const res = await window.electronAPI.backtest.saveQuotaConfig(yaml)
    if (res.success) {
      ElMessage.success('已保存，调度器将在 1 分钟内生效')
      // 保存成功后，当前内容成为新的原始内容
      originalQuotaYaml.value = yaml
      quotaIsDirty.value = false
    } else {
      quotaError.value = res.error || '保存失败：yaml 校验未通过'
    }
  } catch (e: any) {
    quotaError.value = e.message || '保存失败'
  } finally {
    quotaSaving.value = false
  }
}

// 切到该 tab 时初始化编辑器并加载 yaml
// 注意：面板用 v-if 渲染，切走会销毁 DOM，必须同步销毁对应编辑器实例并置 null，
// 否则切回来时旧实例仍绑在已销毁的 DOM 上，导致面板空白、按钮失效。
watch(activeTab, (t, prev) => {
  if (prev === 'admission-config') {
    yamlEditor?.destroy()
    yamlEditor = null
  } else if (prev === 'quota-config') {
    quotaEditor?.destroy()
    quotaEditor = null
  }
  if (t === 'admission-config') {
    nextTick(() => {
      initEditor()
      loadAdmissionYaml()
    })
  } else if (t === 'quota-config') {
    nextTick(() => {
      initQuotaEditor()
      loadQuotaYaml()
    })
  }
})

onBeforeUnmount(() => {
  yamlEditor?.destroy()
  yamlEditor = null
  quotaEditor?.destroy()
  quotaEditor = null
})
</script>

<style scoped lang="scss">
.engine-config-page {
  height: calc(100vh - 60px - 24px - 40px);
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;

  .content-card {
    background: #ffffff;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }

  .nav-card {
    margin: 0 10px 0 10px;
    padding: 0 20px;
    flex-shrink: 0;
  }

  .nav-tabs {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid #e4e7ed;

    .nav-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      color: #606266;
      border-bottom: 2px solid transparent;

      &:hover {
        color: #409eff;
      }

      &.active {
        color: #409eff;
        border-bottom-color: #409eff;
      }
    }
  }

  .content-body {
    flex: 1;
    min-height: 0;
    margin: 10px 10px 0 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    .el-scrollbar {
      flex: 1;
    }
  }

  .page-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .dict-sync-panel {
    margin: 10px 10px 0 10px;

    .dict-sync-desc {
      margin-bottom: 16px;
      color: #606266;
      font-size: 14px;
      line-height: 1.6;
    }

    .dict-sync-result {
      margin-top: 20px;
    }
  }

  .admission-config-panel {
    margin: 10px 10px 0 10px;
    .admission-desc {
      margin-bottom: 12px;
      color: #606266;
      font-size: 14px;
      line-height: 1.6;
    }

    .editor-toolbar {
      margin-bottom: 8px;
      display: flex;
      gap: 8px;
    }

    .yaml-editor {
      height: 520px;
      border: 1px solid #e4e7ed;
      border-radius: 4px;
      overflow: hidden;

      :deep(.cm-editor) {
        height: 100%;
      }
    }

    .admission-error {
      margin-top: 12px;
    }
  }
}
</style>
