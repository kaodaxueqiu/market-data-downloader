# 🪟 Windows 打包指南

## 在 Windows 系统上打包

### 1. 准备环境
```powershell
# 安装 Node.js (推荐 v18 或 v20)
# 下载地址: https://nodejs.org/

# 验证安装
node --version
npm --version
```

### 2. 下载项目
将 `/opt/demo/rest/market-data-downloader` 目录复制到 Windows 系统

### 3. 安装依赖
```powershell
cd market-data-downloader
npm install
```

### 4. 开发测试
```powershell
# 启动开发模式
npm run dev
```

### 5. 打包执行文件
```powershell
# 打包 Windows 安装程序
npm run build:win

# 输出位置: dist/MarketDataDownloader-Setup-1.0.0.exe
```

## 跨平台打包（在 Linux 上打包 Windows）

### 方式一：使用 Docker
```bash
# 使用 electronuserland/builder 镜像
docker run --rm -ti \
  -v ${PWD}:/project \
  electronuserland/builder:wine \
  bash -c "cd /project && npm install && npm run build:win"
```

### 方式二：安装 Wine
```bash
# Ubuntu/Debian
sudo apt-get install wine wine32 wine64

# 然后运行打包
npm run build:win
```

## 预期打包结果

```
dist/
├── MarketDataDownloader-Setup-1.0.0.exe  # 安装程序（推荐）
├── win-unpacked/                          # 免安装版本
│   ├── Market Data Downloader.exe        # 主程序
│   ├── resources/                        # 资源文件
│   └── ...                              # 其他依赖
└── latest.yml                            # 版本信息
```

## 运行要求

- Windows 7 SP1 / Windows 10 / Windows 11
- 64位系统
- 至少 200MB 可用空间
- 网络连接（访问 API 网关）

## 常见问题

### Q1: 打包失败
- 确保 Node.js 版本 >= 16
- 清理缓存：`npm cache clean --force`
- 删除 node_modules 重新安装

### Q2: 程序无法启动
- 检查防火墙设置
- 以管理员身份运行
- 检查是否有杀毒软件拦截

### Q3: 无法连接 API
- 确认可以访问 http://61.151.241.233:8080
- 检查代理设置

---
*最后更新：2025-09-27*
