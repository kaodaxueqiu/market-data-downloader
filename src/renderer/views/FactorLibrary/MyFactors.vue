<template>
  <div class="my-factors-page">
    <!-- 加载中 -->
    <div v-if="pageLoading" class="loading-container">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- API 不可用 -->
    <div v-else-if="!apiAvailable" class="init-container">
      <div class="init-card error-card">
        <div class="init-icon error-icon">
          <el-icon :size="80"><WarningFilled /></el-icon>
        </div>
        <h2>功能暂不可用</h2>
        <p class="init-desc">{{ apiError }}</p>
        <el-button type="primary" @click="checkStatus">
          <el-icon><Refresh /></el-icon>
          重试
        </el-button>
      </div>
    </div>

    <!-- 未初始化：引导页 -->
    <div v-else-if="!isInitialized" class="init-container">
      <div class="init-card">
        <div class="init-icon">
          <el-icon :size="80"><Box /></el-icon>
        </div>
        <h2>创建您的因子专属库</h2>
        <p class="init-desc">
          每位研究员拥有独立的因子数据库，用于管理个人因子。<br>
          点击下方按钮创建您的专属因子库。
        </p>
        <div class="init-info" v-if="dbStatus">
          <el-tag type="info">{{ dbStatus.user_name }}</el-tag>
          <el-tag type="warning">{{ dbStatus.database_name }}</el-tag>
        </div>
        <el-button 
          type="primary" 
          size="large" 
          @click="handleInit"
          :loading="initLoading"
        >
          <el-icon><Plus /></el-icon>
          创建因子库
        </el-button>
      </div>
    </div>

    <!-- 已初始化：三栏布局 -->
    <div v-else class="main-content">
      <!-- 状态Tab + 新建按钮 -->
      <div class="tabs-header">
        <div class="nav-tabs">
          <button 
            class="nav-tab"
            :class="{ active: currentStatus === 'all' }"
            @click="handleStatusChange('all')"
          >
            <el-icon><Grid /></el-icon>
            <span>全部 ({{ statusCounts.all }})</span>
          </button>
          <button 
            class="nav-tab"
            :class="{ active: currentStatus === 'created' }"
            @click="handleStatusChange('created')"
          >
            <el-icon><EditPen /></el-icon>
            <span>已创建 ({{ statusCounts.created }})</span>
          </button>
          <button 
            class="nav-tab"
            :class="{ active: currentStatus === 'backtested' }"
            @click="handleStatusChange('backtested')"
          >
            <el-icon><CircleCheck /></el-icon>
            <span>已回测 ({{ statusCounts.backtested }})</span>
          </button>
        </div>
        <div class="header-actions">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索因子..."
            clearable
            style="width: 200px"
            @keyup.enter="loadFactors"
            @clear="loadFactors"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">
            新建因子
          </el-button>
          <el-button type="success" :icon="Upload" @click="openBatchUploadDialog">
            批量上传
          </el-button>
        </div>
      </div>

      <!-- 三栏布局 -->
      <div class="content-layout">
        <!-- 左侧：分类/标签 -->
        <div class="left-panel">
          <!-- Tab 切换 -->
          <div class="left-panel-tabs">
            <button 
              class="panel-tab" 
              :class="{ active: leftPanelTab === 'category' }"
              @click="switchLeftPanel('category')"
            >
              <el-icon><Folder /></el-icon>
              分类
            </button>
            <button 
              class="panel-tab" 
              :class="{ active: leftPanelTab === 'tag' }"
              @click="switchLeftPanel('tag')"
            >
              <el-icon><PriceTag /></el-icon>
              标签
            </button>
          </div>
          
          <!-- 分类面板 -->
          <template v-if="leftPanelTab === 'category'">
            <div class="panel-header">
              <span>因子分类</span>
              <div class="header-actions">
                <el-button text size="small" :icon="Plus" @click="openAddRootCategory">
                  新建
                </el-button>
                <el-button text size="small" @click="refreshCategories" :loading="loadingCategories">
                  <el-icon><Refresh /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="category-tree" v-loading="loadingCategories">
              <el-tree
                ref="treeRef"
                :data="categories"
                :props="{ children: 'children', label: 'name' }"
                :expand-on-click-node="false"
                node-key="id"
                highlight-current
                @node-click="handleCategoryClick"
                @node-contextmenu="handleCategoryContextMenu"
              >
              <template #default="{ data }">
                <div class="tree-node">
                  <span class="node-label">{{ data.name }}</span>
                  <span class="node-count" v-if="data.factor_count !== undefined">
                    ({{ data.factor_count }})
                  </span>
                  <el-tag v-if="data.is_system" size="small" type="info" style="margin-left: 4px">系统</el-tag>
                </div>
              </template>
              </el-tree>
            </div>
          </template>
          
          <!-- 标签面板 -->
          <template v-if="leftPanelTab === 'tag'">
            <div class="panel-header">
              <span>因子标签</span>
              <div class="header-actions">
                <el-button text size="small" :icon="Plus" @click="openAddTagDialog">
                  新建
                </el-button>
                <el-button text size="small" @click="clearTagFilter">
                  <el-icon><Refresh /></el-icon>
                  重置
                </el-button>
              </div>
            </div>
            <div class="tag-list" v-loading="loadingTags">
              <el-collapse v-model="expandedTagGroups">
                <el-collapse-item 
                  v-for="group in groupedTags" 
                  :key="group.type" 
                  :name="group.type"
                >
                  <template #title>
                    <div class="tag-group-title">
                      <span>{{ group.label }}</span>
                      <el-tag size="small" type="info" round>{{ group.tags.length }}</el-tag>
                    </div>
                  </template>
                  <div 
                    v-for="tag in group.tags" 
                    :key="tag.tag_id" 
                    class="tag-item"
                    :class="{ active: selectedTagId === tag.tag_id }"
                    @click="handleTagClick(tag)"
                    @contextmenu.prevent="handleTagContextMenu($event, tag)"
                  >
                    <span class="tag-name">{{ tag.tag_name }}</span>
                    <el-tag v-if="tag.is_system" size="small" type="info">系统</el-tag>
                  </div>
                </el-collapse-item>
              </el-collapse>
              <el-empty v-if="tags.length === 0" description="暂无标签" :image-size="60" />
            </div>
          </template>
          
          <!-- 分类右键菜单 -->
          <div 
            v-if="contextMenuVisible" 
            class="context-menu"
            :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
          >
            <div class="menu-item" @click="handleAddSubCategory" v-if="contextMenuNode?.level < 3">
              <el-icon><Plus /></el-icon>
              <span>新建子分类</span>
            </div>
            <div class="menu-item" @click="handleEditCategory" :class="{ disabled: contextMenuNode?.is_system }">
              <el-icon><Edit /></el-icon>
              <span>编辑</span>
            </div>
            <div class="menu-item danger" @click="handleDeleteCategory" :class="{ disabled: contextMenuNode?.is_system }">
              <el-icon><Delete /></el-icon>
              <span>删除</span>
            </div>
          </div>
          
          <!-- 标签右键菜单 -->
          <div 
            v-if="tagContextMenuVisible" 
            class="context-menu"
            :style="{ left: tagContextMenuPosition.x + 'px', top: tagContextMenuPosition.y + 'px' }"
          >
            <div class="menu-item" @click="handleEditTag" :class="{ disabled: tagContextMenuNode?.is_system }">
              <el-icon><Edit /></el-icon>
              <span>编辑</span>
            </div>
            <div class="menu-item danger" @click="handleDeleteTag" :class="{ disabled: tagContextMenuNode?.is_system }">
              <el-icon><Delete /></el-icon>
              <span>删除</span>
            </div>
          </div>
        </div>

        <!-- 中间：因子列表 -->
        <div class="middle-panel">
          <div class="panel-header">
            <div class="header-left">
              <el-checkbox 
                v-model="selectAllChecked" 
                :indeterminate="isIndeterminate"
                :loading="selectingAll"
                @change="handleSelectAll"
              />
              <span>因子列表</span>
              <span class="factor-count">共 {{ total }} 个</span>
            </div>
            <div class="header-right" v-if="selectedFactorIds.length > 0">
              <el-tag type="primary" size="small">已选 {{ selectedFactorIds.length }} 个</el-tag>
              <el-button type="success" size="small" :icon="DataAnalysis" @click="openBatchBacktest">
                批量回测
              </el-button>
              <el-button type="danger" size="small" :icon="Delete" @click="handleBatchDelete" :loading="batchDeleting">
                批量删除
              </el-button>
              <el-button size="small" text @click="clearSelection">清空</el-button>
            </div>
          </div>
          <div class="factor-list" v-loading="loading">
            <div
              v-for="factor in factors"
              :key="factor.factor_id"
              class="factor-card"
              :class="{ 
                active: selectedFactor?.factor_id === factor.factor_id,
                selected: selectedFactorIds.includes(factor.factor_id)
              }"
              @click="selectFactor(factor)"
            >
              <div class="factor-header">
                <el-checkbox 
                  :model-value="selectedFactorIds.includes(factor.factor_id)"
                  @click.stop
                  @change="(val: boolean) => toggleFactorSelection(factor, val)"
                />
                <div class="factor-code">{{ factor.factor_code }}</div>
                <el-tag size="small" :type="getStatusType(factor.status)">
                  {{ getStatusLabel(factor.status) }}
                </el-tag>
              </div>
              <div class="factor-name">{{ factor.factor_name }}</div>
              <div class="factor-category">
                {{ factor.category_l1_name }} / {{ factor.category_l2_name }} / {{ factor.category_l3_name }}
              </div>
              <div class="factor-metrics" v-if="factor.rank_ic_ir">
                <el-tag size="small" type="success" effect="plain">
                  Rank IC IR: {{ factor.rank_ic_ir?.toFixed(2) || '-' }}
                </el-tag>
              </div>
              <div class="factor-time">
                更新: {{ formatTime(factor.updated_at) }}
              </div>
            </div>
            
            <!-- 空状态 -->
            <el-empty 
              v-if="!loading && factors.length === 0" 
              :description="getEmptyDescription()"
              :image-size="100"
            >
              <el-button v-if="currentStatus === 'all'" type="primary" @click="openCreateDialog">
                <el-icon><Plus /></el-icon>
                创建第一个因子
              </el-button>
            </el-empty>
          </div>
          
          <!-- 分页固定在底部 -->
          <div v-if="total > pageSize" class="pagination-footer">
            <el-pagination
              v-model:current-page="page"
              :page-size="pageSize"
              :total="total"
              layout="total, prev, pager, next"
              small
              @current-change="loadFactors"
            />
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
                <h3>{{ currentFactorDetail?.factor_name || selectedFactor.factor_name }}</h3>
                <el-tag :type="getStatusType(currentFactorDetail?.status || selectedFactor.status)" size="large">
                  {{ getStatusLabel(currentFactorDetail?.status || selectedFactor.status) }}
                </el-tag>
              </div>

              <!-- 基本信息 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>基本信息</span>
                </template>
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="因子代码">
                    <el-text style="font-family: monospace; font-weight: 600; color: #409eff;">
                      {{ currentFactorDetail?.factor_code }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="英文名称">
                    {{ currentFactorDetail?.factor_name_en || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="分类">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      <el-tag size="small">{{ currentFactorDetail?.category_l1_name }}</el-tag>
                      <el-tag size="small" type="success">{{ currentFactorDetail?.category_l2_name }}</el-tag>
                      <el-tag size="small" type="warning">{{ currentFactorDetail?.category_l3_name }}</el-tag>
                    </div>
                  </el-descriptions-item>
                  <el-descriptions-item label="标签">
                    <div v-if="currentFactorDetail?.tags && currentFactorDetail.tags.length > 0" style="display: flex; flex-wrap: wrap; gap: 4px;">
                      <el-tag 
                        v-for="tag in currentFactorDetail.tags" 
                        :key="tag.tag_id" 
                        :type="getTagTypeColor(tag.tag_type)" 
                        size="small"
                      >
                        {{ tag.tag_name }}
                      </el-tag>
                    </div>
                    <span v-else style="color: #909399;">-</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="开发者">
                    {{ currentFactorDetail?.created_by || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="描述">
                    {{ currentFactorDetail?.description || '-' }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 因子表达式 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>因子表达式</span>
                </template>
                <pre class="expression-code">{{ currentFactorDetail?.expression || '-' }}</pre>
              </el-card>

              <!-- 数据依赖 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>数据依赖</span>
                </template>
                <div v-if="hasDataSources(currentFactorDetail?.data_sources)" class="data-sources-display">
                  <div 
                    v-for="(info, tableName) in parseDataSourcesForDisplay(currentFactorDetail.data_sources)" 
                    :key="tableName"
                    class="source-item"
                  >
                    <div class="table-name">{{ tableName }}</div>
                    <div v-if="info.date_field || info.code_field" class="key-fields">
                      <el-tag v-if="info.date_field" size="small" type="warning">
                        日期: {{ info.date_field }}
                      </el-tag>
                      <el-tag v-if="info.code_field" size="small" type="success">
                        代码: {{ info.code_field }}
                      </el-tag>
                    </div>
                    <div class="field-tags">
                      <el-tag 
                        v-for="field in info.fields" 
                        :key="field" 
                        size="small" 
                        type="info"
                      >
                        {{ field }}
                      </el-tag>
                    </div>
                  </div>
                </div>
                <div v-else class="no-data">暂无数据依赖</div>
              </el-card>

              <!-- 性能指标（最近一次回测） -->
              <el-card v-if="currentFactorDetail?.status === 'backtested'" shadow="never" class="info-section">
                <template #header>
                  <div class="section-header-with-tip">
                    <span>性能指标</span>
                    <el-tag size="small" type="info">最近一次回测</el-tag>
                  </div>
                </template>
                
                <!-- 多周期选择器 -->
                <div v-if="availablePeriods.length > 0" class="period-selector">
                  <span class="period-label">预测周期：</span>
                  <el-segmented v-model="selectedPeriod" :options="periodOptions" size="small" />
                </div>
                
                <!-- 有多周期数据时显示选中周期的指标 -->
                <el-descriptions v-if="currentPeriodStats" :column="2" size="small" border>
                  <el-descriptions-item label="Rank IC均值">
                    {{ currentPeriodStats.rank_ic_mean?.toFixed(4) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="Rank IC IR">
                    <el-text type="success" style="font-weight: bold;">
                      {{ currentPeriodStats.rank_ic_ir?.toFixed(2) || '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="夏普比率">
                    {{ currentPeriodStats.sharpe_ratio?.toFixed(2) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最大回撤">
                    <el-text type="danger">
                      {{ currentPeriodStats.max_drawdown ? (currentPeriodStats.max_drawdown * 100).toFixed(2) + '%' : '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="年化收益">
                    <el-text :type="currentPeriodStats.annual_return > 0 ? 'success' : 'danger'">
                      {{ currentPeriodStats.annual_return ? (currentPeriodStats.annual_return * 100).toFixed(2) + '%' : '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="胜率">
                    {{ currentPeriodStats.win_rate ? (currentPeriodStats.win_rate * 100).toFixed(2) + '%' : '-' }}
                  </el-descriptions-item>
                </el-descriptions>
                
                <!-- 降级：无多周期数据时显示汇总指标 -->
                <el-descriptions v-else :column="2" size="small" border>
                  <el-descriptions-item label="Rank IC均值">
                    {{ currentFactorDetail?.rank_ic_mean?.toFixed(4) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="Rank IC IR">
                    <el-text type="success" style="font-weight: bold;">
                      {{ currentFactorDetail?.rank_ic_ir?.toFixed(2) || '-' }}
                    </el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="夏普比率">
                    {{ currentFactorDetail?.sharpe_ratio?.toFixed(2) || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="最大回撤">
                    <el-text type="danger">
                      {{ currentFactorDetail?.max_drawdown ? (currentFactorDetail.max_drawdown * 100).toFixed(2) + '%' : '-' }}
                    </el-text>
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 版本信息 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <span>版本信息</span>
                </template>
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item label="因子ID">
                    {{ currentFactorDetail?.factor_id }}
                  </el-descriptions-item>
                  <el-descriptions-item label="版本">
                    {{ currentFactorDetail?.version || '1.0' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="创建时间">
                    {{ formatFullTime(currentFactorDetail?.created_at) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="更新时间">
                    {{ formatFullTime(currentFactorDetail?.updated_at) }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-card>

              <!-- 回测历史 -->
              <el-card shadow="never" class="info-section">
                <template #header>
                  <div class="section-header-with-action">
                    <span>回测历史</span>
                    <el-button text type="primary" size="small" @click="loadBacktestHistory" :loading="loadingBacktestHistory">
                      <el-icon><Refresh /></el-icon>
                      刷新
                    </el-button>
                  </div>
                </template>
                <div v-loading="loadingBacktestHistory">
                  <el-table 
                    v-if="backtestHistory.length > 0" 
                    :data="backtestHistory" 
                    size="small" 
                    style="width: 100%"
                    max-height="250"
                  >
                    <el-table-column prop="created_at" label="回测时间" width="150" />
                    <el-table-column prop="status" label="状态" width="70">
                      <template #default="{ row }">
                        <el-tag :type="getBacktestStatusType(row.status)" size="small">
                          {{ getBacktestStatusLabel(row.status) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="universe" label="股票池" width="80">
                      <template #default="{ row }">
                        {{ getUniverseName(row.universe) }}
                      </template>
                    </el-table-column>
                    <el-table-column label="Rank IC" width="90">
                      <template #default="{ row }">
                        {{ row.factor_result?.rank_ic_mean?.toFixed(4) || '-' }}
                      </template>
                    </el-table-column>
                    <el-table-column label="夏普" width="80">
                      <template #default="{ row }">
                        <el-text :type="(row.factor_result?.sharpe_ratio || 0) > 0 ? 'success' : 'danger'">
                          {{ row.factor_result?.sharpe_ratio?.toFixed(2) || '-' }}
                        </el-text>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="80" fixed="right">
                      <template #default="{ row }">
                        <el-button 
                          text 
                          type="primary" 
                          size="small" 
                          :disabled="row.status === 'pending' || row.status === 'running'"
                          @click="goToBacktestResult(row.task_id)"
                        >
                          详情
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-empty v-else description="暂无回测历史" :image-size="60" />
                </div>
              </el-card>

              <!-- 操作按钮 -->
              <div class="action-buttons">
                <el-button 
                  type="primary" 
                  :icon="Edit"
                  @click="handleEdit(currentFactorDetail)"
                >
                  编辑
                </el-button>
                <el-button 
                  type="success" 
                  :icon="DataAnalysis"
                  @click="goToBacktest(currentFactorDetail)"
                >
                  发起回测
                </el-button>
                <el-button 
                  type="danger" 
                  :icon="Delete"
                  @click="handleDelete(currentFactorDetail)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="isEdit ? '编辑因子' : '新建因子'"
      width="700px"
      destroy-on-close
    >
      <el-form 
        ref="formRef" 
        :model="form" 
        :rules="rules" 
        label-position="top"
        size="large"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="因子代码" prop="factor_code">
              <el-input 
                v-model="form.factor_code" 
                placeholder="英文代码，如 momentum_5d"
                :disabled="isEdit"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="因子名称" prop="factor_name">
              <el-input v-model="form.factor_name" placeholder="中文名称，如 5日动量" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="因子分类" prop="category_l3_id">
          <el-cascader
            v-model="categoryValue"
            :options="categories"
            :props="{ value: 'id', label: 'name', children: 'children' }"
            placeholder="选择三级分类"
            style="width: 100%"
            @change="handleFormCategoryChange"
          />
        </el-form-item>

        <el-form-item label="因子表达式" prop="expression">
          <el-input 
            v-model="form.expression" 
            type="textarea" 
            :rows="6"
            placeholder="输入因子表达式，如：(close - lag(close, 5)) / lag(close, 5)"
          />
        </el-form-item>

        <el-form-item label="因子描述">
          <el-input 
            v-model="form.description" 
            type="textarea" 
            :rows="3"
            placeholder="可选，描述因子的含义和用途"
          />
        </el-form-item>

        <!-- 数据依赖（必填） -->
        <div class="data-sources-section">
          <div class="section-header">
            <el-icon><Connection /></el-icon>
            <span class="required-label">数据源配置</span>
            <el-dropdown @command="handleAddDataSource" class="add-datasource-dropdown">
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
          <div class="section-body">
            <div v-for="(source, index) in dataSources" :key="index" class="datasource-item" :class="{ 'intraday-mode': source.mode === 'intraday' }">
              <div class="datasource-header">
                <span class="datasource-title">数据源 {{ index + 1 }}: {{ source.table || '未选择' }}</span>
                <el-tag 
                  :type="source.mode === 'intraday' ? 'warning' : 'info'" 
                  size="small"
                  effect="plain"
                >
                  {{ source.mode === 'intraday' ? '日内时段筛选' : '日频数据' }}
                </el-tag>
                <el-button 
                  v-if="dataSources.length > 1"
                  type="danger" 
                  size="small" 
                  text 
                  :icon="Delete"
                  @click="removeDataSource(index)"
                />
              </div>
              <!-- 表名搜索 -->
              <el-form-item label="选择表" label-width="70px">
                <el-button type="primary" plain @click="openSearchDialog(index)">
                  <el-icon><Search /></el-icon>
                  搜索数据表
                </el-button>
              </el-form-item>
              <!-- 已选表信息 -->
              <div v-if="source.table" class="selected-table-info">
                <el-tag type="success" effect="light" closable @close="clearSelectedTable(index)">
                  {{ source.table }}
                </el-tag>
                <el-tag type="info">{{ source.database || 'clickhouse' }}</el-tag>
              </div>
              <!-- 字段选择 -->
              <el-form-item label="字段" label-width="70px">
                <el-select 
                  v-model="source.fields" 
                  multiple 
                  filterable
                  placeholder="选择字段"
                  style="width: 100%;"
                  :loading="source.loadingFields"
                >
                  <el-option 
                    v-for="f in source.availableFields" 
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
                  <el-select v-model="source.date_field" filterable placeholder="必选" style="width: 100%">
                    <el-option 
                      v-for="f in source.availableFields" 
                      :key="f.column_name" 
                      :label="f.column_name" 
                      :value="f.column_name" 
                    />
                  </el-select>
                </div>
                <div class="field-item">
                  <span class="field-label"><span class="required">*</span>代码字段</span>
                  <el-select v-model="source.code_field" filterable placeholder="必选" style="width: 100%">
                    <el-option 
                      v-for="f in source.availableFields" 
                      :key="f.column_name" 
                      :label="f.column_name" 
                      :value="f.column_name" 
                    />
                  </el-select>
                </div>
              </div>
              
              <!-- 时段筛选配置（仅 intraday 模式显示） -->
              <template v-if="source.mode === 'intraday'">
                <div class="time-filter-section">
                  <!-- 时间字段选择 -->
                  <div class="time-field-row">
                    <span class="field-label"><span class="required">*</span>时间字段</span>
                    <el-select 
                      v-model="source.time_field" 
                      filterable 
                      placeholder="选择时间字段（如 trade_time）"
                      style="width: 200px;"
                    >
                      <el-option 
                        v-for="f in source.availableFields" 
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
                        v-model="source.time_start"
                        placeholder="09:30"
                        style="width: 100px;"
                        maxlength="5"
                      />
                      <span class="range-separator">~</span>
                      <el-input
                        v-model="source.time_end"
                        placeholder="10:00"
                        style="width: 100px;"
                        maxlength="5"
                      />
                    </div>
                  </div>
                  
                  <!-- 提示信息 -->
                  <div class="time-filter-hint">
                    <el-icon><WarningFilled /></el-icon>
                    <span>分钟级数据将按指定时段筛选后，自动聚合为日频数据</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <el-form-item label="因子标签">
          <el-select
            v-model="form.tag_ids"
            multiple
            filterable
            placeholder="选择标签（可多选）"
            style="width: 100%"
          >
            <el-option-group
              v-for="group in groupedTags"
              :key="group.type"
              :label="group.label"
            >
              <el-option
                v-for="tag in group.tags"
                :key="tag.tag_id"
                :label="tag.tag_name"
                :value="tag.tag_id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>

        <el-form-item label="英文名称">
          <el-input v-model="form.factor_name_en" placeholder="可选，如 5-Day Momentum" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 分类管理对话框 -->
    <el-dialog
      v-model="categoryDialogVisible"
      :title="categoryDialogTitle"
      width="500px"
      destroy-on-close
    >
      <el-form :model="categoryForm" label-width="80px">
        <el-form-item label="分类代码" required>
          <el-input 
            v-model="categoryForm.code" 
            placeholder="英文代码，如 custom_factor"
            :disabled="isCategoryEdit"
          />
        </el-form-item>
        <el-form-item label="分类名称" required>
          <el-input v-model="categoryForm.name" placeholder="中文名称" />
        </el-form-item>
        <el-form-item label="英文名称">
          <el-input v-model="categoryForm.name_en" placeholder="可选" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="categoryForm.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="categoryForm.sort_order" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCategory" :loading="categorySubmitting">
          {{ isCategoryEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 标签管理对话框 -->
    <el-dialog
      v-model="tagDialogVisible"
      :title="tagDialogTitle"
      width="500px"
      destroy-on-close
    >
      <el-form :model="tagForm" label-width="80px">
        <el-form-item label="标签类型" required>
          <el-select v-model="tagForm.tag_type" :disabled="isTagEdit" style="width: 100%">
            <el-option label="自定义" value="custom" />
            <el-option label="频率" value="frequency" />
            <el-option label="数据来源" value="data_source" />
            <el-option label="市场" value="market" />
            <el-option label="策略" value="strategy" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签代码" required>
          <el-input 
            v-model="tagForm.tag_code" 
            placeholder="英文代码，如 daily"
            :disabled="isTagEdit"
          />
        </el-form-item>
        <el-form-item label="标签名称" required>
          <el-input v-model="tagForm.tag_name" placeholder="中文名称" />
        </el-form-item>
        <el-form-item label="英文名称">
          <el-input v-model="tagForm.tag_name_en" placeholder="可选" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="tagForm.description" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="tagForm.sort_order" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTag" :loading="tagSubmitting">
          {{ isTagEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 回测配置对话框 -->
    <el-dialog
      v-model="backtestDialogVisible"
      :title="backtestFactors.length > 1 ? `批量回测（${backtestFactors.length}个因子）` : '发起因子回测'"
      width="650px"
      destroy-on-close
    >
      <div class="backtest-dialog-content">
        <!-- 单因子信息 -->
        <div class="factor-info" v-if="backtestFactors.length === 1">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="因子代码">{{ backtestFactors[0].factor_code }}</el-descriptions-item>
            <el-descriptions-item label="因子名称">{{ backtestFactors[0].factor_name }}</el-descriptions-item>
            <el-descriptions-item label="因子表达式" :span="2">
              <code class="expression-code">{{ backtestFactors[0].expression }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="数据依赖" :span="2">
              <div v-if="parsedBacktestDataSources.length > 0" class="data-sources-list">
                <div v-for="(ds, idx) in parsedBacktestDataSources" :key="idx" class="data-source-item">
                  <el-tag size="small" type="primary">{{ ds.table }}</el-tag>
                  <span class="ds-fields">{{ ds.fields.join(', ') }}</span>
                </div>
              </div>
              <span v-else style="color: #909399;">无</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>
        
        <!-- 批量因子列表 -->
        <div class="batch-factors-info" v-if="backtestFactors.length > 1">
          <div class="batch-header">
            <span>已选因子（{{ backtestFactors.length }}个）</span>
          </div>
          <div class="batch-list">
            <div v-for="factor in backtestFactors" :key="factor.factor_id" class="batch-item">
              <el-tag size="small">{{ factor.factor_code }}</el-tag>
              <span class="batch-name">{{ factor.factor_name }}</span>
            </div>
          </div>
        </div>
        
        <el-form :model="backtestForm" label-width="100px" style="margin-top: 16px;">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="开始日期" required>
                <el-date-picker
                  v-model="backtestForm.start_date"
                  type="date"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="结束日期" required>
                <el-date-picker
                  v-model="backtestForm.end_date"
                  type="date"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-form-item label="股票池">
            <el-tabs v-model="stockPoolTab" @tab-change="handleStockPoolTabChange" class="stock-pool-tabs-mini">
              <el-tab-pane label="标准指数" name="index">
                <el-radio-group v-model="backtestForm.universe_preset" v-loading="stockPoolsLoading" class="pool-radio-list-mini">
                  <el-radio 
                    v-for="pool in stockPoolData?.index?.pools || []" 
                    :key="pool.id" 
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </el-radio>
                </el-radio-group>
              </el-tab-pane>
              <el-tab-pane label="申万行业" name="industry">
                <el-radio-group v-model="backtestForm.universe_preset" v-loading="stockPoolsLoading" class="pool-radio-grid-mini">
                  <el-radio 
                    v-for="pool in stockPoolData?.industry?.pools || []" 
                    :key="pool.id" 
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </el-radio>
                </el-radio-group>
              </el-tab-pane>
            </el-tabs>
          </el-form-item>
          
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="分组数">
                <el-input-number v-model="backtestForm.num_groups" :min="2" :max="20" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="因子方向">
                <el-select v-model="backtestForm.factor_direction" style="width: 100%">
                  <el-option label="自动判断" value="auto" />
                  <el-option label="正向（值大=好）" value="positive" />
                  <el-option label="负向（值小=好）" value="negative" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-form-item label="预测周期">
            <el-select v-model="backtestForm.forward_periods" multiple style="width: 100%">
              <el-option label="1日" :value="1" />
              <el-option label="5日" :value="5" />
              <el-option label="10日" :value="10" />
              <el-option label="20日" :value="20" />
              <el-option label="60日" :value="60" />
            </el-select>
          </el-form-item>
          
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="买入价格">
                <el-select v-model="backtestForm.buy_price_type" style="width: 100%">
                  <el-option 
                    v-for="opt in buyPriceTypes" 
                    :key="opt.value" 
                    :label="opt.label" 
                    :value="opt.value" 
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="卖出价格">
                <el-select v-model="backtestForm.sell_price_type" style="width: 100%">
                  <el-option 
                    v-for="opt in sellPriceTypes" 
                    :key="opt.value" 
                    :label="opt.label" 
                    :value="opt.value" 
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-form-item label="基准指数">
            <el-tabs v-model="benchmarkTab" class="benchmark-tabs-mini">
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
                <el-tabs v-model="industryIndexTab" type="card" class="industry-sub-tabs-mini">
                  <el-tab-pane 
                    v-for="idx in indexList" 
                    :key="idx.code" 
                    :label="idx.label" 
                    :name="idx.code"
                  >
                    <el-checkbox-group v-model="selectedBenchmarks" class="industry-grid-mini">
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
            <div style="color: #909399; font-size: 12px; margin-top: 4px;">
              选择基准计算超额收益，可多选
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
        </el-form>
        
        <el-alert
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 12px"
        >
          <template #title>
            因子表达式和数据依赖将自动从因子库读取，回测完成后会自动更新因子绩效指标
          </template>
        </el-alert>
      </div>
      
      <template #footer>
        <el-button @click="backtestDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitBacktest" :loading="backtestSubmitting">
          提交回测
        </el-button>
      </template>
    </el-dialog>

    <!-- 表搜索对话框 -->
    <el-dialog
      v-model="searchDialogVisible"
      title="搜索数据表"
      width="800px"
      destroy-on-close
      class="search-dialog"
    >
      <div class="search-dialog-content">
        <div class="search-header">
          <el-input
            v-model="dialogSearchKeyword"
            placeholder="输入表名或描述进行搜索"
            clearable
            @keyup.enter="doDialogSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
            <template #append>
              <el-button :loading="dialogSearchLoading" @click="doDialogSearch">搜索</el-button>
            </template>
          </el-input>
        </div>
        
        <div class="search-results">
          <div v-if="dialogSearchLoading" class="results-loading">
            <el-icon class="is-loading" :size="32"><Loading /></el-icon>
            <span>搜索中...</span>
          </div>
          
          <div v-else-if="!dialogSearchKeyword" class="results-hint">
            <el-icon :size="48"><Search /></el-icon>
            <span>请输入关键词搜索数据表</span>
          </div>
          
          <div v-else-if="dialogSearchResults.length === 0" class="results-empty">
            <el-icon :size="48"><Box /></el-icon>
            <span>未找到匹配的数据表</span>
          </div>
          
          <div v-else class="results-content">
            <div 
              v-for="item in dialogSearchResults" 
              :key="item.table_name"
              class="table-card"
              @click="selectSearchResult(item)"
            >
              <div class="card-header">
                <span class="table-name">{{ item.table_name }}</span>
                <el-tag size="small" type="info">{{ item.database || 'clickhouse' }}</el-tag>
              </div>
              <div class="card-body">
                <div class="table-comment">{{ item.table_comment || item.description || '暂无描述' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 批量上传对话框 -->
    <el-dialog
      v-model="batchUploadDialogVisible"
      title="批量上传因子"
      width="900px"
      destroy-on-close
    >
      <div class="batch-upload-content">
        <!-- 步骤说明 -->
        <el-steps :active="uploadStep" align-center style="margin-bottom: 20px;">
          <el-step title="下载模板" :icon="Download" />
          <el-step title="填写数据" :icon="Document" />
          <el-step title="上传文件" :icon="Upload" />
        </el-steps>

        <!-- 模板下载区 -->
        <el-card shadow="never" class="upload-section">
          <template #header>
            <span>第一步：下载 Excel 模板</span>
          </template>
          <div class="template-info">
            <p>请先下载模板文件，按照模板格式填写因子数据后上传。</p>
            <el-button type="primary" :icon="Download" @click="downloadTemplate">
              下载因子模板
            </el-button>
          </div>
          <div class="template-fields">
            <div class="field-title">模板字段说明：</div>
            <el-table :data="templateFields" size="small" border>
              <el-table-column prop="field" label="字段名" width="150" />
              <el-table-column prop="required" label="必填" width="60">
                <template #default="{ row }">
                  <el-tag :type="row.required ? 'danger' : 'info'" size="small">
                    {{ row.required ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="说明" />
              <el-table-column prop="example" label="示例" width="200" />
            </el-table>
          </div>
        </el-card>

        <!-- 文件上传区 -->
        <el-card shadow="never" class="upload-section" style="margin-top: 16px;">
          <template #header>
            <span>第二步：上传填写好的 Excel 文件</span>
          </template>
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :limit="1"
            accept=".xlsx,.xls"
            :on-change="handleFileChange"
            :on-exceed="handleExceed"
          >
            <el-icon class="el-icon--upload" :size="48"><Upload /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或 <em>点击选择文件</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                仅支持 .xlsx 或 .xls 格式的 Excel 文件
              </div>
            </template>
          </el-upload>
        </el-card>

        <!-- 预览区 -->
        <el-card v-if="parsedFactors.length > 0" shadow="never" class="upload-section" style="margin-top: 16px;">
          <template #header>
            <div class="preview-header">
              <span>数据预览（共 {{ parsedFactors.length }} 条）</span>
              <div>
                <el-tag type="success" v-if="validCount > 0">有效: {{ validCount }}</el-tag>
                <el-tag type="danger" v-if="invalidCount > 0" style="margin-left: 8px;">无效: {{ invalidCount }}</el-tag>
              </div>
            </div>
          </template>
          <el-table :data="parsedFactors" size="small" border max-height="300" :row-class-name="getRowClassName">
            <el-table-column prop="rowNum" label="行号" width="60" />
            <el-table-column prop="factor_code" label="因子代码" width="120" />
            <el-table-column prop="factor_name" label="因子名称" width="150" />
            <el-table-column prop="expression" label="表达式" show-overflow-tooltip />
            <el-table-column prop="error" label="校验结果" width="150">
              <template #default="{ row }">
                <el-text v-if="row.error" type="danger">{{ row.error }}</el-text>
                <el-text v-else type="success">通过</el-text>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <template #footer>
        <el-button @click="batchUploadDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="submitBatchUpload" 
          :loading="batchUploading"
          :disabled="validCount === 0"
        >
          上传 {{ validCount }} 个因子
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { 
  Loading, Box, Plus, Search, Edit, Delete, DataAnalysis, WarningFilled, Refresh,
  Grid, EditPen, CircleCheck, Connection, Folder, PriceTag, Upload, Download, Document, Clock
} from '@element-plus/icons-vue'

const router = useRouter()

// 页面状态
const pageLoading = ref(true)
const isInitialized = ref(false)
const dbStatus = ref<{ initialized: boolean; database_name: string; user_name: string } | null>(null)
const initLoading = ref(false)
const apiAvailable = ref(true)
const apiError = ref('')

// 因子列表
const loading = ref(false)
const loadingCategories = ref(false)
const loadingDetail = ref(false)
const loadingBacktestHistory = ref(false)
const backtestHistory = ref<any[]>([])

const factors = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const currentStatus = ref('all')
const searchKeyword = ref('')
const selectedCategoryId = ref<number | null>(null)

// 选中的因子（单选，用于显示详情）
const selectedFactor = ref<any>(null)
const currentFactorDetail = ref<any>(null)

// 选中的分类级别（1, 2, 3）
const selectedCategoryLevel = ref<number | null>(null)

// 性能指标 - 多周期选择
const selectedPeriod = ref<number>(1)  // 当前选择的预测周期

// 获取多周期数据：优先从因子详情，否则从最新回测历史记录的 factor_result
const latestPeriodStats = computed(() => {
  // 先尝试从因子详情获取
  const factorStats = currentFactorDetail.value?.period_ic_stats || currentFactorDetail.value?.period_stats
  if (Array.isArray(factorStats) && factorStats.length > 0) {
    return factorStats
  }
  // 降级：从最新的回测历史记录的 factor_result 获取
  if (backtestHistory.value.length > 0) {
    const latestRecord = backtestHistory.value[0]
    // 新数据结构：period_ic_stats 在 factor_result 里面
    const periodStats = latestRecord.factor_result?.period_ic_stats || latestRecord.period_stats
    if (Array.isArray(periodStats) && periodStats.length > 0) {
      return periodStats
    }
  }
  return []
})

const availablePeriods = computed(() => {
  const stats = latestPeriodStats.value
  if (Array.isArray(stats) && stats.length > 0) {
    return stats.map((s: any) => s.period).sort((a: number, b: number) => a - b)
  }
  return []
})
const periodOptions = computed(() => {
  return availablePeriods.value.map((p: number) => ({
    label: `${p}日`,
    value: p
  }))
})
const currentPeriodStats = computed(() => {
  const stats = latestPeriodStats.value
  if (Array.isArray(stats) && stats.length > 0) {
    return stats.find((s: any) => s.period === selectedPeriod.value) || stats[0]
  }
  return null
})

// 批量选择（多选，用于批量操作）
const selectedFactorIds = ref<number[]>([])
const selectedFactorsData = ref<any[]>([])

// 全选状态（基于总数，而不是当前页）
const selectAllChecked = computed({
  get: () => total.value > 0 && selectedFactorIds.value.length === total.value,
  set: () => {}
})
const isIndeterminate = computed(() => {
  return selectedFactorIds.value.length > 0 && selectedFactorIds.value.length < total.value
})

// 分类
const categories = ref<any[]>([])
const categoryValue = ref<number[]>([])
const treeRef = ref()

// 左侧面板Tab
const leftPanelTab = ref<'category' | 'tag'>('category')

// 分类管理
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuNode = ref<any>(null)
const categoryDialogVisible = ref(false)
const categoryDialogTitle = ref('新建分类')
const isCategoryEdit = ref(false)
const categorySubmitting = ref(false)
const categoryForm = reactive({
  code: '',
  name: '',
  name_en: '',
  description: '',
  sort_order: 0,
  parent_id: 0,
  level: 1 // 1, 2, 3
})

// 标签管理
const tags = ref<any[]>([])
const loadingTags = ref(false)
const selectedTagId = ref<number | null>(null)
const expandedTagGroups = ref<string[]>(['frequency', 'data_source', 'market', 'strategy', 'custom'])
const tagContextMenuVisible = ref(false)
const tagContextMenuPosition = ref({ x: 0, y: 0 })
const tagContextMenuNode = ref<any>(null)
const tagDialogVisible = ref(false)
const tagDialogTitle = ref('新建标签')
const isTagEdit = ref(false)
const tagSubmitting = ref(false)
const tagForm = reactive({
  tag_type: 'custom',
  tag_code: '',
  tag_name: '',
  tag_name_en: '',
  description: '',
  sort_order: 0
})

// 表单
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive({
  factor_code: '',
  factor_name: '',
  factor_name_en: '',
  category_l3_id: 0,
  expression: '',
  description: '',
  tag_ids: [] as number[]
})

// 数据依赖
interface DataSourceItem {
  mode: 'normal' | 'intraday'  // 'normal' 日频数据 | 'intraday' 日内时段筛选
  table: string
  database: string
  fields: string[]
  date_field: string
  code_field: string
  // 时段筛选字段（仅 intraday 模式使用）
  time_field?: string
  time_start?: string
  time_end?: string
  availableFields: any[]
  loadingFields: boolean
}

// 时段预设选项类型
interface TimeFilterPreset {
  value: string
  label: string
  description: string
  time_start: string
  time_end: string
}
const dataSources = ref<DataSourceItem[]>([{ 
  mode: 'normal',
  table: '', 
  database: 'clickhouse',
  fields: [], 
  date_field: '',
  code_field: '',
  availableFields: [], 
  loadingFields: false 
}])

// 时段筛选预设选项
const timeFilterPresets = ref<TimeFilterPreset[]>([])

// 搜索对话框
const searchDialogVisible = ref(false)
const currentSearchIndex = ref(0)
const dialogSearchKeyword = ref('')
const dialogSearchResults = ref<any[]>([])
const dialogSearchLoading = ref(false)

// 打开搜索对话框
const openSearchDialog = (index: number) => {
  currentSearchIndex.value = index
  dialogSearchKeyword.value = ''
  dialogSearchResults.value = []
  searchDialogVisible.value = true
}

// 执行搜索
const doDialogSearch = async () => {
  if (!dialogSearchKeyword.value.trim()) return
  
  dialogSearchLoading.value = true
  try {
    const result = await window.electronAPI.dbdict.search(dialogSearchKeyword.value, 'clickhouse')
    if (result.code === 200) {
      dialogSearchResults.value = result.data || []
    }
  } catch (error: any) {
    console.error('搜索失败:', error)
    dialogSearchResults.value = []
  } finally {
    dialogSearchLoading.value = false
  }
}

// 选择搜索结果
const selectSearchResult = async (item: any) => {
  const source = dataSources.value[currentSearchIndex.value]
  source.table = item.table_name
  source.database = item.database || 'clickhouse'
  source.fields = []
  source.date_field = ''
  source.code_field = ''
  
  searchDialogVisible.value = false
  
  // 加载字段
  await handleTableChange(currentSearchIndex.value)
}

// 清空已选表
const clearSelectedTable = (index: number) => {
  const source = dataSources.value[index]
  source.table = ''
  source.database = 'clickhouse'
  source.fields = []
  source.date_field = ''
  source.code_field = ''
  source.availableFields = []
}

// 表选择变化，加载字段
const handleTableChange = async (index: number) => {
  const source = dataSources.value[index]
  if (!source.table) {
    source.availableFields = []
    source.fields = []
    source.date_field = ''
    source.code_field = ''
    return
  }
  
  source.loadingFields = true
  
  try {
    const datasource = source.database === 'postgresql' ? 'postgresql' : 'clickhouse'
    const result = await window.electronAPI.dbdict.getTableFields(source.table, datasource)
    if (result.code === 200) {
      source.availableFields = result.data || []
    }
  } catch (error: any) {
    console.error('加载字段失败:', error)
    source.availableFields = []
  } finally {
    source.loadingFields = false
  }
}

// 添加数据源（通过下拉菜单选择类型）
const handleAddDataSource = (mode: 'normal' | 'intraday') => {
  const ds: DataSourceItem = {
    mode,
    table: '', 
    database: 'clickhouse',
    fields: [], 
    date_field: '',
    code_field: '',
    availableFields: [], 
    loadingFields: false 
  }
  // 日内时段筛选模式需要额外字段
  if (mode === 'intraday') {
    ds.time_field = ''
    ds.time_start = ''
    ds.time_end = ''
  }
  dataSources.value.push(ds)
}

// 时段预设相关函数
const onPresetClick = (index: number, preset: TimeFilterPreset) => {
  const ds = dataSources.value[index]
  if (preset.value === 'custom') {
    ds.time_start = ''
    ds.time_end = ''
  } else {
    ds.time_start = preset.time_start
    ds.time_end = preset.time_end
  }
}

const isPresetActive = (index: number, preset: TimeFilterPreset): boolean => {
  const ds = dataSources.value[index]
  if (preset.value === 'custom') {
    if (!ds.time_start || !ds.time_end) return false
    return !timeFilterPresets.value.some(p => 
      p.value !== 'custom' && p.time_start === ds.time_start && p.time_end === ds.time_end
    )
  }
  return ds.time_start === preset.time_start && ds.time_end === preset.time_end
}

// 移除数据源
const removeDataSource = (index: number) => {
  if (dataSources.value.length > 1) {
    dataSources.value.splice(index, 1)
  }
}

// 构建 data_sources 对象（新格式，支持时段筛选）
const buildDataSources = () => {
  const result: Record<string, any> = {}
  for (const source of dataSources.value) {
    if (source.table && source.fields.length > 0 && source.date_field && source.code_field) {
      const dsConfig: any = {
        date_field: source.date_field,
        code_field: source.code_field,
        fields: source.fields
      }
      // 日内时段筛选模式：加入时段字段
      if (source.mode === 'intraday' && source.time_field && source.time_start && source.time_end) {
        dsConfig.time_field = source.time_field
        dsConfig.time_start = source.time_start
        dsConfig.time_end = source.time_end
      }
      result[source.table] = dsConfig
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

// 解析 data_sources 字符串（新格式，支持时段筛选）
const parseDataSources = (dataSourcesStr: string | object | null) => {
  const defaultSource: DataSourceItem = { 
    mode: 'normal',
    table: '', 
    database: 'clickhouse',
    fields: [], 
    date_field: '',
    code_field: '',
    availableFields: [], 
    loadingFields: false 
  }
  
  if (!dataSourcesStr) {
    dataSources.value = [{ ...defaultSource }]
    return
  }
  
  let parsed: Record<string, any>
  if (typeof dataSourcesStr === 'string') {
    try {
      parsed = JSON.parse(dataSourcesStr)
    } catch {
      dataSources.value = [{ ...defaultSource }]
      return
    }
  } else {
    parsed = dataSourcesStr as Record<string, any>
  }
  
  const entries = Object.entries(parsed)
  if (entries.length === 0) {
    dataSources.value = [{ ...defaultSource }]
    return
  }
  
  dataSources.value = entries.map(([table, value]) => {
    // 判断是否是日内时段筛选模式（有 time_field 字段）
    const isIntraday = !!(value.time_field && value.time_start && value.time_end)
    const ds: DataSourceItem = {
      mode: isIntraday ? 'intraday' : 'normal',
      table,
      database: 'clickhouse',
      fields: value.fields || [],
      date_field: value.date_field || '',
      code_field: value.code_field || '',
      availableFields: [],
      loadingFields: false
    }
    // 时段筛选字段
    if (isIntraday) {
      ds.time_field = value.time_field
      ds.time_start = value.time_start
      ds.time_end = value.time_end
    }
    return ds
  })
  
  // 加载每个表的字段
  dataSources.value.forEach((_, index) => {
    handleTableChange(index)
  })
}

// 状态统计
const statusCounts = reactive({
  all: 0,
  created: 0,
  backtested: 0
})

const rules: FormRules = {
  factor_code: [
    { required: true, message: '请输入因子代码', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '代码必须以字母开头，只能包含字母、数字和下划线', trigger: 'blur' }
  ],
  factor_name: [
    { required: true, message: '请输入因子名称', trigger: 'blur' }
  ],
  category_l3_id: [
    { required: true, message: '请选择因子分类', trigger: 'change' }
  ],
  expression: [
    { required: true, message: '请输入因子表达式', trigger: 'blur' }
  ]
}

// 检查专属库状态
const checkStatus = async () => {
  pageLoading.value = true
  apiAvailable.value = true
  apiError.value = ''
  
  try {
    const result = await window.electronAPI.factor.myStatus()
    if (result.success && result.data) {
      dbStatus.value = result.data
      isInitialized.value = result.data.initialized
      
      if (isInitialized.value) {
        await loadCategories()
        await loadTags()
        await loadFactors()
      }
    } else {
      const errorMsg = result.error || ''
      if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
        apiAvailable.value = false
        apiError.value = '后端接口尚未部署，请联系管理员'
      } else {
        apiAvailable.value = false
        apiError.value = errorMsg || '检查状态失败'
      }
    }
  } catch (error: any) {
    apiAvailable.value = false
    apiError.value = error.message || '检查状态失败'
  } finally {
    pageLoading.value = false
  }
}

// 初始化专属库
const handleInit = async () => {
  initLoading.value = true
  
  try {
    const result = await window.electronAPI.factor.myInit()
    if (result.success) {
      ElMessage.success(result.message || '因子库创建成功')
      isInitialized.value = true
      await loadCategories()
      await loadTags()
      await loadFactors()
    } else {
      ElMessage.error(result.error || '创建失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '创建失败')
  } finally {
    initLoading.value = false
  }
}

// 加载分类
const loadCategories = async () => {
  loadingCategories.value = true
  try {
    const result = await window.electronAPI.factor.myCategories()
    if (result.success && result.data) {
      categories.value = result.data
    }
  } catch (error: any) {
    console.error('加载分类失败:', error)
  } finally {
    loadingCategories.value = false
  }
}

// 加载因子列表
const loadFactors = async () => {
  loading.value = true
  
  try {
    const params: any = {
      page: page.value,
      page_size: pageSize.value
    }
    
    if (currentStatus.value !== 'all') {
      params.status = currentStatus.value
    }
    
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }
    
    // 根据选中的分类级别使用不同的参数
    if (selectedCategoryId.value && selectedCategoryLevel.value) {
      if (selectedCategoryLevel.value === 1) {
        params.category_l1_id = selectedCategoryId.value
      } else if (selectedCategoryLevel.value === 2) {
        params.category_l2_id = selectedCategoryId.value
      } else if (selectedCategoryLevel.value === 3) {
        params.category_l3_id = selectedCategoryId.value
      }
    }
    
    if (selectedTagId.value) {
      params.tag_id = selectedTagId.value
    }
    
    const result = await window.electronAPI.factor.myList(params)
    
    if (result.success && result.data) {
      factors.value = result.data.factors || []
      total.value = result.data.total || 0
      
      // 更新状态计数
      if (result.data.status_counts) {
        statusCounts.all = result.data.status_counts.all || 0
        statusCounts.created = result.data.status_counts.created || 0
        statusCounts.backtested = result.data.status_counts.backtested || 0
      }
    } else {
      ElMessage.error(result.error || '加载失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 状态切换
const handleStatusChange = (status: string) => {
  currentStatus.value = status
  page.value = 1
  // 清除分类筛选
  selectedCategoryId.value = null
  selectedCategoryLevel.value = null
  if (treeRef.value) {
    treeRef.value.setCurrentKey(null)
  }
  // 清除标签筛选
  selectedTagId.value = null
  // 清除选中的因子
  selectedFactor.value = null
  currentFactorDetail.value = null
  loadFactors()
}

// 分类点击（支持一级、二级、三级分类筛选）
const handleCategoryClick = (data: any, node: any) => {
  selectedCategoryId.value = data.id
  selectedCategoryLevel.value = node.level  // 1, 2, 3
  // 点击分类时，取消状态筛选高亮
  currentStatus.value = ''
  page.value = 1
  loadFactors()
}


// 刷新分类树
const refreshCategories = async () => {
  await loadCategories()
  loadFactors()
  ElMessage.success('刷新成功')
}

// ========== 分类管理 ==========

// 右键菜单
const handleCategoryContextMenu = (event: MouseEvent, data: any, node: any) => {
  event.preventDefault()
  contextMenuNode.value = { ...data, level: node.level }
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
  
  // 点击其他地方关闭菜单
  const closeMenu = () => {
    contextMenuVisible.value = false
    document.removeEventListener('click', closeMenu)
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

// 新建一级分类
const openAddRootCategory = () => {
  isCategoryEdit.value = false
  categoryDialogTitle.value = '新建一级分类'
  Object.assign(categoryForm, {
    code: '',
    name: '',
    name_en: '',
    description: '',
    sort_order: 0,
    parent_id: 0,
    level: 1
  })
  categoryDialogVisible.value = true
}

// 新建子分类
const handleAddSubCategory = () => {
  if (!contextMenuNode.value) return
  contextMenuVisible.value = false
  
  const parentLevel = contextMenuNode.value.level
  if (parentLevel >= 3) return
  
  isCategoryEdit.value = false
  categoryDialogTitle.value = parentLevel === 1 ? '新建二级分类' : '新建三级分类'
  Object.assign(categoryForm, {
    code: '',
    name: '',
    name_en: '',
    description: '',
    sort_order: 0,
    parent_id: contextMenuNode.value.id,
    level: parentLevel + 1
  })
  categoryDialogVisible.value = true
}

// 编辑分类
const handleEditCategory = () => {
  if (!contextMenuNode.value || contextMenuNode.value.is_system) return
  contextMenuVisible.value = false
  
  isCategoryEdit.value = true
  categoryDialogTitle.value = '编辑分类'
  Object.assign(categoryForm, {
    code: contextMenuNode.value.code,
    name: contextMenuNode.value.name,
    name_en: contextMenuNode.value.name_en || '',
    description: contextMenuNode.value.description || '',
    sort_order: contextMenuNode.value.sort_order || 0,
    parent_id: 0,
    level: contextMenuNode.value.level
  })
  categoryDialogVisible.value = true
}

// 删除分类
const handleDeleteCategory = async () => {
  if (!contextMenuNode.value || contextMenuNode.value.is_system) return
  contextMenuVisible.value = false
  
  const node = contextMenuNode.value
  
  try {
    await ElMessageBox.confirm(
      `确定要删除分类"${node.name}"吗？`,
      '删除确认',
      { type: 'warning' }
    )
    
    const level = node.level as 1 | 2 | 3
    const result = await window.electronAPI.factor.myCategoryDelete(level, node.id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      await loadCategories()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch {
    // 取消删除
  }
}

// 提交分类
const submitCategory = async () => {
  if (!categoryForm.code || !categoryForm.name) {
    ElMessage.warning('请填写分类代码和名称')
    return
  }
  
  categorySubmitting.value = true
  
  try {
    const level = categoryForm.level as 1 | 2 | 3
    
    if (isCategoryEdit.value) {
      // 更新
      const result = await window.electronAPI.factor.myCategoryUpdate(level, contextMenuNode.value.id, {
        name: categoryForm.name,
        name_en: categoryForm.name_en || undefined,
        description: categoryForm.description || undefined,
        sort_order: categoryForm.sort_order
      })
      
      if (result.success) {
        ElMessage.success('更新成功')
        categoryDialogVisible.value = false
        await loadCategories()
      } else {
        ElMessage.error(result.error || '更新失败')
      }
    } else {
      // 创建
      const data: any = {
        code: categoryForm.code,
        name: categoryForm.name,
        name_en: categoryForm.name_en || undefined,
        description: categoryForm.description || undefined,
        sort_order: categoryForm.sort_order
      }
      
      if (categoryForm.parent_id) {
        data.parent_id = categoryForm.parent_id
      }
      
      const result = await window.electronAPI.factor.myCategoryCreate(level, data)
      
      if (result.success) {
        ElMessage.success('创建成功')
        categoryDialogVisible.value = false
        await loadCategories()
      } else {
        ElMessage.error(result.error || '创建失败')
      }
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    categorySubmitting.value = false
  }
}

// ========== 标签管理 ==========

// 切换左侧面板
const switchLeftPanel = (tab: 'category' | 'tag') => {
  leftPanelTab.value = tab
  if (tab === 'tag' && tags.value.length === 0) {
    loadTags()
  }
}

// 加载标签
const loadTags = async () => {
  loadingTags.value = true
  try {
    const result = await window.electronAPI.factor.myTags()
    if (result.success && result.data) {
      tags.value = result.data
    }
  } catch (error: any) {
    console.error('加载标签失败:', error)
  } finally {
    loadingTags.value = false
  }
}

// 标签类型颜色
const getTagTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    frequency: 'primary',
    data_source: 'success',
    market: 'warning',
    strategy: 'danger',
    custom: ''
  }
  return colors[type] || ''
}

// 标签分组（用于表单选择）
const groupedTags = computed(() => {
  const groups: Record<string, { type: string; label: string; tags: any[] }> = {}
  const typeLabels: Record<string, string> = {
    frequency: '频率',
    data_source: '数据来源',
    market: '市场',
    strategy: '策略',
    custom: '自定义'
  }
  
  for (const tag of tags.value) {
    if (!groups[tag.tag_type]) {
      groups[tag.tag_type] = {
        type: tag.tag_type,
        label: typeLabels[tag.tag_type] || tag.tag_type,
        tags: []
      }
    }
    groups[tag.tag_type].tags.push(tag)
  }
  
  return Object.values(groups)
})

// 点击标签筛选
const handleTagClick = (tag: any) => {
  if (selectedTagId.value === tag.tag_id) {
    selectedTagId.value = null
  } else {
    selectedTagId.value = tag.tag_id
  }
  // 点击标签时，取消状态筛选高亮
  currentStatus.value = ''
  page.value = 1
  loadFactors()
}

// 清空标签筛选
const clearTagFilter = () => {
  selectedTagId.value = null
  page.value = 1
  loadFactors()
}

// 标签右键菜单
const handleTagContextMenu = (event: MouseEvent, tag: any) => {
  event.preventDefault()
  tagContextMenuNode.value = tag
  tagContextMenuPosition.value = { x: event.clientX, y: event.clientY }
  tagContextMenuVisible.value = true
  
  const closeMenu = () => {
    tagContextMenuVisible.value = false
    document.removeEventListener('click', closeMenu)
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

// 打开新建标签对话框
const openAddTagDialog = () => {
  isTagEdit.value = false
  tagDialogTitle.value = '新建标签'
  Object.assign(tagForm, {
    tag_type: 'custom',
    tag_code: '',
    tag_name: '',
    tag_name_en: '',
    description: '',
    sort_order: 0
  })
  tagDialogVisible.value = true
}

// 编辑标签
const handleEditTag = () => {
  if (!tagContextMenuNode.value || tagContextMenuNode.value.is_system) return
  tagContextMenuVisible.value = false
  
  isTagEdit.value = true
  tagDialogTitle.value = '编辑标签'
  Object.assign(tagForm, {
    tag_type: tagContextMenuNode.value.tag_type,
    tag_code: tagContextMenuNode.value.tag_code,
    tag_name: tagContextMenuNode.value.tag_name,
    tag_name_en: tagContextMenuNode.value.tag_name_en || '',
    description: tagContextMenuNode.value.description || '',
    sort_order: tagContextMenuNode.value.sort_order || 0
  })
  tagDialogVisible.value = true
}

// 删除标签
const handleDeleteTag = async () => {
  if (!tagContextMenuNode.value || tagContextMenuNode.value.is_system) return
  tagContextMenuVisible.value = false
  
  const tag = tagContextMenuNode.value
  
  try {
    await ElMessageBox.confirm(
      `确定要删除标签"${tag.tag_name}"吗？`,
      '删除确认',
      { type: 'warning' }
    )
    
    const result = await window.electronAPI.factor.myTagDelete(tag.tag_id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      await loadTags()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch {
    // 取消删除
  }
}

// 提交标签
const submitTag = async () => {
  if (!tagForm.tag_code || !tagForm.tag_name) {
    ElMessage.warning('请填写标签代码和名称')
    return
  }
  
  tagSubmitting.value = true
  
  try {
    if (isTagEdit.value) {
      const result = await window.electronAPI.factor.myTagUpdate(tagContextMenuNode.value.tag_id, {
        tag_name: tagForm.tag_name,
        tag_name_en: tagForm.tag_name_en || undefined,
        description: tagForm.description || undefined,
        sort_order: tagForm.sort_order
      })
      
      if (result.success) {
        ElMessage.success('更新成功')
        tagDialogVisible.value = false
        await loadTags()
      } else {
        ElMessage.error(result.error || '更新失败')
      }
    } else {
      const result = await window.electronAPI.factor.myTagCreate({
        tag_type: tagForm.tag_type,
        tag_code: tagForm.tag_code,
        tag_name: tagForm.tag_name,
        tag_name_en: tagForm.tag_name_en || undefined,
        description: tagForm.description || undefined,
        sort_order: tagForm.sort_order
      })
      
      if (result.success) {
        ElMessage.success('创建成功')
        tagDialogVisible.value = false
        await loadTags()
      } else {
        ElMessage.error(result.error || '创建失败')
      }
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    tagSubmitting.value = false
  }
}

// 选择因子
const selectFactor = async (factor: any) => {
  selectedFactor.value = factor
  loadingDetail.value = true
  backtestHistory.value = [] // 清空历史
  
  try {
    const result = await window.electronAPI.factor.myDetail(factor.factor_id)
    if (result.success && result.data) {
      currentFactorDetail.value = result.data
      console.log('因子详情数据:', result.data)
      console.log('period_ic_stats:', result.data.period_ic_stats)
      console.log('period_stats:', result.data.period_stats)
      // 重置周期选择为第一个可用周期（兼容两种字段名）
      const stats = result.data.period_ic_stats || result.data.period_stats
      if (Array.isArray(stats) && stats.length > 0) {
        const periods = stats.map((s: any) => s.period).sort((a: number, b: number) => a - b)
        selectedPeriod.value = periods[0]
      }
      // 加载回测历史
      loadBacktestHistory()
    }
  } catch (error: any) {
    console.error('加载因子详情失败:', error)
    ElMessage.error('加载因子详情失败: ' + error.message)
  } finally {
    loadingDetail.value = false
  }
}

// 加载回测历史
const loadBacktestHistory = async () => {
  if (!currentFactorDetail.value?.factor_id) return
  
  // 保存请求时的 factorId，用于防止竞态条件
  const requestFactorId = currentFactorDetail.value.factor_id
  
  loadingBacktestHistory.value = true
  
  try {
    console.log('========== 加载回测历史 ==========')
    console.log('请求的 factorId:', requestFactorId)
    console.log('当前因子代码:', currentFactorDetail.value?.factor_code)
    
    const result = await window.electronAPI.factor.myBacktestHistory(requestFactorId)
    
    // 防止竞态条件：如果用户已切换到其他因子，丢弃这个响应
    if (currentFactorDetail.value?.factor_id !== requestFactorId) {
      console.log('因子已切换，丢弃旧的回测历史响应')
      return
    }
    
    console.log('回测历史响应 success:', result.success)
    
    if (result.success && result.data) {
      // 兼容不同的数据结构
      let historyData: any[] = []
      if (Array.isArray(result.data)) {
        historyData = result.data
      } else if (result.data.records) {
        historyData = result.data.records
      }
      
      // 过滤：只保留属于当前因子的回测记录
      const filteredData = historyData.filter((record: any) => {
        // 如果记录中有 factor_id，验证是否匹配
        if (record.factor_id !== undefined && record.factor_id !== requestFactorId) {
          console.warn('过滤掉不匹配的回测记录, 记录的 factor_id:', record.factor_id, ', 请求的 factor_id:', requestFactorId)
          return false
        }
        return true
      })
      
      backtestHistory.value = filteredData
      console.log('回测历史记录数:', filteredData.length)
      
      if (filteredData.length > 0) {
        console.log('第一条记录:', filteredData[0])
        const latestRecord = filteredData[0]
        // 新数据结构：period_ic_stats 在 factor_result 里面
        const periodStats = latestRecord.factor_result?.period_ic_stats || latestRecord.period_stats
        if (Array.isArray(periodStats) && periodStats.length > 0) {
          const periods = periodStats.map((ps: any) => ps.period).sort((a: number, b: number) => a - b)
          selectedPeriod.value = periods[0]
          console.log('从回测历史获取周期数据:', periods)
        }
      }
    } else {
      backtestHistory.value = []
      console.error('获取回测历史失败:', result.error)
    }
  } catch (error: any) {
    backtestHistory.value = []
    console.error('加载回测历史失败:', error)
  } finally {
    loadingBacktestHistory.value = false
  }
}

// 跳转到回测结果
const goToBacktestResult = (taskId: string) => {
  if (taskId) {
    router.push(`/factor-library/backtest/result/${taskId}`)
  }
}

// 获取股票池名称
const getUniverseName = (universe: string) => {
  const map: Record<string, string> = {
    'all': '全市场',
    'hs300': '沪深300',
    'zz500': '中证500',
    'zz1000': '中证1000',
    'sz50': '上证50',
    'zz2000': '中证2000'
  }
  return map[universe] || universe
}

// 表单分类选择变化
const handleFormCategoryChange = (value: number[]) => {
  if (value && value.length === 3) {
    form.category_l3_id = value[2]
  }
}

// 打开新建对话框
const openCreateDialog = async () => {
  isEdit.value = false
  editingId.value = null
  categoryValue.value = []
  Object.assign(form, {
    factor_code: '',
    factor_name: '',
    factor_name_en: '',
    category_l3_id: 0,
    expression: '',
    description: '',
    tag_ids: []
  })
  // 重置数据依赖
  dataSources.value = [{ 
    mode: 'normal' as const,
    table: '', 
    database: 'clickhouse',
    fields: [], 
    date_field: '',
    code_field: '',
    availableFields: [], 
    loadingFields: false 
  }]
  dialogVisible.value = true
}

// 编辑因子
const handleEdit = async (factor: any) => {
  if (!factor) return
  isEdit.value = true
  editingId.value = factor.factor_id
  Object.assign(form, {
    factor_code: factor.factor_code,
    factor_name: factor.factor_name,
    factor_name_en: factor.factor_name_en || '',
    category_l3_id: factor.category_l3_id,
    expression: factor.expression,
    description: factor.description || '',
    tag_ids: factor.tag_ids || currentFactorDetail.value?.tag_ids || []
  })
  categoryValue.value = []
  // 解析数据依赖
  parseDataSources(factor.data_sources || currentFactorDetail.value?.data_sources)
  dialogVisible.value = true
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  
  // 验证数据依赖（必填）
  const dataSourcesObj = buildDataSources()
  if (!dataSourcesObj || Object.keys(dataSourcesObj).length === 0) {
    ElMessage.error('请配置数据依赖，至少需要一个数据源')
    return
  }
  
  // 验证每个数据源是否完整
  for (const source of dataSources.value) {
    if (source.table) {
      if (!source.date_field) {
        ElMessage.error(`数据源 ${source.table} 缺少日期字段`)
        return
      }
      if (!source.code_field) {
        ElMessage.error(`数据源 ${source.table} 缺少标的代码字段`)
        return
      }
      if (source.fields.length === 0) {
        ElMessage.error(`数据源 ${source.table} 缺少因子字段`)
        return
      }
      // 日内时段筛选模式验证
      if (source.mode === 'intraday') {
        if (!source.time_field) {
          ElMessage.error(`数据源 ${source.table} 日内时段筛选模式必须选择时间字段`)
          return
        }
        if (!source.time_start || !source.time_end) {
          ElMessage.error(`数据源 ${source.table} 日内时段筛选模式必须配置时间范围`)
          return
        }
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
        if (!timeRegex.test(source.time_start)) {
          ElMessage.error(`数据源 ${source.table} 开始时间格式错误，应为 HH:MM`)
          return
        }
        if (!timeRegex.test(source.time_end)) {
          ElMessage.error(`数据源 ${source.table} 结束时间格式错误，应为 HH:MM`)
          return
        }
      }
    }
  }
  
  submitting.value = true
  
  try {
    
    if (isEdit.value && editingId.value) {
      // 使用 JSON 深拷贝确保是纯对象，避免 IPC 序列化错误
      const updateData = JSON.parse(JSON.stringify({
        factor_name: form.factor_name,
        factor_name_en: form.factor_name_en || undefined,
        category_l3_id: form.category_l3_id,
        expression: form.expression,
        description: form.description || undefined,
        data_sources: dataSourcesObj,
        tag_ids: form.tag_ids.length > 0 ? form.tag_ids : undefined
      }))
      const result = await window.electronAPI.factor.myUpdate(editingId.value, updateData)
      
      if (result.success) {
        ElMessage.success('更新成功')
        dialogVisible.value = false
        loadFactors()
        // 刷新详情
        if (selectedFactor.value?.factor_id === editingId.value) {
          selectFactor(selectedFactor.value)
        }
      } else {
        ElMessage.error(result.error || '更新失败')
      }
    } else {
      // 使用 JSON 深拷贝确保是纯对象，避免 IPC 序列化错误
      const createData = JSON.parse(JSON.stringify({
        factor_code: form.factor_code,
        factor_name: form.factor_name,
        factor_name_en: form.factor_name_en || undefined,
        category_l3_id: form.category_l3_id,
        expression: form.expression,
        description: form.description || undefined,
        data_sources: dataSourcesObj,
        tag_ids: form.tag_ids.length > 0 ? form.tag_ids : undefined
      }))
      const result = await window.electronAPI.factor.myCreate(createData)
      
      if (result.success) {
        ElMessage.success(result.message || '创建成功')
        dialogVisible.value = false
        loadFactors()
      } else {
        ElMessage.error(result.error || '创建失败')
      }
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// 批量删除因子
const batchDeleting = ref(false)
const handleBatchDelete = async () => {
  if (selectedFactorIds.value.length === 0) {
    ElMessage.warning('请先选择要删除的因子')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedFactorIds.value.length} 个因子吗？此操作不可恢复。`,
      '批量删除确认',
      { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' }
    )

    batchDeleting.value = true
    const result = await window.electronAPI.factor.myBatchDelete(selectedFactorIds.value.map(String))
    if (result.success) {
      ElMessage.success(`成功删除 ${result.deleted_count} 个因子`)
      if (result.deleted_count !== undefined && result.requested !== undefined && result.deleted_count < result.requested) {
        ElMessage.info(`${result.requested - result.deleted_count} 个因子未找到（可能已被删除）`)
      }
      selectedFactorIds.value = []
      selectedFactor.value = null
      currentFactorDetail.value = null
      loadFactors()
    } else {
      ElMessage.error(result.error || '批量删除失败')
    }
  } catch {
    // 取消删除
  } finally {
    batchDeleting.value = false
  }
}

// 删除因子
const handleDelete = async (factor: any) => {
  if (!factor) return
  
  try {
    await ElMessageBox.confirm(
      `确定删除因子「${factor.factor_name}」吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning' }
    )
    
    const result = await window.electronAPI.factor.myDelete(factor.factor_id)
    if (result.success) {
      ElMessage.success('删除成功')
      selectedFactor.value = null
      currentFactorDetail.value = null
      loadFactors()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch {
    // 取消删除
  }
}

// 发起回测
const backtestDialogVisible = ref(false)
const backtestSubmitting = ref(false)
const backtestFactor = ref<any>(null)
const backtestForm = reactive({
  start_date: '2020-01-01',
  end_date: new Date().toISOString().split('T')[0],
  universe_preset: 'all',
  num_groups: 10,
  forward_periods: [1, 5, 10, 20],
  factor_direction: 'auto',
  buy_price_type: 'daily_open',
  sell_price_type: 'daily_close',
  benchmarks: [] as string[]
})

// 价格类型和基准指数选项
const buyPriceTypes = ref<Array<{ value: string; label: string }>>([
  { value: 'daily_open', label: '日线开盘价' }
])
const sellPriceTypes = ref<Array<{ value: string; label: string }>>([
  { value: 'daily_close', label: '日线收盘价' }
])

// 基准指数数据
interface BenchmarkOption {
  value: string
  label: string
  description?: string
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
const benchmarkTab = ref('standard')
const industryIndexTab = ref('CSI300')
const standardIndexes = ref<BenchmarkOption[]>([])
const indexList = ref<IndexItem[]>([])
const indexIndustries = ref<Record<string, IndexIndustryOption[]>>({})
const selectedBenchmarks = ref<string[]>([])

// 获取基准标签名称
const getBenchmarkLabel = (value: string) => {
  // 先从标准指数查找
  const std = standardIndexes.value.find(s => s.value === value)
  if (std) return std.label
  // 再从指数行业查找
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

// 股票池数据
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
const stockPoolTab = ref('index')

// 加载股票池列表
const loadStockPools = async () => {
  stockPoolsLoading.value = true
  try {
    const result = await window.electronAPI.backtest.getStockPools()
    if (result.success && result.data) {
      const data = result.data as any
      if (data.index || data.industry) {
        stockPoolData.value = data as StockPoolData
      } else if (Array.isArray(data)) {
        stockPoolData.value = {
          index: { name: '标准指数维度', pools: data },
          industry: { name: '申万行业维度', pools: [] },
          custom: { name: '自定义', pools: [] }
        }
      }
    }
  } catch (error) {
    console.error('加载股票池失败:', error)
  } finally {
    stockPoolsLoading.value = false
  }
}

// 切换股票池维度
const handleStockPoolTabChange = (tab: string) => {
  stockPoolTab.value = tab
  const pools = stockPoolData.value?.[tab as keyof StockPoolData]?.pools || []
  if (pools.length > 0) {
    backtestForm.universe_preset = pools[0].id
  }
}

// 加载价格类型和基准指数选项
const loadPriceTypeOptions = async () => {
  try {
    const result = await window.electronAPI.backtest.getPriceTypeOptions()
    console.log('📊 [MyFactors] 价格类型选项接口返回:', result)
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
        console.log('📊 [MyFactors] 时段筛选预设:', timeFilterPresets.value)
      }
      
      // 解析基准指数新格式
      const benchmarks = result.data.benchmarks as any
      if (benchmarks && !Array.isArray(benchmarks)) {
        standardIndexes.value = benchmarks.standard_indexes || []
        indexList.value = benchmarks.index_list || []
        indexIndustries.value = benchmarks.index_industries || {}
        
        if (indexList.value.length > 0 && !indexList.value.find(i => i.code === industryIndexTab.value)) {
          industryIndexTab.value = indexList.value[0].code
        }
        console.log('📊 [MyFactors] 标准指数:', standardIndexes.value)
        console.log('📊 [MyFactors] 指数行业:', indexIndustries.value)
      } else if (Array.isArray(benchmarks)) {
        // 兼容旧格式
        standardIndexes.value = benchmarks
      }
    }
  } catch (error) {
    console.error('加载价格类型选项失败:', error)
  }
}

// 批量选择相关函数
const toggleFactorSelection = (factor: any, checked: boolean) => {
  if (checked) {
    if (!selectedFactorIds.value.includes(factor.factor_id)) {
      selectedFactorIds.value.push(factor.factor_id)
      selectedFactorsData.value.push(factor)
    }
  } else {
    const idx = selectedFactorIds.value.indexOf(factor.factor_id)
    if (idx > -1) {
      selectedFactorIds.value.splice(idx, 1)
      selectedFactorsData.value.splice(idx, 1)
    }
  }
}

const selectingAll = ref(false)

const handleSelectAll = async (checked: boolean) => {
  if (checked) {
    // 全选：获取所有因子
    if (total.value > factors.value.length) {
      // 需要请求所有因子
      selectingAll.value = true
      try {
        // 构建分类筛选参数
        const categoryParams: any = {}
        if (selectedCategoryId.value && selectedCategoryLevel.value) {
          if (selectedCategoryLevel.value === 1) {
            categoryParams.category_l1_id = selectedCategoryId.value
          } else if (selectedCategoryLevel.value === 2) {
            categoryParams.category_l2_id = selectedCategoryId.value
          } else if (selectedCategoryLevel.value === 3) {
            categoryParams.category_l3_id = selectedCategoryId.value
          }
        }
        
        const result = await window.electronAPI.factor.myList({
          status: currentStatus.value !== 'all' ? currentStatus.value : undefined,
          ...categoryParams,
          keyword: searchKeyword.value || undefined,
          tag_id: selectedTagId.value || undefined,
          page: 1,
          page_size: 1000  // 后端支持最大 1000
        })
        
        if (result.success && result.data?.factors) {
          // 清空并添加所有因子
          selectedFactorIds.value = result.data.factors.map((f: any) => f.factor_id)
          selectedFactorsData.value = [...result.data.factors]
        }
      } catch (error) {
        console.error('获取所有因子失败:', error)
        // 降级：只选当前页
        factors.value.forEach(f => {
          if (!selectedFactorIds.value.includes(f.factor_id)) {
            selectedFactorIds.value.push(f.factor_id)
            selectedFactorsData.value.push(f)
          }
        })
      } finally {
        selectingAll.value = false
      }
    } else {
      // 当前页就是全部，直接选择
      factors.value.forEach(f => {
        if (!selectedFactorIds.value.includes(f.factor_id)) {
          selectedFactorIds.value.push(f.factor_id)
          selectedFactorsData.value.push(f)
        }
      })
    }
  } else {
    // 取消全选：清空所有选择
    selectedFactorIds.value = []
    selectedFactorsData.value = []
  }
}

const clearSelection = () => {
  selectedFactorIds.value = []
  selectedFactorsData.value = []
}

// 单个因子回测
const goToBacktest = async (factor: any) => {
  if (!factor) return
  backtestFactor.value = factor
  backtestFactors.value = [factor]
  // 确保选项已加载
  if (standardIndexes.value.length === 0) {
    await loadPriceTypeOptions()
  }
  if (!stockPoolData.value) {
    await loadStockPools()
  }
  // 重置选择
  selectedBenchmarks.value = []
  stockPoolTab.value = 'index'
  backtestDialogVisible.value = true
}

// 批量回测
const backtestFactors = ref<any[]>([])

const openBatchBacktest = async () => {
  if (selectedFactorIds.value.length === 0) {
    ElMessage.warning('请先选择要回测的因子')
    return
  }
  backtestFactor.value = null
  backtestFactors.value = [...selectedFactorsData.value]
  // 确保选项已加载
  if (standardIndexes.value.length === 0) {
    await loadPriceTypeOptions()
  }
  if (!stockPoolData.value) {
    await loadStockPools()
  }
  // 重置选择
  selectedBenchmarks.value = []
  stockPoolTab.value = 'index'
  backtestDialogVisible.value = true
}

// 解析回测因子的数据依赖
const parsedBacktestDataSources = computed(() => {
  const factor = backtestFactors.value.length === 1 ? backtestFactors.value[0] : backtestFactor.value
  if (!factor?.data_sources) return []
  
  try {
    // data_sources 是 JSON 字符串，格式: {"表名": {"fields": [...], ...}}
    const dsObj = typeof factor.data_sources === 'string' 
      ? JSON.parse(factor.data_sources) 
      : factor.data_sources
    
    return Object.entries(dsObj).map(([table, config]: [string, any]) => ({
      table,
      fields: config.fields || [],
      date_field: config.date_field,
      code_field: config.code_field
    }))
  } catch {
    return []
  }
})

const submitBacktest = async () => {
  // 支持单个或批量回测
  const factorIds = backtestFactors.value.length > 0 
    ? backtestFactors.value.map(f => f.factor_id)
    : backtestFactor.value ? [backtestFactor.value.factor_id] : []
  
  if (factorIds.length === 0) return
  
  backtestSubmitting.value = true
  
  try {
    // 构建纯 JSON 数据，避免 reactive 对象序列化问题
    const data = {
      factor_ids: factorIds,
      start_date: backtestForm.start_date,
      end_date: backtestForm.end_date,
      universe: {
        type: 'preset',
        preset_name: backtestForm.universe_preset
      },
      backtest_params: {
        num_groups: Number(backtestForm.num_groups),
        forward_periods: [...backtestForm.forward_periods],
        factor_direction: backtestForm.factor_direction,
        buy_price_type: backtestForm.buy_price_type,
        sell_price_type: backtestForm.sell_price_type,
        benchmarks: [...selectedBenchmarks.value]
      }
    }
    
    console.log('📊 selectedBenchmarks:', selectedBenchmarks.value)
    console.log('📊 提交回测请求数据:', JSON.stringify(data, null, 2))
    
    const result = await window.electronAPI.factor.myBacktest(data)
    
    if (result.success && result.data) {
      backtestDialogVisible.value = false
      const tasks = result.data.tasks || []
      if (tasks.length > 1) {
        ElMessage.success(`已提交 ${tasks.length} 个回测任务`)
      } else if (tasks.length === 1) {
        ElMessage.success(`回测任务已提交，任务ID: ${tasks[0].task_id}`)
      } else {
        ElMessage.success('回测任务已提交')
      }
      // 清空批量选择
      clearSelection()
      // 跳转到回测任务列表
      router.push('/factor-library/backtest/tasks')
    } else {
      ElMessage.error(result.error || '提交回测失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '提交回测失败')
  } finally {
    backtestSubmitting.value = false
  }
}

// ========== 批量上传因子 ==========
const batchUploadDialogVisible = ref(false)
const uploadStep = ref(0)
const uploadRef = ref()
const parsedFactors = ref<any[]>([])
const batchUploading = ref(false)

// 模板字段说明
const templateFields = [
  { field: 'factor_code', required: true, description: '因子代码，英文开头，只能包含字母数字下划线', example: 'momentum_5d' },
  { field: 'factor_name', required: true, description: '因子中文名称', example: '5日动量' },
  { field: 'factor_name_en', required: false, description: '因子英文名称', example: '5-Day Momentum' },
  { field: 'expression', required: true, description: '因子表达式，字段名须与data_sources中fields一致', example: '(hfq_close_price - lag(hfq_close_price, 5)) / lag(hfq_close_price, 5)' },
  { field: 'description', required: false, description: '因子描述', example: '计算5日收益率' },
  { field: 'data_sources', required: true, description: '数据依赖JSON，每个表必须包含date_field、code_field、fields；日内时段筛选还需time_field、time_start、time_end', example: '{"zz_500D":{"date_field":"trade_date","code_field":"stock_code","fields":["hfq_close_price"]}}' }
]

// 有效/无效统计
const validCount = computed(() => parsedFactors.value.filter(f => !f.error).length)
const invalidCount = computed(() => parsedFactors.value.filter(f => f.error).length)

// 打开批量上传对话框
const openBatchUploadDialog = () => {
  uploadStep.value = 0
  parsedFactors.value = []
  batchUploadDialogVisible.value = true
}

// 下载模板
const downloadTemplate = async () => {
  try {
    // 使用 exceljs 生成模板（动态导入）
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('因子模板')
    
    // 设置列
    worksheet.columns = [
      { header: 'factor_code', key: 'factor_code', width: 20 },
      { header: 'factor_name', key: 'factor_name', width: 20 },
      { header: 'factor_name_en', key: 'factor_name_en', width: 25 },
      { header: 'expression', key: 'expression', width: 50 },
      { header: 'description', key: 'description', width: 40 },
      { header: 'data_sources', key: 'data_sources', width: 80 }
    ]
    
    // 设置表头样式
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }
    
    // 添加示例数据
    worksheet.addRow({
      factor_code: 'momentum_5d',
      factor_name: '5日动量',
      factor_name_en: '5-Day Momentum',
      expression: '(hfq_close_price - lag(hfq_close_price, 5)) / lag(hfq_close_price, 5)',
      description: '计算股票5日收益率作为动量因子',
      data_sources: '{"zz_500D":{"date_field":"trade_date","code_field":"stock_code","fields":["hfq_close_price"]}}'
    })
    
    worksheet.addRow({
      factor_code: 'price_ma5_bias',
      factor_name: '价格MA5偏离',
      factor_name_en: 'Price MA5 Bias',
      expression: 'hfq_close_price / ma5 - 1',
      description: '后复权收盘价相对5日均线的偏离度（跨表示例）',
      data_sources: '{"zz_500D":{"date_field":"trade_date","code_field":"stock_code","fields":["hfq_close_price"]},"zz_500D_1":{"date_field":"trade_date","code_field":"stock_code","fields":["ma5"]}}'
    })
    
    // 日内时段筛选示例
    worksheet.addRow({
      factor_code: 'opening_volume',
      factor_name: '开盘时段成交量',
      factor_name_en: 'Opening Volume',
      expression: 'volume',
      description: '开盘30分钟（9:30-10:00）的总成交量（日内时段筛选示例）',
      data_sources: '{"zz_5001":{"date_field":"trade_date","code_field":"stock_code","fields":["volume"],"time_field":"trade_time","time_start":"09:30","time_end":"10:00"}}'
    })
    
    // 添加说明 sheet
    const infoSheet = workbook.addWorksheet('字段说明')
    infoSheet.columns = [
      { header: '字段名', key: 'field', width: 20 },
      { header: '必填', key: 'required', width: 10 },
      { header: '说明', key: 'description', width: 50 },
      { header: '示例', key: 'example', width: 60 }
    ]
    infoSheet.getRow(1).font = { bold: true }
    templateFields.forEach(f => {
      infoSheet.addRow({
        field: f.field,
        required: f.required ? '是' : '否',
        description: f.description,
        example: f.example
      })
    })
    
    // 保存文件
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '因子批量上传模板.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    
    uploadStep.value = 1
    ElMessage.success('模板下载成功')
  } catch (error: any) {
    console.error('下载模板失败:', error)
    ElMessage.error('下载模板失败: ' + error.message)
  }
}

// 文件选择变化
const handleFileChange = async (file: any) => {
  if (!file || !file.raw) return
  
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = await file.raw.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)
    
    const worksheet = workbook.getWorksheet(1)
    if (!worksheet) {
      ElMessage.error('无法读取工作表')
      return
    }
    
    const factors: any[] = []
    const headers: string[] = []
    
    // 读取表头
    worksheet.getRow(1).eachCell((cell: any, colNumber: number) => {
      headers[colNumber] = String(cell.value || '').trim()
    })
    
    // 读取数据行
    worksheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return // 跳过表头
      
      const factor: any = { rowNum: rowNumber }
      row.eachCell((cell: any, colNumber: number) => {
        const header = headers[colNumber]
        if (header) {
          factor[header] = String(cell.value || '').trim()
        }
      })
      
      // 跳过空行
      if (!factor.factor_code && !factor.factor_name) return
      
      // 校验数据
      factor.error = validateFactor(factor)
      
      factors.push(factor)
    })
    
    parsedFactors.value = factors
    uploadStep.value = 2
    
    // 清除上传组件的文件列表，避免重复选择问题
    uploadRef.value?.clearFiles()
    
    if (factors.length === 0) {
      ElMessage.warning('未读取到有效数据')
    } else {
      ElMessage.success(`解析成功，共 ${factors.length} 条数据`)
    }
  } catch (error: any) {
    console.error('解析文件失败:', error)
    ElMessage.error('解析文件失败: ' + error.message)
  }
}

// 校验单个因子
const validateFactor = (factor: any): string => {
  if (!factor.factor_code) return '缺少因子代码'
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(factor.factor_code)) return '因子代码格式错误'
  if (!factor.factor_name) return '缺少因子名称'
  if (!factor.expression) return '缺少因子表达式'
  if (!factor.data_sources) return '缺少数据依赖'
  
  // 校验 data_sources JSON 格式
  try {
    const ds = JSON.parse(factor.data_sources)
    if (typeof ds !== 'object' || Object.keys(ds).length === 0) {
      return '数据依赖格式错误'
    }
    // 校验每个表的必填字段
    for (const [table, config] of Object.entries(ds)) {
      const cfg = config as any
      if (!cfg.date_field) return `${table} 缺少 date_field`
      if (!cfg.code_field) return `${table} 缺少 code_field`
      if (!cfg.fields || !Array.isArray(cfg.fields) || cfg.fields.length === 0) {
        return `${table} 缺少 fields`
      }
      // 日内时段筛选校验：三个字段要么都不传，要么必须同时提供
      const hasTimeField = !!cfg.time_field
      const hasTimeStart = !!cfg.time_start
      const hasTimeEnd = !!cfg.time_end
      if (hasTimeField || hasTimeStart || hasTimeEnd) {
        if (!hasTimeField) return `${table} 时段筛选缺少 time_field`
        if (!hasTimeStart) return `${table} 时段筛选缺少 time_start`
        if (!hasTimeEnd) return `${table} 时段筛选缺少 time_end`
        // 验证时间格式 HH:MM
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
        if (!timeRegex.test(cfg.time_start)) {
          return `${table} time_start 格式错误，应为 HH:MM`
        }
        if (!timeRegex.test(cfg.time_end)) {
          return `${table} time_end 格式错误，应为 HH:MM`
        }
      }
    }
  } catch {
    return '数据依赖JSON格式错误'
  }
  
  return ''
}

// 文件数量超限
const handleExceed = () => {
  ElMessage.warning('只能上传一个文件，请先移除已选文件')
}

// 获取行样式
const getRowClassName = ({ row }: { row: any }) => {
  return row.error ? 'error-row' : ''
}

// 提交批量上传
const submitBatchUpload = async () => {
  const validFactors = parsedFactors.value.filter(f => !f.error)
  if (validFactors.length === 0) {
    ElMessage.warning('没有有效的因子数据')
    return
  }
  
  batchUploading.value = true
  
  try {
    // 构建批量创建的数据
    const factorsData = validFactors.map(factor => ({
      factor_code: factor.factor_code,
      factor_name: factor.factor_name,
      factor_name_en: factor.factor_name_en || undefined,
      expression: factor.expression,
      description: factor.description || undefined,
      data_sources: JSON.parse(factor.data_sources)
    }))
    
    // 调用批量创建接口
    const result = await window.electronAPI.factor.myBatchCreate(factorsData)
    
    if (result.success && result.data) {
      const { success_count, fail_count, results } = result.data
      
      if (success_count > 0) {
        ElMessage.success(`成功创建 ${success_count} 个因子`)
        // 刷新分类树和因子列表
        await loadCategories()
        loadFactors()
      }
      
      if (fail_count > 0) {
        // 收集失败信息
        const failedItems = results.filter(r => !r.success)
        const errors = failedItems.map(r => `${r.factor_code}: ${r.error}`)
        console.error('部分因子创建失败:', errors)
        ElMessage.warning(`${fail_count} 个因子创建失败，请查看控制台`)
      }
      
      if (success_count > 0 && fail_count === 0) {
        batchUploadDialogVisible.value = false
      }
    } else {
      ElMessage.error('批量上传失败: ' + (result.error || '未知错误'))
    }
  } catch (error: any) {
    ElMessage.error('批量上传失败: ' + error.message)
  } finally {
    batchUploading.value = false
  }
}

// 工具函数
const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    created: 'info',
    backtested: 'success'
  }
  return map[status] || 'info'
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    created: '已创建',
    backtested: '已回测'
  }
  return map[status] || status
}

// 回测任务状态
const getBacktestStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

const getBacktestStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

// 获取空状态描述
const getEmptyDescription = () => {
  if (currentStatus.value === 'created') {
    return '暂无已创建的因子'
  } else if (currentStatus.value === 'backtested') {
    return '暂无已回测的因子'
  }
  return '暂无因子'
}

// 解析数据依赖用于显示
const parseDataSourcesForDisplay = (dataSourcesStr: string | object | null): Record<string, { date_field: string; code_field: string; fields: string[] }> => {
  if (!dataSourcesStr) return {}
  
  let parsed: Record<string, { date_field: string; code_field: string; fields: string[] }>
  if (typeof dataSourcesStr === 'string') {
    try {
      parsed = JSON.parse(dataSourcesStr)
    } catch {
      return {}
    }
  } else {
    parsed = dataSourcesStr as Record<string, { date_field: string; code_field: string; fields: string[] }>
  }
  
  return parsed
}

// 判断是否有数据依赖
const hasDataSources = (dataSourcesStr: string | object | null): boolean => {
  const parsed = parseDataSourcesForDisplay(dataSourcesStr)
  return Object.keys(parsed).length > 0
}

const formatTime = (time: string) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const formatFullTime = (time: string) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(() => {
  checkStatus()
  loadPriceTypeOptions()
})
</script>

<style scoped lang="scss">
.my-factors-page {
  height: calc(100vh - 100px);
  background: #f5f7fa;
  overflow: hidden;
  box-sizing: border-box;
}

.main-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// 加载状态
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 0;
  color: #909399;
  gap: 20px;
  
  .is-loading {
    color: #409eff;
  }
}

// 初始化引导
.init-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.init-card {
  background: #fff;
  border-radius: 20px;
  padding: 60px 80px;
  text-align: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  
  .init-icon {
    color: #409eff;
    margin-bottom: 24px;
  }
  
  &.error-card {
    .error-icon {
      color: #e6a23c;
    }
  }
  
  h2 {
    margin: 0 0 16px 0;
    font-size: 24px;
    color: #303133;
  }
  
  .init-desc {
    font-size: 15px;
    color: #909399;
    line-height: 1.8;
    margin-bottom: 24px;
  }
  
  .init-info {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 32px;
  }
}

// 状态Tab + 新建按钮
.tabs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.nav-tabs {
  display: inline-flex;
  background: #fff;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  
  .el-icon {
    font-size: 16px;
  }
  
  &:hover:not(.active) {
    background: #f5f7fa;
    color: #409eff;
  }
  
  &.active {
    background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.35);
  }
}

// 三栏布局
.content-layout {
  display: grid;
  grid-template-columns: 260px 1fr 420px;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

// 左侧面板
.left-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .left-panel-tabs {
    display: flex;
    border-bottom: 1px solid #e4e7ed;
    
    .panel-tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 10px 0;
      border: none;
      background: #f5f7fa;
      color: #606266;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:first-child {
        border-right: 1px solid #e4e7ed;
      }
      
      &:hover {
        color: #409eff;
      }
      
      &.active {
        background: white;
        color: #409eff;
        font-weight: 500;
      }
    }
  }
  
  .panel-header {
    padding: 10px 12px;
    background: #fafafa;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
    font-size: 13px;
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
  
  .tag-list {
    padding: 0;
    flex: 1;
    overflow-y: auto;
    
    :deep(.el-collapse) {
      border: none;
      
      .el-collapse-item__header {
        height: 38px;
        line-height: 38px;
        padding: 0 12px;
        background: #fafafa;
        border-bottom: 1px solid #ebeef5;
        font-size: 13px;
        
        &:hover {
          background: #f5f7fa;
        }
      }
      
      .el-collapse-item__wrap {
        border-bottom: none;
      }
      
      .el-collapse-item__content {
        padding: 0;
      }
    }
    
    .tag-group-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    
    .tag-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px 8px 24px;
      cursor: pointer;
      transition: all 0.2s;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background: #f5f7fa;
      }
      
      &.active {
        background: #ecf5ff;
        color: #409eff;
      }
      
      .tag-name {
        flex: 1;
      }
    }
  }
  
  .panel-header .header-actions {
    display: flex;
    gap: 4px;
  }
}

// 右键菜单
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 6px 0;
  min-width: 140px;
  z-index: 3000;
  
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    color: #606266;
    transition: all 0.15s;
    
    &:hover:not(.disabled) {
      background: #f5f7fa;
      color: #409eff;
    }
    
    &.danger:hover:not(.disabled) {
      background: #fef0f0;
      color: #f56c6c;
    }
    
    &.disabled {
      color: #c0c4cc;
      cursor: not-allowed;
    }
  }
}

// 中间面板
.middle-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .panel-header {
    padding: 10px 15px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 500;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .factor-count {
      font-size: 12px;
      color: #909399;
      font-weight: normal;
    }
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
      
      &.selected {
        border-color: #67c23a;
        background: #f0f9eb;
      }
      
      &.selected.active {
        border-color: #409EFF;
        background: linear-gradient(135deg, #ecf5ff 0%, #f0f9eb 100%);
      }
      
      .factor-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        
        .factor-code {
          flex: 1;
          font-family: monospace;
          font-weight: 600;
          font-size: 14px;
          color: #409eff;
        }
      }
      
      .factor-name {
        font-size: 13px;
        color: #303133;
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
        margin-bottom: 6px;
      }
      
      .factor-time {
        font-size: 11px;
        color: #c0c4cc;
      }
    }
    
  }
  
  .pagination-footer {
    padding: 12px 15px;
    border-top: 1px solid #e4e7ed;
    background: #fafafa;
    display: flex;
    justify-content: center;
    flex-shrink: 0;
  }
}

// 右侧面板
.right-panel {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: white;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  .panel-header {
    padding: 12px 15px;
    background: #f5f7fa;
    border-bottom: 1px solid #e4e7ed;
    font-weight: 500;
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
      margin-bottom: 16px;
      
      :deep(.el-card__header) {
        padding: 10px 15px;
        background: #f5f7fa;
        font-size: 14px;
      }
      
      :deep(.el-card__body) {
        padding: 15px;
      }
    }
    
    .expression-code {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
      max-height: 150px;
      overflow-y: auto;
    }
    
    .action-buttons {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e4e7ed;
    }
    
    .section-header-with-action {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .section-header-with-tip {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .period-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      
      .period-label {
        font-size: 13px;
        font-weight: 500;
        color: #475569;
        white-space: nowrap;
      }
      
      :deep(.el-segmented) {
        --el-segmented-bg-color: #e2e8f0;
        --el-segmented-item-selected-bg-color: #409eff;
        --el-segmented-item-selected-color: #fff;
        border-radius: 6px;
        
        .el-segmented__item {
          padding: 4px 12px;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
          
          &:not(.is-selected):hover {
            color: #409eff;
          }
        }
        
        .el-segmented__item-selected {
          border-radius: 5px;
          box-shadow: 0 2px 4px rgba(64, 158, 255, 0.3);
        }
      }
    }
  }
}

// 数据源配置样式
.data-sources-section {
  margin-top: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  
  .required-label::before {
    content: '*';
    color: #f56c6c;
    margin-right: 4px;
  }
  
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #409eff15 0%, #409eff08 100%);
    border-bottom: 1px solid #e4e7ed;
    font-weight: 600;
    color: #303133;
    
    .el-icon {
      color: #409eff;
    }
    
    .el-button {
      margin-left: auto;
    }
    
    .add-datasource-dropdown {
      margin-left: auto;
      
      :deep(.el-dropdown-menu__item) {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .el-icon {
          font-size: 16px;
          color: #606266;
        }
      }
    }
  }
  
  .section-body {
    padding: 16px;
  }
}

.datasource-item {
  background: #f8fafc;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  .datasource-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #e4e7ed;
    
    .datasource-title {
      font-weight: 600;
      color: #303133;
      font-size: 14px;
    }
    
    .el-tag {
      font-size: 11px;
    }
    
    .el-button {
      margin-left: auto;
    }
  }
  
  .selected-table-info {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    margin-left: 70px;
  }
  
  .date-code-row {
    display: flex;
    gap: 16px;
    margin-top: 12px;
    
    .field-item {
      flex: 1;
      
      .field-label {
        display: block;
        font-size: 13px;
        color: #606266;
        margin-bottom: 6px;
        
        .required {
          color: #f56c6c;
          margin-right: 2px;
        }
      }
    }
  }
  
  .field-desc {
    color: #999;
    font-size: 12px;
    margin-left: 8px;
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
}

// 数据依赖显示样式
.data-sources-display {
  .source-item {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px dashed #e4e7ed;
    
    &:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    
    .table-name {
      font-weight: 600;
      color: #303133;
      margin-bottom: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
    }
    
    .key-fields {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .field-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  }
}

.no-data {
  color: #909399;
  font-size: 13px;
}

// 回测对话框样式
.backtest-dialog-content {
  .factor-info {
    background: #f5f7fa;
    border-radius: 6px;
    padding: 12px;
    
    .expression-code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      color: #606266;
      background: #fff;
      padding: 2px 6px;
      border-radius: 4px;
      word-break: break-all;
    }
    
    .data-sources-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      
      .data-source-item {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .ds-fields {
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 12px;
          color: #606266;
        }
      }
    }
  }
  
  .batch-factors-info {
    background: #f5f7fa;
    border-radius: 6px;
    padding: 12px;
    
    .batch-header {
      font-weight: 500;
      margin-bottom: 10px;
      color: #303133;
    }
    
    .batch-list {
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      
      .batch-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        background: #fff;
        border-radius: 4px;
        
        .batch-name {
          font-size: 13px;
          color: #606266;
        }
      }
    }
  }
}

// 搜索对话框样式
.search-dialog-content {
  .search-header {
    margin-bottom: 16px;
  }
  
  .search-results {
    min-height: 300px;
    max-height: 400px;
    overflow-y: auto;
    
    .results-loading,
    .results-hint,
    .results-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: #909399;
      gap: 12px;
    }
    
    .results-content {
      .table-card {
        padding: 12px 16px;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        
        &:hover {
          border-color: #409eff;
          background: #f0f7ff;
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          
          .table-name {
            font-weight: 600;
            color: #303133;
            font-family: 'Monaco', 'Menlo', monospace;
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

// 批量上传样式
.batch-upload-content {
  .upload-section {
    :deep(.el-card__header) {
      padding: 12px 16px;
      background: #f5f7fa;
      font-weight: 500;
    }
    
    :deep(.el-card__body) {
      padding: 16px;
    }
  }
  
  .template-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    
    p {
      margin: 0;
      color: #606266;
    }
  }
  
  .template-fields {
    .field-title {
      font-weight: 500;
      margin-bottom: 8px;
      color: #303133;
    }
  }
  
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  :deep(.el-upload-dragger) {
    padding: 30px;
  }
  
  :deep(.error-row) {
    background-color: #fef0f0 !important;
  }
}

// 股票池 Tab 样式（回测对话框）
.stock-pool-tabs-mini {
  :deep(.el-tabs__header) {
    margin-bottom: 10px;
    
    .el-tabs__nav-wrap::after {
      display: none;
    }
    
    .el-tabs__item {
      padding: 0 12px;
      height: 32px;
      line-height: 32px;
      font-size: 13px;
    }
  }
  
  :deep(.el-tabs__content) {
    max-height: 180px;
    overflow-y: auto;
  }
}

.pool-radio-list-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  
  .el-radio {
    margin: 0;
    padding: 6px 12px;
    background: #f5f7fa;
    border-radius: 6px;
    
    &:hover {
      background: #e6f0ff;
    }
    
    :deep(.el-radio__label) {
      font-size: 13px;
    }
  }
}

.pool-radio-grid-mini {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  
  .el-radio {
    margin: 0;
    padding: 6px 8px;
    background: #f5f7fa;
    border-radius: 6px;
    
    &:hover {
      background: #e6f0ff;
    }
    
    :deep(.el-radio__label) {
      font-size: 12px;
    }
  }
}

// 已选基准列表
.selected-benchmarks-list {
  margin-top: 8px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 6px;
  
  .selected-label {
    font-size: 12px;
    color: #606266;
    font-weight: 500;
    margin-right: 8px;
  }
}

// 基准指数 Tab 样式（回测对话框）
.benchmark-tabs-mini {
  :deep(.el-tabs__header) {
    margin-bottom: 8px;
    
    .el-tabs__item {
      padding: 0 12px;
      height: 30px;
      line-height: 30px;
      font-size: 13px;
    }
  }
  
  .benchmark-checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 12px;
    
    .el-checkbox {
      margin-right: 0;
      
      :deep(.el-checkbox__label) {
        font-size: 13px;
      }
    }
  }
  
  .industry-sub-tabs-mini {
    :deep(.el-tabs__header) {
      margin-bottom: 8px;
    }
    
    :deep(.el-tabs__item) {
      padding: 0 10px;
      font-size: 12px;
      height: 28px;
      line-height: 28px;
    }
  }
  
  .industry-grid-mini {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px 8px;
    max-height: 150px;
    overflow-y: auto;
    
    .el-checkbox {
      margin-right: 0;
      
      :deep(.el-checkbox__label) {
        font-size: 12px;
      }
    }
  }
}
</style>
