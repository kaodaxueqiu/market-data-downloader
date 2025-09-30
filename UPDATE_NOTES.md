# 更新说明

## 📝 主要更新内容

### 1. API地址更新
- ✅ 将API网关地址从内网 `192.168.20.10` 改为外网 `61.151.241.233`
- ✅ 所有配置文件已更新为新地址

### 2. 导出格式调整
- ✅ 移除了不支持的Excel和Parquet格式
- ✅ 保留CSV和JSON两种格式
  - **CSV**: 可直接用Excel打开，适合数据分析
  - **JSON**: 结构化数据，适合程序处理

### 3. 代码优化
- ✅ 移除了exceljs依赖库
- ✅ 简化了文件导出逻辑
- ✅ 更新了所有相关文档

## 📂 更新的文件列表

### 配置文件
- `src/renderer/api/constants.ts` - API地址配置
- `src/main/download.ts` - 下载管理器API地址

### 界面文件
- `src/renderer/views/Download.vue` - 移除Excel/Parquet选项
- `src/renderer/views/Home.vue` - 格式显示优化

### 依赖管理
- `package.json` - 移除exceljs依赖

### 文档更新
- `README.md` - 更新功能说明和API地址
- `QUICKSTART.md` - 更新快速开始指南

## ⚠️ 注意事项

1. **API连接**
   - 确保客户端能访问外网地址 `61.151.241.233:8080`
   - 如有防火墙，需要开放相应端口

2. **数据格式**
   - CSV格式完全兼容Excel，可直接打开
   - 大批量数据建议使用JSON格式，性能更好

3. **兼容性**
   - 新版本与旧版本配置不兼容
   - 首次使用需要重新配置API Key

---
*更新时间：2025-09-27*
