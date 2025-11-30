<template>
  <div class="admin-page">
    <div class="page-header">
      <h2>仓库管理</h2>
    </div>

    <el-tabs v-model="activeTab" class="admin-tabs">
      <!-- 团队管理 -->
      <el-tab-pane label="团队管理" name="teams">
        <div class="tab-header">
          <span class="tab-title">团队列表</span>
          <el-button type="primary" :icon="Plus" @click="showCreateTeamDialog">创建团队</el-button>
        </div>
        
        <el-table :data="teams" v-loading="loadingTeams" stripe>
          <el-table-column prop="name" label="团队名称" min-width="150" />
          <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
          <el-table-column label="代码权限" width="100">
            <template #default="{ row }">
              <el-tag :type="getPermissionType(getCodePermission(row))" size="small">
                {{ getPermissionLabel(getCodePermission(row)) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="成员数" width="100" align="center">
            <template #default="{ row }">
              {{ row.members_count || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showEditTeamDialog(row)">
                编辑
              </el-button>
              <el-button type="primary" link size="small" @click="showTeamMembers(row)">
                管理成员
              </el-button>
              <el-button type="danger" link size="small" @click="handleDeleteTeam(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 用户管理 -->
      <el-tab-pane label="用户管理" name="users">
        <div class="tab-header">
          <span class="tab-title">用户列表</span>
          <div class="header-actions">
            <el-input
              v-model="userSearch"
              placeholder="搜索用户..."
              style="width: 200px"
              clearable
              :prefix-icon="Search"
            />
            <el-button type="primary" :icon="Plus" @click="showCreateUserDialog">创建用户</el-button>
          </div>
        </div>
        
        <el-table :data="filteredUsers" v-loading="loadingUsers" stripe>
          <el-table-column label="头像" width="70">
            <template #default="{ row }">
              <el-avatar :src="row.avatar_url" :size="36">{{ row.username?.[0] }}</el-avatar>
            </template>
          </el-table-column>
          <el-table-column prop="username" label="用户名" min-width="120" />
          <el-table-column prop="full_name" label="姓名" min-width="120" />
          <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="isUserActive(row) ? 'success' : 'danger'" size="small">
                {{ isUserActive(row) ? '正常' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="管理员" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.is_admin" type="warning" size="small">是</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button 
                :type="isUserActive(row) ? 'warning' : 'success'" 
                link 
                size="small" 
                @click="handleToggleUserStatus(row)"
              >
                {{ isUserActive(row) ? '禁用' : '启用' }}
              </el-button>
              <el-button type="primary" link size="small" @click="showEditUserDialog(row)">
                编辑
              </el-button>
              <el-button type="danger" link size="small" @click="handleDeleteUser(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 仓库管理 -->
      <el-tab-pane label="仓库管理" name="repos">
        <div class="tab-header">
          <span class="tab-title">仓库列表</span>
          <el-button type="primary" :icon="Plus" @click="showCreateRepoDialog">创建仓库</el-button>
        </div>
        
        <el-table :data="repos" v-loading="loadingRepos" stripe>
          <el-table-column prop="name" label="仓库名称" min-width="150">
            <template #default="{ row }">
              <div class="repo-name">
                <el-icon><Folder /></el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
          <el-table-column label="性质" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.template" type="success" size="small">
                <el-icon style="vertical-align: middle; margin-right: 2px;"><Document /></el-icon>
                模板
              </el-tag>
              <el-tag v-else type="info" size="small">普通</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="可见性" width="100">
            <template #default="{ row }">
              <el-tag :type="row.private ? 'warning' : 'success'" size="small">
                {{ row.private ? '私有' : '公开' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.updated_at) }}
            </template>
          </el-table-column>
          <el-table-column label="协作者" min-width="200">
            <template #default="{ row }">
              <div class="collaborators-cell" v-if="row.collaborators?.length">
                <el-tag 
                  v-for="collab in row.collaborators" 
                  :key="collab.username || collab.login"
                  size="small"
                  type="info"
                >
                  {{ collab.full_name || collab.username || collab.login }}
                </el-tag>
              </div>
              <span v-else class="no-collaborators">暂无</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="showEditRepoDialog(row)">
                编辑
              </el-button>
              <el-button type="primary" link size="small" @click="showRepoCollaborators(row)">
                协作者
              </el-button>
              <el-button 
                v-if="!row.template && row.empty" 
                type="success" 
                link 
                size="small" 
                @click="showDeployToRepoDialog(row)"
              >
                下发模板
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建团队对话框 -->
    <el-dialog v-model="createTeamVisible" title="创建团队" width="650px">
      <el-form :model="teamForm" label-width="100px">
        <el-form-item label="团队名称" required>
          <el-input v-model="teamForm.name" placeholder="请输入团队名称（仅限英文、数字、下划线）" />
          <div class="form-tip">只能包含字母、数字、下划线、破折号</div>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="teamForm.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        
        <el-divider content-position="left">仓库权限</el-divider>
        <el-form-item label="仓库范围">
          <el-radio-group v-model="teamForm.includes_all_repositories">
            <el-radio :value="false">指定仓库</el-radio>
            <el-radio :value="true">所有仓库</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="创建仓库">
          <el-checkbox v-model="teamForm.can_create_org_repo">允许成员在组织中创建仓库</el-checkbox>
        </el-form-item>
        
        <el-divider content-position="left">权限模式</el-divider>
        <el-form-item label="权限类型">
          <el-radio-group v-model="teamForm.permission">
            <el-radio value="read">
              <span>常规访问</span>
              <div class="form-tip" style="margin: 0">成员权限将由以下权限表决定</div>
            </el-radio>
            <el-radio value="admin">
              <span>管理员权限</span>
              <div class="form-tip" style="margin: 0">成员可以拉取和推送到团队仓库同时可以添加协作者</div>
            </el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-divider content-position="left">单元权限</el-divider>
        <div class="units-table">
          <el-table :data="TEAM_UNITS" size="small" :show-header="true">
            <el-table-column prop="label" label="单元" width="100" />
            <el-table-column prop="desc" label="说明" min-width="200" />
            <el-table-column label="无权限" width="80" align="center">
              <template #default="{ row }">
                <el-radio 
                  :model-value="teamForm.units_map[row.key]" 
                  value="none"
                  @update:model-value="teamForm.units_map[row.key] = $event"
                />
              </template>
            </el-table-column>
            <el-table-column label="可读" width="80" align="center">
              <template #default="{ row }">
                <el-radio 
                  :model-value="teamForm.units_map[row.key]" 
                  value="read"
                  @update:model-value="teamForm.units_map[row.key] = $event"
                />
              </template>
            </el-table-column>
            <el-table-column label="写入" width="80" align="center">
              <template #default="{ row }">
                <el-radio 
                  :model-value="teamForm.units_map[row.key]" 
                  value="write"
                  @update:model-value="teamForm.units_map[row.key] = $event"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createTeamVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateTeam" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑团队对话框 -->
    <el-dialog v-model="editTeamVisible" title="编辑团队" width="650px">
      <el-form :model="teamForm" label-width="100px">
        <el-form-item label="团队名称">
          <el-input v-model="teamForm.name" disabled />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="teamForm.description" type="textarea" :rows="2" placeholder="请输入描述" />
        </el-form-item>
        
        <el-divider content-position="left">仓库权限</el-divider>
        <el-form-item label="仓库范围">
          <el-radio-group v-model="teamForm.includes_all_repositories">
            <el-radio :value="false">指定仓库</el-radio>
            <el-radio :value="true">所有仓库</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="创建仓库">
          <el-checkbox v-model="teamForm.can_create_org_repo">允许成员在组织中创建仓库</el-checkbox>
        </el-form-item>
        
        <el-divider content-position="left">权限模式</el-divider>
        <el-form-item label="权限类型">
          <el-radio-group v-model="teamForm.permission">
            <el-radio value="read">
              <span>常规访问</span>
            </el-radio>
            <el-radio value="admin">
              <span>管理员权限</span>
            </el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-divider content-position="left">单元权限</el-divider>
        <div class="units-table">
          <el-table :data="TEAM_UNITS" size="small" :show-header="true">
            <el-table-column prop="label" label="单元" width="100" />
            <el-table-column prop="desc" label="说明" min-width="200" />
            <el-table-column label="无权限" width="80" align="center">
              <template #default="{ row }">
                <el-radio 
                  :model-value="teamForm.units_map[row.key]" 
                  value="none"
                  @update:model-value="teamForm.units_map[row.key] = $event"
                />
              </template>
            </el-table-column>
            <el-table-column label="可读" width="80" align="center">
              <template #default="{ row }">
                <el-radio 
                  :model-value="teamForm.units_map[row.key]" 
                  value="read"
                  @update:model-value="teamForm.units_map[row.key] = $event"
                />
              </template>
            </el-table-column>
            <el-table-column label="写入" width="80" align="center">
              <template #default="{ row }">
                <el-radio 
                  :model-value="teamForm.units_map[row.key]" 
                  value="write"
                  @update:model-value="teamForm.units_map[row.key] = $event"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editTeamVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditTeam" :loading="creating">保存</el-button>
      </template>
    </el-dialog>

    <!-- 团队成员管理对话框 -->
    <el-dialog v-model="teamMembersVisible" :title="`团队成员 - ${currentTeam?.name}`" width="600px">
      <div class="members-header">
        <el-select 
          v-model="selectedUser" 
          filterable 
          placeholder="选择用户添加到团队"
          style="width: 300px"
        >
          <el-option 
            v-for="user in availableUsersForTeam" 
            :key="user.username" 
            :label="`${user.username} (${user.full_name || '-'})`"
            :value="user.username"
          />
        </el-select>
        <el-button type="primary" @click="handleAddTeamMember" :disabled="!selectedUser">
          添加成员
        </el-button>
      </div>
      
      <el-table :data="teamMembers" v-loading="loadingMembers" style="margin-top: 16px">
        <el-table-column label="头像" width="60">
          <template #default="{ row }">
            <el-avatar :src="row.avatar_url" :size="32">{{ row.username?.[0] }}</el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="full_name" label="姓名" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="handleRemoveTeamMember(row)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 创建用户对话框 -->
    <el-dialog v-model="createUserVisible" title="创建用户" width="450px">
      <el-form :model="userForm" label-width="100px">
        <el-form-item label="用户名" required>
          <el-input v-model="userForm.username" placeholder="请输入用户名（拼音）" />
          <div class="form-tip">只能包含字母、数字、下划线、破折号</div>
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="userForm.full_name" placeholder="请输入中文姓名" />
        </el-form-item>
        <el-form-item label="邮箱" required>
          <el-input v-model="userForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="userForm.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="首次登录改密">
          <el-switch v-model="userForm.must_change_password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createUserVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateUser" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑用户对话框 -->
    <el-dialog v-model="editUserVisible" title="编辑用户" width="450px">
      <el-form :model="editUserForm" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="editUserForm.username" disabled />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editUserForm.full_name" placeholder="请输入中文姓名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editUserForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="管理员">
          <el-switch v-model="editUserForm.admin" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editUserVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditUser" :loading="creating">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建仓库对话框 -->
    <el-dialog v-model="createRepoVisible" title="创建仓库" width="600px">
      <el-form :model="repoForm" label-width="100px">
        <el-form-item label="仓库名称" required>
          <el-input v-model="repoForm.name" placeholder="请输入仓库名称（建议使用所有者的拼音）" />
          <div class="form-tip">只能包含字母、数字、下划线、破折号、点号</div>
        </el-form-item>
        <el-form-item label="仓库描述">
          <el-input v-model="repoForm.description" type="textarea" :rows="2" placeholder="输入简要描述（可选）" />
        </el-form-item>
        
        <el-divider content-position="left">仓库设置</el-divider>
        
        <el-form-item label="可见性">
          <el-checkbox v-model="repoForm.private">将仓库设为私有</el-checkbox>
          <div class="form-tip">只有组织所有人或拥有权利的组织成员才能看到</div>
        </el-form-item>
        <el-form-item label=".gitignore">
          <el-select v-model="repoForm.gitignore" placeholder="选择 .gitignore 模板" clearable style="width: 100%">
            <el-option label="Python" value="Python" />
            <el-option label="R" value="R" />
            <el-option label="Julia" value="Julia" />
            <el-option label="JupyterNotebooks" value="JupyterNotebooks" />
            <el-option label="VisualStudioCode" value="VisualStudioCode" />
          </el-select>
        </el-form-item>
        <el-form-item label="授权许可">
          <el-select v-model="repoForm.license" placeholder="选择授权许可文件" clearable style="width: 100%">
            <el-option label="MIT License" value="MIT" />
            <el-option label="Apache License 2.0" value="Apache-2.0" />
            <el-option label="GPL-3.0" value="GPL-3.0" />
            <el-option label="BSD-3-Clause" value="BSD-3-Clause" />
          </el-select>
        </el-form-item>
        <el-form-item label="自述文件">
          <el-select v-model="repoForm.readme" placeholder="选择自述文件模板" style="width: 100%">
            <el-option label="Default" value="Default" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始化仓库">
          <el-checkbox v-model="repoForm.auto_init">初始化仓库（添加 .gitignore、许可证和自述文件）</el-checkbox>
        </el-form-item>
        <el-form-item label="默认分支">
          <el-input v-model="repoForm.default_branch" placeholder="main" style="width: 200px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createRepoVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateRepo" :loading="creating">创建仓库</el-button>
      </template>
    </el-dialog>

    <!-- 编辑仓库对话框 -->
    <el-dialog v-model="editRepoVisible" title="编辑仓库" width="500px">
      <el-form :model="repoForm" label-width="100px">
        <el-form-item label="仓库名称">
          <el-input v-model="repoForm.name" disabled />
        </el-form-item>
        <el-form-item label="仓库描述">
          <el-input v-model="repoForm.description" type="textarea" :rows="3" placeholder="输入简要描述（可选）" />
        </el-form-item>
        <el-form-item label="可见性">
          <el-checkbox v-model="repoForm.private">将仓库设为私有</el-checkbox>
        </el-form-item>
        <el-form-item label="默认分支">
          <el-input v-model="repoForm.default_branch" style="width: 200px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editRepoVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditRepo" :loading="creating">保存</el-button>
      </template>
    </el-dialog>

    <!-- 仓库协作者管理对话框 -->
    <el-dialog v-model="collaboratorsVisible" :title="`协作者管理 - ${currentRepo?.name}`" width="600px">
      <div class="members-header">
        <el-select 
          v-model="selectedCollaborator" 
          filterable 
          placeholder="选择用户添加为协作者"
          style="width: 300px"
        >
          <el-option 
            v-for="user in availableUsersForRepo" 
            :key="user.username" 
            :label="`${user.username} (${user.full_name || '-'})`"
            :value="user.username"
          />
        </el-select>
        <el-button type="primary" @click="handleAddCollaborator" :disabled="!selectedCollaborator">
          添加协作者
        </el-button>
      </div>
      
      <el-table :data="collaborators" v-loading="loadingCollaborators" style="margin-top: 16px">
        <el-table-column label="头像" width="60">
          <template #default="{ row }">
            <el-avatar :src="row.avatar_url" :size="32">{{ row.username?.[0] }}</el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="full_name" label="姓名" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button type="danger" link size="small" @click="handleRemoveCollaborator(row)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 下发模板对话框 -->
    <el-dialog v-model="deployTemplateVisible" :title="`下发模板到 ${currentTargetRepo?.name}`" width="500px">
      <el-alert 
        type="info" 
        :closable="false" 
        show-icon
        style="margin-bottom: 16px"
      >
        将模板仓库的文件内容同步到目标仓库 <strong>{{ currentTargetRepo?.name }}</strong>
      </el-alert>
      
      <el-form :model="deployForm" label-width="100px">
        <el-form-item label="目标仓库">
          <div class="target-repo-info">
            <el-icon><Folder /></el-icon>
            <span class="repo-name">{{ currentTargetRepo?.name }}</span>
            <el-tag type="success" size="small">空仓库</el-tag>
          </div>
          <div class="form-tip">{{ currentTargetRepo?.description || '无描述' }}</div>
        </el-form-item>
        <el-form-item label="选择模板" required>
          <el-select 
            v-model="deployForm.templateRepo" 
            placeholder="请选择模板仓库"
            style="width: 100%"
          >
            <el-option 
              v-for="repo in templateRepos" 
              :key="repo.name" 
              :label="`${repo.name} - ${repo.description || '无描述'}`"
              :value="repo.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="提交信息">
          <el-input 
            v-model="deployForm.commitMessage" 
            placeholder="输入 Git 提交信息"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="deployTemplateVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleDeployTemplate" 
          :loading="deploying"
          :disabled="!deployForm.templateRepo"
        >
          开始下发
        </el-button>
      </template>
    </el-dialog>

    <!-- 下发进度对话框 -->
    <el-dialog 
      v-model="deployProgressVisible" 
      title="下发进度" 
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="!deploying"
    >
      <div class="deploy-progress">
        <el-progress 
          :percentage="deployProgress" 
          :status="deployProgress === 100 ? 'success' : ''"
          :stroke-width="20"
        />
        <div class="progress-info">
          {{ deployCurrentStep }} / {{ deployTotalSteps }}
        </div>
        <div class="progress-logs">
          <div 
            v-for="(log, index) in deployLogs" 
            :key="index" 
            :class="['log-item', log.type]"
          >
            <el-icon v-if="log.type === 'success'"><SuccessFilled /></el-icon>
            <el-icon v-else-if="log.type === 'error'"><CircleCloseFilled /></el-icon>
            <el-icon v-else><Loading /></el-icon>
            <span>{{ log.message }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button 
          v-if="!deploying" 
          type="primary" 
          @click="deployProgressVisible = false; loadRepos()"
        >
          完成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Search, Folder, Document, SuccessFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const ORG = 'zizhou'

// Tab 状态
const activeTab = ref('teams')

// 数据
const teams = ref<any[]>([])
const users = ref<any[]>([])
const repos = ref<any[]>([])
const teamMembers = ref<any[]>([])
const collaborators = ref<any[]>([])

// 加载状态
const loadingTeams = ref(false)
const loadingUsers = ref(false)
const loadingRepos = ref(false)
const loadingMembers = ref(false)
const loadingCollaborators = ref(false)
const creating = ref(false)

// 搜索
const userSearch = ref('')

// 对话框
const createTeamVisible = ref(false)
const editTeamVisible = ref(false)
const teamMembersVisible = ref(false)
const createUserVisible = ref(false)
const editUserVisible = ref(false)
const createRepoVisible = ref(false)
const editRepoVisible = ref(false)
const collaboratorsVisible = ref(false)
// deployTemplateVisible 和 deployProgressVisible 已在上方定义

// 当前操作对象
const currentTeam = ref<any>(null)
const currentRepo = ref<any>(null)
const currentUser = ref<any>(null)
const selectedUser = ref('')
const selectedCollaborator = ref('')

// 下发模板相关
const deployTemplateVisible = ref(false)
const deployProgressVisible = ref(false)
const deploying = ref(false)
const deployProgress = ref(0)
const deployCurrentStep = ref(0)
const deployTotalSteps = ref(0)
const deployLogs = ref<{ type: 'info' | 'success' | 'error'; message: string }[]>([])
const currentTargetRepo = ref<any>(null)  // 当前要下发的目标仓库
const deployForm = ref({
  templateRepo: '',
  commitMessage: '从模板下发文件'
})

// 团队单元权限选项
const TEAM_UNITS = [
  { key: 'repo.code', label: '代码', desc: '查看源码、文件、提交和分支' },
  { key: 'repo.issues', label: '工单', desc: '组织 bug 报告、任务和里程碑' },
  { key: 'repo.pulls', label: '合并请求', desc: '启用合并请求和代码评审' },
  { key: 'repo.releases', label: '版本发布', desc: '跟踪项目版本和下载' },
  { key: 'repo.wiki', label: '百科', desc: '撰写和与协作者分享文档' },
  { key: 'repo.ext_wiki', label: '访问外部百科', desc: '链接外部 Wiki' },
  { key: 'repo.ext_issues', label: '访问外部工单', desc: '链接外部工单跟踪器' },
  { key: 'repo.projects', label: '项目', desc: '在项目看板中管理工单和合并请求' },
  { key: 'repo.packages', label: '软件包', desc: '管理仓库软件包' },
  { key: 'repo.actions', label: 'Actions', desc: '管理 Actions' }
]

// 表单
const teamForm = ref({
  name: '',
  description: '',
  permission: 'read',  // 常规访问(read) 或 管理员权限(admin)
  includes_all_repositories: false,  // 是否包含所有仓库
  can_create_org_repo: false,  // 是否可以创建仓库
  units_map: {
    'repo.code': 'write',
    'repo.issues': 'read',
    'repo.pulls': 'read',
    'repo.releases': 'read',
    'repo.wiki': 'read',
    'repo.ext_wiki': 'none',
    'repo.ext_issues': 'none',
    'repo.projects': 'read',
    'repo.packages': 'read',
    'repo.actions': 'read'
  } as Record<string, string>
})

const userForm = ref({
  username: '',
  full_name: '',
  email: '',
  password: '',
  must_change_password: false
})

const editUserForm = ref({
  username: '',
  full_name: '',
  email: '',
  admin: false
})

const repoForm = ref({
  name: '',
  description: '',
  private: true,
  auto_init: true,  // 初始化仓库
  default_branch: 'main',
  gitignore: '',  // .gitignore 模板
  license: '',  // 许可证
  readme: 'Default',  // 自述文件
  owner: ''  // 协作者（仓库所有者）
})

// 判断用户是否激活（兼容多种字段名）
const isUserActive = (user: any): boolean => {
  // Gitea 可能使用 active, is_active, 或 prohibit_login
  if (typeof user.active === 'boolean') return user.active
  if (typeof user.is_active === 'boolean') return user.is_active
  if (typeof user.prohibit_login === 'boolean') return !user.prohibit_login
  return true // 默认激活
}

// 计算属性
const filteredUsers = computed(() => {
  // 过滤掉 zzadmin 系统账号，避免误操作
  let list = users.value.filter(u => u.username !== 'zzadmin')
  
  if (!userSearch.value) return list
  const search = userSearch.value.toLowerCase()
  return list.filter(u => 
    u.username?.toLowerCase().includes(search) ||
    u.full_name?.toLowerCase().includes(search) ||
    u.email?.toLowerCase().includes(search)
  )
})

const availableUsersForTeam = computed(() => {
  const memberNames = teamMembers.value.map(m => m.username)
  return users.value.filter(u => !memberNames.includes(u.username))
})

const availableUsersForRepo = computed(() => {
  const collabNames = collaborators.value.map(c => c.username || c.login)
  return users.value.filter(u => !collabNames.includes(u.username))
})

// 模板仓库列表
const templateRepos = computed(() => {
  return repos.value.filter(r => r.template)
})

// 获取团队的代码权限（优先使用 units_map.repo.code）
const getCodePermission = (team: any): string => {
  // 优先使用 units_map 中的代码权限
  if (team.units_map && team.units_map['repo.code']) {
    return team.units_map['repo.code']
  }
  // 回退到主 permission
  return team.permission || 'read'
}

// 权限标签
const getPermissionType = (permission: string) => {
  const map: Record<string, string> = {
    'none': 'info',
    'read': 'info',
    'write': 'success',
    'admin': 'warning',
    'owner': 'danger'
  }
  return map[permission] || 'info'
}

const getPermissionLabel = (permission: string) => {
  const map: Record<string, string> = {
    'none': '无',
    'read': '只读',
    'write': '读写',
    'admin': '管理',
    'owner': '所有者'
  }
  return map[permission] || permission
}

// 格式化时间
const formatTime = (timeStr: string) => {
  if (!timeStr) return '-'
  return new Date(timeStr).toLocaleString('zh-CN')
}

// ========== 数据加载 ==========

const loadTeams = async () => {
  loadingTeams.value = true
  try {
    const result = await window.electronAPI.gitea.getOrgTeams(ORG)
    if (result.success) {
      // 过滤掉 Owners 团队，避免误操作
      const teamList = (result.data || []).filter((t: any) => t.name !== 'Owners')
      
      // 获取每个团队的成员数量
      for (const team of teamList) {
        try {
          const membersResult = await window.electronAPI.gitea.getTeamMembers(team.id)
          if (membersResult.success) {
            team.members_count = membersResult.data?.length || 0
          }
        } catch (e) {
          team.members_count = 0
        }
      }
      
      teams.value = teamList
    }
  } catch (e: any) {
    ElMessage.error('加载团队失败: ' + e.message)
  } finally {
    loadingTeams.value = false
  }
}

const loadUsers = async () => {
  loadingUsers.value = true
  try {
    const result = await window.electronAPI.gitea.getAllUsers()
    if (result.success) {
      users.value = result.data || []
      // 打印字段名便于调试
      if (users.value.length > 0) {
        console.log('用户字段:', Object.keys(users.value[0]))
      }
    }
  } catch (e: any) {
    ElMessage.error('加载用户失败: ' + e.message)
  } finally {
    loadingUsers.value = false
  }
}

const loadRepos = async () => {
  loadingRepos.value = true
  try {
    const result = await window.electronAPI.gitea.getOrgRepos(ORG)
    if (result.success) {
      const repoList = result.data || []
      // 获取每个仓库的协作者和检查是否为空
      for (const repo of repoList) {
        try {
          const collabResult = await window.electronAPI.gitea.getRepoCollaborators(ORG, repo.name)
          if (collabResult.success) {
            repo.collaborators = collabResult.data || []
          }
        } catch (e) {
          repo.collaborators = []
        }
        
        // 检查仓库是否为空（非模板仓库才检查）
        if (!repo.template) {
          try {
            const treeResult = await window.electronAPI.gitea.getRepoTree(ORG, repo.name, repo.default_branch || 'main')
            // 如果能获取到文件树，说明不是空仓库
            repo.empty = !treeResult.success || !treeResult.data?.tree || treeResult.data.tree.length === 0
          } catch (e) {
            // 获取失败，可能是空仓库
            repo.empty = true
          }
        } else {
          repo.empty = false
        }
      }
      repos.value = repoList
    }
  } catch (e: any) {
    ElMessage.error('加载仓库失败: ' + e.message)
  } finally {
    loadingRepos.value = false
  }
}

// ========== 团队管理 ==========

const showCreateTeamDialog = () => {
  teamForm.value = { 
    name: '', 
    description: '', 
    permission: 'read',
    includes_all_repositories: false,
    can_create_org_repo: false,
    units_map: {
      'repo.code': 'write',
      'repo.issues': 'read',
      'repo.pulls': 'read',
      'repo.releases': 'read',
      'repo.wiki': 'read',
      'repo.ext_wiki': 'none',
      'repo.ext_issues': 'none',
      'repo.projects': 'read',
      'repo.packages': 'read',
      'repo.actions': 'read'
    }
  }
  createTeamVisible.value = true
}

// 验证名称格式（只能包含字母、数字、下划线、破折号、点）
const isValidName = (name: string): boolean => {
  return /^[a-zA-Z0-9_\-\.]+$/.test(name)
}

const handleCreateTeam = async () => {
  if (!teamForm.value.name) {
    ElMessage.warning('请输入团队名称')
    return
  }
  if (!isValidName(teamForm.value.name)) {
    ElMessage.error('团队名称只能包含字母、数字、下划线、破折号')
    return
  }
  creating.value = true
  try {
    // 构建 units 数组（只包含有权限的单元）
    const units: string[] = []
    const unitsMap: Record<string, string> = {}
    for (const [key, value] of Object.entries(teamForm.value.units_map)) {
      if (value !== 'none') {
        units.push(key)
        unitsMap[key] = value
      }
    }
    
    // 转换为普通对象，避免 IPC 克隆错误
    const teamData = {
      name: teamForm.value.name,
      description: teamForm.value.description,
      permission: teamForm.value.permission,
      includes_all_repositories: teamForm.value.includes_all_repositories,
      can_create_org_repo: teamForm.value.can_create_org_repo,
      units: units,
      units_map: unitsMap
    }
    const result = await window.electronAPI.gitea.createTeam(ORG, teamData)
    if (result.success) {
      ElMessage.success('团队创建成功')
      createTeamVisible.value = false
      loadTeams()
    } else {
      ElMessage.error('创建失败: ' + result.error)
    }
  } finally {
    creating.value = false
  }
}

const showEditTeamDialog = (team: any) => {
  currentTeam.value = team
  // 初始化 units_map，处理可能不存在的字段
  const unitsMap: Record<string, string> = {}
  TEAM_UNITS.forEach(u => {
    unitsMap[u.key] = team.units_map?.[u.key] || 'none'
  })
  
  teamForm.value = {
    name: team.name,
    description: team.description || '',
    permission: team.permission || 'read',
    includes_all_repositories: team.includes_all_repositories || false,
    can_create_org_repo: team.can_create_org_repo || false,
    units_map: unitsMap
  }
  editTeamVisible.value = true
}

const handleEditTeam = async () => {
  if (!currentTeam.value) return
  creating.value = true
  try {
    // 构建 units 数组（只包含有权限的单元）
    const units: string[] = []
    const unitsMap: Record<string, string> = {}
    for (const [key, value] of Object.entries(teamForm.value.units_map)) {
      if (value !== 'none') {
        units.push(key)
        unitsMap[key] = value
      }
    }
    
    const teamData = {
      description: teamForm.value.description,
      permission: teamForm.value.permission,
      includes_all_repositories: teamForm.value.includes_all_repositories,
      can_create_org_repo: teamForm.value.can_create_org_repo,
      units: units,
      units_map: unitsMap
    }
    
    const result = await window.electronAPI.gitea.editTeam(currentTeam.value.id, teamData)
    if (result.success) {
      ElMessage.success('团队更新成功')
      editTeamVisible.value = false
      loadTeams()
    } else {
      ElMessage.error('更新失败: ' + result.error)
    }
  } finally {
    creating.value = false
  }
}

const handleDeleteTeam = async (team: any) => {
  const memberCount = team.members_count || 0
  const msg = memberCount > 0 
    ? `团队 "${team.name}" 有 ${memberCount} 名成员，删除后成员将自动移出。确定删除吗？`
    : `确定删除团队 "${team.name}" 吗？`
  await ElMessageBox.confirm(msg, '确认删除', { type: 'warning' })
  try {
    const result = await window.electronAPI.gitea.deleteTeam(team.id)
    if (result.success) {
      ElMessage.success('团队已删除')
      loadTeams()
    } else {
      ElMessage.error('删除失败: ' + result.error)
    }
  } catch (e) {
    // 取消
  }
}

const showTeamMembers = async (team: any) => {
  currentTeam.value = team
  selectedUser.value = ''
  teamMembersVisible.value = true
  loadingMembers.value = true
  try {
    const result = await window.electronAPI.gitea.getTeamMembers(team.id)
    if (result.success) {
      teamMembers.value = result.data || []
    }
  } finally {
    loadingMembers.value = false
  }
}

const handleAddTeamMember = async () => {
  if (!selectedUser.value || !currentTeam.value) return
  try {
    const result = await window.electronAPI.gitea.addTeamMember(currentTeam.value.id, selectedUser.value)
    if (result.success) {
      ElMessage.success('成员添加成功')
      selectedUser.value = ''
      showTeamMembers(currentTeam.value)
      loadTeams()
    } else {
      ElMessage.error('添加失败: ' + result.error)
    }
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

const handleRemoveTeamMember = async (member: any) => {
  if (!currentTeam.value) return
  await ElMessageBox.confirm(`确定从团队移除 "${member.username}" 吗？`, '确认移除', { type: 'warning' })
  try {
    const result = await window.electronAPI.gitea.removeTeamMember(currentTeam.value.id, member.username)
    if (result.success) {
      ElMessage.success('成员已移除')
      showTeamMembers(currentTeam.value)
      loadTeams()
    } else {
      ElMessage.error('移除失败: ' + result.error)
    }
  } catch (e) {
    // 取消
  }
}

// ========== 用户管理 ==========

const showCreateUserDialog = () => {
  userForm.value = {
    username: '',
    full_name: '',
    email: '',
    password: '',
    must_change_password: false
  }
  createUserVisible.value = true
}

const handleCreateUser = async () => {
  if (!userForm.value.username || !userForm.value.email || !userForm.value.password) {
    ElMessage.warning('请填写必填项')
    return
  }
  if (!isValidName(userForm.value.username)) {
    ElMessage.error('用户名只能包含字母、数字、下划线、破折号')
    return
  }
  creating.value = true
  try {
    // 转换为普通对象，避免 IPC 克隆错误
    const userData = {
      username: userForm.value.username,
      email: userForm.value.email,
      password: userForm.value.password,
      full_name: userForm.value.full_name || undefined,
      must_change_password: userForm.value.must_change_password
    }
    const result = await window.electronAPI.gitea.createUser(userData)
    if (result.success) {
      ElMessage.success('用户创建成功')
      createUserVisible.value = false
      loadUsers()
    } else {
      ElMessage.error('创建失败: ' + result.error)
    }
  } finally {
    creating.value = false
  }
}

const showEditUserDialog = (user: any) => {
  currentUser.value = user
  editUserForm.value = {
    username: user.username,
    full_name: user.full_name || '',
    email: user.email || '',
    admin: user.is_admin || false
  }
  editUserVisible.value = true
}

const handleEditUser = async () => {
  if (!currentUser.value) return
  creating.value = true
  try {
    // 转换为普通对象，避免 IPC 克隆错误
    const userData = {
      full_name: editUserForm.value.full_name,
      email: editUserForm.value.email,
      admin: editUserForm.value.admin
    }
    const result = await window.electronAPI.gitea.editUser(currentUser.value.username, userData)
    if (result.success) {
      ElMessage.success('用户更新成功')
      editUserVisible.value = false
      loadUsers()
    } else {
      ElMessage.error('更新失败: ' + result.error)
    }
  } finally {
    creating.value = false
  }
}

const handleToggleUserStatus = async (user: any) => {
  const newStatus = !isUserActive(user)
  const action = newStatus ? '启用' : '禁用'
  await ElMessageBox.confirm(`确定${action}用户 "${user.username}" 吗？`, `确认${action}`, { type: 'warning' })
  try {
    const result = await window.electronAPI.gitea.editUser(user.username, {
      active: newStatus
    })
    if (result.success) {
      ElMessage.success(`用户已${action}`)
      loadUsers()
    } else {
      ElMessage.error(`${action}失败: ` + result.error)
    }
  } catch (e) {
    // 取消
  }
}

const handleDeleteUser = async (user: any) => {
  await ElMessageBox.confirm(`确定删除用户 "${user.username}" 吗？此操作不可恢复！`, '确认删除', { type: 'error' })
  try {
    const result = await window.electronAPI.gitea.deleteUser(user.username)
    if (result.success) {
      ElMessage.success('用户已删除')
      loadUsers()
    } else {
      ElMessage.error('删除失败: ' + result.error)
    }
  } catch (e) {
    // 取消
  }
}

// ========== 仓库管理 ==========

const showCreateRepoDialog = () => {
  repoForm.value = { 
    name: '', 
    description: '', 
    private: true,
    auto_init: true,
    default_branch: 'main',
    gitignore: '',
    license: '',
    readme: 'Default',
    owner: ''
  }
  createRepoVisible.value = true
}

const handleCreateRepo = async () => {
  if (!repoForm.value.name) {
    ElMessage.warning('请输入仓库名称')
    return
  }
  if (!isValidName(repoForm.value.name)) {
    ElMessage.error('仓库名称只能包含字母、数字、下划线、破折号、点号')
    return
  }
  creating.value = true
  try {
    // 构建仓库数据
    const repoData: { name: string; description?: string; private?: boolean; auto_init?: boolean; default_branch?: string; gitignores?: string; license?: string } = {
      name: repoForm.value.name,
      description: repoForm.value.description,
      private: repoForm.value.private,
      auto_init: repoForm.value.auto_init,
      default_branch: repoForm.value.default_branch
    }
    // 可选字段
    if (repoForm.value.gitignore) {
      repoData.gitignores = repoForm.value.gitignore
    }
    if (repoForm.value.license) {
      repoData.license = repoForm.value.license
    }
    
    const result = await window.electronAPI.gitea.createRepo(ORG, repoData)
    if (result.success) {
      ElMessage.success('仓库创建成功')
      createRepoVisible.value = false
      loadRepos()
    } else {
      ElMessage.error('创建失败: ' + result.error)
    }
  } finally {
    creating.value = false
  }
}

const showEditRepoDialog = (repo: any) => {
  currentRepo.value = repo
  repoForm.value = {
    name: repo.name,
    description: repo.description || '',
    private: repo.private || false,
    auto_init: false,
    default_branch: repo.default_branch || 'main',
    gitignore: '',
    license: '',
    readme: '',
    owner: ''
  }
  editRepoVisible.value = true
}

const handleEditRepo = async () => {
  if (!currentRepo.value) return
  creating.value = true
  try {
    const repoData = {
      description: repoForm.value.description,
      private: repoForm.value.private,
      default_branch: repoForm.value.default_branch
    }
    const result = await window.electronAPI.gitea.editRepo(ORG, currentRepo.value.name, repoData)
    if (result.success) {
      ElMessage.success('仓库更新成功')
      editRepoVisible.value = false
      loadRepos()
    } else {
      ElMessage.error('更新失败: ' + result.error)
    }
  } finally {
    creating.value = false
  }
}

// 删除仓库功能（暂未启用）
// const handleDeleteRepo = async (repo: any) => {
//   await ElMessageBox.confirm(`确定删除仓库 "${repo.name}" 吗？此操作不可恢复！`, '确认删除', { type: 'error' })
//   try {
//     const result = await window.electronAPI.gitea.deleteRepo(ORG, repo.name)
//     if (result.success) {
//       ElMessage.success('仓库已删除')
//       loadRepos()
//     } else {
//       ElMessage.error('删除失败: ' + result.error)
//     }
//   } catch (e) {
//     // 取消
//   }
// }

const showRepoCollaborators = async (repo: any) => {
  currentRepo.value = repo
  selectedCollaborator.value = ''
  collaboratorsVisible.value = true
  loadingCollaborators.value = true
  try {
    const result = await window.electronAPI.gitea.getRepoCollaborators(ORG, repo.name)
    if (result.success) {
      collaborators.value = result.data || []
    }
  } finally {
    loadingCollaborators.value = false
  }
}

const handleAddCollaborator = async () => {
  if (!selectedCollaborator.value || !currentRepo.value) return
  try {
    const result = await window.electronAPI.gitea.addCollaborator(ORG, currentRepo.value.name, selectedCollaborator.value, 'write')
    if (result.success) {
      ElMessage.success('协作者添加成功')
      selectedCollaborator.value = ''
      showRepoCollaborators(currentRepo.value)
    } else {
      ElMessage.error('添加失败: ' + result.error)
    }
  } catch (e: any) {
    ElMessage.error(e.message)
  }
}

const handleRemoveCollaborator = async (collab: any) => {
  if (!currentRepo.value) return
  const username = collab.username || collab.login
  await ElMessageBox.confirm(`确定移除协作者 "${username}" 吗？`, '确认移除', { type: 'warning' })
  try {
    const result = await window.electronAPI.gitea.removeCollaborator(ORG, currentRepo.value.name, username)
    if (result.success) {
      ElMessage.success('协作者已移除')
      showRepoCollaborators(currentRepo.value)
    } else {
      ElMessage.error('移除失败: ' + result.error)
    }
  } catch (e) {
    // 取消
  }
}

// ========== 下发模板 ==========

// 显示下发模板对话框（针对单个仓库）
const showDeployToRepoDialog = (repo: any) => {
  if (templateRepos.value.length === 0) {
    ElMessage.warning('没有可用的模板仓库，请先创建模板仓库')
    return
  }
  currentTargetRepo.value = repo
  deployForm.value = {
    templateRepo: templateRepos.value.length === 1 ? templateRepos.value[0].name : '',
    commitMessage: '从模板下发文件'
  }
  deployTemplateVisible.value = true
}

// 执行下发（单个仓库）
const handleDeployTemplate = async () => {
  if (!deployForm.value.templateRepo || !currentTargetRepo.value) {
    ElMessage.warning('请选择模板仓库')
    return
  }
  
  const targetRepo = currentTargetRepo.value.name
  const repoDesc = currentTargetRepo.value.description || targetRepo
  
  deploying.value = true
  deployTemplateVisible.value = false
  deployProgressVisible.value = true
  deployLogs.value = []
  deployProgress.value = 0
  deployCurrentStep.value = 0
  deployTotalSteps.value = 1
  
  // 添加"正在..."提示
  deployLogs.value.push({ type: 'info', message: `正在向 ${targetRepo} 下发模板文件...` })
  
  try {
    const result = await window.electronAPI.gitea.deployTemplate(
      ORG,
      deployForm.value.templateRepo,
      ORG,
      targetRepo,
      {
        branch: 'main',
        commitMessage: deployForm.value.commitMessage
      }
    )
    
    deployCurrentStep.value = 1
    deployProgress.value = 100
    
    // 清空日志，只显示结果
    deployLogs.value = []
    
    if (result.success && result.data) {
      const { total, success, failed } = result.data
      if (failed === 0) {
        deployLogs.value.push({ type: 'success', message: `✓ ${targetRepo}（${repoDesc}）- 成功同步 ${success} 个文件` })
      } else {
        deployLogs.value.push({ type: 'error', message: `⚠ ${targetRepo}（${repoDesc}）- 同步 ${success}/${total} 个文件，${failed} 个失败` })
      }
    } else {
      deployLogs.value.push({ type: 'error', message: `✗ ${targetRepo}（${repoDesc}）- 下发失败: ${result.error}` })
    }
  } catch (error: any) {
    deployCurrentStep.value = 1
    deployProgress.value = 100
    deployLogs.value = []
    deployLogs.value.push({ type: 'error', message: `✗ ${targetRepo}（${repoDesc}）- 下发失败: ${error.message}` })
  }
  
  deploying.value = false
  ElMessage.success('模板下发完成')
}

// 初始化
onMounted(() => {
  loadTeams()
  loadUsers()
  loadRepos()
})
</script>

<style scoped lang="scss">
.admin-page {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100vh;

  .page-header {
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 24px;
      color: #303133;
    }
  }

  .admin-tabs {
    background: #fff;
    padding: 20px;
    border-radius: 8px;

    :deep(.el-tabs__content) {
      padding-top: 16px;
    }
  }

  .tab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .tab-title {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }

  .repo-name {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-icon {
      color: #e6a23c;
    }
  }

  .collaborators-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .no-collaborators {
    color: #909399;
    font-size: 13px;
  }

  .members-header {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .units-table {
    margin-top: 8px;
    
    :deep(.el-table) {
      --el-table-border-color: #ebeef5;
    }
    
    :deep(.el-radio) {
      margin-right: 0;
    }
  }

  // 下发模板相关样式
  .target-repo-info {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .el-icon {
      color: #e6a23c;
    }
    
    .repo-name {
      font-weight: 500;
      color: #303133;
    }
  }

  .deploy-preview {
    margin-top: 16px;
    
    .preview-list {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #ebeef5;
      border-radius: 4px;
      padding: 8px;
    }
    
    .preview-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid #f0f0f0;
      
      &:last-child {
        border-bottom: none;
      }
      
      .el-icon {
        color: #e6a23c;
      }
      
      .repo-name {
        font-weight: 500;
        color: #303133;
      }
      
      .repo-desc {
        color: #909399;
        font-size: 13px;
        margin-left: auto;
      }
    }
  }

  .deploy-progress {
    .progress-info {
      text-align: center;
      margin-top: 12px;
      color: #606266;
      font-size: 14px;
    }
    
    .progress-logs {
      margin-top: 16px;
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #ebeef5;
      border-radius: 4px;
      padding: 12px;
      background: #fafafa;
      
      .log-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        font-size: 13px;
        
        &.success {
          color: #67c23a;
        }
        
        &.error {
          color: #f56c6c;
        }
        
        &.info {
          color: #909399;
          
          .el-icon {
            animation: spin 1s linear infinite;
          }
        }
      }
    }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
}
</style>
