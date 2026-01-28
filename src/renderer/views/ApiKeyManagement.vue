<template>
  <div class="api-key-management">
    <!-- Tab 标签页 -->
    <el-card>
      <el-tabs v-model="activeTab" type="border-card" @tab-change="handleTabChange">
        <!-- Tab 1: API Key 列表 -->
        <el-tab-pane label="API Key列表" name="list">
          <div class="tab-header">
            <el-button type="primary" :icon="Plus" @click="showCreateDialog">
              创建 API Key
            </el-button>
          </div>
      
      <!-- 加载中 -->
      <div v-if="loading" style="text-align: center; padding: 40px;">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p style="margin-top: 10px; color: #909399;">加载中...</p>
      </div>
      
      <!-- 空状态 -->
      <el-empty 
        v-else-if="apiKeys.length === 0" 
        description="暂无 API Key，请创建一个"
        :image-size="160"
      />
      
      <!-- API Key 表格 -->
      <el-table 
        v-else
        :data="apiKeys" 
        style="width: 100%"
        stripe
      >
        <el-table-column label="名称" prop="name" min-width="120" />
        
        <el-table-column label="API Key" prop="apiKey" min-width="200">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-text 
                class="api-key-text" 
                :type="row.showFull ? 'primary' : 'info'"
                style="font-family: monospace; font-size: 13px;"
              >
                {{ row.showFull ? row.fullKey : row.apiKey }}
              </el-text>
              <el-button 
                :icon="row.showFull ? Hide : View" 
                size="small" 
                text
                @click="toggleKeyVisibility(row)"
              >
                {{ row.showFull ? '隐藏' : '显示' }}
              </el-button>
              <el-button 
                :icon="CopyDocument" 
                size="small" 
                text
                @click="copyToClipboard(row.fullKey || row.apiKey)"
              >
                复制
              </el-button>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '激活' : '已吊销' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">
            <el-text size="small" type="info">
              {{ formatDate(row.createdAt) }}
            </el-text>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="450" fixed="right">
          <template #default="{ row }">
            <div style="display: flex; gap: 8px;">
              <el-button 
                size="small" 
                :icon="View"
                @click="handleViewDetails(row)"
              >
                详情
              </el-button>
              <el-button 
                size="small" 
                type="primary"
                :icon="Edit"
                @click="handleEdit(row)"
              >
                编辑
              </el-button>
              <el-button 
                size="small" 
                type="warning"
                :icon="Key"
                @click="handlePermissionConfig(row)"
              >
                权限配置
              </el-button>
              <el-button 
                v-if="row.status === 'active'"
                size="small" 
                type="danger"
                @click="handleRevoke(row)"
              >
                吊销
              </el-button>
              <el-button 
                v-else
                size="small" 
                type="success"
                @click="handleReactivate(row)"
              >
                激活
              </el-button>
              <el-button 
                size="small" 
                type="danger"
                :icon="Delete"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
        </el-tab-pane>
        
        <!-- Tab 2: 权限配置 -->
        <el-tab-pane label="权限配置" name="permissions">
          <!-- Loading 权限注册表 -->
          <div v-if="!permissionRegistry && permissionLoading" style="text-align: center; padding: 60px;">
            <el-icon class="is-loading" :size="50"><Loading /></el-icon>
            <p style="margin-top: 15px; color: #909399; font-size: 16px;">正在加载系统权限...</p>
          </div>
          
          <!-- 权限注册表加载完成 -->
          <div v-else-if="permissionRegistry">
            <!-- 用户选择器 -->
            <div style="margin-bottom: 20px;">
              <el-select 
                v-model="selectedPermissionKey" 
                placeholder="请选择要配置权限的用户"
                filterable
                clearable
                style="width: 300px;"
                @change="loadUserPermissions"
              >
                <el-option
                  v-for="key in apiKeys"
                  :key="key.id"
                  :label="key.name"
                  :value="key.id"
                >
                  <span>{{ key.name }}</span>
                  <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                    {{ key.apiKey }}
                  </span>
                </el-option>
              </el-select>
              <span style="margin-left: 10px; color: #909399; font-size: 13px;">
                {{ selectedPermissionKey ? '正在配置选中用户的权限' : '未选择用户，所有权限为未选中状态' }}
              </span>
            </div>
            
            <!-- 分类标签 -->
            <div class="permission-categories" style="margin-bottom: 20px;">
              <!-- 菜单权限（固定） -->
              <el-button
                :type="activePermissionCategory === 'menu' ? 'primary' : ''"
                @click="activePermissionCategory = 'menu'"
              >
                菜单权限 ({{ selectedMenuPermissions.length }})
              </el-button>
              
              <!-- API权限分类（动态渲染） -->
              <el-button
                v-for="cat in apiCategories"
                :key="cat.code"
                :type="activePermissionCategory === cat.code ? 'primary' : ''"
                @click="activePermissionCategory = cat.code"
              >
                {{ cat.name }} ({{ getSelectedInCategory(cat.code) }}/{{ getCategoryPermissions(cat.code).length }})
              </el-button>
              
              <!-- 数据源权限（固定） -->
              <el-button
                :type="activePermissionCategory === 'datasource' ? 'primary' : ''"
                @click="activePermissionCategory = 'datasource'"
              >
                数据源权限 ({{ selectedDatasources.length }}/{{ allDatasources.length }})
              </el-button>
              
              <!-- 基础配置（固定） -->
              <el-button
                :type="activePermissionCategory === 'basic' ? 'primary' : ''"
                @click="activePermissionCategory = 'basic'"
              >
                基础配置
              </el-button>
            </div>
            
            <!-- 权限内容展示区 -->
            <el-card v-loading="permissionLoading">
              <!-- 菜单权限（3级树形结构）-->
              <div v-if="activePermissionCategory === 'menu'" style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                  <el-button size="small" @click="selectAllMenuPermissions">全选</el-button>
                  <el-button size="small" @click="unselectAllMenuPermissions">全不选</el-button>
                  <el-button size="small" @click="expandAllMenus">全部展开</el-button>
                  <el-button size="small" @click="collapseAllMenus">全部折叠</el-button>
                </div>
                
                <el-tree
                  ref="menuTreeRef"
                  :data="allMenusConfig"
                  node-key="id"
                  show-checkbox
                  check-strictly
                  :default-expand-all="false"
                  :props="{ label: 'name', children: 'children' }"
                  @check="handleMenuCheck"
                  style="border: 1px solid #dcdfe6; padding: 15px; border-radius: 4px; background: #fafafa;"
                >
                  <template #default="{ data }">
                    <span style="font-size: 14px;">
                      {{ data.name }}
                      <el-tag v-if="data.level" size="small" style="margin-left: 8px;">
                        {{ data.level }}级
                      </el-tag>
                    </span>
                  </template>
                </el-tree>
                
                <div style="margin-top: 20px; padding: 10px; background: #f0f9ff; border-radius: 4px;">
                  <div style="font-size: 13px; color: #606266;">
                    已选择 <strong style="color: #409eff;">{{ selectedMenuPermissions.length }}</strong> 个菜单
                  </div>
                </div>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: right;">
                  <el-button @click="resetMenuPermissions">重置</el-button>
                  <el-button type="primary" @click="saveMenuPermissions">保存菜单权限</el-button>
                </div>
              </div>
              
              <!-- API权限分类（动态渲染） -->
              <div 
                v-else-if="apiCategories.some(c => c.code === activePermissionCategory)" 
                style="padding: 20px;"
              >
                <div style="margin-bottom: 15px;">
                  <el-button size="small" @click="selectAllCategoryPermissions(activePermissionCategory)">全选</el-button>
                  <el-button size="small" @click="unselectAllCategoryPermissions(activePermissionCategory)">全不选</el-button>
                </div>
                
                <el-table :data="getCategoryPermissions(activePermissionCategory)" style="width: 100%">
                  <el-table-column width="60">
                    <template #default="{ row }">
                      <el-checkbox 
                        :model-value="selectedApiPermissions.includes(row.resource)"
                        @change="togglePermission(row.resource)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column label="权限名称" min-width="150">
                    <template #default="{ row }">
                      <div style="font-weight: 500;">{{ row.name }}</div>
                    </template>
                  </el-table-column>
                  <el-table-column label="接口" min-width="200">
                    <template #default="{ row }">
                      <el-text type="info" style="font-family: monospace; font-size: 12px;">{{ row.resource }}</el-text>
                    </template>
                  </el-table-column>
                  <el-table-column label="风险等级" width="100">
                    <template #default="{ row }">
                      <el-tag 
                        :type="row.risk_level === 'high' ? 'danger' : row.risk_level === 'medium' ? 'warning' : 'info'" 
                        size="small"
                      >
                        {{ row.risk_level }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="说明" min-width="200">
                    <template #default="{ row }">
                      <el-text size="small">{{ row.description }}</el-text>
                    </template>
                  </el-table-column>
                </el-table>
                
                <div style="margin-top: 20px; padding: 20px; border-top: 1px solid #eee; text-align: right;">
                  <el-button @click="resetApiPermissions">重置</el-button>
                  <el-button type="primary" @click="saveApiPermissions">保存{{ getCategoryDisplayName(activePermissionCategory) }}</el-button>
                </div>
              </div>

              <!-- 数据源权限 -->
              <div v-else-if="activePermissionCategory === 'datasource'" style="padding: 30px;">
                <div style="margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <el-button size="default" @click="selectAllDatasources">全选</el-button>
                    <el-button size="default" @click="unselectAllDatasources">全不选</el-button>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                  <div 
                    v-for="ds in allDatasources" 
                    :key="ds.code"
                    :class="{ 'datasource-card-selected': selectedDatasources.includes(ds.code) }"
                    class="datasource-card"
                    @click="toggleDatasource(ds.code)"
                  >
                    <div class="datasource-card-inner">
                      <div class="datasource-checkbox">
                        <el-checkbox 
                          :model-value="selectedDatasources.includes(ds.code)"
                          size="large"
                          @change="toggleDatasource(ds.code)"
                          @click.stop
                        />
                      </div>
                      <div class="datasource-content">
                        <div class="datasource-header">
                          <div class="datasource-name">{{ ds.name }}</div>
                          <el-tag :type="getDataSourceTagType(ds.code)" effect="plain" size="default">
                            {{ ds.tables }}{{ ds.type }}
                          </el-tag>
                        </div>
                        <div class="datasource-description">{{ ds.description }}</div>
                        <div class="datasource-footer">
                          <el-tag size="small" effect="plain">{{ ds.code }}</el-tag>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div style="margin-top: 30px; text-align: right;">
                  <el-button size="large" @click="resetDatasourcePermissions">重置</el-button>
                  <el-button size="large" type="primary" @click="saveDatasourcePermissions">保存数据源权限</el-button>
                </div>
              </div>

              <!-- 基础配置 -->
              <div v-else-if="activePermissionCategory === 'basic'" style="padding: 30px;">
                <el-form :model="basicConfig" label-width="120px" style="max-width: 600px;">
                  <el-form-item label="用户名称">
                    <el-input v-model="basicConfig.name" placeholder="请输入用户名称" />
                  </el-form-item>
                  
                  <el-form-item label="描述信息">
                    <el-input 
                      v-model="basicConfig.description" 
                      type="textarea" 
                      :rows="3"
                      placeholder="选填：用户描述或备注信息"
                    />
                  </el-form-item>
                  
                  <el-form-item label="数据等级">
                    <el-radio-group v-model="basicConfig.data_level">
                      <el-radio value="L0" size="large">
                        <span style="font-weight: 500;">L0 - 基础级</span>
                        <span style="margin-left: 10px; color: #909399; font-size: 13px;">（权限最低，受限数据，试用用户）</span>
                      </el-radio>
                      <el-radio value="L1" size="large" style="margin-top: 10px;">
                        <span style="font-weight: 500;">L1 - 标准级</span>
                        <span style="margin-left: 10px; color: #909399; font-size: 13px;">（中等权限，标准数据，普通客户）</span>
                      </el-radio>
                      <el-radio value="L2" size="large" style="margin-top: 10px;">
                        <span style="font-weight: 500;">L2 - 完整级</span>
                        <span style="margin-left: 10px; color: #909399; font-size: 13px;">（权限最高，全部数据，VIP/内部用户）</span>
                      </el-radio>
                    </el-radio-group>
                  </el-form-item>
                  
                  <el-form-item label="速率限制">
                    <el-input-number 
                      v-model="basicConfig.rate_limit" 
                      :min="-1" 
                      :max="10000"
                      :step="10"
                      controls-position="right"
                      style="width: 200px;"
                    />
                    <span style="margin-left: 15px; color: #606266;">次/分钟</span>
                    <div style="margin-top: 10px; font-size: 13px; color: #909399;">
                      设置为 -1 表示无限制，0表示禁止访问，其他值表示每分钟最大请求次数
                    </div>
                  </el-form-item>
                </el-form>
                
                <div style="margin-top: 30px; text-align: right;">
                  <el-button size="large" @click="resetBasicConfig">重置</el-button>
                  <el-button size="large" type="primary" @click="saveBasicConfig">保存基础配置</el-button>
                </div>
              </div>
            </el-card>
          </div>
        </el-tab-pane>
        
        <!-- Tab 3: 数据库配置 -->
        <el-tab-pane label="数据库配置" name="database">
          <!-- 用户选择器 -->
          <div style="margin-bottom: 20px;">
            <el-select 
              v-model="selectedDatabaseKey" 
              placeholder="请选择要配置数据库的用户"
              filterable
              clearable
              style="width: 300px;"
              @change="loadDatabaseConfig"
            >
              <el-option
                v-for="key in apiKeys"
                :key="key.id"
                :label="key.name"
                :value="key.id"
              >
                <span>{{ key.name }}</span>
                <span style="margin-left: 10px; color: #909399; font-size: 12px;">
                  {{ key.apiKey }}
                </span>
              </el-option>
            </el-select>
          </div>
          
          <!-- 数据库配置表单 -->
          <div v-if="selectedDatabaseKey && databaseConfig" v-loading="databaseLoading">
            <!-- PostgreSQL配置 -->
            <el-card style="margin-bottom: 20px;">
              <template #header>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: 600; font-size: 16px;">PostgreSQL 配置</span>
                  <el-tag type="success" size="small">关系型数据库</el-tag>
                </div>
              </template>
              
              <el-form :model="databaseConfig" label-width="120px">
                <el-form-item label="用户名">
                  <el-input 
                    v-model="databaseConfig.postgresql_username" 
                    placeholder="请输入PostgreSQL用户名"
                    clearable
                  />
                </el-form-item>
                
                <el-form-item label="密码">
                  <el-input 
                    v-model="databaseConfig.postgresql_password" 
                    placeholder="请输入PostgreSQL密码"
                    show-password
                    clearable
                  />
                </el-form-item>
              </el-form>
            </el-card>
            
            <!-- ClickHouse配置 -->
            <el-card style="margin-bottom: 20px;">
              <template #header>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-weight: 600; font-size: 16px;">ClickHouse 配置</span>
                  <el-tag type="warning" size="small">列式数据库</el-tag>
                </div>
              </template>
              
              <el-form :model="databaseConfig" label-width="120px">
                <el-form-item label="用户名">
                  <el-input 
                    v-model="databaseConfig.clickhouse_username" 
                    placeholder="请输入ClickHouse用户名"
                    clearable
                  />
                </el-form-item>
                
                <el-form-item label="密码">
                  <el-input 
                    v-model="databaseConfig.clickhouse_password" 
                    placeholder="请输入ClickHouse密码"
                    show-password
                    clearable
                  />
                </el-form-item>
              </el-form>
            </el-card>
            
            <!-- 保存按钮 -->
            <div style="text-align: right;">
              <el-button @click="resetDatabaseConfig">重置</el-button>
              <el-button type="primary" @click="saveDatabaseConfig" :loading="savingDatabase">
                保存数据库配置
              </el-button>
            </div>
          </div>
          
          <!-- 未选择提示 -->
          <el-empty 
            v-else-if="!selectedDatabaseKey"
            description="请选择要配置数据库的用户"
            :image-size="200"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
    
    <!-- 查看详情对话框 -->
    <el-dialog 
      v-model="detailsVisible" 
      title="用户详情"
      width="900px"
    >
      <!-- 加载中 -->
      <div v-if="!selectedKey" style="text-align: center; padding: 40px;">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p style="margin-top: 10px; color: #909399;">加载详情中...</p>
      </div>
      
      <el-descriptions :column="2" border v-else :label-style="{ width: '120px' }" size="default">
        <el-descriptions-item label="姓名">
          {{ selectedKey.name }}
        </el-descriptions-item>
        
        <el-descriptions-item label="状态">
          <el-tag :type="selectedKey.status === 'active' ? 'success' : 'danger'" size="small">
            {{ selectedKey.status === 'active' ? '激活' : '已吊销' }}
          </el-tag>
        </el-descriptions-item>
        
        <el-descriptions-item label="邮箱">
          {{ selectedKey.email || '-' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="手机号">
          {{ selectedKey.phone || '-' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="所属公司" :span="2">
          {{ selectedKey.company || '-' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="API Key" :span="2">
          <div style="display: flex; align-items: center; gap: 8px;">
            <el-text style="font-family: monospace; font-size: 13px;">
              {{ selectedKey.apiKey }}
            </el-text>
            <el-button 
              :icon="CopyDocument" 
              size="small" 
              text
              @click="copyToClipboard(selectedKey.fullKey || selectedKey.apiKey)"
            >
              复制
            </el-button>
          </div>
        </el-descriptions-item>
        
        <el-descriptions-item label="速率限制">
          {{ selectedKey.rate_limit || '-' }} 次/秒
        </el-descriptions-item>
        
        <el-descriptions-item label="数据级别">
          <el-tag size="small">{{ selectedKey.data_level || '-' }}</el-tag>
        </el-descriptions-item>
        
        <el-descriptions-item label="创建时间">
          {{ formatDate(selectedKey.createdAt) }}
        </el-descriptions-item>
        
        <el-descriptions-item label="最后使用">
          {{ selectedKey.last_used ? formatDate(selectedKey.last_used) : '未使用' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="过期时间" :span="2">
          {{ selectedKey.expires_at ? formatDate(selectedKey.expires_at) : '永不过期' }}
        </el-descriptions-item>
        
        <el-descriptions-item label="描述" :span="2">
          {{ selectedKey.description || '无描述' }}
        </el-descriptions-item>
      </el-descriptions>
      
      <!-- 🆕 数据库配置信息 -->
      <div v-if="selectedKey?.database_config" style="margin-top: 20px;">
        <el-divider content-position="left">
          <el-icon><Key /></el-icon>
          数据库配置
        </el-divider>
        <el-descriptions :column="2" border :label-style="{ width: '150px' }" size="default">
          <el-descriptions-item label="PostgreSQL 用户名">
            <el-tag type="info" size="small">{{ selectedKey.database_config.postgresql_username || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="PostgreSQL 密码">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-text style="font-family: monospace;">{{ selectedKey.database_config.postgresql_password || '-' }}</el-text>
              <el-button 
                :icon="CopyDocument" 
                size="small" 
                text
                @click="copyToClipboard(selectedKey.database_config.postgresql_password || '')"
              />
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="ClickHouse 用户名">
            <el-tag type="warning" size="small">{{ selectedKey.database_config.clickhouse_username || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="ClickHouse 密码">
            <div style="display: flex; align-items: center; gap: 8px;">
              <el-text style="font-family: monospace;">{{ selectedKey.database_config.clickhouse_password || '-' }}</el-text>
              <el-button 
                :icon="CopyDocument" 
                size="small" 
                text
                @click="copyToClipboard(selectedKey.database_config.clickhouse_password || '')"
              />
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      
      <!-- 无数据库配置时的提示 -->
      <div v-else-if="selectedKey" style="margin-top: 20px;">
        <el-divider content-position="left">
          <el-icon><Key /></el-icon>
          数据库配置
        </el-divider>
        <el-alert 
          type="warning" 
          :closable="false"
          show-icon
        >
          <template #title>
            该用户暂无数据库配置信息
          </template>
          <template #default>
            可能是旧版本创建的用户，请在"数据库配置"标签页中手动配置
          </template>
        </el-alert>
      </div>
      
      <template #footer>
        <el-button @click="detailsVisible = false">关闭</el-button>
      </template>
    </el-dialog>
    
    <!-- 编辑对话框（只编辑基本信息） -->
    <el-dialog 
      v-model="dialogVisible" 
      title="编辑用户信息"
      width="550px"
      :close-on-click-modal="false"
    >
      <el-form :model="formData" label-width="100px" ref="formRef" :rules="formRules">
        <el-form-item label="姓名" prop="name">
          <el-input 
            v-model="formData.name" 
            placeholder="请输入姓名"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="邮箱" prop="email">
          <el-input 
            v-model="formData.email" 
            placeholder="请输入邮箱地址"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="手机号" prop="phone">
          <el-input 
            v-model="formData.phone" 
            placeholder="请输入手机号"
            clearable
            maxlength="11"
          />
        </el-form-item>
        
        <el-form-item label="所属公司" prop="company">
          <el-input 
            v-model="formData.company" 
            placeholder="请输入所属公司"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input 
            v-model="formData.description" 
            type="textarea"
            :rows="2"
            placeholder="请输入描述/备注信息（可选）"
            clearable
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit"
          :loading="submitting"
        >
          {{ submitting ? '保存中...' : '确定' }}
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 创建API Key对话框 -->
    <el-dialog 
      v-model="createDialogVisible" 
      title="创建用户"
      width="550px"
      :close-on-click-modal="false"
    >
      <el-form :model="createFormData" label-width="100px" ref="createFormRef" :rules="createFormRules">
        <el-form-item label="姓名" prop="name">
          <el-input 
            v-model="createFormData.name" 
            placeholder="请输入姓名"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="邮箱" prop="email">
          <el-input 
            v-model="createFormData.email" 
            placeholder="请输入邮箱地址"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="手机号" prop="phone">
          <el-input 
            v-model="createFormData.phone" 
            placeholder="请输入手机号"
            clearable
            maxlength="11"
          />
        </el-form-item>
        
        <el-form-item label="所属公司" prop="company">
          <el-input 
            v-model="createFormData.company" 
            placeholder="请输入所属公司"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input 
            v-model="createFormData.description" 
            type="textarea"
            :rows="2"
            placeholder="请输入描述/备注信息（可选）"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="createFormData.expires_at"
            type="datetime"
            placeholder="选择过期时间（可选）"
            style="width: 100%"
            value-format="YYYY-MM-DDTHH:mm:ss"
          />
          <div style="margin-top: 4px; color: #909399; font-size: 12px;">
            不设置则永不过期
          </div>
        </el-form-item>
        
        <el-alert
          type="info"
          :closable="false"
          show-icon
        >
          <template #title>
            <div style="font-size: 13px;">
              创建成功后系统会自动生成API Key<br>
              权限配置请稍后通过"权限配置"按钮进行设置
            </div>
          </template>
        </el-alert>
      </el-form>
      
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleCreateSubmit"
          :loading="creating"
        >
          {{ creating ? '创建中...' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
    
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { 
  Plus,
  Edit, 
  Delete, 
  View,
  Hide,
  CopyDocument,
  Loading,
  Key
} from '@element-plus/icons-vue'
import pinyin from 'pinyin'

// 🆕 生成数据库凭证（中文名转拼音）
function generateDBCredentials(chineseName: string): { username: string; password: string } {
  // 转拼音，小写，去除空格
  const pinyinArr = pinyin(chineseName, { style: pinyin.STYLE_NORMAL })
  const username = pinyinArr.flat().join('').toLowerCase()
  
  // 密码：首字母大写 + 拼音 + 2025
  const password = username.charAt(0).toUpperCase() + username.slice(1) + '2025'
  
  return { username, password }
}

interface ApiKeyItem {
  id: string
  name: string
  apiKey: string
  fullKey?: string
  showFull?: boolean
  isDefault: boolean
  createdAt: string
  menu_permissions?: string[]
  permissions?: string[]
  accountName?: string
  databaseCredentials?: any
  status?: string
  rate_limit?: number
  data_level?: string
  last_used?: string
  description?: string
  email?: string
  phone?: string
  company?: string
  expires_at?: string
  // 🆕 数据库配置
  database_config?: {
    postgresql_username?: string
    postgresql_password?: string
    clickhouse_username?: string
    clickhouse_password?: string
  }
}

const activeTab = ref('list')
const loading = ref(false)
const apiKeys = ref<ApiKeyItem[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const detailsVisible = ref(false)
const selectedKey = ref<ApiKeyItem | null>(null)
const createDialogVisible = ref(false)
const creating = ref(false)
const createFormRef = ref<FormInstance>()

// Tab 2: 权限配置相关
const selectedPermissionKey = ref('')
const permissionConfig = ref<any>(null)
const activePermissionCategory = ref('menu')
const permissionRegistry = ref<any>(null)
const permissionLoading = ref(false)
// 可编辑的权限
const selectedMenuPermissions = ref<string[]>([])
const selectedApiPermissions = ref<string[]>([])
const selectedDatasources = ref<string[]>([])

// 基础配置
const basicConfig = ref({
  name: '',
  description: '',
  data_level: 'L2',
  rate_limit: -1
})

// 所有可用数据源
const allDatasources = [
  { code: 'postgresql', name: '财务数据库', description: '原始静态数据（财务、基本信息等）', tables: 755, type: '张表' },
  { code: 'redis', name: '实时行情库', description: '实时行情数据（ZZ-01~ZZ-107）', tables: 53, type: '个数据源' },
  { code: 'clickhouse', name: '数据加工库', description: '数据加工和宽表', tables: 183, type: '张表' },
  { code: 'clickhouse_data', name: '行情镜像库', description: '完整行情数据（ZZ-01~ZZ-107等）', tables: 56, type: '张表' }
]

// Tab 3: 数据库配置相关
const selectedDatabaseKey = ref('')
const databaseConfig = ref<any>(null)
const databaseLoading = ref(false)
const savingDatabase = ref(false)
const originalDatabaseConfig = ref<any>(null)

// 所有可用菜单（从后端获取的3级菜单树）
const allMenusConfig = ref<any[]>([])
const menuTreeRef = ref<any>(null)

// 加载所有菜单定义
const loadAllMenus = async () => {
  try {
    // 先获取当前API Key
    const keys = await window.electronAPI.config.getApiKeys()
    const defaultKey = keys.find((k: any) => k.isDefault)
    
    if (defaultKey) {
      const fullKey = await window.electronAPI.config.getFullApiKey(defaultKey.id)
      if (fullKey) {
        // 设置API Key后再调用
        await window.electronAPI.fund.setApiKey(fullKey)
        
        const result = await window.electronAPI.account.getAllMenus()
        
        if (result.success && result.data) {
          allMenusConfig.value = result.data
          console.log('✅ 加载菜单定义成功，共', result.data.length, '个一级菜单')
        }
      }
    }
  } catch (error: any) {
    console.error('加载菜单定义失败:', error)
    // 不显示错误提示，静默失败
    // ElMessage.error('加载菜单失败')
  }
}

// 树形菜单选中处理
const handleMenuCheck = () => {
  if (menuTreeRef.value) {
    selectedMenuPermissions.value = menuTreeRef.value.getCheckedKeys()
  }
}

// 展开所有菜单节点
const expandAllMenus = () => {
  if (menuTreeRef.value) {
    // 获取所有节点的key并展开
    const allKeys = getAllMenuIds(allMenusConfig.value)
    allKeys.forEach(key => {
      menuTreeRef.value.store.nodesMap[key]?.expand()
    })
  }
}

// 折叠所有菜单节点
const collapseAllMenus = () => {
  if (menuTreeRef.value) {
    const allKeys = getAllMenuIds(allMenusConfig.value)
    allKeys.forEach(key => {
      menuTreeRef.value.store.nodesMap[key]?.collapse()
    })
  }
}

// 递归获取所有菜单ID
const getAllMenuIds = (menus: any[]): string[] => {
  let ids: string[] = []
  menus.forEach(menu => {
    ids.push(menu.id)
    if (menu.children && menu.children.length > 0) {
      ids = ids.concat(getAllMenuIds(menu.children))
    }
  })
  return ids
}

const formData = reactive({
  id: '',
  name: '',
  email: '',
  phone: '',
  company: '',
  description: ''
})

const createFormData = reactive({
  name: '',
  email: '',
  phone: '',
  company: '',
  description: '',
  expires_at: ''
})

const formRules = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式', trigger: 'blur' }
  ],
  company: [
    { required: true, message: '请输入所属公司', trigger: 'blur' }
  ]
}

const createFormRules = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式', trigger: 'blur' }
  ],
  company: [
    { required: true, message: '请输入所属公司', trigger: 'blur' }
  ]
}

// 格式化日期
const formatDate = (date: string | number): string => {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 切换Key显示/隐藏
const toggleKeyVisibility = async (row: ApiKeyItem) => {
  if (!row.showFull) {
    // 显示完整Key
    if (!row.fullKey) {
      const fullKey = await window.electronAPI.config.getFullApiKey(row.id)
      if (fullKey) {
        row.fullKey = fullKey
      } else {
        ElMessage.error('获取完整 Key 失败')
        return
      }
    }
  }
  row.showFull = !row.showFull
}

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

// 加载API Key列表（调用管理接口获取所有Key）
const loadApiKeys = async () => {
  loading.value = true
  try {
    const result = await window.electronAPI.config.fetchAllApiKeys()
    
    if (result.success && result.data) {
      apiKeys.value = result.data.map((key: any) => ({
        id: key.key || key.id,  // 后端返回的是 key 字段
        name: key.name || '',
        apiKey: key.masked_key || '',  // 后端返回的是脱敏后的Key
        fullKey: key.key,  // 完整Key
        showFull: false,
        isDefault: false,  // 管理接口不区分默认Key
        createdAt: key.created_at || '',
        menu_permissions: key.menu_permissions || [],
        permissions: key.permissions || [],
        accountName: key.name || '',
        status: key.status || 'active',
        rate_limit: key.rate_limit,
        data_level: key.data_level,
        last_used: key.last_used,
        description: key.description || '',
        email: key.email || '',
        phone: key.phone || '',
        company: key.company || '',
        expires_at: key.expires_at || ''
      }))
      console.log(`✅ 加载了 ${apiKeys.value.length} 个API Key`)
    } else {
      ElMessage.error(result.error || '加载失败')
    }
  } catch (error: any) {
    ElMessage.error('加载 API Key 列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 显示创建对话框
const showCreateDialog = () => {
  createFormData.name = ''
  createFormData.email = ''
  createFormData.phone = ''
  createFormData.company = ''
  createFormData.description = ''
  createFormData.expires_at = ''
  createDialogVisible.value = true
}

// 提交创建表单
const handleCreateSubmit = async () => {
  if (!createFormRef.value) return
  
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    creating.value = true
    
    try {
      // 🆕 生成数据库凭证
      const { username, password } = generateDBCredentials(createFormData.name)
      console.log('🔑 生成数据库凭证:', { username, password })
      
      // 调用后端接口 POST /api/v1/admin/apikeys
      const requestData: any = {
        name: createFormData.name,
        email: createFormData.email,
        phone: createFormData.phone,
        company: createFormData.company,
        // 🆕 数据库配置（自动生成）
        postgresql_username: username,
        postgresql_password: password,
        clickhouse_username: username,
        clickhouse_password: password
      }
      
      // 可选字段
      if (createFormData.description) {
        requestData.description = createFormData.description
      }
      if (createFormData.expires_at) {
        requestData.expires_at = createFormData.expires_at
      }
      
      console.log('创建用户 - 请求数据:', requestData)
      
      const result = await window.electronAPI.config.createApiKey(requestData)
      
      if (result.success) {
        // 🆕 显示创建成功信息，包含数据库配置
        const dbConfig = result.data?.database_config
        if (dbConfig) {
          ElMessageBox.alert(
            `<div style="line-height: 2;">
              <p><strong>✅ 用户创建成功！</strong></p>
              <p>请通过"权限配置"按钮设置该用户的权限</p>
              <hr style="margin: 10px 0; border: none; border-top: 1px solid #eee;">
              <p><strong>📋 数据库配置信息：</strong></p>
              <p>PostgreSQL 用户名：<code>${dbConfig.postgresql_username}</code></p>
              <p>PostgreSQL 密码：<code>${dbConfig.postgresql_password}</code></p>
              <p>ClickHouse 用户名：<code>${dbConfig.clickhouse_username}</code></p>
              <p>ClickHouse 密码：<code>${dbConfig.clickhouse_password}</code></p>
            </div>`,
            '创建成功',
            {
              dangerouslyUseHTMLString: true,
              confirmButtonText: '我知道了'
            }
          )
        } else {
          ElMessage.success('创建成功！请通过"权限配置"按钮设置该用户的权限')
        }
        createDialogVisible.value = false
        await loadApiKeys()
      } else {
        // 🆕 处理校验失败的错误
        const errorResult = result as any
        if (errorResult.field) {
          ElMessage.error(`${errorResult.field}: ${errorResult.error}`)
        } else {
          ElMessage.error(result.error || '创建失败')
        }
      }
      
    } catch (error: any) {
      ElMessage.error(error.message || '创建失败')
    } finally {
      creating.value = false
    }
  })
}

// 查看详情
const handleViewDetails = async (row: ApiKeyItem) => {
  try {
    detailsVisible.value = true
    selectedKey.value = null  // 先清空，显示loading
    
    // 并行调用详情接口和数据库配置接口
    const [detailResult, dbConfigResult] = await Promise.all([
      window.electronAPI.config.fetchApiKeyDetail(row.id),
      window.electronAPI.config.fetchDatabaseConfig(row.id)
    ])
    
    if (detailResult.success && detailResult.data) {
      // 🆕 从数据库配置接口获取配置
      let dbConfig: ApiKeyItem['database_config'] = undefined
      if (dbConfigResult.success && dbConfigResult.data) {
        const config = dbConfigResult.data.database_config || dbConfigResult.data
        dbConfig = {
          postgresql_username: config.postgresql_username || '',
          postgresql_password: config.postgresql_password || '',
          clickhouse_username: config.clickhouse_username || '',
          clickhouse_password: config.clickhouse_password || ''
        }
      }
      
      selectedKey.value = {
        id: detailResult.data.key || row.id,
        name: detailResult.data.name || '',
        apiKey: detailResult.data.masked_key || '',
        fullKey: detailResult.data.key,
        showFull: false,
        isDefault: false,
        createdAt: detailResult.data.created_at || '',
        menu_permissions: detailResult.data.menu_permissions || [],
        permissions: detailResult.data.permissions || [],  // 注意：详情接口可能返回 permissions 字段
        accountName: detailResult.data.name || '',
        status: detailResult.data.status || 'active',
        rate_limit: detailResult.data.rate_limit,
        data_level: detailResult.data.data_level,
        last_used: detailResult.data.last_used,
        description: detailResult.data.description || '',
        email: detailResult.data.email || '',
        phone: detailResult.data.phone || '',
        company: detailResult.data.company || '',
        expires_at: detailResult.data.expires_at || '',
        // 🆕 数据库配置（从独立接口获取）
        database_config: dbConfig
      }
    } else {
      detailsVisible.value = false
      ElMessage.error(detailResult.error || '获取详情失败')
    }
  } catch (error: any) {
    detailsVisible.value = false
    ElMessage.error('获取详情失败: ' + error.message)
  }
}

// 编辑基本信息
const handleEdit = async (row: ApiKeyItem) => {
  try {
    console.log('📝 点击编辑，row数据:', row)
    
    // 先用列表数据填充（立即显示原来的信息）
    formData.id = row.id
    formData.name = row.name
    formData.email = row.email || ''
    formData.phone = row.phone || ''
    formData.company = row.company || ''
    formData.description = row.description || ''
    
    console.log('📝 表单数据已填充:', formData)
    
    dialogVisible.value = true
    
    // 后台异步调用详情接口获取最新数据（静默更新）
    const result = await window.electronAPI.config.fetchApiKeyDetail(row.id)
    
    if (result.success && result.data) {
      // 静默更新为最新数据
      formData.name = result.data.name || ''
      formData.email = result.data.email || ''
      formData.phone = result.data.phone || ''
      formData.company = result.data.company || ''
      formData.description = result.data.description || ''
    }
  } catch (error: any) {
    // 获取最新数据失败不影响编辑，继续使用列表数据
    console.warn('获取最新数据失败，使用列表数据:', error.message)
  }
}

// 权限配置
const handlePermissionConfig = (row: ApiKeyItem) => {
  // 切换到权限配置Tab
  activeTab.value = 'permissions'
  // 选中该用户
  selectedPermissionKey.value = row.id
  // 加载该用户的权限配置
  loadUserPermissions()
}

// 吊销Key
const handleRevoke = async (row: ApiKeyItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要吊销 "${row.name}" 的API Key吗？吊销后将无法使用，但可以重新激活。`,
      '确认吊销',
      {
        confirmButtonText: '确定吊销',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const result = await window.electronAPI.config.revokeApiKey(row.id)
    
    if (result.success) {
      ElMessage.success('吊销成功！')
      await loadApiKeys()
    } else {
      ElMessage.error(result.error || '吊销失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('吊销失败: ' + error.message)
    }
  }
}

// 激活Key
const handleReactivate = async (row: ApiKeyItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要重新激活 "${row.name}" 的API Key吗？`,
      '确认激活',
      {
        confirmButtonText: '确定激活',
        cancelButtonText: '取消',
        type: 'info'
      }
    )
    
    const result = await window.electronAPI.config.reactivateApiKey(row.id)
    
    if (result.success) {
      ElMessage.success('激活成功！')
      await loadApiKeys()
    } else {
      ElMessage.error(result.error || '激活失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('激活失败: ' + error.message)
    }
  }
}

// 删除
const handleDelete = async (row: ApiKeyItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除 "${row.name}" 的API Key吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const result = await window.electronAPI.config.deleteApiKeyAdmin(row.id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      await loadApiKeys()
    } else {
      ElMessage.error(result.error || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

// 提交表单（保存基本信息）
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    
    try {
      const requestData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company
      }
      
      // 可选字段
      if (formData.description) {
        requestData.description = formData.description
      }
      
      console.log('编辑用户 - 请求数据:', requestData)
      
      const result = await window.electronAPI.config.updateApiKey(formData.id, requestData)
      
      if (result.success) {
        ElMessage.success('保存成功！')
        dialogVisible.value = false
        await loadApiKeys()
      } else {
        ElMessage.error(result.error || '保存失败')
      }
      
    } catch (error: any) {
      ElMessage.error(error.message || '操作失败')
    } finally {
      submitting.value = false
    }
  })
}

// 🆕 动态获取所有 API 权限分类（从后端数据中提取）
const apiCategories = computed(() => {
  if (!permissionRegistry.value?.permissions) return []
  
  // 从权限列表中提取所有唯一的 category
  const categorySet = new Set<string>()
  permissionRegistry.value.permissions.forEach((p: any) => {
    if (p.category) {
      categorySet.add(p.category)
    }
  })
  
  // 转换为数组并返回，包含分类代码和显示名称
  return Array.from(categorySet).map(code => ({
    code,
    name: getCategoryDisplayName(code)
  }))
})

// 🆕 获取分类的显示名称（从后端 categories 数组获取）
const getCategoryDisplayName = (category: string): string => {
  // 从后端返回的 categories 数组中查找（id 字段匹配 category）
  if (permissionRegistry.value?.categories) {
    const meta = permissionRegistry.value.categories.find((c: any) => c.id === category)
    if (meta?.name) return meta.name
  }
  
  // 兜底：直接返回 category 代码
  return category
}

// 从权限注册表中获取指定分类的权限
const getCategoryPermissions = (category: string) => {
  if (!permissionRegistry.value?.permissions) return []
  return permissionRegistry.value.permissions.filter((p: any) => p.category === category)
}

// 获取指定分类中已选中的权限数量
const getSelectedInCategory = (category: string) => {
  const categoryPerms = getCategoryPermissions(category)
  const categoryResources = categoryPerms.map((p: any) => p.resource)
  return selectedApiPermissions.value.filter(p => categoryResources.includes(p)).length
}

// 切换单个权限的选中状态
const togglePermission = (resource: string) => {
  const index = selectedApiPermissions.value.indexOf(resource)
  if (index > -1) {
    // 已选中，取消选中
    selectedApiPermissions.value.splice(index, 1)
  } else {
    // 未选中，添加
    selectedApiPermissions.value.push(resource)
  }
}

// 全选菜单权限
const selectAllMenuPermissions = () => {
  const allIds = getAllMenuIds(allMenusConfig.value)
  selectedMenuPermissions.value = allIds
  if (menuTreeRef.value) {
    menuTreeRef.value.setCheckedKeys(allIds)
  }
}

// 全不选菜单权限
const unselectAllMenuPermissions = () => {
  selectedMenuPermissions.value = []
  if (menuTreeRef.value) {
    menuTreeRef.value.setCheckedKeys([])
  }
}

// 全选指定分类的API权限
const selectAllCategoryPermissions = (category: string) => {
  const categoryPerms = getCategoryPermissions(category)
  const categoryResources = categoryPerms.map((p: any) => p.resource)
  
  // 先移除该分类的旧权限
  selectedApiPermissions.value = selectedApiPermissions.value.filter(p => !categoryResources.includes(p))
  // 再添加该分类的所有权限
  selectedApiPermissions.value.push(...categoryResources)
}

// 全不选指定分类的API权限
const unselectAllCategoryPermissions = (category: string) => {
  const categoryPerms = getCategoryPermissions(category)
  const categoryResources = categoryPerms.map((p: any) => p.resource)
  
  // 移除该分类的所有权限
  selectedApiPermissions.value = selectedApiPermissions.value.filter(p => !categoryResources.includes(p))
}

// 重置菜单权限（恢复到原始状态）
const resetMenuPermissions = () => {
  selectedMenuPermissions.value = [...(permissionConfig.value?.menu_permissions || [])]
}

// 保存菜单权限
const saveMenuPermissions = async () => {
  if (!selectedPermissionKey.value) {
    ElMessage.error('请先选择用户')
    return
  }
  
  // 保存前验证
  if (selectedMenuPermissions.value.length === 0) {
    const confirmed = await ElMessageBox.confirm(
      '⚠️ 警告：菜单权限为空，用户将看不到任何菜单。\n\n确定要保存吗？',
      '权限警告',
      {
        confirmButtonText: '确定保存',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).catch(() => false)
    
    if (!confirmed) return
  }
  
  try {
    console.log('💾 保存菜单权限:', selectedMenuPermissions.value)
    
    // 转换为普通对象（避免IPC序列化错误）
    const updates = {
      menu_permissions: [...selectedMenuPermissions.value]
    }
    
    const result = await window.electronAPI.config.patchPermissionConfig(
      selectedPermissionKey.value,
      updates
    )
    
    if (result.success) {
      ElMessage.success('菜单权限保存成功！')
      // 重新加载验证
      await loadUserPermissions()
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error('保存失败: ' + error.message)
  }
}

// 重置API权限（恢复到原始状态）
const resetApiPermissions = () => {
  selectedApiPermissions.value = [...(permissionConfig.value?.permissions || [])]
}

// 保存API权限
const saveApiPermissions = async () => {
  if (!selectedPermissionKey.value) {
    ElMessage.error('请先选择用户')
    return
  }
  
  // 保存前验证
  if (selectedApiPermissions.value.length === 0) {
    const confirmed = await ElMessageBox.confirm(
      '⚠️ 警告：API权限为空，用户将无法访问任何功能。\n\n确定要保存吗？',
      '权限警告',
      {
        confirmButtonText: '确定保存',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).catch(() => false)
    
    if (!confirmed) return
  }
  
  try {
    console.log('💾 保存API权限（管理+REST+WebSocket）:', selectedApiPermissions.value)
    console.log('  权限数量:', selectedApiPermissions.value.length)
    
    // 转换为普通对象（避免IPC序列化错误）
    const updates = {
      permissions: [...selectedApiPermissions.value]
    }
    
    const result = await window.electronAPI.config.patchPermissionConfig(
      selectedPermissionKey.value,
      updates
    )
    
    if (result.success) {
      ElMessage.success('API权限保存成功！')
      // 重新加载验证
      await loadUserPermissions()
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error('保存失败: ' + error.message)
  }
}

// 🆕 数据源权限相关方法
const toggleDatasource = (code: string) => {
  const index = selectedDatasources.value.indexOf(code)
  if (index > -1) {
    selectedDatasources.value.splice(index, 1)
  } else {
    selectedDatasources.value.push(code)
  }
}

const selectAllDatasources = () => {
  selectedDatasources.value = allDatasources.map(ds => ds.code)
}

const unselectAllDatasources = () => {
  selectedDatasources.value = []
}

const resetDatasourcePermissions = () => {
  selectedDatasources.value = [...(permissionConfig.value?.datasource_access || [])]
}

const saveDatasourcePermissions = async () => {
  if (!selectedPermissionKey.value) {
    ElMessage.error('请先选择用户')
    return
  }
  
  try {
    console.log('💾 保存数据源权限:', selectedDatasources.value)
    
    // 转换为普通对象（避免IPC序列化错误）
    const updates = {
      datasource_access: [...selectedDatasources.value]
    }
    
    const result = await window.electronAPI.config.patchPermissionConfig(
      selectedPermissionKey.value,
      updates
    )
    
    if (result.success) {
      ElMessage.success('数据源权限保存成功！')
      
      // 直接重新获取权限配置
      const fetchResult = await window.electronAPI.config.fetchPermissionConfig(selectedPermissionKey.value)
      if (fetchResult.success && fetchResult.data) {
        permissionConfig.value = fetchResult.data
        // 强制更新数据源权限显示
        selectedDatasources.value = [...(fetchResult.data.datasource_access || [])]
        console.log('✅ 数据源权限已刷新:', selectedDatasources.value)
      }
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error('保存失败: ' + error.message)
  }
}

// 获取数据源Tag颜色
const getDataSourceTagType = (code: string) => {
  const colorMap: Record<string, any> = {
    'postgresql': 'success',
    'redis': 'primary',
    'clickhouse': 'warning',
    'clickhouse_data': 'info'
  }
  return colorMap[code] || 'info'
}

// 🆕 基础配置相关方法
const resetBasicConfig = () => {
  if (permissionConfig.value) {
    basicConfig.value = {
      name: permissionConfig.value.name || '',
      description: permissionConfig.value.description || '',
      data_level: permissionConfig.value.data_level || 'L2',
      rate_limit: permissionConfig.value.rate_limit ?? -1
    }
  }
}

const saveBasicConfig = async () => {
  if (!selectedPermissionKey.value) {
    ElMessage.error('请先选择用户')
    return
  }
  
  try {
    console.log('💾 保存基础配置:', basicConfig.value)
    
    // 转换为普通对象（避免IPC序列化错误）
    const updates = {
      name: basicConfig.value.name,
      description: basicConfig.value.description,
      data_level: basicConfig.value.data_level,
      rate_limit: basicConfig.value.rate_limit
    }
    
    const result = await window.electronAPI.config.patchPermissionConfig(
      selectedPermissionKey.value,
      updates
    )
    
    if (result.success) {
      ElMessage.success('基础配置保存成功！')
      
      // 重新获取权限配置
      const fetchResult = await window.electronAPI.config.fetchPermissionConfig(selectedPermissionKey.value)
      if (fetchResult.success && fetchResult.data) {
        permissionConfig.value = fetchResult.data
        // 强制更新基础配置显示
        basicConfig.value = {
          name: fetchResult.data.name || '',
          description: fetchResult.data.description || '',
          data_level: fetchResult.data.data_level || 'L2',
          rate_limit: fetchResult.data.rate_limit ?? -1
        }
        console.log('✅ 基础配置已刷新:', basicConfig.value)
      }
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (error: any) {
    ElMessage.error('保存失败: ' + error.message)
  }
}

// 加载权限注册表（系统所有可用权限）
const loadPermissionRegistry = async () => {
  if (permissionRegistry.value) return  // 已加载过，直接返回
  
  try {
    permissionLoading.value = true
    const result = await window.electronAPI.config.fetchPermissionRegistry()
    
    if (result.success && result.data) {
      permissionRegistry.value = result.data
      console.log('✅ 权限注册表已加载:', permissionRegistry.value)
    } else {
      ElMessage.error(result.error || '获取权限注册表失败')
    }
  } catch (error: any) {
    ElMessage.error('获取权限注册表失败: ' + error.message)
  } finally {
    permissionLoading.value = false
  }
}

// 加载用户权限（选择用户时调用）
const loadUserPermissions = async () => {
  if (!selectedPermissionKey.value) {
    // 清空选择
    selectedMenuPermissions.value = []
    selectedApiPermissions.value = []
    selectedDatasources.value = []
    basicConfig.value = { name: '', description: '', data_level: 'L2', rate_limit: -1 }
    permissionConfig.value = null
    return
  }
  
  try {
    permissionLoading.value = true
    
    // 确保权限注册表已加载
    if (!permissionRegistry.value) {
      const registryResult = await window.electronAPI.config.fetchPermissionRegistry()
      if (registryResult.success && registryResult.data) {
        permissionRegistry.value = registryResult.data
        console.log('✅ 权限注册表已加载')
      }
    }
    
    // 1. 先获取用户完整信息（包含name、description）
    const detailResult = await window.electronAPI.config.fetchApiKeyDetail(selectedPermissionKey.value)
    
    // 2. 再加载用户权限配置
    const result = await window.electronAPI.config.fetchPermissionConfig(selectedPermissionKey.value)
    
    if (result.success && result.data) {
      permissionConfig.value = result.data
      
      // 填充菜单权限
      selectedMenuPermissions.value = [...(result.data.menu_permissions || [])]
      
      // 同步设置树形控件的选中状态（使用 nextTick 确保树已渲染）
      setTimeout(() => {
        if (menuTreeRef.value) {
          console.log('🔧 设置树选中状态:', selectedMenuPermissions.value)
          menuTreeRef.value.setCheckedKeys(selectedMenuPermissions.value)
        }
      }, 100)
      
      // 填充API权限（处理通配符 * 或 **）
      const hasWildcard = result.data.permissions && result.data.permissions.some((p: string) => p === '*' || p === '**')
      if (hasWildcard) {
        // 通配符：选中所有权限
        console.log('🔍 检测到通配符，开始展开所有权限...')
        console.log('  权限注册表状态:', permissionRegistry.value ? '已加载' : '未加载')
        
        if (permissionRegistry.value?.permissions) {
          const allPerms: string[] = []
          permissionRegistry.value.permissions.forEach((p: any) => {
            allPerms.push(p.resource)
          })
          selectedApiPermissions.value = allPerms
          console.log('✅ 通配符展开完成，共', allPerms.length, '个权限')
          console.log('  示例权限:', allPerms.slice(0, 5))
        } else {
          console.error('❌ 权限注册表为空，无法展开通配符')
          selectedApiPermissions.value = []
        }
      } else {
        selectedApiPermissions.value = [...(result.data.permissions || [])]
        console.log('✅ 使用具体权限列表，共', selectedApiPermissions.value.length, '个')
      }
      
      // 填充数据源权限
      selectedDatasources.value = [...(result.data.datasource_access || [])]
      
      // 填充基础配置（从两个接口合并数据）
      basicConfig.value = {
        name: detailResult.data?.name || result.data.name || '',
        description: detailResult.data?.description || result.data.description || '',
        data_level: result.data.data_level || 'L2',
        rate_limit: result.data.rate_limit ?? -1
      }
      
      console.log('✅ 用户权限已加载')
      console.log('  - 菜单权限:', selectedMenuPermissions.value)
      console.log('  - API权限数量:', selectedApiPermissions.value.length)
      console.log('  - 数据源权限:', selectedDatasources.value)
      console.log('  - 基础配置:', basicConfig.value)
    } else {
      ElMessage.error(result.error || '获取用户权限失败')
    }
  } catch (error: any) {
    ElMessage.error('获取用户权限失败: ' + error.message)
  } finally {
    permissionLoading.value = false
  }
}

// Tab切换事件
const handleTabChange = async (tabName: string) => {
  console.log('Tab切换到:', tabName)
  if (tabName === 'permissions') {
    // 切换到权限配置Tab，立即加载菜单定义和权限注册表
    await loadAllMenus()
    loadPermissionRegistry()
  }
}

// 加载数据库配置
const loadDatabaseConfig = async () => {
  if (!selectedDatabaseKey.value) {
    databaseConfig.value = null
    originalDatabaseConfig.value = null
    return
  }
  
  try {
    databaseLoading.value = true
    const result = await window.electronAPI.config.fetchDatabaseConfig(selectedDatabaseKey.value)
    
    if (result.success && result.data) {
      // 后端返回的是 data.database_config
      const dbConfig = result.data.database_config || result.data
      databaseConfig.value = {
        postgresql_username: dbConfig.postgresql_username?.trim() || '',
        postgresql_password: dbConfig.postgresql_password?.trim() || '',
        clickhouse_username: dbConfig.clickhouse_username?.trim() || '',
        clickhouse_password: dbConfig.clickhouse_password?.trim() || ''
      }
      
      // 保存原始配置用于重置
      originalDatabaseConfig.value = { ...databaseConfig.value }
      
      console.log('✅ 数据库配置已加载')
    } else {
      ElMessage.error(result.error || '获取数据库配置失败')
      databaseConfig.value = null
    }
  } catch (error: any) {
    ElMessage.error('获取数据库配置失败: ' + error.message)
    databaseConfig.value = null
  } finally {
    databaseLoading.value = false
  }
}

// 重置数据库配置
const resetDatabaseConfig = () => {
  if (originalDatabaseConfig.value) {
    databaseConfig.value = { ...originalDatabaseConfig.value }
  }
}

// 保存数据库配置
const saveDatabaseConfig = async () => {
  if (!selectedDatabaseKey.value) {
    ElMessage.error('请先选择用户')
    return
  }
  
  try {
    savingDatabase.value = true
    
    // 使用独立的数据库配置接口
    const updateResult = await window.electronAPI.config.updateDatabaseConfig(
      selectedDatabaseKey.value,
      {
        postgresql_username: databaseConfig.value.postgresql_username,
        postgresql_password: databaseConfig.value.postgresql_password,
        clickhouse_username: databaseConfig.value.clickhouse_username,
        clickhouse_password: databaseConfig.value.clickhouse_password
      }
    )
    
    if (updateResult.success) {
      ElMessage.success('数据库配置保存成功！')
      // 重新加载以确保数据同步
      await loadDatabaseConfig()
    } else {
      ElMessage.error(updateResult.error || '保存失败')
    }
    
  } catch (error: any) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    savingDatabase.value = false
  }
}

onMounted(async () => {
  loadApiKeys()
  // 一进入页面就加载菜单树（不等切换Tab）
  await loadAllMenus()
})
</script>

<style scoped lang="scss">
.api-key-management {
  :deep(.el-card__body) {
    padding: 0;
  }
  
  :deep(.el-tabs--border-card) {
    border: none;
    box-shadow: none;
  }
  
  :deep(.el-tabs__content) {
    padding: 20px;
  }
  
  .tab-header {
    margin-bottom: 20px;
    display: flex;
    justify-content: flex-end;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .api-key-text {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  :deep(.el-table) {
    font-size: 13px;
  }
  
  .permission-categories {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    
    .el-button {
      border-radius: 20px;
    }
  }
  
  // 数据源卡片样式
  .datasource-card {
    background: #ffffff;
    border: 2px solid #e4e7ed;
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.25s ease;
    
    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
      border-color: #409eff;
    }
    
    &.datasource-card-selected {
      border-color: #409eff;
      background: linear-gradient(135deg, #f6f9ff 0%, #ecf5ff 100%);
      box-shadow: 0 4px 16px rgba(64, 158, 255, 0.2);
      
      .datasource-name {
        color: #409eff;
      }
    }
    
    .datasource-card-inner {
      display: flex;
      align-items: flex-start;
      gap: 15px;
    }
    
    .datasource-checkbox {
      padding-top: 2px;
    }
    
    .datasource-content {
      flex: 1;
      min-width: 0;
    }
    
    .datasource-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .datasource-name {
      font-size: 17px;
      font-weight: 600;
      color: #303133;
      transition: color 0.25s;
    }
    
    .datasource-description {
      color: #606266;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 12px;
    }
    
    .datasource-footer {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
}
</style>

