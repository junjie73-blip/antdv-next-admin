/**
 * `frappe-gantt` 包里只有 JS，没有配套 `.d.ts`（仓库里也没装 `@types/frappe-gantt`），
 * 直接 `import Gantt from 'frappe-gantt'` 会被 vue-tsc 判「找不到模块或类型声明」。
 *
 * 这里手写一份**最小**声明，只覆盖 `components/ReportGantt` 真正用到的四个入口：
 * 构造函数、`refresh`、`change_view_mode`、`clear`。
 * 刻意不照抄它全部的 option / 方法：声明越少，升级 frappe 时越不容易和它内部类型"假吻合"。
 *
 * 对着 1.2.2 的 `src/index.js` 与 `src/bar.js` 核过的两条，别按博客/0.x 文档改回来：
 * - **没有 `update()`**，整体换任务是 `refresh(tasks)`；0.x 的 `update_start_date` /
 *   `update_end_date` / `get_row()` 在本版本同样不存在；
 * - 顶层选项 `date_format` 在传内置档位名时被 `view_mode.date_format` 短路，
 *   所以档位相关的日期格式不由这里暴露（口径见 `core/gantt.ts` 文件头第 9 条）。
 *
 * 口径：任务字段用宽松结构兜住、option 整个是索引签名，真正的形状约束放在 `core/gantt.ts`
 * 的 `GanttTask` / `toGanttOptions()`（纯 TS，可单测）里，这一层只保证组件能把数据递进去、
 * 能编译通过。`update:viewMode` 之类的事件由组件自己包，不在这里声明回调签名。
 */
declare module 'frappe-gantt' {
  export interface GanttTaskLike {
    custom_class?: string;
    dependencies?: string | string[];
    end?: string;
    group?: string;
    id?: string;
    name?: string;
    progress?: number;
    start?: string;
  }

  export interface GanttOptionsLike {
    [key: string]: unknown;
  }

  export default class Gantt {
    tasks: GanttTaskLike[];
    constructor(
      wrapper: HTMLElement | string | SVGElement,
      tasks: GanttTaskLike[],
      options?: GanttOptionsLike,
    );
    /** 切档位唯一正确的入口；`maintain_pos` 为真时不跳回 `scroll_to` */
    change_view_mode(mode?: string, maintain_pos?: boolean): void;
    /** 拆掉自己建的 SVG 与容器节点；Vue 的卸载不会替我们做这件事 */
    clear(): void;
    /** 1.x 用它整体换任务并重绘（不重建实例，保住横向滚动位置） */
    refresh(tasks?: GanttTaskLike[]): void;
  }
}
