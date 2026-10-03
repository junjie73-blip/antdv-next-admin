<script setup lang="ts">
import type { FormInstance, TableProps } from 'antdv-next'

import { Icon } from '@iconify/vue'
import { Select } from 'antdv-next'
import { computed, nextTick, ref, watch } from 'vue'

import type { TemplateParam } from '../types'

import { PARAM_TYPE_OPTIONS } from '../constants'

defineOptions({ name: 'TemplateVariableTable' })

/* ============================================================
 * 双向绑定
 * ============================================================ */
const params = defineModel<TemplateParam[]>('params', {
  default: () => [],
})

const props = withDefaults(
  defineProps<{
    content?: string
    title?: string
  }>(),
  {
    content: '',
    title: '',
  },
)

/* ============================================================
 * 表格数据模型
 * ------------------------------------------------------------
 * - 每行有 __rowKey（内部使用，不 emit）
 * - 用 antdv-next 的 row-key 保证删除行时焦点不乱
 * ============================================================ */
interface ParamRow extends TemplateParam {
  __rowKey: string
}

function genKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const dataSource = ref<ParamRow[]>((params.value ?? []).map((p) => ({ ...p, __rowKey: genKey() })))

/* ============================================================
 * 编辑状态
 * ============================================================ */
const editingKey = ref<string>('') // 空 = 无行编辑中
const formRef = ref<FormInstance>()
const formModel = ref<Partial<TemplateParam>>({})
const savingKey = ref<string>('')

/** 是否允许新增（编辑中禁止） */
const canAdd = computed(() => editingKey.value === '')

/* ============================================================
 * 表格列定义
 * ------------------------------------------------------------
 * - 用固定 px 宽度，避免 flex 布局把宽列挤压
 * - 用 a-table 的 tableLayout: 'fixed' 保证列宽生效
 * ============================================================ */
const columns = computed<TableProps['columns']>(() => [
  {
    title: '变量名',
    dataIndex: 'name',
    key: 'name',
    width: 220,
  },
  {
    title: '显示名',
    dataIndex: 'label',
    key: 'label',
    width: 220,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: 130,
  },
  {
    title: '必填',
    dataIndex: 'required',
    key: 'required',
    width: 80,
    align: 'center',
  },
  {
    title: '说明',
    dataIndex: 'description',
    key: 'description',
  },
  {
    title: '操作',
    key: 'operation',
    width: 140,
    align: 'center',
    fixed: 'right',
  },
])

/* ============================================================
 * 编辑动作
 * ============================================================ */
function isEditing(record: ParamRow): boolean {
  return record.__rowKey === editingKey.value
}

async function startEdit(record: ParamRow) {
  // 若已编辑其他行，先取消
  if (editingKey.value && editingKey.value !== record.__rowKey) {
    cancelEdit()
  }
  formModel.value = {
    name: record.name,
    label: record.label,
    type: record.type ?? 'string',
    required: record.required ?? false,
    description: record.description ?? '',
  }
  editingKey.value = record.__rowKey
  await nextTick()
  formRef.value?.clearValidate?.()
}

function cancelEdit() {
  editingKey.value = ''
  formModel.value = {}
  savingKey.value = ''
  formRef.value?.clearValidate?.()
}

async function saveEdit(record: ParamRow) {
  if (!formRef.value) return
  savingKey.value = record.__rowKey
  try {
    const values = (await formRef.value.validateFields()) as Partial<TemplateParam>

    // 校验重名（除自身外）
    const name = values.name?.trim()
    if (name) {
      const dup = dataSource.value.some((r) => r.__rowKey !== record.__rowKey && r.name === name)
      if (dup) {
        throw new Error(`变量名 "${name}" 已存在`)
      }
    }

    dataSource.value = dataSource.value.map((r) =>
      r.__rowKey === record.__rowKey ? { ...r, ...values, name: name ?? r.name } : r,
    )

    cancelEdit()
  } catch (err: any) {
    // validateFields 的 reject 会走这里；也可在此 message.error
    // console.warn("[variable-table] save failed:", err);
  } finally {
    savingKey.value = ''
  }
}

function removeRow(record: ParamRow) {
  dataSource.value = dataSource.value.filter((r) => r.__rowKey !== record.__rowKey)
  if (editingKey.value === record.__rowKey) cancelEdit()
}

