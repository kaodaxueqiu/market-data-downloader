// 消息类型定义
export const MESSAGE_TYPES = {
  // 深圳市场（14个）
  SZ: {
    'ZZ-01': '深圳股票快照',
    'ZZ-02': '深圳指数行情',
    'ZZ-03': '深圳成交量统计',
    'ZZ-04': '深圳盘后定价交易',
    'ZZ-05': '深圳逐笔委托',
    'ZZ-06': '深圳逐笔成交',
    'ZZ-07': '深圳债券快照',
    'ZZ-08': '深圳债券逐笔委托',
    'ZZ-09': '深圳债券逐笔成交',
    'ZZ-10': '深圳债券报价委托',
    'ZZ-11': '深圳债券报价成交',
    'ZZ-12': '深圳债券委托队列',
    'ZZ-13': '深圳ETF实时申赎',
    'ZZ-14': '深交所静态文件'
  },
  
  // 上海市场（9个）
  SH: {
    'ZZ-31': '上海股票快照',
    'ZZ-32': '上海指数行情',
    'ZZ-33': '上海盘后固定价格',
    'ZZ-34': '上海盘后逐笔成交',
    'ZZ-35': '上海债券快照',
    'ZZ-36': '上海债券逐笔',
    'ZZ-37': '上海债券委托队列',
    'ZZ-38': '上交所静态文件',
    'ZZ-39': '上海竞价逐笔合并'
  },
  
  // 期货市场（13个）
  FUTURES: {
    'ZZ-61': '中金所期货',
    'ZZ-62': '上期所期货',
    'ZZ-63': '能源所期货',
    'ZZ-64': '郑商所期货',
    'ZZ-65': '郑商所组合行情',
    'ZZ-66': '大商所期货',
    'ZZ-67': '大商所成交统计',
    'ZZ-68': '大商所组合行情',
    'ZZ-69': '大商所最优十笔',
    'ZZ-70': '广期所期货',
    'ZZ-71': '广期所成交统计',
    'ZZ-72': '广期所组合行情',
    'ZZ-73': '广期所最优十笔'
  },
  
  // 期权市场（13个）
  OPTIONS: {
    'ZZ-91': '上交所期权快照',
    'ZZ-92': '上交所期权静态文件',
    'ZZ-93': '深交所期权快照',
    'ZZ-94': '中金所期权快照',
    'ZZ-95': '郑商所期权快照',
    'ZZ-96': '上期所期权快照',
    'ZZ-97': 'INE能源所期权快照',
    'ZZ-98': '大商所期权快照',
    'ZZ-99': '大商所期权成交量统计',
    'ZZ-100': '大商所期权最优价十笔委托',
    'ZZ-101': '广期所期权快照',
    'ZZ-102': '广期所期权成交量统计',
    'ZZ-103': '广期所期权最优价十笔委托'
  },
  
  // 陆港通市场（4个）
  HK: {
    'ZZ-104': '港股通市场资金流向',
    'ZZ-105': '港股通北向实时额度',
    'ZZ-106': '港股通南向实时额度-上交所',
    'ZZ-107': '港股通南向实时额度-深交所'
  }
}

