// 失败任务错误信息友好化
// 把引擎对研发友好的技术错误，翻译成因子研究员能看懂的建议
// ResultContent.vue（结果页）与 TasksContent.vue（任务详情弹窗）共用，避免两处各存一份导致漂移

const friendlyErrorMap: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /有效样本检查失败|没有任何可计算的有效 IC/i,
    message: '该因子在此股票池和时间区间下没有产生有效信号。可能原因：① 因子全为 NaN（检查字段名是否正确）② 时间区间太短（至少 60 个交易日）③ 股票池与数据源不匹配'
  },
  {
    pattern: /not found:\s*\w+|unknown field/i,
    message: '因子表达式中使用了未知字段。请检查数据源可用字段，例如 close_price 而非 close。'
  },
  {
    pattern: /expression.*invalid|parse error|syntax error/i,
    message: '因子表达式语法错误。请检查括号是否配对、算子名是否正确（如 Delay/Mean/Ts_Rank）。'
  },
  {
    pattern: /timeout|timed out/i,
    message: '计算超时。可能是股票池过大或表达式过于复杂，建议缩小回测区间或简化因子。'
  },
  {
    pattern: /代码引用 data\["(.+?)"\]，但字段目录未登记该表/,
    message: '表 $1 未在字段目录登记，请在数据源配置里手动填写表名和字段'
  },
  {
    pattern: /代码包含动态字段引用/,
    message: '代码里有动态字段引用，引擎无法静态识别，请显式配置 fields'
  }
]

export const getFriendlyError = (rawError: string | undefined): { friendly: string; hasMatch: boolean } => {
  if (!rawError) return { friendly: '未知错误，请联系管理员', hasMatch: false }

  // 优先解析结构化 JSON：unresolved_fields / ambiguous_fields
  try {
    // 尝试从 error 字符串中提取 JSON 片段
    const jsonMatch = rawError.match(/\{[\s\S]*"unresolved_fields"[\s\S]*\}|\{[\s\S]*"ambiguous_fields"[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.unresolved_fields?.length) {
        return {
          friendly: `字段 ${parsed.unresolved_fields.join(', ')} 在字段目录里找不到，请检查字段名`,
          hasMatch: true
        }
      }
      if (parsed.ambiguous_fields?.length) {
        const parts = parsed.ambiguous_fields.map((af: any) => {
          const candidates = af.candidates?.map((c: any) => c.table || c.table_name || c).join(', ') || ''
          return `字段 ${af.field} 在多张表里都有（${candidates}），请在 fields 里显式指定`
        })
        return { friendly: parts.join('；'), hasMatch: true }
      }
    }
  } catch { /* JSON 解析失败，走正则匹配 */ }

  // 内存超出预算：引擎原文较长（均值 329 字符，最长 2097），且埋在文末，
  // 这里提取实际峰值与预算，反推一个可直接填写的建议值
  if (/内存超出预算/.test(rawError)) {
    const m = rawError.match(/当前\s*RSS\s*约\s*([\d.]+)\s*MB\s*>\s*预算\s*([\d.]+)\s*MB/)
    if (m) {
      const actual = Math.ceil(parseFloat(m[1]))
      const budget = Math.ceil(parseFloat(m[2]))
      // 建议值：实际峰值 ×1.5，向上取到 512 的整数倍
      const suggested = Math.ceil((actual * 1.5) / 512) * 512
      return {
        friendly: `该任务实际内存峰值约 ${actual} MB，超过当前预算 ${budget} MB。建议把「高级选项 → 内存预算」调到 ${suggested} MB 后重试，或缩短回测区间、减少股票数。`,
        hasMatch: true
      }
    }
    return {
      friendly: '该任务内存占用超过配置的预算上限。建议缩短回测区间、减少股票数，或在「高级选项 → 内存预算」中调大预算后重试。',
      hasMatch: true
    }
  }

  // 正则匹配，支持 $1 捕获组替换
  for (const item of friendlyErrorMap) {
    const m = rawError.match(item.pattern)
    if (m) {
      const msg = item.message.replace('$1', m[1] || '')
      return { friendly: msg, hasMatch: true }
    }
  }
  return { friendly: rawError, hasMatch: false }
}
