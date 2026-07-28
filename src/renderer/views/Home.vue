<template>
  <div class="home-page">
    <!-- 欢迎卡片 -->
    <el-card class="welcome-card">
      <div class="welcome-content">
        <div class="welcome-text">
          <h1>资舟量化研究平台 ✨</h1>
          <p>专业的量化研究与数据管理系统，集成数据中心、因子库、基金管理等核心功能</p>
        </div>
        <div class="welcome-icon">
          <el-icon :size="100" color="rgba(255,255,255,0.8)"><DataAnalysis /></el-icon>
        </div>
      </div>
    </el-card>
    
    <!-- 功能模块快捷入口（全量展示，无权限的显示锁定状态） -->
    <div class="modules-grid">
      <el-card 
        v-for="module in allModules" 
        :key="module.id" 
        class="module-card"
        :class="{ 'module-locked': !hasPermission(module.id) }"
        shadow="hover"
        @click="handleModuleClick(module)"
      >
        <div class="module-content">
          <div class="module-icon">
            <el-icon :size="48" :color="hasPermission(module.id) ? module.color : '#C0C4CC'">
              <component :is="module.icon" />
            </el-icon>
          </div>
          <div class="module-info">
            <div class="module-name">
              {{ module.name }}
              <el-icon v-if="!hasPermission(module.id)" class="lock-icon" color="#C0C4CC">
                <Lock />
              </el-icon>
            </div>
            <div class="module-desc">{{ module.description }}</div>
            <el-tag v-if="!hasPermission(module.id)" type="info" size="small" class="premium-tag">
              需要开通
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>
    
    <!-- 系统状态 -->
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>系统状态</span>
          </template>
          <div class="status-list">
            <div class="status-item">
              <span class="status-label">数据源连接</span>
              <el-tag type="success">正常</el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">API服务</span>
              <el-tag type="success">运行中</el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">存储空间</span>
              <el-tag type="info">充足</el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>使用统计</span>
          </template>
          <div class="stats-list">
            <div class="stat-item">
              <span class="stat-label">今日查询次数</span>
              <span class="stat-value">{{ todayQueries }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">活跃任务</span>
              <span class="stat-value">{{ activeTasks }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">数据表总数</span>
              <span class="stat-value">938</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 快速开始 -->
    <el-card>
      <template #header>
        <span>快速开始</span>
      </template>
      <div class="quick-guide">
        <el-steps :active="1" align-center>
          <el-step title="配置API Key" description="在系统设置中配置" />
          <el-step title="选择功能模块" description="数据中心/因子库/基金管理" />
          <el-step title="开始使用" description="查询数据或管理基金" />
        </el-steps>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataAnalysis, Lock } from '@element-plus/icons-vue'
import { getHomeModules, getMenuFirstPath, type MenuItem } from '@/config/menuConfig'

const router = useRouter()

// 用户菜单权限
const menuPermissions = ref<string[]>([])

// 从统一配置获取首页模块（自动同步，无需硬编码！）
const allModules = getHomeModules()

const todayQueries = ref(0)
const activeTasks = ref(0)

// 检查是否有权限
const hasPermission = (menuId: string) => {
  // 如果没有权限数据，默认有权限（兼容模式）
  if (menuPermissions.value.length === 0) {
    return true
  }
  return menuPermissions.value.includes(menuId)
}

// 处理模块点击
const handleModuleClick = (module: MenuItem) => {
  if (hasPermission(module.id)) {
    // 有权限，跳转到第一个可用路径
    const targetPath = getMenuFirstPath(module)
    router.push(targetPath)
  } else {
    // 无权限，提示用户
    ElMessage.warning({
      message: `「${module.name}」功能需要开通后才能使用，请联系管理员开通权限`,
      duration: 3000,
      showClose: true
    })
  }
}

// 加载菜单权限
const loadMenuPermissions = async () => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    
    if (defaultKey && defaultKey.menu_permissions) {
      menuPermissions.value = defaultKey.menu_permissions
      console.log('✅ 首页菜单权限已加载:', menuPermissions.value)
    } else {
      console.log('⚠️ 未找到菜单权限')
      menuPermissions.value = []
    }
  } catch (error) {
    console.error('❌ 加载菜单权限失败:', error)
    menuPermissions.value = []
  }
}

onMounted(async () => {
  console.log('🏠 Home组件已挂载')
  await loadMenuPermissions()
})
</script>

<style lang="scss" scoped>
.home-page {
  .welcome-card {
    margin-bottom: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    
    .welcome-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 0;
      
      .welcome-text {
        flex: 1;
        
        h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        
        p {
          margin: 0 0 20px 0;
          opacity: 0.9;
        }
        
        .quick-actions {
          display: flex;
          gap: 15px;
        }
      }
      
      .welcome-icon {
        padding: 0 40px;
        
        :deep(.el-icon) {
          color: rgba(255, 255, 255, 0.8) !important;
        }
      }
    }
  }
  
  .modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
    
    .module-card {
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      
      &:hover {
        transform: translateY(-4px);
      }
      
      // 无权限的卡片样式
      &.module-locked {
        opacity: 0.75;
        background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
        
        &:hover {
          transform: translateY(-2px);
        }
        
        .module-name {
          color: #909399 !important;
        }
        
        .module-desc {
          color: #C0C4CC !important;
        }
      }
      
      .module-content {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 10px 0;
        
        .module-icon {
          flex-shrink: 0;
        }
        
        .module-info {
          flex: 1;
          
          .module-name {
            font-size: 18px;
            font-weight: bold;
            color: #303133;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            
            .lock-icon {
              font-size: 16px;
            }
          }
          
          .module-desc {
            font-size: 14px;
            color: #909399;
            margin-bottom: 6px;
          }
          
          .premium-tag {
            font-size: 11px;
          }
        }
      }
    }
  }
  
  .status-list, .stats-list {
    .status-item, .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
      
      &:last-child {
        border-bottom: none;
      }
      
      .status-label, .stat-label {
        font-size: 14px;
        color: #606266;
      }
      
      .stat-value {
        font-size: 20px;
        font-weight: bold;
        color: #409EFF;
      }
    }
  }
  
  .quick-guide {
    padding: 20px 0;
  }
}
</style>
