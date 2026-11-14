import { createDefinition, WORKFLOW_STORE } from '../../../utils/db/enterprise';
import { bizError, success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/** 新建 / 编辑流程定义：同名校验、白名单字段，返回更新后的记录 */
export default defineMockRoute({
  handler({ data }) {
    const id = String(data.id ?? '');
    const name = String(data.name ?? '').trim();
    if (!name) return bizError(400, '请输入流程名称');

    const duplicate = WORKFLOW_STORE.items.some(
      (item) => item.name === name && item.id !== id,
    );
    if (duplicate) return bizError(400, '流程名称已存在');

    if (id) {
      const index = WORKFLOW_STORE.items.findIndex((item) => item.id === id);
      if (index === -1) return bizError(404, '流程不存在或已被删除');
      const current = WORKFLOW_STORE.items[index]!;
      WORKFLOW_STORE.items[index] = {
        ...current,
        category: String(data.category ?? current.category),
        description: String(data.description ?? current.description),
        name,
        owner: String(data.owner ?? current.owner),
      };
      return success(WORKFLOW_STORE.items[index], '流程已保存');
    }

    const created = createDefinition(
      { ...data, name },
      `WF-${Date.now().toString().slice(-6)}`,
    );
    WORKFLOW_STORE.items.unshift(created);
    return success(created, '流程已创建');
  },
  method: 'POST',
  path: '/enterprise/workflow/save',
});
