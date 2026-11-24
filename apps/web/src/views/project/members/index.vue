<script setup lang="ts">
import { ProjectTablePage } from '~/components/project';

defineOptions({ name: 'ProjectMembers' });
</script>

<template>
  <ProjectTablePage
    description="项目成员与角色分派，成员按项目维度归属，是任务负责人列表的来源。"
    icon="carbon:group"
    kind="members"
    title="项目成员"
  />
</template>
