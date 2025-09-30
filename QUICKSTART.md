# 🚀 快速开始指南

## 📋 前置要求

- Node.js >= 16.0.0
- npm >= 7.0.0
- 确保能访问 API 网关 (http://61.151.241.233:8080)

## 🛠️ 安装步骤

### 1. 进入项目目录
```bash
cd /opt/demo/rest/market-data-downloader
```

### 2. 安装依赖
```bash
npm install
```

如果安装过程中遇到网络问题，可以使用国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

## 🎯 开发运行

### 方式一：一键启动（推荐）
```bash
npm run dev
```

### 方式二：分步启动
```bash
# 终端1: 启动Vue开发服务器
npm run dev:renderer

# 终端2: 启动Electron
npm run dev:electron
```

## 📦 打包发布

### Windows平台
```bash
npm run build:win
```
生成文件：`dist/MarketDataDownloader-Setup-1.0.0.exe`

### macOS平台
```bash
npm run build:mac
```
生成文件：`dist/MarketDataDownloader-1.0.0.dmg`

### Linux平台
```bash
npm run build:linux
```
生成文件：`dist/market-data-downloader-1.0.0.AppImage`

## 🔧 使用说明

### 1. 配置API Key
- 首次使用需要配置API Key
- 进入"系统设置"页面
- 点击"添加API Key"
- 输入你的API Key并设为默认

### 2. 下载数据
- 进入"数据下载"页面
- 选择消息类型（支持53种）
- 选择日期范围
- 选择导出格式（CSV或JSON）
- 点击"开始下载"

### 3. 查看任务
- "任务管理"页面查看当前任务
- 支持暂停/继续/取消操作
- 实时显示下载进度

### 4. 历史记录
- "历史记录"页面查看所有下载记录
- 可以打开已下载文件位置
- 支持清理历史记录

## 📊 支持的消息类型

### 深圳市场（14种）
- ZZ-01 到 ZZ-14

### 上海市场（9种）
- ZZ-31 到 ZZ-39

### 期货市场（13种）
- ZZ-61 到 ZZ-73

### 期权市场（13种）
- ZZ-91 到 ZZ-103

### 陆港通市场（4种）
- ZZ-104 到 ZZ-107

## ⚠️ 注意事项

1. **API Key安全**
   - API Key会加密存储在本地
   - 请勿分享或泄露你的API Key

2. **下载限制**
   - 默认最大并发数为3
   - 单次查询最多返回10000条记录

3. **存储空间**
   - 下载前请确保有足够的磁盘空间
   - 默认下载目录：`~/Downloads/MarketData`

## 🐛 常见问题

### Q1: 无法连接API网关
- 检查网络连接
- 确认API网关地址：`http://61.151.241.233:8080`
- 检查防火墙设置

### Q2: 下载失败
- 检查API Key是否有效
- 确认日期范围是否正确
- 查看错误日志获取详细信息

### Q3: 打包失败
- 确保所有依赖已正确安装
- Windows用户需要管理员权限
- macOS用户需要开发者证书

## 📞 技术支持

- 内部使用，如有问题请联系系统管理员
- 查看项目README获取更多信息

---
*最后更新：2025-09-27*
