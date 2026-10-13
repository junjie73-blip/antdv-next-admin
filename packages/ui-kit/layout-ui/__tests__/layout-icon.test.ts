import type { LayoutMode } from '@antdv/types';

import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

import { describe, expect, it } from 'vitest';

import LayoutIcon from '../src/components/LayoutIcon.vue';
import {
  DEFAULT_ICON_PALETTE,
  resolveIconPalette,
} from '../src/layout-icon-palette';
import {
  LAYOUT_ICON_FALLBACK,
  LAYOUT_ICON_SHAPES,
  LAYOUT_ICON_VIEWBOX,
  layoutIconRects,
} from '../src/layout-icons';

const MODES: LayoutMode[] = [
  'full-content',
  'horizontal',
  'mixed-two-column',
  'mixed-vertical',
  'side-nav',
  'two-column',
  'vertical',
];

describe('布局示意图 - 图形数据表', () => {
  it('7 种形态与 2 种内容宽度都有图形，缺项会让类型检查与这里一起失败', () => {
    for (const mode of MODES) {
      expect(LAYOUT_ICON_SHAPES[mode].length).toBeGreaterThan(0);
    }
    expect(LAYOUT_ICON_SHAPES['content-fixed'].length).toBeGreaterThan(0);
    expect(LAYOUT_ICON_SHAPES['content-full'].length).toBeGreaterThan(0);
  });

  it('所有矩形都落在 48×36 画布内，坐标脏了会被这一步抓住', () => {
    for (const [type, rects] of Object.entries(LAYOUT_ICON_SHAPES)) {
      for (const rect of rects) {
        expect(rect.x, type).toBeGreaterThanOrEqual(0);
        expect(rect.y, type).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width, type).toBeLessThanOrEqual(
          LAYOUT_ICON_VIEWBOX.width,
        );
        expect(rect.y + rect.height, type).toBeLessThanOrEqual(
          LAYOUT_ICON_VIEWBOX.height,
        );
      }
    }
  });

  it('填充只引用调色板槽位，不写死颜色', () => {
    const palette = resolveIconPalette(DEFAULT_ICON_PALETTE);
    for (const rects of Object.values(LAYOUT_ICON_SHAPES)) {
      for (const rect of rects) {
        expect(palette[rect.fill], rect.fill).toBeTypeOf('string');
      }
    }
  });

  it('定宽比流式多出两侧留白，画布尺寸一致', () => {
    const fixed = layoutIconRects('content-fixed');
    const full = layoutIconRects('content-full');
    expect(fixed.length).toBeGreaterThan(full.length);
    const fixedSurface = fixed.find((rect) => rect.fill === 'surface');
    const fullSurface = full.find((rect) => rect.fill === 'surface');
    expect(fixedSurface?.width).toBeLessThan(fullSurface?.width ?? 0);
  });

  it('脏值（旧缓存里的形态名）落回经典布局而不是抛错', () => {
    expect(layoutIconRects('legacy-mode' as LayoutMode)).toBe(
      LAYOUT_ICON_FALLBACK,
    );
  });
});

describe('布局示意图 - 调色板', () => {
  it('选中态用主色铺满外壳、线条转成白色半透明', () => {
    const colors = resolveIconPalette(DEFAULT_ICON_PALETTE, { active: true });
    expect(colors.panel).toBe(DEFAULT_ICON_PALETTE.primary);
    expect(colors.line).toBe('rgba(255,255,255,0.85)');
  });

  it('未选中时外壳只是主色淡底，深色下叠得更浓才压得住背景', () => {
    const light = resolveIconPalette(DEFAULT_ICON_PALETTE, { dark: false });
    const dark = resolveIconPalette(DEFAULT_ICON_PALETTE, { dark: true });
    expect(light.panel).toContain('color-mix');
    expect(light.panel).toContain('10%');
    expect(dark.panel).toContain('30%');
    expect(dark.line).not.toBe(light.line);
  });

  it('深色下的内容底色换成深灰', () => {
    expect(
      resolveIconPalette(DEFAULT_ICON_PALETTE, { dark: true }).surface,
    ).toBe('#1f1f1f');
    expect(
      resolveIconPalette(DEFAULT_ICON_PALETTE, { dark: false }).surface,
    ).toBe('#f8fafc');
  });
});

describe('LayoutIcon - 渲染', () => {
  it('按形态渲染矩形，并把类型与选中态写进数据钩子', () => {
    const wrapper = mount(LayoutIcon, {
      props: { active: true, type: 'mixed-two-column' },
    });
    const svg = wrapper.find('[data-layout-icon="true"]');
    expect(svg.attributes('data-layout-icon-type')).toBe('mixed-two-column');
    expect(svg.attributes('data-layout-icon-active')).toBe('true');
    expect(svg.attributes('viewBox')).toBe('0 0 48 36');
    expect(wrapper.findAll('rect')).toHaveLength(
      LAYOUT_ICON_SHAPES['mixed-two-column'].length,
    );
  });

  it('注入的调色板决定填充色，不传就用默认色板兜底', () => {
    const wrapper = mount(LayoutIcon, {
      props: {
        palette: { ...DEFAULT_ICON_PALETTE, primary: '#ff0000' },
        type: 'horizontal',
      },
    });
    const first = wrapper.find('rect');
    // 未选中：外壳是主色淡底，color-mix 里应带上注入的那个色值
    expect(first.attributes('fill')).toContain('#ff0000');
  });

  it('使用方写的类由 Vue 合并到根节点，不重复出现', () => {
    // 从父组件正常写法验证 fallthrough：手动塞 attrs 走不到 Vue 的那条合并规则
    const wrapper = mount(
      defineComponent({
        components: { LayoutIcon },
        template: '<LayoutIcon class="w-24" type="vertical" />',
      }),
    );
    const classes = wrapper.find('div').classes();
    expect(classes).toContain('w-24');
    expect(classes).toContain('aspect-4/3');
  });
});
