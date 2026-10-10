import type { ObjectDirective } from 'vue';

import type { PermissionDirectiveValue } from '../src/permission';

import { describe, expect, it, vi } from 'vitest';

import { createPermissionDirective } from '../src/permission';
import {
  clearBody,
  createElement,
  fakeBinding,
  makeCheckers,
} from './helpers';

type Directive = ObjectDirective<HTMLElement, PermissionDirectiveValue>;

function mount(
  directive: Directive,
  el: HTMLElement,
  value?: PermissionDirectiveValue,
  extra: { arg?: string; modifiers?: Record<string, boolean> } = {},
) {
  directive.mounted?.(
    el,
    fakeBinding(value, extra) as never,
    null as never,
    null as never,
  );
}

function update(
  directive: Directive,
  el: HTMLElement,
  value?: PermissionDirectiveValue,
  extra: { arg?: string; modifiers?: Record<string, boolean> } = {},
) {
  directive.updated?.(
    el,
    fakeBinding(value, extra) as never,
    null as never,
    null as never,
  );
}

function unmount(directive: Directive, el: HTMLElement) {
  directive.unmounted?.(el, null as never, null as never, null as never);
}

describe('v-permission 指令装配', () => {
  it('无权限时隐藏并标记，有权限时保持可见', () => {
    const directive = createPermissionDirective({
      checkers: makeCheckers({ permissions: ['user:add'] }),
    });

    const ok = createElement();
    mount(directive, ok, 'user:add');
    expect(ok.style.display).toBe('');

    const no = createElement();
    mount(directive, no, 'user:remove');
    expect(no.style.display).toBe('none');
    expect(no.getAttribute('aria-disabled')).toBe('true');

    clearBody();
  });

  it('`.disabled` 修饰符改成置灰而不是消失', () => {
    const directive = createPermissionDirective({ checkers: makeCheckers() });

    const el = createElement('button');
    mount(directive, el, 'user:remove', { modifiers: { disabled: true } });
    expect(el.style.display).toBe('');
    expect(el.hasAttribute('disabled')).toBe(true);

    clearBody();
  });

  it('checkers 传工厂时每次判定现取，不会在注册时就绑死 store', () => {
    const spy = vi.fn(() => makeCheckers({ permissions: ['a'] }));
    const directive = createPermissionDirective({ checkers: spy });

    const el = createElement();
    mount(directive, el, 'a');
    expect(spy).toHaveBeenCalled();
    expect(el.style.display).toBe('');

    clearBody();
  });

  it('登录态回填后订阅通知能把元素从隐藏翻回可见', () => {
    const listeners: Array<() => void> = [];
    const seed = { permissions: [] as string[] };

    const directive = createPermissionDirective({
      checkers: () => makeCheckers(seed),
      subscribe: (notify) => {
        listeners.push(notify);
        return () => undefined;
      },
    });

    const el = createElement();
    mount(directive, el, 'user:add');
    expect(el.style.display).toBe('none');

    seed.permissions = ['user:add'];
    for (const notify of listeners) notify();
    expect(el.style.display).toBe('');

    clearBody();
  });

  it('unmounted 取消订阅并丢弃状态，避免泄漏', () => {
    const stop = vi.fn(() => undefined);
    const directive = createPermissionDirective({
      checkers: makeCheckers({ permissions: ['a'] }),
      subscribe: () => stop,
    });

    const el = createElement();
    mount(directive, el, 'a');
    unmount(directive, el);
    expect(stop).toHaveBeenCalledTimes(1);

    // 状态已清，后续 updated 不该再动这个元素
    el.style.display = 'block';
    update(directive, el, 'nope');
    expect(el.style.display).toBe('block');

    clearBody();
  });

  it('订阅回调按最新 binding 判定，而不是 mounted 时那份', () => {
    const listeners: Array<() => void> = [];
    const seed = { permissions: [] as string[] };

    const directive = createPermissionDirective({
      checkers: () => makeCheckers(seed),
      subscribe: (notify) => {
        listeners.push(notify);
        return () => undefined;
      },
    });

    const el = createElement();
    mount(directive, el, 'a');
    update(directive, el, 'b');
    seed.permissions = ['b'];
    for (const notify of listeners) notify();

    // 若仍按 mounted 时的 'a' 判定，这里会被重新藏起来
    expect(el.style.display).toBe('');
    expect(el.classList.contains('permission-disabled')).toBe(false);

    clearBody();
  });

  it('组件重渲染冲掉内联样式后，updated 会重新补上隐藏态', () => {
    const directive = createPermissionDirective({
      checkers: makeCheckers({ permissions: ['a'] }),
    });

    const el = createElement();
    mount(directive, el, 'nope');
    expect(el.style.display).toBe('none');

    // 模拟 Vue 重新 patch style 把 display 写回
    el.style.display = 'flex';
    update(directive, el, 'nope');
    expect(el.style.display).toBe('none');

    clearBody();
  });

  it('声明没变且 DOM 已符合结果时不重复上报判定', () => {
    const onCheck = vi.fn();
    const directive = createPermissionDirective({
      checkers: makeCheckers({ permissions: ['a'] }),
      onCheck,
    });

    const el = createElement();
    mount(directive, el, 'a');
    update(directive, el, 'a');
    update(directive, el, 'a');
    expect(onCheck).toHaveBeenCalledTimes(1);

    update(directive, el, ['a', 'b']);
    expect(onCheck).toHaveBeenCalledTimes(2);

    clearBody();
  });

  it('自定义 className 透传到 DOM', () => {
    const directive = createPermissionDirective({
      checkers: makeCheckers(),
      className: 'no-access',
    });

    const el = createElement();
    mount(directive, el, 'user:add');
    expect(el.classList.contains('no-access')).toBe(true);

    clearBody();
  });
});
