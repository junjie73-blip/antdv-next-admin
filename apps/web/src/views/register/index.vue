<script setup lang="ts">
import type { FormInstance } from 'antdv-next';
import type { Rule } from 'antdv-next/dist/form/types';

import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { LockOutlined, MailOutlined, UserOutlined } from '@antdv-next/icons';
import { cn } from '@antdv/shared/cn';

const router = useRouter();

const formRef = ref<FormInstance>();
const loading = ref(false);
const countdown = ref(0);

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
    '[&_.ant-input]:bg-white/80!',
    '[&_.ant-input]:border-slate-200!',
    '[&_.ant-input]:text-stone-700!',
    '[&_.ant-input]:placeholder:text-stone-400',
    '[&_.ant-input]:hover:border-slate-400!',
    '[&_.ant-input]:focus:border-(--ant-color-primary)!',
    '[&_.ant-input]:focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--ant-color-primary)_20%,transparent)]!',
    '[&_.ant-input-affix-wrapper]:bg-white/80!',
    '[&_.ant-input-affix-wrapper]:border-slate-200!',
    '[&_.ant-input-affix-wrapper]:hover:border-slate-400!',
    '[&_.ant-input-affix-wrapper-focused]:border-(--ant-color-primary)!',
    '[&_.ant-input-affix-wrapper-focused]:shadow-[0_0_0_2px_color-mix(in_srgb,var(--ant-color-primary)_20%,transparent)]!',
    '[&_.ant-input-affix-wrapper_input]:bg-transparent!',
    '[&_.ant-input-affix-wrapper_input]:text-stone-700!',
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

async function handleRegister() {
  try {
    await formRef.value?.validate();
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
        <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
          @finish="handleRegister"
        >
          <a-form-item name="username">
            <a-input
              v-model:value="formState.username"
              size="large"
              placeholder="请输入用户名"
              :class="inputClassName"
              allow-clear
            >
              <template #prefix>
                <UserOutlined class="text-stone-400" />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item name="email">
            <a-input
              v-model:value="formState.email"
              size="large"
              placeholder="请输入邮箱"
              :class="inputClassName"
              allow-clear
            >
              <template #prefix>
                <MailOutlined class="text-stone-400" />
              </template>
            </a-input>
          </a-form-item>

          <a-form-item name="password">
            <a-input-password
              v-model:value="formState.password"
              size="large"
              placeholder="请输入密码"
              :class="inputClassName"
              allow-clear
            >
              <template #prefix>
                <LockOutlined class="text-stone-400" />
              </template>
            </a-input-password>
          </a-form-item>

          <a-form-item name="confirmPassword">
            <a-input-password
              v-model:value="formState.confirmPassword"
              size="large"
              placeholder="请确认密码"
              :class="inputClassName"
              allow-clear
            >
              <template #prefix>
                <LockOutlined class="text-stone-400" />
              </template>
            </a-input-password>
          </a-form-item>

          <a-form-item name="agreement">
            <a-checkbox
              v-model:checked="formState.agreement"
              class="[&_.ant-checkbox-inner]:!border-slate-300 [&_.ant-checkbox-inner]:!bg-white [&_.ant-checkbox-wrapper]:!text-stone-500"
            >
              我已阅读并同意
              <a-button
                type="link"
                size="small"
                class="!p-0 !text-stone-400 hover:!text-stone-600"
              >
                《用户协议》
              </a-button>
              和
              <a-button
                type="link"
                size="small"
                class="!p-0 !text-stone-400 hover:!text-stone-600"
              >
                《隐私政策》
              </a-button>
            </a-checkbox>
          </a-form-item>

          <a-form-item class="mt-8">
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              block
              :loading="loading"
              class="!h-11 !border-0 !shadow-lg"
            >
              注册
            </a-button>
          </a-form-item>
        </a-form>

        <!-- 登录链接 -->
        <div class="text-center">
          <span class="text-stone-500">已有账户？</span>
          <a-button
            type="link"
            class="!ml-1 !p-0"
            style="color: var(--ant-color-primary)"
            @click="handleBackToLogin"
          >
            立即登录
          </a-button>
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
