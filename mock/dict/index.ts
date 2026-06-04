import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(300)

interface DictItem {
  id: number
  dictType: number
  dictLabel: string
  dictValue: string
  cssClass: string
  sort: number
  status: 0 | 1
  remark: string
}

interface DictType {
  id: number
  typeName: string
  typeCode: string
  status: 0 | 1
  remark: string
  items: DictItem[]
}

const DICT_TYPE_DB: DictType[] = []

function initDictDB() {
  if (DICT_TYPE_DB.length > 0) return

  const baseDate = dayjs('2024-01-01')

  const dictTypes = [
    {
      typeName: '用户性别',
      typeCode: 'sys_user_sex',
      status: 1 as const,
      remark: '用户性别字典',
      items: [
        { dictLabel: '男', dictValue: '0', cssClass: 'text-blue-500', sort: 1, status: 1 as const, remark: '' },
        { dictLabel: '女', dictValue: '1', cssClass: 'text-pink-500', sort: 2, status: 1 as const, remark: '' },
        { dictLabel: '保密', dictValue: '2', cssClass: 'text-gray-500', sort: 3, status: 1 as const, remark: '' },
      ],
    },
    {
      typeName: '显示状态',
      typeCode: 'sys_show_status',
      status: 1 as const,
      remark: '显示状态字典',
      items: [
        { dictLabel: '显示', dictValue: '0', cssClass: 'text-green-500', sort: 1, status: 1 as const, remark: '' },
        { dictLabel: '隐藏', dictValue: '1', cssClass: 'text-gray-400', sort: 2, status: 1 as const, remark: '' },
      ],
    },
    {
      typeName: '通知置顶',
      typeCode: 'biz_notice_top',
      status: 1 as const,
      remark: '通知置顶等级',
      items: [
        { dictLabel: '置顶', dictValue: '2', cssClass: 'text-red-500', sort: 3, status: 1 as const, remark: '' },
        { dictLabel: '热门', dictValue: '1', cssClass: 'text-orange-500', sort: 2, status: 1 as const, remark: '' },
        { dictLabel: '普通', dictValue: '0', cssClass: '', sort: 1, status: 1 as const, remark: '' },
      ],
    },
    {
      typeName: '通知类型',
      typeCode: 'biz_notice_type',
      status: 1 as const,
      remark: '通知消息类型分类',
      items: [
        { dictLabel: '通告', dictValue: '1', cssClass: 'bg-blue-100', sort: 1, status: 1 as const, remark: '' },
        { dictLabel: '公告', dictValue: '2', cssClass: 'bg-yellow-100', sort: 2, status: 1 as const, remark: '' },
        { dictLabel: '通知', dictValue: '3', cssClass: 'bg-green-100', sort: 3, status: 1 as const, remark: '' },
      ],
    },
    {
      typeName: '系统状态',
      typeCode: 'sys_normal_disable',
      status: 1 as const,
      remark: '通用正常/停用状态',
      items: [
        { dictLabel: '正常', dictValue: '0', cssClass: 'text-green-500', sort: 1, status: 1 as const, remark: '' },
        { dictLabel: '停用', dictValue: '1', cssClass: 'text-red-500', sort: 2, status: 1 as const, remark: '' },
      ],
    },
    {
      typeName: '文章状态',
      typeCode: 'biz_article_status',
      status: 1 as const,
      remark: '内容文章发布状态',
      items: [
        { dictLabel: '草稿', dictValue: '0', cssClass: 'text-gray-400', sort: 1, status: 1 as const, remark: '' },
        { dictLabel: '发布', dictValue: '1', cssClass: 'text-green-500', sort: 2, status: 1 as const, remark: '' },
        { dictLabel: '下架', dictValue: '2', cssClass: 'text-red-500', sort: 3, status: 1 as const, remark: '' },
      ],
    },
  ]

  let typeIdCounter = 1
  let itemIdCounter = 1

  dictTypes.forEach(dt => {
    const typeId = typeIdCounter++
    const items: DictItem[] = dt.items.map(item => ({
      id: itemIdCounter++,
      dictType: typeId,
      ...item,
    }))

    DICT_TYPE_DB.push({
      id: typeId,
      typeName: dt.typeName,
      typeCode: dt.typeCode,
      status: dt.status,
      remark: dt.remark,
      items,
    })
  })
}

initDictDB()

let autoIncrementTypeId = 7
let autoIncrementItemId = 19

