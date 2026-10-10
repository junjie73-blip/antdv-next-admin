import type { PermissionBindingLike } from '../src/permission';

import { describe, expect, it } from 'vitest';

import {
  applyPermissionState,
  isBindingChanged,
  isDomInSync,
  resolveAccess,
} from '../src/permission/utils';
import { makeCheckers } from './helpers';

const granted = makeCheckers({
  permissions: ['user:add', 'user:edit'],
  roles: ['editor'],
});
const denied = makeCheckers({ permissions: ['user:add'] });
const adminOnly = makeCheckers({ admin: true, roles: ['super'] });

function binding(
  value?: PermissionBindingLike['value'],
  arg?: string,
  modifiers: Record<string, boolean> = {},
): PermissionBindingLike {
  return { arg, modifiers, value };
}

describe('resolveAccess —— 声明式取值优先级', () => {
  it('没配置要求时一律放行（指令不该把空白元素藏起来）', () => {
    expect(resolveAccess(binding(undefined), denied)).toBe(true);
    expect(resolveAccess(binding(null as never), denied)).toBe(true);
    expect(resolveAccess(binding(''), denied)).toBe(true);
    expect(resolveAccess(binding([]), denied)).toBe(true);
  });

  it('字符串走单权限码', () => {
    expect(resolveAccess(binding('user:add'), granted)).toBe(true);
    expect(resolveAccess(binding('user:remove'), granted)).toBe(false);
  });

  it('数组默认 any，`.all` 修饰符改成 all', () => {
    const list = ['user:add', 'user:remove'];
    expect(resolveAccess(binding(list), granted)).toBe(true);
    expect(
      resolveAccess(binding(list, undefined, { all: true }), granted),
    ).toBe(false);
    expect(
      resolveAccess(binding(['user:add', 'user:edit'], undefined, { all: true }), granted),
    ).toBe(true);
  });

  it('arg=role 时把值按角色解释，arg=admin 直接看 isAdmin', () => {
    expect(resolveAccess(binding('editor', 'role'), granted)).toBe(true);
    expect(resolveAccess(binding('admin', 'role'), granted)).toBe(false);
    expect(
      resolveAccess(binding(['admin', 'editor'], 'role', { all: true }), granted),
    ).toBe(false);
    expect(resolveAccess(binding(undefined, 'admin'), adminOnly)).toBe(true);
    expect(resolveAccess(binding('whatever'), adminOnly)).toBe(false);
  });

  it('对象写法：role 与 permission 同时声明要都满足', () => {
    expect(
      resolveAccess(binding({ permission: 'user:add', role: 'editor' }), granted),
    ).toBe(true);
    expect(
      resolveAccess(binding({ permission: 'user:remove', role: 'editor' }), granted),
    ).toBe(false);
    expect(
      resolveAccess(binding({ permission: 'user:add', role: 'super' }), granted),
    ).toBe(false);
  });

  it('对象里的 mode 优先于 `.all` 修饰符', () => {
    const value = { mode: 'any' as const, permission: ['user:add', 'nope'] };
    expect(resolveAccess(binding(value, undefined, { all: true }), granted)).toBe(
      true,
    );
  });

  it('修复：对象值不再被当成权限码字符串（旧实现永远判无权限）', () => {
    // 旧代码 `hasAnyPermission([value])` 拿对象去 includes，恒为 false
    expect(
      resolveAccess(binding({ permission: 'user:add' }), granted),
    ).toBe(true);
  });
});

describe('isBindingChanged —— 只在声明真的变了时重算', () => {
  it('首次一定算变化', () => {
    expect(isBindingChanged(null, binding('user:add'))).toBe(true);
  });

  it('引用变了但内容没变 → 不算变化', () => {
    expect(
      isBindingChanged(
        { value: ['a', 'b'] },
        binding(['a', 'b']),
      ),
    ).toBe(false);
    expect(
      isBindingChanged(
        { value: { permission: 'a' } },
        binding({ permission: 'a' }),
      ),
    ).toBe(false);
  });

  it('arg 变化要重算（同一份值在 role / permission 通道下含义不同）', () => {
    expect(isBindingChanged({ arg: 'role', value: 'admin' }, binding('admin'))).toBe(
      true,
    );
  });

  it('内容真的变了要重算', () => {
    expect(isBindingChanged({ value: ['a'] }, binding(['a', 'b']))).toBe(true);
    expect(isBindingChanged({ value: 'a' }, binding('b'))).toBe(true);
  });
});

describe('applyPermissionState —— 隐藏 / 禁用两种落地方式', () => {
  function state(overrides: Partial<{ disabledMode: boolean; originalDisplay: string }> = {}) {
    return {
      disabledMode: false,
      originalDisplay: '',
      ...overrides,
    };
  }

  it('默认模式：无权限藏起来并标 aria-disabled', () => {
    const el = document.createElement('div');
    applyPermissionState(el, false, state());
    expect(el.style.display).toBe('none');
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.classList.contains('permission-disabled')).toBe(true);
  });

  it('默认模式：有权限时恢复 mounted 时记录的 display', () => {
    const el = document.createElement('div');
    el.style.display = 'inline-flex';
    applyPermissionState(el, false, state({ originalDisplay: 'inline-flex' }));
    expect(el.style.display).toBe('none');
    applyPermissionState(el, true, state({ originalDisplay: 'inline-flex' }));
    expect(el.style.display).toBe('inline-flex');
    expect(el.classList.contains('permission-disabled')).toBe(false);
  });

  it('禁用模式：保留可见，只加 disabled', () => {
    const el = document.createElement('button');
    applyPermissionState(el, false, state({ disabledMode: true }));
    expect(el.style.display).toBe('');
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.classList.contains('permission-disabled')).toBe(true);

    applyPermissionState(el, true, state({ disabledMode: true }));
    expect(el.hasAttribute('disabled')).toBe(false);
    expect(el.classList.contains('permission-disabled')).toBe(false);
  });

  it('自定义 className 生效', () => {
    const el = document.createElement('div');
    applyPermissionState(el, false, state(), 'no-access');
    expect(el.classList.contains('no-access')).toBe(true);
    expect(el.classList.contains('permission-disabled')).toBe(false);
  });

  it('isDomInSync 认得出当前 DOM 是否已经符合结果', () => {
    const el = document.createElement('div');
    expect(isDomInSync(el, true, state())).toBe(true);
    expect(isDomInSync(el, false, state())).toBe(false);
    applyPermissionState(el, false, state());
    expect(isDomInSync(el, false, state())).toBe(true);
  });

  it('isDomInSync 在禁用模式下看属性而不是 display', () => {
    const el = document.createElement('button');
    expect(isDomInSync(el, false, state({ disabledMode: true }))).toBe(false);
    applyPermissionState(el, false, state({ disabledMode: true }));
    expect(isDomInSync(el, false, state({ disabledMode: true }))).toBe(true);
  });
});
