<template>
  <div class="fund-position">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><Histogram /></el-icon>
          <span>持仓分析</span>
        </div>
      </template>
      
      <div class="placeholder-content">
        <el-empty description="持仓分析功能开发中">
          <el-icon :size="60" color="#e6a23c"><Histogram /></el-icon>
        </el-empty>
        
        <div class="feature-desc">
          <h3>计划功能</h3>
          <ul>
            <li>💼 持仓结构分析</li>
            <li>📊 行业配置</li>
            <li>🎯 个股权重</li>
            <li>📈 持仓变化追踪</li>
          </ul>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Histogram } from '@element-plus/icons-vue'
</script>

<style lang="scss" scoped>
.fund-position {
  height: 100%;
  padding: 20px;
  
  .el-card {
    height: calc(100vh - 100px);
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 600;
    }
    
    .placeholder-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      
      .feature-desc {
        margin-top: 30px;
        
        h3 {
          text-align: center;
          color: #303133;
          margin-bottom: 20px;
        }
        
        ul {
          list-style: none;
          padding: 0;
          
          li {
            padding: 10px 20px;
            margin: 8px 0;
            background: #fef0f0;
            border-radius: 6px;
            color: #606266;
          }
        }
      }
    }
  }
}
</style>





