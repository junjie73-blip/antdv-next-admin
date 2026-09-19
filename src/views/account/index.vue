<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message, Modal } from "antdv-next";
import { computed, inject, onMounted, ref, watch } from "vue";

import type { FormSchema } from "~/components/business/Form";

import { uploadFile } from "~/api";

import {
  type AccessibleTenant,
  changePassword,
  getMyTenants,
  switchTenant,
  updateProfile,
} from "~/api/auth";

import {
  disableMFA,
  enableMFA,
  getMFAStatus,
  type MFAStatus,
  regenerateBackupCodes,
  setupMFA,
} from "~/api/mfa";

import { BasicForm, useForm } from "~/components/business/Form";
import { usePasswordPolicy } from "~/composables/usePasswordPolicy";
import { useUserStore } from "~/stores/modules/user";
import { cn } from "~/utils/cn";

defineOptions({ name: "AccountSettings" });

const userStore = useUserStore();
const refreshUser = inject<() => Promise<void>>("refreshUser", async () => {});

// ============ 布局 ============
const containerClassName = cn("space-y-4");
const cardClassName = cn("shadow-sm");

const activeTab = ref<"profile" | "security" | "tenant">("profile");

// ============ 表单实例 ============
const [profileFormRegister, profileFormMethods] = useForm();
const [passwordFormRegister, passwordFormMethods] = useForm();

const profileLoading = ref(false);
const passwordLoading = ref(false);
const uploadLoading = ref(false);

// ============ 密码策略 ============
const { policyText, validate: validatePassword } = usePasswordPolicy();

// ============ 基本信息 ============
const profileFormSchemas = computed<FormSchema[]>(() => [
  {
    field: "username",
    label: "用户名",
    component: "Input",
    disabled: true, // ⭐ 修：dynamicDisabled → disabled
    componentProps: { placeholder: "用户名" },
  },
  {
    field: "realName",
    label: "真实姓名",
    component: "Input",
    componentProps: { placeholder: "请输入真实姓名" },
  },
  {
    field: "email",
    label: "邮箱",
    component: "Input",
    componentProps: { placeholder: "请输入邮箱" },
  },
  {
    field: "phone",
    label: "手机号",
    component: "Input",
    componentProps: { placeholder: "请输入手机号" },
  },
  {
    field: "avatar",
    label: "头像",
    component: "Input",
    slot: "avatarUpload",
    componentProps: { placeholder: "头像 URL" },
  },
]);

function fillProfileForm() {
  const info = userStore.userInfo;
  if (!info) return;
  profileFormMethods.setFieldsValue({
    username: info.username || "",
    realName: info.realName || "",
    email: info.email || "",
    phone: info.phone || "",
    avatar: info.avatar || "",
  });
}

watch(
  () => userStore.userInfo,
  (v) => {
    if (v) fillProfileForm();
  },
  { immediate: true, deep: true },
);

// ============ 头像上传 ============
function beforeUpload(file: File) {
  const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
  if (!isJpgOrPng) {
    message.error("只能上传 JPG/PNG 格式的图片");
    return false;
  }
  if (file.size / 1024 / 1024 >= 2) {
    message.error("图片大小不能超过 2MB");
    return false;
  }
  return true;
}

async function customUpload({ file, onSuccess, onError }: any) {
  uploadLoading.value = true;
  try {
    const res: any = await uploadFile(file as File);
    const url = res?.data?.url || res?.url;
    if (!url) throw new Error("上传接口未返回 url");
    profileFormMethods.setFieldsValue({ avatar: url });
    message.success("头像上传成功");
    onSuccess?.(res);
  } catch (e: any) {
    message.error(e?.message || "头像上传失败");
    onError?.(e);
  } finally {
    uploadLoading.value = false;
  }
}

// ============ 保存基本信息 ============
async function handleSaveProfile() {
  const values = await profileFormMethods.validate();
  if (!values) return;
  profileLoading.value = true;
  try {
    await updateProfile({
      realName: values.realName,
      email: values.email,
      phone: values.phone,
      avatar: values.avatar,
    });
    message.success("个人信息更新成功");
    await refreshUser();
  } catch (e: any) {
    message.error(e?.message || "更新失败");
  } finally {
    profileLoading.value = false;
  }
}

// ============ 修改密码 ============
const passwordFormSchemas = computed<FormSchema[]>(() => [
  {
    field: "oldPassword",
    label: "当前密码",
    component: "InputPassword",
    required: true,
    componentProps: { placeholder: "请输入当前密码" },
  },
  {
    field: "newPassword",
    label: "新密码",
    component: "InputPassword",
    required: true,
    componentProps: { placeholder: "请输入新密码" },
    // ⭐ 用 computed 保证策略加载后自动更新
    helpMessage: `密码要求：${policyText.value}`,
  },
  {
    field: "confirmPassword",
    label: "确认新密码",
    component: "InputPassword",
    required: true,
    componentProps: { placeholder: "再次输入新密码" },
  },
]);

