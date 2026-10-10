/**
 * 浏览器播放能力探测。
 *
 * 演示页挂播放器之前先问一句"这台环境到底放不放得出来"：放不出来还挂个黑框，
 * 用户看到的就是"点了没反应"，而我们收到的反馈只会是"这个视频组件坏了"。
 *
 * 单独成文件是为了能测 —— 判定全是能力探测，不需要真的把视频拉下来。
 */

/** 能被 video.js 判成"不支持"的常见原因，页面按这个给不同的解释文案 */
export type HlsSupport = {
  /** 需要 MSE 拼接（Chrome / Firefox / Edge，以及装了 http-streaming 的场景） */
  viaMse: boolean;
  /** Safari 系原生支持 m3u8 */
  viaNative: boolean;
  /** 两条路都没有，挂上去必然报错，不该挂 */
  playable: boolean;
};

/**
 * HLS 切片最终会被 @videojs/http-streaming 拼成 fMP4 喂给 MSE，
 * 所以探测的是"能不能塞 mp4 片段"，而不是问 MSE 支不支持 mpegurl。
 */
const HLS_MSE_TYPE = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';

type TypeGate = {
  /** 标准名：`MediaSource.isTypeSupported` */
  isTypeSupported?: (type: string) => boolean;
  /** 带前缀的旧名：`WebKitMediaSource.isSupportedType` */
  isSupportedType?: (type: string) => boolean;
};

function mseSupports(type: string, win: typeof globalThis & Window) {
  const candidates: Array<unknown> = [
    (win as unknown as { MediaSource?: TypeGate }).MediaSource,
    // 旧 WebKit 前缀实现，属性名不一样（isSupportedType 而非 isTypeSupported）
    (win as unknown as { WebKitMediaSource?: TypeGate }).WebKitMediaSource,
    (win as unknown as { ManagedMediaSource?: TypeGate }).ManagedMediaSource,
  ];

  return candidates.some((gate) => {
    if (typeof gate !== 'function' && typeof gate !== 'object') return false;
    const source = gate as TypeGate;
    if (typeof source.isTypeSupported === 'function') {
      return Boolean(source.isTypeSupported(type));
    }
    if (typeof source.isSupportedType === 'function') {
      return Boolean(source.isSupportedType(type));
    }
    return false;
  });
}

export function detectHlsSupport(
  doc: Document = document,
  win: typeof globalThis & Window = window,
): HlsSupport {
  const viaNative = Boolean(
    doc.createElement('video').canPlayType('application/vnd.apple.mpegurl'),
  );

  // 老 Safari / 隐私模式 / 部分内嵌 WebView、以及 Playwright 自带的 WebKit 构建里
  // MediaSource 整个不存在，所以先判存在再取方法。
  const viaMse = mseSupports(HLS_MSE_TYPE, win);

  return { playable: viaNative || viaMse, viaMse, viaNative };
}
