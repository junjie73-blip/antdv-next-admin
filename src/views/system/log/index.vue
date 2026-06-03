<script setup lang="tsx">
import type { DescriptionItem } from '@/components/business/Description'
import type { FormSchema } from '@/components/business/Form'
import type { BasicColumn } from '@/components/business/Table'
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import dayjs from 'dayjs'
import { ref } from 'vue'
import { Description as DetailDescription } from '@/components/business/Description'
import { BasicDrawer, useDrawer } from '@/components/business/Drawer'
import { BasicTable, useTable } from '@/components/business/Table'
import { cn } from '@/utils/cn'
import { exportToExcel } from '@/utils/excel'
import { usePrint } from '@/utils/print'

defineOptions({ name: 'SystemLog' })

interface OperLogRecord {
  id: number
  operName: string
  operType: string
  title: string
  method: string
  requestMethod: string
  operatorType: number
  operUrl: string
  operIp: string
  operLocation: string
  operParam: string
  jsonResult: string | null
  status: number
  errorMsg: string
  operTime: string
  costTime: number
}

const containerClassName = cn('space-y-4')
const cardClassName = cn('shadow-sm')
const tagClassName = cn('inline-flex items-center gap-1')
const actionClassName = cn('flex', 'items-center')
const btnClassName = cn('!px-0.5')
const dividerClassName = cn('mx-0')

// 操作类型映射
const operTypeColorMap: Record<string, string> = {
  其他: 'default',
  登录: 'blue',
  新增: 'green',
  修改: 'blue',
  删除: 'red',
  授权: 'cyan',
  导出: 'orange',
  导入: 'purple',
  强退: 'magenta',
  生成代码: 'geekblue',
  清空数据: 'volcano',
}

const statusColorMap: Record<number, string> = {
  0: 'green',
  1: 'red',
}

const statusLabelMap: Record<number, string> = {
  0: '成功',
  1: '失败',
}

const operatorTypeLabelMap: Record<number, string> = {
  1: '后台用户',
  2: '手机端用户',
}

