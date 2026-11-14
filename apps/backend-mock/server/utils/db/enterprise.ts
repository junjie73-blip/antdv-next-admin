/**
 * 企业能力演示数据集：工作流 / AI 资源 / 报表。
 *
 * 与 `login-log.ts` 那种「每次启动用 Math.random 现造」的旧演示数据不同，这里全部是
 * 固定种子常量：页面刷新、重启 mock 服务、跑单测，看到的是同一批记录，方便把
 * 「筛选 / 排序 / 分页 / 统计」写成可断言的纯函数。
 *
 * 数据只留在 backend-mock 子包，web 侧一律经 `~/api/enterprise` 取，
 * 页面里不再内嵌假数据 —— 这样换成真实后端时只换 handler，不动页面。
 */

export type WorkflowStatus = 'disabled' | 'draft' | 'published';
export type InstanceStatus =
  | 'failed'
  | 'running'
  | 'success'
  | 'terminated'
  | 'waiting';

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  disabled: '已停用',
  draft: '草稿',
  published: '已发布',
};

export const INSTANCE_STATUS_LABELS: Record<InstanceStatus, string> = {
  failed: '失败',
  running: '运行中',
  success: '成功',
  terminated: '已终止',
  waiting: '等待中',
};

export interface WorkflowDefinition {
  category: string;
  description: string;
  id: string;
  name: string;
  nodeCount: number;
  owner: string;
  runCount: number;
  status: WorkflowStatus;
  updatedAt: string;
  version: string;
}

/** 12 条流程定义，对齐参考实现「流程列表」的默认卡片墙 */
export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'WF-1001',
    name: '智能客服自动化',
    category: '智能服务',
    owner: '张敏',
    status: 'published',
    version: 'v2.6.0',
    nodeCount: 6,
    runCount: 18_642,
    description: '自动识别用户意图，检索知识库后生成答复，低置信度转人工。',
    updatedAt: '2026-11-08 09:42',
  },
  {
    id: 'WF-1002',
    name: '销售线索智能分配',
    category: '销售运营',
    owner: '李航',
    status: 'published',
    version: 'v1.8.2',
    nodeCount: 8,
    runCount: 9318,
    description: '按区域、行业与历史成单率给线索打分，自动派发到对应销售组。',
    updatedAt: '2026-11-07 16:20',
  },
  {
    id: 'WF-1003',
    name: '运营周报生成',
    category: '数据运营',
    owner: '王珂',
    status: 'published',
    version: 'v3.1.0',
    nodeCount: 5,
    runCount: 214,
    description: '汇总各渠道经营数据，生成图表与文字摘要并推送到管理群。',
    updatedAt: '2026-11-06 08:15',
  },
  {
    id: 'WF-1004',
    name: '退款风险审核',
    category: '风险控制',
    owner: '赵宁',
    status: 'published',
    version: 'v2.2.1',
    nodeCount: 9,
    runCount: 6720,
    description: '结合订单金额、历史退款率与设备指纹识别高风险退款单。',
    updatedAt: '2026-11-05 14:36',
  },
  {
    id: 'WF-1005',
    name: '合同要素抽取',
    category: '法务合规',
    owner: '周明',
    status: 'published',
    version: 'v1.4.0',
    nodeCount: 7,
    runCount: 1286,
    description: '从合同扫描件中抽取主体、金额、期限与违约条款并入库。',
    updatedAt: '2026-11-04 11:08',
  },
  {
    id: 'WF-1006',
    name: '发票验真与归档',
    category: '财务共享',
    owner: '张敏',
    status: 'published',
    version: 'v2.0.3',
    nodeCount: 6,
    runCount: 4905,
    description: '识别发票代码、校验税号，验真通过后按月份归档。',
    updatedAt: '2026-11-03 17:52',
  },
  {
    id: 'WF-1007',
    name: '会议纪要与行动项',
    category: '协同办公',
    owner: '李航',
    status: 'draft',
    version: 'v0.9.0',
    nodeCount: 5,
    runCount: 42,
    description: '转写会议录音，抽取结论与待办并同步到任务系统。',
    updatedAt: '2026-11-02 10:30',
  },
  {
    id: 'WF-1008',
    name: '内容合规审核',
    category: '法务合规',
    owner: '王珂',
    status: 'published',
    version: 'v1.7.4',
    nodeCount: 8,
    runCount: 12_064,
    description: '对投放素材做敏感词、资质与版权检查，命中后转人工复核。',
    updatedAt: '2026-11-01 09:18',
  },
  {
    id: 'WF-1009',
    name: '工单分类与升级',
    category: '智能服务',
    owner: '赵宁',
    status: 'published',
    version: 'v2.3.0',
    nodeCount: 6,
    runCount: 23_517,
    description: '按问题类型自动分派工单，超时未响应逐级升级。',
    updatedAt: '2026-10-31 15:44',
  },
  {
    id: 'WF-1010',
    name: '库存异常预警',
    category: '供应链',
    owner: '周明',
    status: 'disabled',
    version: 'v1.1.2',
    nodeCount: 7,
    runCount: 0,
    description: '监控库存周转与缺货率，异常时通知仓管与采购。',
    updatedAt: '2026-10-30 13:26',
  },
  {
    id: 'WF-1011',
    name: '新员工入职协同',
    category: '人力资源',
    owner: '张敏',
    status: 'draft',
    version: 'v0.6.1',
    nodeCount: 10,
    runCount: 18,
    description: '联动账号开通、设备领用、培训排期与导师分配。',
    updatedAt: '2026-10-29 09:05',
  },
  {
    id: 'WF-1012',
    name: '客户数据质量巡检',
    category: '数据运营',
    owner: '李航',
    status: 'published',
    version: 'v1.2.0',
    nodeCount: 5,
    runCount: 780,
    description: '每日巡检客户主数据完整度、重复度与字段规范。',
    updatedAt: '2026-10-28 18:40',
  },
];

