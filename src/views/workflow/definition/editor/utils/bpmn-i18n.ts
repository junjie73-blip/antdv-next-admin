/**
 * bpmn-js 中文翻译字典
 * 参考：https://github.com/yangdan8/bpmn-js-i18n
 */
export const zhCN = {
  // 操作命令
  'Activate the global connect tool': '激活全局连线工具',
  'Append {type}': '添加 {type}',
  'Add Lane above': '在上方添加泳道',
  'Divide into two Lanes': '拆分为两个泳道',
  'Divide into three Lanes': '拆分为三个泳道',
  'Add Lane below': '在下方添加泳道',
  'Append compensation activity': '添加补偿活动',
  'Change type': '更改类型',
  'Connect using Association': '使用关联连接',
  'Connect using Sequence/MessageFlow or Association': '使用顺序/消息流或关联连接',
  'Connect using DataInputAssociation': '使用数据输入关联连接',
  Remove: '移除',
  'Activate the hand tool': '激活抓手工具',
  'Activate the lasso tool': '激活套索工具',
  'Activate the create/remove space tool': '激活创建/移除空间工具',
  'Create expanded SubProcess': '创建扩展子流程',
  'Create IntermediateThrowEvent/BoundaryEvent': '创建中间抛出事件/边界事件',
  'Create Pool/Participant': '创建池/参与者',
  'Parallel Multi Instance': '并行多实例',
  'Sequential Multi Instance': '顺序多实例',
  Loop: '循环',
  'Ad-hoc': '即席',
  'Add {type}': '添加 {type}',

  // 元素类型
  'Start Event': '开始事件',
  'End Event': '结束事件',
  'User Task': '用户任务',
  'Service Task': '服务任务',
  'Script Task': '脚本任务',
  'Exclusive Gateway': '排他网关',
  'Parallel Gateway': '并行网关',
  'Inclusive Gateway': '包容网关',
  'Event Based Gateway': '事件网关',
  'Intermediate Throw Event': '中间抛出事件',
  'Intermediate Catch Event': '中间捕获事件',
  'Boundary Event': '边界事件',
  'Sub Process': '子流程',
  'Call Activity': '调用活动',
  'Business Rule Task': '业务规则任务',
  'Manual Task': '手动任务',
  'Receive Task': '接收任务',
  'Send Task': '发送任务',
  Task: '任务',
  'Data Object': '数据对象',
  'Data Store': '数据存储',
  Group: '分组',
  TextAnnotation: '文本注释',
  Pool: '池',
  Lane: '泳道',

  // 属性面板
  General: '常规',
  Id: '标识符',
  Name: '名称',
  'Element Documentation': '元素文档',
  'Process Documentation': '流程文档',
  Properties: '属性',
  Assignee: '审批人',
  'Candidate Users': '候选用户',
  'Candidate Groups': '候选组',
  'Due Date': '截止日期',
  'Follow up Date': '跟进日期',
  Priority: '优先级',
  'Form Key': '表单键',
  'Form Fields': '表单字段',
  Condition: '条件',
  'Default Flow': '默认流',
  Details: '详情',

  // 校验
  'no shape type specified': '未指定元素类型',
  'element required': '元素不能为空',
  'invalid format': '格式无效',
  'must not be empty': '不能为空',
}

/**
 * 创建翻译函数
 */
export function createTranslator(dict: Record<string, string>) {
  return function t(template: string, replacements?: Record<string, any>): string {
    if (replacements) {
      return template.replace(/{([^}]+)}/g, (_, key) =>
        replacements[key] !== undefined ? replacements[key] : `{${key}}`,
      )
    }
    return dict[template] ?? template
  }
}

/**
 * 应用汉化到 bpmn-js 模块
 */
export function applyChineseTranslation(additionalModules: any[] = []) {
  const translateModule = {
    translate: ['value', createTranslator(zhCN)],
  }
  return [...additionalModules, translateModule]
}
