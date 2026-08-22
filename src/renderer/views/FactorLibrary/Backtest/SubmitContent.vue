<template>
  <div class="submit-content">
    <el-scrollbar>
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
                  <div style="width: 100%;">
                    <div ref="pyCodeEditorRef" class="py-code-editor"></div>
                    <el-alert v-for="(warn, i) in pythonValidateWarnings" :key="i" :title="warn" type="warning" :closable="false" show-icon />
                    <div class="form-hint" style="margin-top: 6px;">
                      <el-icon><InfoFilled /></el-icon>
                      需包含 calculate_factor 函数入口；可选定义 build_intermediate_table
                    </div>
                  </div>
                </el-form-item>
                <el-row :gutter="16">
                  <el-col :span="8">
                    <el-form-item label="聚合方式">
                      <el-select v-model="factorAggregation" style="width: 100%;">
                        <el-option label="均值 (mean)" value="mean" />
                        <el-option label="最新 (last)" value="last" />
                        <el-option label="求和 (sum)" value="sum" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="16">
                    <el-form-item label="依赖库">
                      <el-select v-model="factorRequires" multiple collapse-tags placeholder="默认无额外依赖" style="width: 100%;">
                        <el-option v-for="lib in factorRequireOptions" :key="lib" :label="lib" :value="lib" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>
                <!-- 代码检查结果 -->
                <div v-if="Object.keys(codeCheckResult).length > 0 || codeFuncError" class="code-check-panel">
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
                    <div v-if="codeFuncError" class="check-item">
                      <div class="check-table">
                        <el-icon class="error"><CircleClose /></el-icon>
                        <span style="color: #ef4444;">{{ codeFuncError }}</span>
                      </div>
                    </div>
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

              <!-- 方式3: Python文件 -->
              <template v-else-if="factorSource === 'file'">
                <el-form-item label="Python文件">
                  <el-upload
                    :auto-upload="false"
                    :show-file-list="true"
                    :limit="1"
                    accept=".py"
                    :on-change="onPyFileChange"
                    :on-remove="onPyFileRemove"
                  >
                    <el-button type="primary" plain>
                      <el-icon style="margin-right: 4px;"><Upload /></el-icon>
                      选择 .py 文件
                    </el-button>
                  </el-upload>
                  <div class="form-hint">
                    <el-icon><InfoFilled /></el-icon>
                    上传 Python 文件，需包含 calculate_factor 函数入口
                  </div>
                </el-form-item>
                <el-row :gutter="16">
                  <el-col :span="8">
                    <el-form-item label="聚合方式">
                      <el-select v-model="factorAggregation" style="width: 100%;">
                        <el-option label="均值 (mean)" value="mean" />
                        <el-option label="最新 (last)" value="last" />
                        <el-option label="求和 (sum)" value="sum" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="16">
                    <el-form-item label="依赖库">
                      <el-select v-model="factorRequires" multiple collapse-tags placeholder="默认无额外依赖" style="width: 100%;">
                        <el-option v-for="lib in factorRequireOptions" :key="lib" :label="lib" :value="lib" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                </el-row>
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
              <el-row :gutter="16">
                <el-col :span="12">
                  <el-form-item label="开始日期">
                    <el-date-picker
                      v-model="startDate"
                      type="date"
                      placeholder="开始日期"
                      value-format="YYYY-MM-DD"
                      style="width: 100%;"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="结束日期">
                    <el-date-picker
                      v-model="endDate"
                      type="date"
                      placeholder="结束日期"
                      value-format="YYYY-MM-DD"
                      style="width: 100%;"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
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
                <!-- 自动识别字段（仅 Python 模式） -->
                <el-form-item v-if="factorSource === 'code' || factorSource === 'file'" label-width="70px">
                  <el-checkbox v-model="ds.auto_fields">自动识别字段（fields 留空，引擎从代码推断）</el-checkbox>
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
                
                <!-- 高级：字段映射（中文列名表，仅 Python 模式） -->
                <el-collapse v-if="(factorSource === 'code' || factorSource === 'file') && ds.fields.length > 0" class="field-mapping-collapse">
                  <el-collapse-item title="高级：字段映射（中文列名表）" name="mapping">
                    <div class="mapping-hint">用于中文列名的 ClickHouse 逐笔表。ASCII 列名 → 中文列名（可选）</div>
                    <div v-for="f in ds.fields" :key="f" class="mapping-row">
                      <span class="mapping-ascii">{{ f }}</span>
                      <span class="mapping-arrow">→</span>
                      <el-input v-model="ds.field_mappings[f]" placeholder="中文列名（可选）" size="small" style="width: 180px" />
                    </div>
                  </el-collapse-item>
                </el-collapse>
                
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
                <el-form-item label="数据源角色" label-width="70px">
                  <el-select v-model="ds.role" placeholder="正常加载" clearable size="small">
                    <el-option label="正常加载（进回测）" value="load" />
                    <el-option label="仅中间表聚合源（不加载进内存）" value="intermediate_only" />
                  </el-select>
                </el-form-item>
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
                      accept=".csv"
                      :on-change="handleStockFileChange"
                      drag
                    >
                      <el-icon class="el-icon--upload"><Upload /></el-icon>
                      <div class="el-upload__text">拖拽文件到此处，或 <em>点击上传</em></div>
                      <template #tip>
                        <div class="el-upload__tip">仅支持 CSV，第一列为 stock_code</div>
                      </template>
                    </el-upload>
                    <div v-if="formData.universe.custom_file" class="uploaded-file">
                      <el-tag closable @close="formData.universe.custom_file = null; customStockCount = 0" size="large">
                        {{ formData.universe.custom_file.filename }}
                      </el-tag>
                      <span v-if="customStockCount > 0" style="margin-left: 8px; color: #909399;">
                        已识别 {{ customStockCount }} 只{{ customStockCount < 30 ? '（不足 30，无法回测）' : '' }}
                      </span>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </div>

          <!-- 回测模式 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Operation /></el-icon>
              <span>回测模式</span>
            </div>
            <div class="section-body">
              <el-form-item label="研究模式">
                <el-radio-group v-model="researchMode" class="research-mode-group">
                  <el-radio-button value="research">研究</el-radio-button>
                </el-radio-group>

                <div class="research-tiers">
                  <div class="tiers-hint">{{ researchModeHint }}</div>
                </div>
              </el-form-item>

              <!-- walk-forward 高级选项（研究模式可选；admission 引擎强制） -->
              <el-form-item v-if="researchMode !== 'admission'" label="walk-forward">
                <el-switch v-model="walkForward.enabled" active-text="开启滚动验证" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  开启 walk-forward 会多次重算因子和回测，耗时明显增加
                </div>
                <el-row v-if="walkForward.enabled" :gutter="12" style="margin-top: 8px; width: 100%;">
                  <el-col :span="8">
                    <span class="wf-label">折数</span>
                    <el-input-number v-model="walkForward.max_folds" :min="2" :max="10" :step="1" controls-position="right" style="width: 100%;" />
                  </el-col>
                  <el-col :span="8">
                    <span class="wf-label">训练占比</span>
                    <el-input-number v-model="walkForward.train_fraction" :min="0.5" :max="0.95" :step="0.05" :precision="2" controls-position="right" style="width: 100%;" />
                  </el-col>
                  <el-col :span="8">
                    <span class="wf-label">最小测试天数</span>
                    <el-input-number v-model="walkForward.min_test_days" :min="5" :max="120" :step="5" controls-position="right" style="width: 100%;" />
                  </el-col>
                </el-row>
              </el-form-item>

              <!-- 防前视自检（研究模式 quick/deep 显示；admission 引擎强制执行） -->
              <el-form-item v-if="researchMode !== 'admission'" label="防前视自检">
                <el-switch v-model="lookaheadCheckEnabled" active-text="开启前视检测" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  用样本前 70% 数据重算因子，比对是否存在未来信息泄漏，会增加耗时
                </div>
              </el-form-item>

              <!-- 风险因子剥离（研究模式 quick/deep 显示；admission 引擎强制全剥） -->
              <el-form-item v-if="researchMode !== 'admission'" label="风险因子剥离">
                <el-switch v-model="riskNeutralization.enabled" active-text="开启剥离" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  剥离所选风险因子后重算因子有效性，用于判断超额是否主要来自风格暴露
                </div>
                <el-select
                  v-if="riskNeutralization.enabled"
                  v-model="riskNeutralization.selected"
                  multiple
                  clearable
                  collapse-tags
                  collapse-tags-tooltip
                  placeholder="选择要剥离的风险因子（不选则默认剥离全部）"
                  style="width: 100%; margin-top: 8px;"
                >
                  <el-option
                    v-for="opt in RISK_FACTOR_OPTIONS"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
                <div v-if="riskNeutralization.enabled" style="margin-top: 10px;">
                  <el-switch v-model="riskNeutralization.includeEach" active-text="逐风格剥离" />
                  <div class="form-hint">
                    <el-icon><InfoFilled /></el-icon>
                    对 CNE6 20 个风格逐个单独剥离，额外计算 20 组风格残差，任务耗时明显增加
                  </div>
                </div>
              </el-form-item>
            </div>
          </div>

          <!-- 回测参数 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Setting /></el-icon>
              <span>回测参数</span>
            </div>
            <div class="section-body">
              <el-row :gutter="16" class="param-row">
                <el-col :span="12">
                  <el-form-item label="分组数">
                    <el-input-number v-model="formData.backtest_params.num_groups" :min="2" :max="20" style="width: 100%;" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="因子方向">
                    <el-select v-model="formData.backtest_params.factor_direction" style="width: 100%;">
                      <el-option label="正向（值大=好）" value="positive" />
                      <el-option label="负向（值小=好）" value="negative" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
              
              <div class="param-divider"></div>

              <el-form-item label="IC 回测周期">
                <el-select v-model="formData.backtest_params.ic_periods" multiple
                           :disabled="isAdmissionMode" style="width: 100%;">
                  <el-option label="1日" :value="1" />
                  <el-option label="5日" :value="5" />
                  <el-option label="10日" :value="10" />
                  <el-option label="20日" :value="20" />
                  <el-option label="60日" :value="60" />
                </el-select>
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  决定 Rank IC 曲线 / 统计按哪些周期展示
                </div>
              </el-form-item>

              <el-form-item label="收益计算周期">
                <el-select v-model="formData.backtest_params.return_periods" multiple
                           :disabled="isAdmissionMode" style="width: 100%;">
                  <el-option label="1日" :value="1" />
                  <el-option label="5日" :value="5" />
                  <el-option label="10日" :value="10" />
                  <el-option label="20日" :value="20" />
                  <el-option label="60日" :value="60" />
                </el-select>
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  决定多周期对比 / 超额收益曲线按哪些周期展示
                </div>
              </el-form-item>
              
              <div class="param-divider"></div>

              <el-row :gutter="16" class="param-row">
                <el-col :span="12">
                  <el-form-item label="调仓价格">
                    <el-select v-model="formData.backtest_params.rebalance_price_type" style="width: 100%;">
                      <el-option-group
                        v-for="grp in rebalancePriceGroups"
                        :key="grp.category"
                      >
                        <template #label>
                          <span>{{ grp.category }}</span>
                          <el-tooltip v-if="grp.isVwapCum" content="需 vwap_cum 缓存就绪，未就绪回测会报错" placement="right">
                            <el-icon style="margin-left: 4px; vertical-align: middle;"><InfoFilled /></el-icon>
                          </el-tooltip>
                        </template>
                        <el-option
                          v-for="opt in grp.options"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-option-group>
                    </el-select>
                    <div class="form-hint">
                      <el-icon><InfoFilled /></el-icon>
                      T+1日按此价格调仓，VWAP模拟大资金分批成交
                    </div>
                  </el-form-item>
                </el-col>
              </el-row>

              <el-alert
                v-if="minuteVwapLongRangeWarning"
                type="warning"
                :closable="false"
                show-icon
                style="margin: 8px 0;"
                title="分钟行情仅覆盖近期，所选区间较长时分钟 VWAP 样本可能不足，长区间段会自动降级或缺失。"
              />

              <!-- 费率三件套 -->
              <el-row :gutter="16" class="param-row">
                <el-col :span="8">
                  <el-form-item label="无风险利率">
                    <el-input-number
                      v-model="formData.backtest_params.risk_free_rate"
                      :min="0"
                      :max="10000"
                      :controls="false"
                      :disabled="isAdmissionMode"
                      placeholder="bp，留空默认"
                      style="width: 100%;"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="买入费率">
                    <el-input-number
                      v-model="formData.backtest_params.buy_cost_bps"
                      :min="0"
                      :max="10000"
                      :controls="false"
                      :disabled="isAdmissionMode"
                      :placeholder="isAdmissionMode ? '固定 5bp' : 'bp，留空默认'"
                      style="width: 100%;"
                    />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="卖出费率">
                    <el-input-number
                      v-model="formData.backtest_params.sell_cost_bps"
                      :min="0"
                      :max="10000"
                      :controls="false"
                      :disabled="isAdmissionMode"
                      :placeholder="isAdmissionMode ? '固定 10bp' : 'bp，留空默认'"
                      style="width: 100%;"
                    />
                  </el-form-item>
                </el-col>
              </el-row>
              <div class="form-hint form-hint-indent">
                <el-icon><InfoFilled /></el-icon>
                费率单位为 bp（万分之一），留空则由引擎回退 A 股拆分成本模型
              </div>

              <!-- admission 强制覆盖提示 -->
              <el-alert
                v-if="isAdmissionMode"
                type="warning"
                :closable="false"
                show-icon
                style="margin: 12px 0;"
                title="入库审核模式将强制：股票池=中证1000、IC周期=5日、样本内外固定切片、费率买5/卖10bp。以上配置将被忽略。"
              />

              
              <div class="param-divider"></div>
              
              <el-form-item label="基准指数" class="benchmark-item">
                <el-tabs v-model="benchmarkTab" class="benchmark-tabs">
                  <!-- 标准指数 Tab -->
                  <el-tab-pane label="标准指数" name="standard">
                    <el-radio-group v-model="selectedBenchmark" class="benchmark-checkbox-group">
                      <el-radio 
                        v-for="opt in standardIndexes" 
                        :key="opt.value" 
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </el-radio>
                    </el-radio-group>
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
                        <el-radio-group v-model="selectedBenchmark" class="benchmark-checkbox-group industry-grid">
                          <el-radio 
                            v-for="opt in (indexIndustries[idx.code] || [])" 
                            :key="opt.value" 
                            :value="opt.value"
                          >
                            {{ opt.industry }}
                          </el-radio>
                        </el-radio-group>
                      </el-tab-pane>
                    </el-tabs>
                  </el-tab-pane>
                </el-tabs>
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  选择基准指数计算超额收益，仅支持单选；不选则按股票池自动匹配基准
                </div>
                <div v-if="selectedBenchmark" class="selected-benchmarks-list">
                  <span class="selected-label">已选：</span>
                  <el-tag 
                    size="small" 
                    closable 
                    @close="removeBenchmark()"
                    style="margin: 2px 4px 2px 0;"
                  >
                    {{ getBenchmarkLabel(selectedBenchmark) }}
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
                  <el-checkbox value="calc_turnover">换手率</el-checkbox>
                  <el-checkbox value="calc_drawdown">最大回撤</el-checkbox>
                </el-checkbox-group>
              </div>
              <div class="warmup-option" style="margin-top: 12px;">
                <span style="margin-right: 8px;">预热天数</span>
                <el-input-number v-model="warmupDays" :min="0" :max="750" :step="10" controls-position="right" placeholder="自动" style="width: 160px;" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  留空则引擎自动（默认 60，上限 750）
                </div>
              </div>
            </div>
          </div>

          <!-- 高级选项 -->
          <div class="form-section">
            <div class="section-header">
              <el-icon class="section-icon"><Operation /></el-icon>
              <span>高级选项</span>
            </div>
            <div class="section-body">
              <!-- 内存预算 -->
              <el-form-item label="内存预算(MB)">
                <el-input-number v-model="memoryLimitMb" :min="256" :max="65536" :step="512" controls-position="right" placeholder="留空走引擎默认 4096 MB" style="width: 220px;" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  留空走引擎默认 4096 MB；调高前需确认宿主机内存充足
                </div>
              </el-form-item>

              <!-- 子进程隔离执行 -->
              <el-form-item label="隔离执行">
                <el-switch v-model="factorIsolation" active-text="子进程隔离执行（ML 库 / 防崩溃隔离）" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  开启后因子在独立子进程执行，适用于引入 sklearn 等重型库或防止崩溃影响引擎
                </div>
              </el-form-item>

              <!-- 调度配置 -->
              <el-form-item label="长任务模式">
                <el-switch v-model="allowLongRunning" active-text="允许长任务调度" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  适用于超长耗时任务，调度器会放宽超时限制
                </div>
              </el-form-item>
              <el-form-item label="调度通道">
                <el-select v-model="schedulingLane" style="width: 220px;">
                  <el-option label="自动（auto）" value="auto" />
                  <el-option label="快速（quick）" value="quick" />
                  <el-option label="标准（standard）" value="standard" />
                  <el-option label="慢速（slow）" value="slow" />
                  <el-option label="大内存（highmem）" value="highmem" />
                </el-select>
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  自动由网关根据任务属性判定 lane；指定具体值则覆盖网关判定
                </div>
              </el-form-item>

              <!-- 参数扫描 -->
              <el-form-item label="参数扫描">
                <el-switch v-model="parameterScan.enabled" active-text="开启参数扫描" />
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  对因子参数进行网格搜索，自动展开多组候选参数
                </div>
              </el-form-item>
              <template v-if="parameterScan.enabled">
                <div class="param-scan-grid">
                  <div class="grid-header">
                    <span>参数网格（键=参数名，值=候选值数组）</span>
                  </div>
                  <div class="grid-add-row">
                    <el-button size="small" type="primary" plain @click="parameterScan.grid.push({ key: '', values: '' })">添加参数</el-button>
                  </div>
                  <div v-for="(item, idx) in parameterScan.grid" :key="idx" class="grid-row">
                    <el-input v-model="item.key" placeholder="参数名" style="width: 160px;" />
                    <el-input v-model="item.values" placeholder="候选值，逗号分隔，如 1,5,10" style="flex: 1; margin: 0 8px;" />
                    <el-button size="small" type="danger" plain @click="parameterScan.grid.splice(idx, 1)">删除</el-button>
                  </div>
                  <el-row :gutter="16" class="grid-options-row">
                    <el-col :span="12">
                      <el-form-item label="最大候选数">
                        <el-input-number v-model="parameterScan.max_candidates" :min="1" :max="10000" :step="10" controls-position="right" style="width: 100%;" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item label="仅展开不回测">
                        <el-switch v-model="parameterScan.expand_only" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>
              </template>

              <!-- 自定义算子 -->
              <el-form-item label="自定义算子">
                <el-button size="small" type="primary" plain @click="udfList.push({ name: '', body: '', param_count: 1, description: '' })">添加算子</el-button>
                <div class="form-hint">
                  <el-icon><InfoFilled /></el-icon>
                  定义可在因子代码中调用的自定义算子
                </div>
              </el-form-item>
              <div v-if="udfList.length > 0" class="udf-list">
                <div v-for="(udf, idx) in udfList" :key="idx" class="udf-row">
                  <div class="udf-row-head">
                    <el-input v-model="udf.name" placeholder="算子名" style="width: 180px;" />
                    <el-input-number v-model="udf.param_count" :min="0" :max="20" :step="1" controls-position="right" placeholder="参数个数" style="width: 130px; margin-left: 8px;" />
                    <el-button size="small" type="danger" plain style="margin-left: 8px;" @click="udfList.splice(idx, 1)">删除</el-button>
                  </div>
                  <el-input v-model="udf.description" placeholder="描述（可选）" style="width: 100%; margin-top: 6px;" />
                  <el-input v-model="udf.body" type="textarea" :rows="4" placeholder="函数体（Python 代码）" style="margin-top: 6px;" class="code-textarea" />
                </div>
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
    </el-scrollbar>
    
    <!-- 表搜索弹窗 -->
    <el-dialog
      v-model="searchDialogVisible"
      title="选择数据表"
      width="900px"
      :close-on-click-modal="false"
      class="table-search-dialog"
    >
      <div class="search-dialog-content">
        <el-tabs v-model="dialogActiveTab" class="search-tabs">
          <!-- Tab 1: 搜索 -->
          <el-tab-pane label="搜索数据表" name="search">
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
            <!-- 动态分组：按 engine + database 分组渲染（兼容私有数据仓库等任意库） -->
            <div
              v-for="engGroup in dialogGroupedResults"
              :key="engGroup.engine"
              class="result-section"
            >
              <div class="section-header" :class="engGroup.engine === 'postgresql' ? 'static' : 'processed'">
                <el-icon><Document v-if="engGroup.engine === 'postgresql'" /><Operation v-else /></el-icon>
                <span>{{ engGroup.engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse' }}</span>
                <el-tag size="small" :type="engGroup.engine === 'postgresql' ? 'success' : 'warning'">
                  {{ engGroup.databases.reduce((s: number, g: any) => s + g.results.length, 0) }} 个表
                </el-tag>
              </div>
              <div class="section-body">
                <div
                  v-for="dbGroup in engGroup.databases"
                  :key="dbGroup.database"
                >
                  <div v-if="engGroup.databases.length > 1" class="db-sub-header">
                    <el-tag size="small" type="info">{{ dbGroup.database }}</el-tag>
                  </div>
                  <div
                    v-for="item in dbGroup.results"
                    :key="item.table_name"
                    class="table-card"
                    @click="selectDialogResult(item, dbGroup.database)"
                  >
                    <div class="card-header">
                      <span class="table-name">{{ item.table_name }}</span>
                      <el-tag size="small" :type="engGroup.engine === 'postgresql' ? 'success' : 'warning'">
                        {{ dbGroup.database || (engGroup.engine === 'postgresql' ? 'PostgreSQL' : 'ClickHouse') }}
                      </el-tag>
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
          </el-tab-pane>

          <!-- Tab 2: 从中间统计表选择 -->
          <el-tab-pane label="中间统计表" name="midstats">
            <div class="midstats-list-wrap">
              <div v-if="midstatsLoading" class="results-loading">
                <el-icon class="is-loading" :size="32"><Loading /></el-icon>
                <span>加载中...</span>
              </div>
              <div v-else-if="midstatsError" class="results-empty">
                <el-icon :size="48"><Warning /></el-icon>
                <span>{{ midstatsError }}</span>
              </div>
              <div v-else-if="midstatsTables.length === 0" class="results-empty">
                <el-icon :size="48"><Document /></el-icon>
                <span>暂无中间统计表，请先在中间统计表页面初始化并创建</span>
              </div>
              <div v-else class="results-content">
                <div
                  v-for="item in midstatsTables"
                  :key="item.full_name"
                  class="table-card"
                  @click="selectMidstatsTable(item)"
                >
                  <div class="card-header">
                    <span class="table-name">{{ item.full_name }}</span>
                    <el-tag size="small" type="warning">中间统计表</el-tag>
                  </div>
                  <div class="card-body">
                    <div class="table-comment">{{ item.user_name || item.fingerprint?.slice(0, 16) || '—' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { EditorView, basicSetup } from 'codemirror'
import { python as pythonLang } from '@codemirror/lang-python'
import { 
  Document, DataAnalysis, Calendar, Grid, Setting, TrendCharts,
  Upload, InfoFilled, Plus, Delete, Connection, Search, Loading, Operation, Check,
  Warning, CircleCheck, CircleClose, Close, Folder, Clock
} from '@element-plus/icons-vue'

const emit = defineEmits<{
  (e: 'submitted'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const pythonValidateWarnings = ref<string[]>([])
const factorSource = ref('expression')
const dateRange = ref<[string, string] | null>(null)
// 分离式开始/结束日期：底层仍读写 dateRange，保证提交/校验逻辑不变
const startDate = computed<string | null>({
  get: () => dateRange.value?.[0] || null,
  set: (val) => {
    const end = dateRange.value?.[1] || ''
    dateRange.value = [val || '', end] as [string, string]
  }
})
const endDate = computed<string | null>({
  get: () => dateRange.value?.[1] || null,
  set: (val) => {
    const start = dateRange.value?.[0] || ''
    dateRange.value = [start, val || ''] as [string, string]
  }
})

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
const rebalancePriceTypes = ref<PriceTypeOption[]>([
  { value: 'daily_open', label: '日线开盘价' }
])

// 调仓价按 category 分组（1.1 第6点）：vwap_cum 动态档单独分组并提示需缓存就绪
const rebalancePriceGroups = computed(() => {
  const groups = new Map<string, PriceTypeOption[]>()
  for (const opt of rebalancePriceTypes.value) {
    const key = opt.category || '常用'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(opt)
  }
  return Array.from(groups.entries()).map(([category, options]) => ({
    category,
    // 动态开盘累计档：category 含 vwap_cum，或选项 value 全是纯动态档 vwap_{N}min
    isVwapCum: /vwap_?cum/i.test(category) || options.every(o => /^vwap_\d+min$/i.test(o.value)),
    options
  }))
})

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
const selectedBenchmark = ref<string>('')

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

// 移除基准（单选，直接清空）
const removeBenchmark = () => {
  selectedBenchmark.value = ''
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

// 弹窗 tab 切换
const dialogActiveTab = ref('search')
// 中间统计表列表
const midstatsTables = ref<any[]>([])
const midstatsLoading = ref(false)
const midstatsError = ref('')

// 代码检查相关
interface CodeCheckField {
  name: string
  exists: boolean
}
interface CodeCheckInfo {
  tableExists: boolean
  database?: string
  bareTable?: string   // search 命中的纯表名（不带库名前缀）
  fields: CodeCheckField[]
}
const codeCheckResult = ref<Record<string, CodeCheckInfo>>({})
const codeChecking = ref(false)
const codeFuncError = ref('')  // 函数入口检查错误

// 计算属性：是否有检查错误
const hasCodeCheckError = computed(() => {
  if (codeFuncError.value) return true
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
  { label: 'Python代码', value: 'code' },
  { label: 'Python文件', value: 'file' }
]

// Python 文件上传
const pyFileName = ref('')
const pyFileContent = ref('')

const onPyFileChange = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    pyFileContent.value = e.target?.result as string
    pyFileName.value = file.name
  }
  reader.readAsText(file.raw)
}

const onPyFileRemove = () => {
  pyFileName.value = ''
  pyFileContent.value = ''
}

// 计算选项
const calcOptions = ref([
  'calc_ic', 'calc_rank_ic', 'calc_layer_return',
  'calc_turnover', 'calc_drawdown'
])

// 预热天数（高级选项，留空则引擎自动，默认 60，上限 750）
const warmupDays = ref<number | null>(null)

// 内存预算（MB，留空走引擎默认 4096）
const memoryLimitMb = ref<number | null>(null)

// 子进程隔离执行
const factorIsolation = ref(false)

// 调度配置
const schedulingLane = ref<'auto' | 'quick' | 'standard' | 'slow' | 'highmem'>('auto')
const allowLongRunning = ref(false)

// 自定义算子列表
const udfList = ref<Array<{ name: string; body: string; param_count: number; description: string }>>([])

// 参数扫描配置
const parameterScan = reactive({
  enabled: false,
  grid: [] as Array<{ key: string; values: string }>,  // values 为逗号分隔字符串，提交时解析
  max_candidates: 100,
  expand_only: false
})

// Python 因子高级 meta（1.4）
const factorAggregation = ref<'mean' | 'last' | 'sum'>('mean')
const factorRequires = ref<string[]>([])
const factorRequireOptions = [
  'numpy', 'pandas', 'pyarrow', 'polars', 'numba',
  'scipy', 'sklearn', 'statsmodels', 'lightgbm', 'xgboost'
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
      auto_fields: false,
      field_mappings: {} as Record<string, string>,
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
    ic_periods: [1, 5, 10, 20],
    return_periods: [1, 5, 10, 20],
    factor_direction: 'positive',
    rebalance_price_type: 'daily_open',
    benchmarks: [] as string[],
    // 费率三件套（单位 bp），留空则引擎回退 A 股拆分模型
    risk_free_rate: null as number | null,
    buy_cost_bps: null as number | null,
    sell_cost_bps: null as number | null
  }
})

// 研究模式（顶层字段，非 backtest_params）
const researchMode = ref<'research' | 'admission'>('research')
const researchModeHints: Record<string, string> = {
  research: '研究：完整 IC / 分层 / CNE6 风格中性化 / 泛化诊断',
  admission: '入库审核：含前视快照、库级共线性/正交、治理结论（最慢）'
}
const researchModeHint = computed(() => researchModeHints[researchMode.value] || '')

// admission 模式：universe / ic_periods / return_periods / 费率会被引擎强制覆盖
const isAdmissionMode = computed(() => researchMode.value === 'admission')

// walk-forward 高级选项（顶层字段，仅 deep / admission 生效）
const walkForward = reactive({
  enabled: false,
  max_folds: 3,
  train_fraction: 0.8,
  min_test_days: 20
})

// 防前视自检开关（研究模式 quick/deep 可选；admission 引擎强制执行，前端不传）
const lookaheadCheckEnabled = ref(false)

// 风险因子剥离配置（仅 quick/deep；admission 引擎强制全剥，前端不传）
// selected 传值必须为引擎精确英文值，展示中文
const RISK_FACTOR_OPTIONS = [
  { value: 'beta', label: 'Beta' },
  { value: 'size', label: '市值' },
  { value: 'nonlinear_size', label: '非线性市值' },
  { value: 'value', label: '价值' },
  { value: 'momentum', label: '动量' },
  { value: 'volatility', label: '波动率' },
  { value: 'liquidity', label: '流动性' },
  { value: 'industry', label: '行业' }
]
// 研究模式默认开启剥离（对齐原 deep 行为，用户可再手动调整）
const riskNeutralization = reactive({
  enabled: true,
  selected: [] as string[],
  includeEach: false  // 逐风格剥离：额外产出 20 个 neutral_each_* variant
})
// 切换到研究模式时默认开启剥离
watch(researchMode, (mode) => {
  if (mode === 'research') riskNeutralization.enabled = true
})

const formRules: FormRules = {
  task_name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }]
}

// 拆分双函数代码：提取 build_intermediate_table / prepare_data（可选）和 calculate_factor / factor（必填）
function splitFactorCode(fullCode: string) {
  // 优先匹配 build_intermediate_table，回退到 prepare_data
  const prepareMatch = fullCode.match(
    /def\s+build_intermediate_table\s*\([\s\S]*?(?=\ndef\s+|\n#\s*=====|$)/
  ) || fullCode.match(
    /def\s+prepare_data\s*\([\s\S]*?(?=\ndef\s+|\n#\s*=====|$)/
  )
  const calcMatch = fullCode.match(
    /def\s+calculate_factor\s*\([\s\S]*?(?=\ndef\s+|\n#\s*=====|$)/
  ) || fullCode.match(
    /def\s+factor\s*\([\s\S]*?(?=\ndef\s+|\n#\s*=====|$)/
  )
  const imports = fullCode.match(/^(?:import|from)\s.*$/gm)?.join('\n') ?? ''
  const intermediate_table_code = prepareMatch ? prepareMatch[0].trim() : null
  const factor_code = [imports, calcMatch ? calcMatch[0].trim() : fullCode]
    .filter(Boolean).join('\n\n')
  return { factor_code, intermediate_table_code }
}

const onFactorSourceChange = () => {
  formData.factor_expression = ''
  codeCheckResult.value = {}
  codeFuncError.value = ''
  formData.factor_code = ''
  // 切离 code 模式时销毁编辑器
  if (pyCodeEditor) {
    pyCodeEditor.destroy()
    pyCodeEditor = null
  }
  if (factorSource.value === 'file') {
    pyFileName.value = ''
    pyFileContent.value = ''
  }
  // 切到 code 模式时 nextTick 初始化编辑器
  if (factorSource.value === 'code') {
    nextTick(() => initPyCodeEditor())
  }
}

// Python 代码编辑器（CodeMirror 6）
const pyCodeEditorRef = ref<HTMLElement>()
let pyCodeEditor: EditorView | null = null

const initPyCodeEditor = () => {
  if (!pyCodeEditorRef.value || pyCodeEditor) return
  pyCodeEditor = new EditorView({
    doc: formData.factor_code || '',
    extensions: [
      basicSetup,
      pythonLang(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          formData.factor_code = update.state.doc.toString()
          onCodeContentChange()
        }
      })
    ],
    parent: pyCodeEditorRef.value
  })
}

// 解析 Python 代码中的表名和字段（支持中文）
const parseCodeDataSources = (code: string): Record<string, string[]> => {
  const result: Record<string, string[]> = {}
  
  // 1. 找到所有 xxx = data['表名'] 或 xxx = sources['表名'] 的模式
  // 使用 [^'"\]]+ 来匹配表名（支持中文）
  const dataAccessPattern = /(\w+)\s*=\s*(?:data|sources)\[['"]([^'"\]]+)['"]\]/g
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
    codeFuncError.value = ''
    return
  }
  
  // 检查必须包含 calculate_factor 或 factor 函数入口
  if (!code.includes('def calculate_factor') && !code.includes('def factor')) {
    codeFuncError.value = '缺少 calculate_factor 或 factor 函数入口'
  } else {
    codeFuncError.value = ''
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
      
      // 搜索表是否存在（search 自适应遍历用户可访问的所有库）
      try {
        let foundTable: any = null

        try {
          // 搜索时只传表名部分（去掉库名前缀），提高搜索命中率
          const searchKeyword = tableName.includes('.') ? tableName.split('.').pop()! : tableName
          const searchResult = await window.electronAPI.dbdict.search(searchKeyword)

          // 在搜索结果中查找精确匹配的表（type='table' 且表名精确匹配）
          // 搜索结果 table_name 不带库名前缀，需要用 database + table_name 组合匹配
          const results = searchResult.data || []
          for (const item of results) {
            if (item.type !== 'table') continue
            const fullName = `${item.database}.${item.table_name}`
            // 支持 database.table 全名匹配，也支持纯表名匹配
            if (fullName === tableName || item.table_name === tableName) {
              foundTable = item
              break
            }
          }
        } catch (e) {
          console.error('搜索表失败:', e)
        }

        if (foundTable) {
          result[tableName].tableExists = true
          result[tableName].database = foundTable.database
          result[tableName].bareTable = foundTable.table_name   // 存纯表名，供自动配置使用

          // 获取表的字段列表进行比对
          try {
            const tableDetail = await window.electronAPI.dbdict.getTableDetail(foundTable.engine, foundTable.database, foundTable.table_name)
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

    // 纯表名：优先用代码检查存下的 bareTable；兜底从全名取最后一段
    const bareTable = info.bareTable || (tableName.includes('.') ? tableName.split('.').pop()! : tableName)

    // 如果表已经配置过，更新字段（用纯表名比对，与手动选表一致）
    const existingIndex = formData.data_sources.findIndex(ds => ds.table === bareTable)
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
        name: bareTable,
        database: info.database || '',
        table: bareTable,
        fields: validFields,
        date_field: '',
        code_field: '',
        auto_fields: false,
        field_mappings: {} as Record<string, string>
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
  dialogActiveTab.value = 'search'
  midstatsTables.value = []
  midstatsError.value = ''
  searchDialogVisible.value = true
}

// 手动输入表全名：确认选择
// 加载中间统计表列表
const loadMidstatsTables = async () => {
  midstatsLoading.value = true
  midstatsError.value = ''
  try {
    const result = await window.electronAPI.intermediateTable.list()
    if (result.success) {
      const tables = result.data?.tables || []
      midstatsTables.value = tables.map((t: any) => ({
        full_name: t.full_name,
        user_name: t.meta?.user_name,
        fingerprint: t.meta?.fingerprint
      }))
    } else {
      midstatsError.value = result.error || '加载失败'
    }
  } catch (e: any) {
    midstatsError.value = e.message || '加载失败'
  } finally {
    midstatsLoading.value = false
  }
}

// 从中间统计表选择
const selectMidstatsTable = (item: any) => {
  const index = currentSearchIndex.value
  const ds = formData.data_sources[index]
  const fullName = item.full_name
  const dotIdx = fullName.indexOf('.')
  if (dotIdx > 0) {
    ds.database = fullName.slice(0, dotIdx)
    ds.table = fullName.slice(dotIdx + 1)
  } else {
    ds.table = fullName
    ds.database = ''
  }
  ds.name = item.user_name || fullName
  ds.fields = []
  ds.date_field = ''
  ds.code_field = ''
  ds.auto_fields = false
  ds.field_mappings = {}
  searchDialogVisible.value = false
  loadFieldList(index)
}

// tab 切换时按需加载中间统计表
watch(dialogActiveTab, (tab) => {
  if (tab === 'midstats' && midstatsTables.value.length === 0 && !midstatsError.value) {
    loadMidstatsTables()
  }
})

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

      // 缓存表元数据（兼容新旧格式）
      const cacheItem = (t: any) => {
        if (t.table_name) tableMetaMap.value[t.table_name] = { ...t }
      }
      if (Array.isArray(result.data?.results)) {
        result.data.results.forEach(cacheItem)
      }
      // 旧格式兼容
      result.data?.static?.results?.forEach((t: any) => cacheItem({ ...t, datasource: 'postgresql' }))
      result.data?.processed?.results?.forEach((t: any) => cacheItem({ ...t, datasource: 'clickhouse' }))
      result.data?.mirror?.results?.forEach((t: any) => cacheItem({ ...t, datasource: 'clickhouse_data' }))
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
const hasDialogSearchResults = computed(() => dialogAllResults.value.length > 0)

// 搜索结果扁平化（新格式 data.results[] + 旧格式 static/processed/mirror 兼容）
const dialogAllResults = computed<any[]>(() => {
  const r = dialogSearchResults.value
  if (!r) return []
  const seen = new Set<string>()
  const push = (items: any[]) => {
    items?.forEach((item: any) => {
      if (item.match_type === 'field') return
      if (!item.table_name || seen.has(item.table_name)) return
      seen.add(item.table_name)
      flatList.push(item)
    })
  }
  const flatList: any[] = []
  // 新格式：data.results[]
  if (Array.isArray(r.results)) {
    push(r.results)
  }
  // 旧格式兼容
  push(r.static?.results?.map((x: any) => ({ ...x, database: x.database || 'finance_db', engine: 'postgresql' })))
  push(r.processed?.results?.map((x: any) => ({ ...x, database: x.database || 'market_mart', engine: 'clickhouse' })))
  push(r.mirror?.results?.map((x: any) => ({ ...x, database: x.database || 'market_data', engine: 'clickhouse' })))
  return flatList
})

// 按 engine + database 动态分组（与数据中心 GlobalSearchDropdown 一致）
const dialogGroupedResults = computed(() => {
  const map = new Map<string, Map<string, any[]>>()
  for (const item of dialogAllResults.value) {
    const eng = item.engine || 'clickhouse'
    const db = item.database || ''
    if (!map.has(eng)) map.set(eng, new Map())
    const dbMap = map.get(eng)!
    if (!dbMap.has(db)) dbMap.set(db, [])
    dbMap.get(db)!.push(item)
  }
  return Array.from(map.entries()).map(([engine, dbMap]) => ({
    engine,
    databases: Array.from(dbMap.entries()).map(([database, results]) => ({ database, results }))
  }))
})

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
  ds.auto_fields = false
  ds.field_mappings = {}
  
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
  ds.auto_fields = false
  ds.field_mappings = {}
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
    // 先按表名 search 定位真实 engine / database（照抄「代码检查」的做法，已验证可用）
    let engine = ''
    let database = ds.database
    try {
      const searchResult = await window.electronAPI.dbdict.search(ds.table)
      const results = searchResult.data || []
      const hit = results.find((x: any) =>
        x.type === 'table' &&
        x.table_name === ds.table &&
        (!ds.database || x.database === ds.database)
      )
      if (hit) {
        engine = hit.engine || ''
        database = hit.database || ds.database
      }
    } catch (e) {
      console.warn('search 定位表所属库失败，回退用 ds.database', e)
    }
    // 私有工作区库兜底：库名以 factor_workspace 开头的一定是 clickhouse
    if (!engine && database && database.startsWith('factor_workspace')) {
      engine = 'clickhouse'
    }
    console.log('🔍 加载字段列表:', ds.table, 'engine:', engine, 'database:', database)
    const result = await window.electronAPI.dbdict.getTableDetail(engine, database, ds.table)
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
    code_field: '',
    auto_fields: false,
    field_mappings: {} as Record<string, string>
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
const customStockCount = ref(0)

const handleStockFileChange = (file: any) => {
  if (!/\.csv$/i.test(file.name)) {
    ElMessage.error('仅支持 CSV 文件，请上传 .csv（第一列为 stock_code）')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    formData.universe.custom_file = {
      filename: file.name,
      content
    }
    // 仅对 CSV 文本计数；首行若为表头(stock_code)则跳过，去空去重
    const lines = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    const body = lines.length && /stock_code/i.test(lines[0]) ? lines.slice(1) : lines
    customStockCount.value = new Set(body).size
  }
  reader.readAsText(file.raw)
}

// 动态开盘累计档 vwap_15min ~ vwap_240min（结尾无 _HHMM），依赖 vwap_cum 视图扫描
// 固定档如 vwap_30min_0930 走 Redis 缓存不重，不触发长区间告警，故加 ^...$ 锚点
const isMinuteVwap = (t?: string) => !!t && /^vwap_\d+min$/i.test(t)

const minuteVwapLongRangeWarning = computed(() => {
  if (!isMinuteVwap(formData.backtest_params.rebalance_price_type)) return false
  if (!dateRange.value || dateRange.value.length !== 2) return false
  const [start, end] = dateRange.value
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  return days > 90
})


const prevalidateCode = async () => {
  pythonValidateWarnings.value = []
  const code = formData.factor_code
  if (!code) return true
  const result = await window.electronAPI.validatePython({ code, requires: factorRequires.value })
  if (!result.success) return true
  const data = result.data
  if (data.warnings?.length) {
    pythonValidateWarnings.value = data.warnings
  }
  return data.valid
}

const handleSubmit = async () => {
  if (!formRef.value) return

  const valid = await prevalidateCode()
  if (!valid) {
    ElMessage.error('代码静态校验未通过，请修复后再提交')
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    if (!dateRange.value || dateRange.value.length !== 2) {
      ElMessage.error('请选择回测时间范围')
      return
    }

    // 校验自定义股票池
    if (formData.universe.type === 'custom') {
      if (!formData.universe.custom_file) {
        ElMessage.error('请上传自定义股票池文件')
        return
      }
      if (customStockCount.value < 30) {
        ElMessage.error(
          customStockCount.value === 0
            ? '无法识别股票池内容，请检查 CSV 格式（第一列为 stock_code）'
            : '自定义股票池样本过小（< 30 只），无法计算稳健的截面 IC/分层'
        )
        return
      }
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
    if (factorSource.value === 'file') {
      if (!pyFileContent.value.trim()) {
        ElMessage.error('请选择Python文件')
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
      if (!ds.auto_fields && (!ds.fields || ds.fields.length === 0)) {
        ElMessage.error(`数据源 ${i + 1}: 请选择字段，或勾选自动识别`)
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
          fields: ds.auto_fields ? null : ds.fields,
          date_field: ds.date_field,
          code_field: ds.code_field,
          role: ds.role || undefined,
        }
        // field_mappings: 只提交有值的映射
        const mappings: Record<string, string> = {}
        for (const [k, v] of Object.entries(ds.field_mappings || {})) {
          if (v) mappings[k] = v as string
        }
        if (Object.keys(mappings).length > 0) {
          result.field_mappings = mappings
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
        research_mode: researchMode.value,
        data_sources: processedDataSources,
        universe: formData.universe,
        backtest_params: {
          ...formData.backtest_params,
          benchmarks: selectedBenchmark.value ? [selectedBenchmark.value] : [],
          // 费率留空则不提交，交由引擎回退默认模型（admission 模式引擎强制覆盖）
          risk_free_rate: formData.backtest_params.risk_free_rate ?? undefined,
          buy_cost_bps: formData.backtest_params.buy_cost_bps ?? undefined,
          sell_cost_bps: formData.backtest_params.sell_cost_bps ?? undefined
        },
        calc_options: {
          calc_ic: calcOptions.value.includes('calc_ic'),
          calc_rank_ic: calcOptions.value.includes('calc_rank_ic'),
          calc_layer_return: calcOptions.value.includes('calc_layer_return'),
          calc_turnover: calcOptions.value.includes('calc_turnover'),
          calc_drawdown: calcOptions.value.includes('calc_drawdown'),
          warmup_days: warmupDays.value || undefined,
          memory_limit_mb: memoryLimitMb.value || undefined
        },
        scheduling: {
          allow_long_running: allowLongRunning.value,
          preferred_lane: schedulingLane.value && schedulingLane.value !== 'auto' ? schedulingLane.value : undefined
        }
      }))
      
      // 因子配置（二选一）
      if (factorSource.value === 'expression') {
        requestData.factor_expression = formData.factor_expression
        requestData.expression_type = 'expr'
      } else if (factorSource.value === 'code' || factorSource.value === 'file') {
        // P0: 校验必须包含 calculate_factor 或 factor 入口
        const codeContent = factorSource.value === 'file' ? pyFileContent.value : formData.factor_code
        const hasCalculateFactor = codeContent.includes('def calculate_factor')
        const hasFactor = codeContent.includes('def factor')
        if (!hasCalculateFactor && !hasFactor) {
          ElMessage.warning('请定义 calculate_factor 或 factor 函数作为因子计算入口')
          return
        }
        const { factor_code, intermediate_table_code } = splitFactorCode(codeContent)
        requestData.factor_code = factor_code
        requestData.expression_type = factorSource.value === 'file' ? 'py_file' : 'py_code'
        if (intermediate_table_code) {
          requestData.intermediate_table_code = intermediate_table_code
        }
        requestData.factor_code_meta = {
          entrypoint: hasCalculateFactor ? 'calculate_factor' : 'factor',
          allow_pandas: true,
          result_mode: 'dataframe',
          factor_aggregation: factorAggregation.value,
          requires: factorRequires.value,
          isolation: factorIsolation.value
        }
      }

      // walk-forward（顶层，研究模式且开启时传；admission 引擎全权接管，前端不传）
      if (researchMode.value !== 'admission' && walkForward.enabled) {
        requestData.walk_forward = {
          enabled: true,
          max_folds: walkForward.max_folds,
          train_fraction: walkForward.train_fraction,
          min_test_days: walkForward.min_test_days
        }
      }
      
      // 防前视自检（仅研究模式 quick/deep 且开启时传；admission 引擎强制执行）
      if (researchMode.value !== 'admission' && lookaheadCheckEnabled.value) {
        requestData.lookahead_check = { enabled: true, fractions: [0.7] }
      }

      // 风险因子剥离（仅 quick/deep；admission 引擎强制全剥，前端不传）
      if (researchMode.value !== 'admission') {
        if (riskNeutralization.enabled) {
          requestData.risk_neutralization = {
            enabled: true,
            selected: [...riskNeutralization.selected],  // 引擎精确英文值
            include_all: true,    // 额外出"全部一起剥"(neutral_all)
            include_each: riskNeutralization.includeEach  // 逐风格剥离（20 个）
          }
        } else {
          requestData.risk_neutralization = { enabled: false }
        }
      }

      // 自定义算子（非空时传）
      if (udfList.value.length > 0) {
        requestData.udfs = JSON.parse(JSON.stringify(udfList.value.map(u => ({
          name: u.name,
          body: u.body,
          param_count: u.param_count,
          description: u.description || undefined
        }))))
      }

      // 参数扫描（开启时传）
      if (parameterScan.enabled) {
        const gridObj: Record<string, any[]> = {}
        for (const item of parameterScan.grid) {
          if (!item.key) continue
          gridObj[item.key] = item.values.split(',').map(v => v.trim()).filter(Boolean)
        }
        requestData.parameter_scan = JSON.parse(JSON.stringify({
          enabled: true,
          grid: gridObj,
          max_candidates: parameterScan.max_candidates,
          expand_only: parameterScan.expand_only
        }))
      }

      const result = await window.electronAPI.backtest.submit(
        // 兜底深拷贝：清掉后挂字段里可能残留的 reactive/Proxy 引用，避免 IPC "An object could not be cloned."
        JSON.parse(JSON.stringify(requestData))
      )
      
      if (result.success && result.data) {
        ElMessage.success('任务提交成功！')
        emit('submitted')
      } else {
        ElMessage.error(result.error || '提交失败')
      }
    } catch (error: any) {
      console.error('提交回测任务失败:', error)
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
      // 优先用网关新字段 rebalance_price_types；过渡期网关未返回时回退到 buy_price_types
      rebalancePriceTypes.value = result.data.rebalance_price_types || result.data.buy_price_types || []
      
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
    ElMessage.warning('基准指数/价格类型选项加载失败，请检查网络或联系管理员')
  }
}

onMounted(async () => {
  // 初始化 API Key
  await initApiKey()
  loadStockPools()
  loadPriceTypeOptions()
})

onBeforeUnmount(() => {
  pyCodeEditor?.destroy()
  pyCodeEditor = null
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
  height: 100%;
  overflow: hidden;
  padding: 10px 0 10px 10px;

  .submit-form {
    margin-right: 16px;
    .form-section {
      background: #fff;
      border-radius: 16px;
      margin-bottom: 18px;
      overflow: hidden;
      border: 1px solid #eef2f7;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -18px rgba(15, 23, 42, 0.14);
      transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1),
                  box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 2px 4px rgba(15, 23, 42, 0.05), 0 16px 36px -20px rgba(15, 23, 42, 0.22);
      }
      
      .section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 15px 20px;
        background: linear-gradient(180deg, #fcfdfe 0%, #ffffff 100%);
        border-bottom: 1px solid #f1f5f9;
        font-weight: 600;
        font-size: 15px;
        color: #0f172a;
        letter-spacing: -0.01em;
        
        .section-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #e0ecfb;
          border-radius: 9px;
          color: #2563eb;
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

    // 独立于 form-item 的提示，手动缩进对齐到内容区（label-width: 100px）
    .form-hint-indent {
      margin-left: 100px;
    }
    
    // 回测参数行间距（el-row 不是 form-item，需手动留白）
    .param-row {
      margin-bottom: 18px;

      :deep(.el-form-item) {
        margin-bottom: 0;
      }
    }

    // 分割线：灰色虚线
    .param-divider {
      height: 0;
      margin: 20px 0;
      border-top: 1px dashed #e2e8f0;
    }

    // 研究模式 / walk-forward
    .research-mode-group {
      width: 100%;
    }
    .wf-label {
      display: block;
      font-size: 12px;
      color: #606266;
      margin-bottom: 4px;
    }

    // 三档递进包含可视化
    .research-tiers {
      margin-top: 10px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;

      .tiers-note {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 10px;
      }

      .tier-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 13px;
        color: #94a3b8;
        position: relative;

        // 连接线，体现层层叠加
        &:not(:last-of-type)::after {
          content: '';
          position: absolute;
          left: 15px;
          top: 26px;
          width: 2px;
          height: 8px;
          background: #e2e8f0;
        }

        .tier-mark {
          font-size: 16px;
          color: #cbd5e1;
        }

        .tier-label {
          font-weight: 600;
          min-width: 64px;
        }

        .tier-adds {
          color: #94a3b8;
          .plus {
            color: #0284c7;
            font-weight: 700;
            margin-right: 4px;
          }
        }

        &.included {
          color: #334155;
          .tier-mark { color: #16a34a; }
          .tier-adds { color: #475569; }
          &:not(:last-of-type)::after { background: #86efac; }
        }

        &.current {
          background: #e0f2fe;
          .tier-label { color: #0284c7; }
        }
      }

      .tiers-hint {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #e2e8f0;
        font-size: 12px;
        color: #b45309;
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
    
    // 基准指数 form-item：label 与 Tab 头文字顶部对齐
    .benchmark-item {
      :deep(.el-form-item) {
        align-items: flex-start;
      }
      :deep(.el-form-item__label) {
        align-self: flex-start;
        height: auto;
        padding-top: 4px;
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

    .py-code-editor {
      width: 100%;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      overflow: hidden;
      :deep(.cm-editor) {
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
      }
      :deep(.cm-scroller) {
        overflow: auto;
        max-height: 500px;
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
      
      .field-mapping-collapse {
        margin-top: 8px;
        border: none;
        
        :deep(.el-collapse-item__header) {
          font-size: 13px;
          color: #6b7280;
          border-bottom: 1px solid #f0f0f0;
        }
        :deep(.el-collapse-item__wrap) {
          border-bottom: none;
        }
        
        .mapping-hint {
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 8px;
        }
        .mapping-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          
          .mapping-ascii {
            font-family: 'Consolas', monospace;
            font-size: 12px;
            color: #4b5563;
            width: 160px;
            flex-shrink: 0;
          }
          .mapping-arrow {
            color: #9ca3af;
            font-size: 12px;
          }
        }
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
      margin-left: 96px;

      :deep(.el-checkbox-group) {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }
      
      :deep(.el-checkbox) {
        margin-right: 0;
      }
    }

    // 预热天数行：label 右对齐占位到 label-width，与上方卡片对齐
    .warmup-option {
      display: flex;
      align-items: center;
      flex-wrap: wrap;

      > span:first-child {
        width: 88px;
        margin-right: 12px !important;
        text-align: right;
        font-size: 14px;
        color: #4b5563;
        font-weight: 500;
      }

      .form-hint {
        width: 100%;
        margin-left: 100px;
      }
    }

    // 参数扫描网格
    .param-scan-grid {
      margin: 8px 0 12px 100px;

      .grid-header {
        margin-bottom: 8px;
        font-size: 13px;
        color: #6b7280;
      }

      .grid-add-row {
        margin-bottom: 8px;
      }

      .grid-row {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }

      .grid-options-row {
        margin-top: 12px;
        align-items: flex-end;
      }
    }

    // 自定义算子列表
    .udf-list {
      margin: 8px 0 12px 100px;

      .udf-row {
        padding: 12px;
        margin-bottom: 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;

        .udf-row-head {
          display: flex;
          align-items: center;
        }
      }
    }
    
    .form-footer {
      display: flex;
      justify-content: center;
      padding: 32px 0 12px;
      
      .el-button {
        min-width: 220px;
        height: 46px;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.02em;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        box-shadow: 0 8px 20px -6px rgba(37, 99, 235, 0.5);
        transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1),
                    box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px -8px rgba(37, 99, 235, 0.6);
        }
        
        &:active {
          transform: translateY(0) scale(0.98);
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

            .db-sub-header {
              grid-column: 1 / -1;
              padding: 4px 0 2px;
              margin-bottom: 4px;
            }
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

// 弹窗 tab：手动输入 + 中间统计表
.search-dialog-content {
  .manual-input-wrap {
    padding: 40px 20px;
    text-align: center;

    .manual-hint {
      margin-top: 16px;
      font-size: 13px;
      color: #909399;
      line-height: 1.6;
    }
  }

  .midstats-list-wrap {
    height: 500px;
    overflow-y: auto;

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
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;

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
          }
        }
      }
    }
  }
}
</style>