// 将消息类型转换为数组格式（用于下拉选择）
export const MESSAGE_TYPE_LIST = [
  // 深圳市场
  { value: 'ZZ-01', label: '[ZZ-01] 深圳股票快照', market: 'SZ' },
  { value: 'ZZ-02', label: '[ZZ-02] 深圳指数行情', market: 'SZ' },
  { value: 'ZZ-03', label: '[ZZ-03] 深圳成交量统计', market: 'SZ' },
  { value: 'ZZ-04', label: '[ZZ-04] 深圳盘后定价交易', market: 'SZ' },
  { value: 'ZZ-05', label: '[ZZ-05] 深圳逐笔委托', market: 'SZ' },
  { value: 'ZZ-06', label: '[ZZ-06] 深圳逐笔成交', market: 'SZ' },
  { value: 'ZZ-07', label: '[ZZ-07] 深圳债券快照', market: 'SZ' },
  { value: 'ZZ-08', label: '[ZZ-08] 深圳债券逐笔委托', market: 'SZ' },
  { value: 'ZZ-09', label: '[ZZ-09] 深圳债券逐笔成交', market: 'SZ' },
  { value: 'ZZ-10', label: '[ZZ-10] 深圳债券报价委托', market: 'SZ' },
  { value: 'ZZ-11', label: '[ZZ-11] 深圳债券报价成交', market: 'SZ' },
  { value: 'ZZ-12', label: '[ZZ-12] 深圳债券委托队列', market: 'SZ' },
  { value: 'ZZ-13', label: '[ZZ-13] 深圳ETF实时申赎', market: 'SZ' },
  { value: 'ZZ-14', label: '[ZZ-14] 深交所静态文件', market: 'SZ' },
  
  // 上海市场
  { value: 'ZZ-31', label: '[ZZ-31] 上海股票快照', market: 'SH' },
  { value: 'ZZ-32', label: '[ZZ-32] 上海指数行情', market: 'SH' },
  { value: 'ZZ-33', label: '[ZZ-33] 上海盘后固定价格', market: 'SH' },
  { value: 'ZZ-34', label: '[ZZ-34] 上海盘后逐笔成交', market: 'SH' },
  { value: 'ZZ-35', label: '[ZZ-35] 上海债券快照', market: 'SH' },
  { value: 'ZZ-36', label: '[ZZ-36] 上海债券逐笔', market: 'SH' },
  { value: 'ZZ-37', label: '[ZZ-37] 上海债券委托队列', market: 'SH' },
  { value: 'ZZ-38', label: '[ZZ-38] 上交所静态文件', market: 'SH' },
  { value: 'ZZ-39', label: '[ZZ-39] 上海竞价逐笔合并', market: 'SH' },
  
  // 期货市场
  { value: 'ZZ-61', label: '[ZZ-61] 中金所期货', market: 'FUTURES' },
  { value: 'ZZ-62', label: '[ZZ-62] 上期所期货', market: 'FUTURES' },
  { value: 'ZZ-63', label: '[ZZ-63] 能源所期货', market: 'FUTURES' },
  { value: 'ZZ-64', label: '[ZZ-64] 郑商所期货', market: 'FUTURES' },
  { value: 'ZZ-65', label: '[ZZ-65] 郑商所组合行情', market: 'FUTURES' },
  { value: 'ZZ-66', label: '[ZZ-66] 大商所期货', market: 'FUTURES' },
  { value: 'ZZ-67', label: '[ZZ-67] 大商所成交统计', market: 'FUTURES' },
  { value: 'ZZ-68', label: '[ZZ-68] 大商所组合行情', market: 'FUTURES' },
  { value: 'ZZ-69', label: '[ZZ-69] 大商所最优十笔', market: 'FUTURES' },
  { value: 'ZZ-70', label: '[ZZ-70] 广期所期货', market: 'FUTURES' },
  { value: 'ZZ-71', label: '[ZZ-71] 广期所成交统计', market: 'FUTURES' },
  { value: 'ZZ-72', label: '[ZZ-72] 广期所组合行情', market: 'FUTURES' },
  { value: 'ZZ-73', label: '[ZZ-73] 广期所最优十笔', market: 'FUTURES' },
  
  // 期权市场
  { value: 'ZZ-91', label: '[ZZ-91] 上交所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-92', label: '[ZZ-92] 上交所期权静态文件', market: 'OPTIONS' },
  { value: 'ZZ-93', label: '[ZZ-93] 深交所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-94', label: '[ZZ-94] 中金所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-95', label: '[ZZ-95] 郑商所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-96', label: '[ZZ-96] 上期所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-97', label: '[ZZ-97] INE能源所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-98', label: '[ZZ-98] 大商所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-99', label: '[ZZ-99] 大商所期权成交量统计', market: 'OPTIONS' },
  { value: 'ZZ-100', label: '[ZZ-100] 大商所期权最优价十笔委托', market: 'OPTIONS' },
  { value: 'ZZ-101', label: '[ZZ-101] 广期所期权快照', market: 'OPTIONS' },
  { value: 'ZZ-102', label: '[ZZ-102] 广期所期权成交量统计', market: 'OPTIONS' },
  { value: 'ZZ-103', label: '[ZZ-103] 广期所期权最优价十笔委托', market: 'OPTIONS' },
  
  // 陆港通市场
  { value: 'ZZ-104', label: '[ZZ-104] 港股通市场资金流向', market: 'HK' },
  { value: 'ZZ-105', label: '[ZZ-105] 港股通北向实时额度', market: 'HK' },
  { value: 'ZZ-106', label: '[ZZ-106] 港股通南向实时额度-上交所', market: 'HK' },
  { value: 'ZZ-107', label: '[ZZ-107] 港股通南向实时额度-深交所', market: 'HK' }
]

// API网关配置
export const API_CONFIG = {
  BASE_URL: 'http://61.151.241.233:8080/api/v1',
  WS_URL: 'ws://61.151.241.233:8081/ws',
  TIMEOUT: 30000
}
