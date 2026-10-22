import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import PageHeader from '../src/components/page-header/PageHeader.vue';
import PageToolbar from '../src/components/page-toolbar/PageToolbar.vue';
import ToolbarField from '../src/components/page-toolbar/ToolbarField.vue';

/**
 * 页头与工具栏是"页面骨架"，不是交互组件：这里钉的是**结构契约**（钩子齐不齐、
 * 空的时候整块消不消失）和**外边距为零**（内边距归布局、竖向节奏归页面根容器的
 * `space-y-*`，这两处一旦在这里写死，逐页落地就会长出两种间距）。
 */
describe('pageHeader', () => {
  it('标题、说明、图标与操作区各有数据钩子', () => {
    const wrapper = mount(PageHeader, {
      props: {
        description: '描述',
        icon: 'carbon:security',
        title: '用户管理',
      },
      slots: { extra: '<button type="button">新增</button>' },
    });
    expect(wrapper.find('[data-page="header"]').exists()).toBe(true);
    expect(wrapper.find('[data-page="header-title"]').text()).toBe('用户管理');
    expect(wrapper.find('[data-page="header-desc"]').text()).toBe('描述');
    expect(wrapper.find('[data-page="header-icon"]').exists()).toBe(true);
    expect(wrapper.find('[data-page="header-extra"]').text()).toBe('新增');
  });

  it('不传 icon 就不长出一枚空的图标底座', () => {
    const wrapper = mount(PageHeader, { props: { title: '角色管理' } });
    expect(wrapper.find('[data-page="header-icon"]').exists()).toBe(false);
    expect(wrapper.find('[data-page="header-desc"]').exists()).toBe(false);
    expect(wrapper.find('[data-page="header-extra"]').exists()).toBe(false);
  });

  it('页头自身不带任何 padding / margin 类', () => {
    const wrapper = mount(PageHeader, { props: { title: 'T' } });
    const root = wrapper.find('[data-page="header"]').attributes('class') ?? '';
    expect(root).not.toMatch(/(^|\s)(p|px|py|pt|pb|pl|pr|m|mx|my)-/);
  });

  it('#title 插槽覆盖 props.title，用于标题里要塞行内元素', () => {
    const wrapper = mount(PageHeader, {
      props: { title: '兜底' },
      slots: { title: '<span>带徽标的标题</span>' },
    });
    expect(wrapper.find('[data-page="header-title"]').text()).toBe(
      '带徽标的标题',
    );
  });
});

describe('pageToolbar', () => {
  it('筛选与操作分成两组，各自有钩子', () => {
    const wrapper = mount(PageToolbar, {
      slots: { actions: '<button>新增</button>', filters: '<input>' },
    });
    expect(wrapper.find('[data-page="toolbar"]').exists()).toBe(true);
    expect(wrapper.find('[data-page="toolbar-filters"]').exists()).toBe(true);
    expect(wrapper.find('[data-page="toolbar-actions"]').exists()).toBe(true);
  });

  it('默认插槽落在筛选组里；没有 actions 时不渲染空的操作组', () => {
    const wrapper = mount(PageToolbar, {
      slots: { default: '<span>裸控件</span>' },
    });
    expect(wrapper.find('[data-page="toolbar-filters"]').text()).toBe('裸控件');
    expect(wrapper.find('[data-page="toolbar-actions"]').exists()).toBe(false);
  });

  it('stackOnNarrow 默认让操作区在窄屏独占一行，关掉就没有 max-sm 类', () => {
    const stacked = mount(PageToolbar, {
      slots: { actions: '<button>新增</button>' },
    });
    const actions =
      stacked.find('[data-page="toolbar-actions"]').attributes('class') ?? '';
    expect(actions).toContain('max-sm:w-full');

    const inline = mount(PageToolbar, {
      props: { stackOnNarrow: false },
      slots: { actions: '<button>新增</button>' },
    });
    expect(
      inline.find('[data-page="toolbar-actions"]').attributes('class') ?? '',
    ).not.toContain('max-sm:');
  });
});

describe('toolbarField', () => {
  it('标签与控件同排，不传标签就只剩控件', () => {
    const withLabel = mount(ToolbarField, {
      props: { label: '状态' },
      slots: { default: '<select></select>' },
    });
    expect(withLabel.find('[data-page="toolbar-field-label"]').text()).toBe(
      '状态',
    );
    expect(
      withLabel.find('[data-page="toolbar-field"]').find('select').exists(),
    ).toBe(true);

    const bare = mount(ToolbarField, { slots: { default: '<input>' } });
    expect(bare.find('[data-page="toolbar-field-label"]').exists()).toBe(false);
  });
});
