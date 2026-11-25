/**
 * 响应模板层测试（生成式渲染能力已下线）。
 *
 * 守护的是「确定性」：模板是纯 JSON 配置，预检只做校验与安全序列化，
 * 同一输入必然得到同一样本，不会残留任何模板规则符号或随机值。
 */

import { describe, expect, it } from 'vitest';

import {
  parseTemplate,
  PRESET_TEMPLATES,
  renderPreview,
} from '../server/utils/templates';

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

describe('pRESET_TEMPLATES', () => {
  it('四个内置模板结构完整，且不含任何生成规则符号', () => {
    expect(PRESET_TEMPLATES).toHaveLength(4);
    for (const preset of PRESET_TEMPLATES) {
      expect(preset.name).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.template).toBeTruthy();
      const dirty = collectKeys(preset.template).filter(
        (key) => key.includes('|') || key.endsWith('+'),
      );
      expect(dirty, `${preset.name} 不应含模板规则符号`).toEqual([]);
    }
  });

  it('预置模板的 key 都在 demo 命名空间，不会撞真实接口', () => {
    for (const preset of PRESET_TEMPLATES) {
      expect(preset.key.startsWith('[GET]/demo/'), preset.key).toBe(true);
    }
  });

  it('模板取值确定，多次读取完全一致', () => {
    for (const preset of PRESET_TEMPLATES) {
      expect(JSON.parse(JSON.stringify(preset.template))).toEqual(
        preset.template,
      );
      expect(collectKeys(preset.template)).toEqual(
        collectKeys(preset.template),
      );
    }
  });
});

describe('parseTemplate / renderPreview', () => {
  it('对象直接透传，字符串走 JSON 解析，数组包成 items', () => {
    expect(parseTemplate({ a: 1 }).template).toEqual({ a: 1 });
    expect(parseTemplate('{"a":1}').template).toEqual({ a: 1 });
    expect(parseTemplate([1, 2]).template).toEqual({ items: [1, 2] });
    expect(parseTemplate('[1,2]').template).toEqual({ items: [1, 2] });
  });

  it('空值、非对象 JSON 与非法 JSON 各自给出可读错误', () => {
    expect(parseTemplate('').error).toBe('响应模板不能为空');
    expect(parseTemplate('123').error).toBe('响应模板需为 JSON 对象或数组');
    expect(parseTemplate('{bad').error).toBe(
      '响应模板不是合法 JSON，请检查引号与逗号',
    );
  });

  it('renderPreview 原样回显样本且确定性，失败时只返回错误文案', () => {
    const input = { list: [{ id: 1 }, { id: 2 }] };
    expect(renderPreview(input)).toEqual({ sample: input });
    expect(renderPreview(input)).toEqual(renderPreview(input));
    expect(renderPreview('{')).toEqual({
      error: '响应模板不是合法 JSON，请检查引号与逗号',
    });
  });
});
