<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { message } from 'antdv-next'
import { computed, ref, watch } from 'vue'
import { cn } from '@/utils/cn'

const containerClass = cn('space-y-6')
const cardDescClass = cn('text-gray-600 dark:text-gray-400 mb-4')
const passwordCardClass = cn('max-w-lg mx-auto space-y-4')
const relativeClass = cn('relative')

// ==================== Strength Indicator Styles ====================
const suffixRowClass = cn('flex items-center gap-2')
const strengthBadgeClass = cn('text-xs px-2 py-0.5 rounded font-medium')
const strengthBarOuterClass = cn('h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700')
const strengthBarInnerClass = cn('h-full flex gap-1')
const strengthSegmentClass = cn('flex-1 rounded-full transition-all duration-300')
const strengthInfoRowClass = cn('flex justify-between items-center text-sm')
const strengthInfoLabelClass = cn('text-gray-600 dark:text-gray-400')
const strengthInfoRightClass = cn('flex items-center gap-2')
const strengthPercentClass = cn('text-gray-400')
const tipsContainerClass = cn('p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2')
const tipsTitleClass = cn('font-medium text-sm flex items-center gap-2')
const tipsListClass = cn('space-y-1.5')
const tipsItemSuccessClass = cn('flex items-center gap-2 text-sm text-green-600 dark:text-green-400')
const tipsItemFailClass = cn('flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400')
const tipsIconClass = cn('flex-shrink-0')

// ==================== Visibility Toggle Styles ====================
const toggleBtnClass = cn('p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors')
const toggleIconClass = cn('text-gray-400 hover:text-blue-500 transition-colors')
const visibilityInfoClass = cn('flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300')

// ==================== Password Generator Styles ====================
const generatorGridClass = cn('grid grid-cols-2 md:grid-cols-3 gap-4 mb-4')
const generatorLabelClass = cn('block text-sm font-medium mb-1')
const generatorCheckItemClass = cn('flex flex-col justify-end pb-1')
const generatorCheckLabelClass = cn('flex items-center gap-2 cursor-pointer')
const resultCardClass = cn('mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800')
const resultCardInnerClass = cn('flex items-start justify-between gap-2')
const resultCardCodeWrapClass = cn('flex-1 min-w-0')
const resultLabelClass = cn('text-xs text-green-600 dark:text-green-400 mb-1')
const resultCodeClass = cn('block p-3 bg-white dark:bg-gray-800 rounded text-lg break-all font-mono select-all')
const resultMetaClass = cn('text-xs text-gray-500 mt-2')

// ==================== Password History Styles ====================
const historyListClass = cn('space-y-2')
const historyItemClass = cn('flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group cursor-pointer')
const historyItemLeftClass = cn('flex items-center gap-3 flex-1 min-w-0')
const historyCodeClass = cn('font-mono text-sm truncate')
const historyLenClass = cn('text-xs text-gray-500 flex-shrink-0')
const historyActionsClass = cn('flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity')
const historyFooterClass = cn('flex justify-end pt-2')
const historyEmptyClass = cn('text-center py-8 text-gray-500')

// ==================== Policy Validation Styles ====================
const policyGridClass = cn('grid grid-cols-1 md:grid-cols-2 gap-4 mb-4')
const policyCheckGridClass = cn('grid grid-cols-2 md:grid-cols-3 gap-3 mb-4')
const policyCheckCardClass = cn('flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700')
const policyCheckCardWideClass = cn('flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg col-span-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700')
const policyResultClass = cn('p-4 rounded-lg')
const policyResultInnerClass = cn('flex items-start gap-2')
const policySuccessClass = cn('bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800')
const policyFailClass = cn('bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800')

// ==================== Combined Dashboard Styles ====================
const dashboardActionsClass = cn('flex gap-2 flex-wrap')
const dashboardStatusGridClass = cn('grid grid-cols-2 md:grid-cols-4 gap-3')
const statusCardBaseClass = cn('text-center p-3 rounded-lg')
const statusCardSuccessClass = cn('bg-green-50 dark:bg-green-900/20')
const statusCardFailClass = cn('bg-red-50 dark:bg-red-900/20')
const statusCardNeutralClass = cn('bg-gray-50 dark:bg-gray-800')
const statusCardWarningClass = cn('bg-orange-50 dark:bg-orange-900/20')
const dashboardHistoryTitleClass = cn('text-sm font-medium mb-2 flex items-center gap-2')
const dashboardHistoryTagsClass = cn('flex gap-2 flex-wrap')
const passwordStrengthClass = cn('space-y-2')
const iconGrayClass = cn('text-gray-400')

