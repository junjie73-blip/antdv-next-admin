import { describe, expect, it } from 'vitest';

import {
  mockFromTemplate,
  parseTemplate,
  PRESET_TEMPLATES,
  renderPreview,
} from '../server/utils/templates';

/**
 * Mock 数据中心面板的模板层测试。
 *
 * 重点守住 mockjs 的自增规则写法：只有 `'id|+1'` 会自增，
 * 写成 `'id|+'` 不报错、只是悄悄渲染成键名 `id+` 的常量 1（legacy 预置模板就踩过这个坑），
 * 所以除了单点断言，还对每个预置模板做「渲染结果里不允许残留规则符号」的全量扫描。
 */

/** 递归收集对象/数组里所有键名 */
function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      acc.push(key);
      collectKeys(child, acc);
    }
  }
  return acc;
}

describe('mockFromTemplate', () => {
  it('数组重复规则里的 `id|+1` 会逐条自增', () => {
    const data = mockFromTemplate({ 'list|3': [{ 'id|+1': 1 }] }) as {
      list: { id: number }[];
    };
    expect(data.list.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('写错的 `id|+` 不报错但会退化成常量键 `id+`（正是要防住的回归）', () => {
    const data = mockFromTemplate({ 'list|3': [{ 'id|+': 1 }] }) as {
      list: Record<string, unknown>[];
    };
    expect(data.list[0]).toEqual({ 'id+': 1 });
  });
});

describe('PRESET_TEMPLATES', () => {
  it('每个预置模板都能渲染，且结果里不残留 mockjs 规则符号', () => {
    for (const preset of PRESET_TEMPLATES) {
      const rendered = mockFromTemplate(preset.template);
      expect(rendered, preset.name).toBeTruthy();
      const dirty = collectKeys(rendered).filter(
        (key) => key.includes('|') || key.endsWith('+'),
      );
      expect(dirty, `${preset.name} 的模板写法有误`).toEqual([]);
    }
  });

  it('预置模板的 key 都是 demo 命名空间，不会撞真实接口', () => {
    for (const preset of PRESET_TEMPLATES) {
      expect(preset.key.startsWith('[GET]/demo/'), preset.key).toBe(true);
    }
  });
});

describe('parseTemplate / renderPreview', () => {
  it('对象与数组直接透传，字符串走 JSON 解析', () => {
    expect(parseTemplate({ a: 1 }).template).toEqual({ a: 1 });
    expect(parseTemplate('[1,2]').template).toEqual([1, 2]);
  });

  it('空值、非对象 JSON 与非法 JSON 各自给出可读错误', () => {
    expect(parseTemplate('').error).toBe('响应模板不能为空');
    expect(parseTemplate('123').error).toBe('响应模板需为 JSON 对象或数组');
    expect(parseTemplate('{bad').error).toBe(
      '响应模板不是合法 JSON，请检查引号与逗号',
    );
  });

  it('renderPreview 成功样本可安全 JSON 化，失败时只返回错误文案', () => {
    const ok = renderPreview({ 'list|2': [{ 'id|+1': 1 }] });
    expect(ok).toEqual({ sample: { list: [{ id: 1 }, { id: 2 }] } });
    expect(renderPreview('{')).toEqual({
      error: '响应模板不是合法 JSON，请检查引号与逗号',
    });
  });
});
