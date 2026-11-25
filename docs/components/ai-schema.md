# AI 工具 Schema 与渲染基建

> 动态表格 / 动态表单不再作为独立演示页存在于主导航。它们的能力下沉为 Copilot 工具的 **Schema 契约**与**声明式渲染基建**，由 `@antdv/ai-tools` + `form-ui` / `table-ui` 承载。

## 为什么要下沉

旧模式：用户先进「组件示例 → 动态表格」，手动配列、配筛选，再回到业务页复刻一遍。新模式：用户在任意业务页对 Copilot 说「只看失败实例」，工具生成筛选条件并应用到当前表格；说「新建一个审批模板」，工具生成 JSON Schema 并打开表单，人工只做最终确认。

页面里的表格与表单仍是同一套 `BasicTable` / `BasicForm`，AI 只负责**代填参数**，不绕过鉴权、不直接写状态。

## 工具与 Schema 的映射

| 工具 | 输出 | 渲染基建 |
| --- | --- | --- |
| `search_table` | `FilterSpec[] / SortSpec[]` | `BasicTable` 的查询表单与 `applyQuery` |
| `generate_form` | `JsonSchemaObject` | `BasicForm` 的 `FormSchema[]` |
| `fill_form_fields` | `Record<string, unknown>` + 置信度 | `BasicForm.setFieldsValue()` |
| `navigate_to` | `NavigateIntent`（受控路由名） | vue-router 的具名路由 |

`JsonSchemaObject` 是 `FormSchema` 的严格子集，`component` 只允许 form-ui 白名单： `Input / InputNumber / Select / Switch / InputTextArea`。

## 页面如何声明上下文

在页面 SFC 末尾用 `<route>` 块声明，Copilot 会读取它来生成上下文 Chip 与快捷 Prompt：

```json
{
  "meta": {
    "aiContext": {
      "entity": "approval",
      "title": "我的审批",
      "fields": [
        {
          "key": "status",
          "label": "审批状态",
          "options": [{ "label": "待审批", "value": "pending" }]
        }
      ],
      "tools": ["search_table", "navigate_to", "confirm_action"],
      "prompts": ["有哪些待我审批的单据", "列出金额最高的 3 张单据"]
    }
  }
}
```

没有声明 `fields` 的页面，工具**不会猜测字段名**——这是避免 AI 生成无效查询的关键约束。

## 选中行注入

页面通过 `registerPageTable(routeName, handle)` 把表格句柄交给 Copilot：

```ts
registerPageTable('ApprovalMine', {
  id: 'approval-list',
  rows: () => methods.getSelectRows(),
  applyQuery: (query) => {
    methods.setFormValues(toFormValues(query));
    void methods.reload();
  },
});
```

用户说「处理这些单据」时，`resolveSelection()` 会先做指代消解为选中行 id，再弹出 HITL 确认卡片；确认只记录用户决策，实际写操作仍由业务页面执行。

## 安全边界

- 工具层 `@antdv/ai-tools` 不依赖 Pinia / vue-router / UI 包，能力由 `ToolRuntime` 注入。
- 路由跳转只能命中 `aiContext.links` 中声明过的具名路由，禁止自由拼 path。
- Smart Fill 低置信度字段留空；提交仍由人工点击。
- 完整契约见 [AI Native 架构方案](../guide/in-depth/ai-native-architecture.md)。
