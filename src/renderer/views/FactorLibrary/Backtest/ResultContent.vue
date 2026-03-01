<template>
  <div class="result-content">
    <!-- 没有选中任务时，显示已完成任务列表 -->
    <template v-if="!taskId">
      <!-- 标题 -->
      <div class="section-header">
        <h3>已完成的回测任务</h3>
        <el-button :icon="Refresh" @click="loadCompletedTasks" :loading="listLoading">刷新</el-button>
      </div>

      <!-- 任务卡片列表 -->
      <div class="task-cards" v-loading="listLoading">
        <div 
          v-for="task in completedTasks" 
          :key="task.task_id"
          class="task-card"
          @click="selectTask(task.task_id)"
        >
          <div class="card-header">
            <span class="task-name">{{ task.task_name }}</span>
            <el-tag size="small" effect="plain">{{ getTaskTypeName(task.task_type) }}</el-tag>
          </div>
          <div class="card-body">
            <div class="card-meta">
              <el-icon><Calendar /></el-icon>
              <span>{{ formatDate(task.completed_at) }}</span>
            </div>
            <div class="card-meta">
              <el-icon><Timer /></el-icon>
              <span>耗时 {{ calcDuration(task.started_at, task.completed_at) }}</span>
            </div>
          </div>
          <div class="card-footer">
            <el-button type="primary" size="small" link>
              查看结果 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      
      <el-empty 
        v-if="!listLoading && completedTasks.length === 0" 
        description="暂无已完成的回测任务"
        :image-size="100"
      />
      
      <div class="pagination-wrapper" v-if="total > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[12, 24, 48]"
          layout="total, prev, pager, next"
          @size-change="loadCompletedTasks"
          @current-change="loadCompletedTasks"
          background
          small
        />
      </div>
    </template>

    <!-- 选中任务时，显示结果详情 -->
    <template v-else>
      <!-- 返回按钮 & 操作区 -->
      <div class="detail-header">
        <el-button :icon="ArrowLeft" @click="handleBack">返回列表</el-button>
        <div class="header-actions">
          <el-button :icon="Refresh" @click="loadResult" :loading="detailLoading">刷新</el-button>
          <!-- 下载按钮 -->
          <el-dropdown 
            v-if="task?.status === 'completed'" 
            trigger="click" 
            @command="handleDownload"
          >
            <el-button type="primary" :loading="downloading">
              <el-icon><Download /></el-icon>
              <span>下载结果</span>
              <el-icon class="el-icon--right"><ArrowRight /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="csv-summary">
                  <el-icon><Document /></el-icon>
                  汇总数据 - {{ selectedPeriods[0] || 1 }}日周期 (CSV)
                </el-dropdown-item>
                <el-dropdown-item command="csv-daily">
                  <el-icon><DataLine /></el-icon>
                  每日明细 - {{ selectedPeriods[0] || 1 }}日周期 (CSV)
                </el-dropdown-item>
                <el-dropdown-item command="csv-all">
                  <el-icon><Download /></el-icon>
                  全部数据 - {{ selectedPeriods[0] || 1 }}日周期 (CSV)
                </el-dropdown-item>
                <el-dropdown-item command="xlsx-summary" divided>
                  <el-icon><Document /></el-icon>
                  汇总数据 - {{ selectedPeriods[0] || 1 }}日周期 (Excel)
                </el-dropdown-item>
                <el-dropdown-item command="xlsx-daily">
                  <el-icon><DataLine /></el-icon>
                  每日明细 - {{ selectedPeriods[0] || 1 }}日周期 (Excel)
                </el-dropdown-item>
                <el-dropdown-item command="xlsx-all">
                  <el-icon><Download /></el-icon>
                  全部数据 - {{ selectedPeriods[0] || 1 }}日周期 (Excel)
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <!-- 生成报告按钮 -->
          <el-button 
            v-if="task?.status === 'completed'"
            type="success" 
            :loading="generatingReport"
            @click="handleGenerateReport"
          >
            <el-icon><Tickets /></el-icon>
            <span>生成报告</span>
          </el-button>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="detailLoading && !task" class="loading-wrapper">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <p>加载中...</p>
      </div>

      <!-- 任务详情 -->
      <template v-else-if="task">
        <!-- 任务信息卡片 -->
        <div class="info-banner">
          <div class="banner-main">
            <div class="banner-top">
              <h2>{{ task.task_name }}</h2>
              <div class="banner-meta">
                <div class="status-badge" :class="task.status">
                  <el-icon v-if="task.status === 'completed'"><CircleCheck /></el-icon>
                  <el-icon v-else-if="task.status === 'running'" class="is-loading"><Loading /></el-icon>
                  {{ getStatusName(task.status) }}
                </div>
                <span class="meta-divider">|</span>
                <span>{{ formatDate(task.created_at) }}</span>
                <span v-if="task.completed_at" class="meta-divider">|</span>
                <span v-if="task.completed_at">耗时 {{ calcDuration(task.started_at, task.completed_at) }}</span>
                <span v-if="task.user_id" class="meta-divider">|</span>
                <span v-if="task.user_id">执行人: {{ task.user_id }}</span>
                <span class="meta-divider">|</span>
                <span class="task-id-text">ID: {{ task.task_id }}</span>
              </div>
            </div>
            <!-- 回测配置信息 -->
            <div class="banner-config" v-if="task.task_config">
              <div class="config-item">
                <span class="config-label">回测区间</span>
                <span class="config-value">{{ task.task_config.start_date }} ~ {{ task.task_config.end_date }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">股票池</span>
                <span class="config-value">{{ getUniverseName(task.task_config.universe) }}</span>
              </div>
              <div class="config-item">
                <span class="config-label">分组数</span>
                <span class="config-value">{{ task.task_config.backtest_params?.num_groups || 10 }}组</span>
              </div>
              <div class="config-item">
                <span class="config-label">预测周期</span>
                <span class="config-value">{{ task.task_config.backtest_params?.forward_periods?.join('/') || '-' }}日</span>
              </div>
              <div class="config-item" v-if="task.task_config.backtest_params?.factor_direction">
                <span class="config-label">因子方向</span>
                <span class="config-value">{{ getDirectionName(task.task_config.backtest_params.factor_direction) }}</span>
              </div>
              <div class="config-item" v-if="task.task_config.backtest_params?.buy_price_type">
                <span class="config-label">买入价格</span>
                <span class="config-value">{{ getBuyPriceTypeName(task.task_config.backtest_params.buy_price_type) }}</span>
              </div>
              <div class="config-item" v-if="task.task_config.backtest_params?.sell_price_type">
                <span class="config-label">卖出价格</span>
                <span class="config-value">{{ getSellPriceTypeName(task.task_config.backtest_params.sell_price_type) }}</span>
              </div>
              <div class="config-item" v-if="task.task_config.backtest_params?.benchmarks?.length">
                <span class="config-label">比对基准</span>
                <span class="config-value">{{ getBenchmarkNames(task.task_config.backtest_params.benchmarks) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 失败原因 -->
        <div v-if="task.status === 'failed'" class="error-section">
          <el-alert
            title="任务执行失败"
            type="error"
            :closable="false"
            show-icon
          >
            <template #default>
              <div class="error-content">
                <p v-if="task.error_message">{{ task.error_message }}</p>
                <p v-else>未知错误，请联系管理员</p>
              </div>
            </template>
          </el-alert>
          
          <!-- 因子表达式 -->
          <div class="failed-factor-info" v-if="task.task_config">
            <div class="factor-expression-card" v-if="task.task_config.factor_expression">
              <div class="card-title">因子表达式</div>
              <div class="card-content">
                <code>{{ task.task_config.factor_expression }}</code>
              </div>
            </div>
            <div class="factor-expression-card" v-if="task.task_config.factor_code">
              <div class="card-title">因子代码</div>
              <div class="card-content">
                <pre>{{ task.task_config.factor_code }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 结果展示 -->
        <template v-if="task.status === 'completed' && result">
          <!-- 遍历因子结果 -->
          <div v-for="(factor, index) in result.factor_results" :key="index" class="factor-result-section">
            <!-- 因子标题 -->
            <div class="factor-header">
              <div class="factor-title-row">
                <h3>{{ factor.factor_name || `因子 ${index + 1}` }}</h3>
                <!-- 周期选择器 -->
                <div class="period-selector" v-if="factor.period_ic_stats?.length">
                  <span class="period-label">预测周期</span>
                  <div class="period-tabs">
                    <div 
                      v-for="p in factor.period_ic_stats" 
                      :key="p.period"
                      class="period-tab"
                      :class="{ active: selectedPeriods[index] === p.period }"
                      @click="selectedPeriods[index] = p.period"
                    >
                      {{ p.period }}日
                    </div>
                  </div>
                </div>
              </div>
              <div class="factor-code" v-if="factor.factor_code">
                <code>{{ factor.factor_code }}</code>
              </div>
            </div>

            <!-- 核心指标卡片 -->
            <div class="metrics-cards">
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.rank_ic_mean)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_mean, 4) }}
                </div>
                <div class="metric-label">Rank IC</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_std, 4) }}
                </div>
                <div class="metric-label">Rank IC标准差</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.rank_ic_ir)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_ir, 3) }}
                </div>
                <div class="metric-label">Rank IC_IR</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.annual_return)">
                  {{ formatPercent(getCurrentPeriodData(factor, index)?.annual_return) }}
                </div>
                <div class="metric-label">年化收益</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getValueClass(getCurrentPeriodData(factor, index)?.sharpe_ratio)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.sharpe_ratio, 2) }}
                </div>
                <div class="metric-label">夏普比率</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value negative">
                  {{ formatPercent(getCurrentPeriodData(factor, index)?.max_drawdown) }}
                </div>
                <div class="metric-label">最大回撤</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value">
                  {{ formatPercent(getCurrentPeriodData(factor, index)?.win_rate) }}
                </div>
                <div class="metric-label">胜率</div>
              </div>
              <div class="metric-card ic-metric">
                <div class="metric-value" :class="getMonotonicityClass(getCurrentPeriodData(factor, index)?.monotonicity)">
                  {{ formatNumber(getCurrentPeriodData(factor, index)?.monotonicity, 4) }}
                </div>
                <div class="metric-label">单调性</div>
              </div>
            </div>

            <!-- 详细指标面板 -->
            <div class="detail-panels">
              <!-- 多周期完整指标对比 -->
              <div class="detail-panel" v-if="factor.period_ic_stats?.length">
                <div class="panel-title">
                  <el-icon><TrendCharts /></el-icon>
                  多周期完整指标对比
                </div>
                <div class="panel-body">
                  <el-table 
                    :data="factor.period_ic_stats" 
                    size="small" 
                    stripe
                    :row-class-name="(data: any) => data.row.period === selectedPeriods[index] ? 'selected-row' : ''"
                    @row-click="(row: any) => selectedPeriods[index] = row.period"
                    style="cursor: pointer;"
                  >
                    <el-table-column prop="period" label="周期" width="70" fixed>
                      <template #default="{ row }">
                        <span :class="{ 'period-active': row.period === selectedPeriods[index] }">
                          {{ row.period }}日
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="rank_ic_mean" label="Rank IC" width="90">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.rank_ic_mean)">{{ formatNumber(row.rank_ic_mean, 4) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="annual_return" label="年化收益" width="90">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.annual_return)">{{ formatPercent(row.annual_return) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="sharpe_ratio" label="夏普" width="70">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.sharpe_ratio)">{{ formatNumber(row.sharpe_ratio, 2) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="max_drawdown" label="最大回撤" width="90">
                      <template #default="{ row }">
                        <span class="negative">{{ formatPercent(row.max_drawdown) }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="win_rate" label="胜率" width="70">
                      <template #default="{ row }">{{ formatPercent(row.win_rate) }}</template>
                    </el-table-column>
                    <el-table-column prop="monotonicity" label="单调性" width="80">
                      <template #default="{ row }">
                        <span :class="getMonotonicityClass(row.monotonicity)">{{ formatNumber(row.monotonicity, 2) }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                  <div class="table-hint">点击行可切换周期，上方指标卡片和分层收益将联动更新</div>
                </div>
              </div>

              <!-- 分层收益 -->
              <div class="detail-panel" v-if="getCurrentPeriodData(factor, index)?.layer_returns?.length">
                <div class="panel-title">
                  <el-icon><Histogram /></el-icon>
                  分层收益 ({{ getCurrentPeriodData(factor, index)?.layer_returns?.length }}组)
                  <span class="period-tag">({{ selectedPeriods[index] }}日)</span>
                  <!-- 年化/累计切换 -->
                  <div class="return-type-switch">
                    <el-radio-group v-model="layerReturnType" size="small">
                      <el-radio-button label="annual">年化</el-radio-button>
                      <el-radio-button label="total">累计</el-radio-button>
                    </el-radio-group>
                  </div>
                </div>
                <div class="panel-body">
                  <!-- 添加 key 强制响应式更新 -->
                  <div class="layer-returns-chart" :key="'layer-chart-' + layerReturnType">
                    <div 
                      v-for="(ret, idx) in (layerReturnType === 'total' 
                        ? (getCurrentPeriodData(factor, index)?.layer_total_returns || getCurrentPeriodData(factor, index)?.layer_returns || [])
                        : (getCurrentPeriodData(factor, index)?.layer_returns || []))" 
                      :key="idx"
                      class="layer-bar-wrapper"
                    >
                      <div class="layer-label">组{{ idx + 1 }}</div>
                      <div class="layer-bar-container">
                        <div 
                          class="layer-bar"
                          :class="ret >= 0 ? 'positive' : 'negative'"
                          :style="getBarStyle(ret, layerReturnType === 'total' 
                            ? (getCurrentPeriodData(factor, index)?.layer_total_returns || getCurrentPeriodData(factor, index)?.layer_returns || [])
                            : (getCurrentPeriodData(factor, index)?.layer_returns || []))"
                        ></div>
                      </div>
                      <div class="layer-value" :class="ret >= 0 ? 'positive' : 'negative'">
                        {{ formatPercent(ret) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 其他指标 -->
              <div class="detail-panel">
                <div class="panel-title">
                  <el-icon><DataLine /></el-icon>
                  其他指标 <span class="period-tag" v-if="selectedPeriods[index]">({{ selectedPeriods[index] }}日)</span>
                </div>
                <div class="panel-body">
                  <div class="other-metrics">
                    <!-- Rank IC 详细统计 -->
                    <div class="other-metric-item">
                      <span class="label">Rank IC 最大值</span>
                      <span class="value" :class="getValueClass(getCurrentPeriodData(factor, index)?.rank_ic_max)">
                        {{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_max, 4) }}
                      </span>
                    </div>
                    <div class="other-metric-item">
                      <span class="label">Rank IC 最小值</span>
                      <span class="value" :class="getValueClass(getCurrentPeriodData(factor, index)?.rank_ic_min)">
                        {{ formatNumber(getCurrentPeriodData(factor, index)?.rank_ic_min, 4) }}
                      </span>
                    </div>
                    <div class="other-metric-item">
                      <span class="label">Rank IC 胜率(>0)</span>
                      <span class="value">{{ formatPercent(getCurrentPeriodData(factor, index)?.rank_ic_positive_ratio) }}</span>
                    </div>
                    <!-- 原有指标 -->
                    <div class="other-metric-item">
                      <span class="label">年化波动率</span>
                      <span class="value">{{ formatPercent(factor.annual_volatility) }}</span>
                    </div>
                    <div class="other-metric-item">
                      <span class="label">平均换手率</span>
                      <span class="value">{{ formatPercent(factor.turnover_mean) }}</span>
                    </div>
                    <div class="other-metric-item" v-if="dailyMetricsTotal > 0">
                      <span class="label">回测天数</span>
                      <span class="value">{{ dailyMetricsTotal }}天</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 分组选择器分隔条 -->
            <div class="group-selector-bar" v-if="result?.benchmark_metrics?.length">
              <div class="bar-line"></div>
              <span class="bar-title">分层绩效分析</span>
              <div class="bar-line"></div>
              <div class="bar-selector">
                <span class="selector-label">分组:</span>
                <el-select v-model="selectedGroup" size="small" style="width: 100px;" @change="handleGroupChange">
                  <el-option 
                    v-for="opt in groupOptions" 
                    :key="opt.value" 
                    :label="opt.label" 
                    :value="opt.value" 
                  />
                </el-select>
              </div>
              <div class="bar-line"></div>
              <span class="bar-hint">第1组为因子值最大</span>
              <div class="bar-line"></div>
            </div>

            <!-- 基准对比面板 -->
            <div class="detail-panels benchmark-panels" v-if="result?.benchmark_metrics?.length">
              <!-- 基准指数对比 -->
              <div class="detail-panel">
                <div class="panel-title">
                  <el-icon><TrendCharts /></el-icon>
                  基准指数对比
                  <span class="panel-tag">第{{ selectedGroup }}组</span>
                </div>
                <div class="panel-body">
                  <el-table :data="benchmarkCompareData(factor, index)" :key="'benchmark-' + selectedPeriods[index] + '-' + selectedGroup" size="small" class="benchmark-table">
                    <el-table-column prop="metric_name" label="指标" width="100" fixed />
                    <el-table-column :label="`因子(第${selectedGroup}组)`" width="120" align="center">
                      <template #default="{ row }">
                        <span :class="getValueClass(row.strategy_raw)">{{ row.strategy }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column 
                      v-for="bm in result?.benchmark_metrics" 
                      :key="bm.benchmark_code"
                      :label="bm.benchmark_name"
                      align="center"
                      width="100"
                    >
                      <template #default="{ row }">
                        <span :class="getValueClass(row[bm.benchmark_code + '_raw'])">{{ row[bm.benchmark_code] }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>

              <!-- 累计收益曲线 - 点击查看 -->
              <div class="detail-panel" v-if="hasExcessReturnData">
                <div class="panel-title">
                  <el-icon><TrendCharts /></el-icon>
                  收益曲线
                </div>
                <div class="panel-body chart-preview">
                  <el-button type="primary" @click="openExcessReturnChart">
                    <el-icon><TrendCharts /></el-icon>
                    查看累计收益曲线
                  </el-button>
                  <span class="chart-hint">展示因子、基准、超额收益的累计走势对比</span>
                </div>
              </div>
            </div>

          </div>

          <!-- 每日明细（独立区域，只显示一次） -->
          <el-collapse v-if="dailyMetrics.length > 0 || dailyMetricsLoading" class="daily-collapse">
            <el-collapse-item>
              <template #title>
                <div class="collapse-title">
                  <el-icon><Document /></el-icon>
                  每日明细 ({{ dailyMetricsTotal }}条记录)
                  <el-icon v-if="dailyMetricsLoading" class="is-loading" style="margin-left: 8px;"><Loading /></el-icon>
                </div>
              </template>
              <el-table 
                :data="dailyMetrics" 
                size="small" 
                stripe
                max-height="400"
                v-loading="dailyMetricsLoading && dailyMetrics.length === 0"
              >
                <el-table-column prop="date" label="日期" width="110" fixed />
                <el-table-column label="Rank IC" width="110">
                  <template #header>
                    Rank IC ({{ selectedPeriods[0] || '-' }}日)
                  </template>
                  <template #default="{ row }">
                    <span :class="getValueClass(getDailyPeriodIC(row, 0, 'rank_ic'))">
                      {{ formatNumber(getDailyPeriodIC(row, 0, 'rank_ic'), 4) }}
                    </span>
                  </template>
                </el-table-column>
                <!-- 10组分层收益 -->
                <el-table-column 
                  v-for="groupIdx in 10" 
                  :key="'group_' + groupIdx"
                  :label="'第' + groupIdx + '组'"
                  width="85"
                >
                  <template #default="{ row }">
                    <span :class="getValueClass(row.layer_returns?.[groupIdx - 1])">
                      {{ formatPercent(row.layer_returns?.[groupIdx - 1]) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="long_short_return" label="多空收益" width="100">
                  <template #default="{ row }">
                    <span :class="getValueClass(row.long_short_return)">{{ formatPercent(row.long_short_return) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="turnover" label="换手率" width="90">
                  <template #default="{ row }">{{ formatPercent(row.turnover) }}</template>
                </el-table-column>
                <el-table-column prop="num_stocks" label="股票数" width="80" />
                <!-- 动态基准列 -->
                <template v-if="dailyMetrics[0]?.benchmark_returns?.length">
                  <el-table-column 
                    v-for="bm in dailyMetrics[0].benchmark_returns" 
                    :key="bm.benchmark_code + '_return'"
                    :label="bm.benchmark_name"
                    width="100"
                  >
                    <template #default="{ row }">
                      <span :class="getValueClass(getBenchmarkReturn(row, bm.benchmark_code))">
                        {{ formatPercent(getBenchmarkReturn(row, bm.benchmark_code)) }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column 
                    v-for="bm in dailyMetrics[0].benchmark_returns" 
                    :key="bm.benchmark_code + '_excess'"
                    :label="'超额(' + bm.benchmark_name + ')'"
                    width="120"
                  >
                    <template #default="{ row }">
                      <span :class="getValueClass(getExcessReturn(row, bm.benchmark_code))">
                        {{ formatPercent(getExcessReturn(row, bm.benchmark_code)) }}
                      </span>
                    </template>
                  </el-table-column>
                </template>
              </el-table>
              <div class="daily-metrics-footer">
                <span class="loaded-info">已加载 {{ dailyMetrics.length }} / {{ dailyMetricsTotal }} 条</span>
                <el-button 
                  v-if="dailyMetrics.length < dailyMetricsTotal"
                  size="small"
                  type="primary"
                  link
                  :loading="dailyMetricsLoading"
                  @click="loadMoreDailyMetrics"
                >
                  加载更多
                </el-button>
              </div>
            </el-collapse-item>
          </el-collapse>

          <!-- 因子值明细 -->
          <FactorValuesSection :task-id="props.taskId!" />

          <el-empty v-if="!result.factor_results?.length" description="暂无回测结果数据" />
        </template>
      </template>
    </template>

    <!-- 累计收益曲线图对话框 -->
    <el-dialog 
      v-model="excessReturnDialogVisible" 
      :title="`累计收益曲线（因子 vs 基准）- ${selectedPeriods[0] || 1}日周期 / 第${selectedGroup}组`"
      width="90%" 
      top="5vh"
      destroy-on-close
    >
      <div v-loading="chartDataLoading" element-loading-text="正在加载全量数据...">
        <div ref="excessReturnChartRef" class="excess-return-chart-dialog"></div>
        <div class="chart-legend-hint">
          <span><b>实线</b>：因子/超额收益</span>
          <span><b>虚线</b>：基准指数收益</span>
          <span class="data-count" v-if="chartDailyData.length">共 {{ chartDailyData.length }} 个交易日</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  ArrowLeft, ArrowRight, Refresh, Loading, Calendar, Timer, 
  CircleCheck, TrendCharts, Histogram, DataLine, Document, Download, Tickets
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import FactorValuesSection from './FactorValuesSection.vue'

// electronAPI 类型已在 preload/index.ts 中全局定义

const props = defineProps<{
  taskId?: string
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const router = useRouter()

// 列表状态
const listLoading = ref(false)
const completedTasks = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(12)

// 详情状态
const detailLoading = ref(false)
const task = ref<any>(null)
const result = ref<any>(null)

// 下载状态
const downloading = ref(false)
const generatingReport = ref(false)

// 每日明细数据（独立加载）
const dailyMetrics = ref<any[]>([])
const dailyMetricsLoading = ref(false)
const dailyMetricsTotal = ref(0)
const dailyMetricsPage = ref(1)
const dailyMetricsPageSize = ref(100)

// 超额收益曲线图
const excessReturnChartRef = ref<HTMLElement | null>(null)
let excessReturnChart: echarts.ECharts | null = null
const excessReturnDialogVisible = ref(false)

// 图表全量数据
const chartDailyData = ref<any[]>([])
const chartDataLoading = ref(false)

// 加载图表全量数据（循环分页加载）
const loadChartData = async () => {
  if (!props.taskId) return
  chartDataLoading.value = true
  try {
    const allData: any[] = []
    let page = 1
    const pageSize = 500  // 每页500条
    let total = 0
    
    // 循环加载所有页
    do {
      const res = await window.electronAPI.backtest.getDailyMetrics(props.taskId, {
        page,
        page_size: pageSize
      })
      if (res.success && res.data) {
        allData.push(...(res.data.metrics || []))
        total = res.data.total || 0
        page++
      } else {
        break
      }
    } while (allData.length < total)
    
    chartDailyData.value = allData
    console.log(`📊 图表数据加载完成，共 ${allData.length} 条`)
    if (allData.length > 0) {
      console.log('📊 第一条数据结构:', JSON.stringify(allData[0], null, 2))
      console.log('📊 layer_returns:', allData[0]?.layer_returns)
    }
  } catch (error) {
    console.error('加载图表数据失败:', error)
  } finally {
    chartDataLoading.value = false
  }
}

// 打开超额收益曲线图对话框
const openExcessReturnChart = async () => {
  excessReturnDialogVisible.value = true
  // 加载全量数据
  if (chartDailyData.value.length === 0) {
    await loadChartData()
  }
  nextTick(() => {
    setTimeout(() => {
      initExcessReturnChart()
    }, 100)
  })
}

// 检测每日明细中是否有超额收益字段
const hasExcessReturnData = computed(() => {
  if (!dailyMetrics.value?.length || !result.value?.benchmark_metrics?.length) {
    return false
  }
  const firstRow = dailyMetrics.value[0]
  // 检查是否有 benchmark_returns 数组且包含 excess_return
  return firstRow.benchmark_returns?.length > 0 && 
         firstRow.benchmark_returns[0]?.excess_return != null
})

// 初始化超额收益曲线图
const initExcessReturnChart = () => {
  if (!excessReturnChartRef.value) {
    console.log('📊 图表容器未就绪')
    return
  }
  if (!dailyMetrics.value?.length) return
  
  // 销毁旧图表
  if (excessReturnChart) {
    excessReturnChart.dispose()
  }
  
  excessReturnChart = echarts.init(excessReturnChartRef.value)
  renderExcessReturnChart()
}

// 渲染超额收益图表（累计收益曲线）
// 从每日明细获取指定周期、指定分组的收益
const getDailyGroupReturn = (dailyData: any, period: number, groupIndex: number): number => {
  // 优先从 period_returns 获取指定周期的数据
  if (dailyData.period_returns?.length) {
    const periodData = dailyData.period_returns.find((p: any) => p.period === period)
    if (periodData?.layer_returns?.[groupIndex] !== undefined) {
      return periodData.layer_returns[groupIndex]
    }
  }
  // 兼容旧数据：直接使用 layer_returns（默认1日周期）
  return dailyData.layer_returns?.[groupIndex] || 0
}

const renderExcessReturnChart = () => {
  if (!excessReturnChart) return
  
  // 使用图表专用的全量数据
  const data = chartDailyData.value.length > 0 ? chartDailyData.value : dailyMetrics.value
  if (!data.length) return
  
  // 获取日期
  const dates = data.map((d: any) => d.date)
  
  // 从第一条数据获取基准列表
  const firstRow = data[0]
  if (!firstRow?.benchmark_returns?.length) return
  
  const series: any[] = []
  const groupIndex = selectedGroup.value - 1
  // 获取当前选中的周期（默认1日）
  const currentPeriod = selectedPeriods.value[0] || 1
  
  // 1. 选中分组的累计收益（根据周期从 period_returns 获取）
  let groupCum = 1
  const groupData = data.map((d: any) => {
    const dailyReturn = getDailyGroupReturn(d, currentPeriod, groupIndex)
    groupCum *= (1 + dailyReturn)
    return ((groupCum - 1) * 100).toFixed(2)
  })
  series.push({
    name: `因子(第${selectedGroup.value}组)`,
    type: 'line',
    data: groupData,
    smooth: true,
    symbol: 'none',
    lineStyle: { width: 3 }
  })
  
  // 2. 按基准分组，每个基准画 2 条线：基准收益 + 超额收益
  firstRow.benchmark_returns.forEach((bm: any) => {
    // 基准累计收益
    let bmCum = 1
    const bmData = data.map((d: any) => {
      const bmItem = d.benchmark_returns?.find((b: any) => b.benchmark_code === bm.benchmark_code)
      bmCum *= (1 + (bmItem?.benchmark_return || 0))
      return ((bmCum - 1) * 100).toFixed(2)
    })
    series.push({
      name: `${bm.benchmark_name}`,
      type: 'line',
      data: bmData,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1.5, type: 'dashed' }
    })
    
    // 超额累计收益 = 分组累计 - 基准累计
    let groupCum2 = 1
    let bmCum2 = 1
    const excessData = data.map((d: any) => {
      const groupReturn = getDailyGroupReturn(d, currentPeriod, groupIndex)
      const bmItem = d.benchmark_returns?.find((b: any) => b.benchmark_code === bm.benchmark_code)
      const bmReturn = bmItem?.benchmark_return || 0
      groupCum2 *= (1 + groupReturn)
      bmCum2 *= (1 + bmReturn)
      return (((groupCum2 / bmCum2) - 1) * 100).toFixed(2)
    })
    series.push({
      name: `超额(${bm.benchmark_name})`,
      type: 'line',
      data: excessData,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2 }
    })
  })
  
  // 因子收益红色，每个基准用一组颜色（浅色=基准，深色=超额）
  const colorPairs = [
    ['#93c5fd', '#2563eb'],  // 蓝色系
    ['#86efac', '#16a34a'],  // 绿色系
    ['#fdba74', '#ea580c'],  // 橙色系
    ['#f9a8d4', '#db2777'],  // 粉色系
    ['#c4b5fd', '#7c3aed'],  // 紫色系
    ['#67e8f9', '#0891b2'],  // 青色系
  ]
  const colors: string[] = ['#e74c3c']  // 因子收益 - 红色
  firstRow.benchmark_returns.forEach((_: any, idx: number) => {
    const pair = colorPairs[idx % colorPairs.length]
    colors.push(pair[0], pair[1])  // 基准浅色，超额深色
  })
  
  const option: echarts.EChartsOption = {
    color: colors,
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        if (!params?.length) return ''
        let html = `<div style="font-weight: bold; margin-bottom: 8px;">${params[0].axisValue}</div>`
        params.forEach((p: any) => {
          const color = p.color
          const value = p.value != null ? `${p.value}%` : '-'
          html += `<div style="display: flex; align-items: center; margin: 4px 0;">
            <span style="display: inline-block; width: 10px; height: 10px; background: ${color}; border-radius: 50%; margin-right: 8px;"></span>
            <span style="min-width: 140px;">${p.seriesName}: </span>
            <span style="font-weight: bold;">${value}</span>
          </div>`
        })
        return html
      }
    },
    legend: {
      data: series.map(s => s.name),
      bottom: 0,
      type: 'scroll',
      textStyle: { fontSize: 12 }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '5%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: {
        formatter: (val: string) => {
          // 只显示月份
          return val.substring(5, 10)
        },
        interval: Math.floor(dates.length / 10)
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}%'
      },
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      }
    },
    series,
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ]
  }
  
  excessReturnChart.setOption(option)
}

// 监听窗口大小变化，调整图表
const handleResize = () => {
  excessReturnChart?.resize()
}

// 每个因子选中的周期
const selectedPeriods = ref<Record<number, number>>({})

// 分层收益显示类型：年化 or 累计
const layerReturnType = ref<'annual' | 'total'>('annual')

// 选中的分组（1-10，用于计算分组收益）
const selectedGroup = ref(1)

// 分组选项
const groupOptions = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: `第${i + 1}组`
}))

