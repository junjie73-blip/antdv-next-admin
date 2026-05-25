<script setup lang="ts">
import { cn } from '@/utils/cn'
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { message } from 'antdv-next'
import { Icon } from '@iconify/vue'

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
  if (!pwd) return { level: 0, text: '', color: '', bgColor: '', textColor: '', percent: 0, segments: [] }

  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[a-z]/.test(pwd)) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^a-zA-Z\d]/.test(pwd)) score++

  if (score <= 2) return {
    level: 1,
    text: 'Weak',
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
  if (score <= 4) return {
    level: 2,
    text: 'Fair',
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
  if (score <= 5) return {
    level: 3,
    text: 'Good',
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
  return {
    level: 4,
    text: 'Strong',
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
  if (!password.value) return []

  const pwd = password.value
  return [
    { text: 'At least 8 characters', done: pwd.length >= 8 },
    { text: 'At least 12 characters (recommended)', done: pwd.length >= 12 },
    { text: 'Contains lowercase letters (a-z)', done: /[a-z]/.test(pwd) },
    { text: 'Contains uppercase letters (A-Z)', done: /[A-Z]/.test(pwd) },
    { text: 'Contains numbers (0-9)', done: /\d/.test(pwd) },
    { text: 'Contains special characters (!@#...)', done: /[^a-zA-Z\d]/.test(pwd) },
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
  if (generatorOptions.value.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (generatorOptions.value.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (generatorOptions.value.numbers) chars += '0123456789'
  if (generatorOptions.value.symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'

  if (generatorOptions.value.excludeAmbiguous) {
    chars = chars.replace(/[l1IoO0]/g, '')
  }

  if (!chars) {
    message.warning('Please select at least one character type')
    return
  }

  let result = ''
  const array = new Uint32Array(generatorOptions.value.length)
  crypto.getRandomValues(array)

  for (let i = 0; i < generatorOptions.value.length; i++) {
    result += chars[array[i] % chars.length]
  }

  generatedPassword.value = result
  password.value = result
}

function copyGeneratedPassword() {
  if (!generatedPassword.value) return
  navigator.clipboard.writeText(generatedPassword.value).then(() => {
    message.success('Password copied to clipboard')
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
  message.info('Password loaded from history')
}

function clearHistory() {
  passwordHistory.value = []
  message.success('History cleared')
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
  if (!pwd) return { valid: null, errors: [] }

  const errors: string[] = []

  if (pwd.length < policyConfig.value.minLength) {
    errors.push(`Minimum ${policyConfig.value.minLength} characters required`)
  }
  if (pwd.length > policyConfig.value.maxLength) {
    errors.push(`Maximum ${policyConfig.value.maxLength} characters allowed`)
  }
  if (policyConfig.value.requireUppercase && !/[A-Z]/.test(pwd)) {
    errors.push('At least one uppercase letter required')
  }
  if (policyConfig.value.requireLowercase && !/[a-z]/.test(pwd)) {
    errors.push('At least one lowercase letter required')
  }
  if (policyConfig.value.requireNumber && !/\d/.test(pwd)) {
    errors.push('At least one number required')
  }
  if (policyConfig.value.requireSpecialChar && !/[^a-zA-Z\d]/.test(pwd)) {
    errors.push('At least one special character required')
  }

  let typeCount = 0
  if (/[a-z]/.test(pwd)) typeCount++
  if (/[A-Z]/.test(pwd)) typeCount++
  if (/\d/.test(pwd)) typeCount++
  if (/[^a-zA-Z\d]/.test(pwd)) typeCount++

  if (typeCount < policyConfig.value.minUniqueTypes) {
    errors.push(`At least ${policyConfig.value.minUniqueTypes} different character types required`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
})

// ==================== Combined Dashboard ====================
const overallValid = computed(() => {
  if (!password.value) return null
  return (passwordStrength.value?.level ?? 0) >= 2 && policyValidation.value.valid === true
})
</script>

<template>
  <div :class="containerClass">
    <!-- ==================== 1. Password Strength Indicator ==================== -->
    <a-card title="Password Strength Indicator">
      <p :class="cardDescClass">
        Real-time password strength analysis with visual feedback and security suggestions.
      </p>
      <div :class="passwordCardClass">
        <div :class="relativeClass">
          <a-input-password
            v-model:value="password"
            placeholder="Enter your password"
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

        <div v-if="password" :class="passwordStrengthClass">
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
            <span :class="strengthInfoLabelClass">Password Strength</span>
            <div :class="strengthInfoRightClass">
              <Icon
                :icon="passwordStrength.level === 1 ? 'carbon:warning-alt' : passwordStrength.level === 2 ? 'carbon:warning' : passwordStrength.level === 3 ? 'carbon:checkmark' : 'carbon:checkmark-filled'"
                :class="`text-${passwordStrength.color}`"
              />
              <span :style="{ color: passwordStrength.textColor }" class="font-medium">{{ passwordStrength.text }}</span>
              <span :class="strengthPercentClass">{{ passwordStrength.percent }}%</span>
            </div>
          </div>
        </div>

        <div v-if="passwordTips.length > 0" :class="tipsContainerClass">
          <h4 :class="tipsTitleClass">
            <Icon icon="carbon:security" />
            Security Tips
          </h4>
          <ul :class="tipsListClass">
            <li
              v-for="(tip, index) in passwordTips"
              :key="index"
              :class="tip.done ? tipsItemSuccessClass : tipsItemFailClass"
            >
              <Icon :icon="tip.done ? 'carbon:checkmark-filled' : 'carbon:close'" :class="tipsIconClass" />
              {{ tip.text }}
            </li>
          </ul>
        </div>
      </div>
    </a-card>

    <!-- ==================== 2. Password Visibility Toggle ==================== -->
    <a-card title="Password Visibility Toggle">
      <p :class="cardDescClass">
        Toggle password visibility to verify what you have typed.
      </p>
      <div :class="passwordCardClass">
        <div :class="relativeClass">
          <a-input
            :value="password"
            placeholder="Enter your password"
            allow-clear
            size="large"
            :type="showPassword ? 'text' : 'password'"
          >
            <template #prefix>
              <Icon icon="carbon:locked" :class="iconGrayClass" />
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
          Current status: <strong>{{ showPassword ? 'Visible' : 'Hidden' }}</strong>
        </div>
      </div>
    </a-card>

    <!-- ==================== 3. Password Generator ==================== -->
    <a-card title="Password Generator">
      <p :class="cardDescClass">
        Generate strong random passwords with customizable options.
      </p>
      <div :class="passwordCardClass">
        <div :class="generatorGridClass">
          <div>
            <label :class="generatorLabelClass">Length: {{ generatorOptions.length }}</label>
            <a-slider v-model:value="generatorOptions.length" :min="8" :max="64" :step="1" />
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.uppercase" />
              Uppercase (A-Z)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.lowercase" />
              Lowercase (a-z)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.numbers" />
              Numbers (0-9)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.symbols" />
              Symbols (!@#...)
            </label>
          </div>
          <div :class="generatorCheckItemClass">
            <label :class="generatorCheckLabelClass">
              <a-checkbox v-model:checked="generatorOptions.excludeAmbiguous" />
              Exclude ambiguous chars
            </label>
          </div>
        </div>

        <a-button type="primary" block size="large" @click="generateRandomPassword">
          <template #icon>
            <Icon icon="carbon:renew" />
          </template>
          Generate Password
        </a-button>

        <div v-if="generatedPassword" :class="resultCardClass">
          <div :class="resultCardInnerClass">
            <div :class="resultCardCodeWrapClass">
              <p :class="resultLabelClass">Generated secure password:</p>
              <code :class="resultCodeClass">
                {{ generatedPassword }}
              </code>
              <p :class="resultMetaClass">
                Length: {{ generatedPassword.length }} characters
              </p>
            </div>
            <a-button type="link" @click="copyGeneratedPassword">
              <template #icon>
                <Icon icon="carbon:copy" />
              </template>
              Copy
            </a-button>
          </div>
        </div>
      </div>
    </a-card>

    <!-- ==================== 4. Password History ==================== -->
    <a-card title="Password History">
      <p :class="cardDescClass">
        Automatically saves recently used passwords (up to {{ MAX_HISTORY }} entries).
      </p>
      <div :class="passwordCardClass">
        <div v-if="passwordHistory.length > 0" :class="historyListClass">
          <div
            v-for="(pwd, index) in passwordHistory"
            :key="index"
            :class="historyItemClass"
            @click="useHistoryPassword(pwd)"
          >
            <div :class="historyItemLeftClass">
              <Icon icon="carbon:time" :class="iconGrayClass" />
              <code :class="historyCodeClass">{{ pwd.replace(/./g, '*') }}</code>
              <span :class="historyLenClass">{{ pwd.length }} chars</span>
            </div>
            <div :class="historyActionsClass">
              <a-tooltip title="Use this password">
                <Icon icon="carbon:checkmark" class="text-green-500 cursor-pointer" />
              </a-tooltip>
              <a-tooltip title="Copy to clipboard">
                <Icon
                  icon="carbon:copy"
                  class="text-blue-500 cursor-pointer"
                  @click.stop="navigator.clipboard.writeText(pwd); message.success('Password copied')"
                />
              </a-tooltip>
            </div>
          </div>
          <div :class="historyFooterClass">
            <a-button danger size="small" @click="clearHistory">
              Clear History
            </a-button>
          </div>
        </div>
        <div v-else :class="historyEmptyClass">
          <Icon icon="carbon:document" class="text-4xl mb-2 opacity-30" />
          <p>No password history</p>
          <p class="text-sm mt-1">Passwords you enter will appear here automatically</p>
        </div>
      </div>
    </a-card>

    <!-- ==================== 5. Password Policy Validation ==================== -->
    <a-card title="Password Policy Validation">
      <p :class="cardDescClass">
        Configure password complexity requirements and validate your password in real-time.
      </p>
      <div :class="passwordCardClass">
        <div :class="policyGridClass">
          <div>
            <label :class="generatorLabelClass">Min Length: {{ policyConfig.minLength }}</label>
            <a-slider v-model:value="policyConfig.minLength" :min="6" :max="20" :step="1" />
          </div>
          <div>
            <label :class="generatorLabelClass">Max Length: {{ policyConfig.maxLength }}</label>
            <a-slider v-model:value="policyConfig.maxLength" :min="16" :max="128" :step="1" />
          </div>
        </div>

        <div :class="policyCheckGridClass">
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireUppercase" />
            <span class="text-sm">Require uppercase letters</span>
          </label>
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireLowercase" />
            <span class="text-sm">Require lowercase letters</span>
          </label>
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireNumber" />
            <span class="text-sm">Require numbers</span>
          </label>
          <label :class="policyCheckCardClass">
            <a-checkbox v-model:checked="policyConfig.requireSpecialChar" />
            <span class="text-sm">Require special characters</span>
          </label>
          <label :class="policyCheckCardWideClass">
            <a-checkbox v-model:value="policyConfig.minUniqueTypes" />
            <span class="text-sm">Minimum {{ policyConfig.minUniqueTypes }} character types</span>
          </label>
        </div>

        <div
          v-if="password"
          :class="[policyResultClass, policyValidation.valid === true ? policySuccessClass : policyFailClass]"
        >
          <div :class="policyResultInnerClass">
            <Icon
              :icon="policyValidation.valid ? 'carbon:checkmark-filled' : 'carbon:close-filled'"
              :class="policyValidation.valid ? 'text-green-500' : 'text-red-500'"
              class="text-xl mt-0.5"
            />
            <div class="flex-1">
              <h4 class="font-medium" :class="policyValidation.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'">
                {{ policyValidation.valid ? 'Policy requirements met!' : 'Policy requirements not met' }}
              </h4>
              <ul v-if="!policyValidation.valid && policyValidation.errors.length > 0" class="mt-2 space-y-1">
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

    <!-- ==================== 6. Combined Dashboard ==================== -->
    <a-card title="Combined Dashboard">
      <p :class="cardDescClass">
        All features combined in a single unified panel.
      </p>
      <div :class="passwordCardClass">
        <div :class="relativeClass">
          <a-input
            :value="password"
            placeholder="Enter your password"
            allow-clear
            size="large"
            :type="showPassword ? 'text' : 'password'"
            :status="overallValid === false ? 'error' : overallValid === true ? undefined : undefined"
          >
            <template #prefix>
              <Icon icon="carbon:password" :class="iconGrayClass" />
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

        <div v-if="password" :class="strengthBarOuterClass">
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
            Generate
          </a-button>
          <a-button v-if="generatedPassword" @click="copyGeneratedPassword">
            <template #icon>
              <Icon icon="carbon:copy" />
            </template>
            Copy
          </a-button>
        </div>

        <div :class="dashboardStatusGridClass">
          <div :class="[
            statusCardBaseClass,
            !password ? statusCardNeutralClass : passwordStrength.level >= 2 ? statusCardSuccessClass : statusCardFailClass,
          ]">
            <Icon
              :icon="!password ? 'carbon:help' : passwordStrength.level >= 2 ? 'carbon:checkmark-filled' : 'carbon:close-filled'"
              :class="{
                'text-green-500': !password || passwordStrength.level >= 2,
                'text-red-500': password && passwordStrength.level < 2,
              }"
              class="text-xl"
            />
            <p class="text-xs mt-1">Strength</p>
          </div>
          <div :class="[
            statusCardBaseClass,
            !policyValidation.valid ? (policyValidation.valid === true ? statusCardSuccessClass : statusCardFailClass) : statusCardNeutralClass,
          ]">
            <Icon
              :icon="!policyValidation.valid ? 'carbon:help' : policyValidation.valid ? 'carbon:checkmark-filled' : 'carbon:close-filled'"
              :class="{
                'text-green-500': policyValidation.valid !== false,
                'text-red-500': policyValidation.valid === false,
              }"
              class="text-xl"
            />
            <p class="text-xs mt-1">Policy</p>
          </div>
          <div :class="[statusCardBaseClass, statusCardNeutralClass]">
            <Icon icon="carbon:history" class="text-gray-500 text-xl" />
            <p class="text-xs mt-1">History ({{ passwordHistory.length }})</p>
          </div>
          <div :class="[
            statusCardBaseClass,
            overallValid === true ? statusCardSuccessClass : overallValid === false ? statusCardWarningClass : statusCardNeutralClass,
          ]">
            <Icon
              :icon="overallValid === null ? 'carbon:help' : overallValid ? 'carbon:checkmark-filled' : 'carbon:warning-alt'"
              :class="{
                'text-green-500': overallValid === true || overallValid === null,
                'text-orange-500': overallValid === false,
              }"
              class="text-xl"
            />
            <p class="text-xs mt-1">Overall</p>
          </div>
        </div>

        <div v-if="passwordHistory.length > 0">
          <h4 :class="dashboardHistoryTitleClass">
            <Icon icon="carbon:time" />
            Quick History Selection
          </h4>
          <div :class="dashboardHistoryTagsClass">
            <a-tag
              v-for="(pwd, index) in passwordHistory"
              :key="index"
              class="cursor-pointer hover:border-blue-500"
              @click="useHistoryPassword(pwd)"
            >
              History #{{ index + 1 }}
              <span class="ml-1 opacity-60">({{ pwd.length }} chars)</span>
            </a-tag>
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>