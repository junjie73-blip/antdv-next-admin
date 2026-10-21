import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';

import { alert as alertBox, confirm } from '../src/alert/confirm';

function dialogEl(): HTMLElement | null {
  return document.querySelector('[role="alertdialog"]');
}

function clickByText(text: string) {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.trim().includes(text),
  ) as HTMLElement | undefined;
  if (!btn) throw new Error(`未找到文本包含 "${text}" 的按钮`);
  btn.click();
}

async function settle() {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
}

describe('confirm()', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('渲染标题与内容', async () => {
    void confirm({ title: '删除确认', content: '确定要删除该行吗？' });
    await settle();
    expect(dialogEl()).not.toBeNull();
    expect(dialogEl()!.textContent).toContain('删除确认');
    expect(dialogEl()!.textContent).toContain('确定要删除该行吗？');
  });

  it('点击确认：onOk 执行后 resolve(true) 并卸载', async () => {
    const onOk = vi.fn(async () => {});
    const promise = confirm({ title: '操作', onOk });
    await settle();

    clickByText('确认');
    await settle();
    await expect(promise).resolves.toBe(true);
    expect(onOk).toHaveBeenCalledOnce();
    expect(dialogEl()).toBeNull();
  });

  it('点击取消：onCancel 执行且 resolve(false)', async () => {
    const onCancel = vi.fn();
    const promise = confirm({ title: '操作', onCancel });
    await settle();

    clickByText('取消');
    await settle();
    await expect(promise).resolves.toBe(false);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(dialogEl()).toBeNull();
  });

  it('onOk 抛错时不 resolve、弹层保持打开；随后取消得到 false', async () => {
    const onOk = vi.fn(async () => {
      throw new Error('接口失败');
    });
    const promise = confirm({ title: '异步失败', onOk });
    await settle();

    clickByText('确认');
    await settle();

    let settled = false;
    void promise.then(() => (settled = true));
    await settle();
    expect(settled).toBe(false);
    expect(dialogEl()).not.toBeNull();

    clickByText('取消');
    await expect(promise).resolves.toBe(false);
  });

  it('danger 样式使用 destructive 按钮', async () => {
    void confirm({ title: '危险', danger: true });
    await settle();
    const okBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('确认'),
    );
    expect(okBtn!.className).toContain('destructive');
  });

  it('async onOk 期间 update:open(false) 竞态不会抢先 resolve(false)', async () => {
    let resolveOk: () => void = () => {};
    const promise = confirm({
      title: '竞态',
      onOk: () => new Promise<void>((r) => (resolveOk = r)),
    });
    await settle();

    clickByText('确认');
    await settle();
    let done = false;
    void promise.then(() => (done = true));
    await settle();
    expect(done).toBe(false);

    resolveOk();
    await expect(promise).resolves.toBe(true);
  });
});

describe('alert()', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('无取消按钮，默认文案“知道了”', async () => {
    void alertBox({ title: '提示', content: '仅通知' });
    await settle();
    expect(dialogEl()).not.toBeNull();
    const buttons = [...document.querySelectorAll('button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(buttons.some((t) => t?.includes('取消'))).toBe(false);
    expect(buttons.some((t) => t?.includes('知道了'))).toBe(true);
  });

  it('type=error 时确认按钮为 destructive', async () => {
    void alertBox({ title: '错误', type: 'error' });
    await settle();
    const okBtn = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('知道了'),
    );
    expect(okBtn!.className).toContain('destructive');
  });
});
