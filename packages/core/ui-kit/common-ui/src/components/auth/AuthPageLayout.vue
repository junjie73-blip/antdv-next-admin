<script setup lang="ts">
import type { AuthPageLayoutProps } from './types';

import { IconifyIcon as Icon } from '@antdv/icons/icon';

defineOptions({ name: 'AuthPageLayout' });

const props = withDefaults(defineProps<AuthPageLayoutProps>(), {
  appName: '',
  appLogo: '',
  brandBadge: '',
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

/**
 * 品牌栏底部界面示意的柱状图高度（百分比）。
 *
 * 纯装饰，写死一组有起伏的值就够了：真接数据就得引入数据源，而认证外壳刻意不认识 store。
 */
const mockBars = [38, 62, 45, 78, 54, 88, 66, 96, 72, 58, 82, 44];
</script>

<template>
  <!--
    版式：整屏左右分栏，左品牌右表单，两栏各占半屏并铺满视口高度 ——
    后台系统的登录页通常是"一屏装完"，居中卡片那种"海报感"反而不像入口。
    `lg` 以下品牌栏整栏收起，表单栏独占整屏宽度并退成贴边单列。
    logo 浮在左上角（宽屏时正落在品牌栏的留白里），工具条浮在右上角，页脚贴视口底。
  -->
  <div
    class="bg-background text-foreground relative flex min-h-dvh w-full select-none flex-col overflow-x-hidden"
    data-auth="page"
  >
    <!--
      背景画布：主色光斑 + 网格 + 顶部光带，三层全部由 `--primary` 派生，
      换主题色时整页氛围跟着走，明暗两套不用各写一份。
    -->
    <div aria-hidden="true" class="auth-canvas" data-auth="canvas">
      <span class="auth-canvas__glow auth-canvas__glow--one"></span>
      <span class="auth-canvas__glow auth-canvas__glow--two"></span>
      <span class="auth-canvas__glow auth-canvas__glow--three"></span>
      <span class="auth-canvas__grid"></span>
      <span class="auth-canvas__arc"></span>
      <span class="auth-canvas__arc auth-canvas__arc--inner"></span>
      <span class="auth-canvas__horizon"></span>
    </div>

    <header
      class="absolute top-0 left-0 z-20 flex items-center p-5 sm:p-6 lg:p-8"
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
      class="bg-accent absolute top-4 right-2 z-20 flex items-center gap-1 rounded-3xl px-3 py-1"
      data-auth="toolbar"
    >
      <slot name="toolbar"></slot>
    </div>

    <main
      class="relative z-10 flex w-full flex-1 items-stretch"
      data-auth="card"
    >
      <!-- 品牌栏：不套容器，直接坐在背景画布上，靠自身一层主色淡染与右栏拉开 -->
      <section
        v-if="props.showSlogan"
        class="auth-brand relative hidden w-[52%] flex-col justify-center px-10 pt-24 pb-16 lg:flex xl:px-14 2xl:px-20"
        data-auth="brand"
      >
        <div class="flex w-full max-w-xl flex-col gap-8 2xl:max-w-2xl">
          <!-- 铭牌：主色色条 + 引导语，品牌栏不重复贴一遍 logo -->
          <div class="flex items-center gap-2.5">
            <span
              class="bg-primary inline-block h-5 w-1.5 rounded-full"
              data-auth="slogan-mark"
            ></span>
            <span
              v-if="props.brandBadge"
              class="text-foreground/60 text-xs font-medium tracking-[0.24em] uppercase"
              data-auth="brand-badge"
            >
              {{ props.brandBadge }}
            </span>
          </div>

          <div>
            <h1
              v-if="props.pageTitle"
              class="text-foreground text-3xl leading-tight font-bold tracking-tight xl:text-4xl 2xl:text-5xl"
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
              class="mt-7 flex flex-wrap gap-2"
              data-auth="brand-features"
            >
              <span
                v-for="feature in props.features"
                :key="feature.label"
                class="bg-primary/10 text-primary border-primary/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
                data-auth="brand-feature"
              >
                <Icon :icon="feature.icon" class="size-3.5" />
                {{ feature.label }}
              </span>
            </div>
          </div>

          <!-- 底部界面示意：不引外部插画，纯 CSS 画一个后台窗口骨架 -->
          <slot name="sloganVisual">
            <img
              v-if="props.sloganImage"
              :alt="props.pageTitle"
              :src="props.sloganImage"
              class="w-full max-w-lg rounded-xl"
              data-auth="slogan-image"
            />
            <div
              v-else
              class="auth-console border-border/70 bg-card/70 w-full max-w-lg rounded-2xl border p-3 shadow-2xl backdrop-blur-sm"
              data-auth="slogan-visual"
            >
              <!-- 窗口栏：三颗灯 + 地址胶囊 + 头像位 -->
              <div class="mb-3 flex items-center gap-2 px-0.5">
                <span class="flex items-center gap-1.5">
                  <span class="bg-destructive/60 size-2 rounded-full"></span>
                  <span class="bg-warning/60 size-2 rounded-full"></span>
                  <span class="bg-success/60 size-2 rounded-full"></span>
                </span>
                <span
                  class="border-border/60 bg-foreground/5 mx-1 h-4 flex-1 rounded-md border"
                ></span>
                <span class="bg-primary/25 size-4 rounded-md"></span>
              </div>

              <div class="flex gap-2.5">
                <!-- 侧栏：一颗主色 logo + 五行菜单，首行是选中态 -->
                <div
                  class="bg-foreground/[0.04] hidden w-[22%] shrink-0 flex-col gap-1.5 rounded-lg p-2 sm:flex"
                >
                  <span
                    class="bg-primary/70 mb-1 inline-block h-2 w-2/3 rounded-full"
                  ></span>
                  <span
                    class="bg-primary/25 inline-block h-2.5 rounded-full"
                  ></span>
                  <span
                    v-for="row in 4"
                    :key="row"
                    class="bg-foreground/10 inline-block h-2.5 rounded-full"
                  ></span>
                </div>

                <div class="flex min-w-0 flex-1 flex-col gap-2">
                  <!-- KPI 三张：首张取主色，读起来像"当前关注的指标" -->
                  <div class="grid grid-cols-3 gap-2">
                    <div
                      v-for="index in 3"
                      :key="index"
                      class="border-border/60 rounded-lg border p-2"
                    >
                      <span
                        class="bg-foreground/10 inline-block h-1.5 w-1/2 rounded-full"
                      ></span>
                      <span
                        class="mt-2 inline-block block h-3 w-3/4 rounded-full"
                        :class="
                          index === 1 ? 'bg-primary/60' : 'bg-foreground/15'
                        "
                      ></span>
                    </div>
                  </div>

                  <!-- 柱状图 -->
                  <div
                    class="border-border/60 flex h-20 items-end gap-1.5 rounded-lg border p-2"
                  >
                    <span
                      v-for="(bar, index) in mockBars"
                      :key="index"
                      class="auth-console__bar inline-block flex-1 rounded-t"
                      :style="{ height: `${bar}%` }"
                    ></span>
                  </div>

                  <!-- 明细行：三行等高占位，补齐"表格"的观感 -->
                  <div class="flex flex-col gap-1.5">
                    <span
                      v-for="row in 3"
                      :key="row"
                      class="bg-foreground/[0.07] inline-block h-2.5 rounded-full"
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          </slot>
        </div>
      </section>

      <!--
        表单栏：宽屏时是一整片贴右的毛玻璃竖栏（`border-l` + `backdrop-filter`），
        窄屏时去掉分隔线铺满整屏。垂直居中由这一层负责，插槽里的表单只管自己的宽度。
      -->
      <section
        class="bg-card/70 auth-sheet relative flex w-full flex-col items-center justify-center px-5 py-20 sm:px-10 lg:w-[48%] lg:border-l lg:border-border/60"
        data-auth="panel"
      >
        <slot></slot>
      </section>
    </main>

    <footer
      v-if="props.copyright || props.icp || $slots.footer"
      class="text-muted-foreground absolute right-0 bottom-0 left-0 z-20 flex flex-col items-center justify-center gap-1 px-4 py-3 text-center text-xs lg:items-start lg:justify-start lg:px-10 lg:text-left xl:px-14 2xl:px-20"
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

<style>
/*
 * 背景画布。
 *
 * 三条约束决定了这里的写法：
 * 1. **只从 `--primary` 派生**。全站主色只有一条链路（预设色板或取色器内联），
 *    装饰层再引第二套色值就会在换主题时裂成两种颜色。
 * 2. **光斑用 radial-gradient 画，不 `filter: blur()` 一块实色**。认证页是首屏，
 *    大半径 blur 在低配机与 Firefox 上会退化成整屏重绘；radial 的渐隐本身就是软的。
 * 3. **画布 `pointer-events: none` 且被 `overflow: hidden` 裁住**。光斑为了氛围刻意
 *    甩出视口，不裁就是横向滚动条（这一条 `login-page.spec.ts` 钉着）。
 */
.auth-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  /*
   * 先铺一层"上下各压一点"的底色，再叠光斑。
   * 只靠光斑的话，亮色档下 `--background` 是纯白，画布边缘仍然是大片空白 ——
   * 这一层保证无论主色是哪一档，整屏都有前后景的纵深。
   */
  background:
    linear-gradient(180deg, hsl(var(--primary) / 0.05) 0%, transparent 34%),
    linear-gradient(0deg, hsl(var(--foreground) / 0.03) 0%, transparent 26%);
}

.auth-canvas__glow {
  position: absolute;
  border-radius: 9999px;
  will-change: transform;
  /*
   * 静止态要写成具体的变换，不能省成默认的 `none`。
   *
   * Safari 内核（本仓库的 webkit 引擎）只在"变换函数列表 ↔ 函数列表"之间插值，
   * `none → translate3d(...)` 会第一帧就跳到终点；这条在 `overlay.vue` 上踩过一次，
   * 记录在 `layout-sidebar` 的注释里。这里补一个恒等变换，三个引擎才有同样的漂移帧。
   */
  transform: translate3d(0, 0, 0) scale(1);
}

.auth-canvas__glow--one {
  top: -14rem;
  left: -10rem;
  width: 46rem;
  height: 46rem;
  background: radial-gradient(
    circle,
    hsl(var(--primary) / 0.32) 0%,
    hsl(var(--primary) / 0.11) 42%,
    transparent 70%
  );
  animation: auth-drift-a 34s ease-in-out infinite alternate;
}

.auth-canvas__glow--two {
  right: -12rem;
  bottom: -16rem;
  width: 40rem;
  height: 40rem;
  background: radial-gradient(
    circle,
    hsl(var(--primary) / 0.24) 0%,
    hsl(var(--primary) / 0.08) 45%,
    transparent 72%
  );
  animation: auth-drift-b 28s ease-in-out infinite alternate;
}

.auth-canvas__glow--three {
  top: 30%;
  left: 38%;
  width: 30rem;
  height: 30rem;
  background: radial-gradient(
    circle,
    hsl(var(--primary) / 0.16) 0%,
    transparent 68%
  );
  animation: auth-drift-c 40s ease-in-out infinite alternate;
}

/* 网格：左半屏密、右半屏淡，靠 mask 淡出而不是调低不透明度，免得切出一条硬框 */
.auth-canvas__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(
      to right,
      hsl(var(--foreground) / 0.07) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      hsl(var(--foreground) / 0.07) 1px,
      transparent 1px
    );
  background-size: 3.5rem 3.5rem;
  -webkit-mask-image: radial-gradient(
    ellipse 78% 78% at 24% 40%,
    #000 0%,
    transparent 82%
  );
  mask-image: radial-gradient(
    ellipse 78% 78% at 24% 40%,
    #000 0%,
    transparent 82%
  );
  animation: auth-grid 120s linear infinite;
}

