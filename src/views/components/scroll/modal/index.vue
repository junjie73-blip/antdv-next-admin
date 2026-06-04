<script setup lang="ts">
import { message } from 'antdv-next'
import { ref } from 'vue'
import { useModal } from '@/components/business/Modal'
import { cn } from '@/utils/cn'

const [registerBasicModal, basicModalMethods] = useModal()
const [registerLargeModal, largeModalMethods] = useModal()
const [registerNoFooterModal, noFooterModalMethods] = useModal()
const [registerAsyncModal, asyncModalMethods] = useModal()
const [_registerContentModal, _contentModalMethods] = useModal()

const containerClassName = cn('space-y-6')

const formData = ref({ name: '', email: '', description: '' })
const submittedData = ref('')

function handleSubmit() {
  submittedData.value = JSON.stringify(formData.value, null, 2)
  message.success('基础弹窗已提交')
  basicModalMethods?.closeModal()
}

const asyncLoading = ref(false)
const asyncResult = ref('')

function simulateAsyncLoad() {
  asyncLoading.value = true
  asyncResult.value = ''
  asyncModalMethods?.openModal()
  setTimeout(() => {
    asyncResult.value = `数据加载成功于 ${new Date().toLocaleTimeString()}`
    asyncLoading.value = false
    message.success('异步数据加载完成')
  }, 1500)
}

const contentModalVisible = ref(false)
const contentData = ref({
  id: 1,
  title: '动态内容弹窗',
  description: '点击下方按钮加载更多信息',
})

function switchContent() {
  contentModalVisible.value = true
  contentData.value = {
    id: Date.now(),
    title: `更新于 ${new Date().toLocaleTimeString()}`,
    description: '内容已动态更新',
  }
  message.info('内容已更新')
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="基础弹窗"
      variant="borderless"
    >
      <div class="space-y-4">
        <a-space>
          <a-button
            type="primary"
            @click="basicModalMethods?.openModal()"
          >
            打开弹窗
          </a-button>
          <a-button @click="basicModalMethods?.closeModal()">
            关闭弹窗
          </a-button>
        </a-space>
        <div
          v-if="submittedData"
          class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"
        >
          <h4 class="font-medium text-green-700 dark:text-green-300 mb-1">
            提交的数据：
          </h4>
          <pre class="text-sm text-green-600 dark:text-green-400">{{ submittedData }}</pre>
        </div>
      </div>
    </a-card>

    <a-card
      title="大尺寸弹窗"
      variant="borderless"
    >
      <a-space>
        <a-button
          type="primary"
          @click="largeModalMethods?.openModal()"
        >
          打开大尺寸弹窗
        </a-button>
      </a-space>
    </a-card>

    <a-card
      title="无底部按钮弹窗"
      variant="borderless"
    >
      <a-space>
        <a-button
          type="primary"
          @click="noFooterModalMethods?.openModal()"
        >
          打开弹窗（无底部按钮）
        </a-button>
      </a-space>
    </a-card>

    <a-card
      title="异步加载弹窗"
      variant="borderless"
    >
      <a-space>
        <a-button
          type="primary"
          :loading="asyncLoading"
          @click="simulateAsyncLoad"
        >
          异步加载打开
        </a-button>
      </a-space>
    </a-card>

    <a-card
      title="内容更新弹窗"
      variant="borderless"
    >
      <a-space>
        <a-button
          type="primary"
          @click="contentModalVisible = true"
        >
          打开内容弹窗
        </a-button>
        <a-button @click="switchContent">
          切换内容
        </a-button>
      </a-space>
    </a-card>

    <BasicModal
      title="基础弹窗"
      @register="registerBasicModal"
      @ok="handleSubmit"
    >
      <a-form
        :model="formData"
        layout="vertical"
      >
        <a-form-item
          label="姓名"
          required
        >
          <a-input
            v-model:value="formData.name"
            placeholder="请输入姓名"
          />
        </a-form-item>
        <a-form-item
          label="邮箱"
          required
        >
          <a-input
            v-model:value="formData.email"
            placeholder="请输入邮箱"
          />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea
            v-model:value="formData.description"
            placeholder="请输入描述"
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </BasicModal>

    <BasicModal
      title="大尺寸弹窗"
      width="800px"
      ok-text="确认"
      cancel-text="取消"
      @register="registerLargeModal"
    >
      <a-descriptions
        :column="2"
        bordered
        size="small"
      >
        <a-descriptions-item label="产品">
          Vue 3 Admin
        </a-descriptions-item>
        <a-descriptions-item label="版本">
          1.0.0
        </a-descriptions-item>
        <a-descriptions-item label="框架">
          Vue 3 + TypeScript
        </a-descriptions-item>
        <a-descriptions-item label="UI库">
          antdv-next
        </a-descriptions-item>
        <a-descriptions-item label="构建工具">
          Vite
        </a-descriptions-item>
        <a-descriptions-item label="包管理器">
          Bun
        </a-descriptions-item>
      </a-descriptions>
    </BasicModal>

    <BasicModal
      title="无底部按钮弹窗"
      :footer="null"
      @register="registerNoFooterModal"
    >
      <p class="text-gray-600 dark:text-gray-400">
        此弹窗没有底部按钮。点击 X 按钮关闭。
      </p>
    </BasicModal>

    <BasicModal
      title="异步加载数据"
      @register="registerAsyncModal"
      @ok="asyncModalMethods?.closeModal()"
    >
      <div
        v-if="asyncLoading"
        class="flex justify-center py-8"
      >
        <a-spin />
      </div>
      <div
        v-else
        class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
      >
        <h4 class="font-medium text-blue-700 dark:text-blue-300 mb-2">
          异步结果：
        </h4>
        <p class="text-blue-600 dark:text-blue-400">
          {{ asyncResult }}
        </p>
      </div>
    </BasicModal>

    <BasicModal
      v-model:open="contentModalVisible"
      title="Content Modal"
      @register="registerContentModal"
    >
      <div class="space-y-4">
        <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 class="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-2">
            {{ contentData.title }}
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            {{ contentData.description }}
          </p>
        </div>
        <div class="text-xs text-gray-400">
          ID: {{ contentData.id }}
        </div>
      </div>
    </BasicModal>
  </div>
</template>
