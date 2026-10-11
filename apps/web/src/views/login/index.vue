<script setup lang="ts">
import type { FormInstance } from 'antdv-next';
import type { Rule } from 'antdv-next/dist/form/types';

import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  UserOutlined,
} from '@antdv-next/icons';
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import { HOME_PATH } from '~/config/constants';
import { useUserStore } from '~/stores/modules/user';

import { useLoginStyles } from './composables/useLoginStyles';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const _appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Next Admin';

const {
  containerClassName,
  decorClassName,
  blob1ClassName,
  blob2ClassName,
  blob3ClassName,
  gridClassName,
  brandClassName,
  brandLogoRowClassName,
  brandLogoIconClassName,
  brandLogoTextClassName,
  brandTitleClassName,
  brandDescClassName,
  featureIconClassName,
  featureTitleClassName,
  featureDescClassName,
  panelClassName,
  cardClassName,
  mobileLogoRowClassName,
  segContainerClassName,
  segBtnClassName,
  segActiveClassName,
  segIdleClassName,
  inputClassName,
  submitButtonClassName,
  hintClassName,
} = useLoginStyles();

const FEATURES = [
  {
    icon: 'carbon:flash',
    title: '极速开发',
    desc: '开箱即用的组件与模板',
  },
  {
    icon: 'carbon:document-security',
    title: '安全可靠',
    desc: '完善的权限管理体系',
  },
  {
    icon: 'carbon:settings-adjust',
    title: '灵活配置',
    desc: '高度可定制的主题系统',
  },
];

const formRef = ref<FormInstance>();
const loading = ref(false);
const loginType = ref<'account' | 'mobile'>('account');

const formState = reactive({
  username: '',
  password: '',
  mobile: '',
  code: '',
  remember: true,
});

const accountRules: Record<string, Rule[]> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
};

const mobileRules: Record<string, Rule[]> = {
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位', trigger: 'blur' },
  ],
};

const currentRules = computed(() =>
  loginType.value === 'account' ? accountRules : mobileRules,
);

async function handleLogin() {
  try {
    await formRef.value?.validate();
    loading.value = true;

    const result = await userStore.login(
      formState.username,
      formState.password,
    );

    if (result.success) {
      message.success('登录成功');
      // 优先回到被拦截前的页面；没有则回首页常量。
      // 不能写死 `/dashboard`：那是菜单目录，本身没有页面组件，跳过去是空白内容区。
      const redirect = (route.query.redirect as string) || HOME_PATH;
      router.push(redirect);
    } else {
      message.error(result.message || '登录失败');
    }
  } catch {
    message.error('请检查输入');
  } finally {
    loading.value = false;
  }
}

function handleForgotPassword() {
  message.info('请联系管理员重置密码');
}

function handleSendCode() {
  if (!formState.mobile || !/^1[3-9]\d{9}$/.test(formState.mobile)) {
    message.error('请输入正确的手机号');
    return;
  }
  message.success('验证码已发送');
}
</script>

<template>
  <div :class="containerClassName" data-auth="page">
    <div :class="decorClassName">
      <div :class="blob1ClassName"></div>
      <div :class="blob2ClassName"></div>
      <div :class="blob3ClassName"></div>
      <div :class="gridClassName"></div>
    </div>

    <!-- 品牌区：窄屏整块隐藏，只留表单里的紧凑 logo -->
    <section :class="brandClassName" data-auth="brand">
      <div :class="brandLogoRowClassName">
        <div :class="brandLogoIconClassName">
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            />
          </svg>
        </div>
        <span :class="brandLogoTextClassName">{{ _appTitle }}</span>
      </div>

      <h1 :class="brandTitleClassName">
        构建现代化<br />
        <span class="text-ant-primary">管理系统</span>
      </h1>

      <p :class="brandDescClassName">
        基于 Vue 3 + TypeScript + Ant Design Vue
        构建的企业级后台管理解决方案，助您快速开发高质量管理系统。
      </p>

      <ul class="space-y-4">
        <li v-for="item in FEATURES" :key="item.title" class="group flex items-center gap-3.5">
          <div :class="featureIconClassName">
            <Icon :icon="item.icon" class="h-5 w-5" />
          </div>
          <div>
            <h3 :class="featureTitleClassName">{{ item.title }}</h3>
            <p :class="featureDescClassName">{{ item.desc }}</p>
          </div>
        </li>
      </ul>
    </section>

    <!-- 表单区 -->
    <main :class="panelClassName">
      <div :class="cardClassName" data-auth="card">
        <div :class="mobileLogoRowClassName" data-auth="mobile-brand">
          <div :class="brandLogoIconClassName">
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span :class="brandLogoTextClassName">{{ _appTitle }}</span>
        </div>

        <div :class="segContainerClassName" role="tablist" aria-label="登录方式">
          <button
            type="button"
            role="tab"
            :aria-selected="loginType === 'account'"
            :class="cn(segBtnClassName, loginType === 'account' ? segActiveClassName : segIdleClassName)"
            @click="loginType = 'account'"
          >
            账号登录
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="loginType === 'mobile'"
            :class="cn(segBtnClassName, loginType === 'mobile' ? segActiveClassName : segIdleClassName)"
            @click="loginType = 'mobile'"
          >
            手机登录
          </button>
        </div>

        <a-form
          ref="formRef"
          :model="formState"
          :rules="currentRules"
          layout="vertical"
          @finish="handleLogin"
        >
          <template v-if="loginType === 'account'">
            <a-form-item name="username">
              <a-input
                v-model:value="formState.username"
                size="large"
                placeholder="请输入用户名"
                :class="inputClassName"
                allow-clear
              >
                <template #prefix>
                  <UserOutlined />
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
                  <LockOutlined />
                </template>
              </a-input-password>
            </a-form-item>

            <a-form-item>
              <div class="flex items-center justify-between">
                <a-checkbox v-model:checked="formState.remember">记住我</a-checkbox>
                <a-button type="link" size="small" class="!h-auto !px-0" @click="handleForgotPassword">
                  忘记密码？
                </a-button>
              </div>
            </a-form-item>
          </template>

          <template v-else>
            <a-form-item name="mobile">
              <a-input
                v-model:value="formState.mobile"
                size="large"
                placeholder="请输入手机号"
                :class="inputClassName"
                allow-clear
              >
                <template #prefix>
                  <MobileOutlined />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item name="code">
              <a-input
                v-model:value="formState.code"
                size="large"
                placeholder="请输入验证码"
                :class="inputClassName"
                allow-clear
              >
                <template #prefix>
                  <MailOutlined />
                </template>
                <template #suffix>
                  <a-button
                    type="link"
                    size="small"
                    class="!h-auto !px-0"
                    data-auth="send-code"
                    @click="handleSendCode"
                  >
                    发送验证码
                  </a-button>
                </template>
              </a-input>
            </a-form-item>
          </template>

          <a-form-item class="mt-6">
            <a-button
              type="primary"
              html-type="submit"
              size="large"
              block
              :loading="loading"
              :class="submitButtonClassName"
              data-auth="submit"
            >
              登录
            </a-button>
          </a-form-item>
        </a-form>

        <p :class="hintClassName">演示账号：admin / admin123</p>
      </div>
    </main>
  </div>
</template>
