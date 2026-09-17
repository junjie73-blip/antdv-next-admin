<script setup lang="ts">
import { message } from "antdv-next";
import { ref, watch } from "vue";

import type { DeptRecord } from "../types";

import { getDeptUsers, getUserAllOptions, updateDeptUsers } from "@/api";



defineOptions({ name: "DeptUserDrawer" });

const props = defineProps<{
  open: boolean;
  dept: DeptRecord | null;
}>();

const emit = defineEmits<{
  "update:open": [v: boolean];
  saved: [];
}>();

const loading = ref(false);
const saving = ref(false);
const selectedUserIds = ref<string[]>([]);
const userOptions = ref<{ label: string; value: string }[]>([]);

async function load() {
  if (!props.dept) return;
  loading.value = true;
  try {
    const [users, all] = await Promise.all([getDeptUsers(props.dept.deptId), getUserAllOptions()]);
    const allList = (all as any)?.data ?? all ?? [];
    userOptions.value = allList.map((u: any) => ({
      label: u.username || u.label,
      value: u.userId || u.value,
    }));
    selectedUserIds.value = (users as any[]).map((u: any) => u.userId ?? u);
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!props.dept) return;
  saving.value = true;
  try {
    await updateDeptUsers(props.dept.deptId, selectedUserIds.value);
    message.success("已保存");
    emit("saved");
    emit("update:open", false);
  } catch (e: any) {
    message.error(e?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

function close() {
  emit("update:open", false);
}

watch(
  () => props.open,
  (v) => {
    if (v) load();
  },
);
</script>

<template>
  <a-drawer
    :open="open"
    :title="`分配用户 - ${dept?.deptName || ''}`"
    :width="520"
    :footer="null"
    @close="close"
  >
    <div class="flex flex-col h-full">
      <div class="flex-1">
        <a-spin :spinning="loading">
          <a-select
            v-model:value="selectedUserIds"
            mode="multiple"
            placeholder="选择用户"
            :options="userOptions"
            :max-tag-count="10"
            show-search
            :filter-option="
              (input: string, opt: any) =>
                String(opt.label).toLowerCase().includes(input.toLowerCase())
            "
            class="w-full"
          />
          <div class="text-xs text-gray-400 mt-2">共 {{ userOptions.length }} 个可选用户</div>
        </a-spin>
      </div>

      <div class="flex justify-end gap-2 pt-4 border-t mt-4">
        <a-button @click="close">取消</a-button>
        <a-button type="primary"
:loading="saving"
@click="save">保存</a-button>
      </div>
    </div>
  </a-drawer>
</template>
