<script setup lang="ts">
import type {
  AuthColorPreset,
  AuthFeatureItem,
  AuthSocialItem,
} from '@antdv/common-ui';
import type { Rule } from '@antdv/form-ui';

import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

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
import { useAppStore, useUserStore } from '@antdv/stores';
import { Icon } from '@iconify/vue';
import { useLocale } from '~/composables/web/useLocale';
import { HOME_PATH } from '~/config/constants';
import logoUrl from '~/assets/images/logo.png';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const userStore = useUserStore();
const { t } = useLocale();

const appTitle = import.meta.env.VITE_APP_TITLE || 'Antdv Admin';

/* ============================================================
 * 右上角工具条：主题色 / 明暗 / 语言
 * ============================================================ */
const colorPresets: AuthColorPreset[] = THEME_PRESETS.map((preset) => ({
  color: preset.color,
  key: preset.key,
}));
const currentColor = computed(() => appStore.primaryColor);

/** 写偏好是唯一出口：`data-theme` 档位、`--app-primary`、首屏快照都由偏好包串起来 */
function pickColor(preset: AuthColorPreset) {
  appStore.updateSetting({ primaryColor: preset.color });
}

/** 品牌栏底部的三条产品特性，文案走 i18n，图标由外壳画成主色胶囊 */
const features = computed<AuthFeatureItem[]>(() => [
  { icon: 'carbon:flash', label: t('auth.pointPerformance') },
  { icon: 'carbon:color-palette', label: t('auth.pointDesign') },
  { icon: 'carbon:security', label: t('auth.pointSecurity') },
]);

/* ============================================================
 * 表单
 * ============================================================ */
const loading = ref(false);
const loginType = ref<'account' | 'mobile'>('account');
const passwordVisible = ref(false);

/** 每个字段的错误文案，`''` 表示没有错误（原来由 antd FormItem 自己持有） */
const errors = reactive<Record<string, string>>({});

const formState = reactive({
  code: '',
  mobile: '',
  password: '',
  remember: true,
  username: '',
});

const accountRules = computed<Record<string, Rule[]>>(() => ({
  password: [
    { message: t('login.passwordPlaceholder'), required: true, trigger: 'blur' },
    { message: t('login.passwordMin'), min: 6, trigger: 'blur' },
  ],
  username: [
    { message: t('login.usernamePlaceholder'), required: true, trigger: 'blur' },
  ],
}));

const mobileRules = computed<Record<string, Rule[]>>(() => ({
  code: [
    { message: t('login.codePlaceholder'), required: true, trigger: 'blur' },
    { len: 6, message: t('login.codeLength'), trigger: 'blur' },
  ],
  mobile: [
    { message: t('login.mobilePlaceholder'), required: true, trigger: 'blur' },
    { message: t('login.mobileInvalid'), pattern: /^1[3-9]\d{9}$/u, trigger: 'blur' },
  ],
}));

const currentRules = computed(
  () => (loginType.value === 'account' ? accountRules.value : mobileRules.value),
);

/**
 * 逐条跑规则引擎（`runRule` 与 antd async-validator 的常用子集语义对齐），
 * 命中的第一条消息写进 `errors[field]`。传 names 只校验这几个字段（`trigger: 'blur'`），
 * 不传则校验当前登录方式下的全部字段（提交时）。
 */
async function validateNames(names?: string[]) {
  const targets = names ?? Object.keys(currentRules.value);
  let valid = true;
  for (const name of targets) {
    const rules = currentRules.value[name] ?? [];
    const value = (formState as Record<string, any>)[name];
    let errorMsg = '';
    for (const rule of rules) {
      const error = await runRule(rule, value, { joinLabel: false, label: name });
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

/** 切换登录方式时清掉另一种方式留下的红字 */
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
      message.success(t('login.loginSuccess'));
      // 优先回到被拦截前的页面；没有则回首页常量。
      // 不能写死 `/dashboard`：那是菜单目录，本身没有页面组件，跳过去是空白内容区。
      const redirect = (route.query.redirect as string) || HOME_PATH;
      router.push(redirect);
    } else {
      message.error(result.message || t('login.loginFailed'));
    }
  } catch {
    message.error(t('login.checkInput'));
  } finally {
    loading.value = false;
  }
}

function handleForgotPassword() {
  message.info(t('login.forgotTip'));
}

function handleSendCode() {
  if (!/^1[3-9]\d{9}$/u.test(formState.mobile)) {
    message.error(t('login.mobileInvalid'));
    return;
  }
  message.success(t('login.codeSent'));
}

