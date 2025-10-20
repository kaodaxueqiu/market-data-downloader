<template>
  <div class="factor-library-page">
    <!-- 一级Tab：大功能模块 -->
    <el-tabs v-model="activeMainTab" class="main-tabs" @tab-change="handleMainTabChange">
      <el-tab-pane label="📚 因子广场" name="plaza">
        <!-- 二级Tab：视图切换 -->
        <el-tabs v-model="activeViewTab" class="view-tabs" @tab-change="handleViewTabChange">
          <el-tab-pane name="category">
            <template #label>
              <span>📊 按分类浏览 ({{ totalCount }})</span>
            </template>
          </el-tab-pane>
          <el-tab-pane name="tags">
            <template #label>
              <span>🏷️ 按标签筛选</span>
            </template>
          </el-tab-pane>
          <el-tab-pane name="performance">
            <template #label>
              <span>📈 按性能排序</span>
            </template>
          </el-tab-pane>
        </el-tabs>

        <!-- 搜索栏 -->
        <div class="search-bar">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索因子代码、名称..."
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <!-- 主内容区：左中右三栏 -->
        <div class="content-layout">
          <!-- 左侧面板：根据Tab显示不同内容 -->
          
          <!-- Tab1: 分类树 -->
          <div v-if="activeViewTab === 'category'" class="left-panel">
            <div class="panel-header">
              <span>因子分类</span>
              <el-button text @click="expandAll">
                <el-icon><Expand /></el-icon>
                {{ allExpanded ? '全部收起' : '全部展开' }}
              </el-button>
            </div>
            <div class="category-tree" v-loading="loadingCategories">
              <el-tree
                ref="treeRef"
                :data="treeDataWithUniqueKeys"
                :props="treeProps"
                :expand-on-click-node="false"
                node-key="uniqueKey"
                highlight-current
                @node-click="handleNodeClick"
              >
                <template #default="{ data }">
                  <div class="tree-node">
                    <span class="node-label">{{ data.name }}</span>
                    <span class="node-count" v-if="data.factor_count !== undefined">
                      ({{ data.factor_count }})
                    </span>
                  </div>
                </template>
              </el-tree>
            </div>
          </div>
          
          <!-- Tab2: 标签列表 -->
          <div v-else-if="activeViewTab === 'tags'" class="left-panel">
            <div class="panel-header">
              <span>因子标签</span>
              <el-button text size="small" @click="clearAllTags">
                <el-icon><Refresh /></el-icon>
                清空
              </el-button>
            </div>
            <div class="tags-container" v-loading="loadingTags">
              <div v-for="(tags, tagType) in tagGroups" :key="tagType" class="tag-group">
                <div class="tag-group-title">{{ getTagTypeLabel(tagType) }}</div>
                <div class="tag-items">
                  <el-check-tag
                    v-for="tag in tags"
                    :key="tag.id"
                    :checked="selectedTags.includes(tag.tag_value)"
                    @change="toggleTag(tag.tag_value)"
                    class="tag-item"
                  >
                    {{ tag.tag_name }}
                  </el-check-tag>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Tab3: 性能排序（占位） -->
          <div v-else class="left-panel">
            <div class="panel-header">
              <span>性能指标</span>
            </div>
            <div class="empty-state">
              <el-empty description="功能开发中..." :image-size="80" />
            </div>
          </div>

          <!-- 中间：因子列表 -->
          <div class="middle-panel">
            <div class="panel-header">
              <span>因子列表</span>
              <el-select v-model="selectedStatus" size="small" style="width: 130px" @change="loadFactors">
                <el-option
                  v-for="status in statusOptions"
                  :key="status.value"
                  :label="status.icon + ' ' + status.label"
                  :value="status.value"
                />
              </el-select>
            </div>
            <div class="factor-list" v-loading="loadingFactors">
              <div
                v-for="factor in displayedFactors"
                :key="factor.factor_id"
                class="factor-card"
                :class="{ active: selectedFactor?.factor_id === factor.factor_id }"
                @click="selectFactor(factor)"
              >
                <div class="factor-header">
                  <div class="factor-code">{{ factor.factor_code }}</div>
                  <el-tag size="small" :type="getStatusColor(factor.status)">
                    {{ getStatusLabel(factor.status) }}
                  </el-tag>
                </div>
                <div class="factor-name">{{ factor.factor_name }}</div>
                <div class="factor-category">
                  {{ factor.category_l1_name }} / {{ factor.category_l2_name }} / {{ factor.category_l3_name }}
                </div>
                <div class="factor-metrics">
                  <el-tag size="small" type="success" effect="plain">
                    IC IR: {{ factor.ic_ir?.toFixed(2) || '-' }}
                  </el-tag>
                  <el-tag size="small" type="primary" effect="plain">
                    Rank IC IR: {{ factor.rank_ic_ir?.toFixed(2) || '-' }}
                  </el-tag>
                </div>
              </div>
              
              <!-- 空状态 -->
              <el-empty 
                v-if="!loadingFactors && displayedFactors.length === 0" 
                description="该分类下暂无因子"
                :image-size="100"
              />
              
              <!-- 分页 -->
              <div v-if="pagination.total > pagination.page_size" class="pagination-wrapper">
                <el-pagination
                  v-model:current-page="pagination.page"
                  v-model:page-size="pagination.page_size"
                  :total="pagination.total"
                  :page-sizes="[20, 50, 100]"
                  layout="total, sizes, prev, pager, next"
                  small
                  @current-change="loadFactors"
                  @size-change="loadFactors"
                />
              </div>
            </div>
          </div>

          <!-- 右侧：详情面板 -->
          <div class="right-panel">
            <div class="panel-header">
              <span>因子详情</span>
            </div>
            <div class="panel-content">
              <div v-if="!selectedFactor" class="empty-state">
                <el-empty description="请从左侧选择一个因子查看详情" :image-size="120" />
              </div>
              
              <div v-else class="factor-detail" v-loading="loadingDetail">
              <!-- 详情头部 -->
              <div class="detail-header">
                <h3>{{ selectedFactorDetail?.factor_name || selectedFactor.factor_name }}</h3>
                <el-tag :type="getStatusColor(selectedFactorDetail?.status || selectedFactor.status)">
                  {{ getStatusLabel(selectedFactorDetail?.status || selectedFactor.status) }}
                </el-tag>
              </div>

              <!-- 基本信息 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>基本信息</span>
                </template>
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="因子代码">
                    <el-text style="font-family: monospace; font-weight: 500;">
                      {{ selectedFactorDetail?.factor_code }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="英文名称">
                    {{ selectedFactorDetail?.factor_name_en || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="分类">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <el-tag size="small">{{ selectedFactorDetail?.category_l1_name }}</el-tag>
                      <el-tag size="small" type="success">{{ selectedFactorDetail?.category_l2_name }}</el-tag>
                      <el-tag size="small" type="warning">{{ selectedFactorDetail?.category_l3_name }}</el-tag>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="数据类型">
                    {{ selectedFactorDetail?.data_type || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="单位">
                    {{ selectedFactorDetail?.unit || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="回看周期">
                    {{ selectedFactorDetail?.lookback_period || '-' }} 天
                  </el-descriptions-item>
                  <el-descriptions-item label="因子描述">
                    {{ selectedFactorDetail?.description || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="计算公式">
                    <el-text style="font-family: monospace; font-size: 12px; word-break: break-all;">
                      {{ selectedFactorDetail?.formula || '-' }}
                    </el-text>
                  </el-descriptions-item>
                </el-descriptions>

                <!-- 标签 -->
                <div v-if="selectedFactorDetail?.tags && selectedFactorDetail.tags.length > 0" class="tags-section">
                  <div class="section-title">标签</div>
                  <el-tag
                    v-for="tag in selectedFactorDetail.tags"
                    :key="tag.id"
                    size="small"
                    class="factor-tag"
                  >
                    {{ tag.tag_name }}
                  </el-tag>
                </div>
              </el-card>

              <!-- 性能指标 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <div class="section-header">
                    <span>性能指标</span>
                    <el-button size="small" text @click="viewPerformanceTrend">
                      <el-icon><TrendCharts /></el-icon>
                      查看趋势
                    </el-button>
                  </div>
                </template>
                <el-descriptions :column="2" size="small" border>
                  <el-descriptions-item label="IC均值">
                    <el-text :type="getICColor(selectedFactorDetail?.ic_mean)">
                      {{ selectedFactorDetail?.ic_mean?.toFixed(4) || '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="IC标准差">
                    {{ selectedFactorDetail?.ic_std?.toFixed(4) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="IC IR">
                    <el-text type="primary" style="font-weight: bold;">
                      {{ selectedFactorDetail?.ic_ir?.toFixed(2) || '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="Rank IC IR">
                    <el-text type="success" style="font-weight: bold;">
                      {{ selectedFactorDetail?.rank_ic_ir?.toFixed(2) || '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="换手率">
                    {{ (selectedFactorDetail?.turnover * 100)?.toFixed(2) || '-' }}%
                  </el-descriptions-item>
                  <el-descriptions-item label="夏普比率">
                    {{ selectedFactorDetail?.sharpe_ratio?.toFixed(2) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最大回撤">
                    <el-text type="danger">
                      {{ (selectedFactorDetail?.max_drawdown * 100)?.toFixed(2) || '-' }}%
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="覆盖率">
                    {{ (selectedFactorDetail?.coverage_rate * 100)?.toFixed(2) || '-' }}%
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 数据范围 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>数据范围</span>
                </template>
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="数据起始">
                    {{ selectedFactorDetail?.data_start_date || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="数据结束">
                    {{ selectedFactorDetail?.data_end_date || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最后更新">
                    {{ selectedFactorDetail?.last_performance_date || '-' }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 操作按钮 -->
              <div class="action-buttons">
                <el-button type="primary" size="large" :icon="Download" @click="showDownloadDialog">
                  下载因子数据
                </el-button>
              </div>
            </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab2: 因子回测与提交 -->
      <el-tab-pane label="🧪 因子回测与提交" name="backtest">
        <div class="backtest-submit-container">
          <!-- 三步流程 -->
          <el-steps :active="currentStep" align-center class="steps-container">
            <el-step title="定义因子" description="填写因子信息" icon="Edit" />
            <el-step title="推送回测" description="查看回测结果" icon="TrendCharts" />
            <el-step title="提交审核" description="满意后提交入库" icon="Upload" />
          </el-steps>

          <!-- 步骤1: 定义因子（左右分栏布局） -->
          <el-card v-show="currentStep === 0" class="step-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span>📝 第一步：定义因子</span>
              </div>
            </template>
            
            <div class="define-layout">
              <!-- 左侧导航 -->
              <div class="define-nav">
                <div 
                  v-for="section in defineSections" 
                  :key="section.key"
                  :class="['nav-item', { active: activeDefineSection === section.key }]"
                  @click="activeDefineSection = section.key"
                >
                  <span class="nav-icon">{{ section.icon }}</span>
                  <span class="nav-label">{{ section.label }}</span>
                  <span v-if="isSectionCompleted(section.key)" class="check-icon">✓</span>
                </div>
              </div>

              <!-- 右侧内容区 -->
              <div class="define-content">
                <!-- 基本信息 -->
                <div v-show="activeDefineSection === 'basic'" class="section-panel">
                  <h3 class="section-title">📝 基本信息</h3>
                  <el-form :model="factorForm" label-width="100px">
                    <el-form-item label="因子名称" required>
                      <el-input 
                        v-model="factorForm.name" 
                        placeholder="例如: 5日动能因子"
                        size="large"
                      />
                    </el-form-item>
                    <el-form-item label="因子描述">
                      <el-input
                        v-model="factorForm.description"
                        type="textarea"
                        :rows="4"
                        placeholder="简要描述因子的含义、用途和特点..."
                      />
                    </el-form-item>
                    <el-form-item label="因子作者">
                      <el-input v-model="factorForm.author" disabled size="large">
                        <template #prepend>
                          <el-icon><User /></el-icon>
                        </template>
                      </el-input>
                      <div class="form-tip">
                        <el-text type="info" size="small">作者信息从当前API Key自动获取</el-text>
                      </div>
                    </el-form-item>
                  </el-form>
                </div>

                <!-- 分类信息 -->
                <div v-show="activeDefineSection === 'category'" class="section-panel">
                  <h3 class="section-title">📁 分类信息</h3>
                  <el-form :model="factorForm" label-width="100px">
                    <el-form-item label="因子分类" required>
                      <el-cascader
                        v-model="factorForm.categoryPath"
                        :options="treeDataWithUniqueKeys"
                        :props="{ label: 'name', value: 'id', children: 'children', emitPath: true }"
                        placeholder="请选择分类"
                        size="large"
                        style="width: 100%"
                      />
                      <div class="form-tip">
                        <el-text type="info" size="small">请选择最具体的三级分类</el-text>
                      </div>
                    </el-form-item>
                    <el-form-item label="已选分类">
                      <el-tag v-if="getSelectedCategoryName()" type="primary" size="large">
                        {{ getSelectedCategoryName() }}
                      </el-tag>
                      <el-text v-else type="info">未选择</el-text>
                    </el-form-item>
                  </el-form>
                </div>

                <!-- 标签信息 -->
                <div v-show="activeDefineSection === 'tags'" class="section-panel">
                  <h3 class="section-title">🏷️ 标签信息</h3>
                  <div class="tags-section">
                    <el-alert 
                      title="标签说明" 
                      type="info" 
                      :closable="false"
                      style="margin-bottom: 20px"
                    >
                      <div>标签用于更精确地描述因子特征，便于后续检索和筛选</div>
                    </el-alert>
                    
                    <div v-for="(tags, tagType) in tagGroups" :key="tagType" class="tag-group-block">
                      <div class="tag-group-header">
                        <span class="tag-type-title">{{ getTagTypeLabel(tagType) }}</span>
                        <el-text type="info" size="small">已选 {{ getSelectedTagCountByType(tagType) }} 个</el-text>
                      </div>
                      <div class="tag-items-block">
                        <el-check-tag
                          v-for="tag in tags"
                          :key="tag.id"
                          :checked="factorForm.tags.includes(tag.tag_value)"
                          @change="toggleFactorTag(tag.tag_value)"
                        >
                          {{ tag.tag_name }}
                        </el-check-tag>
                      </div>
                    </div>
                    
                    <div v-if="Object.keys(tagGroups).length === 0" class="no-tags">
                      <el-empty description="暂无可选标签" />
                    </div>
                  </div>
                </div>

                <!-- 代码信息 -->
                <div v-show="activeDefineSection === 'code'" class="section-panel">
                  <h3 class="section-title">💻 代码信息</h3>
                  <el-form :model="factorForm" label-width="100px">
                    <el-form-item label="实现方式">
                      <el-radio-group v-model="factorForm.codeType" size="large">
                        <el-radio-button value="formula">📐 公式表达式</el-radio-button>
                        <el-radio-button value="python">🐍 Python代码</el-radio-button>
                        <el-radio-button value="cpp">⚡ C++代码</el-radio-button>
                      </el-radio-group>
                    </el-form-item>
                    
                    <el-form-item label="因子代码" required>
                      <el-input
                        v-model="factorForm.formula"
                        type="textarea"
                        :autosize="{ minRows: 6, maxRows: 30 }"
                        :placeholder="getCodePlaceholder()"
                        class="code-editor"
                      />
                      <div class="form-tip">
                        <el-text type="info" size="small">{{ getCodeTip() }}</el-text>
                      </div>
                    </el-form-item>
                    
                    <el-form-item label="回测周期">
                      <el-date-picker
                        v-model="factorForm.backtestRange"
                        type="daterange"
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        value-format="YYYY-MM-DD"
                        size="large"
                        style="width: 100%"
                      />
                    </el-form-item>
                  </el-form>
                </div>
              </div>
            </div>

            <div class="step-actions">
              <el-button type="primary" size="large" @click="goToBacktest" :disabled="!canGoToBacktest">
                完成定义，推送回测
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </el-card>

          <!-- 步骤2: 推送回测 -->
          <el-card v-show="currentStep === 1" class="step-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span>📊 第二步：推送回测</span>
              </div>
            </template>
            <div class="backtest-section">
              <el-alert
                title="回测说明"
                type="info"
                :closable="false"
                show-icon
                class="backtest-alert"
              >
                <div>此步骤仅进行回测验证，<strong>不会将因子写入数据库</strong>。只有第三步"提交审核"后才会入库。</div>
              </el-alert>

              <!-- 因子信息展示 -->
              <div class="factor-info">
                <el-descriptions title="因子信息" :column="2" border>
                  <el-descriptions-item label="因子名称">{{ factorForm.name }}</el-descriptions-item>
                  <el-descriptions-item label="因子公式">{{ factorForm.formula }}</el-descriptions-item>
                  <el-descriptions-item label="回测周期" :span="2">
                    {{ factorForm.backtestRange?.[0] }} 至 {{ factorForm.backtestRange?.[1] }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>

              <!-- 回测进度 -->
              <div v-if="backtestStatus === 'running'" class="backtest-progress">
                <el-progress :percentage="backtestProgress" :stroke-width="20" :text-inside="true">
                  <span>回测中... {{ backtestProgress }}%</span>
                </el-progress>
              </div>

              <!-- 回测结果 -->
              <div v-if="backtestStatus === 'completed'" class="backtest-result">
                <el-result icon="success" title="回测完成" sub-title="以下是回测结果">
                  <template #extra>
                    <div class="result-metrics">
                      <el-statistic title="IC均值" :value="backtestResult.icMean" :precision="4" />
                      <el-statistic title="IC IR" :value="backtestResult.icIr" :precision="2" />
                      <el-statistic title="Rank IC" :value="backtestResult.rankIcMean" :precision="4" />
                      <el-statistic title="换手率" :value="backtestResult.turnover" :precision="2" suffix="%" />
                    </div>
                  </template>
                </el-result>
              </div>
            </div>

            <div class="step-actions">
              <el-button @click="currentStep = 0">
                <el-icon class="el-icon--left"><ArrowLeft /></el-icon>
                上一步
              </el-button>
              <el-button
                type="primary"
                @click="startBacktest"
                :loading="backtestStatus === 'running'"
                v-if="backtestStatus !== 'completed'"
              >
                <el-icon class="el-icon--left"><TrendCharts /></el-icon>
                开始回测
              </el-button>
              <el-button
                type="success"
                @click="currentStep = 2"
                v-if="backtestStatus === 'completed'"
              >
                下一步：提交审核
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </el-card>

          <!-- 步骤3: 提交审核 -->
          <el-card v-show="currentStep === 2" class="step-card" shadow="never">
            <template #header>
              <div class="card-header">
                <span>✅ 第三步：提交审核</span>
              </div>
            </template>
            <div class="submit-section">
              <el-alert
                title="提交说明"
                type="warning"
                :closable="false"
                show-icon
                class="submit-alert"
              >
                <div>提交后因子将进入审核队列，状态为 <el-tag type="warning" size="small">pending</el-tag>，审核通过后状态变为 <el-tag type="success" size="small">production</el-tag></div>
              </el-alert>

              <!-- 最终确认信息 -->
              <div class="final-review">
                <el-descriptions title="因子完整信息" :column="1" border>
                  <el-descriptions-item label="因子名称">{{ factorForm.name }}</el-descriptions-item>
                  <el-descriptions-item label="因子公式">{{ factorForm.formula }}</el-descriptions-item>
                  <el-descriptions-item label="因子分类">{{ getSelectedCategoryName() }}</el-descriptions-item>
                  <el-descriptions-item label="因子标签">
                    <el-tag v-for="tag in getSelectedTagNames()" :key="tag" size="small" style="margin-right: 5px">
                      {{ tag }}
                    </el-tag>
                    <span v-if="factorForm.tags.length === 0">-</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="因子作者">{{ factorForm.author || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="IC IR">
                    <el-tag :type="getIRTagType(backtestResult.icIr)">{{ backtestResult.icIr }}</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="Rank IC">{{ backtestResult.rankIcMean }}</el-descriptions-item>
                  <el-descriptions-item label="换手率">{{ backtestResult.turnover }}%</el-descriptions-item>
                </el-descriptions>
              </div>
            </div>

            <div class="step-actions">
              <el-button @click="currentStep = 1">
                <el-icon class="el-icon--left"><ArrowLeft /></el-icon>
                上一步
              </el-button>
              <el-button type="success" @click="submitFactor" :loading="submitting">
                <el-icon class="el-icon--left"><Upload /></el-icon>
                提交到审核队列
              </el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Tab3: 因子管理 -->
      <el-tab-pane label="⚙️ 因子管理" name="manage">
        <div class="manage-container">
          <el-alert
            title="因子管理"
            type="info"
            :closable="false"
            show-icon
            style="margin-bottom: 20px"
          >
            <div>查看和管理你提交的所有因子</div>
          </el-alert>
          
          <!-- 筛选器 -->
          <div class="manage-filters">
            <el-select v-model="manageFilter" placeholder="筛选状态" style="width: 200px">
              <el-option label="全部因子" value="all" />
              <el-option label="待审核" value="pending" />
              <el-option label="测试中" value="testing" />
              <el-option label="生产环境" value="production" />
              <el-option label="已废弃" value="deprecated" />
            </el-select>
          </div>

          <!-- 我的因子列表 -->
          <el-table :data="myFactors" style="width: 100%; margin-top: 20px" v-loading="loadingMyFactors">
            <el-table-column prop="factor_code" label="因子代码" width="150" />
            <el-table-column prop="factor_name" label="因子名称" width="200" />
            <el-table-column prop="category_l3_name" label="分类" width="150" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusTagType(scope.row.status)" size="small">
                  {{ getStatusLabel(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="ic_ir" label="IC IR" width="100">
              <template #default="scope">
                <el-tag :type="getIRTagType(scope.row.ic_ir)" size="small">
                  {{ scope.row.ic_ir?.toFixed(2) || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180">
              <template #default="scope">
                {{ formatDate(scope.row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="200">
              <template #default="scope">
                <el-button link type="primary" size="small" @click="viewFactorDetail(scope.row)">
                  查看详情
                </el-button>
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="deprecateFactor(scope.row)"
                  v-if="scope.row.status !== 'deprecated'"
                >
                  废弃
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 下载对话框 -->
    <el-dialog
      v-model="downloadDialogVisible"
      title="下载因子数据"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="downloadForm" label-width="100px">
        <el-form-item label="因子">
          <el-tag type="primary" size="large">
            {{ selectedFactorDetail?.factor_name }}
          </el-tag>
        </el-form-item>
        <el-form-item label="日期范围" required>
          <el-date-picker
            v-model="downloadForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="股票池">
          <el-select v-model="downloadForm.stock_pool" style="width: 100%">
            <el-option label="全市场" value="all" />
            <el-option label="沪深300" value="hs300" />
            <el-option label="中证500" value="zz500" />
            <el-option label="中证1000" value="zz1000" />
            <el-option label="科创50" value="kc50" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="downloadDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleDownload" :loading="downloading">
          创建下载任务
        </el-button>
      </template>
    </el-dialog>

    <!-- 性能趋势对话框 -->
    <el-dialog
      v-model="performanceDialogVisible"
      title="因子性能趋势"
      width="90%"
      top="5vh"
    >
      <div v-loading="loadingPerformance" style="min-height: 400px;">
        <div v-if="performanceData.length > 0">
          <el-alert type="info" :closable="false" style="margin-bottom: 20px;">
            <template #title>
              共 {{ performanceData.length }} 天数据 | 
              平均IC: {{ avgIC }} | 
              平均Rank IC: {{ avgRankIC }} | 
              平均换手: {{ avgTurnover }}
            </template>
          </el-alert>
          
          <div class="performance-placeholder">
            <el-text type="info">性能趋势图表展示区域（未来可集成图表库）</el-text>
          </div>
        </div>
        <el-empty v-else description="暂无性能数据" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Search, Refresh, Download, TrendCharts, Expand,
  ArrowRight, ArrowLeft, Upload, User
} from '@element-plus/icons-vue'

// Tab状态
const activeMainTab = ref('plaza')
const activeViewTab = ref('category')

// 回测与提交相关状态
const currentStep = ref(0)  // 当前步骤: 0-定义 1-回测 2-提交
const backtestStatus = ref('idle')  // idle | running | completed | failed
const backtestProgress = ref(0)
const submitting = ref(false)

// 定义因子 - 左侧导航
const activeDefineSection = ref('basic')  // 当前激活的定义区域
const defineSections = [
  { key: 'basic', label: '基本信息', icon: '📝' },
  { key: 'category', label: '分类信息', icon: '📁' },
  { key: 'tags', label: '标签信息', icon: '🏷️' },
  { key: 'code', label: '代码信息', icon: '💻' }
]

// 因子表单数据
const factorForm = ref({
  name: '',
  formula: '',
  codeType: 'formula',  // formula | python | cpp
  categoryPath: [],
  tags: [] as string[],  // 选中的标签值
  backtestRange: [],
  description: '',
  author: ''  // 从API Key自动提取
})

// 回测结果
const backtestResult = ref({
  icMean: 0,
  icIr: 0,
  rankIcMean: 0,
  turnover: 0
})

// 因子管理相关
const manageFilter = ref('all')
const myFactors = ref<any[]>([])
const loadingMyFactors = ref(false)

// 数据状态
const loadingCategories = ref(false)
const loadingFactors = ref(false)
const loadingDetail = ref(false)
const loadingPerformance = ref(false)
const loadingTags = ref(false)
const downloading = ref(false)

// 数据
const searchKeyword = ref('')
const categoryTree = ref<any[]>([])
const factors = ref<any[]>([])     // 因子列表
const selectedFactor = ref<any>(null)
const selectedFactorDetail = ref<any>(null)
const selectedStatus = ref('all')
const selectedCategoryId = ref<number | null>(null)
const selectedCategoryData = ref<any>(null)  // 保存选中的分类完整数据
const performanceData = ref<any[]>([])
const totalCount = ref(0)
const allExpanded = ref(false)
const tagGroups = ref<Record<string, any[]>>({})  // 标签分组
const selectedTags = ref<string[]>([])  // 选中的标签值

// 状态选项
const statusOptions = [
  { value: 'all', label: '全部', icon: '📊' },
  { value: 'testing', label: '测试中', icon: '✏️' },
  { value: 'pending', label: '待审核', icon: '⏳' },
  { value: 'production', label: '生产环境', icon: '✅' },
  { value: 'deprecated', label: '已废弃', icon: '⚠️' }
]

// 树配置
const treeRef = ref()
const treeProps = {
  children: 'children',
  label: 'name'
}

// 为树节点生成唯一Key（factor_count由后端返回，不需要前端计算）
const treeDataWithUniqueKeys = computed(() => {
  const addUniqueKeys = (nodes: any[], level: number = 1, parentKey: string = ''): any[] => {
    return nodes.map((node) => {
      const uniqueKey = parentKey ? `${parentKey}-${node.id}` : `l${level}-${node.id}`
      
      const newNode = {
        ...node,
        uniqueKey,
        level
        // factor_count 由后端API直接返回，无需前端计算
      }
      
      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        newNode.children = addUniqueKeys(node.children, level + 1, uniqueKey)
      }
      
      return newNode
    })
  }
  
  return addUniqueKeys(categoryTree.value)
})

// 分页
const pagination = ref({
  page: 1,
  page_size: 20,
  total: 0
})

// 对话框
const downloadDialogVisible = ref(false)
const performanceDialogVisible = ref(false)

// 下载表单
const downloadForm = ref({
  dateRange: [] as string[],
  stock_pool: 'all'
})

// 显示的因子列表（后端已支持三级筛选，不需要前端再过滤）
const displayedFactors = computed(() => factors.value)

// 性能统计
const avgIC = computed(() => {
  if (performanceData.value.length === 0) return '-'
  const sum = performanceData.value.reduce((acc, p) => acc + p.ic_value, 0)
  return (sum / performanceData.value.length).toFixed(4)
})

const avgRankIC = computed(() => {
  if (performanceData.value.length === 0) return '-'
  const sum = performanceData.value.reduce((acc, p) => acc + p.rank_ic_value, 0)
  return (sum / performanceData.value.length).toFixed(4)
})

const avgTurnover = computed(() => {
  if (performanceData.value.length === 0) return '-'
  const sum = performanceData.value.reduce((acc, p) => acc + p.turnover, 0)
  return ((sum / performanceData.value.length) * 100).toFixed(2) + '%'
})

// 加载分类树
const loadCategories = async () => {
  loadingCategories.value = true
  try {
    // 设置API Key
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    if (!defaultKey) {
      ElMessage.error('请先在系统设置中配置API Key')
      return
    }
    const fullApiKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
    if (!fullApiKey) {
      ElMessage.error('获取API Key失败')
      return
    }
    await window.electronAPI.factor.setApiKey(fullApiKey)
    
    // 获取分类树
    const result = await window.electronAPI.factor.getCategories()
    console.log('=== 分类树API返回数据 ===', result)
    if (result.code === 200) {
      categoryTree.value = result.data
      console.log('=== categoryTree.value ===', categoryTree.value)
      // 检查第一个分类是否有 factor_count
      if (categoryTree.value.length > 0) {
        console.log('=== 第一个分类 ===', categoryTree.value[0])
        console.log('=== factor_count ===', categoryTree.value[0].factor_count)
      }
    }
  } catch (error: any) {
    console.error('加载分类失败:', error)
    ElMessage.error('加载分类失败: ' + error.message)
  } finally {
    loadingCategories.value = false
  }
}

// 加载标签列表
const loadTags = async () => {
  loadingTags.value = true
  try {
    const result = await window.electronAPI.factor.getTags()
    if (result.code === 200) {
      tagGroups.value = result.data
    }
  } catch (error: any) {
    console.error('加载标签失败:', error)
    ElMessage.error('加载标签失败: ' + error.message)
  } finally {
    loadingTags.value = false
  }
}

// 加载因子列表
const loadFactors = async () => {
  loadingFactors.value = true
  try {
    const params: any = {
      page: pagination.value.page,
      page_size: pagination.value.page_size
    }
    
    // 状态筛选
    if (selectedStatus.value !== 'all') {
      params.status = selectedStatus.value
    }
    
    // 分类筛选：根据选中的分类级别，传递对应的参数（仅在按分类浏览时）
    if (activeViewTab.value === 'category' && selectedCategoryData.value) {
      const level = selectedCategoryData.value.level  // 直接使用节点的level字段
      const categoryId = selectedCategoryData.value.id
      
      if (level === 1) {
        params.category_l1_id = categoryId
      } else if (level === 2) {
        params.category_l2_id = categoryId
      } else if (level === 3) {
        params.category_l3_id = categoryId
      }
      
      console.log(`筛选${level}级分类，ID=${categoryId}, Name=${selectedCategoryData.value.name}`)
    }
    
    // 标签筛选：传递选中的标签值（仅在按标签筛选时）
    if (activeViewTab.value === 'tags' && selectedTags.value.length > 0) {
      params.tags = selectedTags.value.join(',')
      console.log('标签筛选:', params.tags)
    }
    
    const result = await window.electronAPI.factor.getFactorList(params)
    if (result.code === 200) {
      factors.value = result.data.factors || []
      pagination.value.total = result.data.total
      
      // 如果是初始加载（无筛选条件），更新总数
      if (!selectedCategoryId.value && selectedStatus.value === 'all' && !searchKeyword.value && selectedTags.value.length === 0) {
        totalCount.value = result.data.total
      }
    }
  } catch (error: any) {
    console.error('加载因子列表失败:', error)
    ElMessage.error('加载因子列表失败: ' + error.message)
  } finally {
    loadingFactors.value = false
  }
}

// 树节点点击
const handleNodeClick = (data: any) => {
  // 点击任意级别的分类，都进行筛选
  selectedCategoryId.value = data.id
  selectedCategoryData.value = data  // 保存完整数据，用于判断级别
  pagination.value.page = 1
  loadFactors()
}

// 收集所有有子节点的uniqueKey
const collectNodeKeys = (nodes: any[]): string[] => {
  let keys: string[] = []
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      keys.push(node.uniqueKey)
      keys = keys.concat(collectNodeKeys(node.children))
    }
  })
  return keys
}

// 展开/收起全部
const expandAll = () => {
  allExpanded.value = !allExpanded.value
  if (!treeRef.value) return
  
  if (allExpanded.value) {
    // 展开：收集所有父节点的uniqueKey并展开
    const keys = collectNodeKeys(treeDataWithUniqueKeys.value)
    keys.forEach(key => {
      const node = treeRef.value.getNode(key)
      if (node) {
        node.expanded = true
      }
    })
    console.log('全部展开，共', keys.length, '个节点')
  } else {
    // 收起：收集所有节点key并收起
    const keys = collectNodeKeys(treeDataWithUniqueKeys.value)
    keys.forEach(key => {
      const node = treeRef.value.getNode(key)
      if (node) {
        node.expanded = false
      }
    })
    console.log('全部收起')
  }
}

// Tab切换
const handleViewTabChange = () => {
  // 切换Tab时重置筛选条件
  selectedCategoryId.value = null
  selectedCategoryData.value = null
  selectedTags.value = []
  selectedStatus.value = 'all'
  pagination.value.page = 1
  loadFactors()
}

// 一级Tab切换
const handleMainTabChange = async (tabName: string) => {
  if (tabName === 'backtest') {
    // 切换到回测Tab时，重置表单并加载作者信息
    await resetFactorForm()
    // 确保分类树和标签已加载
    if (categoryTree.value.length === 0) {
      await loadCategories()
    }
    if (Object.keys(tagGroups.value).length === 0) {
      await loadTags()
    }
  } else if (tabName === 'manage') {
    // 切换到管理Tab时，加载我的因子
    loadMyFactors()
  }
}

// ========== 回测与提交相关方法 ==========

// 重置因子表单
const resetFactorForm = async () => {
  currentStep.value = 0
  backtestStatus.value = 'idle'
  backtestProgress.value = 0
  
  // 获取作者信息
  const author = await getAuthorFromApiKey()
  
  factorForm.value = {
    name: '',
    formula: '',
    codeType: 'formula',
    categoryPath: [],
    tags: [],
    backtestRange: [],
    description: '',
    author: author
  }
  
  // 重置定义区域导航
  activeDefineSection.value = 'basic'
  backtestResult.value = {
    icMean: 0,
    icIr: 0,
    rankIcMean: 0,
    turnover: 0
  }
}

// 从API Key获取作者信息
const getAuthorFromApiKey = async () => {
  try {
    const apiKeys = await window.electronAPI.config.getApiKeys()
    const defaultKey = apiKeys.find((k: any) => k.isDefault)
    if (defaultKey && defaultKey.name) {
      return defaultKey.name  // 使用API Key的名称作为作者
    }
    return '未知作者'
  } catch (error) {
    console.error('获取作者信息失败:', error)
    return '未知作者'
  }
}

// 切换因子标签
const toggleFactorTag = (tagValue: string) => {
  const index = factorForm.value.tags.indexOf(tagValue)
  if (index > -1) {
    factorForm.value.tags.splice(index, 1)
  } else {
    factorForm.value.tags.push(tagValue)
  }
}

// 获取选中标签的名称
const getSelectedTagNames = () => {
  const selectedNames: string[] = []
  Object.values(tagGroups.value).forEach(tags => {
    tags.forEach(tag => {
      if (factorForm.value.tags.includes(tag.tag_value)) {
        selectedNames.push(tag.tag_name)
      }
    })
  })
  return selectedNames
}

// 检查定义区域是否完成
const isSectionCompleted = (sectionKey: string) => {
  switch (sectionKey) {
    case 'basic':
      return !!factorForm.value.name
    case 'category':
      return factorForm.value.categoryPath.length > 0
    case 'tags':
      return factorForm.value.tags.length > 0
    case 'code':
      return !!factorForm.value.formula
    default:
      return false
  }
}

// 获取某类型已选标签数量
const getSelectedTagCountByType = (tagType: string) => {
  const tags = tagGroups.value[tagType] || []
  const tagValues = tags.map(t => t.tag_value)
  return factorForm.value.tags.filter(v => tagValues.includes(v)).length
}

// 获取代码编辑器占位符
const getCodePlaceholder = () => {
  const placeholders: Record<string, string> = {
    formula: '例如: (close - Ref(close, 5)) / Ref(close, 5)',
    python: `# Python 因子实现示例
def calculate_factor(data):
    """
    参数:
        data: pandas.DataFrame，包含 open, high, low, close, volume 等字段
    返回:
        pandas.Series，因子值
    """
    # 计算5日收益率
    ret_5d = data['close'] / data['close'].shift(5) - 1
    return ret_5d`,
    cpp: `// C++ 因子实现示例
#include <vector>
#include <cmath>

// 因子计算函数
double calculate_factor(const std::vector<double>& close, int index) {
    if (index < 5) return NAN;
    
    // 计算5日收益率
    double ret_5d = (close[index] - close[index - 5]) / close[index - 5];
    
    return ret_5d;
}

// 或者使用完整的市场数据结构
/*
struct MarketData {
    double open, high, low, close, volume;
    long long timestamp;
};

double calculate_factor(const std::vector<MarketData>& data, int index) {
    // 实现因子计算逻辑
    return 0.0;
}
*/`
  }
  return placeholders[factorForm.value.codeType] || ''
}

// 获取代码提示
const getCodeTip = () => {
  const tips: Record<string, string> = {
    formula: '支持常用算子：Ref(引用), Mean(均值), Std(标准差), Sum(求和), Max(最大), Min(最小)等',
    python: '函数名必须为 calculate_factor，参数为 DataFrame，返回 Series。可使用 pandas、numpy 等常用库',
    cpp: 'C++代码提交后将由服务端编译（编译时间约30-60秒）。编译成功后才能回测。适用于高性能计算场景'
  }
  return tips[factorForm.value.codeType] || ''
}

// 检查是否可以进入回测步骤
const canGoToBacktest = computed(() => {
  return factorForm.value.name &&
         factorForm.value.formula &&
         factorForm.value.categoryPath.length > 0
})

// 进入回测步骤
const goToBacktest = () => {
  if (!canGoToBacktest.value) {
    ElMessage.warning('请填写完整的因子信息')
    return
  }
  currentStep.value = 1
}

// 开始回测
const startBacktest = async () => {
  backtestStatus.value = 'running'
  backtestProgress.value = 0
  
  try {
    // 模拟回测过程
    const progressInterval = setInterval(() => {
      if (backtestProgress.value < 100) {
        backtestProgress.value += 10
      } else {
        clearInterval(progressInterval)
      }
    }, 300)
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 模拟回测结果
    backtestResult.value = {
      icMean: 0.045 + Math.random() * 0.01,
      icIr: 1.5 + Math.random() * 0.5,
      rankIcMean: 0.052 + Math.random() * 0.01,
      turnover: 12 + Math.random() * 5
    }
    
    backtestStatus.value = 'completed'
    ElMessage.success('回测完成！')
  } catch (error: any) {
    backtestStatus.value = 'failed'
    ElMessage.error('回测失败: ' + error.message)
  }
}

// 提交因子
const submitFactor = async () => {
  submitting.value = true
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    ElMessage.success('因子提交成功！已进入审核队列')
    
    // 重置表单并切换到管理Tab
    resetFactorForm()
    activeMainTab.value = 'manage'
    loadMyFactors()
  } catch (error: any) {
    ElMessage.error('提交失败: ' + error.message)
  } finally {
    submitting.value = false
  }
}

// 获取选中分类的名称
const getSelectedCategoryName = () => {
  if (!factorForm.value.categoryPath || factorForm.value.categoryPath.length === 0) {
    return '-'
  }
  
  // 递归查找分类名称
  const findCategory = (tree: any[], path: number[], index: number = 0): string => {
    if (index >= path.length) return ''
    
    const node = tree.find(n => n.id === path[index])
    if (!node) return ''
    
    if (index === path.length - 1) {
      return node.name
    }
    
    if (node.children && node.children.length > 0) {
      return findCategory(node.children, path, index + 1)
    }
    
    return node.name
  }
  
  return findCategory(categoryTree.value, factorForm.value.categoryPath)
}

// 获取IR Tag类型
const getIRTagType = (ir: number) => {
  if (ir >= 2) return 'success'
  if (ir >= 1.5) return 'primary'
  if (ir >= 1) return 'warning'
  return 'danger'
}

// ========== 因子管理相关方法 ==========

// 加载我的因子列表
const loadMyFactors = async () => {
  loadingMyFactors.value = true
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 模拟数据
    myFactors.value = [
      {
        factor_id: 1,
        factor_code: 'MOMENTUM_5D',
        factor_name: '5日动能因子',
        category_l3_name: '短期动量',
        status: 'production',
        ic_ir: 1.67,
        created_at: '2025-10-15T10:00:00Z'
      },
      {
        factor_id: 2,
        factor_code: 'VOL_STD_20D',
        factor_name: '20日波动率',
        category_l3_name: '历史波动率',
        status: 'pending',
        ic_ir: 1.2,
        created_at: '2025-10-18T14:30:00Z'
      }
    ]
  } catch (error: any) {
    ElMessage.error('加载因子列表失败: ' + error.message)
  } finally {
    loadingMyFactors.value = false
  }
}

// 获取状态Tag类型
const getStatusTagType = (status: string) => {
  const types: Record<string, any> = {
    pending: 'warning',
    testing: 'info',
    production: 'success',
    deprecated: 'danger'
  }
  return types[status] || 'info'
}

// 查看因子详情
const viewFactorDetail = (factor: any) => {
  selectedFactor.value = factor
  selectedFactorDetail.value = factor
  // 详情直接在右侧面板显示，不需要弹窗
}

// 废弃因子
const deprecateFactor = async (factor: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要废弃因子"${factor.factor_name}"吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 500))
    
    ElMessage.success('因子已废弃')
    loadMyFactors()
  } catch {
    // 用户取消
  }
}

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 清空所有标签
const clearAllTags = () => {
  selectedTags.value = []
  pagination.value.page = 1
  loadFactors()
}

// 切换标签选择
const toggleTag = (tagValue: string) => {
  const index = selectedTags.value.indexOf(tagValue)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagValue)
  }
  pagination.value.page = 1
  loadFactors()
}

// 获取标签类型的中文名
const getTagTypeLabel = (tagType: string) => {
  const labels: Record<string, string> = {
    // 基础分类
    frequency: '更新频率',
    level: '因子级别',
    attribute: '因子属性',
    computation: '计算方式',
    data_source: '数据来源',
    data_quality: '数据质量',
    
    // 应用相关
    application: '应用场景',
    strategy: '策略类型',
    usage: '使用方式',
    holding_period: '持有周期',
    universe: '股票池',
    
    // 市场相关
    industry: '行业',
    market: '市场',
    asset_class: '资产类别',
    
    // 风格相关
    style: '风格',
    factor_type: '因子类型',
    investment_style: '投资风格',
    
    // 技术相关
    complexity: '复杂度',
    stability: '稳定性',
    
    // 其他
    region: '地域',
    period: '周期',
    target: '目标'
  }
  return labels[tagType] || tagType
}

// 搜索
const handleSearch = () => {
  pagination.value.page = 1
  loadFactors()
}

// 选择因子
const selectFactor = async (factor: any) => {
  selectedFactor.value = factor
  loadingDetail.value = true
  
  try {
    const result = await window.electronAPI.factor.getFactorDetail(factor.factor_id)
    if (result.code === 200) {
      selectedFactorDetail.value = result.data
    }
  } catch (error: any) {
    console.error('加载因子详情失败:', error)
    ElMessage.error('加载因子详情失败: ' + error.message)
  } finally {
    loadingDetail.value = false
  }
}

// 显示下载对话框
const showDownloadDialog = () => {
  downloadForm.value = {
    dateRange: [],
    stock_pool: 'all'
  }
  downloadDialogVisible.value = true
}

// 下载
const handleDownload = async () => {
  if (!downloadForm.value.dateRange || downloadForm.value.dateRange.length !== 2) {
    ElMessage.warning('请选择日期范围')
    return
  }
  
  downloading.value = true
  
  try {
    const result = await window.electronAPI.factor.downloadFactorData({
      factor_ids: [selectedFactorDetail.value.factor_id],
      start_date: downloadForm.value.dateRange[0],
      end_date: downloadForm.value.dateRange[1],
      stock_pool: downloadForm.value.stock_pool
    })
    
    if (result.code === 200) {
      ElMessage.success(`下载任务创建成功！任务ID: ${result.data.task_id}`)
      downloadDialogVisible.value = false
    }
  } catch (error: any) {
    console.error('创建下载任务失败:', error)
    ElMessage.error('创建下载任务失败: ' + error.message)
  } finally {
    downloading.value = false
  }
}

// 查看性能趋势
const viewPerformanceTrend = async () => {
  if (!selectedFactorDetail.value) return
  
  performanceDialogVisible.value = true
  loadingPerformance.value = true
  
  try {
    const result = await window.electronAPI.factor.getFactorPerformance(
      selectedFactorDetail.value.factor_id,
      60
    )
    if (result.code === 200) {
      performanceData.value = result.data.performances
    }
  } catch (error: any) {
    console.error('加载性能数据失败:', error)
    ElMessage.error('加载性能数据失败: ' + error.message)
  } finally {
    loadingPerformance.value = false
  }
}

// 工具函数
const getStatusColor = (status: string) => {
  const colors: any = {
    production: 'success',
    testing: 'warning',
    deprecated: 'info',
    pending: 'primary'
  }
  return colors[status] || ''
}

const getStatusLabel = (status: string) => {
  const labels: any = {
    all: '全部',
    production: '生产环境',
    testing: '测试中',
    deprecated: '已废弃',
    pending: '待审核'
  }
  return labels[status] || status
}

const getICColor = (value?: number) => {
  if (!value) return ''
  if (value > 0.05) return 'success'
  if (value > 0.02) return 'primary'
  if (value < 0) return 'danger'
  return ''
}

// 初始化
onMounted(async () => {
  await loadCategories()  // 分类树中已包含factor_count，由后端统计
  await loadTags()
  await loadFactors()
})
</script>

<style scoped lang="scss">
.factor-library-page {
  max-width: 1800px;
  margin: 0 auto;
  padding: 0;

  .main-tabs {
    :deep(.el-tabs__content) {
      padding: 0;
    }
    
    :deep(.el-tabs__header) {
      margin-bottom: 0;
    }
  }

  .view-tabs {
    margin-bottom: 15px;
    padding: 0 20px;
    
    :deep(.el-tabs__header) {
      margin-bottom: 10px;
    }
  }

  .search-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    padding: 0 20px;
    
    .el-input {
      flex: 1;
      max-width: 500px;
    }
  }

  .content-layout {
    display: grid;
    grid-template-columns: 240px 1fr 400px;
    gap: 15px;
    padding: 0 20px 20px;
  }

  // 左侧分类树
  .left-panel {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    height: calc(100vh - 260px);
    display: flex;
    flex-direction: column;
    
    .panel-header {
      padding: 12px 15px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      height: 52px;
      box-sizing: border-box;
    }
    
    .category-tree {
      padding: 10px;
      flex: 1;
      overflow-y: auto;
      
      .tree-node {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .node-label {
          flex: 1;
        }
        
        .node-count {
          color: #909399;
          font-size: 12px;
        }
      }
    }
    
    .tags-container {
      padding: 15px;
      flex: 1;
      overflow-y: auto;
      
      .tag-group {
        margin-bottom: 20px;
        
        .tag-group-title {
          font-weight: 500;
          font-size: 14px;
          color: #303133;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e4e7ed;
        }
        
        .tag-items {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          
          .tag-item {
            cursor: pointer;
            font-size: 12px;
          }
        }
      }
    }
  }

  // 中间因子列表
  .middle-panel {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
    background: white;
    height: calc(100vh - 260px);
    display: flex;
    flex-direction: column;
    
    .panel-header {
      padding: 12px 15px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
      height: 52px;
      box-sizing: border-box;
    }
    
    .factor-list {
      padding: 15px;
      flex: 1;
      overflow-y: auto;
      
      .factor-card {
        padding: 12px 15px;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: all 0.3s;
        
        &:hover {
          border-color: #409EFF;
          box-shadow: 0 2px 12px rgba(64, 158, 255, 0.1);
        }
        
        &.active {
          border-color: #409EFF;
          background: #ecf5ff;
        }
        
        .factor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          
          .factor-code {
            font-family: monospace;
            font-weight: 600;
            font-size: 13px;
          }
        }
        
        .factor-name {
          font-size: 13px;
          color: #606266;
          margin-bottom: 6px;
        }
        
        .factor-category {
          font-size: 11px;
          color: #909399;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .factor-metrics {
          display: flex;
          gap: 8px;
        }
      }
      
      .pagination-wrapper {
        margin-top: 20px;
        display: flex;
        justify-content: center;
      }
    }
  }

  // 右侧详情
  .right-panel {
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    background: white;
    height: calc(100vh - 260px);
    display: flex;
    flex-direction: column;
    
    .panel-header {
      padding: 12px 15px;
      background: #f5f7fa;
      border-bottom: 1px solid #e4e7ed;
      font-weight: 500;
      height: 52px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
    }
    
    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    
    .empty-state {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .factor-detail {
      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 2px solid #e4e7ed;
        
        h3 {
          margin: 0;
          font-size: 18px;
        }
      }
      
      .info-section {
        margin-bottom: 20px;
        
        :deep(.el-card__header) {
          padding: 12px 15px;
          background: #f5f7fa;
        }
        
        :deep(.el-card__body) {
          padding: 15px;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .section-title {
          font-weight: 500;
          margin-bottom: 10px;
          color: #606266;
        }
        
        .tags-section {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #e4e7ed;
          
          .factor-tag {
            margin-right: 8px;
            margin-bottom: 8px;
          }
        }
      }
      
      .action-buttons {
        text-align: center;
        margin-top: 20px;
      }
    }
  }

  .performance-placeholder {
    min-height: 350px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    border-radius: 8px;
    border: 2px dashed #dcdfe6;
  }

  // ========== 回测与提交样式 ==========
  .backtest-submit-container {
    padding: 20px;

    .steps-container {
      margin-bottom: 30px;
    }

    .step-card {
      margin-top: 20px;
      
      .card-header {
        font-weight: 500;
        font-size: 16px;
      }
    }

    // 定义因子 - 左右分栏布局
    .define-layout {
      display: flex;
      gap: 20px;
      min-height: 500px;
      margin: 20px 0;

      .define-nav {
        width: 200px;
        min-width: 200px;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        padding: 10px;
        background: #fafafa;
        flex-shrink: 0;

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 15px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 8px;
          position: relative;

          &:hover {
            background: #e8f4ff;
          }

          &.active {
            background: #409eff;
            color: white;

            .nav-label {
              font-weight: 500;
            }
          }

          .nav-icon {
            font-size: 20px;
          }

          .nav-label {
            flex: 1;
            font-size: 14px;
          }

          .check-icon {
            color: #67C23A;
            font-weight: bold;
            font-size: 16px;
          }
        }
      }

      .define-content {
        flex: 1;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        padding: 30px;
        background: white;
        overflow-y: auto;
        max-height: 600px;

        .section-panel {
          .section-title {
            font-size: 18px;
            margin: 0 0 20px 0;
            color: #303133;
            border-bottom: 2px solid #409eff;
            padding-bottom: 10px;
          }

          .form-tip {
            margin-top: 8px;
          }

          .code-editor {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
          }
        }

        .tags-section {
          .tag-group-block {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e4e7ed;
            border-radius: 6px;
            background: #fafafa;

            &:last-child {
              margin-bottom: 0;
            }

            .tag-group-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;

              .tag-type-title {
                font-size: 14px;
                font-weight: 500;
                color: #303133;
              }
            }

            .tag-items-block {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
          }
        }
      }
    }

    .step-actions {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e4e7ed;
    }

    .backtest-section {
      .backtest-alert {
        margin-bottom: 20px;
      }

      .factor-info {
        margin: 20px 0;
      }

      .backtest-progress {
        margin: 30px 0;
      }

      .backtest-result {
        margin: 20px 0;

        .result-metrics {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
      }
    }

    .submit-section {
      .submit-alert {
        margin-bottom: 20px;
      }

      .final-review {
        margin: 20px 0;
      }
    }
  }

  // ========== 因子管理样式 ==========
  .manage-container {
    padding: 20px;

    .manage-filters {
      margin-bottom: 20px;
    }
  }
}
</style>
