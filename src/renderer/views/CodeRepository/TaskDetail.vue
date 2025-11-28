<template>
  <div class="task-detail-page">
    <div class="page-header">
      <el-button @click="goBack" size="small" :icon="ArrowLeft">返回执行记录</el-button>
      <h2>任务详情</h2>
    </div>

    <div class="page-content">
      <el-empty description="任务详情功能开发中..." :image-size="200" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()

const goBack = () => {
  router.push('/code-repository/history')
}
</script>

<style scoped lang="scss">
.task-detail-page {
  padding: 24px;
  min-height: 100vh;
  background: #f5f7fa;

  .page-header {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 24px;

    h2 {
      margin: 0;
      font-size: 24px;
      color: #303133;
    }
  }

  .page-content {
    background: #fff;
    padding: 60px;
    border-radius: 8px;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>

