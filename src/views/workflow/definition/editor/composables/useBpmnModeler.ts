// @ts-ignore
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from 'bpmn-js-properties-panel'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import camundaModdleDescriptor from 'camunda-bpmn-moddle/resources/camunda.json'
import { ref, shallowRef, onBeforeUnmount } from 'vue'

import workflowModdleDescriptor from '../config/moddle/workflow-moddle.json'
import { applyChineseTranslation } from '../utils/bpmn-i18n'
export function useBpmnModeler() {
  const containerRef = ref<HTMLDivElement | null>(null)
  const propertiesPanelRef = ref<HTMLDivElement | null>(null)
  const modeler = shallowRef<BpmnModeler>()
  const selectedElement = ref<any>(null)

  /** 初始化 modeler */
  async function init(xml?: string) {
    if (!containerRef.value || !propertiesPanelRef.value) return

    modeler.value = new BpmnModeler({
      container: containerRef.value,
      propertiesPanel: {
        parent: propertiesPanelRef.value,
      },
      additionalModules: applyChineseTranslation([BpmnPropertiesPanelModule, BpmnPropertiesProviderModule]),
      moddleExtensions: {
        camunda: camundaModdleDescriptor,
        workflow: workflowModdleDescriptor,
      },
      // 中文键盘绑定
      keyboard: {
        bindTo: document,
      },
    })

    // 监听选中元素变化
    modeler.value.on('selection.changed', (e: any) => {
      const selection = e.newSelection
      selectedElement.value = selection.length === 1 ? selection[0] : null
    })

    // 监听元素属性变化（用于同步到表单）
    modeler.value.on('element.changed', (e: any) => {
      if (e.element === selectedElement.value) {
        // 触发属性面板刷新
      }
    })

    // 加载初始 XML
    const defaultXml = xml || getDefaultBpmnXml()
    try {
      await modeler.value.importXML(defaultXml)
      modeler.value?.get('canvas').zoom('fit-viewport')
    } catch (err) {
      console.error('[BPMN] 加载失败:', err)
    }
  }

  /** 导出 XML */
  async function saveXML(): Promise<string> {
    if (!modeler.value) throw new Error('Modeler 未初始化')
    const { xml } = await modeler.value.saveXML({ format: true })
    return xml ?? ''
  }

  /** 导出 SVG */
  async function saveSVG(): Promise<string> {
    if (!modeler.value) throw new Error('Modeler 未初始化')
    const { svg } = await modeler.value.saveSVG()
    return svg ?? ''
  }

  /** 导入 XML */
  async function importXML(xml: string) {
    if (!modeler.value) throw new Error('Modeler 未初始化')
    await modeler.value.importXML(xml)
    modeler.value?.get('canvas').zoom('fit-viewport')
  }

  /** 获取当前选中元素的自定义属性 */
  function getElementCustomProps(): Record<string, any> {
    if (!selectedElement.value) return {}
    const bo = selectedElement.value.businessObject

    // 从 extensionElements 读取自定义属性
    const ext = bo.extensionElements
    if (!ext?.values?.length) return {}

    const props: Record<string, any> = {}
    for (const v of ext.values) {
      if (v.$type === 'workflow:CustomProps') {
        props.assigneeType = v.get('assigneeType')
        props.assigneeValue = v.get('assigneeValue')
        props.signType = v.get('signType')
        props.timeout = v.get('timeout')
        props.timeoutAction = v.get('timeoutAction')
        props.priority = v.get('priority')
        props.formSchema = v.get('formSchema')
      }
    }
    return props
  }

  /** 更新选中元素的自定义属性 */
  async function updateElementCustomProps(props: Record<string, any>) {
    if (!modeler.value || !selectedElement.value) return

    const modeling = modeler.value.get('modeling')
    const moddle = modeler.value.get('moddle')
    const bo = selectedElement.value.businessObject

    // 构造 workflow:CustomProps 扩展元素
    const customProps = moddle.create('workflow:CustomProps', {
      assigneeType: props.assigneeType,
      assigneeValue: props.assigneeValue,
      signType: props.signType,
      timeout: props.timeout,
      timeoutAction: props.timeoutAction,
      priority: props.priority,
      formSchema: props.formSchema ? JSON.stringify(props.formSchema) : undefined,
    })

    // 挂载到 extensionElements
    let ext = bo.extensionElements
    if (!ext) {
      ext = moddle.create('bpmn:ExtensionElements', { values: [] })
      modeling.updateProperties(selectedElement.value, { extensionElements: ext })
    }

    // 移除旧的 workflow:CustomProps，添加新的
    const others = ext.values.filter((v: any) => v.$type !== 'workflow:CustomProps')
    ext.values = [...others, customProps]

    modeling.updateProperties(selectedElement.value, { extensionElements: ext })
  }

  /** 销毁 */
  function destroy() {
    modeler.value?.destroy()
    modeler.value = null
  }

  onBeforeUnmount(destroy)

  return {
    containerRef,
    propertiesPanelRef,
    modeler,
    selectedElement,
    init,
    saveXML,
    saveSVG,
    importXML,
    getElementCustomProps,
    updateElementCustomProps,
    destroy,
  }
}

/* ============================================================
 * 默认 BPMN XML（新建流程时使用）
 * ============================================================ */
function getDefaultBpmnXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:workflow="http://saas-admin/workflow"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="100" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}
