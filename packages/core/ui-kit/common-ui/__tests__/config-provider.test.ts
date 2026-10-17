// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import ConfigProvider from '../src/components/config-provider/ConfigProvider.vue';
import { useGlobalConfig } from '../src/components/config-provider/use-global-config';
import Popconfirm from '../src/components/popconfirm/Popconfirm.vue';

/** 在 provider 子树里读一次全局配置，渲染出来好断言 */
const Reader = defineComponent({
  name: 'ConfigReader',
  setup() {
    const config = useGlobalConfig();
    return () =>
      h('span', `${config.locale}|${config.okText}|${config.componentSize}`);
  },
});

describe('ConfigProvider', () => {
  it('不挂 provider 时读到的就是内置默认（中文 + medium）', () => {
    const wrapper = mount(Reader);
    expect(wrapper.text()).toBe('zh-CN|确定|medium');
    wrapper.unmount();
  });

  it('locale 展开成内置词条：切英文后确定/取消跟着变', () => {
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(
            ConfigProvider,
            { locale: 'en-US' },
            () => h(Reader),
          ),
      }),
    );
    expect(wrapper.text()).toBe('en-US|OK|medium');
    wrapper.unmount();
  });

  it('嵌套只覆盖显式给出的字段，其余继承外层', () => {
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(
            ConfigProvider,
            { componentSize: 'large', locale: 'en-US', okText: 'Confirm' },
            () => h(ConfigProvider, { componentSize: 'small' }, () => h(Reader)),
          ),
      }),
    );
    // locale/okText 继承外层，componentSize 被内层改写
    expect(wrapper.text()).toBe('en-US|Confirm|small');
    wrapper.unmount();
  });

  it('Popconfirm 的按钮文案来自全局配置，显式 prop 仍然优先', async () => {
    const Host = defineComponent({
      setup() {
        const open = ref(true);
        return () =>
          h(
            ConfigProvider,
            { locale: 'en-US' },
            () => [
              h(
                Popconfirm,
                {
                  open: open.value,
                  'onUpdate:open': (value: boolean) => (open.value = value),
                  title: 'Delete this?',
                },
                () => h('button', 'del'),
              ),
              h(
                Popconfirm,
                {
                  okText: 'Yes',
                  open: open.value,
                  'onUpdate:open': (value: boolean) => (open.value = value),
                  title: 'explicit',
                },
                () => h('button', 'del2'),
              ),
            ],
          );
      },
    });

    const wrapper = mount(Host, { attachTo: document.body });
    await nextTick();
    const panels = document.querySelectorAll('[data-common-popconfirm]');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.textContent).toContain('OK');
    expect(panels[0]?.textContent).toContain('Cancel');
    expect(panels[1]?.textContent).toContain('Yes');
    wrapper.unmount();
  });
});
