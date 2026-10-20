// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { injectConfigProviderContext } from 'reka-ui';
import { defineComponent, h, nextTick, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import ConfigProvider from '../src/components/config-provider/ConfigProvider.vue';
import {
  normalizeComponentSize,
  useGlobalConfig,
} from '../src/components/config-provider';
import Empty from '../src/components/empty/Empty.vue';
import Loading from '../src/components/loading/Loading.vue';
import Popconfirm from '../src/components/popconfirm/Popconfirm.vue';
import Segmented from '../src/components/segmented/Segmented.vue';

/** 在 provider 子树里读一次全局配置，渲染出来好断言 */
const Reader = defineComponent({
  name: 'ConfigReader',
  setup() {
    const config = useGlobalConfig();
    return () =>
      h('span', `${config.locale}|${config.okText}|${config.componentSize}`);
  },
});

/** 读 reka-ui 自己那份上下文，验证桥接真的把值交给了原语层 */
const RekaReader = defineComponent({
  name: 'RekaConfigReader',
  setup() {
    const ctx = injectConfigProviderContext();
    return () =>
      h(
        'span',
        [
          ctx.dir?.value,
          ctx.locale?.value,
          String(ctx.scrollBody?.value),
          ctx.nonce?.value ?? '',
          ctx.teleportTo?.value ?? '',
          typeof ctx.useId,
        ].join('|'),
      );
  },
});

/**
 * 取 provider 落地的那个容器元素（`display: contents`，不生成盒子）。
 * 用选择器而不是 `wrapper.element`：后者是 VTU 的挂载容器，不是组件根节点。
 */
function hostOf(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[data-common-config-provider]').element as HTMLElement;
}

function withProvider(props: Record<string, unknown>, child: () => unknown) {
  return defineComponent({
    render: () => h(ConfigProvider, props, () => child()),
  });
}

describe('ConfigProvider 全局配置', () => {
  it('不挂 provider 时读到的就是内置默认（中文 + medium）', () => {
    const wrapper = mount(Reader);
    expect(wrapper.text()).toBe('zh-CN|确定|medium');
    wrapper.unmount();
  });

  it('locale 展开成内置词条：切英文后确定/取消跟着变', () => {
    const wrapper = mount(withProvider({ locale: 'en-US' }, () => h(Reader)));
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
            () =>
              h(ConfigProvider, { componentSize: 'small' }, () => h(Reader)),
          ),
      }),
    );
    // locale/okText 继承外层，componentSize 被内层改写
    expect(wrapper.text()).toBe('en-US|Confirm|small');
    wrapper.unmount();
  });

  it('middle 折叠成 medium，读侧只见三档', () => {
    const wrapper = mount(
      withProvider({ componentSize: 'middle' }, () => h(Reader)),
    );
    expect(wrapper.text()).toBe('zh-CN|确定|medium');
    expect(normalizeComponentSize('middle')).toBe('medium');
    wrapper.unmount();
  });

  it('props 变化会推给已挂载的消费方（注入的是引用，不是快照）', async () => {
    const locale = ref<'en-US' | 'zh-CN'>('zh-CN');
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(ConfigProvider, { locale: locale.value }, () => h(Reader)),
      }),
    );
    expect(wrapper.text()).toBe('zh-CN|确定|medium');
    locale.value = 'en-US';
    await nextTick();
    expect(wrapper.text()).toBe('en-US|OK|medium');
    wrapper.unmount();
  });

  it('Popconfirm 的按钮文案来自全局配置，显式 prop 仍然优先', async () => {
    const open = ref(true);
    const Host = defineComponent({
      setup: () => () =>
        h(ConfigProvider, { locale: 'en-US' }, () => [
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
        ]),
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

describe('ConfigProvider 到 reka-ui 底座的桥接', () => {
  it('默认就把中文语言交给 reka（reka 自带默认是 en）', () => {
    const wrapper = mount(withProvider({}, () => h(RekaReader)));
    const [dir, locale, scrollBody, nonce, teleportTo, useIdType] = wrapper
      .text()
      .split('|');
    expect(dir).toBe('ltr');
    expect(locale).toBe('zh-CN');
    // scrollBody 不给 → 沿用 reka 的默认 true
    expect(scrollBody).toBe('true');
    expect(nonce).toBe('');
    expect(teleportTo).toBe('');
    expect(useIdType).toBe('undefined');
    wrapper.unmount();
  });

  it('dir / scrollBody / nonce / teleportTo / useId 逐项透传', () => {
    const useId = () => 'id-1';
    const wrapper = mount(
      withProvider(
        {
          dir: 'rtl',
          locale: 'en-US',
          nonce: 'n0nce',
          scrollBody: false,
          teleportTo: '#layer-root',
          useId,
        },
        () => h(RekaReader),
      ),
    );
    expect(wrapper.text()).toBe('rtl|en-US|false|n0nce|#layer-root|function');
    wrapper.unmount();
  });

  it('嵌套时内层没给的字段继续用外层的底座参数', () => {
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(ConfigProvider, { dir: 'rtl', locale: 'en-US' }, () =>
            h(ConfigProvider, { componentSize: 'small' }, () => h(RekaReader)),
          ),
      }),
    );
    expect(wrapper.text().startsWith('rtl|en-US|')).toBe(true);
    wrapper.unmount();
  });
});

describe('ConfigProvider 的子树主题与样式变量', () => {
  it('theme.primary / theme.radius 写成 --app-* 变量，数值按 px 处理', () => {
    const wrapper = mount(
      withProvider({ theme: { primary: 'rgb(255 92 92)', radius: 8 } }, () =>
        h('i', 'x'),
      ),
    );
    const style = hostOf(wrapper).style;
    expect(style.getPropertyValue('--app-primary')).toBe('rgb(255 92 92)');
    expect(style.getPropertyValue('--app-border-radius')).toBe('8px');
    wrapper.unmount();
  });

  it('radius 给字符串时原样写入（便于 calc() 之类的写法）', () => {
    const wrapper = mount(
      withProvider({ theme: { radius: 'var(--radius-md)' } }, () => h('i')),
    );
    expect(hostOf(wrapper).style.getPropertyValue('--app-border-radius')).toBe(
      'var(--radius-md)',
    );
    wrapper.unmount();
  });

  it('不给 theme 时一条变量声明都不写，子树继续继承 <html> 的档位', () => {
    const wrapper = mount(withProvider({}, () => h('i')));
    const el = hostOf(wrapper);
    expect(el.getAttribute('style') ?? '').not.toContain('--app-primary');
    expect(el.classList.contains('dark')).toBe(false);
    expect(el.classList.contains('light')).toBe(false);
    wrapper.unmount();
  });

  it('mode 落成 class：dark / light 都作用在容器上，system 跟随 prefers-color-scheme', async () => {
    const mode = ref<'dark' | 'light' | 'system'>('dark');
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(ConfigProvider, { theme: { mode: mode.value } }, () => h('i')),
      }),
    );
    expect(hostOf(wrapper).classList.contains('dark')).toBe(true);
    mode.value = 'light';
    await nextTick();
    const el = hostOf(wrapper);
    expect(el.classList.contains('dark')).toBe(false);
    expect(el.classList.contains('light')).toBe(true);
    // happy-dom 的 matchMedia 默认不匹配暗色，system 解析成 light
    mode.value = 'system';
    await nextTick();
    expect(hostOf(wrapper).classList.contains('light')).toBe(true);
    wrapper.unmount();
  });

  it('preset 落到 data-theme，容器同时带档位 class 与预设名（token 的复合选择器要同一元素）', () => {
    const wrapper = mount(
      withProvider({ theme: { mode: 'dark', preset: 'violet' } }, () => h('i')),
    );
    const el = hostOf(wrapper);
    expect(el.getAttribute('data-theme')).toBe('violet');
    expect(el.classList.contains('dark')).toBe(true);
    wrapper.unmount();
  });

  it('cssVars 最后写入，优先级高于 theme 派生的同名变量', () => {
    const wrapper = mount(
      withProvider(
        {
          cssVars: { '--app-primary': '#111', '--app-card': '#eee' },
          theme: { primary: 'rgb(255 92 92)' },
        },
        () => h('i'),
      ),
    );
    const style = hostOf(wrapper).style;
    expect(style.getPropertyValue('--app-primary')).toBe('#111');
    expect(style.getPropertyValue('--app-card')).toBe('#eee');
    wrapper.unmount();
  });

  it('嵌套的 theme 是浅合并：内层只换 radius 时外层主色仍在', () => {
    const wrapper = mount(
      defineComponent({
        render: () =>
          h(
            ConfigProvider,
            { theme: { primary: 'rgb(1 2 3)', radius: 8 } },
            () =>
              h(ConfigProvider, { theme: { radius: 12 } }, () =>
                h('i', 'inner'),
              ),
          ),
      }),
    );
    const inner = wrapper.findAll('[data-common-config-provider]')[1]!
      .element as HTMLElement;
    expect(inner.style.getPropertyValue('--app-border-radius')).toBe('12px');
    expect(inner.style.getPropertyValue('--app-primary')).toBe('rgb(1 2 3)');
    wrapper.unmount();
  });
});