// 分组切换处理
const handleGroupChange = async () => {
  // 如果还没有加载全量数据，先加载
  if (chartDailyData.value.length === 0) {
    await loadChartData()
  }
  // 如果曲线对话框已打开，重新渲染
  if (excessReturnDialogVisible.value) {
    renderExcessReturnChart()
  }
}

// 获取当前选中周期的数据
const getCurrentPeriodData = (factor: any, index: number) => {
  const period = selectedPeriods.value[index]
  if (!period || !factor.period_ic_stats?.length) {
    // 返回默认周期数据（第一个）
    return factor.period_ic_stats?.[0] || null
  }
  return factor.period_ic_stats.find((p: any) => p.period === period) || factor.period_ic_stats[0]
}

// 生成基准指数对比表格数据
const benchmarkCompareData = (factor: any, index: number) => {
  if (!result.value?.benchmark_metrics) return []
  
  // 获取当前选中周期的数据
  const periodData = getCurrentPeriodData(factor, index)
  if (!periodData) return []
  
  // 获取选中分组的索引 (0-9)
  const groupIndex = selectedGroup.value - 1
  
  // 从 period_ic_stats 获取分组指标
  const groupAnnualReturn = periodData.layer_returns?.[groupIndex]
  const groupSharpe = periodData.layer_sharpe_ratios?.[groupIndex]
  const groupMaxDrawdown = periodData.layer_max_drawdowns?.[groupIndex]
  
  const rows: any[] = []
  
  // 年化收益
  const row1: any = { metric_name: '年化收益' }
  row1.strategy_raw = groupAnnualReturn
  row1.strategy = formatPercent(groupAnnualReturn)
  result.value?.benchmark_metrics?.forEach((bm: any) => {
    row1[bm.benchmark_code + '_raw'] = bm.benchmark_annual_return
    row1[bm.benchmark_code] = formatPercent(bm.benchmark_annual_return)
  })
  rows.push(row1)
  
  // 夏普比率
  const row2: any = { metric_name: '夏普比率' }
  row2.strategy_raw = groupSharpe
  row2.strategy = formatNumber(groupSharpe, 2)
  result.value?.benchmark_metrics?.forEach((bm: any) => {
    row2[bm.benchmark_code + '_raw'] = bm.benchmark_sharpe
    row2[bm.benchmark_code] = formatNumber(bm.benchmark_sharpe, 2)
  })
  rows.push(row2)
  
  // 最大回撤
  const row3: any = { metric_name: '最大回撤' }
  row3.strategy_raw = groupMaxDrawdown
  row3.strategy = formatPercent(groupMaxDrawdown)
  result.value?.benchmark_metrics?.forEach((bm: any) => {
    row3[bm.benchmark_code + '_raw'] = bm.benchmark_max_drawdown
    row3[bm.benchmark_code] = formatPercent(bm.benchmark_max_drawdown)
  })
  rows.push(row3)
  
  // 超额收益 (分组年化 - 基准年化)
  const row4: any = { metric_name: '超额收益', strategy: '-', strategy_raw: null }
  result.value?.benchmark_metrics?.forEach((bm: any) => {
    const excess = (groupAnnualReturn || 0) - (bm.benchmark_annual_return || 0)
    row4[bm.benchmark_code + '_raw'] = excess
    row4[bm.benchmark_code] = formatPercent(excess)
  })
  rows.push(row4)
  
  // 超额夏普
  const row5: any = { metric_name: '超额夏普', strategy: '-', strategy_raw: null }
  result.value?.benchmark_metrics?.forEach((bm: any) => {
    const excess = (groupSharpe || 0) - (bm.benchmark_sharpe || 0)
    row5[bm.benchmark_code + '_raw'] = excess
    row5[bm.benchmark_code] = formatNumber(excess, 2)
  })
  rows.push(row5)
  
  return rows
}

