<script setup lang="ts">
import { computed, ref } from 'vue';

import { PageHeader, Tag } from '@antdv/common-ui';
import { Button, Card, CardContent, Input } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';

defineOptions({ name: 'TemplateMasonry' });

/** 参考 admin 的瀑布流：关键字/分类过滤 + 错落卡片墙（CSS columns，不引第三方瀑布流库）。 */
interface Photo {
  category: string;
  height: number;
  id: number;
  likes: number;
  title: string;
  tone: string;
}

const keyword = ref('');
const category = ref('');
const categories = ['设计', '产品', '技术', '团队'];

const photos: Photo[] = [
  {
    category: '设计',
    height: 220,
    id: 1,
    likes: 128,
    title: '色彩系统规范',
    tone: 'from-blue-500/20 to-violet-500/20',
  },
  {
    category: '产品',
    height: 160,
    id: 2,
    likes: 96,
    title: '路线图工作坊',
    tone: 'from-emerald-500/20 to-cyan-500/20',
  },
  {
    category: '技术',
    height: 260,
    id: 3,
    likes: 214,
    title: '架构评审白板',
    tone: 'from-amber-500/20 to-orange-500/20',
  },
  {
    category: '团队',
    height: 190,
    id: 4,
    likes: 173,
    title: '季度复盘现场',
    tone: 'from-rose-500/20 to-pink-500/20',
  },
  {
    category: '设计',
    height: 240,
    id: 5,
    likes: 87,
    title: '组件库走查',
    tone: 'from-violet-500/20 to-fuchsia-500/20',
  },
  {
    category: '产品',
    height: 170,
    id: 6,
    likes: 142,
    title: '用户访谈记录',
    tone: 'from-sky-500/20 to-blue-500/20',
  },
  {
    category: '技术',
    height: 210,
    id: 7,
    likes: 305,
    title: '性能剖析截图',
    tone: 'from-teal-500/20 to-emerald-500/20',
  },
  {
    category: '团队',
    height: 150,
    id: 8,
    likes: 64,
    title: '团建合影',
    tone: 'from-indigo-500/20 to-blue-500/20',
  },
  {
    category: '设计',
    height: 200,
    id: 9,
    likes: 119,
    title: '图标集草稿',
    tone: 'from-orange-500/20 to-amber-500/20',
  },
  {
    category: '产品',
    height: 250,
    id: 10,
    likes: 188,
    title: '竞品分析矩阵',
    tone: 'from-cyan-500/20 to-teal-500/20',
  },
];

const visible = computed(() =>
  photos.filter(
    (photo) =>
      (!category.value || photo.category === category.value) &&
      (!keyword.value.trim() || photo.title.includes(keyword.value.trim())),
  ),
);
</script>

<template>
  <div class="space-y-4" data-page-view>
    <PageHeader
      description="瀑布流图片墙，参照参考实现的关键字/分类过滤与错落卡片布局（CSS columns 实现）。"
      icon="carbon:grid"
      title="瀑布流"
    />

    <Card class="shadow-sm">
      <CardContent class="flex flex-wrap items-center gap-2 pt-4">
        <Input
          v-model="keyword"
          class="w-full sm:w-56"
          placeholder="搜索图片标题"
        />
        <Button
          v-for="item in categories"
          :key="item"
          size="sm"
          :variant="category === item ? 'default' : 'outline'"
          @click="category = category === item ? '' : item"
        >
          {{ item }}
        </Button>
        <Button
          v-if="category || keyword"
          size="sm"
          variant="ghost"
          @click="
            category = '';
            keyword = '';
          "
        >
          <Icon icon="carbon:close" class="size-4" /> 清除
        </Button>
        <span class="ml-auto text-xs text-muted-foreground">
          共 {{ visible.length }} 张
        </span>
      </CardContent>
    </Card>

    <div class="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      <figure
        v-for="photo in visible"
        :key="photo.id"
        class="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-border bg-background shadow-sm"
      >
        <div
          class="flex items-center justify-center bg-gradient-to-br" :class="[
            photo.tone,
          ]"
          :style="{ height: `${photo.height}px` }"
        >
          <Icon
            icon="carbon:image-service"
            class="size-10 text-foreground/25"
          />
        </div>
        <figcaption class="space-y-2 p-3">
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-medium">{{ photo.title }}</span>
            <Tag color="blue">{{ photo.category }}</Tag>
          </div>
          <div class="flex items-center gap-1 text-xs text-muted-foreground">
            <Icon icon="carbon:view" class="size-3.5" />
            {{ photo.likes }} 次浏览
          </div>
        </figcaption>
      </figure>
    </div>

    <div
      v-if="!visible.length"
      class="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground"
    >
      没有匹配的图片，试试调整筛选条件
    </div>
  </div>
</template>