// Mock 数据 — 丰富的操作日志
const mockData: OperLogRecord[] = [
  { id: 1, operName: 'admin', operType: '登录', title: '用户登录', method: 'com.system.controller.SysLoginController.login()', requestMethod: 'POST', operatorType: 1, operUrl: '/login', operIp: '192.168.1.100', operLocation: '北京市朝阳区', operParam: '{"username":"admin"}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 09:00:15', costTime: 156 },
  { id: 2, operName: 'admin', operType: '新增', title: '用户管理', method: 'com.system.controller.SysUserController.add()', requestMethod: 'POST', operatorType: 1, operUrl: '/system/user', operIp: '192.168.1.100', operLocation: '北京市朝阳区', operParam: '{"username":"testUser","nickname":"测试用户"}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 09:15:32', costTime: 89 },
  { id: 3, operName: 'admin', operType: '修改', title: '角色管理', method: 'com.system.controller.SysRoleController.edit()', requestMethod: 'PUT', operatorType: 1, operUrl: '/system/role/2', operIp: '192.168.1.100', operLocation: '北京市朝阳区', operParam: '{"roleId":2,"name":"管理员","status":1}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 09:30:45', costTime: 67 },
  { id: 4, operName: 'zhangsan', operType: '删除', title: '字典管理', method: 'com.system.controller.SysDictTypeController.remove()', requestMethod: 'DELETE', operatorType: 1, operUrl: '/system/dict/99', operIp: '192.168.1.101', operLocation: '上海市浦东新区', operParam: '{"dictId":99}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 10:05:18', costTime: 45 },
  { id: 5, operName: 'zhangsan', operType: '导出', title: '用户管理', method: 'com.system.controller.SysUserController.export()', requestMethod: 'GET', operatorType: 1, operUrl: '/system/user/export', operIp: '192.168.1.101', operLocation: '上海市浦东新区', operParam: '{}', jsonResult: '{"code":200,"msg":"导出成功，共100条数据"}', status: 0, errorMsg: '', operTime: '2024-06-03 10:20:33', costTime: 1234 },
  { id: 6, operName: 'lisi', operType: '授权', title: '角色管理', method: 'com.system.controller.SysRoleController.authDataScope()', requestMethod: 'PUT', operatorType: 1, operUrl: '/system/role/authDataScope', operIp: '192.168.1.102', operLocation: '广州市天河区', operParam: '{"roleId":3,"deptIds":[1,2,3]}', jsonResult: null, status: 1, errorMsg: '权限不足，无权进行此操作', operTime: '2024-06-03 10:45:22', costTime: 23 },
  { id: 7, operName: 'admin', operType: '修改', title: '菜单管理', method: 'com.system.controller.SysMenuController.edit()', requestMethod: 'PUT', operatorType: 1, operUrl: '/system/menu/5', operIp: '192.168.1.100', operLocation: '北京市朝阳区', operParam: '{"menuId":5,"menuName":"系统监控","orderNum":6}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 11:00:55', costTime: 78 },
  { id: 8, operName: 'wangwu', operType: '导入', title: '字典管理', method: 'com.system.controller.SysDictTypeController.importData()', requestMethod: 'POST', operatorType: 1, operUrl: '/system/dict/importData', operIp: '192.168.1.103', operLocation: '深圳市南山区', operParam: '{"file":"dict_data.xlsx"}', jsonResult: '{"code":200,"msg":"导入成功，共50条数据"}', status: 0, errorMsg: '', operTime: '2024-06-03 11:30:12', costTime: 2567 },
  { id: 9, operName: 'zhaoliu', operType: '强退', title: '在线用户', method: 'com.system.controller.SysUserOnlineController.forceLogout()', requestMethod: 'DELETE', operatorType: 1, operUrl: '/online/forceLogout/token-abc123', operIp: '192.168.1.104', operLocation: '杭州市西湖区', operParam: '{"tokenId":"token-abc123"}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 13:15:40', costTime: 34 },
  { id: 10, operName: 'admin', operType: '生成代码', title: '代码生成', method: 'com.tool.gen.controller.GenController.batchGenCode()', requestMethod: 'GET', operatorType: 1, operUrl: '/tool/gen/batchGenCode', operIp: '192.168.1.100', operLocation: '北京市朝阳区', operParam: '{"tables":["sys_user","sys_role"]}', jsonResult: null, status: 1, errorMsg: '模板不存在：/template/vue.vm', operTime: '2024-06-03 14:00:28', costTime: 890 },
  { id: 11, operName: 'sunqi', operType: '清空数据', title: '缓存管理', method: 'com.system.controller.SysCacheController.clearCache()', requestMethod: 'DELETE', operatorType: 1, operUrl: '/cache/clearCacheNames', operIp: '192.168.1.105', operLocation: '成都市武侯区', operParam: '{"cacheNames":["dict_cache","config_cache"]}', jsonResult: '{"code":200,"msg":"清理成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 14:30:55', costTime: 156 },
  { id: 12, operName: 'admin', operType: '登录', title: '用户登录', method: 'com.system.controller.SysLoginController.login()', requestMethod: 'POST', operatorType: 1, operUrl: '/login', operIp: '192.168.1.100', operLocation: '北京市朝阳区', operParam: '{"username":"admin"}', jsonResult: '{"code":400,"msg":"验证码错误"}', status: 1, errorMsg: '验证码错误', operTime: '2024-06-03 15:00:00', costTime: 89 },
  { id: 13, operName: 'zhouba', operType: '新增', title: '菜单管理', method: 'com.system.controller.SysMenuController.add()', requestMethod: 'POST', operatorType: 1, operUrl: '/system/menu', operIp: '192.168.1.106', operLocation: '武汉市洪山区', operParam: '{"menuName":"API文档","path":"/api-docs"}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 15:30:18', costTime: 112 },
  { id: 14, operName: 'wujiu', operType: '修改', title: '系统设置', method: 'com.system.controller.SysConfigController.updateConfig()', requestMethod: 'PUT', operatorType: 1, operUrl: '/system/config', operIp: '192.168.1.107', operLocation: '南京市鼓楼区', operParam: '{"configKey":"site.name","configValue":"新站点名称"}', jsonResult: '{"code":200,"msg":"操作成功"}', status: 0, errorMsg: '', operTime: '2024-06-03 16:00:42', costTime: 56 },
  { id: 15, operName: 'admin', operType: '删除', title: '用户管理', method: 'com.system.controller.SysUserController.remove()', requestMethod: 'DELETE', operatorType: 1, operUrl: '/system/user/99', operIp: '192.168.1.100', operLocation: '北京市朝阳区', operParam: '{"userId":99}', jsonResult: '{"code":500,"msg":"删除失败，该用户存在关联数据"}', status: 1, errorMsg: '删除失败，该用户存在关联数据', operTime: '2024-06-03 16:30:08', costTime: 145 },
]

