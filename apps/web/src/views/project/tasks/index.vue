<script setup lang="ts">
import { ProjectTablePage } from '~/components/project';

defineOptions({ name: 'ProjectTasks' });
</script>

<template>
  <ProjectTablePage
    description="分配给我的任务，可直接更新进度；进度会同步到所属阶段与项目。"
    icon="carbon:task"
    kind="tasks"
    mine
    title="我的任务"
  />
</template>
