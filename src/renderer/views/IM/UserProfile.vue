<template>
  <div class="user-profile">
    <div class="profile-header">
      <h3>个人资料</h3>
    </div>

    <div v-if="!imStore.selfInfo" class="empty-state">
      <el-empty description="加载中..." :image-size="80" />
    </div>

    <el-form v-else label-position="top" class="profile-form">
      <div class="avatar-section">
        <el-avatar :size="80" :src="form.faceURL || undefined" class="avatar">
          {{ (form.nickname || '').charAt(0) }}
        </el-avatar>
        <el-input v-model="form.faceURL" placeholder="头像 URL（选填）" size="small" clearable />
      </div>

      <el-form-item label="昵称">
        <el-input v-model="form.nickname" placeholder="请输入昵称" maxlength="30" show-word-limit />
      </el-form-item>

      <el-form-item label="手机号">
        <el-input :model-value="imStore.imPhoneNumber || '—'" disabled />
        <div class="form-tip">手机号为账号标识，不可修改</div>
      </el-form-item>

      <el-form-item label="用户 ID">
        <el-input :model-value="imStore.imUserID" disabled />
      </el-form-item>

      <el-divider>扩展信息</el-divider>

      <el-form-item label="真实姓名">
        <el-input v-model="exForm.realName" placeholder="请输入真实姓名" maxlength="30" />
      </el-form-item>

      <el-form-item label="性别">
        <el-radio-group v-model="exForm.gender">
          <el-radio value="男">男</el-radio>
          <el-radio value="女">女</el-radio>
          <el-radio value="">不设置</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="邮箱">
        <el-input v-model="exForm.email" placeholder="请输入邮箱" maxlength="60" />
      </el-form-item>

      <el-form-item label="公司">
        <el-input v-model="exForm.company" placeholder="请输入公司名称" maxlength="60" />
      </el-form-item>

      <el-form-item label="部门">
        <el-input v-model="exForm.department" placeholder="请输入部门" maxlength="60" />
      </el-form-item>

      <el-form-item label="职位">
        <el-input v-model="exForm.title" placeholder="请输入职位" maxlength="60" />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save" :disabled="!hasChanged">
          保存修改
        </el-button>
        <el-button @click="reset" :disabled="!hasChanged">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useIMStore } from '../../stores/imStore'

const imStore = useIMStore()
const saving = ref(false)

const exFields = ['realName', 'gender', 'email', 'company', 'department', 'title'] as const

const form = reactive({ nickname: '', faceURL: '' })
const originalForm = reactive({ nickname: '', faceURL: '' })

const exForm = reactive<Record<string, string>>({
  realName: '', gender: '', email: '', company: '', department: '', title: '',
})
const originalExForm = reactive<Record<string, string>>({
  realName: '', gender: '', email: '', company: '', department: '', title: '',
})

function parseEx(exStr: string): Record<string, string> {
  try { return JSON.parse(exStr || '{}') } catch { return {} }
}

function syncForm(info: any) {
  if (!info) return
  form.nickname = info.nickname || ''
  form.faceURL = info.faceURL || ''
  originalForm.nickname = form.nickname
  originalForm.faceURL = form.faceURL

  const exData = parseEx(info.ex)
  if (!exData.email && imStore.imEmail) exData.email = imStore.imEmail
  if (!exData.company && imStore.imCompany) exData.company = imStore.imCompany
  for (const k of exFields) {
    exForm[k] = exData[k] || ''
    originalExForm[k] = exData[k] || ''
  }
}

watch(() => imStore.selfInfo, (info) => {
  syncForm(info)
}, { immediate: true })

const hasChanged = computed(() => {
  if (form.nickname !== originalForm.nickname || form.faceURL !== originalForm.faceURL) return true
  return exFields.some(k => exForm[k] !== originalExForm[k])
})

function reset() {
  form.nickname = originalForm.nickname
  form.faceURL = originalForm.faceURL
  for (const k of exFields) exForm[k] = originalExForm[k]
}

async function save() {
  if (!form.nickname.trim()) {
    ElMessage.warning('昵称不能为空')
    return
  }
  saving.value = true
  try {
    const updates: any = {}
    if (form.nickname !== originalForm.nickname) updates.nickname = form.nickname
    if (form.faceURL !== originalForm.faceURL) updates.faceURL = form.faceURL

    const exChanged = exFields.some(k => exForm[k] !== originalExForm[k])
    if (exChanged) {
      const existingEx = parseEx(imStore.selfInfo?.ex)
      for (const k of exFields) {
        if (exForm[k]) existingEx[k] = exForm[k]
        else delete existingEx[k]
      }
      existingEx.phoneNumber = imStore.imPhoneNumber || ''
      updates.ex = JSON.stringify(existingEx)
    }

    await imStore.updateSelfInfo(updates)
    ElMessage.success('保存成功')
  } catch (e: any) {
    ElMessage.error('保存失败: ' + (e.message || '未知错误'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.user-profile {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.profile-header {
  margin-bottom: 24px;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #303133;
  }
}

.empty-state {
  padding: 40px 0;
}

.profile-form {
  max-width: 400px;

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  :deep(.el-divider__text) {
    font-size: 13px;
    color: #909399;
    font-weight: 400;
  }
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;

  .avatar {
    flex-shrink: 0;
    font-size: 28px;
    background: #8B5CF6;
    color: #fff;
  }

  .el-input {
    flex: 1;
  }
}
</style>