const allData = ref<OperLogRecord[]>([...mockData])
const viewingRecord = ref<OperLogRecord | null>(null)

const [drawerRegister, drawerMethods] = useDrawer()
const [tableRegister, tableMethods] = useTable()

const operTypeOptions = [
  { label: '其他', value: '其他' },
  { label: '登录', value: '登录' },
  { label: '新增', value: '新增' },
  { label: '修改', value: '修改' },
  { label: '删除', value: '删除' },
  { label: '授权', value: '授权' },
  { label: '导出', value: '导出' },
  { label: '导入', value: '导入' },
  { label: '强退', value: '强退' },
  { label: '生成代码', value: '生成代码' },
  { label: '清空数据', value: '清空数据' },
]

const searchFormSchemas: FormSchema[] = [
  {
    field: 'operName',
    label: '操作人',
    component: 'Input',
    componentProps: {
      placeholder: '请输入操作人名称',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  {
    field: 'operType',
    label: '操作类型',
    component: 'Select',
    componentProps: {
      placeholder: '选择操作类型',
      allowClear: true,
      options: operTypeOptions,
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: [
        { label: '成功', value: 0 },
        { label: '失败', value: 1 },
      ],
    },
    colProps: { span: 6 },
  },
  {
    field: 'dateRange',
    label: '操作时间',
    component: 'RangePicker',
    componentProps: {
      placeholder: ['开始时间', '结束时间'],
      format: 'YYYY-MM-DD HH:mm:ss',
      showTime: true,
      allowClear: true,
    },
    colProps: { span: 6 },
  },
]

const detailSchemas: DescriptionItem[] = [
  { field: 'id', label: '日志编号' },
  { field: 'operName', label: '操作人' },
  {
    field: 'operType',
    label: '操作类型',
    render: value => <a-tag color={operTypeColorMap[value as string] || 'default'}>{value}</a-tag>,
  },
  { field: 'title', label: '操作模块' },
  {
    field: 'method',
    label: '请求方法',
    render: value => <span class="block truncate max-w-[300px]" title={value as string}>{value || '-'}</span>,
  },
  {
    field: 'requestMethod',
    label: '请求方式',
    render: (value) => {
      const methodColorMap: Record<string, string> = { GET: 'green', POST: 'blue', PUT: 'orange', DELETE: 'red' }
      return <a-tag color={methodColorMap[value as string] || 'default'}>{value}</a-tag>
    },
  },
  {
    field: 'operatorType',
    label: '操作类别',
    render: value => <span>{operatorTypeLabelMap[value as number] || '未知'}</span>,
  },
  {
    field: 'operUrl',
    label: '请求URL',
    render: value => <span class="block truncate max-w-[300px]" title={value as string}>{value || '-'}</span>,
  },
  { field: 'operIp', label: '主机地址' },
  { field: 'operLocation', label: '操作地点' },
  {
    field: 'operParam',
    label: '请求参数',
    render: value => <a-typography-paragraph copyable={{ text: value as string }} ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ margin: 0, maxWidth: 400 }} code>{(value as string) || '-'}</a-typography-paragraph>,
  },
  {
    field: 'jsonResult',
    label: '返回结果',
    render: value => value ? <a-typography-paragraph copyable={{ text: value as string }} ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ margin: 0, maxWidth: 400 }} code>{value as string}</a-typography-paragraph> : <span class="text-gray-400">-</span>,
  },
  {
    field: 'status',
    label: '操作状态',
    render: value => <a-tag color={statusColorMap[value as number] || 'default'}>{statusLabelMap[value as number] || '未知'}</a-tag>,
  },
  {
    field: 'errorMsg',
    label: '错误消息',
    render: value => (value as string) ? <a-typography-paragraph type="danger" ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} style={{ margin: 0, maxWidth: 400 }}>{value as string}</a-typography-paragraph> : <span class="text-gray-400">-</span>,
  },
  { field: 'operTime', label: '操作时间' },
  {
    field: 'costTime',
    label: '消耗时间',
    render: (value) => {
      const ms = value as number
      const color = ms > 1000 ? 'red' : ms > 500 ? 'orange' : 'green'
      return (
        <a-tag color={color}>
          {ms}
          {' '}
          ms
        </a-tag>
      )
    },
  },
]

