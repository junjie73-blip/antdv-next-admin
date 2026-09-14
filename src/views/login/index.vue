<script setup lang="ts">
import type { FormInstance } from "antdv-next";
import type { Rule } from "antdv-next/dist/form/types";

import { LockOutlined, UserOutlined } from "@antdv-next/icons";
import { Icon } from "@iconify/vue";
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "antdv-next";
import { useUserStore } from "@/stores/modules/user";
import { useLoginStyles } from "./composables/useLoginStyles";
import ForgotPasswordModal from "./ForgotPasswordModal.vue";
const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const appTitle = import.meta.env.VITE_APP_TITLE || "Antdv Next Admin";

const {
  containerClassName,
  leftPanelClassName,
  leftGlassClassName,
  rightPanelClassName,
  glassCardClassName,
  inputClassName,
  decorBlob1ClassName,
  decorBlob1Style,
  decorBlob2ClassName,
  decorBlob2Style,
  decorBlob3ClassName,
  decorBlob3Style,
  gridBgClassName,
  logoContainerClassName,
  logoIconClassName,
  logoIconStyle,
  titleHighlightStyle,
  featureIconClassName,
  featureIconStyle,
} = useLoginStyles();

const formRef = ref<FormInstance>();
const loading = ref(false);

const formState = reactive({
  username: "",
  password: "",
  remember: true,
  tenantCode: "",
});

const rules: Record<string, Rule[]> = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  tenantCode: [{ required: true, message: "请输入租户编码", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码至少6位", trigger: "blur" },
  ],
};

// ============ 第三方登录配置 ============
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

// ============ 登录 ============
async function handleLogin() {
  try {
    await formRef.value?.validate();
    loading.value = true;

    const result = await userStore.login(
      formState.username,
      formState.password,
      formState.tenantCode,
    );

    if (result.success) {
      message.success("登录成功");
      const redirect = (route.query.redirect as string) || "/dashboard";
      router.push(redirect);
    } else {
      message.error(result.message || "登录失败");
    }
  } catch {
    // 校验失败不处理
  } finally {
    loading.value = false;
  }
}
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
function handleSocialLogin(item: (typeof socialLogins)[number]) {
  item.onClick();
}

const year = computed(() => new Date().getFullYear());
</script>

