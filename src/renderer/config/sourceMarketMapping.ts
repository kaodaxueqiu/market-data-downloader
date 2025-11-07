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
  'ZZ-107': 'UNKNOWN',       // 港股通南向-深交所
  
  // 指数数据（1个）
  'ZZ-111': 'INDEX',         // 指数行业快照
  
  // 数字货币市场（3个）- 需要输入交易对
  'ZZ-130': 'CRYPTO',        // Binance 24小时行情
  'ZZ-131': 'CRYPTO',        // Binance 订单簿深度
  'ZZ-132': 'CRYPTO',        // Binance 实时成交
  
  // K线数据（2个）- 需要完整格式代码（不自动补全前缀）
  'ZZ-5001': 'KLINE_STOCK',   // 沪深A股1分钟K线（需要 SZ.XXXXXX 或 SH.XXXXXX）
  'ZZ-6001': 'KLINE_FUTURES'  // 期货1分钟K线（需要 交易所.合约代码，如 SHFE.FU2609）
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
  
  // 指数数据源
  if (prefix === 'INDEX') {
    return `输入指数编号，如：500, 1000, 300（自动补全为 zz-500, zz-1000）`
  }
  
  // 数字货币数据源
  if (prefix === 'CRYPTO') {
    return `输入交易对即可，如：BTCUSDT, ETHUSDT, NEIROUSDC（保持原样，区分大小写）`
  }
  
  // K线数据源特殊处理
  if (prefix === 'KLINE_STOCK') {
    return `输入股票代码即可，如：000001, 600000（自动补全为 SH.XXXXXX）`
  }
  
  if (prefix === 'KLINE_FUTURES') {
    return `输入期货合约代码，如：FU2609, MA608（自动补全交易所前缀）`
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
    // 指数代码：补全为 zz-{编号} 格式（小写）
    if (prefix === 'INDEX') {
      const lowerCode = code.toLowerCase();
      
      // 如果已经有zz-前缀，保持原样
      if (lowerCode.startsWith('zz-')) {
        result.push(lowerCode);
      }
      // 如果只是数字（如1000、500），补全为zz-1000、zz-500
      else {
        result.push(`zz-${lowerCode}`);
      }
      return
    }
    
    // 数字货币：保持原样，不补全前缀（交易对如BTCUSDT）
    if (prefix === 'CRYPTO') {
      result.push(code)  // 已经在上面转为大写了
      return
    }
    
    // 如果已经包含点，保持原样（用户可能手动输入了完整格式）
    if (code.includes('.')) {
      result.push(code)
      return
    }
    
    // K线股票数据：根据代码开头判断市场
    if (prefix === 'KLINE_STOCK') {
      if (/^\d+$/.test(code)) {
        const paddedCode = code.padStart(6, '0')
        // 根据代码前缀判断市场
        if (paddedCode.startsWith('60') || paddedCode.startsWith('688') || paddedCode.startsWith('689')) {
          result.push(`SH.${paddedCode}`)
        } else if (paddedCode.startsWith('00') || paddedCode.startsWith('30')) {
          result.push(`SZ.${paddedCode}`)
        } else {
          // 无法判断，默认上海
          result.push(`SH.${paddedCode}`)
        }
      } else {
        result.push(code) // 格式错误，保留原样
      }
      return
    }
    
    // K线期货数据：要求用户输入完整格式（交易所.合约）
    if (prefix === 'KLINE_FUTURES') {
      // 如果用户输入不带点的期货代码，需要猜测交易所
      // 这里简化处理：常见品种映射
      const futuresExchange = guessFuturesExchange(code)
      if (futuresExchange) {
        result.push(`${futuresExchange}.${code}`)
      } else {
        result.push(code) // 无法判断，保留原样让用户手动输入完整格式
      }
      return
    }
    
    // 普通股票代码
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

// 根据期货合约代码猜测交易所
function guessFuturesExchange(code: string): string | null {
  // 品种代码映射表（常见品种）
  const exchangeMap: Record<string, string> = {
    // 上期所 SHFE
    'CU': 'SHFE', 'AL': 'SHFE', 'ZN': 'SHFE', 'PB': 'SHFE', 'NI': 'SHFE', 'SN': 'SHFE', 'AU': 'SHFE', 'AG': 'SHFE',
    'RB': 'SHFE', 'WR': 'SHFE', 'HC': 'SHFE', 'SS': 'SHFE', 'BU': 'SHFE', 'RU': 'SHFE', 'NR': 'SHFE', 'SP': 'SHFE', 'FU': 'SHFE',
    // 大商所 DCE
    'C': 'DCE', 'CS': 'DCE', 'A': 'DCE', 'B': 'DCE', 'M': 'DCE', 'Y': 'DCE', 'P': 'DCE', 'L': 'DCE', 'V': 'DCE',
    'PP': 'DCE', 'J': 'DCE', 'JM': 'DCE', 'I': 'DCE', 'EG': 'DCE', 'EB': 'DCE', 'PG': 'DCE', 'LH': 'DCE', 'RR': 'DCE',
    // 郑商所 CZCE
    'SR': 'CZCE', 'CF': 'CZCE', 'TA': 'CZCE', 'MA': 'CZCE', 'FG': 'CZCE', 'RM': 'CZCE', 'OI': 'CZCE', 'ZC': 'CZCE',
    'SF': 'CZCE', 'SM': 'CZCE', 'UR': 'CZCE', 'SA': 'CZCE', 'CY': 'CZCE', 'AP': 'CZCE', 'CJ': 'CZCE', 'PF': 'CZCE',
    // 中金所 CFFEX
    'IF': 'CFFEX', 'IC': 'CFFEX', 'IH': 'CFFEX', 'IM': 'CFFEX', 'T': 'CFFEX', 'TF': 'CFFEX', 'TS': 'CFFEX',
    // 能源所 INE
    'SC': 'INE', 'LU': 'INE', 'BC': 'INE',
    // 广期所 GFEX
    'SI': 'GFEX', 'LC': 'GFEX', 'PX': 'GFEX'
  }
  
  // 提取品种代码（字母部分）
  const match = code.match(/^([A-Z]+)/)
  if (match) {
    const variety = match[1]
    return exchangeMap[variety] || null
  }
  
  return null
}

