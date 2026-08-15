import { h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 触发浏览器下载文本内容
function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 弹窗展示翻译结果源码，并提供下载
function showResult(opts: {
  title: string
  source: string
  filename: string
  fallback?: boolean
  fallbackReason?: string | null
}) {
  const { title, source, filename, fallback, fallbackReason } = opts
  ElMessageBox({
    title,
    customClass: 'translate-preview-box',
    showCancelButton: true,
    confirmButtonText: '下载',
    cancelButtonText: '关闭',
    message: h('div', {}, [
      fallback
        ? h(
            'div',
            { style: 'color:#e6a23c;margin-bottom:8px;font-size:13px;' },
            `翻译未完成：${fallbackReason || '未知原因'}（以下为半成品，供参考）`
          )
        : null,
      h(
        'pre',
        {
          style:
            'max-height:50vh;overflow:auto;background:#f5f7fa;padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-all;margin:0;'
        },
        source
      )
    ])
  })
    .then(() => downloadText(filename, source))
    .catch(() => {})
}

// 预览 polars 翻译
export async function previewPolars(code: string): Promise<void> {
  if (!code || !code.trim()) {
    ElMessage.warning('请先输入 Python 代码')
    return
  }
  const res = await window.electronAPI.translate.polars({ code })
  if (!res.success || !res.data) {
    ElMessage.error(res.error || 'Polars 翻译失败')
    return
  }
  showResult({
    title: 'Polars 原生代码',
    source: res.data.source,
    filename: 'translated_factor_polars.py',
    fallback: res.data.fallback,
    fallbackReason: res.data.fallback_reason
  })
}

// 预览 clickhouse DDL 翻译
export async function previewClickhouse(params: {
  code: string
  user_name?: string
  ttl?: string
}): Promise<void> {
  if (!params.code || !params.code.trim()) {
    ElMessage.warning('请先输入 Python 代码')
    return
  }
  // workspace_db 由网关强制注入 factor_workspace_<user>，前端不传
  const res = await window.electronAPI.translate.clickhouse({
    code: params.code,
    user_name: params.user_name,
    ttl: params.ttl
  })
  if (!res.success || !res.data) {
    ElMessage.error(res.error || 'ClickHouse DDL 翻译失败')
    return
  }
  showResult({
    title: 'ClickHouse 建表 DDL',
    source: res.data.ddl,
    filename: 'translated_intermediate.sql',
    fallback: res.data.fallback,
    fallbackReason: res.data.fallback_reason
  })
}
