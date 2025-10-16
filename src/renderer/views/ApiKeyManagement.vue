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
              <el-button
                :type="activePermissionCategory === 'menu' ? 'primary' : ''"
                @click="activePermissionCategory = 'menu'"
              >
                菜单权限 ({{ selectedMenuPermissions.length }}/7)
              </el-button>
              <el-button
                :type="activePermissionCategory === 'admin' ? 'primary' : ''"
                @click="activePermissionCategory = 'admin'"
              >
                管理权限 ({{ getSelectedInCategory('admin_api') }}/{{ getCategoryPermissions('admin_api').length }})
              </el-button>
              <el-button
                :type="activePermissionCategory === 'rest' ? 'primary' : ''"
                @click="activePermissionCategory = 'rest'"
              >
                REST API权限 ({{ getSelectedInCategory('rest_api') }}/{{ getCategoryPermissions('rest_api').length }})
              </el-button>
              <el-button
                :type="activePermissionCategory === 'ws' ? 'primary' : ''"
                @click="activePermissionCategory = 'ws'"
              >
                WebSocket权限 ({{ getSelectedInCategory('websocket_api') }}/{{ getCategoryPermissions('websocket_api').length }})
              </el-button>
            </div>
            
            <!-- 权限内容展示区 -->
            <el-card v-loading="permissionLoading">
              <!-- 菜单权限 -->
              <div v-if="activePermissionCategory === 'menu'" style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                  <el-button size="small" @click="selectAllMenuPermissions">全选</el-button>
                  <el-button size="small" @click="unselectAllMenuPermissions">全不选</el-button>
                </div>
                
                <el-checkbox-group v-model="selectedMenuPermissions">
                  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                    <el-checkbox v-for="menu in allMenusConfig" :key="menu.id" :value="menu.id" size="large">
                      <span style="font-size: 15px; font-weight: 500;">{{ menu.name }}</span>
                    </el-checkbox>
                  </div>
                </el-checkbox-group>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: right;">
                  <el-button @click="resetMenuPermissions">重置</el-button>
                  <el-button type="primary" @click="saveMenuPermissions">保存菜单权限</el-button>
                </div>
              </div>
              
              <!-- 管理权限 -->
              <div v-else-if="activePermissionCategory === 'admin'" style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                  <el-button size="small" @click="selectAllCategoryPermissions('admin_api')">全选</el-button>
                  <el-button size="small" @click="unselectAllCategoryPermissions('admin_api')">全不选</el-button>
                </div>
                
                <el-table :data="getCategoryPermissions('admin_api')" style="width: 100%">
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
                  <el-button type="primary" @click="saveApiPermissions">保存管理权限</el-button>
                </div>
              </div>
              
              <!-- REST API权限 -->
              <div v-else-if="activePermissionCategory === 'rest'" style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                  <el-button size="small" @click="selectAllCategoryPermissions('rest_api')">全选</el-button>
                  <el-button size="small" @click="unselectAllCategoryPermissions('rest_api')">全不选</el-button>
                </div>
                
                <el-table :data="getCategoryPermissions('rest_api')" style="width: 100%">
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
                  <el-button type="primary" @click="saveApiPermissions">保存REST API权限</el-button>
                </div>
              </div>
              
              <!-- WebSocket权限 -->
              <div v-else-if="activePermissionCategory === 'ws'" style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                  <el-button size="small" @click="selectAllCategoryPermissions('websocket_api')">全选</el-button>
                  <el-button size="small" @click="unselectAllCategoryPermissions('websocket_api')">全不选</el-button>
                </div>
                
                <el-table :data="getCategoryPermissions('websocket_api')" style="width: 100%">
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
                  <el-button type="primary" @click="saveApiPermissions">保存WebSocket权限</el-button>
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
    
    <!-- 权限配置对话框 -->
    <el-dialog 
      v-model="permissionDialogVisible" 
      title="权限配置"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-empty description="权限配置功能开发中..." :image-size="200" />
      
      <template #footer>
        <el-button @click="permissionDialogVisible = false">取消</el-button>
        <el-button type="primary">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
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
}

