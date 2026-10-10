/**
 * 让 Vue 模板编译器把某些标签当作**原生自定义元素**，而不是"没注册成功的组件"。
 *
 * 不声明的代价很实在：`<micro-app>` 是 `@micro-zoe/micro-app` 这类微前端 SDK 在
 * 运行时 `customElements.define()` 注册的标签，编译期根本不存在对应组件。
 * Vue 每次渲染都会先 `_resolveComponent('micro-app')`（哪怕它挂在 `v-else-if` 分支里
 * 这次并不渲染），解析不到就打印
 * `[Vue warn]: Failed to resolve component: micro-app` —— 于是每个嵌入页都在
 * 控制台刷一条警告，把真正的问题淹掉；e2e 的"控制台不能有本站错误/警告"也被迫放水。
 *
 * 声明成自定义元素之后：Vue 直接 `createElement('micro-app')`，SDK 加载时会自动
 * upgrade 这个元素；SDK 没加载（当前仓库就没有内置子应用）也只是渲染一个空的自定义标签，
 * 由页面自己的降级分支（iframe / 提示）接管。
 *
 * 只匹配显式登记的标签与前缀，不做"带连字符就算自定义元素"的泛化：
 * 那样会把 `a-*` 之类的组件解析失败（unplugin-vue-components 漏注册）也一起吞掉，
 * 把一个真实的注册问题伪装成"渲染成功"。
 */

/** 微前端 SDK 注册的标签 */
export const MICRO_APP_TAG = 'micro-app';

/** 按前缀整体认下的自定义元素（SDK 常见还会注册 `micro-app-*`） */
export const CUSTOM_ELEMENT_PREFIXES = ['micro-'];

export interface IsCustomElementOptions {
  /** 额外精确匹配的标签名（大小写不敏感） */
  tags?: string[];
  /** 额外按前缀匹配的标签名（小写） */
  prefixes?: string[];
}

/**
 * @returns Vue `compilerOptions.isCustomElement`：给定标签名，判断是否为自定义元素。
 * 编译器传进来的是模板里原始写法，所以大小写与空值都要自己兜住。
 */
export function createIsCustomElement(
  options: IsCustomElementOptions = {},
): (tag: string) => boolean {
  const exact = new Set(
    [MICRO_APP_TAG, ...(options.tags ?? [])].map((t) => t.trim().toLowerCase()),
  );
  const prefixes = [...CUSTOM_ELEMENT_PREFIXES, ...(options.prefixes ?? [])]
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  return (tag: string): boolean => {
    if (!tag) return false;
    const name = tag.trim().toLowerCase();
    if (exact.has(name)) return true;
    // 前缀命中还不够：规范要求的自定义元素名必须含连字符，
    // 所以调用方传了不带连字符的前缀（比如 'my'）时，`<mytag>` 不能被误判成自定义元素，
    // 否则一个组件注册失败会被静默渲染成空标签，问题就查不出来了。
    return prefixes.some((p) => name.startsWith(p) && name.includes('-'));
  };
}