// ==================== Password Strength Indicator ====================
const password = ref('')
const showPassword = ref(false)

interface TipItem {
  text: string
  done: boolean
}

interface StrengthResult {
  level: number
  text: string
  color: string
  bgColor: string
  textColor: string
  percent: number
  segments: { color: string, active: boolean }[]
}

const passwordStrength = computed<StrengthResult>(() => {
  const pwd = password.value
  if (!pwd)
    return { level: 0, text: '', color: '', bgColor: '', textColor: '', percent: 0, segments: [] }

  let score = 0
  if (pwd.length >= 8)
    score++
  if (pwd.length >= 12)
    score++
  if (/[a-z]/.test(pwd))
    score++
  if (/[A-Z]/.test(pwd))
    score++
  if (/\d/.test(pwd))
    score++
  if (/[^a-z\d]/i.test(pwd))
    score++

  if (score <= 2) {
    return {
      level: 1,
      text: '弱',
      color: '#ff4d4f',
      bgColor: '#fff2f0',
      textColor: '#ff4d4f',
      percent: 25,
      segments: [
        { color: '#ff4d4f', active: true },
        { color: '#d9d9d9', active: false },
        { color: '#d9d9d9', active: false },
        { color: '#d9d9d9', active: false },
      ],
    }
  }
  if (score <= 4) {
    return {
      level: 2,
      text: '一般',
      color: '#faad14',
      bgColor: '#fffbe6',
      textColor: '#faad14',
      percent: 50,
      segments: [
        { color: '#faad14', active: true },
        { color: '#faad14', active: true },
        { color: '#d9d9d9', active: false },
        { color: '#d9d9d9', active: false },
      ],
    }
  }
  if (score <= 5) {
    return {
      level: 3,
      text: '良好',
      color: '#1677ff',
      bgColor: '#e6f7ff',
      textColor: '#1677ff',
      percent: 75,
      segments: [
        { color: '#1677ff', active: true },
        { color: '#1677ff', active: true },
        { color: '#1677ff', active: true },
        { color: '#d9d9d9', active: false },
      ],
    }
  }
  return {
    level: 4,
    text: '强',
    color: '#52c41a',
    bgColor: '#f6ffed',
    textColor: '#52c41a',
    percent: 100,
    segments: [
      { color: '#52c41a', active: true },
      { color: '#52c41a', active: true },
      { color: '#52c41a', active: true },
      { color: '#52c41a', active: true },
    ],
  }
})

const passwordTips = computed<TipItem[]>(() => {
  if (!password.value)
    return []

  const pwd = password.value
  return [
    { text: '至少8个字符', done: pwd.length >= 8 },
    { text: '至少12个字符（推荐）', done: pwd.length >= 12 },
    { text: '包含小写字母 (a-z)', done: /[a-z]/.test(pwd) },
    { text: '包含大写字母 (A-Z)', done: /[A-Z]/.test(pwd) },
    { text: '包含数字 (0-9)', done: /\d/.test(pwd) },
    { text: '包含特殊字符 (!@#...)', done: /[^a-z\d]/i.test(pwd) },
  ]
})

// ==================== Password Generator ====================
const generatedPassword = ref('')

interface GeneratorOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

const generatorOptions = ref<GeneratorOptions>({
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
})

function generateRandomPassword() {
  let chars = ''
  if (generatorOptions.value.lowercase)
    chars += 'abcdefghijklmnopqrstuvwxyz'
  if (generatorOptions.value.uppercase)
    chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (generatorOptions.value.numbers)
    chars += '0123456789'
  if (generatorOptions.value.symbols)
    chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'

  if (generatorOptions.value.excludeAmbiguous) {
    chars = chars.replace(/[l1IoO0]/g, '')
  }

  if (!chars) {
    message.warning('请至少选择一种字符类型')
    return
  }

  let result = ''
  const array = new Uint32Array(generatorOptions.value.length)
  crypto.getRandomValues(array)

  for (let i = 0; i < generatorOptions.value.length; i++) {
    const val = array[i]
    if (val === undefined)
      continue
    const idx = val % chars.length
    const ch = chars[idx]
    if (ch !== undefined)
      result += ch
  }

  generatedPassword.value = result
  password.value = result
}