/* ============================================================
 * 底部：切换登录方式 / 第三方 / 注册入口
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
      :badge="loginType === 'account' ? t('login.accountLogin') : t('login.mobileLogin')"
      :description="t('login.welcomeDesc')"
      :title="t('login.welcome')"
    >
      <form @submit.prevent="handleLogin">
        <div class="space-y-4" data-auth="fields">
          <template v-if="loginType === 'account'">
            <div class="relative">
              <Icon
                class="text-foreground/40 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                icon="carbon:user"
              />
              <AInput
                v-model="formState.username"
                :placeholder="t('login.usernamePlaceholder')"
                class="h-10 pl-9"
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

            <div class="relative">
              <Icon
                class="text-foreground/40 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                icon="carbon:password"
              />
              <div class="relative">
                <AInput
                  v-model="formState.password"
                  :placeholder="t('login.passwordPlaceholder')"
                  :type="passwordVisible ? 'text' : 'password'"
                  class="h-10 pr-10 pl-9"
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
          </template>

          <template v-else>
            <div class="relative">
              <Icon
                class="text-foreground/40 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                icon="carbon:mobile"
              />
              <AInput
                v-model="formState.mobile"
                :placeholder="t('login.mobilePlaceholder')"
                class="h-10 pl-9"
                data-auth="mobile"
                type="text"
                @blur="validateNames(['mobile'])"
              />
              <p
                v-if="errors.mobile"
                class="text-destructive mt-1.5 text-xs"
                data-auth="error-mobile"
              >
                {{ errors.mobile }}
              </p>
            </div>

            <div class="relative">
              <Icon
                class="text-foreground/40 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                icon="carbon:email"
              />
              <div class="relative">
                <AInput
                  v-model="formState.code"
                  :placeholder="t('login.codePlaceholder')"
                  class="h-10 pr-24 pl-9"
                  data-auth="code"
                  type="text"
                  @blur="validateNames(['code'])"
                />
                <AButton
                  class="absolute top-1/2 right-1 h-auto px-2 py-1 -translate-y-1/2 text-sm"
                  data-auth="send-code"
                  type="button"
                  variant="link"
                  @click="handleSendCode"
                >
                  {{ t('login.sendCode') }}
                </AButton>
              </div>
              <p
                v-if="errors.code"
                class="text-destructive mt-1.5 text-xs"
                data-auth="error-code"
              >
                {{ errors.code }}
              </p>
            </div>
          </template>
        </div>

        <!-- 记住账号 / 忘记密码：左右两端对齐，整行与按钮之间留参考实现的 24px -->
        <div
          v-if="loginType === 'account'"
          class="mb-6 mt-6 flex items-center justify-between"
        >
          <Label class="cursor-pointer items-center gap-2 font-normal">
            <ACheckbox
              :model-value="formState.remember"
              @update:model-value="(v: any) => (formState.remember = v === true)"
            />
            <span class="text-sm">{{ t('login.rememberMe') }}</span>
          </Label>
          <AButton
            class="h-auto px-0 text-sm"
            data-auth="forgot"
            type="button"
            variant="link"
            @click="handleForgotPassword"
          >
            {{ t('login.forgotPassword') }}
          </AButton>
        </div>
        <div v-else class="mb-6 mt-6"></div>

        <AButton
          :disabled="loading"
          class="w-full"
          data-auth="submit"
          type="submit"
        >
          {{ t('login.loginBtn') }}
        </AButton>
      </form>

      <!-- 登录方式切换：参考实现放在主按钮之下，两个等宽描边按钮两端对齐 -->
      <div class="mb-2 mt-4 flex items-center justify-between gap-4">
        <AButton
          :variant="loginType === 'account' ? 'default' : 'outline'"
          class="flex-1"
          data-auth="mode-account"
          type="button"
          @click="loginType = 'account'"
        >
          {{ t('login.accountLogin') }}
        </AButton>
        <AButton
          :variant="loginType === 'mobile' ? 'default' : 'outline'"
          class="flex-1"
          data-auth="mode-mobile"
          type="button"
          @click="loginType = 'mobile'"
        >
          {{ t('login.mobileLogin') }}
        </AButton>
      </div>

      <AuthSocialLogin
        :divider-text="t('login.otherLoginMethods')"
        :items="socialItems"
        @select="handleSocial"
      />

      <div class="mt-3 text-center text-sm">
        <span class="text-muted-foreground">{{ t('login.noAccount') }}</span>
        <AButton
          class="h-auto px-0 text-sm"
          data-auth="to-register"
          type="button"
          variant="link"
          @click="router.push('/register')"
        >
          {{ t('login.createAccount') }}
        </AButton>
      </div>

      <p
        class="mt-3 text-center text-xs leading-relaxed text-muted-foreground"
        data-auth="hint"
      >
        {{ t('login.demoHint') }}
      </p>
    </AuthFormPanel>
  </AuthPageLayout>
</template>
