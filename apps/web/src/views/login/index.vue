<script setup lang="ts">
import type { Rule } from '@antdv/form-ui';

import { computed, reactive, ref, watch } from 'vue';
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

const loading = ref(false);
const loginType = ref<'account' | 'mobile'>('account');
const passwordVisible = ref(false);

/** 每个字段的错误文案，`''` 表示没有错误（原来由 antd FormItem 自己持有） */
const errors = reactive<Record<string, string>>({});

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

/**
 * 逐条跑规则引擎（`runRule` 与 antd async-validator 的常用子集语义对齐），
 * 命中的第一条消息写进 `errors[field]`。传 names 只校验这几个字段，对应表单项
 * 的 `trigger: 'blur'`；不传则校验当前登录方式下的全部字段（提交时）。
 */
async function validateNames(names?: string[]) {
  const targets = names ?? Object.keys(currentRules.value);
  let valid = true;
  for (const name of targets) {
    const rules = currentRules.value[name] ?? [];
    const value = (formState as Record<string, any>)[name];
    let errorMsg = '';
    for (const rule of rules) {
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

/** 切换登录方式时清掉另一种方式留下的红字：旧版 FormItem 卸载时会自动清，这里等价实现 */
watch(loginType, () => {
  for (const name of Object.keys(errors)) errors[name] = '';
});

async function handleLogin() {
  try {
    await validate();
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
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
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
        <li
          v-for="item in FEATURES"
          :key="item.title"
          class="group flex items-center gap-3.5"
        >
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
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              />
            </svg>
          </div>
          <span :class="brandLogoTextClassName">{{ _appTitle }}</span>
        </div>

        <div
          :class="segContainerClassName"
          role="tablist"
          aria-label="登录方式"
        >
          <button
            type="button"
            role="tab"
            :aria-selected="loginType === 'account'"
            :class="
              cn(
                segBtnClassName,
                loginType === 'account' ? segActiveClassName : segIdleClassName,
              )
            "
            @click="loginType = 'account'"
          >
            账号登录
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="loginType === 'mobile'"
            :class="
              cn(
                segBtnClassName,
                loginType === 'mobile' ? segActiveClassName : segIdleClassName,
              )
            "
            @click="loginType = 'mobile'"
          >
            手机登录
          </button>
        </div>

        <form class="space-y-6" @submit.prevent="handleLogin">
          <template v-if="loginType === 'account'">
            <div>
              <div class="relative">
                <Icon
                  icon="carbon:user"
                  class="text-slate-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <AInput
                  v-model="formState.username"
                  type="text"
                  placeholder="请输入用户名"
                  :class="inputClassName"
                  class="h-11 rounded-lg pl-9"
                  @blur="validateNames(['username'])"
                />
              </div>
              <p v-if="errors.username" class="text-red-500 mt-1 text-xs">
                {{ errors.username }}
              </p>
            </div>

            <div>
              <div class="relative">
                <Icon
                  icon="carbon:locked"
                  class="text-slate-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <AInput
                  v-model="formState.password"
                  :type="passwordVisible ? 'text' : 'password'"
                  placeholder="请输入密码"
                  :class="inputClassName"
                  class="h-11 rounded-lg pr-10 pl-9"
                  @blur="validateNames(['password'])"
                />
                <AButton
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
                  class="text-slate-400 absolute top-1/2 right-1 -translate-y-1/2"
                  @click="passwordVisible = !passwordVisible"
                >
                  <Icon
                    :icon="passwordVisible ? 'carbon:view-off' : 'carbon:view'"
                    class="size-4"
                  />
                </AButton>
              </div>
              <p v-if="errors.password" class="text-red-500 mt-1 text-xs">
                {{ errors.password }}
              </p>
            </div>

            <div class="flex items-center justify-between">
              <Label class="text-slate-600 cursor-pointer gap-2 font-normal dark:text-slate-300">
                <ACheckbox
                  :model-value="formState.remember"
                  @update:model-value="
                    (v: any) => (formState.remember = v === true)
                  "
                />
                记住我
              </Label>
              <AButton
                type="button"
                variant="link"
                size="sm"
                class="h-auto px-0"
                @click="handleForgotPassword"
              >
                忘记密码？
              </AButton>
            </div>
          </template>

          <template v-else>
            <div>
              <div class="relative">
                <Icon
                  icon="carbon:mobile"
                  class="text-slate-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <AInput
                  v-model="formState.mobile"
                  type="text"
                  placeholder="请输入手机号"
                  :class="inputClassName"
                  class="h-11 rounded-lg pl-9"
                  @blur="validateNames(['mobile'])"
                />
              </div>
              <p v-if="errors.mobile" class="text-red-500 mt-1 text-xs">
                {{ errors.mobile }}
              </p>
            </div>

            <div>
              <div class="relative">
                <Icon
                  icon="carbon:email"
                  class="text-slate-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                />
                <AInput
                  v-model="formState.code"
                  type="text"
                  placeholder="请输入验证码"
                  :class="inputClassName"
                  class="h-11 rounded-lg pr-24 pl-9"
                  @blur="validateNames(['code'])"
                />
                <AButton
                  type="button"
                  variant="link"
                  size="sm"
                  class="absolute top-1/2 right-2 h-auto px-1 -translate-y-1/2"
                  data-auth="send-code"
                  @click="handleSendCode"
                >
                  发送验证码
                </AButton>
              </div>
              <p v-if="errors.code" class="text-red-500 mt-1 text-xs">
                {{ errors.code }}
              </p>
            </div>
          </template>

          <div>
            <AButton
              type="submit"
              :disabled="loading"
              :class="submitButtonClassName"
              class="w-full"
              data-auth="submit"
            >
              登录
            </AButton>
          </div>
        </form>

        <p :class="hintClassName">
          演示账号：admin / admin123（全部页面）· custom /
          custom123（只给一部分页面，越界跳 403）
        </p>
      </div>
    </main>
  </div>
</template>