function copyGeneratedPassword() {
  if (!generatedPassword.value)
    return
  window.navigator.clipboard.writeText(generatedPassword.value).then(() => {
    message.success('密码已复制到剪贴板')
  })
}

function copyHistoryPassword(pwd: string) {
  window.navigator.clipboard.writeText(pwd).then(() => {
    message.success('密码已复制')
  })
}

// ==================== Password History ====================
const passwordHistory = ref<string[]>([])
const MAX_HISTORY = 5

function saveToHistory(pwd: string) {
  if (pwd && pwd.length >= 8) {
    const index = passwordHistory.value.indexOf(pwd)
    if (index > -1) {
      passwordHistory.value.splice(index, 1)
    }
    passwordHistory.value.unshift(pwd)
    if (passwordHistory.value.length > MAX_HISTORY) {
      passwordHistory.value.pop()
    }
  }
}

const debouncedSaveHistory = useDebounceFn((pwd: string) => {
  saveToHistory(pwd)
}, 500)

watch(password, (newVal) => {
  debouncedSaveHistory(newVal)
})

function useHistoryPassword(pwd: string) {
  password.value = pwd
  message.info('已从历史加载密码')
}

function clearHistory() {
  passwordHistory.value = []
  message.success('历史已清空')
}

// ==================== Password Policy Validation ====================
interface PolicyConfig {
  minLength: number
  maxLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireNumber: boolean
  requireSpecialChar: boolean
  minUniqueTypes: number
}

const policyConfig = ref<PolicyConfig>({
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,
  minUniqueTypes: 3,
})

interface PolicyValidationResult {
  valid: boolean | null
  errors: string[]
}

