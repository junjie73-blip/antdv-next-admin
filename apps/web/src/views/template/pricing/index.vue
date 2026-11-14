<script setup lang="ts">
import { ref } from 'vue';

import { PageHeader, Tag } from '@antdv/common-ui';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';

defineOptions({ name: 'TemplatePricing' });

/** 参考 admin 的三档套餐对比：Launch / Scale / Enterprise + 月付/年付切换。 */
const cycle = ref<'monthly' | 'yearly'>('monthly');

const plans = [
  {
    featured: false,
    features: ['3 个项目', '5 GB 存储空间', '基础报表', '社区支持'],
    icon: 'carbon:rocket',
    monthly: '¥ 0',
    name: 'Launch',
    tagline: '适合个人与小团队起步',
    yearly: '¥ 0',
  },
  {
    featured: true,
    features: [
      '无限项目',
      '200 GB 存储空间',
      '高级报表与设计器',
      '工作流与审批',
      '优先工单支持',
    ],
    icon: 'carbon:growth',
    monthly: '¥ 199',
    name: 'Scale',
    tagline: '适合成长中的业务团队',
    yearly: '¥ 1,990',
  },
  {
    featured: false,
    features: [
      '全部 Scale 能力',
      '私有化部署',
      'SSO / 审计日志',
      '专属客户成功经理',
      'SLA 保障',
    ],
    icon: 'carbon:building',
    monthly: '按需报价',
    name: 'Enterprise',
    tagline: '适合有合规与私有化要求的组织',
    yearly: '按需报价',
  },
];
</script>

<template>
  <div class="space-y-5" data-page-view>
    <PageHeader
      description="套餐与定价对比，参照参考实现的 Launch / Scale / Enterprise 三档结构与月付/年付切换。"
      icon="carbon:currency"
      title="定价"
    />

    <div class="flex items-center justify-center gap-2">
      <Button
        :variant="cycle === 'monthly' ? 'default' : 'outline'"
        size="sm"
        @click="cycle = 'monthly'"
      >
        月付
      </Button>
      <Button
        :variant="cycle === 'yearly' ? 'default' : 'outline'"
        size="sm"
        @click="cycle = 'yearly'"
      >
        年付 · 省 2 个月
      </Button>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card
        v-for="plan in plans"
        :key="plan.name"
        :class="plan.featured ? 'border-primary shadow-md' : 'shadow-sm'"
      >
        <CardHeader class="border-b border-border">
          <div class="flex items-center justify-between">
            <span
              class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Icon :icon="plan.icon" class="size-5" />
            </span>
            <Tag v-if="plan.featured" color="blue">最受欢迎</Tag>
          </div>
          <CardTitle class="mt-3 text-lg">{{ plan.name }}</CardTitle>
          <CardDescription>{{ plan.tagline }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4 pt-4">
          <div>
            <span class="text-3xl font-semibold tabular-nums">
              {{ cycle === 'monthly' ? plan.monthly : plan.yearly }}
            </span>
            <span
              v-if="plan.monthly !== '¥ 0' && plan.monthly !== '按需报价'"
              class="ml-1 text-sm text-muted-foreground"
            >
              / {{ cycle === 'monthly' ? '月' : '年' }}
            </span>
          </div>
          <ul class="space-y-2">
            <li
              v-for="feature in plan.features"
              :key="feature"
              class="flex items-start gap-2 text-sm"
            >
              <Icon
                icon="carbon:checkmark"
                class="mt-0.5 size-4 shrink-0 text-emerald-600"
              />
              <span>{{ feature }}</span>
            </li>
          </ul>
          <Button
            class="w-full"
            :variant="plan.featured ? 'default' : 'outline'"
          >
            {{ plan.monthly === '按需报价' ? '联系销售' : '选择套餐' }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
