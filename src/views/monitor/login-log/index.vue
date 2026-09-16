<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { nextTick, ref } from "vue";
import { message } from "antdv-next";
import dayjs from "dayjs";

import { exportLoginLog, getLoginLogList } from "@/api";
import { Description } from "@/components/business/Description";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicTable, useTable } from "@/components/business/Table";

// 抽离的模块
import {
  loginLogActionColumn,
  loginLogColumns,
  loginLogPagination,
  loginLogRowKey,
  loginLogScroll,
} from "./columns";
import { LOGIN_STATUS_COLOR_MAP, LOGIN_STATUS_LABEL_MAP } from "./constants";
import { loginLogDetailSchemas, loginLogSearchSchemas } from "./schemas";
import { actionClassName, btnClassName, cardClassName, containerClassName } from "./style";
import type { LoginLogRecord } from "./types";

defineOptions({ name: "SystemLoginLog" });

// ========== 表格 / 抽屉实例 ==========
const [tableRegister, tableMethods] = useTable();
const [drawerRegister, drawerMethods] = useDrawer();
const viewingRecord = ref<LoginLogRecord | null>(null);

// ========== 数据加载 ==========
async function fetchApi(params: Record<string, any>) {
  return await getLoginLogList(params);
}

// ========== 详情 ==========
function handleView(record: LoginLogRecord) {
  viewingRecord.value = null;
  nextTick(() => {
    viewingRecord.value = record;
    drawerMethods.openDrawer();
  });
}

// ========== 导出 ==========
async function handleExport() {
  const rawParams = tableMethods.value?.getFormValues() || {};
  const searchParams = { ...rawParams }; // 浅拷贝，避免污染表单内部 model

  if (searchParams.dateRange && Array.isArray(searchParams.dateRange)) {
    searchParams.startTime = dayjs(searchParams.dateRange[0]).format("YYYY-MM-DD HH:mm:ss");
    searchParams.endTime = dayjs(searchParams.dateRange[1]).format("YYYY-MM-DD HH:mm:ss");
    delete searchParams.dateRange;
  }

  try {
    await exportLoginLog(searchParams);
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
          :columns="loginLogColumns"
          :api="fetchApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: loginLogSearchSchemas, labelWidth: 80 }"
          :action-column="loginLogActionColumn"
          :pagination="loginLogPagination"
          :scroll="loginLogScroll"
          :row-key="loginLogRowKey"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button @click="handleExport">
              <template #icon><Icon icon="carbon:export" /></template>
              导出
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="LOGIN_STATUS_COLOR_MAP[record.status] || 'default'">
              {{ LOGIN_STATUS_LABEL_MAP[record.status] || "未知" }}
            </a-tag>
          </template>

          <template #action="{ record }">
            <div :class="actionClassName">
              <a-button
                type="link"
                :class="btnClassName"
                @click="() => handleView(record as LoginLogRecord)"
              >
                <template #icon><Icon icon="ant-design:eye-outlined" /></template>
                详情
              </a-button>
            </div>
          </template>
        </BasicTable>
      </div>
    </div>

    <!-- 详情抽屉 -->
    <BasicDrawer
      title="登录日志详情"
      :width="640"
      :show-footer="false"
      @register="drawerRegister"
      @close="viewingRecord = null"
    >
      <Description
        v-if="viewingRecord"
        :key="viewingRecord.logId"
        :data="viewingRecord"
        :schema="loginLogDetailSchemas"
        :column="1"
      />
    </BasicDrawer>
  </div>
</template>
