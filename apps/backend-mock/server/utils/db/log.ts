/**
 * 操作日志内存库（legacy mock/log.fake.ts 的数据层）
 */

import { BUILTIN_NOW, builtin } from '../builtin-data';
import { defineCollection } from './sqlite';
import dayjs from 'dayjs';


const OPER_TYPES = [
  '登录',
  '新增',
  '修改',
  '删除',
  '授权',
  '导出',
  '导入',
  '强退',
  '生成代码',
  '清空数据',
] as const;
const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

export interface OperLog {
  costTime: number;
  errorMsg: string;
  id: number;
  jsonResult: string;
  method: string;
  operIp: string;
  operLocation: string;
  operName: string;
  operParam: string;
  operTime: string;
  operType: string;
  operUrl: string;
  requestMethod: string;
  operatorType: 1 | 2;
  status: 0 | 1;
  title: string;
}

export const OPER_LOG_DB: OperLog[] = defineCollection<OperLog>({ seed: () => [], table: 'tb_oper_log' });

function initLogDB() {
  if (OPER_LOG_DB.length > 0) return;
  const baseDate = dayjs(BUILTIN_NOW).subtract(30, 'day');
  const nicknames = [
    'admin',
    '张三',
    '李四',
    '王五',
    '赵六',
    '钱七',
    '孙八',
    '周九',
    '吴十',
    '郑十一',
  ];
  for (let i = 0; i < 20; i++) {
    const operType = builtin.helpers.arrayElement(OPER_TYPES);
    const isSuccess = builtin.datatype.boolean(0.9);
    OPER_LOG_DB.push({
      id: i + 1,
      operName: builtin.helpers.arrayElement(nicknames),
      operType,
      title: `${operType}操作`,
      method: `com.antdv.controller.${builtin.helpers.arrayElement(['User', 'Role', 'Dict', 'Menu', 'Log', 'Online', 'Notice', 'File', 'Config', 'Dept'])}${builtin.helpers.arrayElement(['Controller', 'Service', 'ServiceImpl'])}.${builtin.hacker.verb()}`,
      requestMethod: builtin.helpers.arrayElement(REQUEST_METHODS),
      operatorType: builtin.helpers.arrayElement([1, 2]),
      operUrl: `/${builtin.helpers.arrayElement(['system', 'api', 'admin', 'manage', 'controller'])}/${builtin.helpers.arrayElement(['user', 'role', 'dict', 'menu', 'log', 'file', 'config'])}`,
      operIp: builtin.internet.ipv4(),
      operLocation: `${builtin.location.city()}${builtin.location.state()}`,
      operParam: JSON.stringify({
        page: 1,
        pageSize: 10,
        keyword: builtin.word.sample(),
      }),
      jsonResult: isSuccess
        ? JSON.stringify({ code: 200, message: '操作成功' })
        : '',
      status: isSuccess ? 0 : 1,
      errorMsg: isSuccess ? '' : builtin.hacker.phrase(),
      operTime: baseDate
        .add(builtin.number.int({ min: 0, max: 720 }), 'hour')
        .format('YYYY-MM-DD HH:mm:ss'),
      costTime: builtin.number.int({ min: 5, max: 500 }),
    });
  }
}
initLogDB();
