<script setup lang="ts">
import { LockOutlined, ReloadOutlined, SafetyOutlined, UserOutlined } from "@antdv-next/icons";
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useLoginStyles } from "./composables/useLoginStyles";
import ForgotPasswordModal from "./ForgotPasswordModal.vue";

import type { FormInstance } from "antdv-next";
import type { Rule } from "antdv-next/dist/form/types";

import { getAuthTenantList, getCaptcha } from "~/api/auth";
import logoIconUrl from "~/assets/images/logo.png";
import { useAppStore } from "~/stores";
import { useUserStore } from "~/stores/modules/user";
import { cache } from "~/utils";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const appTitle = import.meta.env.VITE_APP_TITLE || "Antdv Next Admin";
const appStore = useAppStore();
const {
  containerClassName,
  bgLayerClassName,
  blob1ClassName,
  blob2ClassName,
  blob3ClassName,
  blob4ClassName,
  gridClassName,
  cardClassName,
  brandPanelClassName,
  brandGlowClassName,
  brandGridClassName,
  brandContentClassName,
  formPanelClassName,
  formWrapClassName,
  inputClassName,
  brandLogoClassName,
  brandLogoIconClassName,
  brandFeatureClassName,
  brandPreviewClassName,
} = useLoginStyles();

const formRef = ref<FormInstance>();
const loading = ref(false);
const DEVICE_ID_KEY = "device_id";

const formState = reactive<{
  tenantCode: string | undefined;
  username: string;
  password: string;
  remember: boolean;
  captchaCode: string | undefined;
}>({
  tenantCode: undefined,
  username: "",
  password: "",
  remember: true,
  captchaCode: "",
});

// ============================================================
// 租户下拉
// ============================================================
interface TenantOption {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
}

const tenantOptions = ref<TenantOption[]>([]);
const tenantLoading = ref(false);

async function loadTenants() {
  tenantLoading.value = true;
  try {
    tenantOptions.value = await getAuthTenantList();
  } catch (err) {
    message.error("加载租户列表失败，请刷新重试");
    console.error("[login] loadTenants failed", err);
  } finally {
    tenantLoading.value = false;
  }
}

// ============================================================
// 图形验证码
// ============================================================
const captchaId = ref("");
const captchaSvg = ref("");
const captchaLoading = ref(false);

async function refreshCaptcha() {
  captchaLoading.value = true;
  try {
    const data = await getCaptcha();
    captchaId.value = data.captchaId;
    captchaSvg.value = data.svg;
    formState.captchaCode = undefined;
  } catch (e) {
    console.log(e);
    message.error("验证码加载失败");
  } finally {
    captchaLoading.value = false;
  }
}

// ============================================================
// 表单校验
// ============================================================
const rules: Record<string, Rule[]> = {
  tenantCode: [{ required: true, message: "请选择租户", trigger: "change" }],
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码至少6位", trigger: "blur" },
  ],
  captchaCode: [
    { required: true, message: "请输入验证码", trigger: "blur" },
    { len: 4, message: "验证码为 4 位", trigger: "blur" },
  ],
};

// ============================================================
// 登录
// ============================================================
async function handleLogin() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  loading.value = true;
  try {
    const result = await userStore.login(
      formState.username,
      formState.password,
      formState.tenantCode!,
      {
        captchaId: captchaId.value,
        captchaCode: formState.captchaCode,
        deviceId: await getDeviceId(),
      },
    );

    if (result.success) {
      cache.setItem("last_tenant_code", formState.tenantCode);
      message.success("登录成功");
      const redirect = (route.query.redirect as string) || "/dashboard";
      router.push(redirect);
    } else {
      message.error(result.message || "登录失败");
      await refreshCaptcha();
    }
  } finally {
    loading.value = false;
  }
}

// ============================================================
// 忘记密码
// ============================================================
const forgotModalOpen = ref(false);
const loginTenantCode = ref("");

function handleRegister() {
  router.push("/register");
}

function handleForgotPassword() {
  forgotModalOpen.value = true;
}

function handleResetSuccess(payload: { tenantCode: string; username: string }) {
  loginTenantCode.value = payload.tenantCode;
  formState.username = payload.username;
  formState.password = "";
  formState.tenantCode = payload.tenantCode;
}

// ============================================================
// 第三方登录
// ============================================================
const socialLogins = [
  {
    key: "wechat",
    label: "微信",
    icon: "ri:wechat-fill",
    color: "#07C160",
    onClick: () => message.info("微信登录即将上线"),
  },
  {
    key: "github",
    label: "GitHub",
    icon: "mdi:github",
    color: "#24292f",
    onClick: () => message.info("GitHub 登录即将上线"),
  },
  {
    key: "google",
    label: "Google",
    icon: "flat-color-icons:google",
    color: "#4285F4",
    onClick: () => message.info("Google 登录即将上线"),
  },
  {
    key: "gitee",
    label: "Gitee",
    icon: "simple-icons:gitee",
    color: "#C71D23",
    onClick: () => message.info("Gitee 登录即将上线"),
  },
];

