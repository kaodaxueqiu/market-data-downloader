/**
 * 行情接收服务（Prometheus market_receiver_*）市场列表
 * zzRange 与 api/constants.ts MESSAGE_TYPES 一致
 */
export const RECEIVER_MARKETS = [
  { key: 'sz', name: '深圳市场', icon: '🏢', jobName: 'market_receiver_sz', zzRange: 'ZZ-01～ZZ-14' },
  { key: 'sh', name: '上海市场', icon: '🏛️', jobName: 'market_receiver_sh', zzRange: 'ZZ-31～ZZ-39' },
  { key: 'futures', name: '期货市场', icon: '📊', jobName: 'market_receiver_futures', zzRange: 'ZZ-61～ZZ-73' },
  { key: 'options', name: '期权市场', icon: '🎯', jobName: 'market_receiver_options', zzRange: 'ZZ-91～ZZ-103' },
  { key: 'hk', name: '陆港通市场', icon: '🌉', jobName: 'market_receiver_hk', zzRange: 'ZZ-104～ZZ-107' }
] as const

export type ReceiverMarketKey = (typeof RECEIVER_MARKETS)[number]['key']