export const WORKFLOW_CATEGORIES = [
  '智能服务',
  '销售运营',
  '数据运营',
  '风险控制',
  '法务合规',
  '财务共享',
  '协同办公',
  '供应链',
  '人力资源',
];

export const WORKFLOW_OWNERS = ['张敏', '李航', '王珂', '赵宁', '周明'];

export interface WorkflowInstance {
  currentNode: string;
  duration: string;
  environment: '生产环境' | '预发环境';
  id: string;
  initiator: string;
  name: string;
  progress: number;
  startTime: string;
  status: InstanceStatus;
  traceId: string;
  trigger: string;
}

export const WORKFLOW_INSTANCES: WorkflowInstance[] = [
  {
    id: 'RUN-20261110-10428',
    traceId: 'tr_9f71c2e84b6a',
    name: '智能客服自动化',
    status: 'running',
    progress: 68,
    trigger: '用户消息',
    initiator: '网关服务',
    startTime: '2026-11-10 09:12:04',
    duration: '2m 18s',
    environment: '生产环境',
    currentNode: '生成客服答复',
  },
  {
    id: 'RUN-20261110-10427',
    traceId: 'tr_2c40ab91de35',
    name: '销售线索智能分配',
    status: 'success',
    progress: 100,
    trigger: '定时调度',
    initiator: 'CRM',
    startTime: '2026-11-10 09:05:31',
    duration: '46s',
    environment: '生产环境',
    currentNode: '输出分配结果',
  },
  {
    id: 'RUN-20261110-10426',
    traceId: 'tr_73bd0f18ac92',
    name: '退款风险审核',
    status: 'failed',
    progress: 42,
    trigger: '订单事件',
    initiator: '交易系统',
    startTime: '2026-11-10 08:58:12',
    duration: '1m 06s',
    environment: '生产环境',
    currentNode: '风险模型推理',
  },
  {
    id: 'RUN-20261110-10425',
    traceId: 'tr_5e18c2d74ab0',
    name: '合同要素抽取',
    status: 'waiting',
    progress: 55,
    trigger: '人工发起',
    initiator: '周明',
    startTime: '2026-11-10 08:41:20',
    duration: '5m 32s',
    environment: '预发环境',
    currentNode: '人工复核',
  },
  {
    id: 'RUN-20261110-10424',
    traceId: 'tr_a0d93e1b7c44',
    name: '内容合规审核',
    status: 'success',
    progress: 100,
    trigger: '素材上传',
    initiator: '投放平台',
    startTime: '2026-11-10 08:30:08',
    duration: '38s',
    environment: '生产环境',
    currentNode: '输出审核结论',
  },
  {
    id: 'RUN-20261110-10423',
    traceId: 'tr_b8f2146ad0e9',
    name: '工单分类与升级',
    status: 'running',
    progress: 24,
    trigger: '工单创建',
    initiator: '客服系统',
    startTime: '2026-11-10 08:22:47',
    duration: '48s',
    environment: '生产环境',
    currentNode: '问题分类器',
  },
  {
    id: 'RUN-20261110-10422',
    traceId: 'tr_c19e7ba5d302',
    name: '运营周报生成',
    status: 'terminated',
    progress: 31,
    trigger: '定时调度',
    initiator: '调度中心',
    startTime: '2026-11-10 08:00:00',
    duration: '3m 14s',
    environment: '预发环境',
    currentNode: '汇总渠道数据',
  },
  {
    id: 'RUN-20261110-10421',
    traceId: 'tr_d45c0f83ea17',
    name: '发票验真与归档',
    status: 'success',
    progress: 100,
    trigger: '发票上传',
    initiator: '财务共享',
    startTime: '2026-11-10 07:46:19',
    duration: '52s',
    environment: '生产环境',
    currentNode: '写入归档目录',
  },
];

