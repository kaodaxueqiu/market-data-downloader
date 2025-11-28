<template>
  <div class="execute-page">
    <div class="page-header">
      <h2>执行模型</h2>
      <div class="header-actions">
        <el-button type="primary" :icon="VideoPlay">执行模型</el-button>
      </div>
    </div>

    <div class="page-content">
      <el-empty description="执行模型功能开发中..." :image-size="200" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { VideoPlay } from '@element-plus/icons-vue'

// 执行模型页面
// TODO: 等待后端提供API接口
</script>

<style scoped lang="scss">
.execute-page {
  padding: 24px;

  .page-header {
    display: flex;
    justify-content: space-between;
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
    padding: 40px;
    border-radius: 8px;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>