function addRow() {
  if (!canAdd.value) return
  const row: ParamRow = {
    __rowKey: genKey(),
    name: '',
    label: '',
    type: 'string',
    required: false,
    description: '',
  }
  dataSource.value = [...dataSource.value, row]
  // 自动进入编辑
  void nextTick(() => startEdit(row))
}

function autoAddUndefinedVars() {
  if (!canAdd.value) return
  const toAdd = undefinedVars.value.filter((v) => !dataSource.value.some((r) => r.name === v))
  if (toAdd.length === 0) return
  const rows: ParamRow[] = toAdd.map((name) => ({
    __rowKey: genKey(),
    name,
    label: name,
    type: 'string',
    required: false,
    description: '',
  }))
  dataSource.value = [...dataSource.value, ...rows]
}

/* ============================================================
 * 变量统计
 * ============================================================ */
function extractVarNames(text: string): string[] {
  const raw = text ?? ''
  if (!raw) return []
  const regex = /\$\{(\w+)\}/g
  const set = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(raw)) !== null) set.add(m[1]!)
  return [...set]
}

const usedVars = computed(() => [...new Set([...extractVarNames(props.content), ...extractVarNames(props.title)])])

const definedNames = computed(() => new Set(dataSource.value.map((p) => p.name)))

const undefinedVars = computed(() => usedVars.value.filter((v) => !definedNames.value.has(v)))

const unusedNames = computed(() => [...definedNames.value].filter((v) => !usedVars.value.includes(v)))

/* ============================================================
 * 同步到父组件
 * ============================================================ */
watch(
  dataSource,
  (v) => {
    const cleaned = v.map(({ __rowKey, ...rest }) => rest)
    if (JSON.stringify(cleaned) !== JSON.stringify(params.value)) {
      params.value = cleaned
    }
  },
  { deep: true, immediate: true },
)

// 父 → 子
watch(
  () => params.value,
  (v) => {
    const incoming = (v ?? []).map((p) => {
      return { ...p, __rowKey: genKey() }
    })
    dataSource.value = incoming
  },
  { deep: true, immediate: true },
)

/* ============================================================
 * 工具
 * ============================================================ */
function varPlaceholder(name: string): string {
  return `\${${name}}`
}
const getPopContainer = () => document.body

defineExpose({ addRow, autoAddUndefinedVars })
</script>

