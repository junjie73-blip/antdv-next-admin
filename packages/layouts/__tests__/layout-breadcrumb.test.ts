import type { BreadcrumbItem } from '../src/breadcrumb';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import LayoutBreadcrumb from '../src/widgets/breadcrumb.vue';

const items: BreadcrumbItem[] = [
  {
    icon: 'carbon:cloud-service-management',
    path: '/system',
    title: '系统管理',
  },
  { icon: 'carbon:user-role', path: '/system/user', title: '用户管理' },
];

function mountBreadcrumb(props: Record<string, unknown> = {}) {
  return mount(LayoutBreadcrumb, { props: { items, ...props } });
}

describe('LayoutBreadcrumb - 可见性', () => {
  it('有层级就渲染，并给出稳定的区域钩子', () => {
    const wrapper = mountBreadcrumb();
    expect(wrapper.find('[data-layout-region="breadcrumb"]').exists()).toBe(
      true,
    );
    expect(wrapper.findAll('[data-breadcrumb-item]')).toHaveLength(2);
  });

  it('偏好关掉或没有数据时整条不出现，也不留下空钩子', () => {
    expect(
      mountBreadcrumb({ enabled: false })
        .find('[data-layout-region="breadcrumb"]')
        .exists(),
    ).toBe(false);
    expect(
      mountBreadcrumb({ items: [] })
        .find('[data-layout-region="breadcrumb"]')
        .exists(),
    ).toBe(false);
  });

  it('单级隐藏开关只在只有一级时起作用', () => {
    const only = mountBreadcrumb({
      hideWhenOnlyOne: true,
      items: [items[1]!],
    });
    expect(only.find('[data-breadcrumb-item]').exists()).toBe(false);
    expect(
      mountBreadcrumb({ hideWhenOnlyOne: true }).findAll(
        '[data-breadcrumb-item]',
      ),
    ).toHaveLength(2);
  });
});

describe('LayoutBreadcrumb - 链接', () => {
  it('href 由使用方的 resolveHref 生成，包内不碰 vue-router', () => {
    const wrapper = mountBreadcrumb({
      resolveHref: (path: string) => `#/before${path}`,
    });
    const links = wrapper.findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes('href')).toBe('#/before/system');
  });

  it('最后一级是当前页：输出 span 而不是"点自己"的链接', () => {
    const wrapper = mountBreadcrumb({
      resolveHref: (path: string) => `#${path}`,
    });
    const nodes = wrapper.findAll('[data-breadcrumb-label]');
    expect(nodes[0]?.element.parentElement?.tagName).toBe('A');
    expect(nodes[1]?.element.parentElement?.tagName).toBe('SPAN');
    expect(nodes[1]?.element.parentElement?.getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('没有 resolveHref 时站内路径退化为纯文本，外链仍能中键新标签打开', () => {
    const wrapper = mountBreadcrumb({
      items: [
        { path: 'https://antdv-next.com', title: '组件文档' },
        { path: '/system', title: '系统管理' },
      ],
      resolveHref: undefined,
    });
    const links = wrapper.findAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.attributes('href')).toBe('https://antdv-next.com');
    expect(links[0]?.attributes('target')).toBe('_blank');
    expect(links[0]?.attributes('rel')).toBe('noopener noreferrer');
  });

  it('resolveHref 给出外链时同样带 noopener', () => {
    const wrapper = mountBreadcrumb({
      resolveHref: () => 'https://example.com',
    });
    expect(wrapper.find('a').attributes('rel')).toBe('noopener noreferrer');
  });
});

describe('LayoutBreadcrumb - 图标与分隔符', () => {
  it('每一级只画自己声明的图标，渲染侧不补房子或文件夹', () => {
    const wrapper = mountBreadcrumb({
      items: [
        { icon: 'carbon:apps', path: '/a', title: 'A' },
        { path: '/a/b', title: 'B' },
      ],
    });
    const icons = wrapper.findAll('[data-breadcrumb-icon]');
    expect(icons).toHaveLength(1);
  });

  it('showIcon 关掉时一格图标都不出', () => {
    expect(
      mountBreadcrumb({ showIcon: false })
        .find('[data-breadcrumb-icon]')
        .exists(),
    ).toBe(false);
  });

  it('最后一格后面不再追分隔符', () => {
    const wrapper = mountBreadcrumb();
    expect(wrapper.findAll('[data-breadcrumb-item]')).toHaveLength(2);
    expect(wrapper.text()).toContain('系统管理');
    expect(wrapper.text()).toContain('用户管理');
  });

  it('独立成行的那一档带上顶栏底色，与标签栏连成同一块外壳', () => {
    const wrapper = mountBreadcrumb({ variant: 'content' });
    expect(
      wrapper.find('[data-layout-region="breadcrumb"]').classes(),
    ).toContain('h-9');
    expect(
      wrapper.find('[data-layout-region="breadcrumb"]').classes(),
    ).toContain('bg-white');
  });

  it('住在顶栏的那一档窄屏先让位给 Logo 与工具区', () => {
    const cls = mountBreadcrumb({ variant: 'header' })
      .find('[data-layout-region="breadcrumb"]')
      .classes();
    expect(cls).toContain('hidden');
    expect(cls).toContain('md:flex');
  });
});
