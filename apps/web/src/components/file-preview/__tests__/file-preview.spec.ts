import { flushPromises, mount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import FilePreview from '../FilePreview.vue';

function file(name: string, content: string, type = 'text/plain'): File {
  return new File([content], name, { type });
}

async function render(source: File) {
  const wrapper = mount(FilePreview, {
    props: { source },
    attachTo: document.body,
  });
  await flushPromises();
  // FileReader 是宏任务，flushPromises 只冲微任务；等加载态消失再断言
  await vi.waitFor(() => expect(wrapper.text()).not.toContain('正在解析'), {
    timeout: 2000,
  });
  return wrapper;
}

describe('通用文件预览', () => {
  it('图片用原生 img 展示，并创建 Object URL', async () => {
    const wrapper = await render(file('photo.png', 'binary', 'image/png'));
    const img = wrapper.get('img');
    expect(img.attributes('src')).toMatch(/^blob:/u);
    expect(wrapper.attributes('data-preview-kind')).toBe('image');
    wrapper.unmount();
  });

  it('markdown 解析成 HTML，原始 script 标签被转义', async () => {
    const wrapper = await render(
      file('note.md', '# 标题\n\n<script>alert(1)</script>\n\n- 项目一'),
    );
    expect(wrapper.get('h1').text()).toBe('标题');
    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.text()).toContain('<script>');
    wrapper.unmount();
  });

  it('cSV 首行作表头，数据行逐格渲染', async () => {
    const wrapper = await render(
      file('rows.csv', 'name,value\n甲,1\n"乙,丙",2'),
    );
    const headers = wrapper.findAll('th');
    expect(headers.map((node) => node.text())).toEqual(['name', 'value']);
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.findAll('tbody tr')[1]?.findAll('td')[0]?.text()).toBe(
      '乙,丙',
    );
    wrapper.unmount();
  });

  it('旧版 doc/ppt 提取可读文本并说明格式损失', async () => {
    const wrapper = await render(
      file('legacy.doc', '会议纪要：下周一开始提交周报', 'application/msword'),
    );
    expect(wrapper.text()).toContain('仅提取可读文本');
    expect(wrapper.text()).toContain('会议纪要');
    expect(wrapper.attributes('data-preview-kind')).toBe('legacy');
    wrapper.unmount();
  });

  it('完全未知的格式给出明确提示，不白屏', async () => {
    const wrapper = await render(file('mystery.bin', 'binary'));
    expect(wrapper.text()).toContain('BIN 暂不支持在线预览');
    expect(wrapper.attributes('data-preview-kind')).toBe('unsupported');
    wrapper.unmount();
  });
});
