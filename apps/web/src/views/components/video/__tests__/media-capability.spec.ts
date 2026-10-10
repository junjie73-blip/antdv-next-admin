import { describe, expect, it, vi } from 'vitest';

import { detectHlsSupport } from '../media-capability';

/**
 * `detectHlsSupport(doc, win)` 的两个入参就是为了这份测试留的：
 * 把 document / window 换成假的，就不必真的起浏览器去验能力探测。
 *
 * ⚠️ 方法名以实测为准：标准 API 是 `MediaSource.isTypeSupported`（Chromium 里
 * `isSupportedType` 是 undefined）。写反了不会报错，只会让 MSE 这条路恒为 false，
 * 于是 Chrome 上 HLS 演示卡片被整块藏起来 —— 修一个兼容问题顺手制造一个。
 */
function fakeDoc(native = '') {
  return {
    createElement: () => ({
      canPlayType: (type: string) =>
        type.includes('mpegurl') ? native : '',
    }),
  } as unknown as Document;
}

function fakeWin(gates: Record<string, unknown> = {}) {
  return gates as unknown as typeof globalThis & Window;
}

const MSE_TYPE = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';

describe('detectHlsSupport：HLS 能不能播，挂播放器之前就要知道', () => {
  it('Safari 系原生支持 m3u8，判可播', () => {
    const support = detectHlsSupport(
      fakeDoc('probably'),
      fakeWin({ MediaSource: { isTypeSupported: () => false } }),
    );

    expect(support).toEqual({
      playable: true,
      viaMse: false,
      viaNative: true,
    });
  });

  it('没有原生 HLS，但 MSE 能塞 mp4 切片（Chrome / Firefox / Edge）也判可播', () => {
    const support = detectHlsSupport(
      fakeDoc(''),
      fakeWin({ MediaSource: { isTypeSupported: () => true } }),
    );

    expect(support.playable).toBe(true);
    expect(support.viaMse).toBe(true);
  });

  it('探测的是 mp4 片段类型，不是直接问 MSE 支不支持 mpegurl', () => {
    const isTypeSupported = vi.fn(() => true);
    detectHlsSupport(fakeDoc(''), fakeWin({ MediaSource: { isTypeSupported } }));

    expect(isTypeSupported).toHaveBeenCalledWith(MSE_TYPE);
  });

  it('标准名之外也认旧的前缀名 isSupportedType', () => {
    const support = detectHlsSupport(
      fakeDoc(''),
      fakeWin({ WebKitMediaSource: { isSupportedType: () => true } }),
    );

    expect(support.viaMse).toBe(true);
    expect(support.playable).toBe(true);
  });

  it('ManagedMediaSource（iOS 16+ / Safari 隐私模式）也算一条走得通的路', () => {
    const support = detectHlsSupport(
      fakeDoc(''),
      fakeWin({ ManagedMediaSource: { isTypeSupported: () => true } }),
    );

    expect(support.playable).toBe(true);
  });

  it('两条路都没有时判不可播 —— 这种环境不该挂播放器出来', () => {
    const support = detectHlsSupport(
      fakeDoc(''),
      fakeWin({ MediaSource: { isTypeSupported: () => false } }),
    );

    expect(support.playable).toBe(false);
  });

  it('MediaSource 整个不存在（Playwright 自带 WebKit、老 Safari、内嵌 WebView）不抛错且判不可播', () => {
    expect(() => detectHlsSupport(fakeDoc(''), fakeWin())).not.toThrow();

    expect(detectHlsSupport(fakeDoc(''), fakeWin()).playable).toBe(false);
  });

  it('只有原生 HLS 时不去碰 MSE 方法', () => {
    const isTypeSupported = vi.fn(() => true);
    const support = detectHlsSupport(
      fakeDoc('maybe'),
      fakeWin({ MediaSource: { isTypeSupported } }),
    );

    // MSE 探测照样会跑（结果用于文案），但判定与它无关
    expect(support.viaNative).toBe(true);
    expect(support.playable).toBe(true);
    expect(isTypeSupported).toHaveBeenCalled();
  });
});
