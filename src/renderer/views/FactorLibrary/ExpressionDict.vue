<template>
  <div class="expression-dict-page">
    <ExpressionDictContent />
  </div>
</template>

<script setup lang="ts">
import ExpressionDictContent from './Backtest/ExpressionDictContent.vue'
</script>

<style scoped lang="scss">
.expression-dict-page {
  background: #f5f7fa;
  height: calc(100vh - 60px - 24px - 40px);
  overflow: hidden;
}
</style>
