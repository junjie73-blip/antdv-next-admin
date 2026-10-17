import { notifySessionReset, onSessionReset } from '../src/session';

/**
 * 会话作废广播。
 *
 * 这条 seam 存在的唯一理由：页面缓存登记在布局层，而布局层要读 store ——
 * store 直接 import 布局层就是 stores → layouts → stores 的死循环。
 * 所以 store 只喊一嗓子"会话没了"，谁持有派生状态谁自己来登记。
 * 也就是说：**布局层漏登记不会报错，只会留下上一个账号的组件实例**，
 * 这类失效看不见，只能靠测试钉住广播本身。
 */
describe('onSessionReset / notifySessionReset', () => {
  it('广播会挨个调用登记中的回调', () => {
    const seen: string[] = [];
    const offA = onSessionReset(() => seen.push('a'));
    const offB = onSessionReset(() => seen.push('b'));

    notifySessionReset();
    expect(seen).toEqual(['a', 'b']);

    offA();
    offB();
  });

  it('注销之后不再收到广播', () => {
    const fn = vi.fn();
    const off = onSessionReset(fn);
    off();
    notifySessionReset();
    expect(fn).not.toHaveBeenCalled();
  });

  it('同一个回调重复登记只生效一次（Set 语义，组件重挂载不该清两遍）', () => {
    const fn = vi.fn();
    onSessionReset(fn);
    onSessionReset(fn);
    notifySessionReset();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('某个回调抛错不能拖垮其余回调', () => {
    const after = vi.fn();
    const off = onSessionReset(() => {
      throw new Error('清理失败');
    });
    onSessionReset(after);

    expect(() => notifySessionReset()).not.toThrow();
    expect(after).toHaveBeenCalled();
    off();
  });
});
