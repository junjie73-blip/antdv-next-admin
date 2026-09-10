<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { ref } from "vue";
import { getOnlineList, kickOnline, kickAllOnline } from "@/api/system";
import { BasicTable, useTable } from "@/components/business/Table";
import { Modal, message } from "antdv-next";
import dayjs from "dayjs";

defineOptions({ name: "MonitorOnline" });

const [tableRegister, tableMethods] = useTable();

function formatTtl(ttl: number): string {
  if (ttl < 0) return "-";
  if (ttl < 60) return `${ttl} 秒`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)} 分钟`;
  return `${Math.floor(ttl / 3600)} 小时`;
}

async function handleKick(record: any) {
  Modal.confirm({
    title: "强制下线",
    content: `确定要强制用户「${record.username}」下线吗？`,
    async onOk() {
      await kickOnline(record.userId);
      message.success("已强制下线");
      tableMethods.value?.reload();
    },
  });
}

async function handleKickAll() {
  Modal.confirm({
    title: "全部下线",
    content: "确定要强制所有在线用户下线吗？",
    okType: "danger",
    async onOk() {
      await kickAllOnline();
      message.success("已全部下线");
      tableMethods.value?.reload();
    },
  });
}

const columns = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "用户名", dataIndex: "username", key: "username", width: 140 },
  { title: "真实姓名", dataIndex: "realName", key: "realName", width: 140 },
  { title: "登录IP", dataIndex: "ip", key: "ip", width: 160 },
  {
    title: "登录时间",
    dataIndex: "loginTime",
    key: "loginTime",
    width: 180,
    customRender: ({ record }: any) =>
      record.loginTime ? dayjs(record.loginTime).format("YYYY-MM-DD HH:mm:ss") : "-",
  },
  {
    title: "会话剩余",
    dataIndex: "ttl",
    key: "ttl",
    width: 120,
    align: "center",
    customRender: ({ record }: any) => formatTtl(record.ttl),
  },
];
</script>

<template>
  <a-card title="在线用户" :bordered="false" class="shadow-sm">
    <BasicTable
      :columns="columns"
      :api="getOnlineList"
      :immediate="true"
      :use-search-form="false"
      :scroll="{ x: 1000 }"
      :row-key="(r: any) => r.userId"
      :action-column="{ width: 140, title: '操作', fixed: 'right' }"
      @register="tableRegister"
    >
      <template #toolbar>
        <a-button danger @click="handleKickAll">
          <template #icon><Icon icon="ant-design:logout-outlined" /></template>
          全部下线
        </a-button>
      </template>
      <template #action="{ record }">
        <a-popconfirm title="确定强制下线该用户？" @confirm="() => handleKick(record)">
          <a-button type="link" danger size="small">强制下线</a-button>
        </a-popconfirm>
      </template>
    </BasicTable>
  </a-card>
</template>
