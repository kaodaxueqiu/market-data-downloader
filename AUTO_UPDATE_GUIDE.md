# 📦 自动更新功能使用指南

## ✅ 已完成的工作

1. ✅ 安装 electron-updater 依赖包
2. ✅ 在主进程添加自动更新逻辑
3. ✅ 在设置页面添加检查更新UI
4. ✅ 配置 package.json 发布信息
5. ✅ 配置 GitHub Actions 自动发布

## 🚀 如何发布新版本

### 步骤1：修改版本号
已经改为 **v1.2.0**

### 步骤2：提交代码
1. 打开 GitHub Desktop
2. Summary 填写：`发布v1.2.0 - 添加自动更新功能`
3. 点击 "Commit to main"
4. 点击 "Push origin"

### 步骤3：创建Git标签
在命令行执行：
```bash
cd c:\Users\yuyan\Desktop\123\market-data-downloader
git tag v1.2.0
git push origin v1.2.0
```

### 步骤4：等待自动构建
- GitHub Actions 会自动：
  1. 在 Windows 虚拟机上打包 Windows 版本
  2. 在 macOS 虚拟机上打包 macOS 版本
  3. 自动发布到 GitHub Releases
- 大约需要 5-10 分钟

### 步骤5：查看发布结果
访问：`https://github.com/YOUR_USERNAME/market-data-downloader/releases`

## 📱 客户端如何更新

### 自动更新流程：
1. 用户打开应用
2. 进入"系统设置"页面
3. 点击"检查更新"按钮
4. 如果有新版本：
   - 弹窗提示新版本
   - 用户点击"立即下载"
   - 显示下载进度条
   - 下载完成后点击"立即重启并更新"
5. 应用自动重启到新版本

## ⚠️ 重要提示

### 需要修改的地方：

1. **package.json 第50行**
   ```json
   "owner": "YOUR_GITHUB_USERNAME",  // 改成你的GitHub用户名
   "repo": "market-data-downloader"   // 改成你的仓库名
   ```

2. **GitHub仓库必须公开** 或者配置访问token
   - 私有仓库需要配置 `GH_TOKEN`

3. **网络问题**
   - 客户端需要能访问 GitHub
   - 国内用户可能需要配置代理或使用VPN

## 🔧 测试自动更新

### 测试步骤：
1. 发布 v1.2.0
2. 本地修改版本号为 v1.1.0（模拟旧版本）
3. 运行应用，点击"检查更新"
4. 应该提示发现 v1.2.0 新版本

## 📝 electron-builder配置

已配置：
- Windows: portable 格式（单文件 exe）
- macOS: zip 格式（用于自动更新）
- 自动发布到 GitHub Releases

## 🎯 下次发布新版本

1. 修改版本号（package.json + App.vue）
2. 提交代码
3. 创建并推送标签：`git tag v1.3.0 && git push origin v1.3.0`
4. 等待 GitHub Actions 自动构建和发布
5. 客户端自动检测到新版本

---

**完成时间**: 2025-10-08
**版本**: v1.2.0



