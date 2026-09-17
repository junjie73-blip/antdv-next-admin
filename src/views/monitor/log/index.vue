<script setup lang="ts">


// 抽离的模块
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import dayjs from "dayjs";
import { nextTick, ref } from "vue";

import {
  auditLogActionColumn,
  auditLogColumns,
  auditLogPagination,
  auditLogRowKey,
  auditLogScroll,
} from "./columns";

import {
  AUDIT_STATUS_COLOR_MAP,
  AUDIT_STATUS_LABEL_MAP,
  EXECUTE_TIME_WARN_THRESHOLD,
} from "./constants";

import { auditLogSearchSchemas, createDetailSchemas } from "./schemas";
import { actionClassName, btnClassName, cardClassName, containerClassName } from "./style";

import type { AuditLogRecord } from "./types";

import { exportAuditLog, getAuditLogList } from "@/api";
import { Description } from "@/components/business/Description";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicTable, useTable } from "@/components/business/Table";

defineOptions({ name: "SystemAuditLog" });

// ========== 状态 ==========
const viewingRecord = ref<AuditLogRecord | null>(null);
const [drawerRegister, drawerMethods] = useDrawer();
const [tableRegister, tableMethods] = useTable();

// 详情 schema（VNode 每次调用新建）
const detailSchemas = createDetailSchemas();

// ========== 数据加载 ==========
async function fetchApi(params: Record<string, any>) {
  return await getAuditLogList(params);
}

// ========== 详情 ==========
function handleView(record: AuditLogRecord) {
  viewingRecord.value = null; // 先清空旧数据
  nextTick(() => {
    viewingRecord.value = record; // 再设置新数据
    drawerMethods.openDrawer();
  });
}

// ========== 导出 ==========
async function handleExport() {
  const searchParams = tableMethods.value?.getFormValues() || {};

  if (searchParams.dateRange && Array.isArray(searchParams.dateRange)) {
    searchParams.startTime = dayjs(searchParams.dateRange[0]).format("YYYY-MM-DD HH:mm:ss");
    searchParams.endTime = dayjs(searchParams.dateRange[1]).format("YYYY-MM-DD HH:mm:ss");
    delete searchParams.dateRange;
  }

  try {
    await exportAuditLog(searchParams);
    message.success("导出任务已提交");
  } catch (e: any) {
    message.error(e?.message || "导出失败");
  }
}
</script>

<template>
  <div :class="containerClassName">
    <div :class="cardClassName">
      <div class="p-4">
        <BasicTable
          :columns="auditLogColumns"
          :api="fetchApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: auditLogSearchSchemas, labelWidth: 80 }"
          :action-column="auditLogActionColumn"
          :pagination="auditLogPagination"
          :scroll="auditLogScroll"
          :row-key="auditLogRowKey"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button @click="handleExport">
              <template #icon><Icon icon="carbon:export" /></template>
              导出
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="AUDIT_STATUS_COLOR_MAP[record.status] || 'default'">
              {{ AUDIT_STATUS_LABEL_MAP[record.status] || "未知" }}
            </a-tag>
          </template>

          <template #cell-executeTime="{ record }">
            <span
              :style="{
                color:
                  record.executeTime > EXECUTE_TIME_WARN_THRESHOLD
                    ? 'var(--color-warning)'
                    : 'inherit',
              }"
            >
              {{ record.executeTime }} ms
            </span>
          </template>

          <template #action="{ record }">
            <div :class="actionClassName">
              <a-button
                type="link"
                :class="btnClassName"
                @click="() => handleView(record as AuditLogRecord)"
              >
                <template #icon><Icon icon="ant-design:eye-outlined" /></template>
                详情
              </a-button>
            </div>
          </template>
        </BasicTable>
      </div>
    </div>

    <!-- 日志详情抽屉 -->
    <BasicDrawer title="日志详情"
:width="921"
:show-footer="false"
@register="drawerRegister">
      <Description
        v-if="viewingRecord"
        :colon="false"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="1"
        :bordered="false"
      />
    </BasicDrawer>
  </div>
</template>
