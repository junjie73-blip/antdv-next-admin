<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, onMounted, reactive, ref } from 'vue'

import { getPasswordPolicy, updatePasswordPolicy, type PasswordPolicy } from '../api'

defineOptions({ name: 'PasswordPolicyPanel' })

const loading = ref(false)
const saving = ref(false)
const form = reactive<PasswordPolicy>({
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false,
  historyCount: 5,
  expireDays: 90,
})

/* ============================================================
 * 实时预览：示例密码是否满足
 * ============================================================ */
const samplePassword = ref('Abc123456')

const checks = computed(() => [
  { label: `长度 ≥ ${form.minLength}`, ok: samplePassword.value.length >= form.minLength },
  { label: '包含大写', ok: !form.requireUppercase || /[A-Z]/.test(samplePassword.value) },
  { label: '包含小写', ok: !form.requireLowercase || /[a-z]/.test(samplePassword.value) },
  { label: '包含数字', ok: !form.requireNumber || /\d/.test(samplePassword.value) },
  { label: '包含特殊字符', ok: !form.requireSpecial || /[^A-Za-z0-9]/.test(samplePassword.value) },
])

const strengthLevel = computed(() => {
  const passed = checks.value.filter((c) => c.ok).length
  const total = checks.value.length
  const ratio = passed / total
  if (ratio >= 1) return { level: '强', color: 'bg-emerald-500', pct: 100 }
  if (ratio >= 0.6) return { level: '中', color: 'bg-amber-500', pct: 60 }
  return { level: '弱', color: 'bg-rose-500', pct: 30 }
})

/* ============================================================
 * 加载 / 保存
 * ============================================================ */
async function load() {
  loading.value = true
  try {
    const res: any = await getPasswordPolicy()
    Object.assign(form, res?.data ?? res)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    await updatePasswordPolicy({ ...form })
    message.success('密码策略已保存')
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <!-- 左侧：配置项 -->
    <a-card :bordered="false" title="密码策略" class="lg:col-span-2">
      <a-spin :spinning="loading">
        <a-form layout="vertical">
          <a-form-item label="最小长度">
            <a-input-number v-model:value="form.minLength" :min="6" :max="32" class="w-full">
              <template #addonAfter>位</template>
            </a-input-number>
          </a-form-item>

          <a-form-item label="复杂度要求">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm">包含大写字母 (A-Z)</span>
                <a-switch v-model:checked="form.requireUppercase" />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">包含小写字母 (a-z)</span>
                <a-switch v-model:checked="form.requireLowercase" />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">包含数字 (0-9)</span>
                <a-switch v-model:checked="form.requireNumber" />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">包含特殊字符 (!@#$ 等)</span>
                <a-switch v-model:checked="form.requireSpecial" />
              </div>
            </div>
          </a-form-item>

          <a-form-item label="历史密码检查">
            <a-input-number v-model:value="form.historyCount" :min="0" :max="20" class="w-full">
              <template #addonAfter>次</template>
            </a-input-number>
            <div class="mt-1 text-xs text-slate-400">新密码不能与最近 N 次使用的密码相同，0 表示不检查</div>
          </a-form-item>

          <a-form-item label="密码有效期">
            <a-input-number v-model:value="form.expireDays" :min="0" :max="365" class="w-full">
              <template #addonAfter>天</template>
            </a-input-number>
            <div class="mt-1 text-xs text-slate-400">超过此天数需强制修改密码，0 表示永不过期</div>
          </a-form-item>
        </a-form>

        <div class="flex justify-end">
          <a-button type="primary" :loading="saving" @click="save">
            <template #icon><Icon icon="carbon:save" /></template>
            保存
          </a-button>
        </div>
      </a-spin>
    </a-card>

    <!-- 右侧：实时预览 -->
    <a-card :bordered="false" title="实时预览" class="shadow-sm">
      <a-input v-model:value="samplePassword" placeholder="输入示例密码查看强度" allow-clear />

      <!-- 强度条 -->
      <div class="mt-4">
        <div class="mb-1 flex items-center justify-between text-xs">
          <span class="text-slate-500">强度</span>
          <span
            class="font-semibold"
            :class="{
              'text-emerald-500': strengthLevel.level === '强',
              'text-amber-500': strengthLevel.level === '中',
              'text-rose-500': strengthLevel.level === '弱',
            }"
          >
            {{ strengthLevel.level }}
          </span>
        </div>
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="strengthLevel.color"
            :style="{ width: `${strengthLevel.pct}%` }"
          />
        </div>
      </div>

      <!-- 检查列表 -->
      <div class="mt-4 space-y-2">
        <div v-for="c in checks" :key="c.label" class="flex items-center gap-2 text-sm">
          <Icon
            :icon="c.ok ? 'carbon:checkmark-filled' : 'carbon:close-filled'"
            :class="c.ok ? 'text-emerald-500' : 'text-rose-400'"
          />
          <span :class="c.ok ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'">
            {{ c.label }}
          </span>
        </div>
      </div>
    </a-card>
  </div>
</template>