async function mockApi(params: Record<string, any>) {
  const { operName, operType, status, dateRange, page = 1, pageSize = 10 } = params
  let filtered = [...allData.value]

  if (operName) {
    const kw = String(operName).toLowerCase()
    filtered = filtered.filter(i => i.operName.toLowerCase().includes(kw))
  }

  if (operType) {
    filtered = filtered.filter(i => i.operType === operType)
  }

  if (status !== undefined && status !== null && status !== '') {
    filtered = filtered.filter(i => i.status === Number(status))
  }

  // 时间范围筛选
  if (dateRange && Array.isArray(dateRange) && dateRange.length === 2) {
    const start = dayjs(dateRange[0])
    const end = dayjs(dateRange[1])
    filtered = filtered.filter(item =>
      dayjs(item.operTime).isAfter(start.subtract(1, 'second'))
      && dayjs(item.operTime).isBefore(end.add(1, 'second')),
    )
  }

  // 按时间倒序排列
  filtered.sort((a, b) => dayjs(b.operTime).valueOf() - dayjs(a.operTime).valueOf())

  const total = filtered.length
  const startIdx = (Number(page) - 1) * Number(pageSize)
  const items = filtered.slice(startIdx, startIdx + Number(pageSize))

  return { items, total }
}

function handleView(record: OperLogRecord | any) {
  viewingRecord.value = record as OperLogRecord
  drawerMethods.openDrawer()
}

function handleDelete(record: OperLogRecord | any) {
  const rec = record as OperLogRecord
  const idx = allData.value.findIndex(i => i.id === rec.id)
  if (idx > -1) {
    allData.value.splice(idx, 1)
    message.success(`已删除日志 #${rec.id}`)
    tableMethods.value?.reload()
  }
}

function handleBatchDelete() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OperLogRecord[]
  if (selectedRows.length === 0) {
    message.warning('请先选择要删除的日志')
    return
  }
  const ids = new Set(selectedRows.map(i => i.id))
  allData.value = allData.value.filter(i => !ids.has(i.id))
  message.success(`批量删除 ${ids.size} 条日志成功`)
  tableMethods.value?.reload()
}

function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as OperLogRecord[]
  const dataToExport = selectedRows.length > 0 ? selectedRows : allData.value

  exportToExcel({
    filename: '操作日志',
    sheetName: '操作日志',
    columns: [
      { header: '日志编号', key: 'id', width: 10 },
      { header: '操作人', key: 'operName', width: 12 },
      { header: '操作类型', key: 'operType', width: 10 },
      { header: '操作模块', key: 'title', width: 14 },
      { header: '请求方式', key: 'requestMethod', width: 8 },
      { header: '请求URL', key: 'operUrl', width: 30 },
      { header: '主机地址', key: 'operIp', width: 16 },
      { header: '操作地点', key: 'operLocation', width: 18 },
      { header: '操作状态', key: 'status', width: 8 },
      { header: '消耗时间(ms)', key: 'costTime', width: 12 },
      { header: '操作时间', key: 'operTime', width: 20 },
    ],
    data: dataToExport.map(i => ({
      ...i,
      status: i.status === 0 ? '成功' : '失败',
    })),
  })
}

function handlePrint() {
  usePrint({
    title: '操作日志',
    target: '.ant-card-body',
  })
}

