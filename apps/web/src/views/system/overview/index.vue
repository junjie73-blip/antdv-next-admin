<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Card, PageHeader, Tag } from '@antdv/common-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import {
  getDeptList,
  getPostList,
  getRoleList,
  getUserList,
} from '~/api/system';
import { unwrapApi } from '~/utils/log-format';

import MetricCard from '../components/MetricCard.vue';

/**
 * 系统管理总览。
 *
 * 本仓库刻意把系统管理的多数页面标成 `hidden`（导航只留三项），参考实现却是
 * 一整组可见菜单。这里用一个「总览」页承接全部入口：既不改导航精简的不变量，
 * 又让每个隐藏页都有稳定、可发现的一跳入口，标签页与面包屑仍走同一棵菜单树。
 */
defineOptions({ name: 'SystemOverview' });

interface NavItem {
  description: string;
  icon: string;
  path: string;
  title: string;
}

interface NavGroup {
  icon: string;
  items: NavItem[];
  title: string;
}

const router = useRouter();

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const statsGridClassName = cn(
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4',
);
const groupGridClassName = cn('grid grid-cols-1 gap-4 lg:grid-cols-2');
const itemGridClassName = cn('grid grid-cols-1 gap-2 sm:grid-cols-2');
const itemClassName = cn(
  'border-border flex items-start gap-3 rounded-md border p-3',
  'hover:bg-muted/40 hover:border-primary/50 transition-colors',
);
const itemIconClassName = cn('text-primary mt-0.5 text-lg');
const itemTitleClassName = cn('text-foreground text-sm font-medium');
const itemDescClassName = cn('text-muted-foreground mt-0.5 text-xs/5');
const groupHeaderClassName = cn('flex items-center gap-2');

const GROUPS: NavGroup[] = [
  {
    title: '组织与权限',
    icon: 'carbon:user-multiple',
    items: [
      {
        title: '用户管理',
        description: '账号、部门与角色的增删改查',
        icon: 'carbon:user',
        path: '/system/user',
      },
      {
        title: '角色管理',
        description: '角色与数据权限配置',
        icon: 'carbon:user-role',
        path: '/system/role',
      },
      {
        title: '菜单管理',
        description: '导航树与权限标识',
        icon: 'carbon:menu',
        path: '/system/menu',
      },
      {
        title: '部门管理',
        description: '部门、岗位与层级维护',
        icon: 'carbon:tree',
        path: '/system/dept',
      },
      {
        title: '岗位管理',
        description: '岗位编码与所属部门',
        icon: 'carbon:category',
        path: '/system/post',
      },
      {
        title: '组织架构图',
        description: '树形查看部门与岗位分布',
        icon: 'carbon:network-4',
        path: '/system/org-chart',
      },
    ],
  },
  {
    title: '内容与配置',
    icon: 'carbon:folder',
    items: [
      {
        title: '通知管理',
        description: '通知公告的发布与阅读状态',
        icon: 'carbon:notification',
        path: '/system/notice',
      },
      {
        title: '文件管理',
        description: '上传、预览、重命名与删除',
        icon: 'carbon:folder',
        path: '/system/file',
      },
      {
        title: '数据字典',
        description: '字典类型与字典项两级维护',
        icon: 'carbon:book',
        path: '/system/dict',
      },
      {
        title: '参数配置',
        description: '系统参数键值与功能开关',
        icon: 'carbon:settings-adjust',
        path: '/system/settings',
      },
      {
        title: '系统配置',
        description: '站点、安全、登录等七类面板',
        icon: 'carbon:settings',
        path: '/system/config',
      },
    ],
  },
  {
    title: '运行与监控',
    icon: 'carbon:activity',
    items: [
      {
        title: '系统监控',
        description: '资源、进程与中间件实时快照',
        icon: 'carbon:screen',
        path: '/system/monitor',
      },
      {
        title: '在线用户',
        description: '会话列表与强制退出',
        icon: 'carbon:activity',
        path: '/system/online',
      },
      {
        title: '系统日志',
        description: '操作留痕与请求追踪',
        icon: 'carbon:document',
        path: '/system/log',
      },
      {
        title: '登录日志',
        description: '登录轨迹与失败统计',
        icon: 'carbon:login',
        path: '/system/login-log',
      },
      {
        title: '客户端日志',
        description: '前端上报与异常降级记录',
        icon: 'carbon:terminal',
        path: '/system/client-log',
      },
      {
        title: '验证码日志',
        description: '验证码发送与校验结果',
        icon: 'carbon:scan',
        path: '/system/captcha-log',
      },
    ],
  },
];

const totals = ref({ dept: 0, post: 0, role: 0, user: 0 });
const statsLoading = ref(true);
const statsError = ref('');

async function loadTotals() {
  statsLoading.value = true;
  statsError.value = '';
  try {
    const [user, role, dept, post] = await Promise.all([
      getUserList({ pageNum: 1, pageSize: 1 }),
      getRoleList({ pageNum: 1, pageSize: 1 }),
      getDeptList({ pageNum: 1, pageSize: 1 }),
      getPostList({ pageNum: 1, pageSize: 1 }),
    ]);
    const totalOf = (res: unknown) =>
      Number(unwrapApi<{ total?: number }>(res)?.total ?? 0);
    totals.value = {
      dept: totalOf(dept),
      post: totalOf(post),
      role: totalOf(role),
      user: totalOf(user),
    };
  } catch (error) {
    statsError.value =
      error instanceof Error ? error.message : '统计接口暂不可用';
  } finally {
    statsLoading.value = false;
  }
}

onMounted(loadTotals);

function open(path: string) {
  router.push(path);
}
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      title="系统管理总览"
      description="按组织权限、内容配置、运行监控三组汇总全部系统能力，隐藏页面从这里一跳直达"
      icon="carbon:settings"
    >
      <template #extra>
        <Button
          variant="outline"
          size="sm"
          :disabled="statsLoading"
          @click="loadTotals"
        >
          <Icon icon="carbon:renew" />
          刷新统计
        </Button>
      </template>
    </PageHeader>

    <div :class="statsGridClassName">
      <MetricCard
        title="系统用户"
        :value="totals.user"
        suffix="人"
        icon="carbon:user"
      />
      <MetricCard
        title="角色"
        :value="totals.role"
        suffix="个"
        icon="carbon:user-role"
        tone="info"
      />
      <MetricCard
        title="部门"
        :value="totals.dept"
        suffix="个"
        icon="carbon:tree"
        tone="success"
      />
      <MetricCard
        title="岗位"
        :value="totals.post"
        suffix="个"
        icon="carbon:category"
        tone="warning"
      />
    </div>

    <p v-if="statsError" class="text-xs text-destructive">{{ statsError }}</p>

    <div :class="groupGridClassName">
      <Card
        v-for="group in GROUPS"
        :key="group.title"
        :title="group.title"
        :class="cardClassName"
      >
        <template #extra>
          <span :class="groupHeaderClassName">
            <Icon :icon="group.icon" class="text-base text-primary" />
            <Tag color="blue">{{ group.items.length }} 项</Tag>
          </span>
        </template>

        <div :class="itemGridClassName">
          <div
            v-for="item in group.items"
            :key="item.path"
            :class="itemClassName"
          >
            <Icon :icon="item.icon" :class="itemIconClassName" />
            <div class="min-w-0 flex-1">
              <p :class="itemTitleClassName">{{ item.title }}</p>
              <p :class="itemDescClassName">{{ item.description }}</p>
            </div>
            <Button variant="ghost" size="sm" @click="open(item.path)">
              <Icon icon="carbon:arrow-right" />
              打开
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
