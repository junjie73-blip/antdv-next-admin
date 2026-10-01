import type { Rule } from '@form-create/antdv-next'

/** 审批人类型选项 */
export const ASSIGNEE_TYPE_OPTIONS = [
  { label: '指定用户', value: 'user' },
  { label: '按角色', value: 'role' },
  { label: '按部门', value: 'dept' },
  { label: '部门负责人', value: 'deptLeader' },
  { label: '发起人', value: 'initiator' },
  { label: '动态表达式', value: 'expression' },
]

/** 会签类型选项 */
export const SIGN_TYPE_OPTIONS = [
  { label: '会签（全部通过）', value: 'all' },
  { label: '或签（任一通过）', value: 'any' },
  { label: '顺序会签', value: 'sequential' },
]

/** 超时动作选项 */
export const TIMEOUT_ACTION_OPTIONS = [
  { label: '仅通知', value: 'notify' },
  { label: '自动通过', value: 'autoApprove' },
  { label: '自动驳回', value: 'autoReject' },
]

/** 优先级选项 */
export const PRIORITY_OPTIONS = [
  { label: '普通', value: 0 },
  { label: '重要', value: 1 },
  { label: '紧急', value: 2 },
]

/**
 * 生成用户任务的属性表单规则
 */
export function buildUserTaskRules(): Rule[] {
  return [
    {
      type: 'input',
      field: 'name',
      title: '节点名称',
      value: '',
      props: { placeholder: '请输入节点名称', maxlength: 128 },
    },
    {
      type: 'select',
      field: 'assigneeType',
      title: '审批人类型',
      value: 'user',
      options: ASSIGNEE_TYPE_OPTIONS,
      props: { placeholder: '请选择审批人类型' },
    },
    {
      type: 'input',
      field: 'assigneeValue',
      title: '审批人值',
      value: '',
      props: { placeholder: '用户ID / 角色编码 / 部门ID' },
      // 联动：根据审批人类型动态改变提示
      control: [
        {
          value: 'expression',
          rule: [{ field: 'assigneeValue', props: { placeholder: '如 variables.approverId' } }],
        },
      ],
    },
    {
      type: 'select',
      field: 'signType',
      title: '会签类型',
      value: 'all',
      options: SIGN_TYPE_OPTIONS,
    },
    {
      type: 'input',
      field: 'timeout',
      title: '超时时长',
      value: '',
      props: { placeholder: '如 2h / 1d / 30m' },
    },
    {
      type: 'select',
      field: 'timeoutAction',
      title: '超时动作',
      value: 'notify',
      options: TIMEOUT_ACTION_OPTIONS,
    },
    {
      type: 'select',
      field: 'priority',
      title: '优先级',
      value: 0,
      options: PRIORITY_OPTIONS,
    },
  ]
}

/**
 * 生成排他网关的条件规则
 */
export function buildExclusiveGatewayRules(): Rule[] {
  return [
    {
      type: 'input',
      field: 'name',
      title: '网关名称',
      value: '',
      props: { placeholder: '如 金额判断' },
    },
    {
      type: 'input',
      field: 'condition',
      title: '条件表达式',
      value: '',
      props: {
        placeholder: "如 amount > 1000 && hasRole(roles, 'manager')",
        type: 'textarea',
        rows: 3,
      },
    },
  ]
}

/**
 * 生成开始事件的规则
 */
export function buildStartEventRules(): Rule[] {
  return [
    {
      type: 'input',
      field: 'name',
      title: '事件名称',
      value: '开始',
      props: { placeholder: '请输入事件名称' },
    },
  ]
}

/**
 * 根据元素类型返回对应的表单规则
 */
export function buildRulesByElementType(elementType: string): Rule[] {
  switch (elementType) {
    case 'bpmn:UserTask':
    case 'bpmn:ServiceTask':
      return buildUserTaskRules()
    case 'bpmn:ExclusiveGateway':
    case 'bpmn:ParallelGateway':
    case 'bpmn:InclusiveGateway':
      return buildExclusiveGatewayRules()
    case 'bpmn:StartEvent':
      return buildStartEventRules()
    default:
      return [
        {
          type: 'input',
          field: 'name',
          title: '名称',
          value: '',
          props: { placeholder: '请输入名称' },
        },
      ]
  }
}
