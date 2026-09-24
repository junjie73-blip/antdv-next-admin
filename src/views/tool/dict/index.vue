<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref } from 'vue'

import {
  addDict,
  addDictItem,
  batchRemoveDictData,
  deleteDict,
  deleteDictItem,
  getDictItems,
  getDictList,
  updateDict,
  updateDictItem,
} from '~/api'
import { BasicForm, useForm } from '~/components/business/Form'
import { BasicModal, useModal } from '~/components/business/Modal'
import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import { useCRUD } from '~/composables/useCRUD'
import { DictType } from '~/enums/dict'
import { useDictStore } from '~/stores'

import type { DictItemRecord, DictTypeRecord } from './types'

import { getDictItemActions } from './actions'
import {
  dictItemActionColumn,
  dictItemColumns,
  dictItemPagination,
  dictItemScroll,
  dictTypeRowKey,
  dictTypeRowSelection,
} from './columns'
import {
  cardBodyClassName,
  cardClassName,
  cardFooterClassName,
  cardHeaderClassName,
  cardTitleClassName,
  containerClassName,
  DICT_STATUS_COLOR_MAP,
  DICT_STATUS_ICON_MAP,
  DICT_STATUS_LABEL_MAP,
  emptyClassName,
  emptyDescClassName,
  emptyIconClassName,
  emptyTitleClassName,
  leftPanelClassName,
  rightPanelClassName,
  tableWrapperClassName,
  tagClassName,
  typeItemActionsClassName,
  typeItemBtnClassName,
  typeItemClassName,
  typeItemCodeClassName,
  typeItemIndicatorClassName,
  typeItemNameClassName,
} from './constants'
import { useDictItemFormSchemas, useDictTypeFormSchemas } from './schemas'

defineOptions({ name: 'SystemDict' })

// ========== 字典 store ==========
const dictStore = useDictStore()
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE))

// ========== 类型状态 ==========
const dictTypes = ref<DictTypeRecord[]>([])
const selectedType = ref<DictTypeRecord | null>(null)
const typeLoading = ref(false)

const [typeModalRegister, typeModalMethods] = useModal()
const [typeFormRegister, typeFormMethods] = useForm()
const typeFormSchemas = useDictTypeFormSchemas(statusOptions)

// ========== 字典项状态 ==========
const [itemModalRegister, itemModalMethods] = useModal()
const [itemFormRegister, itemFormMethods] = useForm()
const [itemTableRegister, itemTableMethods] = useTable()
const itemFormSchemas = useDictItemFormSchemas(statusOptions)

// ========== 加载字典类型 ==========
async function loadDictTypes() {
  typeLoading.value = true
  try {
    const res = await getDictList()
    dictTypes.value = res?.list || res || []
  } catch (e) {
    message.error('加载字典类型失败' + e)
  } finally {
    typeLoading.value = false
  }
}

function selectType(type: DictTypeRecord) {
  selectedType.value = type
  itemTableMethods.value?.reload()
}

// ========== 类型 CRUD ==========
const typeCrud = useCRUD<DictTypeRecord>({
  containerType: 'modal',
  modalMethods: typeModalMethods,
  formMethods: typeFormMethods,
  tableMethods: { value: null },
  idKey: 'dictTypeId',
  getEmptyValues: () => ({ dictName: '', dictCode: '', status: '1', description: '' }),
  getFormValues: (record) => ({
    dictName: record.dictName,
    dictCode: record.dictCode,
    status: record.status,
    description: record.description,
  }),
  onCreate: async (values) => await addDict(values),
  onUpdate: async (id, values) => await updateDict(id, values),
  onDelete: async (record) => await deleteDict(record.dictTypeId),
  onSaved: async () => await loadDictTypes(),
  onDeleted: async () => {
    if (selectedType.value && !dictTypes.value.some((t) => t.dictTypeId === selectedType.value!.dictTypeId)) {
      selectedType.value = null
    }
    await loadDictTypes()
  },
  messages: {
    createSuccess: '字典类型创建成功',
    updateSuccess: '字典类型更新成功',
    deleteSuccess: '字典类型删除成功',
    deleteConfirm: '确定要删除该字典类型吗？',
  },
})

