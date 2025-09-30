# 📊 Market Data Downloader - 专业市场数据下载工具

## 🚀 项目介绍
一款美观、专业、易用的市场数据下载客户端，直接连接交易系统API网关，为量化交易团队提供高效的数据获取方案。

## ✨ 核心特性
- 🎨 **精美界面** - 基于Vue3 + Element Plus的现代化UI设计
- 📈 **全市场覆盖** - 支持53种消息类型（股票、期货、期权、港股通）
- ⚡ **高性能下载** - 直连API网关，支持批量下载
- 📁 **双格式导出** - CSV（可用Excel打开）、JSON（程序处理）
- 🔐 **安全可靠** - API Key本地加密存储
- 💻 **跨平台支持** - Windows、macOS、Linux完美运行
- 📦 **绿色免安装** - 打包成独立可执行文件

## 🏗️ 技术架构

```
┌──────────────────────────────────────┐
│      Electron Desktop Client          │
│         (渲染进程 - Vue3)              │
│    ・美观的用户界面                     │
│    ・数据查询和下载                     │
│    ・任务管理和进度显示                  │
├──────────────────────────────────────┤
│         Electron (主进程)              │
│    ・文件系统操作                       │
│    ・配置管理                          │
│    ・下载管理                          │
├──────────────────────────────────────┤
│      REST API Gateway (现有)          │
│     http://61.151.241.233:8080        │
│    ・数据查询接口                       │
│    ・认证管理                          │
└──────────────────────────────────────┘
```

## 📂 项目结构
```
market-data-downloader/
├── src/
│   ├── main/              # Electron主进程
│   │   ├── index.js       # 主进程入口
│   │   ├── download.js    # 下载管理
│   │   └── config.js      # 配置管理
│   ├── renderer/          # Vue3渲染进程
│   │   ├── App.vue        # 根组件
│   │   ├── main.js        # 渲染进程入口
│   │   ├── views/         # 页面组件
│   │   │   ├── Home.vue   # 首页
│   │   │   ├── Download.vue # 下载页面
│   │   │   ├── History.vue  # 历史记录
│   │   │   └── Settings.vue # 设置页面
│   │   ├── components/    # 通用组件
│   │   │   ├── QueryForm.vue    # 查询表单
│   │   │   ├── ProgressBar.vue  # 进度条
│   │   │   └── DataPreview.vue  # 数据预览
│   │   ├── api/           # API调用
│   │   │   └── gateway.js # API网关接口
│   │   └── store/         # Pinia状态管理
│   │       ├── index.js   # Store入口
│   │       └── modules/    # 模块
│   └── preload/           # 预加载脚本
│       └── index.js       # 安全桥接
│
├── public/                # 静态资源
│   ├── icon.png          # 应用图标
│   └── index.html        # HTML模板
│
├── package.json          # 项目配置
├── electron-builder.yml  # 打包配置
├── vite.config.js        # Vite配置
└── README.md             # 说明文档
```

## 🛠️ 开发环境

### 系统要求
- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装步骤

1. **进入项目目录**
```bash
cd /opt/demo/rest/market-data-downloader
```

2. **安装依赖**
```bash
npm install
```

### 开发模式启动

```bash
# 开发模式（热重载）
npm run dev

# 或者分别启动
npm run dev:renderer  # 启动Vue开发服务器
npm run dev:electron  # 启动Electron
```

## 📦 打包发布

### Windows
```bash
npm run build:win
# 输出: dist/MarketDataDownloader-Setup-1.0.0.exe
```

### macOS
```bash
npm run build:mac
# 输出: dist/MarketDataDownloader-1.0.0.dmg
```

### Linux
```bash
npm run build:linux
# 输出: dist/market-data-downloader-1.0.0.AppImage
```

## 🎯 功能说明

### 数据查询
- 支持53种消息类型
- 按日期范围查询
- 支持批量股票代码
- 实时显示查询进度

### 数据导出
- **CSV格式**: 通用表格格式，Excel可直接打开，适合数据分析
- **JSON格式**: 结构化数据，便于程序处理和二次开发

### 任务管理
- 批量下载任务队列
- 下载进度实时显示
- 支持暂停/继续/取消
- 下载历史记录

### 配置管理
- API Key安全存储
- 下载目录自定义
- 界面主题切换
- 语言设置

## 🔧 API接口

客户端直接调用现有的REST API网关：

```javascript
// API基础配置
const API_BASE_URL = 'http://61.151.241.233:8080/api/v1'

// 查询数据
POST /api/v1/query
{
  "messageType": "ZZ-01",
  "symbol": "SZ.000001",
  "startDate": "20250901",
  "endDate": "20250930",
  "limit": 1000,
  "format": "csv"  // 或 "json"
}

// 获取统计信息
GET /api/v1/stats/{messageType}

// 获取活动记录
GET /api/v1/activity
```

## 📄 许可证
Commercial License

## 👥 团队
Trading System Team © 2025

## 📞 技术支持
- 内部使用
- 技术问题请联系系统管理员