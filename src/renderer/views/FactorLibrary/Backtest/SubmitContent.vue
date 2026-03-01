<template>
  <div class="submit-content">
    <el-form 
      ref="formRef" 
      :model="formData" 
      :rules="formRules" 
      label-width="100px"
      label-position="right"
      class="submit-form"
    >
      <!-- 两列布局 -->
      <el-row :gutter="24">
        <!-- 左侧列 -->
        <el-col :span="12">
          <!-- 基本信息 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Document /></el-icon>
              <span>基本信息</span>
            </div>
            <div class="section-body">
              <el-form-item label="任务名称" prop="task_name">
                <el-input 
                  v-model="formData.task_name" 
                  placeholder="请输入任务名称"
                  maxlength="50"
                  show-word-limit
                />
              </el-form-item>
            </div>
          </div>

          <!-- 因子配置 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><DataAnalysis /></el-icon>
              <span>因子配置</span>
            </div>
            <div class="section-body">
              <el-form-item label="因子来源">
                <el-segmented v-model="factorSource" :options="factorSourceOptions" @change="onFactorSourceChange" />
              </el-form-item>
              
              <!-- 方式1: 因子表达式 -->
              <el-form-item v-if="factorSource === 'expression'" label="因子表达式">
                <el-input
                  v-model="formData.factor_expression"
                  type="textarea"
                  :rows="3"
                  placeholder="例如: close/open - 1"
                />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  支持字段由数据源配置决定
                </div>
              </el-form-item>
              
              <!-- 方式2: Python代码 -->
              <template v-else-if="factorSource === 'code'">
                <el-form-item label="Python代码">
                  <el-input
                    v-model="formData.factor_code"
                    type="textarea"
                    :rows="10"
                    placeholder="def calculate_factor(data):
    stock_daily = data['stock_daily']
    return stock_daily['close'] / stock_daily['open'] - 1

