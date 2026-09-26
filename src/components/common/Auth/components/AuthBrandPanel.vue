<script setup lang="ts">
import { computed } from "vue";

import AuthBrandLogo from "./AuthBrandLogo.vue";
import AuthBrandPreview from "./AuthBrandPreview.vue";
import AuthBrandStats, { type AuthStat } from "./AuthBrandStats.vue";
import AuthFeatureTags, { type AuthFeature } from "./AuthFeatureTags.vue";

import { useAuthStyles } from "../composables/useAuthStyles";

defineOptions({ name: "AuthBrandPanel" });

const props = withDefaults(
  defineProps<{
    /** 应用标题 */
    appTitle: string;
    /** Logo 地址 */
    logo: string;
    /** 主标题（用 \n 换行） */
    headline: string;
    /** 副标题 */
    subhead: string;
    /** 特性胶囊 */
    features: AuthFeature[];
    /** 数据指标（可选） */
    stats?: AuthStat[];
  }>(),
  {
    stats: () => [],
  },
);

const year = new Date().getFullYear();

const { brandPanelClassName, brandGlowClassName, brandGridClassName, brandContentClassName } =
  useAuthStyles();

const hasStats = computed(() => props.stats.length > 0);
</script>

<template>
  <div :class="brandPanelClassName">
    <div :class="brandGlowClassName" />
    <div :class="brandGridClassName" />

    <div :class="brandContentClassName">
      <AuthBrandLogo :title="appTitle" :logo="logo" />

      <!-- 标题 -->
      <div class="mt-10">
        <h1 class="text-3xl leading-snug font-bold tracking-tight whitespace-pre-line">
          {{ headline }}
        </h1>
        <p class="mt-4 text-sm leading-relaxed text-white/80">
          {{ subhead }}
        </p>
      </div>

      <AuthFeatureTags :features="features" />

      <!-- ⭐ 数据指标 -->
      <AuthBrandStats v-if="hasStats" :stats="stats" />

      <AuthBrandPreview :year="year" :app-title="appTitle" />
    </div>
  </div>
</template>
