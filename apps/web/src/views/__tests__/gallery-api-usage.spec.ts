import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 组件示例页的「API 用错但不报错」静态契约。
 *
 * 示例页是别人直接抄的模板，而这批 API 写法错误的共同症状是
 * **页面照样渲染、点了没反应**，靠人眼巡检发现不了，端到端又只能覆盖到被写进用例的那些页：
 *
 * 1. 权限指令的 `role` / `admin` 是**参数（arg）**，不是修饰符：
 *    `v-permission:role="'auditor'"`、`v-permission:admin` 才走对应通道，
 *    写成 `.role` / `.admin` 判根本不读（`resolveAccess` 只看 `binding.arg`）。
 * 2. 页面里不许出现第三方组件库的依赖。原先那两条针对 `antdv-next` 的
 *    检查（`import { useApp }` 这个不存在的具名导出、`<a-tabs @add>` 这个不存在的事件）
 *    随着 antd 一起删掉了 —— 库都不在，规则没有作用对象；取而代之的是
 *    下面那条「依赖清零」的硬断言，它拦的是更靠前的那一步。
 */

const SCAN_ROOTS = ['src/views', 'src/components', 'src/layouts'];

/** 权限指令把 arg 写成 modifier —— 判据不报错，只是永远判不过 */
const RULES: Array<{
  find: (text: string) => string[];
  hint: string;
  name: string;
}> = [
  {
    find: (text) =>
      [...text.matchAll(/v-[a-z-]+[.\w-]*?\.(?:role|admin)\b[^\n]*/g)].map(
        (m) => m[0],
      ),
    hint: '`role` / `admin` 是参数：`v-permission:role="\'auditor\'"`、`v-permission:admin`',
    name: '权限指令把 arg 写成了 modifier',
  },
];

function sourceFiles(
  dir: string,
  extensions: string[],
  out: string[] = [],
): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // 守卫自己的坏样例就写在 __tests__ 里，不能把它当成违规
      if (name !== '__tests__') sourceFiles(full, extensions, out);
      continue;
    }
    if (extensions.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out;
}

const vueFiles = (dir: string) => sourceFiles(dir, ['.vue']);

const FILES = SCAN_ROOTS.flatMap((root) => vueFiles(join(process.cwd(), root)));

describe('示例与布局模板里不能出现静默失效的 API 写法', () => {
  it('扫描范围不能是空的（目录改名会先在这里暴露）', () => {
    expect(FILES.length).toBeGreaterThan(30);
  });

  /**
   * 反向对照：每条规则都要真的抓得住自己的坏样例。
   *
   * 只跑"现存代码里没命中"是不够的 —— 正则写错（比如漏了 `\b`、`s` 标志忘了）
   * 结果同样是 0 命中，守卫会静默变成一条永远绿的空检查。
   * 图标名对账那条用 `checked > 100` 兜的就是同一个坑，这里按规则各补一发。
   */
  const CONTROLS: Record<string, string> = {
    '权限指令把 arg 写成了 modifier': `<template>
  <Button v-permission.role="'auditor'">按角色</Button>
  <Button v-permission.admin>仅超管</Button>
</template>`,
  };

  /** 正确写法不能被抓到，否则守卫只是逼人绕开它 */
  const NEGATIVES: Record<string, string> = {
    '权限指令把 arg 写成了 modifier': `<template>
  <Button v-permission:role="'auditor'">按角色</Button>
  <Button v-permission:admin>仅超管</Button>
  <Button v-permission.disabled="'user:add'">置灰</Button>
</template>`,
  };

  for (const rule of RULES) {
    it(rule.name, () => {
      const hits: string[] = [];
      for (const file of FILES) {
        // 统一成 LF：Windows checkout 出来是 CRLF，带 `.` 的正则会被 `\r` 影响行的语义
        const text = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
        for (const matched of rule.find(text)) {
          hits.push(
            `${relative(process.cwd(), file).replaceAll('\\', '/')}  ${matched.trim()}`,
          );
        }
      }
      expect(
        hits,
        `这些写法不报错但功能已废（${rule.hint}）：\n${hits.join('\n')}`,
      ).toEqual([]);
    });

    it(`${rule.name} —— 样例抓得到、正确写法不误伤`, () => {
      expect(rule.find(CONTROLS[rule.name] ?? ''), rule.name).not.toEqual([]);
      expect(rule.find(NEGATIVES[rule.name] ?? ''), rule.name).toEqual([]);
    });
  }

  /**
   * 示例页是别人直接抄的模板，所以只允许出现仓库自己封装的那套组件
   * （`@antdv/common-ui` / `@antdv/shadcn-ui` / `@antdv/popup-ui` / `@antdv/table-ui` …）。
   * 直接引第三方原语的话，组件库就成了隐式依赖：换库时这些页面全部要重写，
   * 而且示例展示的不再是本仓库的设计语言。
   *
   * 判据与 `packages/core/hooks/__tests__/boundary.test.ts` 一致：只拦「导入形态」和
   * `<a-xxx>` 标签形态，注释与 mock 数据里残留的历史名字不算违规。
   */
  const VENDOR_IMPORT =
    /(?:from|import)\s*\(?\s*['"](?:antdv-next|@antdv-next\/[^'"]*|@form-create\/[^'"]*)['"]/gu;
  const VENDOR_TAG = /<a-[a-z]+(?:-[a-z]+)*\b/gu;

  /** 整个 `src`（不只是示例目录）—— 依赖一旦回来，先回来的往往不是页面 */
  const APP_FILES = sourceFiles(join(process.cwd(), 'src'), [
    '.ts',
    '.tsx',
    '.vue',
  ]);

  function hitsOf(pattern: RegExp): string[] {
    pattern.lastIndex = 0;
    return APP_FILES.flatMap((file) => {
      const text = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
      const matched = [...text.matchAll(pattern)];
      return matched.map(
        (m) =>
          `${relative(process.cwd(), file).replaceAll('\\', '/')}  ${(m[0] ?? '').trim()}`,
      );
    });
  }

  it('应用源码不得再引入第三方组件库', () => {
    expect(APP_FILES.length, '扫描范围为空说明目录约定变了').toBeGreaterThan(
      100,
    );
    const hits = [...hitsOf(VENDOR_IMPORT), ...hitsOf(VENDOR_TAG)];
    expect(
      hits,
      '改用 @antdv/* 封装组件（common-ui / shadcn-ui / popup-ui / form-ui / table-ui）：\n',
    ).toEqual([]);
  });

  it('清零守卫自己抓得到样例、不误伤本仓库的包名', () => {
    const bad = `import { Button } from 'antdv-next';
import '@antdv-next/icons/styles';
import FcDesigner from '@form-create/antd-designer';
const m = await import('antdv-next');
<template><a-tag color="blue">x</a-tag></template>`;
    expect([...bad.matchAll(VENDOR_IMPORT)].length).toBe(4);
    expect([...bad.matchAll(VENDOR_TAG)].length).toBe(1);

    const good = `import { Button, Tag } from '@antdv/common-ui';
import { cn } from '@antdv/shared/utils/cn';
import { message } from '@antdv/popup-ui';
<template><Tag color="blue">x</Tag><a href="https://antdv-next.com">外链</a></template>`;
    expect([...good.matchAll(VENDOR_IMPORT)]).toEqual([]);
    expect([...good.matchAll(VENDOR_TAG)]).toEqual([]);
  });
});