<template>
  <div class="template-variable-table space-y-3">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300"> 变量定义 </span>
        <span
          v-if="usedVars.length > 0"
          class="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
        >
          已用 {{ usedVars.length }} 个
        </span>
      </div>
      <div class="flex items-center gap-1">
        <a-button
          v-if="undefinedVars.length > 0"
          size="small"
          type="link"
          class="!text-amber-600"
          :disabled="!canAdd"
          @click="autoAddUndefinedVars"
        >
          <template #icon><Icon icon="carbon:magic-wand" /></template>
          一键补齐
        </a-button>
        <a-button size="small" type="link" :disabled="!canAdd" @click="addRow">
          <template #icon><Icon icon="carbon:add" /></template>
          添加变量
        </a-button>
      </div>
    </div>

    <!-- 表格 -->
    <a-table
      :columns="columns"
      :data-source="dataSource"
      :pagination="false"
      :scroll="{ x: 900 }"
      size="small"
      bordered
      row-key="__rowKey"
      :row-class-name="(r: ParamRow) => (unusedNames.includes(r.name) ? 'row-unused' : '')"
    >
      <template #bodyCell="{ column, record }">
        <!-- ==================== 操作列 ==================== -->
        <template v-if="column.key === 'operation'">
          <template v-if="isEditing(record)">
            <a-space size="small">
              <a-button type="link" @click="saveEdit(record as ParamRow)">保存</a-button>
              <a-popconfirm title="确定取消编辑？" @confirm="cancelEdit" :get-popup-container="getPopContainer">
                <a-button danger type="link">取消</a-button>
              </a-popconfirm>
            </a-space>
          </template>
          <template v-else>
            <a-space size="small">
              <a-button type="link" :disabled="!canAdd" @click="startEdit(record as ParamRow)"> 编辑 </a-button>
              <a-popconfirm
                title="确定删除该变量？"
                :get-popup-container="getPopContainer"
                @confirm="removeRow(record as ParamRow)"
              >
                <a-button size="small" danger type="link">删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>

        <!-- ==================== 编辑模式：所有字段渲染输入控件 ==================== -->
        <template v-else-if="isEditing(record)">
          <!-- 变量名 -->
          <template v-if="column.key === 'name'">
            <a-form-item
              name="name"
              :rules="[
                { required: true, message: '请输入变量名' },
                { pattern: /^[a-zA-Z_]\w*$/, message: '字母开头，仅含字母数字下划线' },
              ]"
              :validate-status="undefined"
              class="mb-0"
            >
              <a-input
                v-model:value="formModel.name"
                size="small"
                placeholder="varName"
                :maxlength="64"
                class="var-input"
                @press-enter="saveEdit(record as ParamRow)"
              />
            </a-form-item>
          </template>

          <!-- 显示名 -->
          <template v-else-if="column.key === 'label'">
            <a-form-item name="label" :rules="[{ required: true, message: '请输入显示名' }]" class="mb-0">
              <a-input
                v-model:value="formModel.label"
                size="small"
                placeholder="显示名"
                :maxlength="64"
                @press-enter="saveEdit(record as ParamRow)"
              />
            </a-form-item>
          </template>

          <!-- 类型 -->
          <template v-else-if="column.key === 'type'">
            <Select v-model:value="formModel.type" size="small" :options="PARAM_TYPE_OPTIONS" class="w-full" />
          </template>

          <!-- 必填 -->
          <template v-else-if="column.key === 'required'">
            <a-checkbox v-model:checked="formModel.required" />
          </template>

          <!-- 说明 -->
          <template v-else-if="column.key === 'description'">
            <a-input
              v-model:value="formModel.description"
              size="small"
              placeholder="说明"
              :maxlength="256"
              @press-enter="saveEdit(record as ParamRow)"
            />
          </template>
        </template>

        <!-- ==================== 只读模式 ==================== -->
        <template v-else>
          <template v-if="column.key === 'name'">
            <code class="text-[11px]">{{ record.name || '—' }}</code>
          </template>
          <template v-else-if="column.key === 'label'">
            {{ record.label || '—' }}
          </template>
          <template v-else-if="column.key === 'type'">
            {{ PARAM_TYPE_OPTIONS.find((o) => o.value === record.type)?.label ?? record.type }}
          </template>
          <template v-else-if="column.key === 'required'">
            <a-tag v-if="record.required" color="red" :bordered="false">必填</a-tag>
            <span v-else class="text-slate-400">—</span>
          </template>
          <template v-else-if="column.key === 'description'">
            <span class="text-slate-500">{{ record.description || '—' }}</span>
          </template>
        </template>
      </template>

      <!-- 空状态 -->
      <template #emptyText>
        <div
          class="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500"
        >
          暂无变量定义。点击右上角「添加变量」手动添加，或从内容中自动提取
        </div>
      </template>
    </a-table>

    <!-- ⭐ 表单包裹：让 rules 生效（关键） -->
    <a-form ref="formRef" :model="formModel" class="hidden-form" />

    <!-- 未定义变量警告 -->
    <div
      v-if="undefinedVars.length > 0"
      class="rounded-lg border border-rose-200/60 bg-rose-50/50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
    >
      <Icon icon="carbon:warning-alt" class="mr-1 inline" />
      模板中使用了以下未定义的变量：
      <code v-for="v in undefinedVars" :key="v" class="mx-0.5 rounded bg-white/70 px-1 dark:bg-slate-900/60">{{
        varPlaceholder(v)
      }}</code>
      ，请补充定义
    </div>
  </div>
</template>

<style scoped>
.template-variable-table :deep(.var-input input) {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

.template-variable-table :deep(.row-unused td) {
  background-color: rgba(251, 191, 36, 0.08) !important;
}

/* ⭐ 关键：清掉 a-form-item 的默认 margin，防止行高撑爆 */
.template-variable-table :deep(.ant-form-item) {
  margin-bottom: 0 !important;
}

.template-variable-table :deep(.ant-form-item-explain) {
  position: absolute;
  font-size: 11px;
  line-height: 1.4;
  margin-top: 2px;
  pointer-events: none;
}

.template-variable-table :deep(.ant-table-cell) {
  padding: 6px 8px !important;
  vertical-align: middle !important;
}

.template-variable-table :deep(.ant-table-thead > tr > th) {
  padding: 8px 8px !important;
  background: #fafbfc;
  font-weight: 600;
  font-size: 12px;
}

.template-variable-table :deep(.ant-table-tbody > tr > td) {
  height: 44px;
}

/* 隐藏 validate 用的幽灵 form（保留功能不显示） */
.hidden-form {
  display: none;
}
</style>
