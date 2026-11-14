import type {
  WorkflowInstance,
  WorkflowStoreAdapter,
  WorkflowTask,
} from './types';

import { cloneDeep } from './clone';

/**
 * 内存版存储适配器：给单测、Storybook、离线演示用。
 *
 * 读写都做深拷贝，因为引擎手里拿的是同一批对象引用 ——
 * 不做快照的话，测试里改一下 `instance.status` 就能"证明"引擎工作正常，
 * 而真实接口的存储是不会被这样影响的。
 *
 * 拷贝走 `cloneDeep` 而不是 `structuredClone`：宿主把 `reactive()` 过的实例传回
 * 存储是常态（待办中心里点一下就是响应式对象），`structuredClone` 对代理会抛
 * `DataCloneError`。理由与边界见 `core/clone.ts`。
 */
export interface MemoryWorkflowStore extends WorkflowStoreAdapter {
  /** 测试断言用：整体快照，不含内部引用 */
  dump: () => { instances: WorkflowInstance[]; tasks: WorkflowTask[] };
  findTasks: (predicate: (task: WorkflowTask) => boolean) => WorkflowTask[];
  reset: () => void;
}

export function createMemoryWorkflowStore(): MemoryWorkflowStore {
  const instances = new Map<string, WorkflowInstance>();
  const tasks = new Map<string, WorkflowTask>();

  return {
    dump: () => ({
      instances: cloneList([...instances.values()]),
      tasks: cloneList([...tasks.values()]),
    }),
    findTasks: (predicate) => cloneList([...tasks.values()].filter(predicate)),
    getTaskById: (id) => cloneOne(tasks.get(id)),
    getInstance: (id) => cloneOne(instances.get(id)),
    reset: () => {
      instances.clear();
      tasks.clear();
    },
    runningInstances: () =>
      cloneList(
        [...instances.values()].filter((item) => item.status === 'running'),
      ),
    saveInstance: (instance) => {
      instances.set(instance.id, cloneOne(instance) as WorkflowInstance);
    },
    saveTasks: (next) => {
      for (const task of next)
        tasks.set(task.id, cloneOne(task) as WorkflowTask);
    },
    tasksOf: (instanceId) =>
      cloneList(
        [...tasks.values()].filter((task) => task.instanceId === instanceId),
      ),
  };
}

function cloneOne<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : cloneDeep(value);
}

function cloneList<T>(value: T[]): T[] {
  return cloneDeep(value);
}