export interface WorkflowAlert {
  id: string;
  level: 'error' | 'info' | 'warning';
  message: string;
  time: string;
  title: string;
}

export const WORKFLOW_ALERTS: WorkflowAlert[] = [
  {
    id: 'AL-01',
    level: 'error',
    title: '模型节点连续超时',
    message: '风险模型推理在 5 分钟内超时 3 次',
    time: '09:14',
  },
  {
    id: 'AL-02',
    level: 'warning',
    title: '人工复核等待时间过长',
    message: '合同要素抽取的复核队列已积压 12 单',
    time: '08:52',
  },
  {
    id: 'AL-03',
    level: 'warning',
    title: '成功率低于告警阈值',
    message: '近 1 小时执行成功率 92.4%，低于 95%',
    time: '08:36',
  },
  {
    id: 'AL-04',
    level: 'info',
    title: '连接器服务已恢复',
    message: 'CRM 连接器心跳恢复正常',
    time: '08:10',
  },
];

/** 近 7 个时间点的吞吐，用于监控页的柱状图 */
export const WORKFLOW_THROUGHPUT = [
  { time: '08:00', success: 42, failed: 3 },
  { time: '08:05', success: 58, failed: 2 },
  { time: '08:10', success: 51, failed: 6 },
  { time: '08:15', success: 67, failed: 1 },
  { time: '08:20', success: 73, failed: 4 },
  { time: '08:25', success: 61, failed: 2 },
  { time: '08:30', success: 80, failed: 3 },
];

export const WORKFLOW_LATENCY_RANKS = [
  { node: '风险模型推理', ms: 1840 },
  { node: '知识库检索', ms: 920 },
  { node: '合同要素抽取', ms: 760 },
  { node: '参数提取器', ms: 410 },
];

export interface AiResource {
  description: string;
  icon: string;
  id: string;
  metrics: Array<{ label: string; value: string }>;
  name: string;
  owner: string;
  status: 'disabled' | 'draft' | 'running';
  tags: string[];
  updatedAt: string;
}

export const AI_STATUS_LABELS: Record<AiResource['status'], string> = {
  disabled: '已停用',
  draft: '草稿',
  running: '运行中',
};

