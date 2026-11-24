<script setup lang="ts">
import { ProjectTablePage } from '~/components/project';

defineOptions({ name: 'ProjectTaskManage' });
</script>

<template>
  <ProjectTablePage
    description="任务的拆解、分配与排期维护；完成或延期会实时反映在项目进度中。"
    icon="carbon:edit"
    kind="tasks"
    title="任务管理"
  />
</template>