describe('ConfigProvider 容器与 attrs 透传', () => {
  it('容器不带盒子（display: contents），宿主仍可覆盖它', () => {
    const wrapper = mount(
      withProvider({ style: { display: 'flex' } }, () => h('i')),
    );
    const el = hostOf(wrapper);
    expect(el.classList.contains('contents')).toBe(true);
    expect(el.style.display).toBe('flex');
    wrapper.unmount();
  });

  it('class 与 data-* 一并落到容器，其余 attrs 原样透传', () => {
    const wrapper = mount(
      withProvider({ class: 'host-layer', 'data-testid': 'cfg' }, () => h('i')),
    );
    const el = hostOf(wrapper);
    expect(el.classList.contains('contents')).toBe(true);
    expect(el.classList.contains('host-layer')).toBe(true);
    expect(el.getAttribute('data-testid')).toBe('cfg');
    wrapper.unmount();
  });

  it('语言与尺寸档位留在容器上，样式与 e2e 都能按属性选', () => {
    const wrapper = mount(
      withProvider({ componentSize: 'large', locale: 'en-US' }, () => h('i')),
    );
    const el = hostOf(wrapper);
    expect(el.getAttribute('data-config-locale')).toBe('en-US');
    expect(el.getAttribute('data-config-size')).toBe('large');
    expect(el.getAttribute('dir')).toBe('ltr');
    wrapper.unmount();
  });
});