// 获取每日明细中指定周期的IC数据
const getDailyPeriodIC = (row: any, index: number, field: 'ic' | 'rank_ic') => {
  const period = selectedPeriods.value[index]
  if (!period || !row.period_ics?.length) {
    return row[field] // 返回默认值
  }
  const periodData = row.period_ics.find((p: any) => p.period === period)
  return periodData ? periodData[field] : row[field]
}

// 获取每日明细中指定基准的收益
const getBenchmarkReturn = (row: any, benchmarkCode: string) => {
  const bmData = row.benchmark_returns?.find((b: any) => b.benchmark_code === benchmarkCode)
  return bmData?.benchmark_return
}

// 获取每日明细中指定基准的超额收益
const getExcessReturn = (row: any, benchmarkCode: string) => {
  const bmData = row.benchmark_returns?.find((b: any) => b.benchmark_code === benchmarkCode)
  return bmData?.excess_return
}

// 初始化周期选择
const initPeriodSelections = () => {
  if (!result.value?.factor_results) return
  result.value.factor_results.forEach((factor: any, index: number) => {
    if (factor.period_ic_stats?.length && !selectedPeriods.value[index]) {
      selectedPeriods.value[index] = factor.period_ic_stats[0].period
    }
  })
}

const getTaskTypeName = (type: string) => {
  const map: Record<string, string> = {
    'single_factor': '单因子',
    'multi_factor': '多因子',
    'factor_compare': '因子对比'
  }
  return map[type] || type
}

