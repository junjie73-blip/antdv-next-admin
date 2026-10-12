import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 组件示例页的「API 用错但不报错」静态契约。
 *
 * 示例页是别人直接抄的模板，而这批 API 写法错误的共同症状是
 * **页面照样渲染、点了没反应**，靠人眼巡检发现不了，端到端又只能覆盖到被写进用例的那些页：
 *
 * 1. `antdv-next` 1.6 的根导出是 `_default as App`（`App.useApp` 挂在它上面），
 *    **没有具名的 `useApp`**。写成 `import { useApp }` 后异步块加载失败、导航中止，
 *    界面上就是"点菜单没反应"（首轮 `/components/feedback` 就是这么废的）。
 * 2. 权限指令的 `role` / `admin` 是**参数（arg）**，不是修饰符：
 *    `v-permission:role="'auditor'"`、`v-permission:admin` 才走对应通道，
 *    写成 `.role` / `.admin` 判根本不读（`resolveAccess` 只看 `binding.arg`）。
 * 3. Tabs 1.6 没有 `add` 事件，只有 `edit(key | MouseEvent, 'add' | 'remove')`；
 *    绑 `@add` 不报错，只是新增按钮点了没反应。
 */

const SCAN_ROOTS = ['src/views', 'src/components', 'src/layouts'];
const SRC = join(process.cwd(), 'src');

/** 三条规则的出处与判据，报错信息里要能直接看到该改什么 */
const RULES: Array<{
  find: (text: string) => string[];
  hint: string;
  name: string;
}> = [
  {
    find: (text) =>
      [
        ...text.matchAll(
          /import\s*\{[^}]*\buseApp\b[^}]*\}\s*from\s*['"]antdv-next['"]/g,
        ),
      ].map((m) => m[0]),
    hint: "改成 `import { App } from 'antdv-next'` + `App.useApp()`",
    name: '具名 useApp 不存在',
  },
  {
    find: (text) =>
      [...text.matchAll(/v-[a-z-]+[.\w-]*?\.(?:role|admin)\b[^\n]*/g)].map(
        (m) => m[0],
      ),
    hint: '`role` / `admin` 是参数：`v-permission:role="\'auditor\'"`、`v-permission:admin`',
    name: '权限指令把 arg 写成了 modifier',
  },
  {
    find: (text) =>
      [...text.matchAll(/<a-tabs\b[^>]*?@add\b[^>]*?>/gs)].map((m) => m[0]),
    hint: '1.6 只有 `@edit`：`@edit="(key, action) => ..."`',
    name: 'Tabs 绑了不存在的 @add',
  },
];

function vueFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== '__tests__') vueFiles(full, out);
      continue;
    }
    if (name.endsWith('.vue')) out.push(full);
  }
  return out;
}

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
    'Tabs 绑了不存在的 @add': `<template><a-tabs type="editable-card" @add="onAdd" /></template>`,
    '具名 useApp 不存在': `<script setup lang="ts">
import { useApp } from 'antdv-next';
</script>`,
    '权限指令把 arg 写成了 modifier': `<template>
  <a-button v-permission.role="'auditor'">按角色</a-button>
  <a-button v-permission.admin>仅超管</a-button>
</template>`,
  };

  /** 正确写法不能被抓到，否则守卫只是逼人绕开它 */
  const NEGATIVES: Record<string, string> = {
    '具名 useApp 不存在': `<script setup lang="ts">
import { App } from 'antdv-next';
const { message } = App.useApp();
</script>`,
    '权限指令把 arg 写成了 modifier': `<template>
  <a-button v-permission:role="'auditor'">按角色</a-button>
  <a-button v-permission:admin>仅超管</a-button>
  <a-button v-permission.disabled="'user:add'">置灰</a-button>
</template>`,
    'Tabs 绑了不存在的 @add': `<template><a-tabs type="editable-card" @edit="onEdit" /></template>`,
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
});
