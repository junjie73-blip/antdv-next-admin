<script setup lang="ts">
import type { Rule } from '@antdv/form-ui';

import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { runRule } from '@antdv/form-ui';
import { message } from '@antdv/popup-ui';
import {
  Button as AButton,
  Checkbox as ACheckbox,
  Input as AInput,
  Label,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';

const router = useRouter();

const loading = ref(false);
const countdown = ref(0);
const passwordVisible = ref(false);
const confirmPasswordVisible = ref(false);

/** 每个字段的错误文案，`''` 表示没有错误（原来由 antd FormItem 自己持有） */
const errors = reactive<Record<string, string>>({});

const formState = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
  agreement: false,
});

const containerClassName = computed(() =>
  cn(
    'flex min-h-screen',
    'bg-linear-to-br from-stone-100 via-slate-50 to-gray-50',
  ),
);

const leftPanelClassName = computed(() =>
  cn('hidden lg:flex lg:w-1/2 xl:w-3/5', 'relative overflow-hidden'),
);

const leftGlassClassName = computed(() =>
  cn(
    'absolute inset-0',
    'bg-linear-to-br from-white/60 via-slate-100/40 to-gray-100/50',
    'backdrop-blur-xl',
  ),
);

const rightPanelClassName = computed(() =>
  cn(
    'w-full lg:w-1/2 xl:w-2/5',
    'flex items-center justify-center',
    'p-8 lg:p-12',
    'bg-linear-to-br from-white/80 to-slate-50/60',
  ),
);

const glassCardClassName = computed(() =>
  cn(
    'w-full max-w-md',
    'bg-white/70 backdrop-blur-2xl',
    'border border-white/80',
    'rounded-2xl shadow-xl shadow-slate-900/5',
    'p-8 lg:p-10',
  ),
);

const inputClassName = computed(() =>
  cn(
    'h-11 rounded-lg border-slate-200 bg-white/80',
    'text-stone-700 placeholder:text-stone-400',
    'hover:border-slate-400',
    'focus-visible:border-(--ant-color-primary)',
    'focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--ant-color-primary)_20%,transparent)]',
  ),
);

const rules: Record<string, Rule[]> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度为3-20个字符', trigger: 'blur' },
    {
      pattern: /^\w+$/,
      message: '用户名只能包含字母、数字和下划线',
      trigger: 'blur',
    },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        if (value && value !== formState.password) {
          return Promise.reject(new Error('两次密码输入不一致'));
        }
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位', trigger: 'blur' },
  ],
};

/**
 * 页面上真实渲染出来的字段，顺序与 DOM 一致。
 * `rules` 里还留着 `code`（手机验证码那版布局的遗留），但它没有对应的表单项，
 * 旧版 antd Form 只校验挂载过的 FormItem，所以这里同样不参与校验。
 */
const fieldNames = ['username', 'email', 'password', 'confirmPassword'];

/**
 * 逐条跑规则引擎（`runRule` 与 antd async-validator 的常用子集语义对齐），
 * 命中的第一条消息写进 `errors[field]`。传 names 只校验这几个字段，对应表单项
 * 的 `trigger: 'blur'`；不传则校验全部渲染字段（提交时）。
 */
async function validateNames(names?: string[]) {
  const targets = names ?? fieldNames;
  let valid = true;
  for (const name of targets) {
    const fieldRules = rules[name] ?? [];
    const value = (formState as Record<string, any>)[name];
    let errorMsg = '';
    for (const rule of fieldRules) {
      const error = await runRule(rule, value, {
        joinLabel: false,
        label: name,
      });
      if (error) {
        errorMsg = error;
        break;
      }
    }
    errors[name] = errorMsg;
    if (errorMsg) valid = false;
  }
  return valid;
}

/** 保持旧 `formRef.validate()` 的"校验不过就抛错"契约，调用点的 try/catch 不用改 */
async function validate(names?: string[]) {
  if (await validateNames(names)) return;
  throw new Error('表单校验未通过');
}

async function handleRegister() {
  try {
    await validate();
    loading.value = true;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    message.success('注册成功，请登录');
    router.push('/login');
  } catch {
    message.error('注册失败，请检查输入');
  } finally {
    loading.value = false;
  }
}

function handleBackToLogin() {
  router.push('/login');
}

