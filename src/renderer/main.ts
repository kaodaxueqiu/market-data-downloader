import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import router from './router'
import './styles/global.scss'

const app = createApp(App)
const pinia = createPinia()

// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('❌ Vue错误:', err)
  console.error('错误信息:', info)
  console.error('组件实例:', instance)
}

// 全局警告处理
app.config.warnHandler = (msg, _instance, trace) => {
  console.warn('⚠️ Vue警告:', msg)
  console.warn('组件追踪:', trace)
}

try {
  console.log('🚀 开始初始化Vue应用...')
  
  // 注册Element Plus
  app.use(ElementPlus, {
    locale: zhCn
  })
  console.log('✅ Element Plus注册完成')

  // 注册所有图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }
  console.log('✅ 图标注册完成')

  // 注册Pinia和路由
  app.use(pinia)
  console.log('✅ Pinia注册完成')
  
  app.use(router)
  console.log('✅ Router注册完成')

  // 挂载应用
  console.log('🚀 开始挂载应用到 #app...')
  app.mount('#app')
  console.log('✅ 应用挂载成功！')
} catch (error) {
  console.error('❌ 初始化失败:', error)
}
