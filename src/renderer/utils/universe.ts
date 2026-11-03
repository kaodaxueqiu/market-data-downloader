const UNIVERSE_MAP: Record<string, string> = {
  all: '全市场',
  hs300: '沪深300',
  zz500: '中证500',
  zz1000: '中证1000',
  sz50: '上证50',
  zz2000: '中证2000',
  csi1000: '中证1000'
}

export function formatUniverse(universe: unknown, poolNames?: Map<string, string>): string {
  if (!universe) return '-'
  if (typeof universe === 'string') return UNIVERSE_MAP[universe] || universe
  if (typeof universe !== 'object') return '-'

  const value = universe as { type?: string; preset_name?: unknown }
  if (value.type === 'custom') return '自定义股票池'
  if (typeof value.preset_name === 'string' && value.preset_name) {
    const code = value.preset_name
    return poolNames?.get(code) || UNIVERSE_MAP[code] || code
  }
  return value.type === 'preset' ? '-' : '自定义股票池'
}