const getStatusName = (status: string) => {
  const map: Record<string, string> = {
    'completed': '执行完成',
    'running': '正在执行',
    'pending': '等待执行',
    'failed': '执行失败'
  }
  return map[status] || status
}

// 股票池数据缓存
const stockPoolCache = ref<Map<string, string>>(new Map())

// 加载股票池列表（用于名称映射）
const loadStockPoolsForMapping = async () => {
  try {
    const result = await window.electronAPI.backtest.getStockPools()
    if (result.success && result.data) {
      const cache = new Map<string, string>()
      const data = result.data as any
      // 处理新格式（按维度分组），添加维度前缀
      if (data.index?.pools) {
        data.index.pools.forEach((p: any) => cache.set(p.id, p.name))
      }
      if (data.industry?.pools) {
        // 申万行业加前缀
        data.industry.pools.forEach((p: any) => cache.set(p.id, `申万-${p.name}`))
      }
      if (data.citic?.pools) {
        // 中信行业加前缀
        data.citic.pools.forEach((p: any) => cache.set(p.id, `中信-${p.name}`))
      }
      // 兼容旧格式
      if (Array.isArray(data)) {
        data.forEach((p: any) => cache.set(p.id, p.name))
      }
      stockPoolCache.value = cache
    }
  } catch (error) {
    console.error('加载股票池映射失败:', error)
  }
}

