import type { ApprovalFlowNode } from '~/api/approval';

import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import ApprovalFlowTimeline from '../ApprovalFlowTimeline.vue';

const nodes: ApprovalFlowNode[] = [
  {
    actedAt: '2026-11-13 09:20:00',
    approver: '王一',
    comment: '',
    dueAt: '',
    kind: 'submit',
    reminded: false,
    status: 'approved',
    step: 1,
    title: '提交申请',
  },
  {
    actedAt: '2026-11-13 10:05:00',
    approver: '周珂',
    comment: '预算内，同意',
    dueAt: '2026-11-14 09:20:00',
    kind: 'approval',
    reminded: false,
    status: 'current',
    step: 2,
    title: '直属上级审批',
  },
  {
    actedAt: '',
    approver: '陈默',
    comment: '',
    dueAt: '',
    kind: 'archive',
    reminded: false,
    status: 'pending',
    step: 3,
    title: '流程归档',
  },
];

describe('审批进度时间线', () => {
  it('展示每个节点的状态、处理人、时间与审批意见', () => {
    const wrapper = mount(ApprovalFlowTimeline, { props: { nodes } });
    const text = wrapper.text();
    expect(text).toContain('提交申请');
    expect(text).toContain('直属上级审批');
    expect(text).toContain('周珂');
    expect(text).toContain('2026-11-13 10:05:00');
    expect(text).toContain('预算内，同意');
    expect(wrapper.findAll('[data-node-status]')).toHaveLength(3);
    wrapper.unmount();
  });

  it('展示 AI 研判风险、建议与抄送对象', () => {
    const wrapper = mount(ApprovalFlowTimeline, {
      props: {
        assessment: {
          generatedAt: '2026-11-13 10:00:00',
          risk: 'high',
          source: 'mock-ai',
          suggestions: ['请核对预算与票据'],
          summary: '预研判为较高风险',
        },
        ccPersons: ['林晓'],
        nodes,
      },
    });
    expect(wrapper.get('[data-ai-assessment]').text()).toContain('较高风险');
    expect(wrapper.text()).toContain('请核对预算与票据');
    expect(wrapper.text()).toContain('抄送对象：林晓');
    wrapper.unmount();
  });
});
