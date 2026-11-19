/**
 * 部门内存库（legacy mock/dept.fake.ts 的数据层）
 */

import { builtin } from '../builtin-data';
import { defineCollection, nextBizId } from './sqlite';
import dayjs from 'dayjs';


export interface DeptRecord {
  children?: DeptRecord[];
  code: string;
  createdAt: string;
  id: number;
  leader: string;
  name: string;
  parentId: number;
  phone: string;
  remark: string;
  sortOrder: number;
  status: 0 | 1;
  userCount: number;
}

function generateDeptTree(): DeptRecord[] {
  const baseDate = dayjs('2024-01-01');
  const headquarters: DeptRecord = {
    id: 1,
    parentId: 0,
    name: '总公司',
    code: 'HQ',
    leader: builtin.person.fullName(),
    // 手机号按「138 + 8 位确定性数字」拼装，保持 11 位大陆号码形态；
    // 用 "138" 前缀 + 8 位确定性数字拼出大陆手机号
    phone: `138${builtin.string.numeric(8)}`,
    sortOrder: 1,
    status: 1,
    remark: '公司总部，负责整体战略规划与决策',
    createdAt: baseDate.format('YYYY-MM-DD HH:mm:ss'),
    userCount: builtin.number.int({ min: 5, max: 15 }),
    children: [],
  };
  const deptTemplates = [
    { name: '技术部', code: 'TECH', remark: '负责产品研发与技术架构' },
    { name: '产品部', code: 'PRODUCT', remark: '负责产品规划与设计' },
    { name: '市场部', code: 'MARKETING', remark: '负责市场推广与品牌建设' },
    { name: '运营部', code: 'OPERATION', remark: '负责日常运营与用户增长' },
    { name: '财务部', code: 'FINANCE', remark: '负责财务管理与审计' },
    { name: '人事部', code: 'HR', remark: '负责人力资源与组织发展' },
    { name: '行政部', code: 'ADMIN', remark: '负责行政管理后勤保障' },
  ];
  const childDeptMap: Record<
    string,
    { name: string; code: string; remark: string }[]
  > = {
    技术部: [
      { name: '前端组', code: 'FE', remark: '负责 Web 前端开发' },
      { name: '后端组', code: 'BE', remark: '负责服务端开发与架构' },
      { name: '测试组', code: 'QA', remark: '负责质量保障与测试' },
      { name: '运维组', code: 'OPS', remark: '负责系统运维与部署' },
    ],
    产品部: [
      { name: '产品设计组', code: 'PD', remark: '负责产品功能设计' },
      { name: '用户研究组', code: 'UR', remark: '负责用户调研与分析' },
    ],
    市场部: [
      { name: '品牌推广组', code: 'BRAND', remark: '负责品牌策划与传播' },
      { name: '渠道拓展组', code: 'CHANNEL', remark: '负责渠道建设与管理' },
    ],
    运营部: [
      { name: '内容运营组', code: 'CONTENT', remark: '负责内容生产与运营' },
      { name: '用户运营组', code: 'USER_OPS', remark: '负责用户生命周期管理' },
    ],
  };
  let idCounter = 2;
  for (const tpl of deptTemplates) {
    const level2Dept: DeptRecord = {
      id: idCounter++,
      parentId: headquarters.id,
      name: tpl.name,
      code: tpl.code,
      leader: builtin.person.fullName(),
      // 手机号按固定前缀 + 确定性数字拼装；
      // 直接拼 "138 + 8 位数字" 保持与 legacy 相同的手机号形态
      phone: `138${builtin.string.numeric(8)}`,
      sortOrder: idCounter - 1,
      status: builtin.datatype.boolean(0.85) ? 1 : 0,
      remark: tpl.remark,
      createdAt: baseDate
        .add(builtin.number.int({ min: 10, max: 60 }), 'day')
        .format('YYYY-MM-DD HH:mm:ss'),
      userCount: builtin.number.int({ min: 3, max: 20 }),
      children: [],
    };
    headquarters.children!.push(level2Dept);
    const children = childDeptMap[tpl.name] || [];
    for (const childTpl of children) {
      const level3Dept: DeptRecord = {
        id: idCounter++,
        parentId: level2Dept.id,
        name: childTpl.name,
        code: `${tpl.code}_${childTpl.code}`,
        leader: builtin.person.fullName(),
        // 同上：固定前缀 + 确定性数字拼接
        phone: `138${builtin.string.numeric(8)}`,
        sortOrder: idCounter - 1,
        status: builtin.datatype.boolean(0.9) ? 1 : 0,
        remark: childTpl.remark,
        createdAt: baseDate
          .add(builtin.number.int({ min: 30, max: 120 }), 'day')
          .format('YYYY-MM-DD HH:mm:ss'),
        userCount: builtin.number.int({ min: 1, max: 10 }),
      };
      level2Dept.children!.push(level3Dept);
    }
  }
  return [headquarters];
}

/**
 * 内置初始组织架构（系统配置数据，确定性常量）。
 * 只作为首次播种来源；运行期部门树一律由 `buildDeptTree()` 从真实存储实时组装。
 */
export const DEPT_TREE = generateDeptTree();

// 扁平化辅助函数
function flattenDepts(nodes: DeptRecord[]): DeptRecord[] {
  const result: DeptRecord[] = [];
  function walk(items: DeptRecord[]) {
    for (const item of items) {
      result.push(item);
      if (item.children && item.children.length > 0) walk(item.children);
    }
  }
  walk(nodes);
  return result;
}

/** 扁平部门表只存实体字段，children 是派生关系，不入存储 */
function flattenForStore(nodes: DeptRecord[]): DeptRecord[] {
  return flattenDepts(nodes).map((row) => {
    const flat = { ...row };
    delete flat.children;
    return flat;
  });
}

/** 部门实体：真实存储（SQLite 持久化 / 内存实现），所有 CRUD 都落在这一份数据上 */
export const ALL_DEPTS_FLAT: DeptRecord[] = defineCollection<DeptRecord>({
  seed: () => flattenForStore(DEPT_TREE),
  table: 'tb_dept',
});

/** 按 parentId 从真实存储实时组装部门树，保证新增/修改/删除后树立即反映变化 */
export function buildDeptTree(): DeptRecord[] {
  const byId = new Map<number, DeptRecord>();
  for (const row of ALL_DEPTS_FLAT) {
    byId.set(Number(row.id), { ...row, children: [] });
  }
  const roots: DeptRecord[] = [];
  for (const row of ALL_DEPTS_FLAT) {
    const node = byId.get(Number(row.id))!;
    const parent = byId.get(Number(row.parentId));
    if (parent && parent !== node) parent.children!.push(node);
    else roots.push(node);
  }
  return roots;
}

/** 新增部门 id：SQLite 下取库内 max+1，重启不撞号 */
export function nextDeptId(): number {
  return nextBizId('tb_dept');
}
