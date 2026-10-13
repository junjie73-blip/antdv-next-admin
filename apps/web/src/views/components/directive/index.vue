<script setup lang="ts">
import type {
  PermissionCheckContext,
  PermissionCheckers,
} from '@antdv/directives';

import { computed, onUnmounted, reactive, ref, watch } from 'vue';

import { createPermissionDirective } from '@antdv/directives';
import { Scrollbar } from '@antdv/scrollbar-ui';
import { cn } from '@antdv/shared/cn';
import { Button as AButton, Card as ACard, Checkbox as ACheckbox, CheckboxGroup as ACheckboxGroup } from 'antdv-next';
import audioUrl from '~/assets/images/audio.jpg';
import excelUrl from '~/assets/images/excel.jpg';
import imgUrl from '~/assets/images/img.jpg';
import logoUrl from '~/assets/images/logo.png';
import pptUrl from '~/assets/images/ppt.jpg';
import videoUrl from '~/assets/images/video.png';

/**
 * 自定义指令示例：本项目全局注册的五条
 * （`v-permission` / `v-loading` / `v-lazy` / `v-safe-html` / `v-escape`）各给一段
 * 真能点、真会变的例子。
 *
 * 注册处只有两个：实现与依赖注入在 `src/directives/index.ts`，挂载在 `src/main.ts`。
 * 本页不重复注册全局名，免得示例把真实指令的行为带偏。
 */

const containerClassName = cn('space-y-4');
const hintClassName = cn(
  'mb-3',
  'text-xs',
  'text-gray-500',
  'dark:text-gray-400',
);
const codeClassName = cn(
  'rounded-sm',
  'bg-gray-100',
  'px-1.5',
  'py-0.5',
  'font-mono',
  'text-xs',
  'dark:bg-gray-800',
);
const rowClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-2');
const boxClassName = cn(
  'rounded-md',
  'border',
  'border-gray-200',
  'p-6',
  'dark:border-gray-700',
);
const scrollBoxClassName = cn(boxClassName, 'max-h-52', 'overflow-auto');

/* ---------------------------------------------------------------- 权限指令 */

/**
 * 示例页自己造一条 `v-demo-permission`，判定数据来自下面两个本地 ref，
 * **不改 `useUserStore().permissions`**。
 *
 * 原因：真实权限表是持久化 `userInfo` 的 computed，示例页去写它等于把当前登录账号
 * 的权限改了，而且标签页 keep-alive 会把这个改动带出页面、带到别的页面去。
 * 本地实例顺便演示 `subscribe`：勾掉一个权限，已经渲染出来的按钮自己翻正。
 */
const grantedCodes = ref<string[]>(['user:add']);
const grantedRoles = ref<string[]>(['editor']);

const checkers = computed<PermissionCheckers>(() => {
  const codes = grantedCodes.value;
  const roles = grantedRoles.value;
  return {
    hasAllPermissions: (list) => list.every((item) => codes.includes(item)),
    hasAllRoles: (list) => list.every((item) => roles.includes(item)),
    hasAnyPermission: (list) => list.some((item) => codes.includes(item)),
    hasAnyRole: (list) => list.some((item) => roles.includes(item)),
    hasPermission: (code) => codes.includes(code),
    hasRole: (role) => roles.includes(role),
    // 与 `usePermission().isAdmin` 同构：超管角色放行一切 admin 门槛
    isAdmin: () => roles.includes('super'),
  };
});

/** 判定轨迹：只记"与上一条不同"的结果，避免自我触发的重渲染 */
const checkLog = ref<string[]>([]);

function recordCheck(context: PermissionCheckContext) {
  const declared = context.arg
    ? `${context.arg}=${JSON.stringify(context.value)}`
    : JSON.stringify(context.value);
  const modifiers = Object.keys(context.modifiers ?? {});
  const label = `${declared}${modifiers.length > 0 ? `.${modifiers.join('.')}` : ''} → ${
    context.hasAccess ? '放行' : '拦截'
  }`;
  if (checkLog.value[0] === label) return;
  checkLog.value = [label, ...checkLog.value].slice(0, 8);
}

const vDemoPermission = createPermissionDirective({
  checkers: () => checkers.value,
  onCheck: recordCheck,
  subscribe: (notify) =>
    watch([grantedCodes, grantedRoles], notify, { deep: true }),
});

/* ---------------------------------------------------------------- 加载指令 */

const loadingState = reactive({ box: false, dark: false, full: false });
type LoadingKey = keyof typeof loadingState;

let loadingTimer: null | ReturnType<typeof setTimeout> = null;