const activeTab = ref('list')
const loading = ref(false)
const apiKeys = ref<ApiKeyItem[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const detailsVisible = ref(false)
const selectedKey = ref<ApiKeyItem | null>(null)
const permissionDialogVisible = ref(false)
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

// Tab 3: 数据库配置相关
const selectedDatabaseKey = ref('')
const databaseConfig = ref<any>(null)
const databaseLoading = ref(false)
const savingDatabase = ref(false)
const originalDatabaseConfig = ref<any>(null)

// 所有可用菜单（与App.vue中的allMenus一致）
const allMenusConfig = [
  { id: 'home', name: '首页' },
  { id: 'data_center', name: '数据中心' },
  { id: 'task_management', name: '任务管理' },
  { id: 'history', name: '历史记录' },
  { id: 'sdk_download', name: 'SDK下载' },
  { id: 'api_key_management', name: 'API Key管理' },
  { id: 'settings', name: '系统设置' }
]

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
      // TODO: 调用后端接口 POST /api/v1/admin/apikeys
      const requestData: any = {
        name: createFormData.name,
        email: createFormData.email,
        phone: createFormData.phone,
        company: createFormData.company
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
        ElMessage.success('创建成功！请通过"权限配置"按钮设置该用户的权限')
        createDialogVisible.value = false
        await loadApiKeys()
      } else {
        ElMessage.error(result.error || '创建失败')
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
    
    // 调用详情接口获取完整信息
    const result = await window.electronAPI.config.fetchApiKeyDetail(row.id)
    
    if (result.success && result.data) {
      selectedKey.value = {
        id: result.data.key || row.id,
        name: result.data.name || '',
        apiKey: result.data.masked_key || '',
        fullKey: result.data.key,
        showFull: false,
        isDefault: false,
        createdAt: result.data.created_at || '',
        menu_permissions: result.data.menu_permissions || [],
        permissions: result.data.permissions || [],  // 注意：详情接口可能返回 permissions 字段
        accountName: result.data.name || '',
        status: result.data.status || 'active',
        rate_limit: result.data.rate_limit,
        data_level: result.data.data_level,
        last_used: result.data.last_used,
        description: result.data.description || '',
        email: result.data.email || '',
        phone: result.data.phone || '',
        company: result.data.company || '',
        expires_at: result.data.expires_at || ''
      }
    } else {
      detailsVisible.value = false
      ElMessage.error(result.error || '获取详情失败')
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
  selectedKey.value = row
  permissionDialogVisible.value = true
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
  selectedMenuPermissions.value = allMenusConfig.map(m => m.id)
}

// 全不选菜单权限
const unselectAllMenuPermissions = () => {
  selectedMenuPermissions.value = []
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
    
    // 加载用户权限配置
    const result = await window.electronAPI.config.fetchPermissionConfig(selectedPermissionKey.value)
    
    if (result.success && result.data) {
      permissionConfig.value = result.data
      
      // 填充菜单权限
      selectedMenuPermissions.value = [...(result.data.menu_permissions || [])]
      
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
      
      console.log('✅ 用户权限已加载')
      console.log('  - 菜单权限:', selectedMenuPermissions.value)
      console.log('  - API权限数量:', selectedApiPermissions.value.length)
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
const handleTabChange = (tabName: string) => {
  console.log('Tab切换到:', tabName)
  if (tabName === 'permissions') {
    // 切换到权限配置Tab，立即加载权限注册表
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
    const result = await window.electronAPI.config.fetchApiKeyDetail(selectedDatabaseKey.value)
    
    if (result.success && result.data && result.data.metadata) {
      const metadata = result.data.metadata
      databaseConfig.value = {
        postgresql_username: metadata.postgresql_username?.trim() || '',
        postgresql_password: metadata.postgresql_password?.trim() || '',
        clickhouse_username: metadata.clickhouse_username?.trim() || '',
        clickhouse_password: metadata.clickhouse_password?.trim() || ''
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
    
    // 第1步：先获取用户当前完整数据
    const userResult = await window.electronAPI.config.fetchApiKeyDetail(selectedDatabaseKey.value)
    
    if (!userResult.success || !userResult.data) {
      ElMessage.error('获取用户信息失败')
      return
    }
    
    // 第2步：保留原有metadata，只更新数据库凭证
    const updatedMetadata = {
      ...(userResult.data.metadata || {}),  // 保留原有数据（email、phone、company等）
      postgresql_username: databaseConfig.value.postgresql_username,
      postgresql_password: databaseConfig.value.postgresql_password,
      clickhouse_username: databaseConfig.value.clickhouse_username,
      clickhouse_password: databaseConfig.value.clickhouse_password
    }
    
    console.log('准备更新metadata:', updatedMetadata)
    
    // 第3步：调用更新接口
    const updateResult = await window.electronAPI.config.updateApiKey(
      selectedDatabaseKey.value,
      { metadata: updatedMetadata }
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

onMounted(() => {
  loadApiKeys()
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
}
</style>

