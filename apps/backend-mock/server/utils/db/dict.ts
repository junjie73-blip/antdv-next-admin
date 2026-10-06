/**
 * 数据字典内存库（legacy mock/dict.fake.ts 的数据层）
 */

import { faker } from '@faker-js/faker/locale/zh_CN';

faker.seed(300);

export interface DictItem {
  cssClass: string;
  dictLabel: string;
  dictType: number;
  dictValue: string;
  id: number;
  remark: string;
  sort: number;
  status: 0 | 1;
}

export interface DictType {
  id: number;
  items: DictItem[];
  remark: string;
  status: 0 | 1;
  typeCode: string;
  typeName: string;
}

export const DICT_TYPE_DB: DictType[] = [];
let autoIncrementTypeId = 7;
let autoIncrementItemId = 19;

function initDictDB() {
  if (DICT_TYPE_DB.length > 0) return;
  const dictTypes = [
    {
      typeName: '用户性别',
      typeCode: 'sys_user_sex',
      status: 1 as const,
      remark: '用户性别字典',
      items: [
        {
          dictLabel: '男',
          dictValue: '0',
          cssClass: 'text-blue-500',
          sort: 1,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '女',
          dictValue: '1',
          cssClass: 'text-pink-500',
          sort: 2,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '保密',
          dictValue: '2',
          cssClass: 'text-gray-500',
          sort: 3,
          status: 1 as const,
          remark: '',
        },
      ],
    },
    {
      typeName: '显示状态',
      typeCode: 'sys_show_status',
      status: 1 as const,
      remark: '显示状态字典',
      items: [
        {
          dictLabel: '显示',
          dictValue: '0',
          cssClass: 'text-green-500',
          sort: 1,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '隐藏',
          dictValue: '1',
          cssClass: 'text-gray-400',
          sort: 2,
          status: 1 as const,
          remark: '',
        },
      ],
    },
    {
      typeName: '通知置顶',
      typeCode: 'biz_notice_top',
      status: 1 as const,
      remark: '通知置顶等级',
      items: [
        {
          dictLabel: '置顶',
          dictValue: '2',
          cssClass: 'text-red-500',
          sort: 3,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '热门',
          dictValue: '1',
          cssClass: 'text-orange-500',
          sort: 2,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '普通',
          dictValue: '0',
          cssClass: '',
          sort: 1,
          status: 1 as const,
          remark: '',
        },
      ],
    },
    {
      typeName: '通知类型',
      typeCode: 'biz_notice_type',
      status: 1 as const,
      remark: '通知消息类型分类',
      items: [
        {
          dictLabel: '通告',
          dictValue: '1',
          cssClass: 'bg-blue-100',
          sort: 1,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '公告',
          dictValue: '2',
          cssClass: 'bg-yellow-100',
          sort: 2,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '通知',
          dictValue: '3',
          cssClass: 'bg-green-100',
          sort: 3,
          status: 1 as const,
          remark: '',
        },
      ],
    },
    {
      typeName: '系统状态',
      typeCode: 'sys_normal_disable',
      status: 1 as const,
      remark: '通用正常/停用状态',
      items: [
        {
          dictLabel: '正常',
          dictValue: '0',
          cssClass: 'text-green-500',
          sort: 1,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '停用',
          dictValue: '1',
          cssClass: 'text-red-500',
          sort: 2,
          status: 1 as const,
          remark: '',
        },
      ],
    },
    {
      typeName: '文章状态',
      typeCode: 'biz_article_status',
      status: 1 as const,
      remark: '内容文章发布状态',
      items: [
        {
          dictLabel: '草稿',
          dictValue: '0',
          cssClass: 'text-gray-400',
          sort: 1,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '发布',
          dictValue: '1',
          cssClass: 'text-green-500',
          sort: 2,
          status: 1 as const,
          remark: '',
        },
        {
          dictLabel: '下架',
          dictValue: '2',
          cssClass: 'text-red-500',
          sort: 3,
          status: 1 as const,
          remark: '',
        },
      ],
    },
  ];
  let typeIdCounter = 1;
  let itemIdCounter = 1;
  dictTypes.forEach((dt) => {
    const typeId = typeIdCounter++;
    const items: DictItem[] = dt.items.map((item) => ({
      id: itemIdCounter++,
      dictType: typeId,
      ...item,
    }));
    DICT_TYPE_DB.push({
      id: typeId,
      typeName: dt.typeName,
      typeCode: dt.typeCode,
      status: dt.status,
      remark: dt.remark,
      items,
    });
  });
}
initDictDB();

/** 新增字典类型自增 id */
export function nextDictTypeId(): number {
  return autoIncrementTypeId++;
}

/** 新增字典项自增 id */
export function nextDictItemId(): number {
  return autoIncrementItemId++;
}