# 回测引擎会自动识别入口函数，函数名随意"
                    class="code-textarea"
                    @input="onCodeContentChange"
                  />
                </el-form-item>
                <!-- 代码检查结果 -->
                <div v-if="Object.keys(codeCheckResult).length > 0" class="code-check-panel">
                  <div class="code-check-header">
                    <el-icon><Warning v-if="hasCodeCheckError" /><CircleCheck v-else /></el-icon>
                    <span>代码检查</span>
                    <el-button 
                      type="primary" 
                      size="small" 
                      :loading="codeChecking"
                      @click="runCodeCheck"
                    >
                      重新检查
                    </el-button>
                    <el-button 
                      v-if="canAutoConfig" 
                      :type="hasCodeCheckError ? 'info' : 'success'" 
                      size="small" 
                      :disabled="hasCodeCheckError"
                      @click="autoConfigDataSources"
                    >
                      {{ hasCodeCheckError ? '存在错误，无法自动配置' : '自动配置数据源' }}
                    </el-button>
                  </div>
                  <div class="code-check-body">
                    <div v-for="(info, tableName) in codeCheckResult" :key="tableName" class="check-item">
                      <div class="check-table">
                        <el-icon :class="info.tableExists ? 'success' : 'error'">
                          <CircleCheck v-if="info.tableExists" /><CircleClose v-else />
                        </el-icon>
                        <span class="table-name">{{ tableName }}</span>
                        <el-tag v-if="info.tableExists" size="small" type="info">{{ info.database }}</el-tag>
                        <el-tag v-else size="small" type="danger">表不存在</el-tag>
                      </div>
                      <div v-if="info.fields && info.fields.length > 0" class="check-fields">
                        <span class="fields-label">字段: </span>
                        <el-tag 
                          v-for="field in info.fields" 
                          :key="field.name"
                          size="small"
                          :type="field.exists ? 'success' : 'danger'"
                          style="margin: 2px;"
                        >
                          {{ field.name }}
                          <el-icon style="margin-left: 2px;">
                            <Check v-if="field.exists" /><Close v-else />
                          </el-icon>
                        </el-tag>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="code-hint">
                  <el-icon><InfoFilled /></el-icon>
                  <span>粘贴代码后自动检查表和字段是否存在，key 是表名（如 <code>data['stock_daily']</code>）</span>
                </div>
              </template>
            </div>
          </div>

          <!-- 回测时间 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Calendar /></el-icon>
              <span>回测时间</span>
            </div>
            <div class="section-body">
              <el-form-item label="时间范围">
                <el-date-picker
                  v-model="dateRange"
                  type="daterange"
                  range-separator="~"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  :shortcuts="dateShortcuts"
                  style="width: 100%;"
                />
              </el-form-item>
            </div>
          </div>

          <!-- 数据源配置 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Connection /></el-icon>
              <span>数据源配置</span>
              <div class="header-actions">
                <el-dropdown @command="handleAddDataSource">
                  <el-button type="primary" size="small" text :icon="Plus">
                    添加数据源
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="normal">
                        <el-icon><Document /></el-icon>
                        日频数据源
                      </el-dropdown-item>
                      <el-dropdown-item command="intraday">
                        <el-icon><Clock /></el-icon>
                        日内时段筛选数据源
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            <div class="section-body">
              <div v-for="(ds, index) in formData.data_sources" :key="index" class="datasource-item" :class="{ 'intraday-mode': ds.mode === 'intraday' }">
                <div class="datasource-header">
                  <span class="datasource-title">
                    数据源 {{ index + 1 }}: {{ ds.table || '未选择' }}
                  </span>
                  <el-tag 
                    :type="ds.mode === 'intraday' ? 'warning' : 'info'" 
                    size="small"
                    effect="plain"
                  >
                    {{ ds.mode === 'intraday' ? '日内时段筛选' : '日频数据' }}
                  </el-tag>
                  <el-button 
                    v-if="formData.data_sources.length > 1"
                    type="danger" 
                    size="small" 
                    text 
                    :icon="Delete"
                    @click="removeDataSource(index)"
                  />
                </div>
                
                <!-- 表名搜索 -->
                <el-form-item label="选择表" label-width="70px">
                  <el-button 
                    type="primary" 
                    plain 
                    @click="openSearchDialog(index)"
                  >
                    <el-icon><Search /></el-icon>
                    搜索数据表
                  </el-button>
                </el-form-item>
                <!-- 已选表信息 -->
                <div v-if="ds.table" class="selected-table-info">
                  <el-tag type="success" effect="light" closable @close="clearSelectedTable(index)">
                    {{ ds.table }}
                  </el-tag>
                  <el-tag type="info">{{ ds.database }}</el-tag>
                </div>
                <!-- 字段选择 -->
                <el-form-item label="字段" label-width="70px">
                  <el-select 
                    v-model="ds.fields" 
                    multiple 
                    filterable
                    placeholder="选择字段"
                    style="width: 100%;"
                    :loading="fieldListLoading[index]"
                  >
                    <el-option 
                      v-for="f in getFieldList(index)" 
                      :key="f.column_name" 
                      :label="f.column_name" 
                      :value="f.column_name"
                    >
                      <span>{{ f.column_name }}</span>
                      <span v-if="f.column_comment" class="field-desc">{{ f.column_comment }}</span>
                    </el-option>
                  </el-select>
                </el-form-item>
                <div class="date-code-row">
                  <div class="field-item">
                    <span class="field-label"><span class="required">*</span>日期字段</span>
                    <el-select v-model="ds.date_field" filterable placeholder="必选">
                      <el-option 
                        v-for="f in getFieldList(index)" 
                        :key="f.column_name" 
                        :label="f.column_name" 
                        :value="f.column_name" 
                      />
                    </el-select>
                  </div>
                  <div class="field-item">
                    <span class="field-label"><span class="required">*</span>代码字段</span>
                    <el-select v-model="ds.code_field" filterable placeholder="必选">
                      <el-option 
                        v-for="f in getFieldList(index)" 
                        :key="f.column_name" 
                        :label="f.column_name" 
                        :value="f.column_name" 
                      />
                    </el-select>
                  </div>
                </div>
                
                <!-- 时段筛选配置（仅 intraday 模式显示） -->
                <template v-if="ds.mode === 'intraday'">
                  <div class="time-filter-section">
                    <!-- 时间字段选择 -->
                    <div class="time-field-row">
                      <span class="field-label"><span class="required">*</span>时间字段</span>
                      <el-select 
                        v-model="ds.time_field" 
                        filterable 
                        placeholder="选择时间字段（如 trade_time）"
                        style="width: 200px;"
                      >
                        <el-option 
                          v-for="f in getFieldList(index)" 
                          :key="f.column_name" 
                          :label="f.column_name" 
                          :value="f.column_name"
                        >
                          <span>{{ f.column_name }}</span>
                          <span v-if="f.column_comment" class="field-desc">{{ f.column_comment }}</span>
                        </el-option>
                      </el-select>
                    </div>
                    
                    <!-- 快捷预设按钮 -->
                    <div v-if="timeFilterPresets.length > 0" class="time-presets">
                      <span class="presets-label">快捷选择：</span>
                      <div class="presets-buttons">
                        <el-button
                          v-for="preset in timeFilterPresets"
                          :key="preset.value"
                          size="small"
                          :type="isPresetActive(index, preset) ? 'primary' : 'default'"
                          @click="onPresetClick(index, preset)"
                        >
                          {{ preset.label }}
                        </el-button>
                      </div>
                    </div>
                    
                    <!-- 时间范围 -->
                    <div class="time-range-row">
                      <span class="field-label"><span class="required">*</span>时间范围</span>
                      <div class="time-range-inputs">
                        <el-input
                          v-model="ds.time_start"
                          placeholder="09:30"
                          style="width: 100px;"
                          maxlength="5"
                        />
                        <span class="range-separator">~</span>
                        <el-input
                          v-model="ds.time_end"
                          placeholder="10:00"
                          style="width: 100px;"
                          maxlength="5"
                        />
                      </div>
                    </div>
                    
                    <!-- 提示信息 -->
                    <div class="time-filter-hint">
                      <el-icon><InfoFilled /></el-icon>
                      <span>分钟级数据将按指定时段筛选后，自动聚合为日频数据</span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </el-col>

        <!-- 右侧列 -->
        <el-col :span="12">
          <!-- 股票池配置 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Grid /></el-icon>
              <span>股票池配置</span>
            </div>
            <div class="section-body stock-pool-section">
              <!-- Tab 切换 -->
              <el-tabs v-model="stockPoolTab" @tab-change="handleStockPoolTabChange" class="stock-pool-tabs">
                <el-tab-pane label="标准指数维度" name="index">
                  <div class="pool-radio-group" v-loading="stockPoolsLoading">
                    <el-radio-group v-model="formData.universe.preset_name" class="pool-radio-list">
                      <el-radio 
                        v-for="pool in stockPoolData?.index?.pools || []" 
                        :key="pool.id" 
                        :value="pool.id"
                        class="pool-radio-item"
                      >
                        {{ pool.name }} <span class="pool-date">({{ pool.start_date }}起)</span>
                      </el-radio>
                    </el-radio-group>
                  </div>
                </el-tab-pane>
                <el-tab-pane label="申万行业维度" name="industry">
                  <div class="pool-radio-group" v-loading="stockPoolsLoading">
                    <el-radio-group v-model="formData.universe.preset_name" class="pool-radio-grid">
                      <el-radio 
                        v-for="pool in stockPoolData?.industry?.pools || []" 
                        :key="pool.id" 
                        :value="pool.id"
                        class="pool-radio-item"
                      >
                        {{ pool.name }}
                      </el-radio>
                    </el-radio-group>
                    <el-empty v-if="!stockPoolData?.industry?.pools?.length && !stockPoolsLoading" description="暂无行业数据" :image-size="60" />
                  </div>
                </el-tab-pane>
                <el-tab-pane label="自定义" name="custom">
                  <div class="custom-upload-area">
                    <el-upload
                      :auto-upload="false"
                      :show-file-list="false"
                      accept=".csv,.xlsx,.xls"
                      :on-change="handleStockFileChange"
                      drag
                    >
                      <el-icon class="el-icon--upload"><Upload /></el-icon>
                      <div class="el-upload__text">拖拽文件到此处，或 <em>点击上传</em></div>
                      <template #tip>
                        <div class="el-upload__tip">支持 CSV/Excel，第一列为 stock_code</div>
                      </template>
                    </el-upload>
                    <div v-if="formData.universe.custom_file" class="uploaded-file">
                      <el-tag closable @close="formData.universe.custom_file = null" size="large">
                        {{ formData.universe.custom_file.filename }}
                      </el-tag>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </div>

          <!-- 回测参数 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Setting /></el-icon>
              <span>回测参数</span>
            </div>
            <div class="section-body">
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="分组数">
                    <el-input-number v-model="formData.backtest_params.num_groups" :min="2" :max="20" style="width: 100%;" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="因子方向">
                    <el-select v-model="formData.backtest_params.factor_direction" style="width: 100%;">
                      <el-option label="自动判断" value="auto" />
                      <el-option label="正向（值大=好）" value="positive" />
                      <el-option label="负向（值小=好）" value="negative" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              
              <el-form-item label="预测周期">
                <el-select v-model="formData.backtest_params.forward_periods" multiple style="width: 100%;">
                  <el-option label="1日" :value="1" />
                  <el-option label="5日" :value="5" />
                  <el-option label="10日" :value="10" />
                  <el-option label="20日" :value="20" />
                  <el-option label="60日" :value="60" />
                </el-select>
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  计算因子与未来第N日收益的相关性
                </div>
              </el-form-item>
              
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="买入价格">
                    <el-select v-model="formData.backtest_params.buy_price_type" style="width: 100%;">
                      <el-option 
                        v-for="opt in buyPriceTypes" 
                        :key="opt.value" 
                        :label="opt.label" 
                        :value="opt.value" 
                      />
                    </el-select>
                    <div class="form-hint">
                      <el-icon><InfoFilled /></el-icon>
                      T+1日买入价格，VWAP模拟大资金分批建仓
                    </div>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="卖出价格">
                    <el-select v-model="formData.backtest_params.sell_price_type" style="width: 100%;">
                      <el-option 
                        v-for="opt in sellPriceTypes" 
                        :key="opt.value" 
                        :label="opt.label" 
                        :value="opt.value" 
                      />
                    </el-select>
                    <div class="form-hint">
                      <el-icon><InfoFilled /></el-icon>
                      T+1+N日卖出价格，VWAP模拟大资金分批出货
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>
              
              <el-form-item label="基准指数">
                <el-tabs v-model="benchmarkTab" class="benchmark-tabs">
                  <!-- 标准指数 Tab -->
                  <el-tab-pane label="标准指数" name="standard">
                    <el-checkbox-group v-model="selectedBenchmarks" class="benchmark-checkbox-group">
                      <el-checkbox 
                        v-for="opt in standardIndexes" 
                        :key="opt.value" 
                        :label="opt.value"
                      >
                        {{ opt.label }}
                      </el-checkbox>
                    </el-checkbox-group>
                  </el-tab-pane>
                  <!-- 指数行业 Tab -->
                  <el-tab-pane label="指数行业" name="industry">
                    <el-tabs v-model="industryIndexTab" type="card" class="industry-sub-tabs">
                      <el-tab-pane 
                        v-for="idx in indexList" 
                        :key="idx.code" 
                        :label="idx.label" 
                        :name="idx.code"
                      >
                        <el-checkbox-group v-model="selectedBenchmarks" class="benchmark-checkbox-group industry-grid">
                          <el-checkbox 
                            v-for="opt in (indexIndustries[idx.code] || [])" 
                            :key="opt.value" 
                            :label="opt.value"
                          >
                            {{ opt.industry }}
                          </el-checkbox>
                        </el-checkbox-group>
                      </el-tab-pane>
                    </el-tabs>
                  </el-tab-pane>
                </el-tabs>
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  选择基准指数计算超额收益，可多选，不选则不计算超额
                </div>
                <div v-if="selectedBenchmarks.length > 0" class="selected-benchmarks-list">
                  <span class="selected-label">已选 ({{ selectedBenchmarks.length }})：</span>
                  <el-tag 
                    v-for="bm in selectedBenchmarks" 
                    :key="bm" 
                    size="small" 
                    closable 
                    @close="removeBenchmark(bm)"
                    style="margin: 2px 4px 2px 0;"
                  >
                    {{ getBenchmarkLabel(bm) }}
                  </el-tag>
                </div>
              </el-form-item>
            </div>
          </div>

          <!-- 计算选项 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><TrendCharts /></el-icon>
              <span>分析指标</span>
            </div>
            <div class="section-body">
              <div class="calc-options">
                <el-checkbox-group v-model="calcOptions">
                  <el-checkbox value="calc_ic">IC分析</el-checkbox>
                  <el-checkbox value="calc_rank_ic">Rank IC</el-checkbox>
                  <el-checkbox value="calc_layer_return">分层收益</el-checkbox>
                  <el-checkbox value="calc_long_short">多空组合</el-checkbox>
                  <el-checkbox value="calc_turnover">换手率</el-checkbox>
                  <el-checkbox value="calc_drawdown">最大回撤</el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
          </div>

        </el-col>
      </el-row>

      <!-- 提交按钮 -->
      <div class="form-footer">
        <el-button 
          type="primary" 
          size="large" 
          @click="handleSubmit" 
          :loading="submitting"
          :icon="Upload"
        >
          {{ submitting ? '提交中...' : '提交回测任务' }}
        </el-button>
      </div>
    </el-form>
    
    <!-- 表搜索弹窗 -->
    <el-dialog
      v-model="searchDialogVisible"
      title="选择数据表"
      width="900px"
      :close-on-click-modal="false"
      class="table-search-dialog"
    >
      <div class="search-dialog-content">
        <!-- 搜索框 -->
        <div class="search-header">
          <el-input
            v-model="dialogSearchKeyword"
            placeholder="输入表名、注释或字段名搜索..."
            clearable
            size="large"
            @input="handleDialogSearch"
            @clear="handleDialogSearchClear"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
            <template #suffix v-if="dialogSearchLoading">
              <el-icon class="is-loading"><Loading /></el-icon>
            </template>
          </el-input>
        </div>
        
        <!-- 搜索结果 -->
        <div class="search-results">
          <div v-if="dialogSearchLoading" class="results-loading">
            <el-icon class="is-loading" :size="32"><Loading /></el-icon>
            <span>搜索中...</span>
          </div>
          
          <div v-else-if="!dialogSearchKeyword" class="results-hint">
            <el-icon :size="48"><Search /></el-icon>
            <span>请输入关键词搜索数据表</span>
          </div>
          
          <div v-else-if="!hasDialogSearchResults" class="results-empty">
            <el-icon :size="48"><Document /></el-icon>
            <span>未找到匹配的数据表</span>
          </div>
          
          <div v-else class="results-content">
            <!-- 静态元数据 -->
            <div v-if="getDialogResultsByType('static').length" class="result-section">
              <div class="section-header static">
                <el-icon><Document /></el-icon>
                <span>静态元数据</span>
                <el-tag size="small" type="success">{{ getDialogResultsByType('static').length }} 个表</el-tag>
              </div>
              <div class="section-body">
                <div 
                  v-for="item in getDialogResultsByType('static')" 
                  :key="item.table_name"
                  class="table-card"
                  @click="selectDialogResult(item, 'postgresql')"
                >
                  <div class="card-header">
                    <span class="table-name">{{ item.table_name }}</span>
                    <el-tag size="small" type="success">PostgreSQL</el-tag>
                  </div>
                  <div class="card-body">
                    <div class="table-comment">{{ item.table_comment || '暂无描述' }}</div>
                    <div class="table-meta">
                      <span v-if="item.category" class="meta-item">
                        <el-icon><Folder /></el-icon>
                        {{ item.category }}
                      </span>
                      <span v-if="item.match_score" class="meta-item score">
                        匹配度: {{ Math.round(item.match_score) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 加工数据 -->
            <div v-if="getDialogResultsByType('processed').length" class="result-section">
              <div class="section-header processed">
                <el-icon><Operation /></el-icon>
                <span>加工数据</span>
                <el-tag size="small" type="warning">{{ getDialogResultsByType('processed').length }} 个表</el-tag>
              </div>
              <div class="section-body">
                <div 
                  v-for="item in getDialogResultsByType('processed')" 
                  :key="item.table_name"
                  class="table-card"
                  @click="selectDialogResult(item, 'clickhouse')"
                >
                  <div class="card-header">
                    <span class="table-name">{{ item.table_name }}</span>
                    <el-tag size="small" type="warning">ClickHouse</el-tag>
                  </div>
                  <div class="card-body">
                    <div class="table-comment">{{ item.table_comment || '暂无描述' }}</div>
                    <div class="table-meta">
                      <span v-if="item.category" class="meta-item">
                        <el-icon><Folder /></el-icon>
                        {{ item.category }}
                      </span>
                      <span v-if="item.match_score" class="meta-item score">
                        匹配度: {{ Math.round(item.match_score) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 行情镜像库 -->
            <div v-if="getDialogResultsByType('mirror').length" class="result-section">
              <div class="section-header mirror">
                <el-icon><CopyDocument /></el-icon>
                <span>行情镜像库</span>
                <el-tag size="small" type="info">{{ getDialogResultsByType('mirror').length }} 个表</el-tag>
              </div>
              <div class="section-body">
                <div 
                  v-for="item in getDialogResultsByType('mirror')" 
                  :key="item.table_name"
                  class="table-card"
                  @click="selectDialogResult(item, 'clickhouse_data')"
                >
                  <div class="card-header">
                    <span class="table-name">{{ item.table_name }}</span>
                    <el-tag size="small" type="info">ClickHouse</el-tag>
                  </div>
                  <div class="card-body">
                    <div class="table-comment">{{ item.table_comment || '暂无描述' }}</div>
                    <div class="table-meta">
                      <span v-if="item.category" class="meta-item">
                        <el-icon><Folder /></el-icon>
                        {{ item.category }}
                      </span>
                      <span v-if="item.match_score" class="meta-item score">
                        匹配度: {{ Math.round(item.match_score) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { 
  Document, DataAnalysis, Calendar, Grid, Setting, TrendCharts,
  Upload, InfoFilled, Plus, Delete, Connection, Search, Loading, Operation, CopyDocument, Check,
  Warning, CircleCheck, CircleClose, Close, Folder, Clock
} from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'submitted'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const factorSource = ref('expression')
const dateRange = ref<[string, string] | null>(null)

// 股票池列表
interface StockPool {
  id: string
  name: string
  description: string
  start_date: string
}
interface StockPoolGroup {
  name: string
  pools: StockPool[]
}
interface StockPoolData {
  index: StockPoolGroup
  industry: StockPoolGroup
  custom: StockPoolGroup
}
const stockPoolData = ref<StockPoolData | null>(null)
const stockPoolsLoading = ref(false)
const stockPoolTab = ref('index') // 当前选中的 Tab: index / industry / custom

// 价格类型选项
interface PriceTypeOption {
  value: string
  label: string
  description?: string
  category?: string
}
const buyPriceTypes = ref<PriceTypeOption[]>([
  { value: 'daily_open', label: '日线开盘价' }
])
const sellPriceTypes = ref<PriceTypeOption[]>([
  { value: 'daily_close', label: '日线收盘价' }
])

// 时段筛选预设选项
const timeFilterPresets = ref<TimeFilterPreset[]>([])

// 基准指数选项
interface BenchmarkOption {
  value: string
  label: string
  description?: string
}

// 时段预设选项
interface TimeFilterPreset {
  value: string
  label: string
  description: string
  time_start: string
  time_end: string
}
interface IndexIndustryOption {
  value: string
  label: string
  index_code: string
  index_name: string
  industry: string
}
interface IndexItem {
  code: string
  name: string
  label: string
}

// 基准指数数据
const benchmarkTab = ref('standard') // 标准指数 / 指数行业
const industryIndexTab = ref('CSI300') // 指数行业的子Tab
const standardIndexes = ref<BenchmarkOption[]>([])
const indexList = ref<IndexItem[]>([])
const indexIndustries = ref<Record<string, IndexIndustryOption[]>>({})
const selectedBenchmarks = ref<string[]>([])

// 获取基准标签名称
const getBenchmarkLabel = (value: string) => {
  const std = standardIndexes.value.find(s => s.value === value)
  if (std) return std.label
  for (const code in indexIndustries.value) {
    const ind = indexIndustries.value[code].find(i => i.value === value)
    if (ind) return ind.label
  }
  return value
}

// 移除基准
const removeBenchmark = (value: string) => {
  const idx = selectedBenchmarks.value.indexOf(value)
  if (idx > -1) {
    selectedBenchmarks.value.splice(idx, 1)
  }
}

// 表搜索和字段列表
const tableMetaMap = ref<Record<string, any>>({}) // 表元数据，key: table_name

// 搜索弹窗相关
const searchDialogVisible = ref(false)
const currentSearchIndex = ref(0) // 当前操作的数据源索引
const dialogSearchKeyword = ref('')
const dialogSearchResults = ref<any>(null)
const dialogSearchLoading = ref(false)
const fieldListMap = ref<Record<string, any[]>>({}) // 字段列表，key: "database:table"
const fieldListLoading = ref<Record<number, boolean>>({})

// 代码检查相关
interface CodeCheckField {
  name: string
  exists: boolean
}
interface CodeCheckInfo {
  tableExists: boolean
  database?: string
  fields: CodeCheckField[]
}
const codeCheckResult = ref<Record<string, CodeCheckInfo>>({})
const codeChecking = ref(false)

// 计算属性：是否有检查错误
const hasCodeCheckError = computed(() => {
  for (const info of Object.values(codeCheckResult.value)) {
    if (!info.tableExists) return true
    if (info.fields.some(f => !f.exists)) return true
  }
  return false
})

// 计算属性：是否可以自动配置（所有表和字段都存在）
const canAutoConfig = computed(() => {
  if (Object.keys(codeCheckResult.value).length === 0) return false
  for (const info of Object.values(codeCheckResult.value)) {
    if (!info.tableExists) return false
  }
  return true
})

// 选项配置

const factorSourceOptions = [
  { label: '因子表达式', value: 'expression' },
  { label: 'Python代码', value: 'code' }
]

// 计算选项
const calcOptions = ref([
  'calc_ic', 'calc_rank_ic', 'calc_layer_return',
  'calc_long_short', 'calc_turnover', 'calc_drawdown'
])

// 日期快捷选项
const dateShortcuts = [
  { text: '近1年', value: () => { const e = new Date(); const s = new Date(); s.setFullYear(s.getFullYear() - 1); return [s, e] } },
  { text: '近2年', value: () => { const e = new Date(); const s = new Date(); s.setFullYear(s.getFullYear() - 2); return [s, e] } },
  { text: '近3年', value: () => { const e = new Date(); const s = new Date(); s.setFullYear(s.getFullYear() - 3); return [s, e] } },
  { text: '今年以来', value: () => { const e = new Date(); return [new Date(e.getFullYear(), 0, 1), e] } }
]

// 表单数据
const formData = reactive({
  task_name: '',
  factor_expression: '',
  factor_code: '',
  // 数组形式的数据源
  data_sources: [
    {
      mode: 'normal', // 'normal' 日频数据 | 'intraday' 日内时段筛选
      name: '行情数据',
      database: 'clickhouse',
      table: '',
      fields: [],
      date_field: '',
      code_field: '',
      // 时段筛选字段（仅 intraday 模式使用）
      time_field: '',
      time_start: '',
      time_end: ''
    }
  ] as any[],
  universe: {
    type: 'preset',
    preset_name: 'all',
    custom_file: null as { filename: string; content: string } | null
  },
  backtest_params: {
    num_groups: 10,
    forward_periods: [1, 5, 10, 20],
    factor_direction: 'auto',
    buy_price_type: 'daily_open',
    sell_price_type: 'daily_close',
    benchmarks: [] as string[]
  }
})

const formRules: FormRules = {
  task_name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }]
}

const onFactorSourceChange = () => {
  formData.factor_expression = ''
  formData.factor_code = ''
  codeCheckResult.value = {}
}

// 解析 Python 代码中的表名和字段（支持中文）
const parseCodeDataSources = (code: string): Record<string, string[]> => {
  const result: Record<string, string[]> = {}
  
  // 1. 找到所有 xxx = data['表名'] 或 xxx = data["表名"] 的模式
  // 使用 [^'"\]]+ 来匹配表名（支持中文）
  const dataAccessPattern = /(\w+)\s*=\s*data\[['"]([^'"\]]+)['"]\]/g
  const varToTable: Record<string, string> = {}
  
  let match
  while ((match = dataAccessPattern.exec(code)) !== null) {
    const varName = match[1]
    const tableName = match[2]
    varToTable[varName] = tableName
    if (!result[tableName]) {
      result[tableName] = []
    }
  }
  
  // 2. 找到所有 变量名['字段'] 的读取模式（排除赋值）
  // 先收集所有被赋值的字段（df['xxx'] = ... 模式）
  const assignedFields: Set<string> = new Set()
  for (const [varName] of Object.entries(varToTable)) {
    const assignPattern = new RegExp(`${varName}\\[['"]([^'"\\]]+)['"]\\]\\s*=`, 'g')
    while ((match = assignPattern.exec(code)) !== null) {
      assignedFields.add(match[1])
    }
  }
  
  // 然后检测字段访问，排除被赋值的字段
  for (const [varName, tableName] of Object.entries(varToTable)) {
    // 模式1: 单括号 df['字段']
    const fieldPattern = new RegExp(`${varName}\\[['"]([^'"\\]]+)['"]\\]`, 'g')
    while ((match = fieldPattern.exec(code)) !== null) {
      const fieldName = match[1]
      // 排除被赋值创建的新字段
      if (assignedFields.has(fieldName)) {
        continue
      }
      if (!result[tableName].includes(fieldName)) {
        result[tableName].push(fieldName)
      }
    }
    
    // 模式2: 双括号多列选择 df[['字段1', '字段2', '字段3']]
    const multiColPattern = new RegExp(`${varName}\\[\\[([^\\]]+)\\]\\]`, 'g')
    while ((match = multiColPattern.exec(code)) !== null) {
      const colListStr = match[1]
      // 提取所有引号内的字段名
      const colPattern = /['"]([^'"]+)['"]/g
      let colMatch
      while ((colMatch = colPattern.exec(colListStr)) !== null) {
        const fieldName = colMatch[1]
        if (!assignedFields.has(fieldName) && !result[tableName].includes(fieldName)) {
          result[tableName].push(fieldName)
        }
      }
    }
  }
  
  // 3. 也检查直接访问 data['表名']['字段'] 的模式（支持中文）
  // 排除赋值模式
  const directAssignPattern = /data\[['"]([^'"\]]+)['"]\]\[['"]([^'"\]]+)['"]\]\s*=/g
  const directAssignedFields: Set<string> = new Set()
  while ((match = directAssignPattern.exec(code)) !== null) {
    directAssignedFields.add(`${match[1]}.${match[2]}`)
  }
  
  // 模式1: data['表名']['字段'] 单字段
  const directAccessPattern = /data\[['"]([^'"\]]+)['"]\]\[['"]([^'"\]]+)['"]\]/g
  while ((match = directAccessPattern.exec(code)) !== null) {
    const tableName = match[1]
    const fieldName = match[2]
    // 排除赋值创建的新字段
    if (directAssignedFields.has(`${tableName}.${fieldName}`)) {
      continue
    }
    if (!result[tableName]) {
      result[tableName] = []
    }
    if (!result[tableName].includes(fieldName)) {
      result[tableName].push(fieldName)
    }
  }
  
  // 模式2: data['表名'][['字段1', '字段2']] 多列选择
  const directMultiColPattern = /data\[['"]([^'"\]]+)['"]\]\[\[([^\]]+)\]\]/g
  while ((match = directMultiColPattern.exec(code)) !== null) {
    const tableName = match[1]
    const colListStr = match[2]
    if (!result[tableName]) {
      result[tableName] = []
    }
    // 提取所有引号内的字段名
    const colPattern = /['"]([^'"]+)['"]/g
    let colMatch
    while ((colMatch = colPattern.exec(colListStr)) !== null) {
      const fieldName = colMatch[1]
      if (!result[tableName].includes(fieldName)) {
        result[tableName].push(fieldName)
      }
    }
  }
  
  // 4. 检测 df.groupby(['字段1', '字段2']) 等方法调用中的字段
  for (const [varName, tableName] of Object.entries(varToTable)) {
    // 匹配 varName.groupby([...]) 或 varName.sort_values([...]) 等
    const methodPattern = new RegExp(`${varName}\\.(?:groupby|sort_values|drop_duplicates|merge|join)\\(\\[([^\\]]+)\\]`, 'g')
    while ((match = methodPattern.exec(code)) !== null) {
      const colListStr = match[1]
      const colPattern = /['"]([^'"]+)['"]/g
      let colMatch
      while ((colMatch = colPattern.exec(colListStr)) !== null) {
        const fieldName = colMatch[1]
        if (!assignedFields.has(fieldName) && !result[tableName].includes(fieldName)) {
          result[tableName].push(fieldName)
        }
      }
    }
    
    // 匹配 varName.groupby('字段') 单字段形式
    const singleMethodPattern = new RegExp(`${varName}\\.(?:groupby|sort_values)\\(['"]([^'"]+)['"]\\)`, 'g')
    while ((match = singleMethodPattern.exec(code)) !== null) {
      const fieldName = match[1]
      if (!assignedFields.has(fieldName) && !result[tableName].includes(fieldName)) {
        result[tableName].push(fieldName)
      }
    }
  }
  
  return result
}

// 代码内容变化时触发检查（防抖）
let codeCheckTimer: NodeJS.Timeout | null = null
const onCodeContentChange = () => {
  if (codeCheckTimer) clearTimeout(codeCheckTimer)
  codeCheckTimer = setTimeout(() => {
    runCodeCheck()
  }, 800)
}

// 执行代码检查
const runCodeCheck = async () => {
  const code = formData.factor_code
  if (!code.trim()) {
    codeCheckResult.value = {}
    return
  }
  
  // 解析代码
  const parsed = parseCodeDataSources(code)
  if (Object.keys(parsed).length === 0) {
    codeCheckResult.value = {}
    return
  }
  
  codeChecking.value = true
  const result: Record<string, CodeCheckInfo> = {}
  
  try {
    // 对每个表进行检查
    for (const [tableName, fields] of Object.entries(parsed)) {
      result[tableName] = {
        tableExists: false,
        fields: fields.map(f => ({ name: f, exists: false }))
      }
      
      // 搜索表是否存在 - 分别搜索两个数据源
      try {
        let foundTable: any = null
        let foundDatabase: 'postgresql' | 'clickhouse' | 'clickhouse_data' | undefined
        
        // 搜索两个数据源：clickhouse 和 postgresql
        for (const datasource of ['clickhouse', 'postgresql'] as const) {
          try {
            const searchResult = await window.electronAPI.dbdict.search(tableName, datasource)
            
            // 在搜索结果中查找精确匹配的表（type='table' 且表名精确匹配）
            const results = searchResult.data || []
            for (const item of results) {
              if (item.table_name === tableName && item.type === 'table') {
                foundTable = item
                foundDatabase = datasource
                break
              }
            }
            if (foundTable) break
          } catch (e) {
            console.error(`搜索 ${datasource} 失败:`, e)
          }
        }
        
        if (foundTable) {
          result[tableName].tableExists = true
          result[tableName].database = foundDatabase
          
          // 获取表的字段列表进行比对
          try {
            const tableDetail = await window.electronAPI.dbdict.getTableDetail(tableName, foundDatabase!)
            if (tableDetail.code === 200 && tableDetail.data?.columns) {
              const dbFields = tableDetail.data.columns.map((c: any) => c.column_name)
              // 检查每个字段是否存在
              result[tableName].fields = fields.map(f => ({
                name: f,
                exists: dbFields.includes(f)
              }))
            }
          } catch (e) {
            console.error('获取表字段失败:', e)
          }
        }
      } catch (e) {
        console.error('搜索表失败:', e)
      }
    }
    
    codeCheckResult.value = result
  } finally {
    codeChecking.value = false
  }
}

// 自动配置数据源
const autoConfigDataSources = () => {
  for (const [tableName, info] of Object.entries(codeCheckResult.value)) {
    if (!info.tableExists) continue
    
    // 如果表已经配置过，更新字段
    const existingIndex = formData.data_sources.findIndex(ds => ds.table === tableName)
    if (existingIndex >= 0) {
      // 合并字段
      const existingFields = new Set(formData.data_sources[existingIndex].fields)
      info.fields.filter(f => f.exists).forEach(f => existingFields.add(f.name))
      formData.data_sources[existingIndex].fields = Array.from(existingFields)
    } else {
      // 添加新数据源（默认为日频模式）
      const validFields = info.fields.filter(f => f.exists).map(f => f.name)
      formData.data_sources.push({
        mode: 'normal',
        name: tableName,
        database: info.database || 'clickhouse',
        table: tableName,
        fields: validFields,
        date_field: '',
        code_field: ''
      })
      
      // 尝试加载字段并自动填充日期/代码字段
      const newIndex = formData.data_sources.length - 1
      loadFieldList(newIndex)
    }
  }
  
  // 如果第一个数据源是空的默认项，移除它
  if (formData.data_sources.length > 1 && !formData.data_sources[0].table) {
    formData.data_sources.splice(0, 1)
  }
  
  ElMessage.success('已自动配置数据源，请检查日期字段和代码字段')
}

// 打开搜索弹窗
const openSearchDialog = (index: number) => {
  currentSearchIndex.value = index
  dialogSearchKeyword.value = ''
  dialogSearchResults.value = null
  searchDialogVisible.value = true
}

// 弹窗搜索
let dialogSearchTimer: any = null
const handleDialogSearch = () => {
  const keyword = dialogSearchKeyword.value?.trim()
  if (!keyword || keyword.length < 2) {
    dialogSearchResults.value = null
    return
  }
  
  if (dialogSearchTimer) clearTimeout(dialogSearchTimer)
  
  dialogSearchTimer = setTimeout(async () => {
    dialogSearchLoading.value = true
    try {
      const result = await window.electronAPI.search.global(keyword, 30)
      dialogSearchResults.value = result.data
      
      // 缓存表元数据
      const cacheResults = (results: any[], datasource: string) => {
        results?.forEach((t: any) => {
          if (t.table_name) {
            tableMetaMap.value[t.table_name] = { ...t, datasource }
          }
        })
      }
      cacheResults(result.data?.static?.results, 'postgresql')
      cacheResults(result.data?.processed?.results, 'clickhouse')
      cacheResults(result.data?.mirror?.results, 'clickhouse_data')
    } catch (error) {
      console.error('搜索失败:', error)
    } finally {
      dialogSearchLoading.value = false
    }
  }, 300)
}

// 清空弹窗搜索
const handleDialogSearchClear = () => {
  dialogSearchResults.value = null
}

// 判断弹窗是否有搜索结果
const hasDialogSearchResults = computed(() => {
  const r = dialogSearchResults.value
  if (!r) return false
  return (r.static?.total > 0) || (r.processed?.total > 0) || (r.mirror?.total > 0)
})

// 获取弹窗搜索结果（按类型）
const getDialogResultsByType = (type: 'static' | 'processed' | 'mirror') => {
  const results = dialogSearchResults.value
  if (!results?.[type]?.results) return []
  
  const seen = new Set<string>()
  return results[type].results.filter((item: any) => {
    if (item.match_type === 'field') return false
    if (seen.has(item.table_name)) return false
    seen.add(item.table_name)
    return true
  })
}

// 选择弹窗搜索结果
const selectDialogResult = async (item: any, database: string) => {
  const index = currentSearchIndex.value
  const ds = formData.data_sources[index]
  
  ds.table = item.table_name
  ds.database = database
  ds.name = item.table_comment || item.table_name
  ds.fields = []
  ds.date_field = ''
  ds.code_field = ''
  
  searchDialogVisible.value = false
  
  // 加载字段列表
  await loadFieldList(index)
}

// 清除已选表
const clearSelectedTable = (index: number) => {
  const ds = formData.data_sources[index]
  ds.table = ''
  ds.database = ''
  ds.name = ''
  ds.fields = []
  ds.date_field = ''
  ds.code_field = ''
  // 清除时段筛选（如果是 intraday 模式）
  if (ds.mode === 'intraday') {
    ds.time_field = ''
    ds.time_start = ''
    ds.time_end = ''
  }
}

// 获取字段列表
const getFieldList = (index: number) => {
  const ds = formData.data_sources[index]
  if (!ds?.database || !ds?.table) return []
  const key = `${ds.database}:${ds.table}`
  return fieldListMap.value[key] || []
}

// 加载字段列表（使用 getTableDetail 获取完整信息）
const loadFieldList = async (index: number) => {
  const ds = formData.data_sources[index]
  console.log('loadFieldList called, ds:', ds)
  if (!ds.table || !ds.database) {
    console.log('loadFieldList: table or database is empty')
    return
  }
  
  const key = `${ds.database}:${ds.table}`
  
  // 如果已经加载过，直接自动填充
  if (fieldListMap.value[key]) {
    console.log('loadFieldList: already cached', key)
    autoFillDateCodeField(index)
    return
  }
  
  fieldListLoading.value[index] = true
  try {
    console.log('🔍 加载字段列表:', ds.table, 'datasource:', ds.database)
    const result = await window.electronAPI.dbdict.getTableDetail(ds.table, ds.database)
    console.log('✅ 字段列表返回:', result)
    if (result.code === 200 && result.data?.columns) {
      // 使用展开运算符确保 Vue 响应式更新
      fieldListMap.value = { ...fieldListMap.value, [key]: result.data.columns }
      console.log('✅ 字段已缓存:', key, result.data.columns.length, '个字段')
      autoFillDateCodeField(index)
    } else {
      console.error('❌ 加载字段失败:', result)
      ElMessage.error(result.msg || '加载字段失败')
    }
  } catch (error: any) {
    console.error('❌ 加载字段列表失败:', error)
    ElMessage.error(error.message || '加载字段列表失败')
  } finally {
    fieldListLoading.value[index] = false
  }
}

// 自动填充日期和代码字段
const autoFillDateCodeField = (index: number) => {
  const ds = formData.data_sources[index]
  const fields = getFieldList(index)
  
  // 自动匹配日期字段
  const dateFields = ['trade_date', 'date', 'report_date', 'datetime', 'dt']
  for (const df of dateFields) {
    if (fields.some(f => f.column_name === df)) {
      ds.date_field = df
      break
    }
  }
  
  // 自动匹配代码字段
  const codeFields = ['stock_code', 'code', 'symbol', 'ts_code', 'sec_code']
  for (const cf of codeFields) {
    if (fields.some(f => f.column_name === cf)) {
      ds.code_field = cf
      break
    }
  }
}

// ========== 时段筛选相关函数 ==========

// 点击预设按钮
const onPresetClick = (index: number, preset: TimeFilterPreset) => {
  const ds = formData.data_sources[index]
  if (preset.value === 'custom') {
    // 自定义模式：清空让用户手动输入
    ds.time_start = ''
    ds.time_end = ''
  } else {
    ds.time_start = preset.time_start
    ds.time_end = preset.time_end
  }
}

// 判断预设是否激活
const isPresetActive = (index: number, preset: TimeFilterPreset): boolean => {
  const ds = formData.data_sources[index]
  if (preset.value === 'custom') {
    // 自定义：当时间范围不匹配任何预设时高亮
    if (!ds.time_start || !ds.time_end) return false
    return !timeFilterPresets.value.some(p => 
      p.value !== 'custom' && p.time_start === ds.time_start && p.time_end === ds.time_end
    )
  }
  return ds.time_start === preset.time_start && ds.time_end === preset.time_end
}

// 添加数据源（通过下拉菜单选择类型）
const handleAddDataSource = (mode: 'normal' | 'intraday') => {
  const ds: any = {
    mode,
    name: '',
    database: 'clickhouse',
    table: '',
    fields: [],
    date_field: '',
    code_field: ''
  }
  // 日内时段筛选模式需要额外字段
  if (mode === 'intraday') {
    ds.time_field = ''
    ds.time_start = ''
    ds.time_end = ''
  }
  formData.data_sources.push(ds)
}

// 删除数据源
const removeDataSource = (index: number) => {
  formData.data_sources.splice(index, 1)
}

// 处理股票池文件上传
const handleStockFileChange = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    formData.universe.custom_file = {
      filename: file.name,
      content: e.target?.result as string
    }
  }
  reader.readAsText(file.raw)
}


const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    if (!dateRange.value || dateRange.value.length !== 2) {
      ElMessage.error('请选择回测时间范围')
      return
    }
    
    // 校验因子配置（二选一）
    if (factorSource.value === 'expression' && !formData.factor_expression.trim()) {
      ElMessage.error('请输入因子表达式')
      return
    }
    if (factorSource.value === 'code') {
      if (!formData.factor_code.trim()) {
        ElMessage.error('请输入Python代码')
        return
      }
    }
    
    // 校验数据源
    if (formData.data_sources.length === 0) {
      ElMessage.error('请至少配置一个数据源')
      return
    }
    const tableSet = new Set<string>()
    for (let i = 0; i < formData.data_sources.length; i++) {
      const ds = formData.data_sources[i]
      if (!ds.table) {
        ElMessage.error(`数据源 ${i + 1}: 请选择表`)
        return
      }
      if (tableSet.has(ds.table)) {
        ElMessage.error(`表 "${ds.table}" 重复，同一个表只能配置一次`)
        return
      }
      tableSet.add(ds.table)
      if (!ds.fields || ds.fields.length === 0) {
        ElMessage.error(`数据源 ${i + 1}: 请选择字段`)
        return
      }
      if (!ds.date_field) {
        ElMessage.error(`数据源 ${i + 1}: 请选择日期字段`)
        return
      }
      if (!ds.code_field) {
        ElMessage.error(`数据源 ${i + 1}: 请选择代码字段`)
        return
      }
      // 日内时段筛选模式：必须配置时段
      if (ds.mode === 'intraday') {
        if (!ds.time_field) {
          ElMessage.error(`数据源 ${i + 1}: 日内时段筛选模式必须选择时间字段`)
          return
        }
        if (!ds.time_start || !ds.time_end) {
          ElMessage.error(`数据源 ${i + 1}: 日内时段筛选模式必须配置时间范围`)
          return
        }
        // 验证时间格式 HH:MM
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
        if (!timeRegex.test(ds.time_start)) {
          ElMessage.error(`数据源 ${i + 1}: 开始时间格式错误，应为 HH:MM（如 09:30）`)
          return
        }
        if (!timeRegex.test(ds.time_end)) {
          ElMessage.error(`数据源 ${i + 1}: 结束时间格式错误，应为 HH:MM（如 10:00）`)
          return
        }
      }
    }
    
    submitting.value = true
    
    try {
      // 处理数据源，根据模式构建请求数据
      const processedDataSources = formData.data_sources.map(ds => {
        const result: any = {
          name: ds.name,
          database: ds.database,
          table: ds.table,
          fields: ds.fields,
          date_field: ds.date_field,
          code_field: ds.code_field
        }
        // 日内时段筛选模式：加入时段字段
        if (ds.mode === 'intraday') {
          result.time_field = ds.time_field
          result.time_start = ds.time_start
          result.time_end = ds.time_end
        }
        return result
      })
      
      // 使用 JSON 深拷贝，避免 IPC 传输 reactive 对象时的序列化错误
      const requestData: any = JSON.parse(JSON.stringify({
        task_name: formData.task_name,
        start_date: dateRange.value[0],
        end_date: dateRange.value[1],
        data_sources: processedDataSources,
        universe: formData.universe,
        backtest_params: {
          ...formData.backtest_params,
          benchmarks: selectedBenchmarks.value
        },
        calc_options: {
          calc_ic: calcOptions.value.includes('calc_ic'),
          calc_rank_ic: calcOptions.value.includes('calc_rank_ic'),
          calc_layer_return: calcOptions.value.includes('calc_layer_return'),
          calc_long_short: calcOptions.value.includes('calc_long_short'),
          calc_turnover: calcOptions.value.includes('calc_turnover'),
          calc_drawdown: calcOptions.value.includes('calc_drawdown')
        }
      }))
      
      // 因子配置（二选一）
      if (factorSource.value === 'expression') {
        requestData.factor_expression = formData.factor_expression
      } else if (factorSource.value === 'code') {
        requestData.factor_code = formData.factor_code
      }
      
      const result = await window.electronAPI.backtest.submit(requestData)
      
      if (result.success && result.data) {
        ElMessage.success('任务提交成功！')
        emit('submitted')
      } else {
        ElMessage.error(result.error || '提交失败')
      }
    } catch (error: any) {
      ElMessage.error('提交失败: ' + error.message)
    } finally {
      submitting.value = false
    }
  })
}

