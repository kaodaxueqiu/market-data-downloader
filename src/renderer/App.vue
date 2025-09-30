<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <el-container class="app-container">
        <!-- 侧边栏 -->
        <el-aside width="200px" class="app-sidebar">
          <div class="app-logo">
            <el-icon :size="28"><DataAnalysis /></el-icon>
            <span>数据下载工具</span>
          </div>
          
          <el-menu
            :default-active="activeMenu"
            router
            class="app-menu"
            @select="handleMenuSelect"
          >
            <el-menu-item index="/">
              <el-icon><House /></el-icon>
              <span>首页</span>
            </el-menu-item>
            
            <el-menu-item index="/download">
              <el-icon><Download /></el-icon>
              <span>数据下载</span>
            </el-menu-item>
            
            <el-menu-item index="/tasks">
              <el-icon><List /></el-icon>
              <span>任务管理</span>
            </el-menu-item>
            
            <el-menu-item index="/history">
              <el-icon><Clock /></el-icon>
              <span>历史记录</span>
            </el-menu-item>
            
            <el-menu-item index="/dictionary">
              <el-icon><Document /></el-icon>
              <span>数据字典</span>
            </el-menu-item>
            
            <el-menu-item index="/database-dictionary">
              <el-icon><Folder /></el-icon>
              <span>数据库字典</span>
            </el-menu-item>
            
            <el-menu-item index="/static-data-download">
              <el-icon><FolderOpened /></el-icon>
              <span>静态数据下载</span>
            </el-menu-item>
            
            <el-menu-item index="/settings">
              <el-icon><Setting /></el-icon>
              <span>系统设置</span>
            </el-menu-item>
          </el-menu>
          
          <div class="app-version">
            v1.0.0
          </div>
        </el-aside>
        
        <!-- 主内容区 -->
        <el-container>
          <!-- 顶栏 -->
          <el-header class="app-header">
            <div class="header-left">
              <h2>{{ pageTitle }}</h2>
            </div>
            <div class="header-right">
              <el-button
                v-if="hasApiKey"
                type="success"
                size="small"
                circle
                :icon="Connection"
              >
              </el-button>
              <el-button
                v-else
                type="warning"
                size="small"
                @click="goToSettings"
              >
                <el-icon><Key /></el-icon>
                配置API Key
              </el-button>
            </div>
          </el-header>
          
          <!-- 页面内容 -->
          <el-main class="app-main">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </el-main>
        </el-container>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
// import { ElMessage } from 'element-plus'  // 暂时未使用
import { 
  House, 
  Download, 
  List, 
  Clock, 
  Setting, 
  DataAnalysis,
  Connection,
  Key,
  Document,
  Folder,
  FolderOpened
} from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => route.path)
const hasApiKey = ref(false)

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '首页',
    '/download': '数据下载',
    '/tasks': '任务管理',
    '/history': '历史记录',
    '/dictionary': '数据字典',
    '/database-dictionary': '数据库字典',
    '/static-data-download': '静态数据下载',
    '/settings': '系统设置'
  }
  return titles[route.path] || '市场数据下载工具'
})

const handleMenuSelect = (index: string) => {
  console.log('Menu selected:', index)
}

const goToSettings = () => {
  router.push('/settings')
}

const checkApiKey = async () => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    hasApiKey.value = keys.length > 0 && keys.some((k: any) => k.isDefault)
  } catch (error) {
    console.error('检查API Key失败:', error)
    hasApiKey.value = false
  }
}

onMounted(() => {
  checkApiKey()
})
</script>

<style lang="scss">
.app-container {
  height: 100vh;
  
  .app-sidebar {
    background: linear-gradient(180deg, #1e3c72 0%, #2a5298 100%);
    color: white;
    display: flex;
    flex-direction: column;
    
    .app-logo {
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      font-size: 18px;
      font-weight: bold;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .app-menu {
      flex: 1;
      background: transparent;
      border: none;
      
      .el-menu-item {
        color: rgba(255, 255, 255, 0.8);
        
        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }
        
        &.is-active {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }
      }
    }
    
    .app-version {
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }
  }
  
  .app-header {
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    
    .header-left h2 {
      margin: 0;
      font-size: 20px;
      color: #303133;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }
  
  .app-main {
    background: #f5f7fa;
    padding: 20px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
