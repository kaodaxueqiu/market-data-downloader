<template>
  <div class="fund-performance">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><DataAnalysis /></el-icon>
          <span>业绩分析</span>
        </div>
      </template>
      
      <div class="placeholder-content">
        <el-empty description="业绩分析功能开发中">
          <el-icon :size="60" color="#67c23a"><DataAnalysis /></el-icon>
        </el-empty>
        
        <div class="feature-desc">
          <h3>计划功能</h3>
          <ul>
            <li>📈 收益率分析</li>
            <li>📊 业绩归因</li>
            <li>🎯 风险调整收益</li>
            <li>📉 回撤分析</li>
          </ul>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { DataAnalysis } from '@element-plus/icons-vue'
</script>

<style lang="scss" scoped>
.fund-performance {
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
            background: #f0f9ff;
            border-radius: 6px;
            color: #606266;
          }
        }
      }
    }
  }
}
</style>