async function handleChangePassword() {
  const values = await passwordFormMethods.validate();
  if (!values) return;

  if (values.newPassword !== values.confirmPassword) {
    message.error("两次输入的新密码不一致");
    return;
  }

  const check = validatePassword(values.newPassword);
  if (!check.ok) {
    message.error(check.message);
    return;
  }

  passwordLoading.value = true;
  try {
    // ⭐ 走 API 层
    await changePassword({
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    });
    message.success("密码修改成功");
    passwordFormMethods.resetFields();
  } catch (e: any) {
    message.error(e?.message || "密码修改失败");
  } finally {
    passwordLoading.value = false;
  }
}

// ============ MFA ============
const mfaStatus = ref<MFAStatus>({ enabled: false, hasBackupCodes: false });
const mfaLoading = ref(false);
const mfaSetupVisible = ref(false);
const mfaSetupData = ref<{ qrCode: string; manualEntryKey: string } | null>(null);
const mfaToken = ref("");
const mfaSubmitting = ref(false);
const backupCodes = ref<string[]>([]);

async function loadMFAStatus() {
  try {
    mfaStatus.value = await getMFAStatus();
  } catch (e) {
    console.error("加载 MFA 状态失败", e);
  }
}

async function handleMFASetup() {
  mfaLoading.value = true;
  try {
    mfaSetupData.value = await setupMFA();
    mfaToken.value = "";
    mfaSetupVisible.value = true;
  } catch (e: any) {
    message.error(e?.message || "初始化失败");
  } finally {
    mfaLoading.value = false;
  }
}

async function handleMFAEnable() {
  if (!/^\d{6}$/.test(mfaToken.value)) {
    message.warning("请输入 6 位数字验证码");
    return;
  }
  mfaSubmitting.value = true;
  try {
    const res = await enableMFA(mfaToken.value);
    backupCodes.value = res.backupCodes ?? [];
    message.success("MFA 已启用，请妥善保存备份码");
    mfaSetupVisible.value = false;
    await loadMFAStatus();
  } catch (e: any) {
    message.error(e?.message || "启用失败");
  } finally {
    mfaSubmitting.value = false;
  }
}

// ============ 统一的"输入 TOTP"弹窗 ============
interface TokenModalState {
  visible: boolean;
  title: string;
  hint: string;
  value: string;
  loading: boolean;
  action: ((token: string) => Promise<void>) | null;
}

const tokenModal = ref<TokenModalState>({
  visible: false,
  title: "",
  hint: "",
  value: "",
  loading: false,
  action: null,
});

function openTokenModal(title: string, hint: string, action: (token: string) => Promise<void>) {
  tokenModal.value = {
    visible: true,
    title,
    hint,
    value: "",
    loading: false,
    action,
  };
}

async function handleTokenConfirm() {
  const { value, action } = tokenModal.value;
  if (!/^\d{6}$/.test(value)) {
    message.warning("请输入 6 位数字验证码");
    return;
  }
  tokenModal.value.loading = true;
  try {
    await action?.(value);
    tokenModal.value.visible = false;
  } catch (e: any) {
    message.error(e?.message || "操作失败");
  } finally {
    tokenModal.value.loading = false;
  }
}

function handleMFADisable() {
  openTokenModal("禁用 MFA", "禁用后账号安全性将降低，请输入当前 6 位验证码确认", async (token) => {
    await disableMFA(token);
    message.success("MFA 已禁用");
    await loadMFAStatus();
  });
}

function handleRegenerateBackupCodes() {
  openTokenModal(
    "重新生成备份码",
    "生成后旧的备份码将失效，请输入当前 6 位验证码",
    async (token) => {
      const res = await regenerateBackupCodes(token);
      backupCodes.value = res.backupCodes ?? [];
      message.success("备份码已重新生成");
      await loadMFAStatus();
    },
  );
}

// ============ 多租户切换 ============
const tenants = ref<AccessibleTenant[]>([]);
const tenantsLoading = ref(false);

const currentTenantId = computed(() => userStore.userInfo?.tenantId);

async function loadTenants() {
  tenantsLoading.value = true;
  try {
    tenants.value = await getMyTenants();
  } catch (e) {
    console.error("[Account] 加载租户列表失败", e);
    tenants.value = [];
  } finally {
    tenantsLoading.value = false;
  }
}

