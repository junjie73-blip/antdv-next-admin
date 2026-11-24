import type { ResponsiveColumn } from '../src/components/descriptions/grid';

import { mount } from '@vue/test-utils';
import { h } from 'vue';

import { describe, expect, it } from 'vitest';

import Description from '../src/components/description/Description.vue';
import Descriptions from '../src/components/descriptions/Descriptions.vue';
import DescriptionsItem from '../src/components/descriptions/DescriptionsItem.vue';
import {
  BREAKPOINT_MIN,
  buildResponsiveCss,
  colsPerItem,
  normalizeColumns,
} from '../src/components/descriptions/grid';

type Item = { label: string; value: string; span?: number };

function mountDescriptions(
  props: Record<string, unknown>,
  items: Item[],
  layout: 'horizontal' | 'vertical' = 'horizontal',
) {
  return mount(
    h(
      Descriptions,
      { ...props, layout },
      {
        default: () =>
          items.map((item) =>
            h(
              DescriptionsItem,
              { label: item.label, span: item.span },
              { default: () => item.value },
            ),
          ),
      },
    ),
  );
}

describe('descriptions 栅格计算规则', () => {
  it('数字 column 所有断点一致，每项占 24/column col', () => {
    const normalized = normalizeColumns(3);
    expect(Object.values(normalized)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(colsPerItem(3)).toBe(8);
    expect(colsPerItem(2)).toBe(12);
    expect(colsPerItem(1)).toBe(24);
    // 不整除的 column 保留小数，不取整
    expect(colsPerItem(5)).toBe(4.8);
  });

  it('响应式 column 按断点向下继承，xs 缺省为 1', () => {
    expect(normalizeColumns({ md: 3, lg: 4 } as ResponsiveColumn)).toEqual({
      xs: 1,
      sm: 1,
      md: 3,
      lg: 4,
      xl: 4,
      xxl: 4,
    });
    expect(normalizeColumns(undefined)).toEqual({
      xs: 3,
      sm: 3,
      md: 3,
      lg: 3,
      xl: 3,
      xxl: 3,
    });
  });

  it('响应式 CSS 为每个断点生成 --desc-cols，并处理窄屏 label', () => {
    const css = buildResponsiveCss('.scope', { sm: 2, lg: 4 });
    expect(css).toContain('.scope { --desc-cols: 24;'); // xs=1
    expect(css).toContain(`@media (min-width: ${BREAKPOINT_MIN.sm}px)`);
    expect(css).toContain('--desc-cols: 12'); // sm=2
    expect(css).toContain('--desc-cols: 6'); // lg=4
    expect(css).toContain(`@media (max-width: ${BREAKPOINT_MIN.sm - 1}px)`);
    expect(css).toContain('--desc-label-width: min(76px, 45%)');
    // 宽度公式用 --desc-span，span 超出时 min(..., 100%) 收窄到整行
    expect(css).toContain('var(--desc-span, 1)');
    expect(css).toContain(', 100%)');
  });
});

describe('description 对齐（div + 24 栅格）', () => {
  it('不同 label 长度共用统一 label 宽度，content 起点一致', () => {
    // 复现截图：同一列里「用户名」3 字、「邮箱」2 字，旧实现各自 flex 自适应导致错位
    const wrapper = mountDescriptions(
      { column: 2, bordered: true, labelWidth: 84 },
      [
        { label: '用户名', value: 'admin' },
        { label: '昵称', value: '管理员' },
        { label: '邮箱', value: 'admin@antdv-next.com' },
        { label: '手机号', value: '138-0000-0001' },
      ],
    );

    const items = wrapper.findAll('[data-common-descriptions-item]');
    expect(items).toHaveLength(4);
    for (const item of items) {
      const label = item.find('[data-common-descriptions-label]');
      const value = item.find('[data-common-descriptions-value]');
      expect(label.attributes('style')).toContain('var(--desc-label-width)');
      expect(label.classes().join(' ')).toContain('text-right');
      expect(value.classes().join(' ')).toContain('flex-1');
      expect(value.classes().join(' ')).toContain('min-w-0');
    }

    // 统一宽度由根级 CSS 变量下发，而非每个单元格自己决定
    expect(wrapper.attributes('style')).toContain('--desc-label-width: 84px');
    expect(wrapper.find('[data-common-descriptions-row]').classes()).toContain(
      'flex-wrap',
    );
    expect(wrapper.find('style').text()).toContain('--desc-cols: 12');
  });

  it('span 以 --desc-span 表达，响应式 column 切换时由列级规则重算宽度', () => {
    const wrapper = mountDescriptions({ column: { xs: 1, md: 3 } }, [
      { label: '用户名', value: 'admin' },
      { label: '个人简介', value: '很长的一段简介', span: 2 },
    ]);

    const items = wrapper.findAll('[data-common-descriptions-item]');
    expect(items[0]!.attributes('style')).toContain('--desc-span: 1');
    expect(items[1]!.attributes('style')).toContain('--desc-span: 2');
    const css = wrapper.find('style').text();
    expect(css).toContain('@media (min-width: 768px)');
    expect(css).toContain('--desc-cols: 8'); // md=3 → 24/3
  });

  it('窄屏默认 label 宽度收窄，显式 labelWidth 由内联 style 覆盖', () => {
    const auto = mountDescriptions({ column: 1 }, [
      { label: '用户名', value: 'admin' },
    ]);
    expect(auto.find('style').text()).toContain(
      '--desc-label-width: min(76px, 45%)',
    );
    expect(auto.attributes('style') ?? '').not.toContain('--desc-label-width');

    const explicit = mountDescriptions({ column: 1, labelWidth: '6rem' }, [
      { label: '用户名', value: 'admin' },
    ]);
    expect(explicit.attributes('style')).toContain('--desc-label-width: 6rem');
  });

  it('vertical 布局每项 label 在 content 上方且占满宽度', () => {
    const wrapper = mountDescriptions(
      { column: 2, bordered: true },
      [
        { label: '用户名', value: 'admin' },
        { label: '昵称', value: '管理员' },
      ],
      'vertical',
    );

    const items = wrapper.findAll('[data-common-descriptions-item]');
    expect(items).toHaveLength(2);
    expect(items[0]!.classes().join(' ')).toContain('flex-col');
    const label = items[0]!.find('[data-common-descriptions-label]');
    expect(label.attributes('style') ?? '').not.toContain(
      'var(--desc-label-width)',
    );
    expect(label.text()).toBe('用户名');
    expect(items[0]!.find('[data-common-descriptions-value]').text()).toBe(
      'admin',
    );
  });

  it('上层 Description 的 labelWidth / 响应式 column 透传到栅格层', () => {
    const wrapper = mount(Description, {
      props: {
        column: { xs: 1, md: 2 },
        labelWidth: 88,
        bordered: true,
        data: { a: '甲', b: '乙' },
        schema: [
          { field: 'a', label: '标签A' },
          { field: 'b', label: '较长标签B' },
        ],
      },
    });

    expect(
      wrapper.find('[data-common-descriptions]').attributes('style'),
    ).toContain('--desc-label-width: 88px');
    const css = wrapper.find('style').text();
    expect(css).toContain('--desc-cols: 24');
    expect(css).toContain('@media (min-width: 768px)');
    expect(css).toContain('--desc-cols: 12');

    const labelSpan = wrapper.find('[data-common-descriptions-label] span');
    expect(labelSpan.attributes('style') ?? '').not.toContain('width');
  });
});
