import type { TabStyle } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '~/stores/modules/app';

import { TAB_STYLE_OPTIONS, useTabStyle } from '../composables/useTabStyle';

/**
 * 标签页风格映射的回归测试。
 *
 * 风格切换全部落在 `useTabStyle` 输出的类名字符串上（组件只负责把它们贴到 DOM），
 * 所以这里直接断言字符串内容：新增风格必须同时出现在选项表、样式映射和
 * 未选中底色表里，漏一处就是"设置里点了没反应"或 TS 编译期报错。
 */

function setup(tabStyle: TabStyle) {
  const pinia = createPinia();
  setActivePinia(pinia);

  let api!: ReturnType<typeof useTabStyle>;
  const Host = defineComponent({
    setup() {
      const appStore = useAppStore();
      // store 必须在 setup 里取：内部 useToken 依赖 inject 的 ConfigProvider 上下文
      appStore.updateSetting({ tabStyle });
      api = useTabStyle();
      return () => h('div');
    },
  });
  const wrapper = mount(Host, { global: { plugins: [pinia] } });
  return { api, appStore: useAppStore(), wrapper };
}

const ALL_STYLES = TAB_STYLE_OPTIONS.map((item) => item.value);

describe('useTabStyle —— 风格选项表', () => {
  it('五种风格按 UI 顺序排好，且谷歌风格在列', () => {
    expect(ALL_STYLES).toEqual<TabStyle[]>([
      'card',
      'chrome',
      'rounded',
      'line',
      'plain',
    ]);
    expect(TAB_STYLE_OPTIONS.find((item) => item.value === 'chrome')?.label).toBe(
      '谷歌',
    );
  });

  it.each(ALL_STYLES)('%s 输出的类名串合法（bar 允许为空串）', (style) => {
    const { api } = setup(style);
    // bar 是"可选追加"槽位：只有需要改标签栏排布的风格（chrome）才写内容
    expect(typeof api.barClass()).toBe('string');
    for (const value of [
      api.closeClass(),
      api.itemClass(false),
      api.itemClass(true),
      api.listClass(),
    ]) {
      expect(value).toBeTruthy();
      expect(value).not.toContain('undefined');
    }
  });
});

describe('useTabStyle —— 谷歌（浏览器）风格', () => {
  it('标签栏容器改为贴底排布', () => {
    const { api } = setup('chrome');
    expect(api.barClass()).toContain('items-stretch');
    expect(api.listClass()).toContain('items-end');
  });

  it('标签只有顶部圆角、不画底边，未选中页有浅底', () => {
    const { api } = setup('chrome');
    const idle = api.itemClass(false);
    expect(idle).toContain('rounded-t-lg');
    expect(idle).toContain('border-b-0');
    expect(idle).toContain('bg-gray-100');
    // 底部不能留圆角，否则贴不住标签栏下沿
    expect(idle).not.toContain('rounded-md');
  });

  it('选中页换成内容底色并压一条主色顶边', () => {
    const { api } = setup('chrome');
    const active = api.itemClass(true);
    expect(active).toContain('bg-white');
    expect(active).toContain('border-t-ant-primary');
    // tailwind-merge 必须把未选中底色从选中态里洗掉，否则两层底色打架
    expect(active).not.toContain('bg-gray-100');
  });

  it('其余风格不动标签栏容器', () => {
    for (const style of ALL_STYLES.filter((item) => item !== 'chrome')) {
      expect(setup(style).api.barClass()).toBe('');
    }
  });
});
