/**
 * 创建一个可清理的超时 signal
 * 相比 AbortSignal.timeout()，兼容性更好，且能手动清理定时器
 */
export function createTimeoutSignal(ms: number): {
  signal: AbortSignal;
  clear: () => void;
  didTimeout: () => boolean;
} {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException('请求超时', 'TimeoutError'));
  }, ms);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
    didTimeout: () => timedOut,
  };
}

/**
 * 组合多个 signal（不依赖 AbortSignal.any，兼容性更好）
 */
export function combineSignals(signals: (AbortSignal | undefined)[]): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const valid = signals.filter(Boolean) as AbortSignal[];
  if (valid.length === 0) {
    return { signal: new AbortController().signal, cleanup: () => {} };
  }
  if (valid.length === 1) {
    return { signal: valid[0], cleanup: () => {} };
  }

  const controller = new AbortController();
  const handlers: Array<() => void> = [];

  for (const s of valid) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    const handler = () => controller.abort(s.reason);
    s.addEventListener('abort', handler, { once: true });
    handlers.push(() => s.removeEventListener('abort', handler));
  }

  return {
    signal: controller.signal,
    cleanup: () => handlers.forEach((fn) => fn()),
  };
}
