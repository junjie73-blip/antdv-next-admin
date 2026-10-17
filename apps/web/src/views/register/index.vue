<script setup lang="ts">
import type {
  AuthColorPreset,
  AuthFeatureItem,
  AuthSocialItem,
} from '@antdv/common-ui';
import type { Rule } from '@antdv/form-ui';

import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  AuthColorPresets,
  AuthFormPanel,
  AuthPageLayout,
  AuthSocialLogin,
} from '@antdv/common-ui';
import { runRule } from '@antdv/form-ui';
import {
  LayoutWidgetColorToggle,
  LayoutWidgetLanguageToggle,
} from '@antdv/layouts';
import { message } from '@antdv/popup-ui';
import {
  Button as AButton,
  Checkbox as ACheckbox,
  Input as AInput,
  Label,
} from '@antdv/shadcn-ui';
import { THEME_PRESETS } from '@antdv/shared/constants';
import { useAppStore } from '@antdv/stores';
import { Icon } from '@iconify/vue';
import { useLocale } from '~/composables/web/useLocale';
import logoUrl from '~/assets/images/logo.png';

const router = useRouter();
const appStore = useAppStore();
const { t } = useLocale();

const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Admin';

/* ============================================================
 * 右上角工具条：与登录页同一套外壳
 * ============================================================ */
const colorPresets: AuthColorPreset[] = THEME_PRESETS.map((preset) => ({
  color: preset.color,
  key: preset.key,
}));
const currentColor = computed(() => appStore.primaryColor);

function pickColor(preset: AuthColorPreset) {
  appStore.updateSetting({ primaryColor: preset.color });
}

/** 品牌栏底部的三条产品特性，与登录页同一份文案 */
const features = computed<AuthFeatureItem[]>(() => [
  { icon: 'carbon:flash', label: t('auth.pointPerformance') },
  { icon: 'carbon:color-palette', label: t('auth.pointDesign') },
  { icon: 'carbon:security', label: t('auth.pointSecurity') },
]);

/* ============================================================
 * 表单
 * ============================================================ */
const loading = ref(false);
const passwordVisible = ref(false);
const confirmPasswordVisible = ref(false);

/** 每个字段的错误文案，`''` 表示没有错误（原来由 antd FormItem 自己持有） */
const errors = reactive<Record<string, string>>({});

const formState = reactive({
  agreement: false,
  confirmPassword: '',
  email: '',
  password: '',
  username: '',
});

const rules = computed<Record<string, Rule[]>>(() => ({
  confirmPassword: [
    {
      message: t('register.confirmPasswordPlaceholder'),
      required: true,
      trigger: 'blur',
    },
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string) => {
        if (value && value !== formState.password) {
          return Promise.reject(new Error(t('register.confirmPasswordSame')));
        }
        return Promise.resolve();
      },
    },
  ],
  email: [
    { message: t('register.emailPlaceholder'), required: true, trigger: 'blur' },
    {
      message: t('register.emailInvalid'),
      pattern: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u,
      trigger: 'blur',
    },
  ],
  password: [
    {
      message: t('register.passwordPlaceholder'),
      required: true,
      trigger: 'blur',
    },
    { message: t('login.passwordMin'), min: 6, trigger: 'blur' },
  ],
  username: [
    {
      message: t('register.usernamePlaceholder'),
      required: true,
      trigger: 'blur',
    },
    {
      max: 20,
      message: t('register.usernameLength'),
      min: 3,
      trigger: 'blur',
    },
    {
      message: t('register.usernamePattern'),
      pattern: /^\w+$/u,
      trigger: 'blur',
    },
  ],
}));

/** 页面上真实渲染出来的字段，顺序与 DOM 一致 */
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
    const fieldRules = rules.value[name] ?? [];
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
    if (!formState.agreement) {
      errors.agreement = t('register.agreementRequired');
      throw new Error(t('register.agreementRequired'));
    }
    errors.agreement = '';
    loading.value = true;

    await new Promise((resolve) => setTimeout(resolve, 1000));

    message.success(t('register.success'));
    router.push('/login');
  } catch {
    message.error(t('login.checkInput'));
  } finally {
    loading.value = false;
  }
}

/* ============================================================
 * 底部：第三方入口与登录页保持一致的版式
 * ============================================================ */
const socialItems: AuthSocialItem[] = [
  { icon: 'mdi:github', label: 'GitHub', value: 'github' },
  { icon: 'mdi:wechat', label: 'WeChat', value: 'wechat' },
  { icon: 'mdi:qq-chat', label: 'QQ', value: 'qq' },
  { icon: 'mdi:dingtalk', label: 'DingTalk', value: 'dingtalk' },
];

function handleSocial(item: AuthSocialItem) {
  message.info(t('login.socialUnreleased', { name: item.label }));
}
</script>

