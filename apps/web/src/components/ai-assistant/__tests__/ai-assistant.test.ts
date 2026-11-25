import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

import { describe, expect, it, vi } from 'vitest';

const { chatApi } = vi.hoisted(() => ({ chatApi: vi.fn() }));

vi.mock('~/api/ai-chat', () => ({ chatWithAi: chatApi }));

import AiAssistant from '../index.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/approval/mine',
        name: 'ApprovalMine',
        component: { template: '<div />' },
        meta: {
          aiContext: {
            entity: 'approval',
            title: '我的审批',
            prompts: [
              '这个页面能做什么？',
              '总结当前页面数据',
              '帮我检查异常数据',
            ],
          },
        },
      },
    ],
  });
}

describe('copilot 工作台', () => {
  it('悬浮按钮打开窄侧栏，并展示上下文 Chip 与按路由生成的快捷 Prompt', async () => {
    const router = makeRouter();
    await router.push('/approval/mine');
    await router.isReady();

    const wrapper = mount(AiAssistant, {
      attachTo: document.body,
      global: { plugins: [router] },
    });

    const trigger = wrapper.get('[data-ai-assistant-trigger]');
    expect(trigger.attributes('aria-label')).toBe('打开 AI 助手');
    expect(trigger.classes()).toEqual(
      expect.arrayContaining(['fixed', 'bottom-4', 'right-4']),
    );
    expect(wrapper.find('[data-copilot-panel]').exists()).toBe(false);

    await trigger.trigger('click');
    expect(wrapper.find('[data-copilot-panel]').exists()).toBe(true);
    expect(wrapper.text()).toContain('@我的审批');
    expect(wrapper.text()).toContain('读取当前页面数据');
    expect(wrapper.text()).toContain('AI 可能出错，请核实关键信息');
    expect(wrapper.text()).toContain('这个页面能做什么？');
    expect(wrapper.text()).toContain('总结当前页面数据');
    expect(wrapper.text()).toContain('帮我检查异常数据');

    await trigger.trigger('click');
    expect(wrapper.find('[data-copilot-panel]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('点击快捷 Prompt 会把问题送进对话，并带回模型回复', async () => {
    chatApi.mockResolvedValue({
      blocked: false,
      content: '审批单共 3 条，等待你处理。',
    });
    const router = makeRouter();
    await router.push('/approval/mine');
    await router.isReady();

    const wrapper = mount(AiAssistant, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    await wrapper.get('[data-ai-assistant-trigger]').trigger('click');

    const promptButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('总结当前页面数据'));
    expect(promptButton).toBeDefined();
    await promptButton!.trigger('click');

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(chatApi).toHaveBeenCalled();
    expect(wrapper.text()).toContain('审批单共 3 条');

    wrapper.unmount();
  });
});
