import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import { Select } from '@antdv/shadcn-ui';
import cronstrue from 'cronstrue';
import { describe, expect, it } from 'vitest';

import CronEditor from '../src/components/cron-editor/CronEditor.vue';

import 'cronstrue/locales/zh_CN';

/** 直接 mount SFC（测试环境无运行时模板编译器，不写 template 字符串） */
async function build(props: Record<string, unknown> = {}) {
  const wrapper = mount(CronEditor, { props });
  await nextTick();
  return wrapper;
}

/** 模式切换按钮（常用预设 / 自定义） */
const modeButton = (
  wrapper: Awaited<ReturnType<typeof build>>,
  label: string,
) => wrapper.findAll('button').find((node) => node.text() === label)!;

/** 切到自定义模式，返回六个字段的 reka Select 实例 */
async function toCustomMode(wrapper: Awaited<ReturnType<typeof build>>) {
  await modeButton(wrapper, '自定义').trigger('click');
  await nextTick();
  return wrapper.findAllComponents(Select);
}

/** 六个字段当前绑定的值（按 秒 分 时 日 月 周 顺序） */
const fieldValuesOf = (selects: Array<{ props: (key: string) => unknown }>) =>
  selects.map((node) => node.props('modelValue'));

describe('cronEditor', () => {
  describe('预设模式', () => {
    it('默认渲染 12 个预设按钮与 2 个模式按钮', async () => {
      const wrapper = await build();
      const buttons = wrapper.findAll('button');
      // 2 个模式按钮 + 12 个预设按钮
      expect(buttons).toHaveLength(14);
      expect(wrapper.text()).toContain('每分钟');
      expect(wrapper.text()).toContain('每年 1 月 1 日');
    });

    it('点击预设同时上报 update:modelValue 与 change', async () => {
      const wrapper = await build();
      await modeButton(wrapper, '每天 8 点').trigger('click');
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
        '0 0 8 * * *',
      ]);
      expect(wrapper.emitted('change')?.[0]).toEqual(['0 0 8 * * *']);
    });

    it('v-model 往返：外部值命中预设时高亮对应按钮', async () => {
      // 按整枚类名判定而不是 join 后包含：未选中态也带 `hover:border-primary/50`，
      // 子串匹配会让"没高亮"这条断言假红。
      const isAccented = (node: { classes(): string[] }) =>
        node.classes().includes('border-primary');
      const wrapper = await build({ modelValue: '0 0 0 * * 1' });
      const hit = wrapper
        .findAll('button')
        .find((node) => node.text() === '每周一 0 点')!;
      expect(isAccented(hit)).toBe(true);

      await wrapper.setProps({ modelValue: '0 0 12 * * *' });
      expect(isAccented(hit)).toBe(false);
      const other = wrapper
        .findAll('button')
        .find((node) => node.text() === '每天 12 点')!;
      expect(isAccented(other)).toBe(true);
    });

    it('只读输入框回显当前表达式', async () => {
      const wrapper = await build({ modelValue: '0 */5 * * * *' });
      const input = wrapper.find('input');
      expect(input.element.value).toBe('0 */5 * * * *');
      expect(input.attributes('readonly')).toBeDefined();
    });

    it('切回预设模式时，不在预设里的值回退为第一个预设', async () => {
      const wrapper = await build({ modelValue: '0 15 10 * * 1' });
      await toCustomMode(wrapper);
      await modeButton(wrapper, '常用预设').trigger('click');
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
        '0 * * * * *',
      ]);
      expect(wrapper.emitted('change')?.[0]).toEqual(['0 * * * * *']);
    });

    it('切回预设模式时，命中预设的值不触发回退', async () => {
      const wrapper = await build({ modelValue: '0 0 8 * * *' });
      await toCustomMode(wrapper);
      await modeButton(wrapper, '常用预设').trigger('click');
      expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });
  });

  describe('自定义模式', () => {
    it('渲染六个字段下拉，6 段表达式逐字段解析', async () => {
      const wrapper = await build({ modelValue: '0 15 10 * * 1' });
      const selects = await toCustomMode(wrapper);
      expect(selects).toHaveLength(6);
      expect(fieldValuesOf(selects)).toEqual(['0', '15', '10', '*', '*', '1']);
    });

    it('5 段表达式按「分时日月周」补 0 秒', async () => {
      const wrapper = await build({ modelValue: '30 4 * * *' });
      const selects = await toCustomMode(wrapper);
      expect(fieldValuesOf(selects)).toEqual(['0', '30', '4', '*', '*', '*']);
    });

    it('非法段数静默重置为默认 0 0 0 * * *', async () => {
      const wrapper = await build({ modelValue: '* * *' });
      const selects = await toCustomMode(wrapper);
      expect(fieldValuesOf(selects)).toEqual(['0', '0', '0', '*', '*', '*']);
    });

    it('修改字段后按 秒 分 时 日 月 周 顺序生成 6 段表达式并双事件上报', async () => {
      const wrapper = await build({ modelValue: '0 0 0 * * *' });
      const selects = await toCustomMode(wrapper);
      // 「分」字段改成 30
      selects[1]!.vm.$emit('update:modelValue', '30');
      await nextTick();
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
        '0 30 0 * * *',
      ]);
      expect(wrapper.emitted('change')?.[0]).toEqual(['0 30 0 * * *']);
      // 数字值经 String() 桥接后写回字段绑定
      expect(fieldValuesOf(wrapper.findAllComponents(Select))).toEqual([
        '0',
        '30',
        '0',
        '*',
        '*',
        '*',
      ]);
    });

    /*
     * 显式给 20 秒预算：这条要按三种组合各挂一次整棵 CronEditor 并跑 cronstrue，
     * 单文件跑（`vitest run __tests__/cron-editor.test.ts`）全文件 5.8 秒就过，
     * 但整包并发时同包的其他文件（含打 Iconify 的那些）把 worker 压满，
     * 实测会被默认的 5 秒咬掉，报成"这条挂了"。超时给足，断言一条不松。
     */
    it('每个时间模式的字段值组合都对应预期的 cronstrue 描述', async () => {
      const cases: Array<[number, string, string]> = [
        [1, '*/10', '0 */10 0 * * *'],
        [3, '15', '0 0 0 15 * *'],
        [5, '2', '0 0 0 * * 2'],
      ];
      for (const [index, value, expected] of cases) {
        const wrapper = await build({ modelValue: '0 0 0 * * *' });
        const selects = await toCustomMode(wrapper);
        selects[index]!.vm.$emit('update:modelValue', value);
        await nextTick();
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([expected]);
        expect(wrapper.text()).toContain(
          cronstrue.toString(expected, { locale: 'zh_CN' }),
        );
      }
    }, 20_000);

    it('字段值拼出非法表达式时提示「表达式无效」但不阻止上报', async () => {
      const wrapper = await build({ modelValue: '0 0 0 * * *' });
      const selects = await toCustomMode(wrapper);
      selects[1]!.vm.$emit('update:modelValue', '99');
      await nextTick();
      expect(wrapper.emitted('change')?.[0]).toEqual(['0 99 0 * * *']);
      expect(wrapper.text()).toContain('表达式无效');
    });
  });

  describe('描述回显与禁用态', () => {
    it('默认字段生成「每天 0 点」的中文描述', async () => {
      const wrapper = await build();
      expect(wrapper.text()).toContain(
        cronstrue.toString('0 0 0 * * *', { locale: 'zh_CN' }),
      );
    });

    it('disabled 时全部按钮与输入框禁用，模式切换不生效', async () => {
      const wrapper = await build({ disabled: true });
      for (const button of wrapper.findAll('button')) {
        expect(button.attributes('disabled')).toBeDefined();
      }
      expect(wrapper.find('input').attributes('disabled')).toBeDefined();

      // 禁态下点击「自定义」不应切换模式（按钮原生 disabled 拦截）
      await modeButton(wrapper, '自定义').trigger('click');
      await nextTick();
      expect(wrapper.findAll('button')).toHaveLength(14);
      expect(wrapper.findAllComponents(Select)).toHaveLength(0);
    });
  });
});
