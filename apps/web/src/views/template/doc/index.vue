<script setup lang="ts">
import { computed, ref } from 'vue';

import { PageHeader, Tag } from '@antdv/common-ui';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';

defineOptions({ name: 'TemplateDoc' });

/** 参考 admin 的文档预览：左侧文件列表 + 右侧预览画布 + 缩放/下载工具栏。 */
interface DocItem {
  icon: string;
  name: string;
  size: string;
  type: string;
  updated: string;
}

const docs: DocItem[] = [
  {
    icon: 'carbon:document',
    name: '产品设计说明书.pdf',
    size: '2.4 MB',
    type: 'PDF',
    updated: '2026-11-12',
  },
  {
    icon: 'carbon:document',
    name: '接口契约 v2.md',
    size: '86 KB',
    type: 'MD',
    updated: '2026-11-10',
  },
  {
    icon: 'carbon:image-service',
    name: '首页视觉稿.png',
    size: '1.8 MB',
    type: 'PNG',
    updated: '2026-11-08',
  },
  {
    icon: 'carbon:document',
    name: '数据字典.xlsx',
    size: '342 KB',
    type: 'XLSX',
    updated: '2026-11-05',
  },
  {
    icon: 'carbon:document',
    name: '部署手册.pdf',
    size: '920 KB',
    type: 'PDF',
    updated: '2026-10-29',
  },
];

const active = ref(0);
const zoom = ref(100);
const current = computed(() => docs[active.value]!);

function pick(index: number) {
  active.value = index;
  zoom.value = 100;
}
</script>

<template>
  <div class="space-y-4" data-page-view>
    <PageHeader
      description="文档在线预览与批注，参照参考实现的文件列表 + 预览画布 + 缩放工具栏。"
      icon="carbon:document"
      title="文档预览"
    />

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card class="shadow-sm">
        <CardHeader class="border-b border-border">
          <CardTitle class="text-base">文件列表（{{ docs.length }}）</CardTitle>
        </CardHeader>
        <CardContent class="space-y-1 pt-3">
          <button
            v-for="(doc, index) in docs"
            :key="doc.name"
            type="button"
            class="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors"
            :class="
              active === index ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
            "
            @click="pick(index)"
          >
            <Icon :icon="doc.icon" class="mt-0.5 size-4 shrink-0" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{
                doc.name
              }}</span>
              <span class="mt-0.5 block text-xs text-muted-foreground">
                {{ doc.type }} · {{ doc.size }} · {{ doc.updated }}
              </span>
            </span>
          </button>
        </CardContent>
      </Card>

      <Card class="shadow-sm">
        <CardHeader
          class="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border"
        >
          <div class="flex min-w-0 items-center gap-2">
            <CardTitle class="truncate text-base">{{ current.name }}</CardTitle>
            <Tag color="blue">{{ current.type }}</Tag>
          </div>
          <div class="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="缩小"
              :disabled="zoom <= 60"
              @click="zoom -= 20"
            >
              <Icon icon="carbon:zoom-out" class="size-4" />
            </Button>
            <span
              class="w-12 text-center text-xs tabular-nums text-muted-foreground"
            >
              {{ zoom }}%
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="放大"
              :disabled="zoom >= 160"
              @click="zoom += 20"
            >
              <Icon icon="carbon:zoom-in" class="size-4" />
            </Button>
            <Button size="sm" variant="outline" @click="zoom = 100">
              <Icon icon="carbon:fit-to-screen" class="size-4" /> 适应
            </Button>
            <Button size="sm" variant="outline">
              <Icon icon="carbon:download" class="size-4" /> 下载
            </Button>
          </div>
        </CardHeader>

        <CardContent
          class="flex min-h-[420px] items-start justify-center bg-muted/30 pt-6"
        >
          <article
            class="w-full max-w-2xl origin-top space-y-4 rounded-md bg-background p-8 text-sm shadow-sm ring-1 ring-border transition-transform"
            :style="{ transform: `scale(${zoom / 100})` }"
          >
            <div>
              <h2 class="text-lg font-semibold">{{ current.name }}</h2>
              <p class="mt-1 text-xs text-muted-foreground">
                文档类型 {{ current.type }} · 大小 {{ current.size }} · 更新于
                {{ current.updated }}
              </p>
            </div>
            <div class="border-t border-border pt-4">
              <h3 class="mb-2 font-medium">1. 概述</h3>
              <p class="leading-7 text-muted-foreground">
                本文档用于演示在线预览能力。左侧文件列表切换文档，右上角工具栏可缩放、
                适应宽度与下载。实际接入时把这里替换为 PDF / Office /
                图片的渲染器即可。
              </p>
            </div>
            <div>
              <h3 class="mb-2 font-medium">2. 内容与批注</h3>
              <p class="leading-7 text-muted-foreground">
                预览区支持选中文本、添加批注与高亮标注，批注按段落锚定，
                刷新后仍可还原。参考实现中该区域由文件预览组件承载，
                本项目使用内部 shadcn 原语组合出等价的结构与交互。
              </p>
            </div>
            <div
              class="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground"
            >
              第 1 页 / 共 6 页 · 预览模式
            </div>
          </article>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