export const AI_AGENTS: AiResource[] = [
  {
    id: 'AG-01',
    name: '销售洞察 Agent',
    icon: 'carbon:machine-learning',
    status: 'running',
    owner: '张敏',
    tags: ['经营分析', 'BI'],
    description: '解读销售看板，定位异常指标并给出归因建议。',
    metrics: [
      { label: '调用次数', value: '18.6k' },
      { label: '成功率', value: '98.2%' },
      { label: '平均耗时', value: '2.1s' },
    ],
    updatedAt: '2026-11-09 10:24',
  },
  {
    id: 'AG-02',
    name: '财务核对 Agent',
    icon: 'carbon:calculator',
    status: 'running',
    owner: '李航',
    tags: ['财务', '对账'],
    description: '自动核对发票、回款与台账差异并输出差异清单。',
    metrics: [
      { label: '调用次数', value: '9.4k' },
      { label: '成功率', value: '99.1%' },
      { label: '平均耗时', value: '1.8s' },
    ],
    updatedAt: '2026-11-08 15:10',
  },
  {
    id: 'AG-03',
    name: '审批助手 Agent',
    icon: 'carbon:checkmark-outline',
    status: 'running',
    owner: '王珂',
    tags: ['审批', '风控'],
    description: '读取审批单上下文，给出合规提示与风险标记。',
    metrics: [
      { label: '调用次数', value: '12.2k' },
      { label: '成功率', value: '97.6%' },
      { label: '平均耗时', value: '2.4s' },
    ],
    updatedAt: '2026-11-08 09:36',
  },
  {
    id: 'AG-04',
    name: '仓储调度 Agent',
    icon: 'carbon:delivery',
    status: 'running',
    owner: '赵宁',
    tags: ['供应链'],
    description: '结合库存与运力生成调拨建议。',
    metrics: [
      { label: '调用次数', value: '6.8k' },
      { label: '成功率', value: '96.9%' },
      { label: '平均耗时', value: '3.0s' },
    ],
    updatedAt: '2026-11-07 17:02',
  },
  {
    id: 'AG-05',
    name: '客服回复 Agent',
    icon: 'carbon:chat',
    status: 'running',
    owner: '周明',
    tags: ['客服', '知识库'],
    description: '基于产品知识库生成标准回复，保留引用来源。',
    metrics: [
      { label: '调用次数', value: '24.1k' },
      { label: '成功率', value: '98.8%' },
      { label: '平均耗时', value: '1.6s' },
    ],
    updatedAt: '2026-11-07 11:48',
  },
  {
    id: 'AG-06',
    name: 'BI 解读 Agent',
    icon: 'carbon:chart-line-data',
    status: 'running',
    owner: '张敏',
    tags: ['BI'],
    description: '把自然语言问题转成查询并解释结果。',
    metrics: [
      { label: '调用次数', value: '7.3k' },
      { label: '成功率', value: '97.2%' },
      { label: '平均耗时', value: '2.7s' },
    ],
    updatedAt: '2026-11-06 14:20',
  },
  {
    id: 'AG-07',
    name: '合同审阅 Agent',
    icon: 'carbon:document',
    status: 'draft',
    owner: '李航',
    tags: ['法务'],
    description: '比对合同模板，标出偏离条款与缺失要素。',
    metrics: [
      { label: '调用次数', value: '312' },
      { label: '成功率', value: '94.0%' },
      { label: '平均耗时', value: '4.2s' },
    ],
    updatedAt: '2026-11-05 16:44',
  },
  {
    id: 'AG-08',
    name: '报表生成 Agent',
    icon: 'carbon:report',
    status: 'disabled',
    owner: '王珂',
    tags: ['报表'],
    description: '按口径自动生成日报并推送订阅人。',
    metrics: [
      { label: '调用次数', value: '0' },
      { label: '成功率', value: '-' },
      { label: '平均耗时', value: '-' },
    ],
    updatedAt: '2026-11-04 09:12',
  },
];