export default defineMock({
  '[GET]/system/dict/list'({ query }: MockContext) {
    const keyword = query.keyword as string | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...DICT_TYPE_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        d => d.typeName.toLowerCase().includes(kw) || d.typeCode.toLowerCase().includes(kw),
      )
    }

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return {
      code: 200,
      data: { list, total },
      message: '获取字典列表成功',
    }
  },

  '[GET]/system/dict/items/:typeId'({ params }: MockContext) {
    const typeId = Number(params.typeId)
    const dictType = DICT_TYPE_DB.find(d => d.id === typeId)

    if (!dictType) {
      return {
        code: 404,
        data: null,
        message: '字典类型不存在',
      }
    }

    return {
      code: 200,
      data: dictType.items,
      message: '获取字典项列表成功',
    }
  },

  '[POST]/system/dict'({ data }: MockContext) {
    const body = data as Record<string, unknown>

    const newDictType: DictType = {
      id: autoIncrementTypeId++,
      typeName: String(body.typeName || ''),
      typeCode: String(body.typeCode || ''),
      status: (body.status as 0 | 1) ?? 1,
      remark: String(body.remark || ''),
      items: [],
    }

    DICT_TYPE_DB.push(newDictType)

    return {
      code: 200,
      data: newDictType,
      message: '新增字典类型成功',
    }
  },

  '[PUT]/system/dict/:id'({ params, data }: MockContext) {
    const id = Number(params.id)
    const idx = DICT_TYPE_DB.findIndex(d => d.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '字典类型不存在',
      }
    }

    const body = data as Record<string, unknown>
    DICT_TYPE_DB[idx] = {
      ...DICT_TYPE_DB[idx]!,
      ...(body.typeName !== undefined && { typeName: String(body.typeName) }),
      ...(body.typeCode !== undefined && { typeCode: String(body.typeCode) }),
      ...(body.status !== undefined && { status: body.status as 0 | 1 }),
      ...(body.remark !== undefined && { remark: String(body.remark) }),
    }

    return {
      code: 200,
      data: DICT_TYPE_DB[idx],
      message: '更新字典类型成功',
    }
  },

  '[DELETE]/system/dict/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const idx = DICT_TYPE_DB.findIndex(d => d.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '字典类型不存在',
      }
    }

    DICT_TYPE_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '删除字典类型成功',
    }
  },

  '[POST]/system/dict/item'({ data }: MockContext) {
    const body = data as Record<string, unknown>
    const typeId = Number(body.dictType)

    const dictType = DICT_TYPE_DB.find(d => d.id === typeId)
    if (!dictType) {
      return {
        code: 400,
        data: null,
        message: '字典类型不存在',
      }
    }

    const newItem: DictItem = {
      id: autoIncrementItemId++,
      dictType: typeId,
      dictLabel: String(body.dictLabel || ''),
      dictValue: String(body.dictValue || ''),
      cssClass: String(body.cssClass || ''),
      sort: Number(body.sort) || 0,
      status: (body.status as 0 | 1) ?? 1,
      remark: String(body.remark || ''),
    }

    dictType.items.push(newItem)

    return {
      code: 200,
      data: newItem,
      message: '新增字典项成功',
    }
  },

  '[PUT]/system/dict/item/:id'({ params, data }: MockContext) {
    const id = Number(params.id)
    const body = data as Record<string, unknown>

    for (const dictType of DICT_TYPE_DB) {
      const itemIdx = dictType.items.findIndex(i => i.id === id)
      if (itemIdx !== -1) {
        dictType.items[itemIdx] = {
          ...dictType.items[itemIdx]!,
          ...(body.dictLabel !== undefined && { dictLabel: String(body.dictLabel) }),
          ...(body.dictValue !== undefined && { dictValue: String(body.dictValue) }),
          ...(body.cssClass !== undefined && { cssClass: String(body.cssClass) }),
          ...(body.sort !== undefined && { sort: Number(body.sort) }),
          ...(body.status !== undefined && { status: body.status as 0 | 1 }),
          ...(body.remark !== undefined && { remark: String(body.remark) }),
        }

        return {
          code: 200,
          data: dictType.items[itemIdx],
          message: '更新字典项成功',
        }
      }
    }

    return {
      code: 404,
      data: null,
      message: '字典项不存在',
    }
  },

  '[DELETE]/system/dict/item/:id'({ params }: MockContext) {
    const id = Number(params.id)

    for (const dictType of DICT_TYPE_DB) {
      const itemIdx = dictType.items.findIndex(i => i.id === id)
      if (itemIdx !== -1) {
        dictType.items.splice(itemIdx, 1)
        return {
          code: 200,
          data: null,
          message: '删除字典项成功',
        }
      }
    }

    return {
      code: 404,
      data: null,
      message: '字典项不存在',
    }
  },
})
