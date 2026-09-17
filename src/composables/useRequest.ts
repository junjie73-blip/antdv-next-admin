
import { useRequest, useWatcher } from "alova/client";
import { message } from "antdv-next";
import { computed, ref, type Ref } from "vue";

import type { Method } from "alova";


// ============================================================
// 工具
// ============================================================

/**
 * 响应解构：
 * - 后端返回 `{ code, message, data, timestamp }` → 返回 `data`
 * - 其他情况原样返回
 */
export function unwrap(result: any): any {
  if (
    result &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    "code" in result &&
    "data" in result
  ) {
    return result.data;
  }
  return result;
}

/** 解析错误消息 */
export function resolveErrorMessage(error: any, custom?: string | ((e: Error) => string)): string {
  if (custom) {
    return typeof custom === "function" ? custom(error) : custom;
  }
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return "请求失败";
}
export function isAlovaMethod(obj: any): boolean {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.send === "function" &&
    typeof obj.abort === "function" &&
    "type" in obj
  );
}
// ============================================================
// 类型
// ============================================================

export interface UseAppRequestOptions<T> {
  /** 是否立即执行 */
  immediate?: boolean;
  /** 初始数据 */
  initialData?: T;
  /** 成功时是否弹提示 */
  showSuccess?: boolean;
  /** 成功提示文案 */
  successMessage?: string;
  /** 失败时是否弹提示（默认 true） */
  showError?: boolean;
  /** 失败提示文案（字符串或根据错误动态生成） */
  errorMessage?: string | ((e: Error) => string);
  /** 成功回调（拿到解构后的数据） */
  onSuccess?: (data: T) => void;
  /** 失败回调 */
  onError?: (e: Error) => void;
  /** 是否自动解构响应（默认 true） */
  unwrapResponse?: boolean;
}

export interface UseAppRequestResult<T> {
  /** 解构后的数据 */
  data: Ref<T | undefined>;
  /** 加载状态（alova 原生） */
  loading: Ref<boolean>;
  /** 错误（alova 原生） */
  error: Ref<Error | undefined>;
  /** 执行请求，参数 force=true 时强制刷新 */
  send: (force?: boolean) => Promise<T>;
  /** 中止请求 */
  abort: () => void;
  /** 手动更新数据（本地增删改场景） */
  update: (newData: T) => void;
}

// ============================================================
// 主封装
// ============================================================

/**
 * 封装 alova 的 useRequest
 *
 * 相比原生 useRequest，增加：
 * - 自动解构 `{ code, data }` 响应
 * - 统一的成功/失败提示
 * - 更简洁的 API
 *
 * @param methodHandler 返回 alova Method 的函数（内部可引用响应式变量）
 *
 * @example
 * ```ts
 * const params = ref({ pageNum: 1, pageSize: 10 });
 * const { data: list, loading, send } = useAppRequest(
 *   () => http.Get('/user/list', { params: params.value }),
 *   { initialData: [], immediate: true }
 * );
 *
 * // 修改 params 后重新请求
 * params.value = { pageNum: 2, pageSize: 10 };
 * await send();
 * ```
 */
export function useAppRequest<T = any>(
  methodHandler: () => Method<any>,
  options: UseAppRequestOptions<T> = {},
): UseAppRequestResult<T> {
  const {
    immediate = false,
    initialData,
    showSuccess = false,
    successMessage = "操作成功",
    showError = true,
    errorMessage,
    onSuccess: userOnSuccess,
    onError: userOnError,
    unwrapResponse = true,
  } = options;

  // ⭐ 用 alova 原生 useRequest（不 immediate，我们包装完 send 再处理）
  const {
    data: rawData,
    loading,
    error: alovaError,
    send: alovaSend,
    abort,
    update: alovaUpdate,
  } = useRequest(methodHandler, {
    immediate: false,
    initialData: initialData as any,
  });

  // ⭐ 派生解构后的 data
  const data = computed<T | undefined>(() => {
    const raw = rawData.value;
    if (raw === undefined || raw === null) return raw as any;
    return unwrapResponse ? unwrap(raw) : raw;
  });

  // ⭐ 包装 send：加解构 + 提示
  const send = async (force = false): Promise<T> => {
    try {
      const result = await alovaSend(force);
      const unwrapped = (unwrapResponse ? unwrap(result) : result) as T;

      if (showSuccess) message.success(successMessage);
      userOnSuccess?.(unwrapped);

      return unwrapped;
    } catch (e: any) {
      if (showError) {
        message.error(resolveErrorMessage(e, errorMessage));
      }
      userOnError?.(e);
      throw e;
    }
  };

  // ⭐ 包装 update：更新底层 alova data
  const update = (newData: T) => {
    alovaUpdate({ data: newData as any });
  };

  // ⭐ immediate：包完 send 再执行
  if (immediate) {
    void send();
  }

  return {
    data: data as Ref<T | undefined>,
    loading: loading as Ref<boolean>,
    error: alovaError as Ref<Error | undefined>,
    send,
    abort,
    update,
  };
}