export const AI_MODELS: AiResource[] = [
  {
    id: 'MD-01',
    name: 'GPT-4o',
    icon: 'carbon:model',
    status: 'running',
    owner: 'OpenAI',
    tags: ['CHAT', '128K'],
    description: '多模态通用模型，适合复杂推理与工具调用。',
    metrics: [
      { label: '上下文窗口', value: '128K' },
      { label: '本月调用', value: '82.4k' },
      { label: '平均延迟', value: '1.2s' },
    ],
    updatedAt: '2026-11-09 08:00',
  },
  {
    id: 'MD-02',
    name: 'GPT-4o mini',
    icon: 'carbon:model',
    status: 'running',
    owner: 'OpenAI',
    tags: ['CHAT', '128K'],
    description: '轻量快速模型，适合分类与短文本生成。',
    metrics: [
      { label: '上下文窗口', value: '128K' },
      { label: '本月调用', value: '156k' },
      { label: '平均延迟', value: '0.6s' },
    ],
    updatedAt: '2026-11-09 08:00',
  },
  {
    id: 'MD-03',
    name: 'Claude 3.7 Sonnet',
    icon: 'carbon:model',
    status: 'running',
    owner: 'Anthropic',
    tags: ['REASON', '200K'],
    description: '长上下文推理，适合合同与代码审阅。',
    metrics: [
      { label: '上下文窗口', value: '200K' },
      { label: '本月调用', value: '41.2k' },
      { label: '平均延迟', value: '1.8s' },
    ],
    updatedAt: '2026-11-08 08:00',
  },
  {
    id: 'MD-04',
    name: 'GLM-4-Plus',
    icon: 'carbon:model',
    status: 'running',
    owner: '智谱 AI',
    tags: ['CHAT', '128K'],
    description: '中文语义理解与结构化输出。',
    metrics: [
      { label: '上下文窗口', value: '128K' },
      { label: '本月调用', value: '63.7k' },
      { label: '平均延迟', value: '1.1s' },
    ],
    updatedAt: '2026-11-08 08:00',
  },
  {
    id: 'MD-05',
    name: 'Kimi K2',
    icon: 'carbon:model',
    status: 'running',
    owner: 'Moonshot',
    tags: ['CHAT', '256K'],
    description: '超长文档阅读与摘要。',
    metrics: [
      { label: '上下文窗口', value: '256K' },
      { label: '本月调用', value: '28.9k' },
      { label: '平均延迟', value: '2.0s' },
    ],
    updatedAt: '2026-11-07 08:00',
  },
  {
    id: 'MD-06',
    name: 'DeepSeek V3',
    icon: 'carbon:model',
    status: 'running',
    owner: 'DeepSeek',
    tags: ['CHAT', '128K'],
    description: '通用对话与代码生成。',
    metrics: [
      { label: '上下文窗口', value: '128K' },
      { label: '本月调用', value: '94.1k' },
      { label: '平均延迟', value: '1.4s' },
    ],
    updatedAt: '2026-11-07 08:00',
  },
  {
    id: 'MD-07',
    name: 'Gemini 2.5 Pro',
    icon: 'carbon:model',
    status: 'running',
    owner: 'Google',
    tags: ['REASON', '1M'],
    description: '百万级上下文与多模态分析。',
    metrics: [
      { label: '上下文窗口', value: '1M' },
      { label: '本月调用', value: '19.6k' },
      { label: '平均延迟', value: '2.3s' },
    ],
    updatedAt: '2026-11-06 08:00',
  },
  {
    id: 'MD-08',
    name: 'Qwen-Max',
    icon: 'carbon:model',
    status: 'running',
    owner: '通义千问',
    tags: ['CHAT', '32K'],
    description: '中文业务问答与表格理解。',
    metrics: [
      { label: '上下文窗口', value: '32K' },
      { label: '本月调用', value: '51.3k' },
      { label: '平均延迟', value: '1.0s' },
    ],
    updatedAt: '2026-11-06 08:00',
  },
  {
    id: 'MD-09',
    name: 'DeepSeek R1',
    icon: 'carbon:model',
    status: 'draft',
    owner: 'DeepSeek',
    tags: ['REASON', '64K'],
    description: '深度推理，适合复杂决策链。',
    metrics: [
      { label: '上下文窗口', value: '64K' },
      { label: '本月调用', value: '4.2k' },
      { label: '平均延迟', value: '4.8s' },
    ],
    updatedAt: '2026-11-05 08:00',
  },
  {
    id: 'MD-10',
    name: 'Enterprise Chat 32B',
    icon: 'carbon:model',
    status: 'disabled',
    owner: '企业内部模型网关',
    tags: ['私有化', '32K'],
    description: '内网部署的私有模型，数据不出域。',
    metrics: [
      { label: '上下文窗口', value: '32K' },
      { label: '本月调用', value: '0' },
      { label: '平均延迟', value: '-' },
    ],
    updatedAt: '2026-11-04 08:00',
  },
];

