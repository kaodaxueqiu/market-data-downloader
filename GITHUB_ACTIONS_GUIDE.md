# GitHub Actions 自动构建指南

## 📦 自动构建所有平台版本

本项目已配置 GitHub Actions，可以在云端自动构建 Windows 和 macOS 版本。

## 🚀 使用方法

### 方式一：手动触发构建（推荐）

1. **将项目上传到 GitHub**
   ```bash
   # 在项目目录下
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/你的用户名/market-data-downloader.git
   git push -u origin main
   ```

2. **在 GitHub 网页上手动触发**
   - 进入仓库页面
   - 点击 "Actions" 标签
   - 选择 "Build Release" workflow
   - 点击 "Run workflow" 按钮
   - 选择分支（main）
   - 点击绿色的 "Run workflow" 按钮

3. **等待构建完成**（约 10-15 分钟）
   - Windows 版本会在 windows-latest 机器上构建
   - macOS 版本会在 macos-latest 机器上构建

4. **下载构建产物**
   - 构建完成后，点击对应的 workflow run
   - 在页面底部找到 "Artifacts" 区域
   - 下载：
     - `windows-portable` - Windows 绿色版
     - `macos-portable` - macOS 绿色版（包含 Intel 和 Apple Silicon）

### 方式二：通过 Tag 触发（发布版本）

当你想发布正式版本时：

```bash
# 创建版本标签
git tag v1.0.0
git push origin v1.0.0
```

这会：
- 自动触发构建
- 构建完成后自动创建 GitHub Release
- 将所有平台的安装包上传到 Release 页面

## 📋 生成的文件

### Windows
- `Market Data Downloader 1.0.0.exe` (绿色版，约 70MB)

### macOS
- `Market Data Downloader-1.0.0-mac.zip` (Intel 版本)
- `Market Data Downloader-1.0.0-arm64-mac.zip` (Apple Silicon 版本)

## 🔧 配置说明

GitHub Actions 配置文件位于：
```
.github/workflows/build.yml
```

构建矩阵：
- `windows-latest`: Windows Server 2022
- `macos-latest`: macOS 12 (Monterey)

## 💡 优势

✅ **无需本地环境** - 不需要在本地安装 macOS
✅ **多平台构建** - 同时构建所有平台
✅ **自动化** - 推送代码后自动构建
✅ **免费使用** - GitHub Actions 对公开仓库免费

## ⚠️ 注意事项

1. **首次使用需要等待** - GitHub Actions 首次运行可能需要下载依赖
2. **私有仓库有限制** - 私有仓库每月有免费分钟数限制
3. **构建时间** - 每个平台约需 5-10 分钟

## 📞 问题排查

如果构建失败：
1. 检查 Actions 日志
2. 确认 `package.json` 配置正确
3. 确认依赖都在 `package.json` 中声明

---

**创建日期**: 2025-09-30  
**版本**: v1.0

