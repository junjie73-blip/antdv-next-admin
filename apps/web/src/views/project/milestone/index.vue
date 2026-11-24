<script setup lang="ts">
import { ProjectTablePage } from '~/components/project';

defineOptions({ name: 'ProjectMilestone' });
</script>

<template>
  <ProjectTablePage
    description="项目阶段里程碑，完成度由该阶段下的任务汇总得出，延期节点一眼可见。"
    icon="carbon:milestone"
    kind="milestones"
    title="里程碑"
  />
</template>