/*
 * 蓝图弧线：两圈同心细线，圆心甩在视口外，于是屏幕上只留一段弧。
 * 后台系统的"工程感"基本靠这种线条，比再堆一层光斑干净。
 */
.auth-canvas__arc {
  position: absolute;
  bottom: -26rem;
  left: -20rem;
  width: 56rem;
  height: 56rem;
  border: 1px solid hsl(var(--primary) / 0.16);
  border-radius: 9999px;
}

.auth-canvas__arc--inner {
  bottom: -20rem;
  left: -14rem;
  width: 44rem;
  height: 44rem;
  border-color: hsl(var(--primary) / 0.1);
}

/* 顶部光带：一条沿上沿跑过的主色高光，给整屏定个"入口"的方向感 */
.auth-canvas__horizon {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 8%,
    hsl(var(--primary) / 0.7) 34%,
    hsl(var(--primary) / 0.16) 62%,
    transparent 92%
  );
}

/* 品牌栏那半屏再加一层主色淡染，与右侧毛玻璃竖栏拉开前后关系 */
.auth-brand {
  background:
    radial-gradient(
      ellipse 80% 60% at 18% 22%,
      hsl(var(--primary) / 0.12) 0%,
      transparent 70%
    ),
    linear-gradient(
      160deg,
      hsl(var(--primary) / 0.08) 0%,
      transparent 46%,
      hsl(var(--primary) / 0.06) 100%
    );
}

