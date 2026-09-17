<script setup lang="ts">
import type { FormInstance } from "antdv-next";
import type { Rule } from "antdv-next/dist/form/types";
import { LockOutlined, ShopOutlined, UserOutlined } from "@antdv-next/icons";
import { message } from "antdv-next";
import { reactive, ref, watch } from "vue";
import { forgotPassword } from "@/api/auth";
import { usePasswordPolicy } from "@/composables/usePasswordPolicy";

interface Props {
  /** 从登录页带入的默认值，减少用户输入 */
  defaultTenantCode?: string;
  defaultUsername?: string;
}

const props = withDefaults(defineProps<Props>(), {
  defaultTenantCode: "",
  defaultUsername: "",
});
const open = defineModel("open", {
  default: false,
  type: Boolean,
});
const emit = defineEmits<{
  success: [payload: { tenantCode: string; username: string }];
}>();

const formRef = ref<FormInstance>();
const loading = ref(false);

const formState = reactive({
  tenantCode: "",
  username: "",
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});
const { policyText, validate: validatePassword } = usePasswordPolicy();
// 弹窗打开时同步外部传入的默认值
watch(
  () => open.value,
  (v) => {
    if (v) {
      formState.tenantCode = props.defaultTenantCode || "";
      formState.username = props.defaultUsername || "";
      formState.oldPassword = "";
      formState.newPassword = "";
      formState.confirmPassword = "";
      formRef.value?.clearValidate?.();
    }
  },
  { immediate: true },
);

// ============ 校验规则（严格对齐 ForgotPasswordSchema）============
const rules: Record<string, Rule[]> = {
  tenantCode: [
    { required: true, message: "请输入租户编码", trigger: "blur" },
    { min: 2, max: 64, message: "租户编码长度需为 2-64 位", trigger: "blur" },
  ],
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { max: 64, message: "用户名最长 64 位", trigger: "blur" },
  ],
  oldPassword: [
    { required: true, message: "请输入原密码", trigger: "blur" },
    { max: 64, message: "密码最长 64 位", trigger: "blur" },
  ],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, max: 64, message: "新密码长度需为 6-64 位", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (value && value === formState.oldPassword) {
          callback("新密码不能与原密码相同");
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  confirmPassword: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (value && value !== formState.newPassword) {
          callback("两次输入的新密码不一致");
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
};

// ============ 提交 ============
async function handleSubmit() {
  loading.value = true;

  try {
    await formRef.value?.validate();
    const check = validatePassword(formState.newPassword);
    if (!check.ok) {
      message.error(check.message);
      return;
    }
    const res = await forgotPassword({
      tenantCode: formState.tenantCode,
      username: formState.username,
      oldPassword: formState.oldPassword,
      newPassword: formState.newPassword,
    });

    // 根据你实际的响应结构调整判断
    if (res?.success === false) {
      throw new Error(res?.message || "重置失败");
    }

    message.success("密码重置成功，请使用新密码登录");
    emit("success", {
      tenantCode: formState.tenantCode,
      username: formState.username,
    });
    handleClose();
  } catch (e: any) {
    message.error(e?.message || "重置失败，请稍后重试");
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  open.value = false;
}
</script>

<template>
  <a-modal
    v-model:open="open"
    :width="440"
    :mask-closable="false"
    :keyboard="!loading"
    title="重置密码"
    ok-text="确认重置"
    cancel-text="取消"
    :confirm-loading="loading"
    centered
    @ok="handleSubmit"
    @cancel="handleClose"
  >
    <div class="py-2">
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
        请输入原密码以验证身份，并设置新的登录密码。
      </p>

      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        @keyup.enter="handleSubmit"
      >
        <a-form-item name="tenantCode">
          <a-input
            v-model:value="formState.tenantCode"
            size="large"
            placeholder="租户编码"
            allow-clear
            :maxlength="64"
          >
            <template #prefix>
              <ShopOutlined class="text-slate-400" />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item name="username">
          <a-input
            v-model:value="formState.username"
            size="large"
            placeholder="用户名"
            allow-clear
            :maxlength="64"
            autocomplete="username"
          >
            <template #prefix>
              <UserOutlined class="text-slate-400" />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item name="oldPassword">
          <a-input-password
            v-model:value="formState.oldPassword"
            size="large"
            placeholder="原密码"
            allow-clear
            :maxlength="64"
            autocomplete="current-password"
          >
            <template #prefix>
              <LockOutlined class="text-slate-400" />
            </template>
          </a-input-password>
        </a-form-item>

        <a-form-item name="newPassword">
          <a-input-password
            v-model:value="formState.newPassword"
            size="large"
            :placeholder="`新密码（${policyText}）`"
            allow-clear
            :maxlength="64"
            autocomplete="new-password"
          >
            <template #prefix>
              <LockOutlined class="text-slate-400" />
            </template>
          </a-input-password>
        </a-form-item>

        <a-form-item name="confirmPassword" class="!mb-0">
          <a-input-password
            v-model:value="formState.confirmPassword"
            size="large"
            placeholder="确认新密码"
            allow-clear
            :maxlength="64"
            autocomplete="new-password"
          >
            <template #prefix>
              <LockOutlined class="text-slate-400" />
            </template>
          </a-input-password>
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<style scoped>
:deep(.ant-form-item-explain-error) {
  font-size: 12px;
}
</style>
