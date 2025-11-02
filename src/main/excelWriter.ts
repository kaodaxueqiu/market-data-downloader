/**
 * Excel 流式写入器
 * 实时追加数据到 Excel，每个股票一个 Sheet
 */
import ExcelJS from 'exceljs'
import * as path from 'path'
import * as fs from 'fs'

export class RealtimeExcelWriter {
  private workbook: ExcelJS.stream.xlsx.WorkbookWriter
  private worksheets: Map<string, ExcelJS.Worksheet> = new Map()
  private savePath: string
  private headers: string[] = []
  private rowCounts: Map<string, number> = new Map()

  constructor(savePath: string, headers: string[]) {
    this.savePath = savePath
    this.headers = headers

    // 确保目录存在
    const dir = path.dirname(savePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // 创建流式写入的 workbook
    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      filename: savePath,
      useStyles: true,
      useSharedStrings: true
    })

    console.log('📝 Excel 写入器已创建:', savePath)
    
    // 🆕 立即创建一个默认的说明Sheet（确保文件格式正确）
    this.createInfoSheet()
  }

  // 🆕 创建说明Sheet
  private createInfoSheet() {
    const infoSheet = this.workbook.addWorksheet('订阅信息', {
      views: [{ state: 'frozen', ySplit: 1 }]
    })

    // 添加说明信息
    infoSheet.columns = [
      { key: '项目', width: 20 },
      { key: '内容', width: 50 }
    ]

    const headerRow = infoSheet.addRow(['项目', '内容'])
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    headerRow.commit()

    // 添加订阅信息
    infoSheet.addRow(['订阅时间', new Date().toLocaleString('zh-CN')]).commit()
    infoSheet.addRow(['文件路径', this.savePath]).commit()
    infoSheet.addRow(['字段列表', this.headers.join(', ')]).commit()
    infoSheet.addRow(['说明', '每个股票的数据保存在对应的Sheet中']).commit()
    infoSheet.addRow(['状态', '等待数据接收...']).commit()

    console.log('📄 已创建说明Sheet')
  }

  // 为股票创建 Sheet（如果不存在）
  private ensureSheet(symbol: string): ExcelJS.Worksheet {
    if (!this.worksheets.has(symbol)) {
      console.log(`📄 创建 Sheet: ${symbol}`)
      
      // 创建新的 worksheet
      const sheet = this.workbook.addWorksheet(symbol, {
        views: [{ state: 'frozen', ySplit: 1 }] // 冻结首行
      })

      // 设置表头
      const headerRow = sheet.addRow(this.headers)
      headerRow.font = { bold: true }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }

      // 设置列宽
      sheet.columns = this.headers.map(header => ({
        key: header,
        width: 15
      }))

      headerRow.commit()

      this.worksheets.set(symbol, sheet)
      this.rowCounts.set(symbol, 0)
    }

    return this.worksheets.get(symbol)!
  }

  // 追加一行数据
  appendRow(symbol: string, data: Record<string, any>) {
    const sheet = this.ensureSheet(symbol)

    // 按 headers 顺序提取数据
    const rowData: any = {}
    this.headers.forEach(header => {
      rowData[header] = data[header] ?? '-'
    })

    // 添加行并立即提交（写入磁盘）
    const row = sheet.addRow(rowData)
    row.commit()

    // 更新行数统计
    const count = this.rowCounts.get(symbol) || 0
    this.rowCounts.set(symbol, count + 1)
  }

  // 获取统计信息
  getStats(): { symbol: string; count: number }[] {
    return Array.from(this.rowCounts.entries()).map(([symbol, count]) => ({
      symbol,
      count
    }))
  }

  // 获取总行数
  getTotalRows(): number {
    return Array.from(this.rowCounts.values()).reduce((sum, count) => sum + count, 0)
  }

  // 关闭并保存文件
  async close(): Promise<void> {
    console.log('💾 正在保存 Excel 文件...')
    
    try {
      await this.workbook.commit()
      console.log('✅ Excel 文件保存成功:', this.savePath)
    } catch (error) {
      console.error('❌ Excel 保存失败:', error)
      throw error
    }
  }

  // 获取保存路径
  getSavePath(): string {
    return this.savePath
  }
}

