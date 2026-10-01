/**
 * 将 BPMN XML 转换为后端友好的 JSON 结构
 */
export interface WorkflowNode {
  id: string
  type: string
  name?: string
  assignee?: {
    type: string
    value?: string
  }
  signType?: string
  timeout?: {
    duration: string
    action: string
  }
  priority?: number
  formSchema?: any[]
  condition?: string
  serviceConfig?: Record<string, any>
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  condition?: string
  isDefault?: boolean
}

export interface WorkflowDefinitionJSON {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * 解析 BPMN XML 为业务 JSON
 */
export async function xmlToJson(xml: string): Promise<WorkflowDefinitionJSON> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  const processEl = doc.querySelector('process')
  if (!processEl) {
    throw new Error('BPMN 中未找到 process 元素')
  }

  const processId = processEl.getAttribute('id') ?? 'Process_1'

  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []

  // 遍历所有流程节点
  const nodeTags = [
    'startEvent',
    'endEvent',
    'userTask',
    'serviceTask',
    'scriptTask',
    'exclusiveGateway',
    'parallelGateway',
    'inclusiveGateway',
  ]

  for (const tag of nodeTags) {
    const els = processEl.getElementsByTagName(`bpmn:${tag}`)
    for (let i = 0; i < els.length; i++) {
      const el = els[i]!
      nodes.push(parseNode(el, tag))
    }
  }

  // 解析连线
  const seqFlows = processEl.getElementsByTagName('bpmn:sequenceFlow')
  for (let i = 0; i < seqFlows.length; i++) {
    const el = seqFlows[i]!
    edges.push({
      id: el.getAttribute('id') ?? `edge_${i}`,
      source: el.getAttribute('sourceRef') ?? '',
      target: el.getAttribute('targetRef') ?? '',
      condition: extractCondition(el),
    })
  }

  return {
    id: processId,
    name: doc.querySelector('process')?.getAttribute('name') ?? '新流程',
    nodes,
    edges,
  }
}

function parseNode(el: Element, tag: string): WorkflowNode {
  const id = el.getAttribute('id') ?? ''
  const name = el.getAttribute('name') ?? undefined

  const node: WorkflowNode = {
    id,
    type: mapTagToType(tag),
    name,
  }

  // 读取自定义属性
  const ext = el.getElementsByTagName('bpmn:extensionElements')[0]
  if (ext) {
    const custom = ext.getElementsByTagName('workflow:CustomProps')[0]
    if (custom) {
      const assigneeType = custom.getAttribute('assigneeType')
      const assigneeValue = custom.getAttribute('assigneeValue')
      if (assigneeType) {
        node.assignee = { type: assigneeType, value: assigneeValue ?? undefined }
      }
      const signType = custom.getAttribute('signType')
      if (signType) node.signType = signType

      const timeout = custom.getAttribute('timeout')
      const timeoutAction = custom.getAttribute('timeoutAction')
      if (timeout) {
        node.timeout = { duration: timeout, action: timeoutAction ?? 'notify' }
      }

      const priority = custom.getAttribute('priority')
      if (priority) node.priority = Number(priority)

      const formSchema = custom.getAttribute('formSchema')
      if (formSchema) {
        try {
          node.formSchema = JSON.parse(formSchema)
        } catch {
          /* ignore */
        }
      }
    }
  }

  return node
}

function extractCondition(el: Element): string | undefined {
  const cond = el.getElementsByTagName('bpmn:conditionExpression')[0]
  return cond?.textContent?.trim() || undefined
}

function mapTagToType(tag: string): string {
  const map: Record<string, string> = {
    startEvent: 'start',
    endEvent: 'end',
    userTask: 'userTask',
    serviceTask: 'serviceTask',
    scriptTask: 'scriptTask',
    exclusiveGateway: 'exclusiveGateway',
    parallelGateway: 'parallelGateway',
    inclusiveGateway: 'inclusiveGateway',
  }
  return map[tag] ?? tag
}
