<script setup lang="ts">
import { computed } from 'vue'

import { http } from '@/utils'

const props = defineProps<{ idA: string; idB: string }>()

const diff = ref<any>(null)

async function load() {
  diff.value = await http.Post(`/system/org-snapshot/${props.idA}/diff/${props.idB}`)
}

const sections = computed(() => {
  if (!diff.value) return []
  const d = diff.value.detail
  const s = diff.value.summary
  return [
    { key: 'deptAdded', title: '新增部门', count: s.dept.added, items: d.deptAdded, type: 'add' },
    {
      key: 'deptRemoved',
      title: '删除部门',
      count: s.dept.removed,
      items: d.deptRemoved,
      type: 'remove',
    },
    {
      key: 'deptUpdated',
      title: '部门信息变更',
      count: s.dept.updated,
      items: d.deptUpdated,
      type: 'change',
    },
    { key: 'userAdded', title: '新增用户', count: s.user.added, items: d.userAdded, type: 'add' },
    {
      key: 'userRemoved',
      title: '移除用户',
      count: s.user.removed,
      items: d.userRemoved,
      type: 'remove',
    },
    {
      key: 'userDeptAdded',
      title: '加入部门',
      count: s.userDept.added,
      items: d.userDeptAdded,
      type: 'add',
    },
    {
      key: 'userDeptRemoved',
      title: '离开部门',
      count: s.userDept.removed,
      items: d.userDeptRemoved,
      type: 'remove',
    },
    {
      key: 'userRoleAdded',
      title: '分配角色',
      count: s.userRole.added,
      items: d.userRoleAdded,
      type: 'add',
    },
    {
      key: 'userRoleRemoved',
      title: '移除角色',
      count: s.userRole.removed,
      items: d.userRoleRemoved,
      type: 'remove',
    },
  ].filter((s) => s.count > 0)
})
</script>

<template>
  <div class="space-y-4 p-4">
    <a-card v-if="diff">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-slate-500">快照 A</div>
          <div class="text-lg font-medium">
            {{ diff.snapshotA.date.slice(0, 10) }}
            <span class="ml-2 text-xs text-slate-400">
              {{ diff.snapshotA.userCount }} 用户 / {{ diff.snapshotA.deptCount }} 部门
            </span>
          </div>
        </div>
        <Icon icon="ant-design:swap-outlined" class="text-2xl text-slate-400" />
        <div>
          <div class="text-sm text-slate-500">快照 B</div>
          <div class="text-lg font-medium">
            {{ diff.snapshotB.date.slice(0, 10) }}
            <span class="ml-2 text-xs text-slate-400">
              {{ diff.snapshotB.userCount }} 用户 / {{ diff.snapshotB.deptCount }} 部门
            </span>
          </div>
        </div>
      </div>
    </a-card>

    <a-card v-for="s in sections" :key="s.key" :title="`${s.title}（${s.count}）`">
      <div v-if="s.type === 'change'" class="space-y-2">
        <div v-for="(item, i) in s.items" :key="i" class="flex items-center gap-2 text-sm">
          <a-tag color="orange">{{ item.changes.join('、') }}</a-tag>
          <span>{{ item.before.dept_name }} → {{ item.after.dept_name }}</span>
        </div>
      </div>
      <div v-else class="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div
          v-for="(item, i) in s.items"
          :key="i"
          class="rounded px-2 py-1 text-sm"
          :class="s.type === 'add' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
        >
          {{ item.deptName ?? item.userName ?? item.dept_name ?? item.real_name ?? item.user_id }}
        </div>
      </div>
    </a-card>
  </div>
</template>