<template>
  <AuthPageLayout
    :app-logo="logoUrl"
    :app-name="appTitle"
    :copyright="`Antdv Admin ${new Date().getFullYear()}`"
    :features="features"
    :page-description="t('auth.sloganDesc')"
    :page-title="t('auth.sloganTitle')"
  >
    <template #toolbar>
      <AuthColorPresets
        :current="currentColor"
        :label="t('auth.themeColor')"
        :presets="colorPresets"
        @select="pickColor"
      />
      <LayoutWidgetColorToggle />
      <LayoutWidgetLanguageToggle />
    </template>

    <AuthFormPanel
      :description="t('register.welcomeDesc')"
      :title="t('register.title')"
    >
      <form @submit.prevent="handleRegister">
        <div class="space-y-4" data-auth="fields">
          <div>
            <AInput
              v-model="formState.username"
              :placeholder="t('register.usernamePlaceholder')"
              class="h-10"
              data-auth="username"
              type="text"
              @blur="validateNames(['username'])"
            />
            <p
              v-if="errors.username"
              class="text-destructive mt-1.5 text-xs"
              data-auth="error-username"
            >
              {{ errors.username }}
            </p>
          </div>

          <div>
            <AInput
              v-model="formState.email"
              :placeholder="t('register.emailPlaceholder')"
              class="h-10"
              data-auth="email"
              type="text"
              @blur="validateNames(['email'])"
            />
            <p
              v-if="errors.email"
              class="text-destructive mt-1.5 text-xs"
              data-auth="error-email"
            >
              {{ errors.email }}
            </p>
          </div>

          <div>
            <div class="relative">
              <AInput
                v-model="formState.password"
                :placeholder="t('register.passwordPlaceholder')"
                :type="passwordVisible ? 'text' : 'password'"
                class="h-10 pr-10"
                data-auth="password"
                @blur="validateNames(['password'])"
              />
              <button
                :aria-label="passwordVisible ? t('login.hidePassword') : t('login.showPassword')"
                class="text-foreground/50 hover:text-foreground absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center"
                type="button"
                @click="passwordVisible = !passwordVisible"
              >
                <Icon
                  :icon="passwordVisible ? 'carbon:view-off' : 'carbon:view'"
                  class="size-4"
                />
              </button>
            </div>
            <p
              v-if="errors.password"
              class="text-destructive mt-1.5 text-xs"
              data-auth="error-password"
            >
              {{ errors.password }}
            </p>
          </div>

          <div>
            <div class="relative">
              <AInput
                v-model="formState.confirmPassword"
                :placeholder="t('register.confirmPasswordPlaceholder')"
                :type="confirmPasswordVisible ? 'text' : 'password'"
                class="h-10 pr-10"
                data-auth="confirm-password"
                @blur="validateNames(['confirmPassword'])"
              />
              <button
                :aria-label="confirmPasswordVisible ? t('login.hidePassword') : t('login.showPassword')"
                class="text-foreground/50 hover:text-foreground absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center"
                type="button"
                @click="confirmPasswordVisible = !confirmPasswordVisible"
              >
                <Icon
                  :icon="
                    confirmPasswordVisible ? 'carbon:view-off' : 'carbon:view'
                  "
                  class="size-4"
                />
              </button>
            </div>
            <p
              v-if="errors.confirmPassword"
              class="text-destructive mt-1.5 text-xs"
              data-auth="error-confirm-password"
            >
              {{ errors.confirmPassword }}
            </p>
          </div>

          <div>
            <Label class="cursor-pointer items-start gap-2 font-normal">
              <ACheckbox
                class="mt-0.5"
                :model-value="formState.agreement"
                data-auth="agreement"
                @update:model-value="
                  (v: any) => (formState.agreement = v === true)
                "
              />
              <span class="text-sm">{{ t('register.agreement') }}</span>
            </Label>
            <p
              v-if="errors.agreement"
              class="text-destructive mt-1.5 text-xs"
              data-auth="error-agreement"
            >
              {{ errors.agreement }}
            </p>
          </div>
        </div>

        <div class="mb-6 mt-6">
          <AButton
            :disabled="loading"
            class="w-full"
            data-auth="submit"
            type="submit"
          >
            {{ t('register.submit') }}
          </AButton>
        </div>
      </form>

      <AuthSocialLogin
        :divider-text="t('login.otherLoginMethods')"
        :items="socialItems"
        @select="handleSocial"
      />

      <div class="mt-3 text-center text-sm">
        <span class="text-muted-foreground">{{ t('register.hasAccount') }}</span>
        <AButton
          class="h-auto px-0 text-sm"
          data-auth="to-login"
          type="button"
          variant="link"
          @click="router.push('/login')"
        >
          {{ t('register.goLogin') }}
        </AButton>
      </div>
    </AuthFormPanel>
  </AuthPageLayout>
</template>
