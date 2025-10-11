/**
 * 数据源到市场前缀的映射配置
 * 用于自动补全股票/期货代码
 */

export interface SourceMarketConfig {
  code: string
  marketPrefix: string
  description: string
  codePattern?: string  // 代码格式说明
  example?: string      // 示例
}

// 数据源到市场前缀的映射
export const SOURCE_MARKET_MAP: Record<string, string> = {
  // 深圳市场（14个）→ SZ
  'ZZ-01': 'SZ',
  'ZZ-02': 'SZ',
  'ZZ-03': 'SZ',
  'ZZ-04': 'SZ',
  'ZZ-05': 'SZ',
  'ZZ-06': 'SZ',
  'ZZ-07': 'SZ',
  'ZZ-08': 'SZ',
  'ZZ-09': 'SZ',
  'ZZ-10': 'SZ',
  'ZZ-11': 'SZ',
  'ZZ-12': 'SZ',
  'ZZ-13': 'SZ',
  'ZZ-14': 'SZ',
  
  // 上海市场（9个）→ SH
  'ZZ-31': 'SH',
  'ZZ-32': 'SH',
  'ZZ-33': 'SH',
  'ZZ-34': 'SH',
  'ZZ-35': 'SH',
  'ZZ-36': 'SH',
  'ZZ-37': 'SH',
  'ZZ-38': 'SH',
  'ZZ-39': 'SH',
  
  // 期货市场（13个）
  'ZZ-61': 'CFFEX',   // 中金所
  'ZZ-62': 'SHFE',    // 上期所
  'ZZ-63': 'INE',     // 能源所
  'ZZ-64': 'CZCE',    // 郑商所
  'ZZ-65': 'CZCE',    // 郑商所组合
  'ZZ-66': 'DCE',     // 大商所
  'ZZ-67': 'DCE',     // 大商所成交统计
  'ZZ-68': 'DCE',     // 大商所组合
  'ZZ-69': 'DCE',     // 大商所最优十笔
  'ZZ-70': 'GFEX',    // 广期所
  'ZZ-71': 'GFEX',    // 广期所成交统计
  'ZZ-72': 'GFEX',    // 广期所组合
  'ZZ-73': 'GFEX',    // 广期所最优十笔
  
  // 期权市场（13个）
  'ZZ-91': 'SH',      // 上交所期权（股票期权用SH）
  'ZZ-92': 'SH',      // 上交所期权静态
  'ZZ-93': 'SZ',      // 深交所期权（股票期权用SZ）
  'ZZ-94': 'CFFEX',   // 中金所期权
  'ZZ-95': 'CZCE',    // 郑商所期权
  'ZZ-96': 'SHFE',    // 上期所期权
  'ZZ-97': 'INE',     // INE能源所期权
  'ZZ-98': 'DCE',     // 大商所期权
  'ZZ-99': 'DCE',     // 大商所期权成交量统计
  'ZZ-100': 'DCE',    // 大商所期权最优价
  'ZZ-101': 'GFEX',   // 广期所期权
  'ZZ-102': 'GFEX',   // 广期所期权成交量统计
  'ZZ-103': 'GFEX',   // 广期所期权最优价
  
  // 陆港通市场（4个）- 不需要代码输入，symbol为unknown
  'ZZ-104': 'UNKNOWN',       // 港股通市场资金流向
  'ZZ-105': 'UNKNOWN',       // 港股通北向实时额度
  'ZZ-106': 'UNKNOWN',       // 港股通南向-上交所
  'ZZ-107': 'UNKNOWN'        // 港股通南向-深交所
}

// 获取数据源的市场前缀
export function getMarketPrefix(sourceCode: string): string {
  return SOURCE_MARKET_MAP[sourceCode] || ''
}

// 判断数据源是否需要代码输入
export function needsSymbolInput(sourceCode: string): boolean {
  const prefix = SOURCE_MARKET_MAP[sourceCode]
  return prefix !== '' && prefix !== undefined && prefix !== 'UNKNOWN'
}

// 获取代码输入提示
export function getSymbolInputHint(sourceCode: string): string {
  const prefix = getMarketPrefix(sourceCode)
  
  if (!prefix) {
    return '此数据源不需要输入代码'
  }
  
  if (prefix === 'SZ' || prefix === 'SH') {
    return `输入股票代码即可，如：000001, 600000（自动补全为 ${prefix}.XXXXXX）`
  }
  
  const exchangeNames: Record<string, string> = {
    'CFFEX': '中金所',
    'SHFE': '上期所',
    'INE': '能源所',
    'CZCE': '郑商所',
    'DCE': '大商所',
    'GFEX': '广期所'
  }
  
  const exchangeName = exchangeNames[prefix] || prefix
  return `输入${exchangeName}合约代码，如：CU2401, M2405（自动补全为 ${prefix}.XXXX）`
}

// 自动补全代码（支持多个）
export function autoCompleteSymbols(input: string, sourceCode: string): string[] {
  const prefix = getMarketPrefix(sourceCode)
  
  if (!prefix || !input.trim()) {
    return []
  }
  
  // 分割输入（支持逗号、空格、分号、换行）
  const codes = input
    .toUpperCase()
    .split(/[,，\s;；\n]+/)
    .map(c => c.trim())
    .filter(c => c.length > 0)
  
  const result: string[] = []
  
  codes.forEach(code => {
    // 如果已经包含点，保持原样（用户可能手动输入了完整格式）
    if (code.includes('.')) {
      result.push(code)
      return
    }
    
    // 自动补全市场前缀
    if (prefix === 'SZ' || prefix === 'SH') {
      // 股票代码：纯数字，补齐到6位
      if (/^\d+$/.test(code)) {
        const paddedCode = code.padStart(6, '0')
        result.push(`${prefix}.${paddedCode}`)
      } else {
        result.push(code) // 格式错误，保留原样让验证报错
      }
    } else {
      // 期货/期权代码：直接补全
      result.push(`${prefix}.${code}`)
    }
  })
  
  // 去重
  return [...new Set(result)]
}

