<template>
  <div class="intermediate-table-page">
    <div class="page-content">
      <ListContent />
    </div>
  </div>
</template>

<script setup lang="ts">
import ListContent from './ListContent.vue'
</script>

<style scoped>
.intermediate-table-page {
  height: calc(100vh - 60px - 24px - 40px);
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}
.page-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
