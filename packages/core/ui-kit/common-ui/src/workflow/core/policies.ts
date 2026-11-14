import type { AssigneeResolver, AssigneeRule, ResolverContext } from './types';

import { createExpressionEvaluator } from '@antdv/graph';

const evaluator = createExpressionEvaluator();

/**
 * 内置审批人解析策略。
 *
 * 口径只有一条：**解析出空集合不算错误**。流程建模时角色经常是"可能没配人"的，
 * 引擎会走 `fallback`，都没有就把节点标记为无人可办并抛出可诊断的错误，
 * 而不是静默生成一条 assignee 为空的死任务。
 */
export const builtinAssigneeResolvers: Record<string, AssigneeResolver> = {
  /** params.userIds —— 指定人 */
  user: (rule) => toStringList(rule.params?.userIds ?? rule.params?.users),
  /** params.roleCode —— 角色；角色到人这件事宿主最清楚，交给 ctx.resolveRole */
  role: (rule, ctx) => {
    const code = String(rule.params?.roleCode ?? rule.params?.role ?? '');
    if (!ctx.resolveRole || !code) return [];
    return toStringList(ctx.resolveRole(code));
  },
  /** params.expression —— 从流程变量里取，如 `{{ form.deptLeader }}` */
  expression: (rule, ctx) => {
    const template = String(
      rule.params?.expression ?? rule.params?.value ?? '',
    );
    if (!template) return [];
    const raw = template.includes('{{')
      ? evaluator.resolveTemplate(
          template,
          ctx.instance.variables as Record<string, unknown>,
        )
      : evaluator.resolveTemplate(
          `{{ ${template} }}`,
          ctx.instance.variables as Record<string, unknown>,
        );
    return toStringList(raw.split(',').filter(Boolean));
  },
  /** 发起人自己（自检、撤回类节点） */
  initiator: (_rule, ctx) => [ctx.instance.initiator],
  /** params.userId（缺省发起人）→ 该用户的部门负责人 */
  departmentHead: (rule, ctx) => {
    const from = String(rule.params?.userId ?? ctx.instance.initiator);
    if (!ctx.resolveDepartmentHead) return [];
    return toStringList(ctx.resolveDepartmentHead(from));
  },
};

function toStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((item) => toStringList(item));
  if (typeof value === 'number' || typeof value === 'boolean')
    return [String(value)];
  if (typeof value !== 'string') return [];
  return value ? [value] : [];
}

/**
 * 按规则取人，并处理三层退化：主策略 → fallback 策略 → 去重后的结果。
 * 返回空数组表示这个节点当前无人可办，由引擎决定怎么报错。
 */
export function resolveAssignees(
  rule: AssigneeRule,
  ctx: ResolverContext,
): string[] {
  return collectRules([rule], ctx);
}

/** 多条规则（如「部门经理 + 分管领导」）合并去重，保持声明顺序 */
export function resolveAssigneeSet(
  rules: AssigneeRule[] | undefined,
  ctx: ResolverContext,
): string[] {
  return collectRules(rules ?? [], ctx);
}

function collectRules(rules: AssigneeRule[], ctx: ResolverContext): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    for (const id of pickOne(rule, ctx)) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function pickOne(rule: AssigneeRule, ctx: ResolverContext): string[] {
  const resolver =
    ctx.resolvers?.[rule.strategy] ?? builtinAssigneeResolvers[rule.strategy];
  const found = resolver ? resolver(rule, ctx) : [];
  if (found.length > 0) return found;
  // 兜底只在主策略真的没人时生效；兜底再解析不出就返回空，让引擎报"无人可办"
  return rule.fallback ? pickOne(rule.fallback, ctx) : [];
}
