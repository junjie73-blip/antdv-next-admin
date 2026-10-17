<script setup lang="ts">
import type { AuthPageLayoutProps } from './types';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

defineOptions({ name: 'AuthPageLayout' });

const props = withDefaults(defineProps<AuthPageLayoutProps>(), {
  appName: '',
  appLogo: '',
  copyright: '',
  features: () => [],
  icp: '',
  icpLink: '',
  pageDescription: '',
  pageTitle: '',
  showSlogan: true,
  showToolbar: true,
  sloganImage: '',
});
</script>

<template>
  <!--
    版式：视口正中一张卡片，左品牌右表单。`lg` 以下品牌栏整栏收起，表单占满卡片宽度；
    logo 与工具条浮在卡片之外的页面角上，页脚贴视口底。
    两栏靠卡片自身的 `overflow-hidden` 裁圆角，子层不再各自写一遍圆角。
  -->
  <div
    class="relative flex min-h-dvh w-full select-none flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-16 text-foreground sm:px-6"
    data-auth="page"
  >
    <!-- 底纹：两团主色光斑，换主题色时整页氛围跟着走 -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        class="bg-primary/10 absolute top-[-6rem] left-[8%] size-72 rounded-full blur-3xl"
      ></div>
      <div
        class="bg-primary/10 absolute right-[6%] bottom-[-7rem] size-80 rounded-full blur-3xl"
      ></div>
    </div>

    <header
      class="absolute top-0 left-0 z-10 flex items-center p-4 sm:p-6"
      data-auth="logo"
    >
      <slot name="logo">
        <div class="flex items-center gap-2.5 text-foreground">
          <!--
            官方 logo 与侧栏品牌位同一档规格：32px 见方 + `object-contain`，
            既不拉伸也不裁切，只补一层圆角与背景色块对齐卡片语言。
          -->
          <img
            v-if="props.appLogo"
            :alt="props.appName"
            :src="props.appLogo"
            class="h-8 w-8 rounded-lg object-contain"
            data-auth="logo-img"
          />
          <div
            v-else
            class="flex size-8 items-center justify-center rounded-lg bg-primary text-white"
          >
            <svg
              class="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              />
            </svg>
          </div>
          <span v-if="props.appName" class="text-base font-semibold">
            {{ props.appName }}
          </span>
        </div>
      </slot>
    </header>

    <div
      v-if="props.showToolbar"
      class="absolute top-4 right-2 z-10 flex items-center gap-1 rounded-3xl bg-accent px-3 py-1"
      data-auth="toolbar"
    >
      <slot name="toolbar"></slot>
    </div>

    <main
      class="border-border bg-card relative z-[1] flex w-full max-w-5xl overflow-hidden rounded-2xl border shadow-2xl shadow-primary/5 xl:max-w-6xl"
      data-auth="card"
    >
      <section
        v-if="props.showSlogan"
        class="from-primary/15 via-card to-primary/10 relative hidden w-[46%] shrink-0 flex-col bg-gradient-to-br p-10 lg:flex xl:p-12"
        data-auth="brand"
      >
        <div class="relative flex size-full flex-col">
          <!-- 铭牌：主色色条 + 产品名，品牌栏不重复贴一遍 logo -->
          <div class="flex items-center gap-2.5">
            <span
              class="bg-primary inline-block h-5 w-1.5 rounded-full"
              data-auth="slogan-mark"
            ></span>
            <span
              v-if="props.appName"
              class="text-foreground/70 text-sm font-medium tracking-[0.2em] uppercase"
            >
              {{ props.appName }}
            </span>
          </div>

          <div class="my-auto py-10">
            <h1
              v-if="props.pageTitle"
              class="text-foreground text-3xl leading-tight font-bold tracking-tight xl:text-4xl"
              data-auth="brand-title"
            >
              {{ props.pageTitle }}
            </h1>
            <p
              v-if="props.pageDescription"
              class="text-foreground/65 mt-4 max-w-md text-sm leading-relaxed xl:text-base"
              data-auth="brand-desc"
            >
              {{ props.pageDescription }}
            </p>

            <div
              v-if="props.features.length > 0"
              class="mt-8 flex flex-wrap gap-2"
              data-auth="brand-features"
            >
              <span
                v-for="feature in props.features"
                :key="feature.label"
                class="border-primary/25 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
                data-auth="brand-feature"
              >
                <Icon :icon="feature.icon" class="size-3.5" />
                {{ feature.label }}
              </span>
            </div>
          </div>

          <!-- 底部界面示意：不引外部插画，纯 CSS 画一个窗口骨架 -->
          <slot name="sloganVisual">
            <img
              v-if="props.sloganImage"
              :alt="props.pageTitle"
              :src="props.sloganImage"
              class="w-full max-w-sm rounded-xl"
              data-auth="slogan-image"
            />
            <div
              v-else
              class="border-border/70 bg-background/70 w-full max-w-sm rounded-xl border p-3 shadow-lg backdrop-blur-sm"
              data-auth="slogan-visual"
            >
              <div class="mb-3 flex items-center gap-1.5">
                <span class="bg-destructive/60 size-2 rounded-full"></span>
                <span class="bg-warning/60 size-2 rounded-full"></span>
                <span class="bg-success/60 size-2 rounded-full"></span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div class="bg-primary/25 col-span-1 h-20 rounded-lg"></div>
                <div class="col-span-2 flex flex-col gap-2 pt-1">
                  <div class="bg-primary/35 h-3 w-1/2 rounded-full"></div>
                  <div class="bg-foreground/10 h-2.5 w-full rounded-full"></div>
                  <div class="bg-foreground/10 h-2.5 w-4/5 rounded-full"></div>
                  <div class="bg-foreground/10 h-2.5 w-3/5 rounded-full"></div>
                </div>
              </div>
              <div class="mt-2 grid grid-cols-3 gap-2">
                <div class="bg-foreground/5 h-8 rounded-lg"></div>
                <div class="bg-foreground/5 h-8 rounded-lg"></div>
                <div class="bg-foreground/5 h-8 rounded-lg"></div>
              </div>
            </div>
          </slot>
        </div>
      </section>

      <!-- 表单栏：`items-center` 让插槽里的表单自己只管宽度，垂直居中由这一层负责 -->
      <section
        class="bg-card relative flex w-full flex-col items-center justify-center px-6 py-10 sm:px-10 lg:w-[54%] lg:py-12"
        data-auth="panel"
      >
        <slot></slot>
      </section>
    </main>

    <footer
      v-if="props.copyright || props.icp || $slots.footer"
      class="absolute right-0 bottom-3 left-0 flex flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground"
      data-auth="footer"
    >
      <slot name="footer">
        <div v-if="props.icp" class="flex items-center gap-1">
          <a
            v-if="props.icpLink"
            :href="props.icpLink"
            class="hover:text-primary"
            rel="noopener noreferrer"
            target="_blank"
          >
            {{ props.icp }}
          </a>
          <span v-else>{{ props.icp }}</span>
        </div>
        <div v-if="props.copyright" class="flex items-center gap-1">
          <span>Copyright ©</span>
          <span>{{ props.copyright }}</span>
        </div>
      </slot>
    </footer>
  </div>
</template>