function _handleSendCode() {
  if (
    !formState.email ||
    !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(formState.email)
  ) {
    message.error('请输入正确的邮箱');
    return;
  }
  countdown.value = 60;
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
  message.success('验证码已发送');
}
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧面板 -->
    <div :class="leftPanelClassName">
      <!-- 玻璃背景 -->
      <div :class="leftGlassClassName"></div>

      <!-- 装饰性背景 -->
      <div class="absolute inset-0">
        <div
          class="absolute top-1/4 right-1/4 h-[500px] w-[500px] rounded-full blur-[100px]"
          style="
            background: color-mix(
              in srgb,
              var(--ant-color-primary) 15%,
              transparent
            );
          "
        ></div>
        <div
          class="absolute bottom-1/4 left-1/4 h-[400px] w-[400px] rounded-full blur-[80px]"
          style="
            background: color-mix(
              in srgb,
              var(--ant-color-primary) 10%,
              transparent
            );
          "
        ></div>
        <div
          class="absolute top-1/2 right-1/3 h-[300px] w-[300px] rounded-full blur-[60px]"
          style="
            background: color-mix(
              in srgb,
              var(--ant-color-primary) 8%,
              transparent
            );
          "
        ></div>
      </div>

      <!-- 网格背景 -->
      <div
        class="absolute inset-0 bg-[linear-gradient(rgba(100,100,100,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(100,100,100,0.03)_1px,transparent_1px)] bg-[size:48px_48px]"
      ></div>

      <!-- 内容 -->
      <div class="relative z-10 flex flex-col justify-center px-12 xl:px-20">
        <!-- Logo -->
        <div class="mb-12">
          <div
            class="inline-flex items-center gap-3 rounded-xl border border-white/80 bg-white/60 px-5 py-2.5 shadow-lg shadow-slate-900/5 backdrop-blur-md"
          >
            <div
              class="flex h-9 w-9 items-center justify-center rounded-lg shadow-md"
              style="
                background: var(--ant-color-primary);
                box-shadow: 0 4px 12px
                  color-mix(in srgb, var(--ant-color-primary) 30%, transparent);
              "
            >
              <svg
                class="h-5 w-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                />
              </svg>
            </div>
            <span class="text-xl font-semibold text-stone-800">Antdv Next</span>
          </div>
        </div>

        <!-- 标题 -->
        <h1
          class="mb-6 text-4xl leading-tight font-bold text-stone-800 xl:text-5xl"
        >
          开启您的<br />
          <span style="color: var(--ant-color-primary)"> 高效之旅 </span>
        </h1>

        <p class="mb-12 max-w-lg text-lg leading-relaxed text-stone-600">
          注册账户，体验现代化的管理系统解决方案，让工作更高效、更智能。
        </p>

        <!-- 特性列表 -->
        <div class="space-y-5">
          <div class="group flex items-center gap-4">
            <div
              class="flex h-11 w-11 items-center justify-center rounded-lg border border-white/80 bg-white/60 shadow-md shadow-slate-900/5 backdrop-blur-md transition-all duration-300"
            >
              <svg
                class="h-5 w-5"
                style="color: var(--ant-color-primary)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-stone-800">快速注册</h3>
              <p class="text-sm text-stone-500">简单几步即可完成注册</p>
            </div>
          </div>

          <div class="group flex items-center gap-4">
            <div
              class="flex h-11 w-11 items-center justify-center rounded-lg border border-white/80 bg-white/60 shadow-md shadow-slate-900/5 backdrop-blur-md transition-all duration-300"
            >
              <svg
                class="h-5 w-5"
                style="color: var(--ant-color-primary)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-stone-800">安全加密</h3>
              <p class="text-sm text-stone-500">数据安全有保障</p>
            </div>
          </div>

          <div class="group flex items-center gap-4">
            <div
              class="flex h-11 w-11 items-center justify-center rounded-lg border border-white/80 bg-white/60 shadow-md shadow-slate-900/5 backdrop-blur-md transition-all duration-300"
            >
              <svg
                class="h-5 w-5"
                style="color: var(--ant-color-primary)"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-stone-800">免费试用</h3>
              <p class="text-sm text-stone-500">立即体验所有功能</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧注册面板 -->
    <div :class="rightPanelClassName">
      <div :class="glassCardClassName">
        <!-- 标题 -->
        <div class="mb-8 text-center">
          <h2 class="mb-2 text-2xl font-semibold text-stone-800">创建账户</h2>
          <p class="text-stone-500">填写以下信息完成注册</p>
        </div>

        <!-- 表单 -->
        <form class="space-y-6" @submit.prevent="handleRegister">
          <div>
            <div class="relative">
              <Icon
                icon="carbon:user"
                class="text-stone-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <AInput
                v-model="formState.username"
                type="text"
                placeholder="请输入用户名"
                :class="inputClassName"
                class="pl-9"
                @blur="validateNames(['username'])"
              />
            </div>
            <p v-if="errors.username" class="mt-1 text-xs text-red-500">
              {{ errors.username }}
            </p>
          </div>

          <div>
            <div class="relative">
              <Icon
                icon="carbon:email"
                class="text-stone-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <AInput
                v-model="formState.email"
                type="text"
                placeholder="请输入邮箱"
                :class="inputClassName"
                class="pl-9"
                @blur="validateNames(['email'])"
              />
            </div>
            <p v-if="errors.email" class="mt-1 text-xs text-red-500">
              {{ errors.email }}
            </p>
          </div>

          <div>
            <div class="relative">
              <Icon
                icon="carbon:locked"
                class="text-stone-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <AInput
                v-model="formState.password"
                :type="passwordVisible ? 'text' : 'password'"
                placeholder="请输入密码"
                :class="inputClassName"
                class="pr-10 pl-9"
                @blur="validateNames(['password'])"
              />
              <AButton
                type="button"
                variant="ghost"
                size="icon-sm"
                :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
                class="text-stone-400 absolute top-1/2 right-1 -translate-y-1/2"
                @click="passwordVisible = !passwordVisible"
              >
                <Icon
                  :icon="passwordVisible ? 'carbon:view-off' : 'carbon:view'"
                  class="size-4"
                />
              </AButton>
            </div>
            <p v-if="errors.password" class="mt-1 text-xs text-red-500">
              {{ errors.password }}
            </p>
          </div>

          <div>
            <div class="relative">
              <Icon
                icon="carbon:locked"
                class="text-stone-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <AInput
                v-model="formState.confirmPassword"
                :type="confirmPasswordVisible ? 'text' : 'password'"
                placeholder="请确认密码"
                :class="inputClassName"
                class="pr-10 pl-9"
                @blur="validateNames(['confirmPassword'])"
              />
              <AButton
                type="button"
                variant="ghost"
                size="icon-sm"
                :aria-label="
                  confirmPasswordVisible ? '隐藏密码' : '显示密码'
                "
                class="text-stone-400 absolute top-1/2 right-1 -translate-y-1/2"
                @click="confirmPasswordVisible = !confirmPasswordVisible"
              >
                <Icon
                  :icon="
                    confirmPasswordVisible ? 'carbon:view-off' : 'carbon:view'
                  "
                  class="size-4"
                />
              </AButton>
            </div>
            <p v-if="errors.confirmPassword" class="mt-1 text-xs text-red-500">
              {{ errors.confirmPassword }}
            </p>
          </div>

          <div>
            <Label
              class="text-stone-500 cursor-pointer items-start gap-2 font-normal"
            >
              <ACheckbox
                class="mt-0.5"
                :model-value="formState.agreement"
                @update:model-value="
                  (v: any) => (formState.agreement = v === true)
                "
              />
              <span class="flex flex-wrap items-center gap-1">
                我已阅读并同意
                <AButton
                  type="button"
                  variant="link"
                  size="sm"
                  class="h-auto p-0 text-stone-400 hover:text-stone-600"
                >
                  《用户协议》
                </AButton>
                和
                <AButton
                  type="button"
                  variant="link"
                  size="sm"
                  class="h-auto p-0 text-stone-400 hover:text-stone-600"
                >
                  《隐私政策》
                </AButton>
              </span>
            </Label>
          </div>

          <div>
            <AButton
              type="submit"
              :disabled="loading"
              class="w-full h-11 border-0 shadow-lg"
            >
              注册
            </AButton>
          </div>
        </form>

        <!-- 登录链接 -->
        <div class="text-center">
          <span class="text-stone-500">已有账户？</span>
          <AButton
            type="button"
            variant="link"
            class="ml-1 h-auto p-0"
            style="color: var(--ant-color-primary)"
            @click="handleBackToLogin"
          >
            立即登录
          </AButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
[class*='group']:hover .w-11 {
  background-color: color-mix(in srgb, var(--ant-color-primary) 5%, white);
  border-color: color-mix(
    in srgb,
    var(--ant-color-primary) 20%,
    rgb(203 213 225)
  );
}
</style>
