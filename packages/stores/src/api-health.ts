import { ref } from 'vue';

import { defineStore } from 'pinia';

/**
 * 全局接口健康状态。
 *
 * 请求层（`@antdv/request`）不能反过来依赖 pinia —— 它只通过在 runtime 上注入的
 * `onError` 回调把错误交给这里。应用侧 `unwrap()` 抛出的业务异常同样走 `markError`。
 *
 * 语义是「粘性的」：一旦有接口报错就保持 `hasError === true`，直到登录成功或
 * 显式 `reset()`。成功请求**不**清除，否则登录失败后紧跟的菜单请求会立刻把错误态
 * 抹掉，界面上根本看不到降级效果。刷新页面自然回到干净状态。
 */
export const useApiHealthStore = defineStore('apiHealth', () => {
  const hasError = ref(false);
  const errorCount = ref(0);
  const lastError = ref<null | string>(null);

  function markError(message?: string) {
    hasError.value = true;
    errorCount.value += 1;
    if (message) lastError.value = message;
  }

  function reset() {
    hasError.value = false;
    errorCount.value = 0;
    lastError.value = null;
  }

  return { errorCount, hasError, lastError, markError, reset };
});