function handleSocialLogin(item: (typeof socialLogins)[number]) {
  item.onClick();
}

const year = computed(() => new Date().getFullYear());

async function getDeviceId(): Promise<string | undefined> {
  let id = (await cache.getItem(DEVICE_ID_KEY)) as string;
  if (!id) {
    id = `${import.meta.env.MODE}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cache.setItem(DEVICE_ID_KEY, id);
  }
  return id as string;
}

// ============================================================
// 初始化
// ============================================================
onMounted(async () => {
  const lastTenant = cache.getItem("last_tenant_code");
  if (lastTenant) {
    formState.tenantCode = lastTenant as string;
  }
  await Promise.all([loadTenants(), refreshCaptcha()]);
});
</script>

<template>
  <div :class="containerClassName">
    <!-- ==================== 液态玻璃背景层 ==================== -->
    <div :class="bgLayerClassName" aria-hidden="true">
      <div :class="blob1ClassName" />
      <div :class="blob2ClassName" />
      <div :class="blob3ClassName" />
      <div :class="blob4ClassName" />
      <div :class="gridClassName" />
    </div>

    <!-- ==================== 主卡片 ==================== -->
    <a-border-beam :count="4" :color="appStore.appSetting.primaryColor">
      <div class="relative rounded-2xl">
        <div :class="cardClassName">
          <!-- ============ 左侧品牌面板 ============ -->
          <div :class="brandPanelClassName">
            <div :class="brandGlowClassName" />
            <div :class="brandGridClassName" />

            <div :class="brandContentClassName">
              <!-- Logo -->
              <div :class="brandLogoClassName">
                <div :class="brandLogoIconClassName">
                  <img :src="logoIconUrl" :alt="appTitle" class="w-full h-full object-contain" />
                </div>
                <span class="text-sm font-semibold tracking-wide">{{ appTitle }}</span>
              </div>

              <!-- 标题 -->
              <div class="mt-10">
                <h1 class="text-3xl font-bold leading-snug tracking-tight">
                  欢迎登录<br />
                  管理平台
                </h1>
                <p class="mt-4 text-sm text-white/80 leading-relaxed">或许我们只是差点运气</p>
              </div>

              <!-- 特性胶囊 -->
              <div class="mt-8 flex flex-wrap gap-2">
                <span :class="brandFeatureClassName">
                  <Icon icon="carbon:flash" class="w-3.5 h-3.5" />
                  极速开发体验
                </span>
                <span :class="brandFeatureClassName">
                  <Icon icon="carbon:color-palette" class="w-3.5 h-3.5" />
                  现代化 UI 设计
                </span>
                <span :class="brandFeatureClassName">
                  <Icon icon="carbon:security" class="w-3.5 h-3.5" />
                  企业级安全
                </span>
              </div>

              <!-- 预览图（装饰） -->
              <div class="mt-12">
                <div :class="brandPreviewClassName">
                  <div class="flex items-center gap-1.5 mb-2.5">
                    <div class="w-2 h-2 rounded-full bg-white/40" />
                    <div class="w-2 h-2 rounded-full bg-white/30" />
                    <div class="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                  <div class="space-y-1.5">
                    <div class="h-1.5 rounded-full bg-white/20 w-3/4" />
                    <div class="h-1.5 rounded-full bg-white/15 w-1/2" />
                    <div class="h-1.5 rounded-full bg-white/10 w-2/3" />
                  </div>
                </div>
                <div class="mt-3 text-[11px] text-white/60">© {{ year }} {{ appTitle }} Team</div>
              </div>
            </div>
          </div>

          <!-- ============ 右侧表单面板 ============ -->
          <div :class="formPanelClassName">
            <div :class="formWrapClassName">
              <!-- 移动端 Logo -->
              <div class="lg:hidden mb-8 flex items-center justify-center gap-2.5">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style="background: var(--ant-color-primary)"
                >
                  <img :src="logoIconUrl" :alt="appTitle" class="w-6 h-6 object-contain" />
                </div>
                <span class="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {{ appTitle }}
                </span>
              </div>

              <!-- 标题 -->
              <div class="text-center mb-8">
                <span
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/80 dark:bg-blue-500/10 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-100/60 dark:border-blue-500/20 backdrop-blur-sm"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  账号密码登录
                </span>
                <h2
                  class="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight"
                >
                  登录
                </h2>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  请输入用户名 · 请输入密码
                </p>
              </div>

              <!-- 表单 -->
              <a-form
                ref="formRef"
                :model="formState"
                :rules="rules"
                layout="vertical"
                @finish="handleLogin"
              >
                <a-form-item name="tenantCode" class="!mb-4">
                  <a-select
                    v-model:value="formState.tenantCode"
                    :options="tenantOptions"
                    placeholder="请选择租户"
                    :loading="tenantLoading"
                    :class="inputClassName"
                    show-search
                    allow-clear
                    :field-names="{ label: 'tenantName', value: 'tenantCode' }"
                  />
                </a-form-item>

                <a-form-item name="username" class="!mb-4">
                  <a-input
                    v-model:value="formState.username"
                    size="large"
                    placeholder="用户名"
                    :class="inputClassName"
                    allow-clear
                  >
                    <template #prefix>
                      <UserOutlined class="text-slate-400" />
                    </template>
                  </a-input>
                </a-form-item>

                <a-form-item name="password" class="!mb-4">
                  <a-input-password
                    v-model:value="formState.password"
                    size="large"
                    placeholder="密码"
                    :class="inputClassName"
                    allow-clear
                  >
                    <template #prefix>
                      <LockOutlined class="text-slate-400" />
                    </template>
                  </a-input-password>
                </a-form-item>

                <a-form-item name="captchaCode" class="!mb-4">
                  <div class="flex items-center gap-3">
                    <a-input
                      v-model:value="formState.captchaCode"
                      size="large"
                      placeholder="图形验证码"
                      :class="[inputClassName, 'flex-1']"
                      :maxlength="4"
                      allow-clear
                    >
                      <template #prefix>
                        <SafetyOutlined class="text-slate-400" />
                      </template>
                    </a-input>

                    <div
                      class="h-11 w-[110px] shrink-0 rounded-lg overflow-hidden cursor-pointer border border-white/60 dark:border-white/[0.08] bg-white/50 dark:bg-slate-800/40 backdrop-blur-sm hover:border-white/90 dark:hover:border-white/[0.15] transition-colors flex items-center justify-center"
                      title="点击刷新验证码"
                      @click="refreshCaptcha"
                    >
                      <a-spin :spinning="captchaLoading" size="small">
                        <div
                          v-if="captchaSvg"
                          class="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                          v-html="captchaSvg"
                        />
                        <ReloadOutlined v-else class="text-slate-400" />
                      </a-spin>
                    </div>
                  </div>
                </a-form-item>

                <div class="flex items-center justify-between mb-6">
                  <a-checkbox
                    v-model:checked="formState.remember"
                    class="!text-[13px] !text-slate-600 dark:!text-slate-400"
                  >
                    记住我
                  </a-checkbox>
                  <a-button
                    type="link"
                    size="small"
                    class="!p-0 !h-auto !text-[13px] !text-slate-500 dark:!text-slate-400 hover:!text-[var(--ant-color-primary)]"
                    @click="handleForgotPassword"
                  >
                    忘记密码？
                  </a-button>
                </div>

                <a-button
                  type="primary"
                  html-type="submit"
                  size="large"
                  block
                  :loading="loading"
                  class="!h-11 !text-sm !font-medium !rounded-lg"
                >
                  登 录
                </a-button>
              </a-form>

              <div class="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
                还没有账号？
                <a-button
                  type="link"
                  class="!px-1 !h-auto !text-[var(--ant-color-primary)] !font-medium"
                  @click="handleRegister"
                >
                  立即注册
                </a-button>
              </div>

              <div class="relative my-6">
                <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-white/50 dark:border-white/[0.06]" />
                </div>
                <div class="relative flex justify-center">
                  <span class="px-3 bg-transparent text-[11px] text-slate-400">
                    或使用以下方式登录
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-4 gap-2.5">
                <button
                  v-for="item in socialLogins"
                  :key="item.key"
                  type="button"
                  class="group cursor-pointer flex items-center justify-center h-10 rounded-lg border border-white/60 dark:border-white/[0.08] bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm hover:bg-white/70 dark:hover:bg-slate-700/60 hover:border-white/90 dark:hover:border-white/[0.15] transition-all duration-200"
                  :title="`使用 ${item.label} 登录`"
                  @click="handleSocialLogin(item)"
                >
                  <Icon
                    :icon="item.icon"
                    class="text-lg transition-transform duration-200 group-hover:scale-110"
                    :style="{ color: item.color }"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-border-beam>
    <ForgotPasswordModal
      v-model:open="forgotModalOpen"
      :default-tenant-code="loginTenantCode"
      :default-username="formState.username"
      @success="handleResetSuccess"
    />
  </div>
</template>

<style scoped>
:deep(.ant-form-item-explain-error) {
  font-size: 12px;
}
</style>
