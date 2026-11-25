/**
 * `nitro/task` 的测试替身
 *
 * defineTask 调用即注册（真实 Nitro 由构建期扫描完成），runTask 按名字查找并执行，
 * 保留并发去重与未知任务的 404 语义，便于任务单测脱离 Nitro 运行时。
 */

interface TaskDefinition {
  meta?: { name?: string; description?: string };
  run(event: {
    name: string;
    payload: Record<string, unknown>;
    context: Record<string, unknown>;
  }): unknown;
}

const tasks = new Map<string, TaskDefinition>();
const running = new Map<string, Promise<unknown>>();

export function defineTask(def: TaskDefinition): TaskDefinition {
  if (def.meta?.name) tasks.set(def.meta.name, def);
  return def;
}

export async function runTask(
  name: string,
  options: {
    payload?: Record<string, unknown>;
    context?: Record<string, unknown>;
  } = {},
): Promise<unknown> {
  const task = tasks.get(name);
  if (!task) throw new Error(`Task \`${name}\` is not available!`);
  if (running.has(name)) return running.get(name);

  const promise = Promise.resolve(
    task.run({
      name,
      payload: options.payload ?? {},
      context: options.context ?? {},
    }),
  );
  running.set(name, promise);
  try {
    return await promise;
  } finally {
    running.delete(name);
  }
}

/** 单测隔离 */
export function resetTaskFixture(): void {
  tasks.clear();
  running.clear();
}

export function registeredTaskNames(): string[] {
  return [...tasks.keys()];
}
