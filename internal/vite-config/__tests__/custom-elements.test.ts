import { describe, expect, it } from 'vitest';

import {
  createIsCustomElement,
  CUSTOM_ELEMENT_PREFIXES,
  MICRO_APP_TAG,
} from '../src/plugins/custom-elements';

/**
 * 这条判定决定了控制台会不会被 `[Vue warn]: Failed to resolve component: micro-app` 刷屏。
 *
 * 全站巡检里，嵌入页只要出现 `<micro-app>` 就会打这条警告 —— 因为 Vue 在渲染函数开头
 * 就 `_resolveComponent('micro-app')`，哪怕这次走的是 `v-if` 的另一个分支。
 * 把它声明成自定义元素后，Vue 直接创建原生标签，等 SDK 来了自动 upgrade。
 */
describe('createIsCustomElement', () => {
  const isCustomElement = createIsCustomElement();

  it('认下 micro-app 与 micro- 前缀的标签', () => {
    expect(isCustomElement(MICRO_APP_TAG)).toBe(true);
    expect(isCustomElement('micro-app-container')).toBe(true);
    expect(CUSTOM_ELEMENT_PREFIXES).toContain('micro-');
  });

  it('大小写与首尾空格都不影响判定（模板里可能写成 PascalCase）', () => {
    expect(isCustomElement('Micro-App')).toBe(true);
    expect(isCustomElement('  micro-app  ')).toBe(true);
  });

  it('普通标签与组件标签仍然交给 Vue 解析，不能吞掉真实的注册错误', () => {
    for (const tag of ['div', 'span', 'RouterView', 'AButton', 'Icon', 'micro']) {
      expect(isCustomElement(tag)).toBe(false);
    }
  });

  it('空标签名安全返回 false', () => {
    expect(isCustomElement('')).toBe(false);
    expect(isCustomElement('   ')).toBe(false);
  });

  it('调用方可追加精确标签与前缀', () => {
    const extended = createIsCustomElement({
      prefixes: ['ion-'],
      tags: ['wx-open-launch-weapp'],
    });
    expect(extended('wx-open-launch-weapp')).toBe(true);
    expect(extended('ion-button')).toBe(true);
    expect(extended('my-app')).toBe(false);
  });

  it('不带连字符的前缀不会把普通元素误判成自定义元素', () => {
    // 自定义元素名必须含连字符，这是 HTML 规范的要求；少这道闸就会把 <mywidget> 也放行，
    // 于是"组件没注册"被静默渲染成空标签，问题再也查不出来。
    const loose = createIsCustomElement({ prefixes: ['my'] });
    expect(loose('mywidget')).toBe(false);
    expect(loose('my-widget')).toBe(true);
  });
});
