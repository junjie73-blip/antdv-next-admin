<script setup lang="ts">
import { ProjectTablePage } from '~/components/project';

defineOptions({ name: 'ProjectList' });
</script>

<template>
  <ProjectTablePage
    description="全部项目的检索与管理，创建后自动生成阶段排期，进度由任务完成情况汇总。"
    icon="carbon:list"
    kind="projects"
    title="项目列表"
  />
</template>
