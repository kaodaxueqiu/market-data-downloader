export interface PoolOption { value: string; label: string }

export const DEFAULT_POOL = 'zz1000'
export const DEFAULT_POOL_OPTIONS: PoolOption[] = [{ value: 'zz1000', label: '中证1000' }]

/** 读网关 GET admission-config 返回的 pools；失败或为空时回退默认池 */
export async function fetchAdmissionPools(): Promise<{ schemaVersion: number; pools: PoolOption[] }> {
  try {
    const res = await window.electronAPI.backtest.getAdmissionConfig()
    const data = res.success ? res.data : null
    const pools: PoolOption[] = (data?.pools ?? []).map((p: { pool_id: string; label?: string }) => ({
      value: p.pool_id,
      label: p.label || p.pool_id
    }))
    return { schemaVersion: data?.schema_version ?? 0, pools: pools.length ? pools : DEFAULT_POOL_OPTIONS }
  } catch {
    return { schemaVersion: 0, pools: DEFAULT_POOL_OPTIONS }
  }
}