const getUniverseName = (universe: any) => {
  if (!universe) return '全市场'
  if (universe.type === 'custom') return '自定义股票池'
  
  const presetName = universe.preset_name
  // 先从缓存查找
  if (stockPoolCache.value.has(presetName)) {
    return stockPoolCache.value.get(presetName)
  }
  
  // 兜底映射
  const presetMap: Record<string, string> = {
    'all': '全市场',
    'hs300': '沪深300',
    'zz500': '中证500',
    'zz1000': '中证1000',
    'sz50': '上证50',
    'zz2000': '中证2000'
  }
  return presetMap[presetName] || presetName || '全市场'
}

// 基准指数缓存
const benchmarkCache = ref<Map<string, string>>(new Map())

// 加载基准指数映射
const loadBenchmarkMapping = async () => {
  try {
    const result = await window.electronAPI.backtest.getPriceTypeOptions()
    if (result.success && result.data?.benchmarks) {
      const cache = new Map<string, string>()
      result.data.benchmarks.forEach((b: any) => cache.set(b.value, b.label))
      benchmarkCache.value = cache
    }
  } catch (error) {
    console.error('加载基准指数映射失败:', error)
  }
}

// 获取基准指数名称列表
const getBenchmarkNames = (benchmarks: string[]) => {
  if (!benchmarks?.length) return '-'
  return benchmarks.map(code => {
    if (benchmarkCache.value.has(code)) {
      return benchmarkCache.value.get(code)
    }
    // 标准指数映射
    const standardMap: Record<string, string> = {
      'sh000001': '上证指数',
      'sh000300': '沪深300',
      'sh000905': '中证500',
      'sh000852': '中证1000',
      'sh000016': '上证50',
      'sz399001': '深证成指',
      'sz399006': '创业板指',
      'sh000688': '科创50',
      'csi2000': '中证2000',
      'SH.000300': '沪深300',
      'SH.000905': '中证500',
      'SH.000852': '中证1000',
      'SH.000688': '科创50'
    }
    if (standardMap[code]) return standardMap[code]
    // 指数行业格式：CSI500_医药生物 -> 中证500-医药生物
    if (code.includes('_')) {
      const [indexCode, industry] = code.split('_')
      const indexNames: Record<string, string> = {
        'SSE50': '上证50',
        'CSI300': '沪深300',
        'CSI500': '中证500',
        'CSI1000': '中证1000',
        'CSI2000': '中证2000'
      }
      return `${indexNames[indexCode] || indexCode}-${industry}`
    }
    return code
  }).join('、')
}

const getDirectionName = (direction: string) => {
  const map: Record<string, string> = {
    'positive': '正向',
    'negative': '负向',
    'auto': '自动'
  }
  return map[direction] || direction
}

const getBuyPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_open': '日线开盘价',
    'vwap_30min': '30分钟VWAP (9:30-10:00)',
    'vwap_60min': '60分钟VWAP (9:30-10:30)'
  }
  return map[type] || type
}

const getSellPriceTypeName = (type: string) => {
  const map: Record<string, string> = {
    'daily_close': '日线收盘价',
    'daily_vwap': '日线全天VWAP',
    'vwap_30min': '30分钟VWAP (14:30-15:00)',
    'vwap_60min': '60分钟VWAP (14:00-15:00)'
  }
  return map[type] || type
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

const calcDuration = (start: string, end: string) => {
  if (!start || !end) return '-'
  const duration = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  if (duration < 60) return `${duration}秒`
  if (duration < 3600) return `${Math.floor(duration / 60)}分${duration % 60}秒`
  return `${Math.floor(duration / 3600)}时${Math.floor((duration % 3600) / 60)}分`
}

const formatNumber = (num: number | undefined | null, decimals: number = 2) => {
  if (num === undefined || num === null || isNaN(num)) return '-'
  return num.toFixed(decimals)
}

const formatPercent = (num: number | undefined | null) => {
  if (num === undefined || num === null || isNaN(num)) return '-'
  return (num * 100).toFixed(2) + '%'
}

const getValueClass = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return ''
  return value > 0 ? 'positive' : value < 0 ? 'negative' : ''
}