// 加载股票池列表
const loadStockPools = async () => {
  stockPoolsLoading.value = true
  try {
    const result = await window.electronAPI.backtest.getStockPools()
    if (result.success && result.data) {
      const data = result.data as any
      // 新格式：按维度分组
      if (data.index || data.industry) {
        stockPoolData.value = data as StockPoolData
        // 如果当前选中的股票池不在当前维度中，设置为第一个
        const pools = stockPoolData.value[stockPoolTab.value as keyof StockPoolData]?.pools || []
        if (pools.length > 0) {
          const currentPool = pools.find((p: StockPool) => p.id === formData.universe.preset_name)
          if (!currentPool) {
            formData.universe.preset_name = pools[0].id
          }
        }
      } else if (Array.isArray(result.data)) {
        // 兼容旧格式：数组
        stockPoolData.value = {
          index: { name: '标准指数维度', pools: result.data },
          industry: { name: '申万行业维度', pools: [] },
          custom: { name: '自定义', pools: [] }
        }
      }
    } else {
      // 接口失败时使用默认选项
      stockPoolData.value = {
        index: { name: '标准指数维度', pools: [{ id: 'all', name: '全市场', description: '所有A股', start_date: '2001-01-02' }] },
        industry: { name: '申万行业维度', pools: [] },
        custom: { name: '自定义', pools: [] }
      }
    }
  } catch (error) {
    console.error('加载股票池失败:', error)
    // 失败时使用默认选项
    stockPoolData.value = {
      index: { name: '标准指数维度', pools: [{ id: 'all', name: '全市场', description: '所有A股', start_date: '2001-01-02' }] },
      industry: { name: '申万行业维度', pools: [] },
      custom: { name: '自定义', pools: [] }
    }
  } finally {
    stockPoolsLoading.value = false
  }
}