const policyValidation = computed<PolicyValidationResult>(() => {
  const pwd = password.value
  if (!pwd)
    return { valid: null, errors: [] }

  const errors: string[] = []

  if (pwd.length < policyConfig.value.minLength) {
    errors.push(`至少需要 ${policyConfig.value.minLength} 个字符`)
  }
  if (pwd.length > policyConfig.value.maxLength) {
    errors.push(`最多允许 ${policyConfig.value.maxLength} 个字符`)
  }
  if (policyConfig.value.requireUppercase && !/[A-Z]/.test(pwd)) {
    errors.push('至少需要一个大写字母')
  }
  if (policyConfig.value.requireLowercase && !/[a-z]/.test(pwd)) {
    errors.push('至少需要一个小写字母')
  }
  if (policyConfig.value.requireNumber && !/\d/.test(pwd)) {
    errors.push('至少需要一个数字')
  }
  if (policyConfig.value.requireSpecialChar && !/[^a-z\d]/i.test(pwd)) {
    errors.push('至少需要一个特殊字符')
  }

  let typeCount = 0
  if (/[a-z]/.test(pwd))
    typeCount++
  if (/[A-Z]/.test(pwd))
    typeCount++
  if (/\d/.test(pwd))
    typeCount++
  if (/[^a-z\d]/i.test(pwd))
    typeCount++

  if (typeCount < policyConfig.value.minUniqueTypes) {
    errors.push(`至少需要 ${policyConfig.value.minUniqueTypes} 种不同的字符类型`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
})

// ==================== Combined Dashboard ====================
const overallValid = computed(() => {
  if (!password.value)
    return null
  return (passwordStrength.value?.level ?? 0) >= 2 && policyValidation.value.valid === true
})
</script>

<template>
  <div :class="containerClass">
    <!-- ==================== 1. 密码强度检测器 ==================== -->
    <a-card title="密码强度检测器">
      <p :class="cardDescClass">
        实时密码强度分析，提供视觉反馈和安全建议。
      </p>
      <div :class="passwordCardClass">
        <div :class="relativeClass">
          <a-input-password
            v-model:value="password"
            placeholder="输入密码"
            allow-clear
            size="large"
            :visibility-toggle="false"
          >
            <template #suffix>
              <div :class="suffixRowClass">
                <span
                  v-if="password"
                  :class="strengthBadgeClass"
                  :style="{ backgroundColor: passwordStrength.bgColor, color: passwordStrength.textColor }"
                >
                  {{ passwordStrength.text }}
                </span>
              </div>
            </template>
          </a-input-password>
        </div>

        <div
          v-if="password"
          :class="passwordStrengthClass"
        >
          <div :class="strengthBarOuterClass">
            <div :class="strengthBarInnerClass">
              <div
                v-for="(segment, index) in passwordStrength.segments"
                :key="index"
                :class="strengthSegmentClass"
                :style="{ backgroundColor: segment.active ? segment.color : '#e5e7eb' }"
              />
            </div>
          </div>

          <div :class="strengthInfoRowClass">
            <span :class="strengthInfoLabelClass">密码强度</span>
            <div :class="strengthInfoRightClass">
              <Icon
                :icon="passwordStrength.level === 1 ? 'carbon:warning-alt' : passwordStrength.level === 2 ? 'carbon:warning' : passwordStrength.level === 3 ? 'carbon:checkmark' : 'carbon:checkmark-filled'"
                :class="`text-${passwordStrength.color}`"
              />
              <span
                :style="{ color: passwordStrength.textColor }"
                class="font-medium"
              >{{ passwordStrength.text }}</span>
              <span :class="strengthPercentClass">{{ passwordStrength.percent }}%</span>
            </div>
          </div>
        </div>

        <div
          v-if="passwordTips.length > 0"
          :class="tipsContainerClass"
        >
          <h4 :class="tipsTitleClass">
            <Icon icon="carbon:security" />
            安全建议
          </h4>
          <ul :class="tipsListClass">
            <li
              v-for="(tip, index) in passwordTips"
              :key="index"
              :class="tip.done ? tipsItemSuccessClass : tipsItemFailClass"
            >
              <Icon
                :icon="tip.done ? 'carbon:checkmark-filled' : 'carbon:close'"
                :class="tipsIconClass"
              />
              {{ tip.text }}
            </li>
          </ul>
        </div>
      </div>
    </a-card>

    <!-- ==================== 2. 密码可见性切换 ==================== -->
    <a-card title="密码可见性切换">
      <p :class="cardDescClass">
        切换密码可见性，验证输入内容。
      </p>
      <div :class="passwordCardClass">
        <div :class="relativeClass">
          <a-input
            :value="password"
            placeholder="输入密码"
            allow-clear
            size="large"
            :type="showPassword ? 'text' : 'password'"
          >
            <template #prefix>
              <Icon
                icon="carbon:locked"
                :class="iconGrayClass"
              />
            </template>
            <template #suffix>
              <button
                :class="toggleBtnClass"
                @click="showPassword = !showPassword"
              >
                <Icon
                  :icon="showPassword ? 'carbon:view-off' : 'carbon:view'"
                  :class="toggleIconClass"
                />
              </button>
            </template>
          </a-input>
        </div>
        <div :class="visibilityInfoClass">
          <Icon icon="carbon:information" />
          当前状态：<strong>{{ showPassword ? '可见' : '隐藏' }}</strong>
        </div>
      </div>
    </a-card>

    <!-- ==================== 3. 密码生成器 ==================== -->
    <a-card title="密码生成器">
      <p :class="cardDescClass">
        生成强随机密码，支持自定义选项。
      </p>
      <div :class="passwordCardClass">
        <div :class="generatorGridClass">
          <div>
            <label :class="generatorLabelClass">长度: {{ generatorOptions.length }}</label>
            <a-slider
              v-model:value="generatorOptions.length"
              :min="8"
              :max="64"
              :step="1"
            />
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.uppercase" />
              大写字母 (A-Z)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.lowercase" />
              小写字母 (a-z)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.numbers" />
              数字 (0-9)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.symbols" />
              特殊符号 (!@#...)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.excludeAmbiguous" />
              排除易混淆字符
            </label>
          </div>
        </div>

        <a-button
          type="primary"
          block
          size="large"
          @click="generateRandomPassword"
        >
          <template #icon>
            <Icon icon="carbon:renew" />
          </template>
          生成密码
        </a-button>

        <div
          v-if="generatedPassword"
          :class="resultCardClass"
        >
          <div :class="resultCardInnerClass">
            <div :class="resultCardCodeWrapClass">
              <p :class="resultLabelClass">
                生成的密码:
              </p>
              <code :class="resultCodeClass">
                {{ generatedPassword }}
              </code>
              <p :class="resultMetaClass">
                长度: {{ generatedPassword.length }} 字符
              </p>
            </div>
            <a-button
              type="link"
              @click="copyGeneratedPassword"
            >
              <template #icon>
                <Icon icon="carbon:copy" />
              </template>
              复制
            </a-button>
          </div>
        </div>
      </div>
    </a-card>

    <!-- ==================== 4. 密码历史 ==================== -->
    <a-card title="密码历史">
      <p :class="cardDescClass">
        自动保存最近使用的密码（最多 {{ MAX_HISTORY }} 条）。
      </p>
      <div :class="passwordCardClass">
        <div
          v-if="passwordHistory.length > 0"
          :class="historyListClass"
        >
          <div
            v-for="(pwd, index) in passwordHistory"
            :key="index"
            :class="historyItemClass"
            @click="useHistoryPassword(pwd)"
          >
            <div :class="historyItemLeftClass">
              <Icon
                icon="carbon:time"
                :class="iconGrayClass"
              />
              <code :class="historyCodeClass">{{ pwd.replace(/./g, '*') }}</code>
              <span :class="historyLenClass">{{ pwd.length }} 字符</span>
            </div>
            <div :class="historyActionsClass">
              <a-tooltip title="使用此密码">
                <Icon
                  icon="carbon:checkmark"
                  class="text-green-500 cursor-pointer"
                />
              </a-tooltip>
              <a-tooltip title="复制到剪贴板">
                <Icon
                  icon="carbon:copy"
                  class="text-blue-500 cursor-pointer"
                  @click.stop="copyHistoryPassword(pwd)"
                />
              </a-tooltip>
            </div>
          </div>
          <div :class="historyFooterClass">
            <a-button
              danger
              size="small"
              @click="clearHistory"
            >
              清空历史
            </a-button>
          </div>
        </div>
        <div
          v-else
          :class="historyEmptyClass"
        >
          <Icon
            icon="carbon:document"
            class="text-4xl mb-2 opacity-30"
          />
          <p>暂无密码历史</p>
          <p class="text-sm mt-1">
            您输入的密码将自动显示在此处
          </p>
        </div>
      </div>
    </a-card>

    <!-- ==================== 5. 密码策略验证 ==================== -->
    <a-card title="密码策略验证">
      <p :class="cardDescClass">
        配置密码复杂度要求并实时验证。
      </p>
      <div :class="passwordCardClass">
        <div :class="policyGridClass">
          <div>
            <label :class="generatorLabelClass">最小长度: {{ policyConfig.minLength }}</label>
            <a-slider
              v-model:value="policyConfig.minLength"
              :min="6"
              :max="20"
              :step="1"
            />
          </div>
          <div>
            <label :class="generatorLabelClass">最大长度: {{ policyConfig.maxLength }}</label>
            <a-slider
              v-model:value="policyConfig.maxLength"
              :min="16"
              :max="128"
              :step="1"
            />
          </div>
        </div>

        <div :class="policyCheckGridClass">
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireUppercase" />
            <span class="text-sm">要求大写字母</span>
          </label>
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireLowercase" />
            <span class="text-sm">要求小写字母</span>
          </label>
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireNumber" />
            <span class="text-sm">要求数字</span>
          </label>
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireSpecialChar" />
            <span class="text-sm">要求特殊字符</span>
          </label>
          <label :class="policyCheckCardWideClass">
            <a-checkbox v-model:value="policyConfig.minUniqueTypes" />
            <span class="text-sm">最少 {{ policyConfig.minUniqueTypes }} 种字符类型</span>
          </label>
        </div>

        <div
          v-if="password"
          :class="[policyResultClass,
                   policyValidation.valid === true ? policySuccessClass : policyFailClass]"
        >
          <div :class="policyResultInnerClass">
            <Icon
              :icon="policyValidation.valid ? 'carbon:checkmark-filled' : 'carbon:close-filled'"
              :class="policyValidation.valid ? 'text-green-500' : 'text-red-500'"
              class="text-xl mt-0.5"
            />
            <div class="flex-1">
              <h4
                class="font-medium"
                :class="policyValidation.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'"
              >
                {{ policyValidation.valid ? '策略要求已满足！' : '策略要求未满足' }}
              </h4>
              <ul
                v-if="!policyValidation.valid && policyValidation.errors.length > 0"
                class="mt-2 space-y-1"
              >
                <li
                  v-for="(error, index) in policyValidation.errors"
                  :key="index"
                  class="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
                >
                  <Icon icon="carbon:close" />
                  {{ error }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </a-card>

    <!-- ==================== 6. 综合仪表盘 ==================== -->
    <a-card title="综合仪表盘">
      <p :class="cardDescClass">
        所有功能整合在一个统一面板中。
      </p>
      <div :class="passwordCardClass">
        <div :class="relativeClass">
          <a-input
            :value="password"
            placeholder="输入密码"
            allow-clear
            size="large"
            :type="showPassword ? 'text' : 'password'"
            :status="overallValid === false ? 'error' : overallValid === true ? undefined : undefined"
          >
            <template #prefix>
              <Icon
                icon="carbon:password"
                :class="iconGrayClass"
              />
            </template>
            <template #suffix>
              <div :class="suffixRowClass">
                <span
                  v-if="password"
                  :class="strengthBadgeClass"
                  :style="{ backgroundColor: passwordStrength.bgColor, color: passwordStrength.textColor }"
                >
                  {{ passwordStrength.text }}
                </span>
                <button
                  :class="toggleBtnClass"
                  @click="showPassword = !showPassword"
                >
                  <Icon
                    :icon="showPassword ? 'carbon:view-off' : 'carbon:view'"
                    class="text-gray-400 hover:text-blue-500"
                  />
                </button>
              </div>
            </template>
          </a-input>
        </div>

        <div
          v-if="password"
          :class="strengthBarOuterClass"
        >
          <div :class="strengthBarInnerClass">
            <div
              v-for="(segment, index) in passwordStrength.segments"
              :key="index"
              :class="strengthSegmentClass"
              :style="{ backgroundColor: segment.active ? segment.color : '#e5e7eb' }"
            />
          </div>
        </div>

        <div :class="dashboardActionsClass">
          <a-button @click="generateRandomPassword">
            <template #icon>
              <Icon icon="carbon:renew" />
            </template>
            生成
          </a-button>
          <a-button
            v-if="generatedPassword"
            @click="copyGeneratedPassword"
          >
            <template #icon>
              <Icon icon="carbon:copy" />
            </template>
            复制
          </a-button>
        </div>

        <div :class="dashboardStatusGridClass">
          <div
            :class="[
              statusCardBaseClass,
              !password ? statusCardNeutralClass : passwordStrength.level >= 2 ? statusCardSuccessClass : statusCardFailClass,
            ]"
          >
            <Icon
              :icon="!password ? 'carbon:help' : passwordStrength.level >= 2 ? 'carbon:checkmark-filled' : 'carbon:close-filled'"
              :class="{
                'text-green-500': !password || passwordStrength.level >= 2,
                'text-red-500': password && passwordStrength.level < 2,
              }"
              class="text-xl"
            />
            <p class="text-xs mt-1">
              强度
            </p>
          </div>
          <div
            :class="[
              statusCardBaseClass,
              policyValidation.valid === true ? statusCardSuccessClass : policyValidation.valid === false ? statusCardFailClass : statusCardNeutralClass,
            ]"
          >
            <Icon
              :icon="!policyValidation.valid ? 'carbon:help' : policyValidation.valid ? 'carbon:checkmark-filled' : 'carbon:close-filled'"
              :class="{
                'text-green-500': policyValidation.valid !== false,
                'text-red-500': policyValidation.valid === false,
              }"
              class="text-xl"
            />
            <p class="text-xs mt-1">
              策略
            </p>
          </div>
          <div
            :class="[statusCardBaseClass,
                     statusCardNeutralClass]"
          >
            <Icon
              icon="carbon:history"
              class="text-gray-500 text-xl"
            />
            <p class="text-xs mt-1">
              历史 ({{ passwordHistory.length }})
            </p>
          </div>
          <div
            :class="[
              statusCardBaseClass,
              overallValid === true ? statusCardSuccessClass : overallValid === false ? statusCardWarningClass : statusCardNeutralClass,
            ]"
          >
            <Icon
              :icon="overallValid === null ? 'carbon:help' : overallValid ? 'carbon:checkmark-filled' : 'carbon:warning-alt'"
              :class="{
                'text-green-500': overallValid === true || overallValid === null,
                'text-orange-500': overallValid === false,
              }"
              class="text-xl"
            />
            <p class="text-xs mt-1">
              综合
            </p>
          </div>
        </div>

        <div v-if="passwordHistory.length > 0">
          <h4 :class="dashboardHistoryTitleClass">
            <Icon icon="carbon:time" />
            快速选择历史
          </h4>
          <div :class="dashboardHistoryTagsClass">
            <a-tag
              v-for="(pwd, index) in passwordHistory"
              :key="index"
              class="cursor-pointer hover:border-blue-500"
              @click="useHistoryPassword(pwd)"
            >
              历史 #{{ index + 1 }}
              <span class="ml-1 opacity-60">({{ pwd.length }} 字符)</span>
            </a-tag>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>