const getMonotonicityClass = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return ''
  const abs = Math.abs(value)
  return abs > 0.5 ? 'positive' : abs < 0.3 ? 'negative' : ''
}

const getBarStyle = (value: number, allValues: number[]) => {
  const maxAbs = Math.max(...allValues.map(v => Math.abs(v)))
  if (maxAbs === 0) return { width: '0%' }
  const percent = Math.abs(value) / maxAbs * 100
  return { width: `${Math.min(percent, 100)}%` }
}

const loadCompletedTasks = async () => {
  listLoading.value = true
  try {
    const res = await window.electronAPI.backtest.getTasks({
      page: currentPage.value,
      page_size: pageSize.value,
      status: 'completed'
    })
    
    if (res.success && res.data) {
      completedTasks.value = res.data.tasks || []
      total.value = res.data.total || 0
    } else {
      ElMessage.error(res.error || '获取回测结果失败')
    }
  } catch (error: any) {
    ElMessage.error('获取回测结果失败: ' + error.message)
  } finally {
    listLoading.value = false
  }
}

const selectTask = (taskId: string) => {
  router.push(`/factor-library/backtest/result/${taskId}`)
}

const handleBack = () => {
  emit('back')
}

// 处理下载
const handleDownload = async (command: string) => {
  if (!props.taskId) return
  
  const [format, type] = command.split('-') as ['csv' | 'xlsx', 'summary' | 'daily' | 'all']
  
  // 获取当前选中的周期
  const currentPeriod = selectedPeriods.value[0] || 1
  
  downloading.value = true
  
  try {
    const downloadOptions: { format: 'csv' | 'xlsx'; type: 'summary' | 'daily' | 'all'; period?: number } = { 
      format, 
      type,
      period: currentPeriod  // 所有类型都传递周期参数
    }
    
    const result = await window.electronAPI.backtest.download(props.taskId, downloadOptions)
    
    if (result.success) {
      ElMessage.success(`文件已保存到: ${result.filePath}`)
    } else if (result.error !== '用户取消') {
      ElMessage.error(result.error || '下载失败')
    }
  } catch (error: any) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败: ' + (error.message || '未知错误'))
  } finally {
    downloading.value = false
  }
}

// 生成因子报告（全量多周期报告）
const handleGenerateReport = async () => {
  if (!props.taskId) return
  
  generatingReport.value = true
  
  try {
    // 报告自动包含所有预测周期，无需传递 period 参数
    const result = await window.electronAPI.backtest.report(props.taskId, {})
    
    if (result.success) {
      ElMessage.success(`报告已保存到: ${result.filePath}`)
    } else if (result.error !== '用户取消') {
      ElMessage.error(result.error || '生成报告失败')
    }
  } catch (error: any) {
    console.error('生成报告失败:', error)
    ElMessage.error('生成报告失败: ' + (error.message || '未知错误'))
  } finally {
    generatingReport.value = false
  }
}

const loadResult = async () => {
  if (!props.taskId) return
  
  detailLoading.value = true
  
  try {
    const detailRes = await window.electronAPI.backtest.getTaskDetail(props.taskId)
    
    if (detailRes.success && detailRes.data?.task) {
      task.value = detailRes.data.task
      
      if (task.value.status === 'completed') {
        const resultRes = await window.electronAPI.backtest.getResult(props.taskId)
        if (resultRes.success && resultRes.data) {
          result.value = resultRes.data
          initPeriodSelections()
          // 单独加载每日明细数据
          loadDailyMetrics()
        }
      }
    } else {
      ElMessage.error(detailRes.error || '获取任务详情失败')
    }
  } catch (error: any) {
    ElMessage.error('获取数据失败: ' + error.message)
  } finally {
    detailLoading.value = false
  }
}

// 加载每日明细数据
const loadDailyMetrics = async () => {
  if (!props.taskId) return
  
  dailyMetricsLoading.value = true
  
  try {
    const res = await window.electronAPI.backtest.getDailyMetrics(props.taskId, {
      page: dailyMetricsPage.value,
      page_size: dailyMetricsPageSize.value
    })
    
    if (res.success && res.data) {
      dailyMetrics.value = res.data.metrics || []
      dailyMetricsTotal.value = res.data.total || 0
    }
  } catch (error: any) {
    console.error('加载每日明细失败:', error)
  } finally {
    dailyMetricsLoading.value = false
  }
}

// 加载更多每日明细
const loadMoreDailyMetrics = async () => {
  if (!props.taskId || dailyMetricsLoading.value) return
  if (dailyMetrics.value.length >= dailyMetricsTotal.value) return
  
  dailyMetricsPage.value++
  dailyMetricsLoading.value = true
  
  try {
    const res = await window.electronAPI.backtest.getDailyMetrics(props.taskId, {
      page: dailyMetricsPage.value,
      page_size: dailyMetricsPageSize.value
    })
    
    if (res.success && res.data?.metrics) {
      dailyMetrics.value = [...dailyMetrics.value, ...res.data.metrics]
    }
  } catch (error: any) {
    console.error('加载更多每日明细失败:', error)
  } finally {
    dailyMetricsLoading.value = false
  }
}

watch(() => props.taskId, (newId) => {
  if (newId) {
    // 重置每日明细状态
    dailyMetrics.value = []
    dailyMetricsTotal.value = 0
    dailyMetricsPage.value = 1
    loadResult()
  } else {
    task.value = null
    result.value = null
    dailyMetrics.value = []
    dailyMetricsTotal.value = 0
    dailyMetricsPage.value = 1
    loadCompletedTasks()
  }
}, { immediate: true })

onMounted(() => {
  if (!props.taskId) {
    loadCompletedTasks()
  }
  window.addEventListener('resize', handleResize)
  // 加载股票池和基准指数映射
  loadStockPoolsForMapping()
  loadBenchmarkMapping()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (excessReturnChart) {
    excessReturnChart.dispose()
    excessReturnChart = null
  }
})
</script>

<style scoped lang="scss">
// ============================================
// 设计系统变量 - 清新明亮的 SaaS 风格
// ============================================
$primary: #4F86F7;           // 明亮蓝主色（更清新）
$primary-light: #60A5FA;     // 天蓝次色
$primary-lighter: #EFF6FF;   // 极浅蓝背景
$primary-soft: #BFDBFE;      // 柔和蓝
$accent: #F59E0B;            // 琥珀高亮 CTA
$accent-light: #FEF3C7;      // 浅琥珀背景
$positive: #22C55E;          // 明亮绿正值
$positive-light: #DCFCE7;    // 浅绿背景
$negative: #F43F5E;          // 玫红负值（比红色柔和）
$negative-light: #FFE4E6;    // 浅粉背景
$bg-page: #FAFBFD;           // 页面背景（近白）
$bg-card: #FFFFFF;           // 卡片背景
$bg-muted: #F8FAFC;          // 次要背景（更浅）
$border: #E5E7EB;            // 边框色（更柔和）
$border-light: #F3F4F6;      // 浅边框
$text-primary: #1F2937;      // 主文字（稍浅）
$text-secondary: #6B7280;    // 次要文字
$text-muted: #9CA3AF;        // 弱化文字
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
$shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
$shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
$radius-sm: 6px;
$radius-md: 10px;
$radius-lg: 14px;
$font-mono: 'Fira Code', 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
$transition-fast: 150ms ease;
$transition-normal: 250ms cubic-bezier(0.4, 0, 0.2, 1);