export const AI_KNOWLEDGE_BASES: AiResource[] = [
  {
    id: 'KB-01',
    name: '产品能力手册',
    icon: 'carbon:book',
    status: 'running',
    owner: '产品部',
    tags: ['产品'],
    description: '产品功能、版本差异与典型配置说明。',
    metrics: [
      { label: '文档数', value: '286' },
      { label: '命中率', value: '91%' },
      { label: '更新频率', value: '每日' },
    ],
    updatedAt: '2026-11-09 12:00',
  },
  {
    id: 'KB-02',
    name: '财务制度知识库',
    icon: 'carbon:book',
    status: 'running',
    owner: '财务部',
    tags: ['财务'],
    description: '报销标准、审批权限与财务口径。',
    metrics: [
      { label: '文档数', value: '148' },
      { label: '命中率', value: '89%' },
      { label: '更新频率', value: '每周' },
    ],
    updatedAt: '2026-11-08 12:00',
  },
  {
    id: 'KB-03',
    name: '客服 FAQ 知识库',
    icon: 'carbon:book',
    status: 'running',
    owner: '客服中心',
    tags: ['客服'],
    description: '高频问题标准答复与升级路径。',
    metrics: [
      { label: '文档数', value: '1,204' },
      { label: '命中率', value: '94%' },
      { label: '更新频率', value: '每日' },
    ],
    updatedAt: '2026-11-08 09:30',
  },
  {
    id: 'KB-04',
    name: '仓储 SOP 知识库',
    icon: 'carbon:book',
    status: 'running',
    owner: '供应链',
    tags: ['SOP'],
    description: '入库、盘点、调拨与异常处理流程。',
    metrics: [
      { label: '文档数', value: '96' },
      { label: '命中率', value: '87%' },
      { label: '更新频率', value: '每月' },
    ],
    updatedAt: '2026-11-07 12:00',
  },
  {
    id: 'KB-05',
    name: '合同条款知识库',
    icon: 'carbon:book',
    status: 'running',
    owner: '法务部',
    tags: ['法务'],
    description: '标准条款库与历史审阅结论。',
    metrics: [
      { label: '文档数', value: '212' },
      { label: '命中率', value: '90%' },
      { label: '更新频率', value: '每周' },
    ],
    updatedAt: '2026-11-06 12:00',
  },
  {
    id: 'KB-06',
    name: '实施交付知识库',
    icon: 'carbon:book',
    status: 'draft',
    owner: '交付中心',
    tags: ['交付'],
    description: '项目实施模板、验收清单与常见坑。',
    metrics: [
      { label: '文档数', value: '64' },
      { label: '命中率', value: '-' },
      { label: '更新频率', value: '-' },
    ],
    updatedAt: '2026-11-05 12:00',
  },
  {
    id: 'KB-07',
    name: '经营指标口径库',
    icon: 'carbon:book',
    status: 'running',
    owner: '数据部',
    tags: ['指标'],
    description: 'GMV、转化率、留存等指标的统一口径。',
    metrics: [
      { label: '文档数', value: '78' },
      { label: '命中率', value: '95%' },
      { label: '更新频率', value: '每月' },
    ],
    updatedAt: '2026-11-04 12:00',
  },
];

