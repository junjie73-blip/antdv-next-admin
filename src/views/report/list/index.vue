<template>
  <div :class="containerClassName">
    <a-card
      :bordered="false"
      class="h-full"
      :body-style="{
        padding: '12px',
      }"
    >
      <!-- 分类 -->
      <div class="mb-4 flex flex-wrap gap-2">
        <a-button
          v-for="cat in CATEGORIES"
          :key="cat.value"
          :type="category === cat.value ? 'primary' : 'default'"
          size="small"
          @click="handleCategoryChange(cat.value)"
        >
          {{ cat.label }}
        </a-button>
      </div>

      <a-spin :spinning="loading">
        <a-row :gutter="[16, 16]" v-if="list.length > 0">
          <a-col v-for="report in list" :key="report.report_id" :xs="24" :sm="12" :md="8" :lg="6">
            <a-card hoverable class="h-full cursor-pointer" @click="openReport(report)">
              <div class="flex items-start justify-between">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon icon="lucide:bar-chart-3" class="h-5 w-5" />
                </div>
                <a-button type="text" size="small" @click.stop="handleFavorite(report)">
                  <template #icon>
                    <Icon
                      :icon="report.isFavorite ? 'lucide:star' : 'lucide:star-off'"
                      :class="report.isFavorite ? 'text-amber-500' : 'text-gray-300'"
                    />
                  </template>
                </a-button>
              </div>

              <div class="mt-3">
                <div class="truncate font-medium text-gray-800">
                  {{ report.report_name }}
                </div>
                <div class="mt-1 line-clamp-2 h-10 text-sm text-gray-500">
                  {{ report.description || '暂无描述' }}
                </div>
              </div>

              <div class="mt-3 flex items-center justify-between border-t pt-2 text-xs text-gray-400">
                <a-tag v-if="report.category" size="small">{{ report.category }}</a-tag>
                <span v-else />
                <span>{{ dayjs(report.updated_at).format('YYYY-MM-DD') }}</span>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-empty v-if="list.length === 0" description="暂无报表" />
      </a-spin>

      <div v-if="total > pageSize" class="mt-4 flex justify-end">
        <a-pagination
          v-model:current="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          :show-size-changer="false"
          @change="fetchList"
        />
      </div>
    </a-card>

    <!-- ⭐ 报表查看抽屉 -->
    <ReportViewerDrawer v-model:open="viewerOpen" :report-code="viewerCode" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'

import { getReportList, toggleReportFavorite } from '~/api/report'
import dayjs from '~/utils/dayjs'

import ReportViewerDrawer from '../components/ReportViewerDrawer.vue'
import { CATEGORIES, containerClassName } from './constants'

defineOptions({ name: 'ReportList' })

const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(12)
const category = ref('')

/* ⭐ 抽屉状态 */
const viewerOpen = ref(false)
const viewerCode = ref<string | null>(null)

async function fetchList() {
  loading.value = true
  try {
    const { data: res } = await getReportList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      category: category.value || undefined,
    })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function handleCategoryChange(val: string) {
  category.value = val
  pageNum.value = 1
  fetchList()
}

async function handleFavorite(report: any) {
  const res = await toggleReportFavorite(report.report_id)
  report.isFavorite = res.isFavorite
}

function openReport(report: any) {
  // ⭐ 改为打开抽屉，不再路由跳转
  viewerCode.value = report.report_code
  viewerOpen.value = true
}

onMounted(fetchList)
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
