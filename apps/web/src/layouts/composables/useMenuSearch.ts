import type { MenuConfig } from '@antdv/types';

/**
 * 菜单搜索的纯逻辑，单独成模块是为了能被单元测试直接调用 ——
 * 组件里混着 DOM 与路由跳转，可测的部分只有"给定菜单树和关键词，该出现哪些候选"。
 */

export interface SearchEntry {
  /** 完整路径，直达用 */
  path: string;
  /** 末级标题 */
  title: string;
  /** 「系统管理 / 用户管理」这样的层级路径，候选项里显示它才知道自己在哪 */
  breadcrumb: string;
  icon?: string;
  /** 导航上被精简掉（hidden）的页面照样能搜到，但要告诉用户它不在菜单里 */
  hidden: boolean;
  external: boolean;
}

/** 把菜单树拍平成"可跳转的叶子 + 父级路径" */
export function flattenMenus(menus: MenuConfig[]): SearchEntry[] {
  const out: SearchEntry[] = [];
  const walk = (nodes: MenuConfig[], trail: string[]) => {
    for (const node of nodes) {
      const title = node.title ?? node.name ?? '';
      const nextTrail = title ? [...trail, title] : trail;
      const children = node.children ?? [];
      if (children.length > 0) {
        walk(children, nextTrail);
        continue;
      }
      // 没有 path 的节点（纯分组 / 外链占位）不参与搜索
      if (!node.path) continue;
      out.push({
        breadcrumb: nextTrail.slice(0, -1).join(' / '),
        external: node.isExternal === true,
        hidden: node.hidden === true,
        icon: node.icon,
        path: node.path,
        title,
      });
    }
  };
  walk(menus, []);
  return out;
}

/**
 * 关键词匹配。
 *
 * 中英混排的后台里，用户既可能输入「用户」也可能输入 `user`，所以标题和路径都要参与；
 * 分词按空格切，多段之间是 **与** 的关系（`sys 用户` 只留下同时命中的），
 * 这比"整串做子串"更符合搜索直觉，也比模糊打分更好解释。
 */
export function matchEntries(
  entries: SearchEntry[],
  keyword: string,
  limit = 20,
): SearchEntry[] {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) {
    // 空关键词给一个"常用入口"式的默认排序：导航可见的排前面，隐藏页垫后
    return [...entries]
      .sort((a, b) => Number(a.hidden) - Number(b.hidden))
      .slice(0, limit);
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const scored = entries
    .map((entry) => {
      const haystack = [entry.title, entry.path, entry.breadcrumb]
        .join(' ')
        .toLowerCase();
      const matched = tokens.every((token) => haystack.includes(token));
      if (!matched) return undefined;
      // 标题前缀命中权重最高，其次标题包含，再往后是路径 / 层级
      const title = entry.title.toLowerCase();
      const first = tokens[0] ?? '';
      const score = title.startsWith(first) ? 3 : (title.includes(first) ? 2 : 1);
      return { entry, score };
    })
    .filter((hit): hit is { entry: SearchEntry; score: number } => !!hit);

  return scored
    .sort((a, b) => b.score - a.score || Number(a.entry.hidden) - Number(b.entry.hidden))
    .slice(0, limit)
    .map((hit) => hit.entry);
}