export interface AiProvider {
  createdAt: string;
  description: string;
  id: string;
  name: string;
  protocol: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'PV-01',
    name: 'OpenAI',
    protocol: 'openai-compatible',
    description: 'GPT 系列模型服务',
    createdAt: '2026-09-12 10:00:00',
  },
  {
    id: 'PV-02',
    name: 'Anthropic',
    protocol: 'anthropic',
    description: 'Claude 系列模型服务',
    createdAt: '2026-09-14 11:20:00',
  },
  {
    id: 'PV-03',
    name: '智谱 AI',
    protocol: 'openai-compatible',
    description: 'GLM 系列模型服务',
    createdAt: '2026-09-18 09:40:00',
  },
  {
    id: 'PV-04',
    name: 'DeepSeek',
    protocol: 'openai-compatible',
    description: 'DeepSeek 系列模型服务',
    createdAt: '2026-10-08 15:10:00',
  },
  {
    id: 'PV-05',
    name: 'Google',
    protocol: 'google-generative-ai',
    description: 'Gemini 系列模型服务',
    createdAt: '2026-10-20 14:05:00',
  },
];

export interface ReportDataset {
  fields: string[];
  id: string;
  name: string;
  rows: number;
  type: 'rest' | 'sample' | 'sql';
  updatedAt: string;
}

export const REPORT_DATASETS: ReportDataset[] = [
  {
    id: 'DS-01',
    name: '销售订单数据',
    type: 'sample',
    rows: 180,
    fields: ['日期', '区域', '渠道', 'GMV', '订单数', '转化率', '毛利率'],
    updatedAt: '2026-11-10 08:30',
  },
  {
    id: 'DS-02',
    name: '增长转化漏斗',
    type: 'rest',
    rows: 5,
    fields: ['阶段', '人数', '转化率'],
    updatedAt: '2026-11-09 17:20',
  },
  {
    id: 'DS-03',
    name: '系统监控指标',
    type: 'sql',
    rows: 5,
    fields: ['指标', '实例', '数值', '采集时间'],
    updatedAt: '2026-11-09 16:00',
  },
  {
    id: 'DS-04',
    name: '费用明细',
    type: 'sample',
    rows: 5,
    fields: ['单号', '部门', '费用类型', '金额', '状态'],
    updatedAt: '2026-11-08 11:45',
  },
];

export interface ChartWidget {
  id: string;
  insight: string;
  kind: string;
  source: string;
  title: string;
}

export const CHART_WIDGETS: ChartWidget[] = [
  {
    id: 'WG-01',
    title: '今日 GMV',
    kind: '指标卡',
    source: '销售订单数据',
    insight: 'GMV 环比保持增长，海外与华中贡献明显。',
  },
  {
    id: 'WG-02',
    title: '平均转化率',
    kind: '指标卡',
    source: '销售订单数据',
    insight: '转化率较上周提升 1.8 个百分点。',
  },
  {
    id: 'WG-03',
    title: 'GMV 趋势',
    kind: '趋势面积图',
    source: '销售订单数据',
    insight: '周末流量抬升明显，建议提前备货。',
  },
  {
    id: 'WG-04',
    title: '区域销售排行',
    kind: '排行柱状图',
    source: '销售订单数据',
    insight: '华东连续三周居首，西南增速最快。',
  },
  {
    id: 'WG-05',
    title: '渠道结构',
    kind: '占比环图',
    source: '销售订单数据',
    insight: '自然流量占比升至 42%。',
  },
  {
    id: 'WG-06',
    title: '增长转化漏斗',
    kind: '转化漏斗',
    source: '增长转化漏斗',
    insight: '留资到试用环节流失最大。',
  },
  {
    id: 'WG-07',
    title: 'AI 经营洞察',
    kind: 'AI 洞察',
    source: '销售订单数据',
    insight: '建议对高毛利区域追加投放预算。',
  },
];

export interface ListFilters {
  category?: string;
  keyword?: string;
  owner?: string;
  sort?: string;
  status?: string;
}