/**
 * 三个开关共用一个定时器：连点不同的块时先取消上一次的"自动收起"，
 * 否则新遮罩会被旧定时器提前关掉。
 *
 * 参数是**键名**而不是 ref：`<script setup>` 的模板表达式拿到的是自动解包后的值，
 * 写成 `@click="flashLoading(boxLoading)"` 传进函数的是 `false` 而不是 Ref，
 * 于是 `target.value = true` 抛 "Cannot create property 'value' on boolean 'false'"，
 * 遮罩永远不出现（第一版就是这么踩到的）。传键名 + 一个 reactive 记录就没这个坑。
 */
function flashLoading(key: LoadingKey, ms = 2000) {
  if (loadingTimer) clearTimeout(loadingTimer);
  loadingState[key] = true;
  loadingTimer = setTimeout(() => {
    loadingState[key] = false;
    loadingTimer = null;
  }, ms);
}

// 页面被 keep-alive 缓存时切走不等于卸载，定时器要跟着实例卸载清掉
onUnmounted(() => {
  if (loadingTimer) clearTimeout(loadingTimer);
});

/* ---------------------------------------------------------------- 懒加载指令 */

/**
 * 失败回退用 data: URI，而不是一个会 404 的外链：示例页要进全站巡检，
 * 图片请求落 4xx 会被记成"接口非 2xx"直接判红。data URI 让解码自然失败，
 * 同样演示得出 `error` 回退，且不产生任何请求。
 */
const brokenUrl = 'data:image/png;base64,@@not-a-real-image@@';

interface LazyItem {
  error: string;
  src: string;
  title: string;
}

const lazyGallery: LazyItem[] = [
  { error: '', src: imgUrl, title: '产品图 A' },
  { error: '', src: excelUrl, title: '附件缩略图' },
  { error: '', src: pptUrl, title: '汇报材料' },
  { error: '', src: audioUrl, title: '音频封面' },
  { error: '', src: videoUrl, title: '视频封面' },
  { error: logoUrl, src: brokenUrl, title: '坏图 → 回退 logo' },
];

/** 换 key 重挂图片墙，才能反复看到进视口加载与渐显 */
const lazyRun = ref(0);
const loadedTitles = ref<string[]>([]);

function onLazyLoaded(item: LazyItem, event: Event) {
  const element = event.target as HTMLImageElement;
  /**
   * 只有换成目标图才算"加载成功"：占位图和失败回退图同样会触发 `load`，
   * 直接计数会把 6 张图报成 12 张已加载。
   */
  if (
    !element.src.endsWith(item.src) ||
    loadedTitles.value.includes(item.title)
  )
    return;
  loadedTitles.value = [...loadedTitles.value, item.title];
}

function replayLazy() {
  loadedTitles.value = [];
  lazyRun.value += 1;
}

/* ---------------------------------------------------------------- XSS 两条指令 */

/**
 * 拆串而不是直接写：SFC 解析器在原文上扫闭合标签，看到字面的 "斜杠 script" 就认为
 * script 块结束了，整份文件会被截断。拼接是这里的语法约束，不是示例内容。
 */
const scriptTag = ['<scr', 'ipt>alert(1)</scr', 'ipt>'].join('');

/** 同一套拼接口径：这段要送去 `v-escape` 演示"当纯文本处理" */
const tokenScript = [
  '<scr',
  "ipt>fetch('/api/token').then(r => r.json())</scr",
  'ipt>',
].join('');

/**
 * 载荷里不用 `<img src=x onerror=...>`：onerror 会被剥掉，但 `src="x"` 留下来了，
 * 浏览器会去请求 `/x` 并落 404 —— 巡检把它算成接口错误。用 `<svg onload>` 同样能
 * 演示"事件处理器 + 危险标签"两道拦截，且不留请求。
 */
const dirtyHtml = `<h3>这段是可以渲染的富文本</h3>
<p>标题、加粗与<strong>列表</strong>都保留：</p>
<ul><li>合同已签署</li><li>发票已开具</li></ul>
${scriptTag}
<svg onload="alert(1)"></svg>
<a href="javascript:alert(1)">伪协议链接</a>
<p onclick="stealCookie()">带事件处理器的段落</p>`;

const dirtyText = tokenScript;

const unsafeUrl = ref('javascript:alert(document.cookie)');

/** 白名单收窄到只剩 `b/i/p`：同一份脏数据，列表与链接一个不剩 */
const strictSafeHtml = {
  allowedTags: ['b', 'i', 'p'],
  content: dirtyHtml,
};
</script>