<template>
  <div :class="containerClassName">
    <!-- ==================== 左侧品牌区 ==================== -->
    <div :class="leftPanelClassName">
      <div :class="leftGlassClassName" />

      <div class="absolute inset-0">
        <div :class="decorBlob1ClassName" :style="decorBlob1Style" />
        <div :class="decorBlob2ClassName" :style="decorBlob2Style" />
        <div :class="decorBlob3ClassName" :style="decorBlob3Style" />
      </div>

      <div :class="gridBgClassName" />

      <div class="relative z-10 flex flex-col justify-center px-12 xl:px-20 w-full">
        <!-- Logo -->
        <div class="mb-10">
          <div :class="logoContainerClassName">
            <div :class="logoIconClassName" :style="logoIconStyle">
              <svg
                class="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span class="text-base font-semibold text-stone-800">{{ appTitle }}</span>
          </div>
        </div>

        <!-- 标题 -->
        <h1
          class="text-4xl xl:text-[42px] font-bold text-stone-800 mb-5 leading-tight tracking-tight"
        >
          构建现代化<br />
          <span :style="titleHighlightStyle">管理系统</span>
        </h1>

        <p class="text-base text-stone-500 mb-10 max-w-md leading-relaxed">
          基于 Vue 3 + TypeScript 打造的企业级后台解决方案，开箱即用的权限、租户、工作流能力。
        </p>

        <!-- 特性 -->
        <div class="space-y-4 max-w-md">
          <div class="flex items-center gap-4">
            <div :class="featureIconClassName">
              <Icon icon="carbon:flash" class="w-5 h-5" :style="featureIconStyle" />
            </div>
            <div>
              <h3 class="text-stone-700 font-medium text-sm">极速开发</h3>
              <p class="text-stone-400 text-xs mt-0.5">开箱即用的组件与模板</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div :class="featureIconClassName">
              <Icon icon="carbon:shield-checkmark" class="w-5 h-5" :style="featureIconStyle" />
            </div>
            <div>
              <h3 class="text-stone-700 font-medium text-sm">安全可靠</h3>
              <p class="text-stone-400 text-xs mt-0.5">完善的 RBAC 权限体系</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div :class="featureIconClassName">
              <Icon icon="carbon:settings-adjust" class="w-5 h-5" :style="featureIconStyle" />
            </div>
            <div>
              <h3 class="text-stone-700 font-medium text-sm">灵活配置</h3>
              <p class="text-stone-400 text-xs mt-0.5">多租户 + 主题系统</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== 右侧登录区 ==================== -->
    <div :class="rightPanelClassName">
      <div :class="glassCardClassName">
        <!-- 头部 -->
        <div class="mb-8">
          <h2 class="text-2xl font-bold text-stone-800 tracking-tight">欢迎回来 👋</h2>
          <p class="text-sm text-stone-500 mt-2">请登录您的账号以继续使用系统</p>
        </div>

        <!-- 表单 -->
        <a-form
          ref="formRef"
          :model="formState"
          :rules="rules"
          layout="vertical"
          @finish="handleLogin"
        >
          <a-form-item name="tenantCode">
            <a-input v-model:value="formState.tenantCode" placeholder="请输入租户编码" />
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
                <UserOutlined class="text-stone-400" />
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
                <LockOutlined class="text-stone-400" />
              </template>
            </a-input-password>
          </a-form-item>

          <div class="flex items-center justify-between mb-6">
            <a-checkbox v-model:checked="formState.remember" class="!text-stone-500">
              记住我
            </a-checkbox>
            <a-button
              type="link"
              size="small"
              class="!p-0 !h-auto !text-stone-500 hover:!text-[var(--ant-color-primary)]"
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
            class="!h-11 !text-sm !font-medium"
          >
            登 录
          </a-button>
        </a-form>

        <!-- 注册入口 -->
        <div class="text-center text-sm text-stone-500 mt-5">
          还没有账号？
          <a-button
            type="link"
            class="!px-1 !h-auto !text-[var(--ant-color-primary)] !font-medium"
            @click="handleRegister"
          >
            立即注册
          </a-button>
        </div>

        <!-- 分割线 -->
        <div class="relative my-7">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-stone-200" />
          </div>
          <div class="relative flex justify-center">
            <span class="px-3 bg-white text-xs text-stone-400">或使用以下方式登录</span>
          </div>
        </div>

        <!-- 第三方登录 -->
        <div class="grid grid-cols-4 gap-3">
          <button
            v-for="item in socialLogins"
            :key="item.key"
            type="button"
            class="group cursor-pointer flex items-center justify-center h-11 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-all duration-200"
            :title="`使用 ${item.label} 登录`"
            @click="handleSocialLogin(item)"
          >
            <Icon
              :icon="item.icon"
              class="text-xl transition-transform duration-200 group-hover:scale-110"
              :style="{ color: item.color }"
            />
          </button>
        </div>

        <!-- 页脚 -->
        <div class="text-center text-xs text-stone-400 mt-8">
          © {{ year }} {{ appTitle }} · 保留所有权利
        </div>
      </div>
    </div>
    <ForgotPasswordModal
      v-model:open="forgotModalOpen"
      :default-tenant-code="loginTenantCode"
      :default-username="formState.username"
      @success="handleResetSuccess"
    />
  </div>
</template>

<style scoped>
:deep(.ant-checkbox-wrapper) {
  font-size: 13px;
}
:deep(.ant-form-item-explain-error) {
  font-size: 12px;
}
</style>
