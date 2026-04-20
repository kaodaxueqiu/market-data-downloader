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
  padding: 24px;
  background: linear-gradient(180deg, #f0f5ff 0%, #f5f7fa 100%);
  min-height: calc(100vh - 60px);
}
</style>