<template>
  <div :class="containerClassName">
    <ACard title="v-permission 权限指令" variant="borderless">
      <p :class="hintClassName">
        全局那条的判定来自
        <code :class="codeClassName">usePermission()</code>（也就是当前登录用户的权限表）。 本页改用本地实例
        <code :class="codeClassName">v-demo-permission</code>，勾选左边的权限就能看到隐藏 / 置灰 / 任一命中 /
        全部命中四种行为，不会真的改动当前账号。
      </p>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="space-y-3">
          <div>
            <div class="mb-2 text-sm font-medium">授予的权限码</div>
            <ACheckboxGroup
              v-model:value="grantedCodes"
              class="flex flex-col gap-1"
            >
              <ACheckbox value="user:add">user:add</ACheckbox>
              <ACheckbox value="user:export">user:export</ACheckbox>
              <ACheckbox value="user:delete">user:delete</ACheckbox>
            </ACheckboxGroup>
          </div>
          <div>
            <div class="mb-2 text-sm font-medium">授予的角色</div>
            <ACheckboxGroup
              v-model:value="grantedRoles"
              class="flex flex-col gap-1"
            >
              <ACheckbox value="editor">editor</ACheckbox>
              <ACheckbox value="auditor">auditor</ACheckbox>
              <ACheckbox value="super">super（超管）</ACheckbox>
            </ACheckboxGroup>
          </div>
          <div>
            <div class="mb-2 text-sm font-medium">判定轨迹</div>
            <Scrollbar root-class="max-h-36">
              <div class="space-y-1 pr-2">
                <div v-if="checkLog.length === 0" :class="hintClassName">
                  还没有判定记录。
                </div>
                <div
                  v-for="(item, index) in checkLog"
                  :key="`${index}-${item}`"
                  :class="codeClassName"
                  class="block break-all"
                >
                  {{ item }}
                </div>
              </div>
            </Scrollbar>
          </div>
        </div>

        <div class="space-y-2">
          <div :class="rowClassName">
            <AButton v-demo-permission="'user:add'" type="primary">
              单权限码
            </AButton>
            <span :class="hintClassName">没有 user:add 时整块不占位</span>
          </div>
          <div :class="rowClassName">
            <AButton v-demo-permission="['user:export', 'user:delete']">
              任一命中
            </AButton>
            <span :class="hintClassName">
              <code :class="codeClassName">v-permission="['a','b']"</code>
              默认按 any 判定
            </span>
          </div>
          <div :class="rowClassName">
            <AButton v-demo-permission.all="['user:export', 'user:delete']">
              全部命中
            </AButton>
            <span :class="hintClassName">
              <code :class="codeClassName">.all</code> 改成 every
            </span>
          </div>
          <div :class="rowClassName">
            <AButton v-demo-permission:role="'auditor'">按角色</AButton>
            <span :class="hintClassName">
              <code :class="codeClassName">:role</code> 是指令的
              <strong>参数（arg）</strong>，字符串值因此按角色解释；写成
              <code :class="codeClassName">.role</code> 就变成修饰符，判定不认
            </span>
          </div>
          <div :class="rowClassName">
            <AButton v-demo-permission:admin danger type="primary">
              仅超管
            </AButton>
            <span :class="hintClassName">
              <code :class="codeClassName">:admin</code> 走
              <code :class="codeClassName">isAdmin()</code>
            </span>
          </div>
          <div :class="rowClassName">
            <AButton v-demo-permission.disabled="'user:export'">
              无权限时置灰
            </AButton>
            <span :class="hintClassName">
              <code :class="codeClassName">.disabled</code>
              保留可见只禁用，降级样式来自
              <code :class="codeClassName">.permission-disabled</code>
            </span>
          </div>
          <div :class="rowClassName">
            <AButton
              v-demo-permission="{
                mode: 'all',
                permission: ['user:add'],
                role: ['editor'],
              }"
            >
              对象写法
            </AButton>
            <span :class="hintClassName">权限与角色两组都要满足</span>
          </div>
        </div>
      </div>
    </ACard>

    <ACard title="v-loading 元素级遮罩" variant="borderless">
      <p :class="hintClassName">
        配置从属性读：
        <code :class="codeClassName">loading-tip</code>、
        <code :class="codeClassName">loading-theme</code>、
        <code :class="codeClassName">loading-size</code>、
        <code :class="codeClassName">loading-background</code>； 加
        <code :class="codeClassName">.fullscreen</code> 修饰符就挂到 body
        盖住整页。
      </p>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <div v-loading="loadingState.box" :class="boxClassName">
            <p class="m-0 text-sm">默认浅色遮罩，2 秒后自动收起。</p>
          </div>
          <AButton
            :loading="loadingState.box"
            class="mt-2"
            @click="flashLoading('box')"
          >
            加载这块
          </AButton>
        </div>
        <div>
          <div
            v-loading="loadingState.dark"
            :class="boxClassName"
            loading-size="large"
            loading-theme="dark"
            loading-tip="正在拉取报表…"
          >
            <p class="m-0 text-sm">深色主题 + 大尺寸 + 自定义文案。</p>
          </div>
          <AButton
            :loading="loadingState.dark"
            class="mt-2"
            @click="flashLoading('dark')"
          >
            加载那块
          </AButton>
        </div>
      </div>
      <div :class="rowClassName" class="mt-3">
        <AButton
          v-loading.fullscreen="loadingState.full"
          @click="flashLoading('full')"
        >
          整页遮罩
        </AButton>
        <span :class="hintClassName">
          路由切换时的全屏 loading 由
          <code :class="codeClassName">createFullscreenLoading()</code>
          做同一件事。
        </span>
      </div>
    </ACard>

    <ACard title="v-lazy 图片懒加载" variant="borderless">
      <p :class="hintClassName">
        进视口（提前 100px）才发请求，带渐显；加载失败回退到
        <code :class="codeClassName">error</code>
        图。已换成目标图 {{ loadedTitles.length }} /
        {{ lazyGallery.length }}
        张（最后一张是坏地址，只会出现在回退图上）。滚动下面的框，
        数字是逐步涨上来的；「重放」第二次会命中同 URL
        的全局缓存，所以会一次到位。
      </p>
      <div class="mb-2">
        <AButton @click="replayLazy">重放（重新挂载图片墙）</AButton>
      </div>
      <div :class="boxClassName">
        <Scrollbar root-class="max-h-64">
          <div
            :key="lazyRun"
            class="grid grid-cols-2 gap-3 pr-2 md:grid-cols-3"
          >
            <div v-for="item in lazyGallery" :key="item.src" class="space-y-1">
              <img
                v-lazy="{
                  duration: 400,
                  error: item.error,
                  fade: true,
                  placeholder: logoUrl,
                  rootMargin: '100px',
                  src: item.src,
                }"
                :alt="item.title"
                class="h-24 w-full rounded object-cover"
                @load="onLazyLoaded(item, $event)"
              />
              <div class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ item.title }}
                <span v-if="loadedTitles.includes(item.title)"> · 已加载</span>
              </div>
            </div>
          </div>
        </Scrollbar>
      </div>
    </ACard>

    <ACard title="v-safe-html 与 v-escape 防 XSS" variant="borderless">
      <p :class="hintClassName">
        富文本走
        <code :class="codeClassName">v-safe-html</code>：先按兜底规则剥离 script
        / svg / <code :class="codeClassName">on*</code> 处理器，再交 DOMPurify
        按白名单清理。 纯文本走 <code :class="codeClassName">v-escape</code>，用
        <code :class="codeClassName">:url</code> /
        <code :class="codeClassName">:js</code> /
        <code :class="codeClassName">:css</code> 切换转义口径。
        用户输入永远不要直接塞 <code :class="codeClassName">v-html</code>。
      </p>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div class="space-y-2">
          <div class="text-sm font-medium">原始脏数据（当纯文本展示）</div>
          <pre :class="scrollBoxClassName">{{ dirtyHtml }}</pre>
        </div>
        <div class="space-y-2">
          <div class="text-sm font-medium">v-safe-html 渲染结果</div>
          <!-- `data-safe-box` 是给 e2e 的观测点：同一份脏数据渲染两遍，靠类名选不出来 -->
          <div
            v-safe-html="dirtyHtml"
            :class="scrollBoxClassName"
            data-safe-box="default"
          ></div>
          <div class="text-sm font-medium">白名单收窄到 b / i / p</div>
          <div
            v-safe-html="strictSafeHtml"
            :class="boxClassName"
            data-safe-box="strict"
          ></div>
        </div>
      </div>
      <div class="mt-3 space-y-2">
        <div class="text-sm font-medium">
          v-escape：整段当纯文本显示，不会被解析成 HTML
        </div>
        <div :class="boxClassName">
          <!-- `data-escape-box` 是给 e2e 的观测点：指令的输出落在 span 里，
               而说明文字里也写着 `#unsafe-url`，靠文本选会同时选中两处 -->
          <span
            v-escape="dirtyText"
            class="break-all font-mono text-xs"
            data-escape-box="text"
          ></span>
        </div>
        <div class="text-sm font-medium">
          v-escape:url：伪协议换成
          <code :class="codeClassName">#unsafe-url</code>（控制台 warn 一次）
        </div>
        <div :class="rowClassName">
          <span
            v-escape:url="unsafeUrl"
            :class="codeClassName"
            data-escape-box="url"
          ></span>
          <AButton @click="unsafeUrl = 'https://example.com/report'">
            换成安全链接
          </AButton>
        </div>
      </div>
    </ACard>
  </div>
</template>