/** 归一化分页参数：非法值、负数、超大页都收敛到安全区间 */
export function paginate<T>(
  items: T[],
  pageNum?: unknown,
  pageSize?: unknown,
): { list: T[]; pageNum: number; pageSize: number; total: number } {
  const requestedPage = Number(pageNum);
  const requestedSize = Number(pageSize);
  const page =
    Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
  const size =
    Number.isFinite(requestedSize) && requestedSize > 0
      ? Math.min(Math.floor(requestedSize), 200)
      : 10;
  const total = items.length;
  const start = (page - 1) * size;
  return {
    list: items.slice(start, start + size),
    pageNum: page,
    pageSize: size,
    total,
  };
}

/** 流程列表：关键字 / 状态 / 分类 / 负责人 四路筛选 + 三种排序 */
export function selectWorkflowDefinitions(
  items: WorkflowDefinition[],
  filters: ListFilters,
): WorkflowDefinition[] {
  const keyword = (filters.keyword ?? '').trim().toLowerCase();
  const status = filters.status ?? '';
  const category = filters.category ?? '';
  const owner = filters.owner ?? '';

  const selected = items.filter((item) => {
    if (status && item.status !== status) return false;
    if (category && item.category !== category) return false;
    if (owner && item.owner !== owner) return false;
    if (!keyword) return true;
    return [item.name, item.category, item.owner, item.description].some(
      (field) => field.toLowerCase().includes(keyword),
    );
  });

  if (filters.sort === 'name') {
    return [...selected].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }
  if (filters.sort === 'runs') {
    return [...selected].sort((a, b) => b.runCount - a.runCount);
  }
  // 默认「最近更新」：数据按 updatedAt 倒序存放，这里显式排一次以防数据集顺序变动
  return [...selected].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function summarizeWorkflowDefinitions(items: WorkflowDefinition[]) {
  return {
    disabled: items.filter((item) => item.status === 'disabled').length,
    draft: items.filter((item) => item.status === 'draft').length,
    published: items.filter((item) => item.status === 'published').length,
    total: items.length,
  };
}

export function summarizeWorkflowInstances(items: WorkflowInstance[]) {
  const succeeded = items.filter((item) => item.status === 'success').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  return {
    failed,
    running: items.filter((item) => item.status === 'running').length,
    successRate:
      items.length === 0
        ? 0
        : Math.round((succeeded / items.length) * 1000) / 10,
    succeeded,
    total: items.length,
    unhandledAlerts: WORKFLOW_ALERTS.filter((alert) => alert.level !== 'info')
      .length,
  };
}

/** AI 资源列表：关键字与状态筛选，默认按更新时间倒序 */
export function selectResources(
  items: AiResource[],
  filters: ListFilters,
): AiResource[] {
  const keyword = (filters.keyword ?? '').trim().toLowerCase();
  const status = filters.status ?? '';
  const selected = items.filter((item) => {
    if (status && item.status !== status) return false;
    if (!keyword) return true;
    return [item.name, item.description, item.owner, ...item.tags].some(
      (field) => field.toLowerCase().includes(keyword),
    );
  });
  if (filters.sort === 'name') {
    return [...selected].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }
  return [...selected].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * 流程定义的进程内可变副本。
 *
 * 列表 / 新建 / 编辑 / 启停 / 删除共用这一份，改完刷新列表能看到结果；
 * 常量 `WORKFLOW_DEFINITIONS` 保持只读，供单测当作基准数据用。
 */
export const WORKFLOW_STORE: { items: WorkflowDefinition[] } = {
  items: [...WORKFLOW_DEFINITIONS],
};

/** 生成一条新流程定义：缺字段一律走安全默认值，不信任请求体 */
export function createDefinition(
  input: Record<string, unknown>,
  id: string,
): WorkflowDefinition {
  return {
    category: String(input.category ?? '未分类'),
    description: String(input.description ?? ''),
    id,
    name: String(input.name ?? '未命名流程'),
    nodeCount: 0,
    owner: String(input.owner ?? 'admin'),
    runCount: 0,
    status: 'draft',
    updatedAt: '2026-11-10 09:20:00',
    version: 'v0.1.0',
  };
}