.result-content {
  background: $bg-page;
  min-height: 100%;
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid $border;
    
    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: $text-primary;
      letter-spacing: -0.025em;
    }
  }

  // 任务卡片列表 - 现代化设计
  .task-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    
    .task-card {
      background: $bg-card;
      border: 1px solid $border;
      border-radius: $radius-lg;
      padding: 20px;
      cursor: pointer;
      transition: all $transition-normal;
      position: relative;
      overflow: hidden;
      
      // 顶部装饰条
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, $primary, $primary-light);
        opacity: 0;
        transition: opacity $transition-normal;
      }
      
      &:hover {
        border-color: $primary-light;
        box-shadow: $shadow-lg;
        transform: translateY(-4px);
        
        &::before {
          opacity: 1;
        }
        
        .card-footer .el-button {
          color: $primary;
        }
      }
      
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        
        .task-name {
          font-weight: 600;
          font-size: 15px;
          color: $text-primary;
          flex: 1;
          margin-right: 12px;
          line-height: 1.4;
        }
        
        :deep(.el-tag) {
          background: $primary-lighter;
          border-color: transparent;
          color: $primary;
          font-weight: 500;
        }
      }
      
      .card-body {
        .card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: $text-secondary;
          margin-bottom: 8px;
          
          .el-icon {
            font-size: 15px;
            color: $text-muted;
          }
        }
      }
      
      .card-footer {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid $border-light;
        text-align: right;
        
        .el-button {
          color: $text-secondary;
          font-weight: 500;
          transition: color $transition-fast;
        }
      }
    }
  }

  // 详情页头部
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding: 16px 20px;
    background: $bg-card;
    border-radius: $radius-lg;
    box-shadow: $shadow-sm;
    
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      
      .el-button--primary {
        background: $primary;
        border-color: $primary;
        
        &:hover {
          background: $primary-light;
          border-color: $primary-light;
        }
      }
      
      .el-button--success {
        background: $positive;
        border-color: $positive;
      }
    }
  }
  
  .loading-wrapper {
    text-align: center;
    padding: 100px 40px;
    color: $text-muted;
    
    .el-icon {
      color: $primary-light;
    }
    
    p { 
      margin-top: 20px;
      font-size: 15px;
    }
  }
  
  .error-section {
    margin-bottom: 24px;
    
    .error-content {
      margin-top: 12px;
      
      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.7;
        color: $negative;
        word-break: break-all;
      }
    }
    
    :deep(.el-alert) {
      border-radius: $radius-md;
      border: 1px solid $negative-light;
      
      .el-alert__title {
        font-size: 16px;
        font-weight: 600;
      }
    }
    
    .failed-factor-info {
      margin-top: 24px;
      
      .factor-expression-card {
        background: $bg-card;
        border: 1px solid $border;
        border-radius: $radius-lg;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: $shadow-sm;
        
        .card-title {
          font-size: 15px;
          font-weight: 600;
          color: $text-primary;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          
          &::before {
            content: '';
            display: inline-block;
            width: 4px;
            height: 20px;
            background: linear-gradient(180deg, $primary 0%, $primary-light 100%);
            border-radius: 2px;
          }
        }
        
        .card-content {
          code {
            display: block;
            background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
            border: none;
            border-radius: $radius-md;
            padding: 20px 24px;
            font-family: $font-mono;
            font-size: 14px;
            line-height: 1.8;
            color: #E2E8F0;
            word-break: break-all;
            white-space: pre-wrap;
            letter-spacing: 0.3px;
          }
          
          pre {
            margin: 0;
            background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
            border: none;
            border-radius: $radius-md;
            padding: 20px 24px;
            font-family: $font-mono;
            font-size: 13px;
            line-height: 1.8;
            color: #E2E8F0;
            white-space: pre-wrap;
            word-break: break-all;
            max-height: 400px;
            overflow-y: auto;
            
            &::-webkit-scrollbar {
              width: 8px;
            }
            &::-webkit-scrollbar-track {
              background: #1E293B;
              border-radius: 4px;
            }
            &::-webkit-scrollbar-thumb {
              background: #475569;
              border-radius: 4px;
              
              &:hover {
                background: #64748B;
              }
            }
          }
        }
      }
    }
  }
  
  // 信息横幅 - 专业深蓝渐变
  .info-banner {
    background: linear-gradient(135deg, $primary 0%, #1E3A8A 50%, #312E81 100%);
    border-radius: $radius-lg;
    padding: 28px 32px;
    color: #fff;
    margin-bottom: 28px;
    box-shadow: $shadow-lg;
    position: relative;
    overflow: hidden;
    
    // 装饰图案
    &::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      pointer-events: none;
    }
    
    .banner-main {
      position: relative;
      z-index: 1;
      
      .banner-top {
        margin-bottom: 20px;
        
        h2 {
          margin: 0 0 14px 0;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.025em;
        }
      }
      
      .banner-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        font-size: 14px;
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: $radius-sm;
          font-weight: 600;
          backdrop-filter: blur(4px);
          
          &.completed { 
            background: rgba($positive, 0.3);
          }
          &.running { 
            background: rgba($accent, 0.3);
          }
        }
        
        .meta-divider {
          opacity: 0.4;
          color: #fff;
        }
        
        .task-id-text {
          font-family: $font-mono;
          font-size: 12px;
          opacity: 0.75;
          background: rgba(255,255,255,0.1);
          padding: 4px 10px;
          border-radius: $radius-sm;
        }
      }
      
      .banner-config {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        padding-top: 20px;
        margin-top: 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.15);
        
        .config-item {
          display: flex;
          align-items: center;
          gap: 10px;
          
          .config-label {
            font-size: 13px;
            opacity: 0.75;
          }
          
          .config-value {
            font-size: 14px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.15);
            padding: 5px 12px;
            border-radius: $radius-sm;
            backdrop-filter: blur(4px);
          }
        }
      }
    }
  }

  // 因子结果区域 - 现代卡片设计
  .factor-result-section {
    background: $bg-card;
    border: 1px solid $border;
    border-radius: $radius-lg;
    padding: 28px;
    margin-bottom: 28px;
    box-shadow: $shadow-sm;
    transition: box-shadow $transition-normal;
    
    &:hover {
      box-shadow: $shadow-md;
    }
    
    .factor-header {
      margin-bottom: 24px;
      
      .factor-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 12px;
        
        h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: $text-primary;
          letter-spacing: -0.025em;
        }
        
        .period-selector {
          display: flex;
          align-items: center;
          gap: 14px;
          
          .period-label {
            font-size: 13px;
            color: $text-secondary;
            font-weight: 500;
          }
          
          .period-tabs {
            display: flex;
            background: $bg-muted;
            border-radius: $radius-md;
            padding: 4px;
            
            .period-tab {
              padding: 8px 18px;
              font-size: 13px;
              color: $text-secondary;
              cursor: pointer;
              border-radius: $radius-sm;
              transition: all $transition-fast;
              font-weight: 500;
              
              &:hover {
                color: $primary;
                background: rgba($primary, 0.05);
              }
              
              &.active {
                background: $bg-card;
                color: $primary;
                box-shadow: $shadow-sm;
                font-weight: 600;
              }
            }
          }
        }
      }
      
      .factor-code {
        code {
          background: $bg-muted;
          padding: 8px 14px;
          border-radius: $radius-sm;
          font-family: $font-mono;
          font-size: 13px;
          color: $text-secondary;
          display: inline-block;
          max-width: 100%;
          overflow-x: auto;
          white-space: nowrap;
          border: 1px solid $border;
        }
      }
    }
  }

  // 核心指标卡片 - 专业仪表板风格
  .metrics-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
    
    .metric-card {
      background: $bg-card;
      border: 1px solid $border;
      border-radius: $radius-md;
      padding: 20px 16px;
      text-align: center;
      transition: all $transition-normal;
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: $border;
        transition: background $transition-normal;
      }
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: $shadow-md;
        border-color: $primary-light;
        
        &::before {
          background: $primary-light;
        }
      }
      
      &.ic-metric {
        background: linear-gradient(135deg, #EFF6FF 0%, $bg-card 100%);
        border-color: $primary-lighter;
        
        &::before {
          background: linear-gradient(90deg, $primary, $primary-light);
        }
      }
      
      .metric-value {
        font-size: 22px;
        font-weight: 700;
        font-family: $font-mono;
        color: $text-primary;
        margin-bottom: 6px;
        letter-spacing: -0.025em;
        
        &.positive { 
          color: $positive;
        }
        &.negative { 
          color: $negative;
        }
      }
      
      .metric-label {
        font-size: 12px;
        color: $text-muted;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }
  }

  // 详细面板 - 清晰分区
  .detail-panels {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;
    margin-bottom: 24px;
    
    .detail-panel {
      background: $bg-card;
      border: 1px solid $border;
      border-radius: $radius-lg;
      overflow: hidden;
      box-shadow: $shadow-sm;
      
      .panel-title {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 20px;
        background: $bg-muted;
        font-size: 14px;
        font-weight: 600;
        color: $text-primary;
        border-bottom: 1px solid $border;
        
        .el-icon {
          color: $primary;
          font-size: 18px;
        }
        
        // 年化/累计切换按钮
        .return-type-switch {
          margin-left: auto;
          
          :deep(.el-radio-group) {
            .el-radio-button__inner {
              padding: 6px 14px;
              font-size: 12px;
              font-weight: 500;
              border-color: $border;
              background: $bg-card;
              color: $text-secondary;
            }
            
            .el-radio-button__original-radio:checked + .el-radio-button__inner {
              background: $primary;
              border-color: $primary;
              color: #fff;
              box-shadow: none;
            }
          }
        }
      }
      
      .panel-body {
        padding: 20px;
        
        .table-hint {
          text-align: center;
          font-size: 12px;
          color: $text-muted;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed $border;
        }
        
        :deep(.selected-row) {
          background-color: $primary-lighter !important;
          
          td {
            background-color: $primary-lighter !important;
          }
        }
        
        .period-active {
          color: $primary;
          font-weight: 600;
        }
      }
    }
  }

  // 分层收益图表 - 可视化增强
  .layer-returns-chart {
    .layer-bar-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      padding: 4px 0;
      transition: background $transition-fast;
      border-radius: $radius-sm;
      
      &:hover {
        background: $bg-muted;
        margin: 0 -8px;
        padding: 4px 8px;
        margin-bottom: 10px;
      }
      
      .layer-label {
        width: 44px;
        font-size: 13px;
        color: $text-secondary;
        text-align: right;
        font-weight: 500;
      }
      
      .layer-bar-container {
        flex: 1;
        height: 24px;
        background: $bg-muted;
        border-radius: $radius-sm;
        overflow: hidden;
      }
      
      .layer-bar {
        height: 100%;
        border-radius: $radius-sm;
        transition: width 0.4s ease-out;
        
        &.positive {
          background: linear-gradient(90deg, $positive, #34D399);
        }
        
        &.negative {
          background: linear-gradient(90deg, $negative, #F87171);
        }
      }
      
      .layer-value {
        width: 80px;
        font-size: 13px;
        font-family: $font-mono;
        text-align: right;
        font-weight: 600;
        
        &.positive { color: $positive; }
        &.negative { color: $negative; }
      }
    }
  }

  // 其他指标 - 清晰布局
  .other-metrics {
    .other-metric-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid $border-light;
      transition: background $transition-fast;
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background: $bg-muted;
        margin: 0 -12px;
        padding: 12px;
        border-radius: $radius-sm;
      }
      
      // ic-related 不再有特殊样式，完全统一
      &.ic-related {
        // 继承默认样式，无需额外设置
      }
      
      .label {
        font-size: 13px;
        color: $text-secondary;
        font-weight: 500;
      }
      
      .value {
        font-size: 15px;
        font-weight: 600;
        font-family: $font-mono;
        color: $text-primary;
        
        &.positive { color: $positive; }
        &.negative { color: $negative; }
      }
    }
  }
  
  .period-tag {
    font-size: 12px;
    font-weight: 500;
    color: $primary;
    background: $primary-lighter;
    padding: 2px 8px;
    border-radius: $radius-sm;
    margin-left: 8px;
  }

  // 每日明细折叠 - 整洁设计
  .daily-collapse {
    margin-top: 24px;
    background: $bg-card;
    border: 1px solid $border;
    border-radius: $radius-lg;
    overflow: hidden;
    box-shadow: $shadow-sm;
    
    :deep(.el-collapse-item__header) {
      padding: 0 24px;
      height: 56px;
      background: $bg-muted;
      border-bottom: 1px solid $border;
      
      &:hover {
        background: darken($bg-muted, 2%);
      }
    }
    
    :deep(.el-collapse-item__content) {
      padding: 20px 24px 0;
    }
    
    .collapse-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 600;
      color: $text-primary;
      
      .el-icon {
        color: $primary;
        font-size: 18px;
      }
    }
    
    .daily-metrics-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      margin: 20px -24px 0;
      background: $bg-muted;
      border-top: 1px solid $border;
      
      .loaded-info {
        font-size: 13px;
        color: $text-secondary;
        font-weight: 500;
      }
    }
    
    .more-hint {
      text-align: center;
      padding: 16px;
      font-size: 13px;
      color: $text-muted;
    }
  }
  
  .pagination-wrapper {
    margin-top: 24px;
    display: flex;
    justify-content: center;
    
    :deep(.el-pagination) {
      --el-pagination-button-bg-color: #{$bg-card};
      --el-pagination-hover-color: #{$primary};
    }
  }
  
  // 全局样式
  .positive { color: $positive !important; }
  .negative { color: $negative !important; }
  
  // 基准指数对比表格样式
  .benchmark-table {
    :deep(.el-table__header) {
      th {
        background: $bg-muted !important;
        font-weight: 600;
        font-size: 13px;
        color: $text-primary;
        border-bottom: 2px solid $border !important;
      }
    }
    
    :deep(.el-table__body) {
      td {
        font-size: 13px;
        font-family: $font-mono;
        
        &:first-child {
          font-weight: 600;
          color: $text-primary;
          font-family: inherit;
        }
      }
    }
    
    :deep(.el-table__row) {
      transition: background $transition-fast;
      
      &:hover > td {
        background: $primary-lighter !important;
      }
    }
  }
  
  // 超额收益曲线图预览区
  .chart-preview {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px;
    background: $bg-muted;
    border-radius: $radius-md;
    
    .el-button {
      background: $primary;
      border-color: $primary;
      
      &:hover {
        background: $primary-light;
        border-color: $primary-light;
      }
    }
    
    .chart-hint {
      color: $text-secondary;
      font-size: 13px;
    }
  }
}