// ========== 字典项 CRUD ==========
const itemCrud = useCRUD<DictItemRecord>({
  containerType: 'modal',
  modalMethods: itemModalMethods,
  formMethods: itemFormMethods,
  tableMethods: itemTableMethods,
  idKey: 'dictDataId',
  getEmptyValues: () => ({
    dictLabel: '',
    dictValue: '',
    sortOrder: 0,
    status: '1',
    remark: '',
  }),
  getFormValues: (record) => ({
    dictLabel: record.dictLabel,
    dictValue: record.dictValue,
    sortOrder: record.sortOrder,
    status: record.status,
    remark: record.remark,
  }),
  onCreate: async (values) => {
    if (!selectedType.value) throw new Error('请先选择字典类型')
    await addDictItem({ ...values, dictTypeId: selectedType.value.dictTypeId })
  },
  onUpdate: async (id, values) => await updateDictItem(id, values),
  onDelete: async (record) => await deleteDictItem(record.dictDataId),
  onSaved: async () => itemTableMethods.value?.reload(),
  onDeleted: async () => itemTableMethods.value?.reload(),
  onBatchDelete: async (records) => {
    await batchRemoveDictData(records.map((r) => r.dictDataId))
  },
  messages: {
    createSuccess: '字典项创建成功',
    updateSuccess: '字典项更新成功',
    deleteSuccess: '字典项删除成功',
  },
})

// ========== 字典项查询 ==========
async function fetchDictItems(params: any) {
  return await getDictItems({
    ...params,
    dictTypeId: selectedType.value?.dictTypeId,
  })
}

// ========== 导出 ==========
function handleExport() {
  const dataToExport = selectedType.value ? itemTableMethods.value?.getSelectRows?.() || [] : dictTypes.value
  console.log('export:', dataToExport)
}

// ========== 字典项行操作 ==========
function getItemActions(record: DictItemRecord) {
  return getDictItemActions(record, {
    onEdit: itemCrud.handleEdit,
    onDelete: itemCrud.handleDelete,
  })
}

loadDictTypes()
</script>