function handleSwitchTenant(tenant: AccessibleTenant) {
  if (tenant.tenantId === currentTenantId.value) return;

  Modal.confirm({
    title: "切换租户",
    content: `确定切换到「${tenant.tenantName}」吗？切换后需重新登录。`,
    async onOk() {
      try {
        const res: any = await switchTenant(tenant.tenantId);
        const data = res?.data ?? res;

        // 后端返回新 token → 直接切
        if (data?.accessToken) {
          userStore.setToken(data.accessToken, data.refreshToken || "");
          message.success("已切换，正在重新加载...");
          setTimeout(() => location.reload(), 300);
        } else {
          // 后端未返回 token → 要求重新登录
          message.success("切换成功，请重新登录");
          await userStore.logout();
        }
      } catch (e: any) {
        message.error(e?.message || "切换失败");
      }
    },
  });
}

// ============ Tab 切换时懒加载 ============
watch(activeTab, (tab) => {
  if (tab === "tenant" && tenants.value.length === 0) {
    loadTenants();
  }
});

// ============ 初始化 ============
onMounted(() => {
  fillProfileForm();
  loadMFAStatus();
});
</script>

<template>
  <div :class="containerClassName">
    <!-- ==================== 用户卡片 ==================== -->
    <div
      class="rounded-xl border border-gray-200/70 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
    >
      <div class="relative flex items-center gap-6 px-6 py-6">
        <a-avatar
          :size="80"
          :src="userStore.avatar"
          class="ring-2 ring-gray-100 dark:ring-gray-800 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-2xl"
        >
          {{ userStore.username?.charAt(0)?.toUpperCase() || "U" }}
        </a-avatar>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {{ userStore.userInfo?.realName || userStore.username || "用户" }}
            </h2>
            <a-tag v-for="role in userStore.roles" :key="role" color="blue">
              {{ role }}
            </a-tag>
          </div>

          <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">@{{ userStore.username }}</div>

          <div class="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
            <span v-if="userStore.email" class="inline-flex items-center gap-1">
              <Icon icon="carbon:email" />
              {{ userStore.email }}
            </span>
            <span v-if="userStore.phone" class="inline-flex items-center gap-1">
              <Icon icon="carbon:phone" />
              {{ userStore.phone }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== Tab 卡片 ==================== -->
    <a-card :bordered="false" :class="cardClassName">
      <a-tabs v-model:active-key="activeTab">
        <!-- ==================== 基本信息 ==================== -->
        <a-tab-pane key="profile" tab="基本信息">
          <div class="pt-2 max-w-xl">
            <BasicForm
              :schemas="profileFormSchemas"
              :label-width="100"
              :show-reset-button="false"
              :show-submit-button="false"
              :grid="{ cols: 1, gutter: 16 }"
              @register="profileFormRegister"
            >
              <template #avatarUpload="{ model, field }">
                <div class="flex items-center gap-4">
                  <a-upload
                    :show-upload-list="false"
                    :accept="'.jpg,.jpeg,.png'"
                    :before-upload="beforeUpload"
                    :custom-request="customUpload"
                  >
                    <a-button :loading="uploadLoading"> 上传头像 </a-button>
                  </a-upload>
                  <img
                    v-if="model[field]"
                    :src="model[field]"
                    class="w-16 h-16 rounded-full object-cover border"
                    alt="avatar"
                  />
                </div>
              </template>
              <template #actionAfter>
                <div class="flex justify-end mt-4">
                  <a-button type="primary" :loading="profileLoading" @click="handleSaveProfile">
                    保存修改
                  </a-button>
                </div>
              </template>
            </BasicForm>
          </div>
        </a-tab-pane>

        <!-- ==================== 账号安全 ==================== -->
        <a-tab-pane key="security" tab="账号安全">
          <div class="pt-2 space-y-6">
            <!-- 修改密码 -->
            <div>
              <div
                class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-3"
              >
                <Icon icon="carbon:password" class="text-gray-500" />
                <span>修改密码</span>
              </div>
              <div class="max-w-xl">
                <BasicForm
                  :schemas="passwordFormSchemas"
                  :label-width="100"
                  :show-reset-button="false"
                  :show-submit-button="false"
                  :grid="{ cols: 1, gutter: 16 }"
                  @register="passwordFormRegister"
                >
                  <template #actionAfter>
                    <div class="flex justify-end mt-2">
                      <a-button
                        type="primary"
                        :loading="passwordLoading"
                        @click="handleChangePassword"
                      >
                        确认修改
                      </a-button>
                    </div>
                  </template>
                </BasicForm>
              </div>
            </div>

            <!-- MFA -->
            <div>
              <div
                class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-3"
              >
                <Icon icon="carbon:security" class="text-gray-500" />
                <span>两步验证（MFA）</span>
              </div>
              <div
                class="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-800"
              >
                <div>
                  <div class="text-sm text-gray-700 dark:text-gray-200">
                    状态：
                    <a-tag :color="mfaStatus.enabled ? 'green' : 'default'">
                      {{ mfaStatus.enabled ? "已启用" : "未启用" }}
                    </a-tag>
                  </div>
                  <div class="text-xs text-gray-400 mt-1">
                    {{
                      mfaStatus.enabled
                        ? mfaStatus.hasBackupCodes
                          ? "已生成备份码"
                          : "尚未生成备份码"
                        : "启用后可通过验证器 App 提升账号安全性"
                    }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <a-button
                    v-if="!mfaStatus.enabled"
                    type="primary"
                    :loading="mfaLoading"
                    @click="handleMFASetup"
                  >
                    启用 MFA
                  </a-button>
                  <template v-else>
                    <a-button @click="handleRegenerateBackupCodes"> 重新生成备份码 </a-button>
                    <a-button danger @click="handleMFADisable">禁用 MFA</a-button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </a-tab-pane>

        <!-- ==================== 租户切换 ==================== -->
        <a-tab-pane key="tenant" tab="租户切换">
          <div class="pt-2">
            <a-spin :spinning="tenantsLoading">
              <div v-if="tenants.length > 0" class="space-y-2">
                <div
                  v-for="tenant in tenants"
                  :key="tenant.tenantId"
                  class="flex items-center justify-between p-4 rounded-lg border transition-colors"
                  :class="
                    tenant.tenantId === currentTenantId
                      ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-900'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  "
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center"
                      :class="
                        tenant.tenantId === currentTenantId
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      "
                    >
                      <Icon icon="carbon:building" class="text-lg" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-gray-800 dark:text-gray-100">
                          {{ tenant.tenantName }}
                        </span>
                        <a-tag v-if="tenant.tenantId === currentTenantId" color="blue" class="!m-0">
                          当前
                        </a-tag>
                      </div>
                      <div class="text-xs text-gray-400 mt-0.5">
                        {{ tenant.tenantCode }}
                      </div>
                    </div>
                  </div>
                  <a-button
                    v-if="tenant.tenantId !== currentTenantId"
                    type="primary"
                    ghost
                    size="small"
                    @click="handleSwitchTenant(tenant)"
                  >
                    切换
                  </a-button>
                  <span v-else class="text-xs text-gray-400">使用中</span>
                </div>
              </div>
              <a-empty v-else-if="!tenantsLoading" description="暂无可访问的租户" />
            </a-spin>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- ==================== MFA 启用弹窗 ==================== -->
    <a-modal
      v-model:open="mfaSetupVisible"
      title="启用两步验证"
      :width="460"
      :confirm-loading="mfaSubmitting"
      @ok="handleMFAEnable"
    >
      <div v-if="mfaSetupData" class="space-y-3">
        <p class="text-sm text-gray-500">
          使用验证器 App（如 Google Authenticator）扫描下方二维码：
        </p>
        <div class="flex justify-center">
          <img :src="mfaSetupData.qrCode" alt="QR" class="w-40 h-40" />
        </div>
        <div class="text-xs text-gray-500 text-center">
          无法扫描？手动输入：<code>{{ mfaSetupData.manualEntryKey }}</code>
        </div>
        <a-input
          v-model:value="mfaToken"
          placeholder="请输入 6 位验证码"
          :maxlength="6"
          size="large"
        />
      </div>
    </a-modal>

    <!-- ==================== TOTP 输入弹窗（禁用 / 重新生成备份码） ==================== -->
    <a-modal
      v-model:open="tokenModal.visible"
      :title="tokenModal.title"
      :width="420"
      :confirm-loading="tokenModal.loading"
      @ok="handleTokenConfirm"
    >
      <div class="py-2 space-y-3">
        <p class="text-sm text-gray-500">{{ tokenModal.hint }}</p>
        <a-input
          v-model:value="tokenModal.value"
          placeholder="请输入 6 位 TOTP 验证码"
          :maxlength="6"
          size="large"
          autofocus
        />
      </div>
    </a-modal>

    <!-- ==================== 备份码弹窗 ==================== -->
    <a-modal
      :open="backupCodes.length > 0"
      title="备份码（请妥善保存）"
      :footer="null"
      @cancel="backupCodes = []"
    >
      <div class="grid grid-cols-2 gap-2">
        <code
          v-for="c in backupCodes"
          :key="c"
          class="px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded text-xs text-center"
        >
          {{ c }}
        </code>
      </div>
      <div class="text-xs text-gray-400 mt-3">每个备份码只能使用一次，请离线保存到安全位置。</div>
    </a-modal>
  </div>
</template>
