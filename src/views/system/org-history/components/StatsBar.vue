<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'

import type { OrgHistoryStatItem } from '../types'

import { getOrgHistoryStats } from '../api'
import { SCOPE_MAP } from '../constants'

defineOptions({ name: 'OrgHistoryStatsBar' })

const props = withDefaults(defineProps<{ days?: number }>(), { days: 30 })

const loading = ref(false)
const items = shallowRef<OrgHistoryStatItem[]>([])

async function load() {
  loading.value = true
  try {
    const { data: res } = await getOrgHistoryStats(props.days)
    items.value = res || []
  } finally {
    loading.value = false
  }
}

const totalCount = computed(() => items.value.reduce((acc, it) => acc + (it.count ?? 0), 0))

const displayItems = computed(() =>
  items.value.map((it) => ({
    scope: it.scope,
    label: SCOPE_MAP[it.scope] ?? it.scope,
    count: it.count ?? 0,
  })),
)

onMounted(load)
watch(() => props.days, load)
</script>

<template>
  <a-spin :spinning="loading">
    <a-row :gutter="[12, 12]">
      <a-col :xs="12" :sm="8" :md="6" :lg="4">
        <a-card size="small">
          <a-statistic title="近周期总量" :value="totalCount" />
        </a-card>
      </a-col>
      <a-col v-for="it in displayItems" :key="it.scope" :xs="12" :sm="8" :md="6" :lg="4">
        <a-card size="small">
          <a-statistic :title="it.label" :value="it.count" />
        </a-card>
      </a-col>
    </a-row>
  </a-spin>
</template>
