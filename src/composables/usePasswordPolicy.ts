import { computed, onMounted, ref } from "vue";

import { getPasswordPolicy, type PasswordPolicy } from "@/api/auth";


const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 6,
  maxLength: 64,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSymbol: false,
};

/** 模块级缓存：整个应用生命周期只拉一次 */
let cachedPolicy: PasswordPolicy | null = null;

/**
 * 密码策略
 * - 首次调用会拉接口
 * - 后续调用复用缓存
 */
export function usePasswordPolicy() {
  const policy = ref<PasswordPolicy>(cachedPolicy ?? DEFAULT_POLICY);
  const loading = ref(false);

  async function load() {
    if (cachedPolicy) {
      policy.value = cachedPolicy;
      return;
    }
    loading.value = true;
    try {
      const res = await getPasswordPolicy();
      cachedPolicy = { ...DEFAULT_POLICY, ...res };
      policy.value = cachedPolicy;
    } catch (e) {
      console.warn("[PasswordPolicy] 加载失败，使用默认策略", e);
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);

  /** 策略描述（用于 helpMessage） */
  const policyText = computed(() => {
    const p = policy.value;
    const rules: string[] = [];
    rules.push(`${p.minLength}-${p.maxLength} 位`);
    if (p.requireUppercase) rules.push("含大写字母");
    if (p.requireLowercase) rules.push("含小写字母");
    if (p.requireNumber) rules.push("含数字");
    if (p.requireSymbol) rules.push("含特殊字符");
    return rules.join(" · ");
  });

  /** 校验单个密码 */
  function validate(value: string): { ok: boolean; message?: string } {
    const p = policy.value;
    if (!value) return { ok: false, message: "请输入密码" };
    if (value.length < p.minLength) return { ok: false, message: `密码至少 ${p.minLength} 位` };
    if (value.length > p.maxLength) return { ok: false, message: `密码不能超过 ${p.maxLength} 位` };
    if (p.requireUppercase && !/[A-Z]/.test(value))
      return { ok: false, message: "密码需包含大写字母" };
    if (p.requireLowercase && !/[a-z]/.test(value))
      return { ok: false, message: "密码需包含小写字母" };
    if (p.requireNumber && !/\d/.test(value)) return { ok: false, message: "密码需包含数字" };
    if (p.requireSymbol && !/[^A-Za-z0-9]/.test(value))
      return { ok: false, message: "密码需包含特殊字符" };
    return { ok: true };
  }

  return { policy, loading, load, policyText, validate };
}