<template>
  <div :class="containerClassName">
    <!-- ============================================================ -->
    <!-- 左侧：字典类型                                                  -->
    <!-- ============================================================ -->
    <aside :class="leftPanelClassName">
      <div :class="cardClassName">
        <!-- 头部 -->
        <div :class="cardHeaderClassName">
          <div class="flex items-center gap-2">
            <span class="h-3.5 w-1 rounded bg-blue-500 dark:bg-blue-400" />
            <span :class="cardTitleClassName">字典类型</span>
            <span
              class="rounded-full bg-gray-100 px-2 text-xs font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              {{ dictTypes.length }}
            </span>
          </div>
        </div>

        <!-- 列表 -->
        <a-spin :spinning="typeLoading">
          <div :class="cardBodyClassName" class="max-h-[60vh] lg:max-h-[calc(100vh-260px)]">
            <!-- 空态 -->
            <div v-if="dictTypes.length === 0" :class="emptyClassName">
              <Icon icon="carbon:book" :class="emptyIconClassName" />
              <div :class="emptyTitleClassName">暂无字典类型</div>
              <div :class="emptyDescClassName">点击下方按钮新增字典类型</div>
            </div>

            <!-- 列表项 -->
            <div
              v-for="item in dictTypes"
              :key="item.dictTypeId"
              :class="typeItemClassName(selectedType?.dictTypeId === item.dictTypeId)"
              @click="selectType(item)"
            >
              <!-- 激活指示条 -->
              <span v-if="selectedType?.dictTypeId === item.dictTypeId" :class="typeItemIndicatorClassName" />

              <!-- 名称 + 编码 -->
              <div class="min-w-0 flex-1">
                <div :class="typeItemNameClassName">
                  {{ item.dictName }}
                </div>
                <div :class="typeItemCodeClassName">
                  {{ item.dictCode }}
                </div>
              </div>

              <!-- 状态标签 + 操作 -->
              <div :class="typeItemActionsClassName">
                <a-tag
                  :color="DICT_STATUS_COLOR_MAP[item.status] || 'default'"
                  class="!m-0 !px-1.5 !text-[10px] !leading-4"
                >
                  {{ DICT_STATUS_LABEL_MAP[item.status] || '未知' }}
                </a-tag>

                <button
                  type="button"
                  :class="typeItemBtnClassName"
                  title="编辑"
                  @click.stop="typeCrud.handleEdit(item)"
                >
                  <Icon icon="ant-design:edit-outlined" class="text-xs" />
                </button>

                <button
                  type="button"
                  :class="typeItemBtnClassName + ' hover:!text-red-500 dark:hover:!text-red-400'"
                  title="删除"
                  @click.stop="typeCrud.handleDelete(item)"
                >
                  <Icon icon="ant-design:delete-outlined" class="text-xs" />
                </button>
              </div>
            </div>
          </div>
        </a-spin>

        <!-- 底部 -->
        <div :class="cardFooterClassName">
          <a-button type="primary" size="small" block @click="typeCrud.handleAdd()">
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增类型
          </a-button>
        </div>
      </div>
    </aside>

    <!-- ============================================================ -->
    <!-- 右侧：字典项                                                    -->
    <!-- ============================================================ -->
    <section :class="rightPanelClassName">
      <div :class="cardClassName">
        <!-- 头部 -->
        <div :class="cardHeaderClassName">
          <div class="flex items-center gap-2">
            <span class="h-3.5 w-1 rounded bg-blue-500 dark:bg-blue-400" />
            <span :class="cardTitleClassName">
              {{ selectedType ? `${selectedType.dictName} - 字典项` : '字典项' }}
            </span>
            <span
              v-if="selectedType"
              class="hidden rounded-full bg-gray-100 px-2 text-xs font-normal text-gray-500 sm:inline-block dark:bg-gray-800 dark:text-gray-400"
            >
              {{ selectedType.dictCode }}
            </span>
          </div>
        </div>

        <!-- 表格 -->
        <div :class="tableWrapperClassName">
          <BasicTable
            :columns="dictItemColumns"
            :api="fetchDictItems"
            :immediate="true"
            :use-search-form="false"
            :show-table-setting="false"
            :pagination="dictItemPagination"
            :action-column="dictItemActionColumn"
            :row-selection="dictTypeRowSelection"
            :row-key="dictTypeRowKey"
            :scroll="dictItemScroll"
            size="small"
            @register="itemTableRegister"
          >
            <!-- 工具栏 -->
            <template #toolbar>
              <div class="flex flex-wrap items-center gap-2">
                <a-button size="small" @click="handleExport">
                  <template #icon>
                    <Icon icon="carbon:export" />
                  </template>
                  导出
                </a-button>

                <a-button type="primary" size="small" :disabled="!selectedType" @click="itemCrud.handleAdd()">
                  <template #icon>
                    <Icon icon="ant-design:plus-outlined" />
                  </template>
                  新增字典项
                </a-button>

                <a-button size="small" danger @click="itemCrud.handleBatchDelete">
                  <template #icon>
                    <Icon icon="ant-design:delete-outlined" />
                  </template>
                  批量删除
                </a-button>
              </div>
            </template>

            <!-- 状态列 -->
            <template #cell-status="{ record }">
              <a-tag :color="DICT_STATUS_COLOR_MAP[record.status] || 'default'" class="!m-0">
                <span :class="tagClassName">
                  <Icon :icon="DICT_STATUS_ICON_MAP[record.status] || 'carbon:help'" />
                  {{ DICT_STATUS_LABEL_MAP[record.status] || '未知' }}
                </span>
              </a-tag>
            </template>

            <!-- 操作列 -->
            <template #action="{ record }">
              <TableAction :actions="getItemActions(record as DictItemRecord)" />
            </template>
          </BasicTable>
        </div>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- 类型弹窗                                                       -->
    <!-- ============================================================ -->
    <BasicModal
      :title="typeCrud.isEditing.value ? '编辑字典类型' : '新增字典类型'"
      :width="560"
      @register="typeModalRegister"
      @ok="typeCrud.handleSave"
    >
      <BasicForm
        :schemas="typeFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="typeFormRegister"
      />
    </BasicModal>

    <!-- ============================================================ -->
    <!-- 字典项弹窗                                                     -->
    <!-- ============================================================ -->
    <BasicModal
      :title="itemCrud.isEditing.value ? '编辑字典项' : '新增字典项'"
      :width="600"
      @register="itemModalRegister"
      @ok="itemCrud.handleSave"
    >
      <BasicForm
        :schemas="itemFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="itemFormRegister"
      />
    </BasicModal>
  </div>
</template>
