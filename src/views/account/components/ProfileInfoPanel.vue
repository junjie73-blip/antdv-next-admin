<script setup lang="ts">
import { message } from 'antdv-next'
import { onMounted, ref, watch } from 'vue'

import { updateProfile } from '~/api/auth'
import AvatarUploader from '~/components/common/AvatarUploader.vue'
import { useUserStore } from '~/stores/modules/user'

const props = defineProps<{ refreshUser: () => Promise<void> }>()
const userStore = useUserStore()

const loading = ref(false)
const form = ref({
  username: '',
  realName: '',
  email: '',
  phone: '',
  avatar: '',
})

function fill() {
  const info = userStore.userInfo
  if (!info) return
  form.value = {
    username: info.username || '',
    realName: info.realname || '',
    email: info.email || '',
    phone: info.phone || '',
    avatar: info.avatar || '',
  }
}

watch(() => userStore.userInfo, fill, { immediate: true, deep: true })
onMounted(fill)

async function handleSave() {
  loading.value = true
  try {
    await updateProfile({
      realName: form.value.realName,
      email: form.value.email,
      phone: form.value.phone,
      avatar: form.value.avatar,
    })
    message.success('个人信息更新成功')
    await props.refreshUser()
  } catch (e: any) {
    message.error(e?.message || '更新失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-xl space-y-4">
    <!-- 头像 -->
    <div class="flex items-center gap-4">
      <label class="w-24 text-right text-sm text-gray-600 dark:text-gray-300">头像</label>
      <AvatarUploader v-model="form.avatar" :size="64" />
    </div>

    <a-form layout="vertical">
      <a-form-item label="用户名">
        <a-input :value="form.username" disabled />
      </a-form-item>
      <a-form-item label="真实姓名">
        <a-input v-model:value="form.realName" placeholder="请输入真实姓名" :maxlength="64" />
      </a-form-item>
      <a-form-item label="邮箱">
        <a-input v-model:value="form.email" placeholder="请输入邮箱" />
      </a-form-item>
      <a-form-item label="手机号">
        <a-input v-model:value="form.phone" placeholder="请输入手机号" :maxlength="32" />
      </a-form-item>
    </a-form>

    <div class="flex justify-end">
      <a-button type="primary" :loading="loading" @click="handleSave">保存修改</a-button>
    </div>
  </div>
</template>
