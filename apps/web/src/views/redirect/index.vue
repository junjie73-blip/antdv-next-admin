<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

defineOptions({ name: 'RedirectPage' });

/**
 * 刷新中转页。
 *
 * 「刷新当前标签」不能直接 `router.refresh()`：hash 模式下它只重跑守卫，
 * keep-alive 里的组件实例原封不动，用户看到的还是旧数据。
 * 约定做法是先跳开（离开原路由，缓存被 deactivate），再立刻 replace 回来，
 * 于是组件重新挂载、请求重新发起，而地址栏看起来只是"原地刷新"。
 *
 * 路由形如 `/redirect/system/user`，`params.path` 即要去掉的目的地。
 */
const route = useRoute();
const router = useRouter();

onMounted(() => {
  const rest = route.params.path;
  const target = Array.isArray(rest) ? rest.join('/') : String(rest ?? '');
  // /redirect 后面没东西时回首页，避免原地打转
  router.replace(target ? `/${target.replace(/^\/+/, '')}` : '/');
});
</script>

<template>
  <div class="flex h-full items-center justify-center text-gray-400">
    正在刷新…
  </div>
</template>
