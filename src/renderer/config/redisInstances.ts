/**
 * Redis 实例配置
 */

export interface RedisInstanceConfig {
  key: string
  port: number
  name: string
  displayName: string
  purpose: string
  market: 'shenzhen' | 'shanghai' | 'futures' | 'options' | 'hk' | 'management'
}

// 所有 Redis 实例配置
export const REDIS_INSTANCES: RedisInstanceConfig[] = [
  // 深圳市场 (6380-6395，排除6382、6383管理端口)
  { key: 'sz_6380', port: 6380, name: 'redis-6380', displayName: 'ZZ-01', purpose: '深圳股票快照', market: 'shenzhen' },
  { key: 'sz_6381', port: 6381, name: 'redis-6381', displayName: 'ZZ-02', purpose: '深圳指数行情', market: 'shenzhen' },
  { key: 'sz_6384', port: 6384, name: 'redis-6384', displayName: 'ZZ-03', purpose: '深圳成交量统计', market: 'shenzhen' },
  { key: 'sz_6385', port: 6385, name: 'redis-6385', displayName: 'ZZ-04', purpose: '深圳盘后定价', market: 'shenzhen' },
  { key: 'sz_6386', port: 6386, name: 'redis-6386', displayName: 'ZZ-05', purpose: '深圳逐笔委托', market: 'shenzhen' },
  { key: 'sz_6387', port: 6387, name: 'redis-6387', displayName: 'ZZ-06', purpose: '深圳逐笔成交', market: 'shenzhen' },
  { key: 'sz_6388', port: 6388, name: 'redis-6388', displayName: 'ZZ-07', purpose: '深圳债券快照', market: 'shenzhen' },
  { key: 'sz_6389', port: 6389, name: 'redis-6389', displayName: 'ZZ-08', purpose: '深圳债券逐笔委托', market: 'shenzhen' },
  { key: 'sz_6390', port: 6390, name: 'redis-6390', displayName: 'ZZ-09', purpose: '深圳债券逐笔成交', market: 'shenzhen' },
  { key: 'sz_6391', port: 6391, name: 'redis-6391', displayName: 'ZZ-10', purpose: '深圳债券报价委托', market: 'shenzhen' },
  { key: 'sz_6392', port: 6392, name: 'redis-6392', displayName: 'ZZ-11', purpose: '深圳债券报价成交', market: 'shenzhen' },
  { key: 'sz_6393', port: 6393, name: 'redis-6393', displayName: 'ZZ-12', purpose: '深圳债券委托队列', market: 'shenzhen' },
  { key: 'sz_6394', port: 6394, name: 'redis-6394', displayName: 'ZZ-13', purpose: '深圳ETF申赎', market: 'shenzhen' },
  { key: 'sz_6395', port: 6395, name: 'redis-6395', displayName: 'ZZ-14', purpose: '深圳静态文件', market: 'shenzhen' },
  
  // 上海市场 (6396-6404)
  { key: 'sh_6396', port: 6396, name: 'redis-6396', displayName: 'ZZ-31', purpose: '上海股票快照', market: 'shanghai' },
  { key: 'sh_6397', port: 6397, name: 'redis-6397', displayName: 'ZZ-32', purpose: '上海指数行情', market: 'shanghai' },
  { key: 'sh_6398', port: 6398, name: 'redis-6398', displayName: 'ZZ-33', purpose: '上海盘后固定价格', market: 'shanghai' },
  { key: 'sh_6399', port: 6399, name: 'redis-6399', displayName: 'ZZ-34', purpose: '上海盘后逐笔成交', market: 'shanghai' },
  { key: 'sh_6400', port: 6400, name: 'redis-6400', displayName: 'ZZ-35', purpose: '上海债券快照', market: 'shanghai' },
  { key: 'sh_6401', port: 6401, name: 'redis-6401', displayName: 'ZZ-36', purpose: '上海债券逐笔', market: 'shanghai' },
  { key: 'sh_6402', port: 6402, name: 'redis-6402', displayName: 'ZZ-37', purpose: '上海债券委托队列', market: 'shanghai' },
  { key: 'sh_6403', port: 6403, name: 'redis-6403', displayName: 'ZZ-38', purpose: '上海静态文件', market: 'shanghai' },
  { key: 'sh_6404', port: 6404, name: 'redis-6404', displayName: 'ZZ-39', purpose: '上海竞价逐笔', market: 'shanghai' },
  
  // 期货市场 (6405-6417)
  { key: 'fut_6405', port: 6405, name: 'redis-6405', displayName: 'ZZ-61', purpose: '中金所期货', market: 'futures' },
  { key: 'fut_6406', port: 6406, name: 'redis-6406', displayName: 'ZZ-62', purpose: '上期所期货', market: 'futures' },
  { key: 'fut_6407', port: 6407, name: 'redis-6407', displayName: 'ZZ-63', purpose: '能源所期货', market: 'futures' },
  { key: 'fut_6408', port: 6408, name: 'redis-6408', displayName: 'ZZ-64', purpose: '郑商所期货', market: 'futures' },
  { key: 'fut_6409', port: 6409, name: 'redis-6409', displayName: 'ZZ-65', purpose: '郑商所组合行情', market: 'futures' },
  { key: 'fut_6410', port: 6410, name: 'redis-6410', displayName: 'ZZ-66', purpose: '大商所期货', market: 'futures' },
  { key: 'fut_6411', port: 6411, name: 'redis-6411', displayName: 'ZZ-67', purpose: '大商所成交统计', market: 'futures' },
  { key: 'fut_6412', port: 6412, name: 'redis-6412', displayName: 'ZZ-68', purpose: '大商所组合行情', market: 'futures' },
  { key: 'fut_6413', port: 6413, name: 'redis-6413', displayName: 'ZZ-69', purpose: '大商所最优十笔', market: 'futures' },
  { key: 'fut_6414', port: 6414, name: 'redis-6414', displayName: 'ZZ-70', purpose: '广期所期货', market: 'futures' },
  { key: 'fut_6415', port: 6415, name: 'redis-6415', displayName: 'ZZ-71', purpose: '广期所成交统计', market: 'futures' },
  { key: 'fut_6416', port: 6416, name: 'redis-6416', displayName: 'ZZ-72', purpose: '广期所组合行情', market: 'futures' },
  { key: 'fut_6417', port: 6417, name: 'redis-6417', displayName: 'ZZ-73', purpose: '广期所最优十笔', market: 'futures' },
  
  // 期权市场 (6418-6430)
  { key: 'opt_6418', port: 6418, name: 'redis-6418', displayName: 'ZZ-81', purpose: '上交所期权', market: 'options' },
  { key: 'opt_6419', port: 6419, name: 'redis-6419', displayName: 'ZZ-82', purpose: '深交所期权', market: 'options' },
  { key: 'opt_6420', port: 6420, name: 'redis-6420', displayName: 'ZZ-83', purpose: '中金所期权', market: 'options' },
  { key: 'opt_6421', port: 6421, name: 'redis-6421', displayName: 'ZZ-84', purpose: '郑商所期权', market: 'options' },
  { key: 'opt_6422', port: 6422, name: 'redis-6422', displayName: 'ZZ-85', purpose: '上期所期权', market: 'options' },
  { key: 'opt_6423', port: 6423, name: 'redis-6423', displayName: 'ZZ-86', purpose: '能源所期权', market: 'options' },
  { key: 'opt_6424', port: 6424, name: 'redis-6424', displayName: 'ZZ-87', purpose: '大商所期权', market: 'options' },
  { key: 'opt_6425', port: 6425, name: 'redis-6425', displayName: 'ZZ-88', purpose: '广期所期权', market: 'options' },
  
  // 陆港通市场 (6431-6434)
  { key: 'hk_6431', port: 6431, name: 'redis-6431', displayName: 'ZZ-91', purpose: '港股通资金流向', market: 'hk' },
  { key: 'hk_6432', port: 6432, name: 'redis-6432', displayName: 'ZZ-92', purpose: '港股通北向额度', market: 'hk' },
  { key: 'hk_6433', port: 6433, name: 'redis-6433', displayName: 'ZZ-93', purpose: '港股通南向额度(上)', market: 'hk' },
  { key: 'hk_6434', port: 6434, name: 'redis-6434', displayName: 'ZZ-94', purpose: '港股通南向额度(深)', market: 'hk' },
  
  // 管理组 (6382, 6383)
  { key: 'mgmt_6382', port: 6382, name: 'redis-6382', displayName: '管理端口', purpose: 'API网关管理', market: 'management' },
  { key: 'mgmt_6383', port: 6383, name: 'redis-6383', displayName: '备用管理', purpose: 'Flink流处理', market: 'management' },
]

// 市场信息配置
export const MARKET_INFO = {
  shenzhen: { name: '深圳市场', icon: '🏢', color: '#409EFF' },
  shanghai: { name: '上海市场', icon: '🏛️', color: '#67C23A' },
  futures: { name: '期货市场', icon: '📈', color: '#E6A23C' },
  options: { name: '期权市场', icon: '🎯', color: '#F56C6C' },
  hk: { name: '陆港通市场', icon: '🌉', color: '#909399' },
  management: { name: '管理组', icon: '🔧', color: '#606266' }
}

// 根据市场获取实例列表
export function getInstancesByMarket(market: string): RedisInstanceConfig[] {
  return REDIS_INSTANCES.filter(i => i.market === market)
}

// 根据端口获取实例信息
export function getInstanceByPort(port: number): RedisInstanceConfig | undefined {
  return REDIS_INSTANCES.find(i => i.port === port)
}












