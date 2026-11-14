/**
 * 本包统一的可诊断错误。
 *
 * 分层位置：`core/*` 最底层，只依赖 TypeScript 运行时，不认识 vue / shadcn-ui / 网络。
 *
 * 为什么单独一个文件而不是每个模块各抛 `Error`：运行器、Provider、工具注册表、输出解析
 * 都会失败，而 UI 侧（运行面板、Inspector）唯一需要区分的就是「失败原因的类型」——
 * 有 `code` 才能把「没注入 fetcher」和「模型返回了坏 JSON」用不同话术说给不同的人听，
 * 而不是把一句 `undefined is not a function` 甩到用户脸上。
 *
 * 本文件不做的事：不定义错误码枚举常量表。码值是各模块的局部知识，集中成一份大枚举
 * 只会让新增错误的人先改一个与自己无关的文件。
 */
export class AiFlowError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly nodeId?: string;
  readonly runId?: string;

  constructor(
    message: string,
    code: string,
    details: {
      details?: Record<string, unknown>;
      nodeId?: string;
      runId?: string;
    } = {},
  ) {
    super(message);
    this.name = 'AiFlowError';
    this.code = code;
    this.nodeId = details.nodeId;
    this.runId = details.runId;
    this.details = details.details;
  }
}

/** 把任何被 catch 的东西收敛成可读文本；处理器抛非 Error 时日志里不该出现 `[object Object]` */
export function errorText(error: unknown): string {
  if (error instanceof AiFlowError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** 是不是「被取消」这一类中止：AbortController 在浏览器与 Node 下的报错名/形状都不一样 */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: string; name?: string };
  return (
    candidate.name === 'AbortError' || /abort/iu.test(candidate.message ?? '')
  );
}