// ============================================================
// 响应式监听版本
// ============================================================

export interface UseAppWatcherOptions<T> extends UseAppRequestOptions<T> {
  /** 依赖变化时是否强制请求（默认 true） */
  force?: boolean;
}

/**
 * 封装 alova 的 useWatcher
 *
 * 与 useAppRequest 区别：自动监听响应式状态，状态变化自动请求
 *
 * @example
 * ```ts
 * const keyword = ref('');
 * const page = ref(1);
 *
 * const { data, loading } = useAppWatcher(
 *   () => http.Get('/user/search', { params: { keyword: keyword.value, page: page.value } }),
 *   [keyword, page],
 *   { initialData: [] }
 * );
 * ```
 */
export function useAppWatcher<T = any>(
  methodHandler: () => Method<any>,
  watchingStates: any[],
  options: UseAppWatcherOptions<T> = {},
): UseAppRequestResult<T> {
  const {
    immediate = false,
    initialData,
    showSuccess = false,
    successMessage = "操作成功",
    showError = true,
    errorMessage,
    onSuccess: userOnSuccess,
    onError: userOnError,
    unwrapResponse = true,
    force = false,
  } = options;

  const {
    data: rawData,
    loading,
    error: alovaError,
    send: alovaSend,
    abort,
    update: alovaUpdate,
  } = useWatcher(methodHandler, watchingStates, {
    immediate,
    initialData: initialData as any,
    force,
  });

  const data = computed<T | undefined>(() => {
    const raw = rawData.value;
    if (raw === undefined || raw === null) return raw as any;
    return unwrapResponse ? unwrap(raw) : raw;
  });

  const send = async (force = false): Promise<T> => {
    try {
      const result = await alovaSend(force);
      const unwrapped = (unwrapResponse ? unwrap(result) : result) as T;

      if (showSuccess) message.success(successMessage);
      userOnSuccess?.(unwrapped);

      return unwrapped;
    } catch (e: any) {
      if (showError) {
        message.error(resolveErrorMessage(e, errorMessage));
      }
      userOnError?.(e);
      throw e;
    }
  };

  return {
    data: data as Ref<T | undefined>,
    loading: loading as Ref<boolean>,
    error: alovaError as Ref<Error | undefined>,
    send,
    abort,
    update: (newData: T) => alovaUpdate({ data: newData as any }),
  };
}

// ============================================================
// 并行请求
// ============================================================

export interface UseAppParallelResult<T extends Record<string, any>> {
  data: { [K in keyof T]: Ref<T[K] | undefined> };
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  send: () => Promise<void>;
}

/**
 * 并行请求多个接口
 *
 * @example
 * ```ts
 * const { data, loading, send } = useAppParallelRequest({
 *   users: () => http.Get('/user/list'),
 *   roles: () => http.Get('/role/list'),
 *   depts: () => http.Get('/dept/tree'),
 * }, { immediate: true });
 *
 * console.log(data.users.value, data.roles.value);
 * ```
 */
export function useAppParallelRequest<T extends Record<string, () => Method<any>>>(
  fetchers: T,
  options: { immediate?: boolean; showError?: boolean } = {},
): UseAppParallelResult<{ [K in keyof T]: any }> {
  const { immediate = false, showError = true } = options;

  const loading = ref(false);
  const error = ref<Error | null>(null);
  const data: Record<string, Ref<any>> = {};

  for (const key of Object.keys(fetchers)) {
    data[key] = ref(undefined);
  }

  const send = async () => {
    loading.value = true;
    error.value = null;

    try {
      const keys = Object.keys(fetchers);
      const results = await Promise.all(keys.map((k) => fetchers[k]().send()));

      keys.forEach((key, i) => {
        data[key].value = unwrap(results[i]);
      });
    } catch (e: any) {
      error.value = e instanceof Error ? e : new Error(String(e));
      if (showError) {
        message.error(error.value.message || "加载失败");
      }
      throw error.value;
    } finally {
      loading.value = false;
    }
  };

  if (immediate) {
    void send();
  }

  return {
    data: data as any,
    loading,
    error,
    send,
  };
}
