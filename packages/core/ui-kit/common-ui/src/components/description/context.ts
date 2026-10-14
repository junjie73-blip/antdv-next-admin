import type { InjectionKey } from 'vue';

/**
 * 把「字典编码 + 值」解析成展示文本的函数签名。
 */
export type DictResolver = (dictType: string, value: unknown) => string;

/**
 * `type: 'dict'` 分支的解析器注入键。
 *
 * 迁移前该分支直接读取 pinia 字典 store；公共组件包不允许引入应用耦合
 * （pinia / `~/...`），因此改为注入式：宿主应用 `provide(DESCRIPTION_DICT_RESOLVER, fn)`
 * 即可复用真实字典。未注入时回退为「命中不了就显示原值、空值显示 `-`」，
 * 与迁移前字典尚未加载时 store 的表现完全一致。
 */
export const DESCRIPTION_DICT_RESOLVER: InjectionKey<DictResolver> =
  Symbol('description-dict-resolver');
