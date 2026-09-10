<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { http } from '@/utils'
import { useUserStore } from '@/stores/modules/user'
import type { FormSchema } from '@/components/business/Form'
import { BasicForm, useForm } from '@/components/business/Form'

defineOptions({ name: 'AccountSettings' })

const userStore = useUserStore()
const refreshUser = inject<() => Promise<void>>('refreshUser', async () => {})

const [profileFormRegister, profileFormMethods] = useForm()
const [passwordFormRegister, passwordFormMethods] = useForm()

const profileLoading = ref(false)
const passwordLoading = ref(false)
const uploadLoading = ref(false)

// ========== 基本信息表单 Schema ==========
const profileFormSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    dynamicDisabled: true,
    componentProps: {
      placeholder: '用户名',
    },
  },
  {
    field: 'realName',
    label: '真实姓名',
    component: 'Input',
    componentProps: { placeholder: '请输入真实姓名' },
  },
  {
    field: 'email',
    label: '邮箱',
    component: 'Input',
    componentProps: { placeholder: '请输入邮箱' },
  },
  {
    field: 'phone',
    label: '手机号',
    component: 'Input',
    componentProps: { placeholder: '请输入手机号' },
  },
  {
    field: 'avatar',
    label: '头像',
    component: 'Input',
    slot: 'avatarUpload',
    componentProps: { placeholder: '头像URL' },
  },
]

// ========== 修改密码表单 Schema ==========
const passwordFormSchemas: FormSchema[] = [
  {
    field: 'oldPassword',
    label: '当前密码',
    component: 'InputPassword',
    required: true,
    componentProps: { placeholder: '请输入当前密码' },
  },
  {
    field: 'newPassword',
    label: '新密码',
    component: 'InputPassword',
    required: true,
    componentProps: { placeholder: '至少6位' },
  },
  {
    field: 'confirmPassword',
    label: '确认新密码',
    component: 'InputPassword',
    required: true,
    componentProps: { placeholder: '再次输入新密码' },
  },
]

// 回显用户信息
function fillProfileForm() {
  const info = userStore.userInfo
  console.log(info, 'info')
  if (info) {
    profileFormMethods.setFieldsValue({
      username: info.username || '',
      realName: info.realName || '',
      email: info.email || '',
      phone: info.phone || '',
      avatar: info.avatar || '',
    })
  }
}

// 监听 userInfo 变化，确保数据加载后回显
watch(
  () => userStore.userInfo,
  (newVal) => {
    if (newVal) {
      fillProfileForm()
    }
  },
  { immediate: true, deep: true },
)

// 头像上传
// 文件校验函数（before-upload 调用）
function beforeUpload(file: File) {
  // 1. 类型校验：仅允许 JPG/PNG
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png'
  if (!isJpgOrPng) {
    message.error('只能上传 JPG/PNG 格式的图片')
    return false // 阻止上传
  }

  // 2. 大小校验：不超过 2MB
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB')
    return false // 阻止上传
  }

  return true // 校验通过，允许上传
}

// 自定义上传函数（custom-request 调用）
async function customUpload({ file, onSuccess, onError }: any) {
  const formData = new FormData()
  formData.append('file', file)

  uploadLoading.value = true
  try {
    const res = await http.Post('/upload/file', formData)
    console.log(res, 'res')
    const url = res?.data?.url || res?.url
    profileFormMethods.setFieldsValue({ avatar: url })
    message.success('头像上传成功')
    onSuccess(res)
  } catch (e: any) {
    message.error(e?.message || '头像上传失败')
    onError(e)
  } finally {
    uploadLoading.value = false
  }
}

// 提交基本信息
async function handleSaveProfile() {
  const values = await profileFormMethods.validate()
  if (!values) return
  profileLoading.value = true
  try {
    // 排除 username（不可修改），只提交可编辑字段
    const payload = {
      realName: values.realName,
      email: values.email,
      phone: values.phone,
      avatar: values.avatar,
    }
    await http.Post('/auth/profile', payload)
    message.success('个人信息更新成功')
    await refreshUser()
  } catch (e: any) {
    message.error(e?.message || '更新失败')
  } finally {
    profileLoading.value = false
  }
}

// 提交修改密码
async function handleChangePassword() {
  const values = await passwordFormMethods.validate()
  if (!values) return
  if (values.newPassword !== values.confirmPassword) {
    message.error('两次输入的新密码不一致')
    return
  }
  passwordLoading.value = true
  try {
    await http.Post('/auth/password', {
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    })
    message.success('密码修改成功')
    passwordFormMethods.resetFields()
  } catch (e: any) {
    message.error(e?.message || '密码修改失败')
  } finally {
    passwordLoading.value = false
  }
}
onMounted(() => {
  fillProfileForm()
})
</script>

<template>
  <div class="space-y-6">
    <!-- 基本信息卡片 -->
    <a-card title="基本信息" :bordered="false">
      <BasicForm
        :schemas="profileFormSchemas"
        :label-width="100"
        :show-reset-button="false"
        :show-submit-button="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="profileFormRegister"
      >
        <!-- 自定义头像上传字段 -->
        <template #avatarUpload="{ model, field }">
          <div class="flex items-center gap-4">
            <a-upload
              :show-upload-list="false"
              :accept="'.jpg,.jpeg,.png'"
              :before-upload="beforeUpload"
              :custom-request="customUpload"
            >
              <a-button :loading="uploadLoading"> 上传头像 </a-button>
            </a-upload>
            <img
              v-if="model[field]"
              :src="model[field]"
              class="w-16 h-16 rounded-full object-cover border"
              alt="avatar"
            />
          </div>
        </template>
        <template #actionAfter>
          <div class="flex justify-end mt-4">
            <a-button type="primary" :loading="profileLoading" @click="handleSaveProfile">
              保存修改
            </a-button>
          </div>
        </template>
      </BasicForm>
    </a-card>

    <!-- 修改密码卡片 -->
    <a-card title="修改密码" :bordered="false">
      <BasicForm
        :schemas="passwordFormSchemas"
        :label-width="100"
        :show-reset-button="false"
        :show-submit-button="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="passwordFormRegister"
      >
        <template #actionAfter>
          <div class="flex justify-end mt-4">
            <a-button type="primary" :loading="passwordLoading" @click="handleChangePassword">
              确认修改
            </a-button>
          </div>
        </template>
      </BasicForm>
    </a-card>
  </div>
</template>