// 切换股票池维度
const handleStockPoolTabChange = (tab: string) => {
  stockPoolTab.value = tab
  if (tab === 'custom') {
    formData.universe.type = 'custom'
  } else {
    formData.universe.type = 'preset'
    // 设置为当前维度的第一个股票池
    const pools = stockPoolData.value?.[tab as keyof StockPoolData]?.pools || []
    if (pools.length > 0) {
      formData.universe.preset_name = pools[0].id
    }
  }
}

// 加载价格类型选项和基准指数
const loadPriceTypeOptions = async () => {
  try {
    const result = await window.electronAPI.backtest.getPriceTypeOptions()
    console.log('📊 价格类型选项接口返回:', result)
    if (result.success && result.data) {
      buyPriceTypes.value = result.data.buy_price_types || []
      sellPriceTypes.value = result.data.sell_price_types || []
      
      // 获取时段筛选预设选项（转换后端格式到前端格式）
      if (result.data.time_filter_presets) {
        timeFilterPresets.value = result.data.time_filter_presets.map(preset => ({
          value: preset.name,
          label: preset.name,
          description: preset.description || '',
          time_start: preset.start,
          time_end: preset.end
        }))
        console.log('📊 时段筛选预设:', timeFilterPresets.value)
      }
      
      // 解析基准指数新格式
      const benchmarks = result.data.benchmarks as any
      if (benchmarks) {
        // 标准指数
        standardIndexes.value = benchmarks.standard_indexes || []
        // 指数列表（用于Tab）
        indexList.value = benchmarks.index_list || []
        // 指数行业（按指数分组）
        indexIndustries.value = benchmarks.index_industries || {}
        
        // 设置默认的指数行业Tab
        if (indexList.value.length > 0 && !indexList.value.find(i => i.code === industryIndexTab.value)) {
          industryIndexTab.value = indexList.value[0].code
        }
        
        console.log('📊 标准指数:', standardIndexes.value)
        console.log('📊 指数列表:', indexList.value)
        console.log('📊 指数行业:', indexIndustries.value)
      } else if (Array.isArray(result.data.benchmarks)) {
        // 兼容旧格式
        standardIndexes.value = result.data.benchmarks
      }
    }
  } catch (error) {
    console.error('加载价格类型选项失败:', error)
  }
}