/*
 * 表单竖栏的毛玻璃。
 *
 * `backdrop-filter` 必须连 `-webkit-` 一起写：Tailwind 的 `backdrop-blur-*` 只吐
 * 标准属性，Safari 内核会直接丢掉整条，于是玻璃变成一块不透明白。
 * 底色仍然交给模板上的 `bg-card/70`，这里只补模糊与前缀，避免两处抢同一个属性。
 */
.auth-sheet {
  -webkit-backdrop-filter: blur(1.25rem) saturate(150%);
  backdrop-filter: blur(1.25rem) saturate(150%);
}

/* 界面示意：整块极慢地上下浮，幅度只有 6px，当氛围不当特效 */
.auth-console {
  /* 同 `.auth-canvas__glow`：静止态给具体变换，webkit 才有中间帧 */
  transform: translate3d(0, 0, 0);
  animation: auth-float 16s ease-in-out infinite alternate;
}

.auth-console__bar {
  background: linear-gradient(
    to top,
    hsl(var(--primary) / 0.2) 0%,
    hsl(var(--primary) / 0.7) 100%
  );
}

@keyframes auth-drift-a {
  to {
    transform: translate3d(5rem, 3rem, 0) scale(1.12);
  }
}

@keyframes auth-drift-b {
  to {
    transform: translate3d(-4rem, -3rem, 0) scale(1.08);
  }
}

@keyframes auth-drift-c {
  to {
    transform: translate3d(3rem, -5rem, 0) scale(0.94);
  }
}

/* 网格正好走满一格（3.5rem），于是循环点与静止点在像素上重合，看不出接缝 */
@keyframes auth-grid {
  to {
    background-position: 3.5rem 3.5rem;
  }
}

@keyframes auth-float {
  to {
    transform: translate3d(0, -0.4rem, 0);
  }
}

/*
 * 动效纯粹是氛围，系统要求减少动效时全部停在原位：光斑、网格、示意都还在，
 * 只是不动 —— 与 `BorderBeam` 同一口径。
 */
@media (prefers-reduced-motion: reduce) {
  .auth-canvas__glow,
  .auth-canvas__grid,
  .auth-console {
    animation: none;
  }
}
</style>
