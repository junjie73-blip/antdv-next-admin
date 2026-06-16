<script setup lang="ts">
import { ref } from 'vue'
import { useDrawer } from '@/components/business/Drawer'
import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')

const treeData = ref([
  { key: '1',
title: 'Root Node 1',
children: [
    { key: '1-1', title: 'Child 1-1' },
    { key: '1-2',
title: 'Child 1-2',
children: [
      { key: '1-2-1', title: 'Grandchild 1-2-1' },
    ] },
  ] },
  { key: '2', title: 'Root Node 2' },
])

const selectedTreeNode = ref<any>(null)
const activeTab = ref('info')

function onTreeSelect(_selectedKeys: string[], info: any) {
  selectedTreeNode.value = info.node
  message.info(`Selected: ${info.node.title}`)
}

const [registerBasicDrawer, basicDrawerMethods] = useDrawer()
const [registerLargeDrawer, largeDrawerMethods] = useDrawer()
const [registerNoFooterDrawer, noFooterDrawerMethods] = useDrawer()

const drawerForm = ref({ name: '', remark: '' })

function handleDrawerSubmit() {
  message.success(`Drawer submitted: ${JSON.stringify(drawerForm.value)}`)
  basicDrawerMethods?.closeDrawer()
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="Basic Drawer"
      variant="borderless"
    >
      <div class="space-y-4">
        <a-space>
          <a-button
            type="primary"
            @click="basicDrawerMethods?.openDrawer()"
          >
            Open Basic Drawer
          </a-button>
          <a-button @click="basicDrawerMethods?.closeDrawer()">
            Close Drawer
          </a-button>
        </a-space>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          Click to open a drawer with form content from the right side
        </p>
      </div>
    </a-card>

    <a-card
      title="Large Drawer"
      variant="borderless"
    >
      <a-space>
        <a-button
          type="primary"
          @click="largeDrawerMethods?.openDrawer()"
        >
          Open Large Drawer
        </a-button>
      </a-space>
    </a-card>

    <a-card
      title="No Footer Drawer"
      variant="borderless"
    >
      <a-space>
        <a-button
          type="primary"
          @click="noFooterDrawerMethods?.openDrawer()"
        >
          Open Drawer (No Footer)
        </a-button>
      </a-space>
    </a-card>

    <a-card
      title="Drawer with Tab Content"
      variant="borderless"
    >
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane
          key="info"
          tab="Info"
        >
          <a-descriptions
            :column="1"
            size="small"
          >
            <a-descriptions-item label="Component">
              antdv-next Drawer
            </a-descriptions-item>
            <a-descriptions-item label="Usage">
              Modal panels sliding in from edges
            </a-descriptions-item>
            <a-descriptions-item label="Placement">
              Right (default)
            </a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>
        <a-tab-pane
          key="tree"
          tab="Tree View"
        >
          <a-tree
            :tree-data="treeData"
            default-expand-all
            @select="onTreeSelect"
          />
          <div
            v-if="selectedTreeNode"
            class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm"
          >
            Selected: <strong>{{ selectedTreeNode.title }}</strong>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <BasicDrawer
      title="Basic Drawer"
      @register="registerBasicDrawer"
      @ok="handleDrawerSubmit"
    >
      <a-form
        :model="drawerForm"
        layout="vertical"
      >
        <a-form-item
          label="Name"
          required
        >
          <a-input
            v-model:value="drawerForm.name"
            placeholder="Enter name"
          />
        </a-form-item>
        <a-form-item label="Remark">
          <a-textarea
            v-model:value="drawerForm.remark"
            placeholder="Enter remark"
            :rows="4"
          />
        </a-form-item>
      </a-form>
    </BasicDrawer>

    <BasicDrawer
      title="Large Drawer"
      :width="800"
      @register="registerLargeDrawer"
    >
      <a-descriptions
        :column="2"
        bordered
        size="small"
        title="System Information"
      >
        <a-descriptions-item label="Product Name">
          Vue 3 Admin Pro
        </a-descriptions-item>
        <a-descriptions-item label="Version">
          v1.0.0
        </a-descriptions-item>
        <a-descriptions-item label="Framework">
          Vue 3.5 + TypeScript 5.9
        </a-descriptions-item>
        <a-descriptions-item label="UI Library">
          antdv-next 1.2
        </a-descriptions-item>
        <a-descriptions-item label="Build Tool">
          Vite 8
        </a-descriptions-item>
        <a-descriptions-item label="Package Manager">
          Bun
        </a-descriptions-item>
        <a-descriptions-item label="Storage">
          localStorageCacheStorage (encrypted)
        </a-descriptions-item>
        <a-descriptions-item label="Layout">
          Sidebar + Header + Content
        </a-descriptions-item>
      </a-descriptions>

      <a-divider />

      <h4 class="font-medium mb-3 text-gray-700 dark:text-gray-300">
        Tech Stack
      </h4>
      <a-space wrap>
        <a-tag color="blue">
          Vue 3
        </a-tag>
        <a-tag color="green">
          TypeScript
        </a-tag>
        <a-tag color="purple">
          Pinia
        </a-tag>
        <a-tag color="gold">
          Tailwind CSS
        </a-tag>
        <a-tag color="cyan">
          Vite
        </a-tag>
        <a-tag color="volcano">
          Bun
        </a-tag>
      </a-space>
    </BasicDrawer>

    <BasicDrawer
      title="No Footer Drawer"
      :footer="{ show: false }"
      @register="registerNoFooterDrawer"
    >
      <p class="text-gray-600 dark:text-gray-400">
        This drawer has no footer buttons. Use the X button or click mask to close.
      </p>

      <a-alert
        type="info"
        message="Tip"
        description="Drawers are great for forms, detail views, and settings panels that don't require a full page navigation."
        show-icon
        class="mt-4"
      />
    </BasicDrawer>
  </div>
</template>
