<script setup lang="ts">
import { ProjectTablePage } from '~/components/project';

defineOptions({ name: 'ProjectMine' });
</script>

<template>
  <ProjectTablePage
    description="我负责或参与的项目，可按项目列表进入排期与进度看板。"
    icon="carbon:user"
    kind="projects"
    mine
    title="我的项目"
  />
</template>
