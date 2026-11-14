import type { PageSchema } from '../core/types';

/**
 * 示例页 Schema：一页把「绑定 / 条件 / 数据源 / 事件 / 插槽」四件事都用上。
 *
 * 分层位置：`presets/`。它同时是**单测夹具**与**宿主演示数据**（`__tests__` 直接渲染它，
 * 宿主 `configureLowcode({ fetcher })` 之后 `<LowCodeRenderer :nodes="demoPageSchema.tree" />`
 * 就能看到东西），所以刻意只依赖 basic 预设里那九个物料，不引用任何宿主业务组件。
 *
 * 本文件**不做**的事：不带业务语义、不保证接口存在（`rest` 的 url 是占位，
 * 能不能拉到数据取决于宿主有没有注入 `fetcher`；没注入时表格显示那句「没有数据」的提示，
 * 而不是白屏 —— 这正是 runner 报 `no-fetcher` 的可见结果）。
 */

export const DEMO_PAGE_ID = 'page-demo-overview';

/** 演示页的数据源 id：宿主接 `fetcher` / 埋点时按这些名字区分即可 */
export const DEMO_DATASOURCE_ROLES = 'roles';
export const DEMO_DATASOURCE_MEMBERS = 'members';
export const DEMO_DATASOURCE_SUMMARY = 'summary';
export const DEMO_DATASOURCE_SYNC = 'sync';

export const demoPageSchema: PageSchema = {
  dataSources: [
    {
      auto: true,
      // 静态源：写回 scope 后 `{{ roles }}` 直接可用，选择器不必等接口
      data: [
        { label: '管理员', value: 'admin' },
        { label: '编辑', value: 'editor' },
        { label: '访客', value: 'guest' },
      ],
      id: DEMO_DATASOURCE_ROLES,
      kind: 'static',
      name: '角色字典',
      path: 'roles',
    },
    {
      auto: true,
      // 参数与依赖：`members` 读 `form.dept`，并在字典就绪后才发，避免下拉先空一帧
      dependsOn: [DEMO_DATASOURCE_ROLES],
      id: DEMO_DATASOURCE_MEMBERS,
      kind: 'rest',
      method: 'GET',
      name: '成员列表',
      params: { dept: "{{ form.dept ?? '未分配' }}", page: 1 },
      path: 'members',
      url: '/api/lowcode/demo/members',
    },
    {
      auto: true,
      // function 源的省事写法：没注册 handler 时退化为受限表达式，够算个汇总数。
      // `dependsOn` 不能省：装载是并发跑的，不声明依赖时 `len(members)` 有可能在
      // 成员列表落地之前就被求值，表现是「人数合计偶尔是 0」这种复现不了的抖。
      dependsOn: [DEMO_DATASOURCE_MEMBERS],
      expression: '{{ len(members) }}',
      id: DEMO_DATASOURCE_SUMMARY,
      kind: 'function',
      name: '人数合计',
      path: 'summary.count',
    },
    {
      auto: false,
      // 手动源：只有点「重新同步」才发，用来演示 `refresh:` 动作与 loading 态
      id: DEMO_DATASOURCE_SYNC,
      kind: 'rest',
      method: 'POST',
      name: '重新同步',
      path: 'syncResult',
      url: '/api/lowcode/demo/sync',
    },
  ],
  id: DEMO_PAGE_ID,
  name: '示例页：成员概览',
  state: {
    form: { dept: '平台组', email: '', name: '', note: '' },
    history: [],
    showEmptyHint: true,
  },
  tree: [
    {
      children: [
        {
          id: 'node-text-title',
          props: { level: 'title', text: '{{ form.dept }} 的成员概览' },
          type: 'basic.text',
        },
        {
          // 条件显隐：数字 0 也算假，所以合计为 0 时整个徽章不渲染
          condition: '{{ summary.count > 0 }}',
          id: 'node-badge-count',
          props: { text: '{{ summary.count }} 人' },
          type: 'basic.badge',
        },
        {
          events: { click: `refresh:${DEMO_DATASOURCE_SYNC}` },
          id: 'node-btn-sync',
          props: { label: '重新同步', size: 'sm', variant: 'outline' },
          type: 'basic.button',
        },
        {
          // 双向绑定：读走 `{{ form.name }}`，写走 `set:form.name` —— 同一条路径在两处出现即成对
          events: { 'update:modelValue': 'set:form.name' },
          id: 'node-input-name',
          props: {
            label: '姓名',
            modelValue: '{{ form.name }}',
            placeholder: '输入姓名后下方提示会出现',
          },
          type: 'basic.field',
        },
        {
          events: { 'update:modelValue': 'set:form.dept' },
          id: 'node-input-dept',
          props: { label: '部门', modelValue: '{{ form.dept }}' },
          type: 'basic.field',
        },
        {
          events: { 'update:modelValue': 'set:form.note' },
          id: 'node-textarea-note',
          props: {
            label: '备注',
            modelValue: '{{ form.note }}',
            multiline: true,
          },
          type: 'basic.field',
        },
        {
          condition: '{{ len(form.name) > 0 }}',
          id: 'node-text-hello',
          props: { level: 'body', text: "你好，{{ form.name ?? '路人甲' }}" },
          type: 'basic.text',
        },
        {
          events: { 'update:modelValue': 'set:form.role' },
          id: 'node-select-roles',
          props: {
            modelValue: '{{ form.role }}',
            options: '{{ roles }}',
            placeholder: '选一个角色',
          },
          type: 'basic.select',
        },
        {
          id: 'node-sep-1',
          props: { orientation: 'horizontal' },
          type: 'basic.separator',
        },
        {
          id: 'node-table-members',
          props: {
            columns: [
              { key: 'name', title: '姓名' },
              { key: 'role', title: '角色' },
            ],
            emptyText:
              "{{ showEmptyHint ? '没有数据：宿主未注入 fetcher 时本行就是提示语' : '' }}",
            rows: '{{ members }}',
          },
          type: 'basic.table',
        },
        {
          // 容器套容器：卡片里的「操作区」，也是拖拽时「放进子节点」的那个层级
          children: [
            {
              events: { click: 'push:history={{ form.name }}' },
              id: 'node-btn-submit',
              props: { label: '记录一次姓名' },
              type: 'basic.button',
            },
            {
              // 交给宿主的事件：`useLowcodePage({ onEvent })` 收得到 `demo-reset`
              events: { click: 'emit:demo-reset' },
              id: 'node-btn-reset',
              props: { label: '通知宿主重置', variant: 'ghost' },
              type: 'basic.button',
            },
          ],
          id: 'node-card-actions',
          props: {
            description: 'push 与 emit 两种动作各演示一次',
            title: '操作区',
          },
          type: 'basic.card',
        },
        {
          id: 'node-text-history',
          props: { level: 'caption', text: '已记录 {{ len(history) }} 次' },
          type: 'basic.text',
        },
      ],
      id: 'node-card-main',
      props: {
        description: '改上面任何一个输入框，下面的表格与提示都会跟着变',
        title: '编辑区',
      },
      slots: {
        footer: [
          {
            id: 'node-text-footer',
            props: {
              level: 'caption',
              text: '数据来自 {{ len(members) }} 条记录',
            },
            type: 'basic.text',
          },
        ],
      },
      type: 'basic.card',
    },
  ],
  version: 1,
};