onMounted(async () => {
  // 初始化 API Key
  await initApiKey()
  loadStockPools()
  loadPriceTypeOptions()
})

// 初始化 API Key
const initApiKey = async () => {
  try {
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    if (defaultKey) {
      const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
      if (fullKey) {
        // 设置数据字典 API Key（用于表搜索）
        await window.electronAPI.dictionary.setApiKey(fullKey)
        await window.electronAPI.dbdict.setApiKey(fullKey)
        console.log('✅ 因子回测页面 API Key 已设置')
      }
    }
  } catch (error) {
    console.error('初始化 API Key 失败:', error)
  }
}

</script>

<style scoped lang="scss">
.submit-content {
  .submit-form {
    .form-section {
      background: #fff;
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
      
      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      }
      
      .section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 20px;
        background: #fff;
        border-bottom: 1px solid #f0f0f0;
        font-weight: 600;
        font-size: 15px;
        color: #1f2937;
        
        .section-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
          border-radius: 8px;
          color: #0284c7;
          font-size: 15px;
        }
        
        .el-button {
          margin-left: auto;
        }
        
        .header-actions {
          margin-left: auto;
          
          :deep(.el-dropdown-menu__item) {
            display: flex;
            align-items: center;
            gap: 8px;
            
            .el-icon {
              font-size: 16px;
            }
          }
        }
      }
      
      .section-body {
        padding: 20px;
        
        :deep(.el-form-item) {
          margin-bottom: 18px;
          
          &:last-child {
            margin-bottom: 0;
          }
        }
        
        :deep(.el-form-item__label) {
          font-weight: 500;
          color: #4b5563;
        }
        
        // 美化 segmented 分段器
        :deep(.el-segmented) {
          --el-border-radius-base: 8px;
          background: #f1f5f9;
          padding: 3px;
          
          .el-segmented__group {
            gap: 4px;
          }
          
          .el-segmented__item {
            padding: 6px 16px;
            font-size: 13px;
            font-weight: 500;
            color: #64748b;
            border-radius: 6px;
            transition: all 0.25s ease;
            
            &:hover:not(.is-selected) {
              color: #475569;
              background: rgba(255, 255, 255, 0.5);
            }
            
            &.is-selected {
              color: #0284c7;
              font-weight: 600;
            }
          }
          
          .el-segmented__item-selected {
            background: #fff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
            border-radius: 6px;
          }
        }
      }
    }
    
    // 代码检查面板
    .code-check-panel {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 14px;
      
      .code-check-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
        color: #1e293b;
        
        .el-icon {
          font-size: 18px;
          &.success { color: #22c55e; }
          &.error { color: #ef4444; }
        }
        
        .el-button {
          margin-left: auto;
        }
      }
      
      .code-check-body {
        .check-item {
          padding: 10px 0;
          border-bottom: 1px dashed #e2e8f0;
          
          &:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
          
          .check-table {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            
            .el-icon {
              font-size: 15px;
              &.success { color: #22c55e; }
              &.error { color: #ef4444; }
            }
            
            .table-name {
              font-family: 'SF Mono', Monaco, monospace;
              font-weight: 600;
              color: #334155;
            }
          }
          
          .check-fields {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            padding-left: 24px;
            
            .fields-label {
              font-size: 12px;
              color: #64748b;
              margin-right: 6px;
            }
          }
        }
      }
    }
    
    .form-hint, .code-hint {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
      
      .el-icon {
        font-size: 14px;
      }
      
      code {
        background: #f5f7fa;
        padding: 1px 4px;
        border-radius: 3px;
        font-family: Monaco, Menlo, monospace;
        font-size: 11px;
      }
      
      .selected-count {
        color: #409eff;
        font-weight: 500;
      }
    }
    
    // 已选基准列表
    .selected-benchmarks-list {
      margin-top: 8px;
      padding: 8px 12px;
      background: #f5f7fa;
      border-radius: 6px;
      
      .selected-label {
        font-size: 12px;
        color: #606266;
        font-weight: 500;
        margin-right: 8px;
      }
    }
    
    // 基准指数Tab样式
    .benchmark-tabs {
      :deep(.el-tabs__header) {
        margin-bottom: 12px;
      }
      
      .benchmark-checkbox-group {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        
        .el-checkbox {
          margin-right: 0;
        }
      }
      
      .industry-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
        gap: 6px 12px;
        
        .el-checkbox {
          margin-right: 0;
          
          :deep(.el-checkbox__label) {
            font-size: 13px;
          }
        }
      }
      
      .industry-sub-tabs {
        :deep(.el-tabs__header) {
          margin-bottom: 10px;
        }
        
        :deep(.el-tabs__item) {
          padding: 0 12px;
          font-size: 13px;
        }
      }
    }
    
    .code-textarea {
      :deep(textarea) {
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.5;
      }
    }
    
    .datasource-item {
      background: linear-gradient(135deg, #fafbfc 0%, #f5f7f9 100%);
      border: 1px solid #e8eaed;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 14px;
      transition: all 0.2s ease;
      font-size: 14px;
      
      &:hover {
        border-color: #d0d5dd;
        background: linear-gradient(135deg, #fff 0%, #fafbfc 100%);
      }
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .datasource-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
        padding-bottom: 12px;
        border-bottom: 1px dashed #e8eaed;
        
        .datasource-title {
          font-weight: 600;
          font-size: 14px;
          color: #374151;
        }
        
        .el-tag {
          font-size: 11px;
        }
        
        .el-button {
          margin-left: auto;
        }
      }
      
      :deep(.el-form-item) {
        margin-bottom: 12px !important;
        
        .el-form-item__label {
          font-size: 14px !important;
        }
      }
      
      .selected-table-info {
        .el-tag {
          font-size: 13px;
          height: 28px;
          line-height: 26px;
        }
      }
      
      .date-code-row {
        display: flex;
        gap: 24px;
        margin-bottom: 8px;
        margin-top: 4px;
        
        .field-item {
          display: flex;
          align-items: center;
          gap: 8px;
          
          .field-label {
            font-size: 14px;
            color: #606266;
            white-space: nowrap;
            
            .required {
              color: #f56c6c;
              margin-right: 2px;
            }
          }
          
          .el-select {
            width: 150px;
          }
        }
      }
      
      // 日内时段筛选模式的数据源样式
      &.intraday-mode {
        border-color: #fbbf24;
        background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        
        .datasource-header {
          border-bottom-color: #fde68a;
        }
      }
      
      // 时段筛选区域样式
      .time-filter-section {
        margin-top: 12px;
        padding: 14px;
        background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
        border: 1px solid #fed7aa;
        border-radius: 8px;
        
        .time-field-row,
        .time-range-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          
          .field-label {
            font-size: 13px;
            color: #606266;
            min-width: 70px;
            
            .required {
              color: #f56c6c;
              margin-right: 2px;
            }
          }
        }
        
        .time-presets {
          margin-bottom: 12px;
          
          .presets-label {
            font-size: 13px;
            color: #606266;
          }
          
          .presets-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
            
            .el-button {
              font-size: 12px;
            }
          }
        }
        
        .time-range-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
          
          .range-separator {
            color: #909399;
          }
        }
        
        .time-filter-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 6px;
          font-size: 12px;
          color: #b45309;
          margin-top: 4px;
          
          .el-icon {
            font-size: 14px;
            color: #d97706;
          }
        }
      }
      
      // 数据源模式下拉菜单样式
      .datasource-mode {
        margin-bottom: 12px;
      }
      
      .table-info {
        margin-bottom: 8px;
      }
      
      .table-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        
        .table-name {
          font-weight: 500;
        }
        
        .table-db {
          font-size: 11px;
          color: #909399;
          background: #f0f2f5;
          padding: 1px 6px;
          border-radius: 3px;
        }
      }
      
      .table-comment {
        font-size: 11px;
        color: #909399;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .field-desc {
        font-size: 11px;
        color: #909399;
        margin-left: 8px;
      }
      
      .table-search-wrapper {
        position: relative;
        width: 100%;
      }
      
      .selected-table-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .search-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: white;
        border-radius: 12px;
        box-shadow: 0 6px 30px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-height: 450px;
        overflow-y: auto;
        border: 1px solid #e4e7ed;
        
        // 滚动条美化
        &::-webkit-scrollbar {
          width: 6px;
        }
        &::-webkit-scrollbar-thumb {
          background: #c0c4cc;
          border-radius: 3px;
        }
        &::-webkit-scrollbar-track {
          background: #f5f7fa;
        }
        
        .dropdown-loading,
        .dropdown-empty {
          padding: 40px 20px;
          text-align: center;
          color: #909399;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          
          .el-icon {
            font-size: 36px;
            color: #c0c4cc;
          }
          
          span {
            font-size: 14px;
          }
        }
        
        .dropdown-results {
          padding: 8px 0;
          
          .result-group {
            &:not(:last-child) {
              margin-bottom: 8px;
            }
            
            .group-header {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 10px 16px;
              background: linear-gradient(135deg, #f8f9fb 0%, #f0f2f5 100%);
              font-size: 13px;
              font-weight: 600;
              color: #303133;
              position: sticky;
              top: 0;
              z-index: 1;
              border-bottom: 1px solid #ebeef5;
              
              .el-icon {
                font-size: 16px;
              }
              
              // 不同类型的图标颜色
              &:has(.el-icon:first-child) .el-icon {
                color: #409eff;
              }
            }
            
            // 静态元数据
            &:nth-child(1) .group-header .el-icon {
              color: #67c23a;
            }
            // 加工数据
            &:nth-child(2) .group-header .el-icon {
              color: #e6a23c;
            }
            // 行情镜像库
            &:nth-child(3) .group-header .el-icon {
              color: #909399;
            }
            
            .result-item {
              padding: 12px 16px;
              cursor: pointer;
              transition: all 0.2s ease;
              border-left: 3px solid transparent;
              margin: 0 8px;
              border-radius: 6px;
              
              &:hover {
                background: linear-gradient(135deg, #ecf5ff 0%, #f0f9ff 100%);
                border-left-color: #409eff;
                
                .item-title {
                  color: #409eff;
                }
              }
              
              .item-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                
                .item-title {
                  font-size: 14px;
                  font-weight: 500;
                  color: #303133;
                  line-height: 1.4;
                  flex: 1;
                  transition: color 0.2s;
                }
                
                .item-code {
                  font-size: 12px;
                  color: #909399;
                  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
                  background: #f5f7fa;
                  padding: 2px 8px;
                  border-radius: 4px;
                  white-space: nowrap;
                }
              }
              
              .item-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
                flex-wrap: wrap;
                
                :deep(.el-tag) {
                  border-radius: 4px;
                  font-size: 11px;
                }
                
                .item-score {
                  font-size: 11px;
                  color: #a8abb2;
                  margin-left: auto;
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  
                  &::before {
                    content: '';
                    width: 4px;
                    height: 4px;
                    background: #c0c4cc;
                    border-radius: 50%;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    .filter-options, .output-options {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .calc-options {
      :deep(.el-checkbox-group) {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }
      
      :deep(.el-checkbox) {
        margin-right: 0;
      }
    }
    
    .form-footer {
      display: flex;
      justify-content: center;
      padding: 32px 0 12px;
      
      .el-button {
        min-width: 200px;
        height: 44px;
        font-size: 15px;
        font-weight: 600;
        border-radius: 10px;
        box-shadow: 0 4px 14px rgba(64, 158, 255, 0.3);
        transition: all 0.3s ease;
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
        }
        
        &:active {
          transform: translateY(0);
        }
      }
    }
  }
}

// 搜索弹窗样式
.table-search-dialog {
  :deep(.el-dialog__header) {
    padding: 16px 20px;
    border-bottom: 1px solid #ebeef5;
    margin-right: 0;
  }
  
  :deep(.el-dialog__body) {
    padding: 0;
  }
  
  .search-dialog-content {
    .search-header {
      padding: 20px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
      border-bottom: 1px solid #ebeef5;
      
      .el-input {
        :deep(.el-input__wrapper) {
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
      }
    }
    
    .search-results {
      height: 500px;
      overflow-y: auto;
      
      // 滚动条美化
      &::-webkit-scrollbar {
        width: 8px;
      }
      &::-webkit-scrollbar-thumb {
        background: #c0c4cc;
        border-radius: 4px;
      }
      &::-webkit-scrollbar-track {
        background: #f5f7fa;
      }
      
      .results-loading,
      .results-hint,
      .results-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #909399;
        gap: 16px;
        
        .el-icon {
          color: #c0c4cc;
        }
        
        span {
          font-size: 15px;
        }
      }
      
      .results-content {
        padding: 16px;
        
        .result-section {
          margin-bottom: 20px;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          .section-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            border-radius: 8px 8px 0 0;
            font-size: 14px;
            font-weight: 600;
            
            &.static {
              background: linear-gradient(135deg, #f0f9eb 0%, #e1f3d8 100%);
              color: #67c23a;
            }
            
            &.processed {
              background: linear-gradient(135deg, #fdf6ec 0%, #faecd8 100%);
              color: #e6a23c;
            }
            
            &.mirror {
              background: linear-gradient(135deg, #f4f4f5 0%, #e9e9eb 100%);
              color: #909399;
            }
            
            .el-icon {
              font-size: 18px;
            }
          }
          
          .section-body {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            padding: 16px;
            background: #fafafa;
            border-radius: 0 0 8px 8px;
            border: 1px solid #ebeef5;
            border-top: none;
            
            .table-card {
              background: white;
              border: 1px solid #e4e7ed;
              border-radius: 8px;
              padding: 14px;
              cursor: pointer;
              transition: all 0.25s ease;
              
              &:hover {
                border-color: #409eff;
                box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
                transform: translateY(-2px);
              }
              
              .card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                
                .table-name {
                  font-size: 14px;
                  font-weight: 600;
                  color: #303133;
                  font-family: 'SF Mono', 'Consolas', monospace;
                }
              }
              
              .card-body {
                .table-comment {
                  font-size: 13px;
                  color: #606266;
                  line-height: 1.5;
                  margin-bottom: 10px;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                }
                
                .table-meta {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  flex-wrap: wrap;
                  
                  .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 12px;
                    color: #909399;
                    
                    .el-icon {
                      font-size: 14px;
                    }
                    
                    &.score {
                      margin-left: auto;
                      color: #c0c4cc;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

// 股票池 Tab 样式
.stock-pool-section {
  padding: 0 !important;
  
  .stock-pool-tabs {
    :deep(.el-tabs__header) {
      margin: 0;
      padding: 0 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      
      .el-tabs__nav-wrap::after {
        display: none;
      }
      
      .el-tabs__item {
        padding: 12px 20px;
        font-size: 13px;
        font-weight: 500;
        color: #64748b;
        
        &.is-active {
          color: #0284c7;
        }
        
        &:hover {
          color: #0284c7;
        }
      }
      
      .el-tabs__active-bar {
        background-color: #0284c7;
      }
    }
    
    :deep(.el-tabs__content) {
      padding: 16px;
    }
  }
  
  .pool-radio-group {
    min-height: 120px;
  }
  
  .pool-radio-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .pool-radio-item {
      margin: 0;
      padding: 10px 14px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid transparent;
      transition: all 0.2s;
      
      &:hover {
        background: #eff6ff;
        border-color: #bfdbfe;
      }
      
      :deep(.el-radio__label) {
        font-size: 13px;
        color: #334155;
      }
      
      .pool-date {
        color: #94a3b8;
        font-size: 12px;
      }
    }
  }
  
  .pool-radio-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    
    .pool-radio-item {
      margin: 0;
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid transparent;
      transition: all 0.2s;
      
      &:hover {
        background: #eff6ff;
        border-color: #bfdbfe;
      }
      
      :deep(.el-radio__label) {
        font-size: 13px;
        color: #334155;
      }
    }
  }
  
  .custom-upload-area {
    min-height: 150px;
    
    :deep(.el-upload-dragger) {
      padding: 30px 20px;
      border-radius: 8px;
      border: 2px dashed #e2e8f0;
      background: #fafbfc;
      
      &:hover {
        border-color: #0284c7;
        background: #f0f9ff;
      }
      
      .el-icon--upload {
        font-size: 40px;
        color: #94a3b8;
        margin-bottom: 8px;
      }
      
      .el-upload__text {
        color: #64748b;
        font-size: 14px;
        
        em {
          color: #0284c7;
        }
      }
    }
    
    .uploaded-file {
      margin-top: 16px;
      text-align: center;
    }
  }
}
</style>