describe('ConfigProvider 的读侧组件', () => {
  it('Empty 的默认描述跟着 locale 走，显式 prop 与 false 都保留原意', () => {
    const zh = mount(withProvider({}, () => h(Empty)));
    expect(zh.text()).toContain('暂无数据');
    zh.unmount();

    const en = mount(withProvider({ locale: 'en-US' }, () => h(Empty)));
    expect(en.text()).toContain('No data');
    en.unmount();

    const off = mount(
      withProvider({ locale: 'en-US' }, () => h(Empty, { description: false })),
    );
    expect(off.text()).not.toContain('No data');
    off.unmount();
  });

  it('Loading 的档位来自 componentSize，显式 size 仍然优先', () => {
    const small = mount(
      withProvider({ componentSize: 'small' }, () =>
        h(Loading, { loading: true }),
      ),
    );
    expect(small.find('.loading-small').exists()).toBe(true);
    small.unmount();

    const explicit = mount(
      withProvider({ componentSize: 'small' }, () =>
        h(Loading, { loading: true, size: 'large' }),
      ),
    );
    expect(explicit.find('.loading-large').exists()).toBe(true);
    expect(explicit.find('.loading-small').exists()).toBe(false);
    explicit.unmount();
  });

  it('Segmented 把档位换算成 shadcn 的 h-8 / h-9 / h-10', () => {
    const render = (componentSize: 'large' | 'medium' | 'small') =>
      mount(
        withProvider(
          { componentSize },
          () => h(Segmented, { options: ['a', 'b'], value: 'a' }),
          // 内容挂到 body，方便按全局选择器找
        ),
        { attachTo: document.body },
      );

    for (const [size, height] of [
      ['large', 'h-10'],
      ['medium', 'h-9'],
      ['small', 'h-8'],
    ] as const) {
      const wrapper = render(size);
      const item = wrapper.find('button');
      expect(item.classes().join(' ')).toContain(height);
      wrapper.unmount();
    }
  });
});
