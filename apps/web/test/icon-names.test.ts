import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * 图标名对账：源码里写死的每一个 `collection:name` 字面量，必须真的存在于
 * 已安装的 `@iconify-json/<collection>` 里。
 *
 * 为什么要有这条：`<Icon icon="carbon:xxx" />` 写错名字**不报任何错** ——
 * 离线插件在构建期查不到就渲染成空 span，运行时取图则变成一次网络请求（还常被 CORS 挡掉）。
 * 于是侧边菜单出现"有的项有图标、有的项整格空白"，标题被顶得左右不齐，
 * 面包屑与菜单的图标也对不上 —— 用户看到的是"样式坏了"，根因是数据写错。
 *
 * 一次性踩坑记录：本轮巡检前仓库里有 **45 个**不存在的图标名
 * （`carbon:cards`、`carbon:form`、`carbon:layout`、`carbon:side-panel-left-show`…），
 * 覆盖菜单种子数据、布局外壳与 8 个示例页。前后端单测都抓不到这类错：
 * 前端只断言"我把 icon 传下去了"，而图标到底存不存在只有真浏览器知道。
 */

const require = createRequire(import.meta.url);

/** 本文件在 apps/web/test/ 下，往上三层就是仓库根 */
const REPO_ROOT = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

/** 参与对账的图标集：与 package.json 里装的 `@iconify-json/*` 保持一致 */
const COLLECTIONS = ['ant-design', 'carbon', 'fa6-regular', 'lucide', 'mdi'] as const;

/**
 * 扫描范围：应用源码 + 共享包 + mock 的菜单种子数据。
 *
 * 菜单图标是后端下发的，写错的地方在 `apps/backend-mock/server`，
 * 只扫前端等于把最大的一处漏掉。
 */
const SCAN_ROOTS = [
  'apps/backend-mock/server',
  'apps/web/src',
  'packages',
];

const SCAN_EXT = new Set(['.ts', '.tsx', '.vue']);
/** dist / 缓存 / 依赖产物：都是别人生成过的，不该由本用例负责 */
const SKIP_DIRS = new Set(['.turbo', 'coverage', 'dist', 'node_modules']);

/** 只认"整串就是一个图标引用"的字面量，避免把 `carbon:` 出现在注释散文里也算进来 */
const LITERAL =
  /['"`](ant-design|carbon|fa6-regular|lucide|mdi):([a-z0-9]+(?:-[a-z0-9]+)*)['"`]/g;

function loadCollection(name: string): Set<string> {
  const json = require(`@iconify-json/${name}/icons.json`) as {
    aliases?: Record<string, { parent: string }>;
    icons?: Record<string, unknown>;
  };
  return new Set([
    ...Object.keys(json.icons ?? {}),
    ...Object.keys(json.aliases ?? {}),
  ]);
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await walk(join(dir, entry.name), out);
      continue;
    }
    const dot = entry.name.lastIndexOf('.');
    const ext = dot > 0 ? entry.name.slice(dot) : '';
    if (SCAN_EXT.has(ext) && !entry.name.endsWith('.test.ts')) out.push(join(dir, entry.name));
  }
  return out;
}

describe('源码里的 iconify 图标名必须真实存在', () => {
  /** 与下面那条同理：5 个集合的 JSON 解析在并发跑时会超出默认 5s */
  it(
    '每个集合都加载得到（少装了包会先在这里暴露，而不是渲染成空白）',
    () => {
      for (const name of COLLECTIONS) {
        expect(loadCollection(name).size, name).toBeGreaterThan(0);
      }
    },
    60_000,
  );

  /**
   * 60s 而不是默认的 5s：这条用例要遍历整个仓库的源码文件（`SCAN_ROOTS` 三棵树）
   * 并把 5 个图标集全部读进内存解析 —— 其中 mdi 单个 JSON 就有 3MB。
   * 单独跑不到 5s，但 `turbo run test:unit` 是 21 个任务并发，
   * 磁盘 I/O 排队就能把它顶过默认超时（实测红过一次）。
   * 只放宽时长，判定条件一个没动：名字对不上照样当场变红。
   */
  it(
    '没有任何一处引用了不存在的图标名',
    async () => {
      const sets = new Map(
        COLLECTIONS.map((name) => [name, loadCollection(name)]),
      );
      const unknown: string[] = [];
      let checked = 0;

      for (const root of SCAN_ROOTS) {
        const files = await walk(join(REPO_ROOT, root));
        for (const file of files) {
          const text = await readFile(file, 'utf8');
          for (const [, collection, icon] of text.matchAll(LITERAL)) {
            checked += 1;
            if (!sets.get(collection as (typeof COLLECTIONS)[number])?.has(icon)) {
              const path = relative(REPO_ROOT, file).split(sep).join('/');
              unknown.push(`${path}  ${collection}:${icon}`);
            }
          }
        }
      }

      // 扫不到任何引用本身就是配置错了（路径/后缀写错），不能算通过
      expect(checked, '一个图标引用都没扫到，多半是 SCAN_ROOTS 写错了').toBeGreaterThan(
        100,
      );
      expect(
        [...new Set(unknown)].sort(),
        `这些图标名在对应的 @iconify-json 集合里不存在，界面上会渲染成空白格：\n${[
          ...new Set(unknown),
        ].join('\n')}`,
      ).toEqual([]);
    },
    60_000,
  );
});
