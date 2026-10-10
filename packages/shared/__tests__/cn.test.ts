import { describe, expect, it } from 'vitest';

import { cn } from '../src/cn';

describe('cn', () => {
  it('拼接条件类名', () => {
    const active = true;
    const disabled = false;
    expect(
      cn('a', active && 'on', disabled && 'off', undefined, null, '', { c: true }, {
        d: false,
      }),
    ).toBe('a on c');
  });

  it('冲突的 Tailwind 类只保留最后一个，且保持首次出现的位置', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    // text-sm 与 text-base 同属 font-size 组：后者胜出，位置按第一次出现排
    expect(cn('text-sm text-red-500', 'text-base')).toBe('text-red-500 text-base');
    expect(cn('text-base', 'text-sm')).toBe('text-sm');
  });

  it('不同工具的类互不覆盖', () => {
    expect(cn('p-2 m-2')).toBe('p-2 m-2');
  });

  it('支持数组与嵌套数组', () => {
    expect(cn(['a', ['b', ['c']]])).toBe('a b c');
  });

  it('非 Tailwind 的自定义类原样透传（不去重，交由业务保证）', () => {
    expect(cn('menu-item', 'p-2')).toBe('menu-item p-2');
    expect(cn('menu-item', 'menu-item', 'p-2')).toBe('menu-item menu-item p-2');
  });

  it('空输入返回空串', () => {
    expect(cn()).toBe('');
  });
});