// 超额收益曲线图对话框
.excess-return-chart-dialog {
  width: 100%;
  height: 520px;
  background: $bg-card;
  border-radius: $radius-md;
}

.chart-legend-hint {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid $border;
  color: $text-secondary;
  font-size: 13px;
  
  b {
    color: $text-primary;
  }
  
  .data-count {
    color: $text-muted;
    background: $bg-muted;
    padding: 4px 12px;
    border-radius: $radius-sm;
  }
}

// 分组选择器分隔条 - 视觉分区
.group-selector-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 32px 0 24px;
  padding: 14px 24px;
  background: linear-gradient(135deg, $bg-muted 0%, $bg-card 100%);
  border-radius: $radius-lg;
  border: 1px solid $border;
  
  .bar-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, $border 50%, transparent);
  }
  
  .bar-title {
    font-size: 15px;
    font-weight: 700;
    color: $primary;
    white-space: nowrap;
    letter-spacing: -0.025em;
  }
  
  .bar-selector {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px;
    background: $bg-card;
    border-radius: $radius-md;
    box-shadow: $shadow-sm;
    border: 1px solid $border;
    
    .selector-label {
      font-size: 13px;
      color: $text-secondary;
      white-space: nowrap;
      font-weight: 500;
    }
    
    :deep(.el-select) {
      .el-input__wrapper {
        box-shadow: none !important;
        background: $bg-muted;
        border-radius: $radius-sm;
      }
    }
  }
  
  .bar-hint {
    font-size: 12px;
    color: $text-muted;
    white-space: nowrap;
    background: $accent-light;
    padding: 4px 12px;
    border-radius: $radius-sm;
    color: darken($accent, 15%);
  }
}

// 面板标签
.panel-tag {
  margin-left: 10px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: $primary;
  background: $primary-lighter;
  border-radius: $radius-sm;
}

// Element Plus 组件覆盖
:deep(.el-button) {
  border-radius: $radius-sm;
  font-weight: 500;
  transition: all $transition-fast;
}

:deep(.el-tag) {
  border-radius: $radius-sm;
  font-weight: 500;
}

:deep(.el-table) {
  --el-table-border-color: #{$border};
  --el-table-header-bg-color: #{$bg-muted};
  border-radius: $radius-md;
  overflow: hidden;
  
  th.el-table__cell {
    font-weight: 600;
    color: $text-primary;
  }
  
  td.el-table__cell {
    color: $text-secondary;
  }
}

:deep(.el-card) {
  border-radius: $radius-lg;
  border-color: $border;
  box-shadow: $shadow-sm;
}

:deep(.el-dialog) {
  border-radius: $radius-lg;
  
  .el-dialog__header {
    border-bottom: 1px solid $border;
    padding: 20px 24px;
    
    .el-dialog__title {
      font-weight: 600;
      color: $text-primary;
    }
  }
  
  .el-dialog__body {
    padding: 24px;
  }
}
</style>