function handleClear() {
  allData.value = []
  message.success('日志清空成功')
  tableMethods.value?.reload()
}

const columns: BasicColumn[] = [
  { title: '日志编号', dataIndex: 'id', key: 'id', width: 90, align: 'center' },
  { title: '操作人', dataIndex: 'operName', key: 'operName', width: 100, align: 'center' },
  { title: '操作类型', dataIndex: 'operType', key: 'operType', width: 90, align: 'center' },
  { title: '操作模块', dataIndex: 'title', key: 'title', width: 120 },
  { title: '请求方式', dataIndex: 'requestMethod', key: 'requestMethod', width: 85, align: 'center' },
  { title: '主机', dataIndex: 'operIp', key: 'operIp', width: 140, ellipsis: true },
  { title: '操作地点', dataIndex: 'operLocation', key: 'operLocation', width: 130, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 70, align: 'center' },
  { title: '耗时', dataIndex: 'costTime', key: 'costTime', width: 80, align: 'center' },
  { title: '操作时间', dataIndex: 'operTime', key: 'operTime', width: 165 },
]
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="操作日志"
      :class="cardClassName"
    >
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :action-column="{ width: 150, title: '操作', fixed: 'right' }"
        :row-selection="{ type: 'checkbox' }"
        :pagination="{ showSizeChanger: true,
                       pageSizeOptions: ['10',
                                         '20',
                                         '50'] }"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button @click="handleExport">
            <template #icon>
              <Icon icon="carbon:export" />
            </template>
            导出
          </a-button>
          <a-button @click="handlePrint">
            <template #icon>
              <Icon="carbon:printer" />
            </template>
            打印
          </a-button>
          <a-button
            danger
            @click="handleBatchDelete"
          >
            <template #icon>
              <Icon icon="ant-design:delete-outlined" />
            </template>
            批量删除
          </a-button>
          <a-popconfirm
            title="确定要清空所有操作日志吗？此操作不可恢复！"
            @confirm="handleClear"
          >
            <a-button danger>
              <template #icon>
                <Icon icon="carbon:trash-can" />
              </template>
              清空
            </a-button>
          </a-popconfirm>
        </template>

        <template #cell-operType="{ record }">
          <a-tag :color="operTypeColorMap[record.operType] || 'default'">
            {{ record.operType }}
          </a-tag>
        </template>

        <template #cell-requestMethod="{ record }">
          <a-tag :color="record.requestMethod === 'GET' ? 'green' : record.requestMethod === 'POST' ? 'blue' : record.requestMethod === 'PUT' ? 'orange' : 'red'">
            {{ record.requestMethod }}
          </a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record.status] || 'default'">
            <span :class="tagClassName">
              <Icon :icon="record.status === 0 ? 'carbon:checkmark-outline' : 'carbon:close-outline'" />
              {{ statusLabelMap[record.status] || '未知' }}
            </span>
          </a-tag>
        </template>

        <template #cell-costTime="{ record }">
          <a-tag :color="record.costTime > 1000 ? 'red' : record.costTime > 500 ? 'orange' : 'green'">
            {{ record.costTime }}ms
          </a-tag>
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <a-button
              type="link"
              :class="btnClassName"
              @click="() => handleView(record)"
            >
              <template #icon>
                <Icon icon="ant-design:eye-outlined" />
              </template>
              详情
            </a-button>
            <a-divider
              type="vertical"
              :class="dividerClassName"
            />
            <a-popconfirm
              :title="`确定要删除日志 #${record.id} 吗？`"
              @confirm="() => handleDelete(record)"
            >
              <a-button
                type="link"
                danger
                :class="btnClassName"
              >
                <template #icon>
                  <Icon icon="ant-design:delete-outlined" />
                </template>
                删除
              </a-button>
            </a-popconfirm>
          </div>
        </template>
      </BasicTable>
    </a-card>

    <!-- 日志详情抽屉 -->
    <BasicDrawer
      title="日志详情"
      :width="640"
      :show-footer="false"
      @register="drawerRegister"
    >
      <DetailDescription
        v-if="viewingRecord"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="1"
        bordered
      />
    </BasicDrawer>
  </div>
</template>
