/**
 * 任务内存库 —— 「表格增删改查」示例（`views/components/table/crud`）的数据层。
 *
 * 为什么要有状态：示例页演示的是 `useCRUD` 的完整闭环（新增 → 编辑 → 删除 → 批量删除），
 * 数据必须持久化，否则写入的内容下一条请求就消失，
 * 表现是"新增成功但列表里找不到、删除后刷新又回来了" —— 示例本身成了 bug 现场。
 * 所以和 `db/user.ts` 一样用模块级数组：**同一进程内所有 handler 共享这一份**，
 * 增删改对随后的 list 立即可见。
 *
 * 种子来自 `builtin-data.ts` 的确定性常量池，零随机、跨重启一致；
 * 数据经 `defineCollection` 落到 `tb_task`，分页与增删改都基于这份持久化数据。
 */

import { BUILTIN_NOW, builtin } from '../builtin-data';
import { defineCollection, isSqliteEnabled, nextBizId } from './sqlite';
import dayjs from 'dayjs';


export type TaskPriority = 'high' | 'low' | 'middle';
export type TaskStatus = 'blocked' | 'done' | 'pending' | 'running';

export interface TaskRecord {
  createdAt: string;
  dueDate: string;
  /** 完成进度 0-100 */
  id: number;
  owner: string;
  priority: TaskPriority;
  progress: number;
  remark: string;
  status: TaskStatus;
  title: string;
  updatedAt: string;
}

export const TASK_STATUS_OPTIONS: Array<{ label: string; value: TaskStatus }> =
  [
    { label: '待处理', value: 'pending' },
    { label: '进行中', value: 'running' },
    { label: '已完成', value: 'done' },
    { label: '被阻塞', value: 'blocked' },
  ];

export const TASK_PRIORITY_OPTIONS: Array<{
  label: string;
  value: TaskPriority;
}> = [
  { label: '低', value: 'low' },
  { label: '中', value: 'middle' },
  { label: '高', value: 'high' },
];

const TITLE_TEMPLATES = [
  '重构路由守卫的鉴权分支',
  '补齐表格列的自适应宽度',
  '排查暗色模式下的主色偏移',
  '接入浏览器内 mock 的开关',
  '梳理 composable 的导出面',
  '文档站补更新日志',
  '拆分设置面板的样式主题',
  '标签页右键菜单支持批量关闭',
];

export const TASK_DB: TaskRecord[] = defineCollection<TaskRecord>({ seed: () => [], table: 'tb_task' });
/** 起始 id 基线：保证 sqlite（库内 max+1）与 memory（自增变量）两实现起点一致 */
const TASK_ID_START = 101;
let autoIncrementId = TASK_ID_START;

function initTaskDB() {
  if (TASK_DB.length > 0) return;
  const baseDate = dayjs('2026-09-01');
  for (let i = 1; i <= 26; i++) {
    const status = builtin.helpers.arrayElement(
      TASK_STATUS_OPTIONS.map((item) => item.value),
    );
    // 已完成的任务进度钉在 100，别让示例表里出现"完成 37%"这种自相矛盾的行
    const progress =
      status === 'done' ? 100 : builtin.number.int({ min: 0, max: 95 });
    TASK_DB.push({
      id: i,
      title: `${TITLE_TEMPLATES[i % TITLE_TEMPLATES.length]}（${i}）`,
      owner: builtin.person.fullName(),
      status,
      priority: builtin.helpers.arrayElement(
        TASK_PRIORITY_OPTIONS.map((item) => item.value),
      ),
      progress,
      dueDate: baseDate
        .add(builtin.number.int({ min: 1, max: 60 }), 'day')
        .format('YYYY-MM-DD'),
      remark: builtin.datatype.boolean(0.4) ? builtin.company.catchPhrase() : '',
      createdAt: baseDate
        .subtract(builtin.number.int({ min: 1, max: 90 }), 'day')
        .format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: BUILTIN_NOW,
    });
  }
}
initTaskDB();

/** 新增任务自增 id（与 `db/user.ts` 的 `nextUserId` 同法） */
export function nextTaskId(): number {
  return isSqliteEnabled()
    ? Math.max(TASK_ID_START, nextBizId('tb_task'))
    : autoIncrementId++;
}

/** 表单值 → 记录字段：只收白名单，避免把 `id`/`createdAt` 之类的服务端字段写进去 */
export function pickTaskFields(
  data: Record<string, unknown>,
): Partial<TaskRecord> {
  const picked: Partial<TaskRecord> = {};
  if (data.title !== undefined) picked.title = String(data.title);
  if (data.owner !== undefined) picked.owner = String(data.owner);
  if (data.status !== undefined) picked.status = data.status as TaskStatus;
  if (data.priority !== undefined)
    picked.priority = data.priority as TaskPriority;
  if (data.progress !== undefined) picked.progress = Number(data.progress);
  if (data.dueDate !== undefined) picked.dueDate = String(data.dueDate);
  if (data.remark !== undefined) picked.remark = String(data.remark);
  return picked;
}
