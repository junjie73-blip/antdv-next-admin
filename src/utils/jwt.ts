/**
 * JWT 工具（仅用于前端解析 payload，不验证签名）
 *
 * ⚠️ 安全提醒：
 *  - 前端无法验证签名，不要依赖前端判断 token 是否被篡改
 *  - 真正的验证由后端在每个请求里做
 *  - 前端只用 payload 里的 exp 做"提前刷新"的优化
 */

export interface JwtPayload {
  /** 过期时间（Unix 秒） */
  exp?: number;
  /** 签发时间（Unix 秒） */
  iat?: number;
  /** 生效时间（Unix 秒） */
  nbf?: number;
  /** 签发者 */
  iss?: string;
  /** 受众 */
  aud?: string | string[];
  /** 业务字段 */
  userId?: string;
  tenantId?: string;
  username?: string;
  type?: string;
  [key: string]: unknown;
}

/* ============================================================
 * Base64URL 解码
 * ============================================================
 * JWT 用 base64url 编码（把 + / 换成 - _，去掉 = 补齐）
 */

function base64UrlToBase64(input: string): string {
  let output = input.replace(/-/g, "+").replace(/_/g, "/");
  // 补齐 = 让长度是 4 的倍数
  while (output.length % 4 !== 0) {
    output += "=";
  }
  return output;
}

/** UTF-8 安全的 atob */
function base64Decode(input: string): string {
  const binary = atob(base64UrlToBase64(input));
  // 转成 UTF-8 字符串（防止中文乱码）
  try {
    return decodeURIComponent(
      binary
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    return binary;
  }
}

/* ============================================================
 * 解析
 * ============================================================ */

/**
 * 解析 JWT payload（不验证签名）
 *
 * @param token JWT 字符串
 * @returns payload 对象，解析失败返回 null
 */
export function parseJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    // 标准 JWT 是 3 段
    if (parts.length !== 3) return null;

    const payloadJson = base64Decode(parts[1]!);
    const payload = JSON.parse(payloadJson) as JwtPayload;

    // 基础校验：必须是对象
    if (typeof payload !== "object" || payload === null) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * 判断 token 是否过期或即将过期
 *
 * @param token JWT
 * @param offsetSeconds 提前量（秒），默认 60
 * @returns true = 已过期 / 快过期 / 无法解析
 */
export function isTokenExpired(token: string | null | undefined, offsetSeconds = 60): boolean {
  if (!token) return true;

  const payload = parseJwt(token);
  if (!payload) {
    // 不是标准 JWT（比如 opaque token），交给后端判断
    return false;
  }

  if (typeof payload.exp !== "number") {
    // 没有 exp，视为长期有效
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp - now <= offsetSeconds;
}

/**
 * 剩余有效秒数
 */
export function getTokenRemainingSeconds(token: string | null | undefined): number {
  if (!token) return 0;

  const payload = parseJwt(token);
  if (!payload || typeof payload.exp !== "number") {
    return Number.POSITIVE_INFINITY;
  }

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}

/**
 * 判断是否为 JWT 格式
 */
export function isJwtFormat(token: string | null | undefined): boolean {
  if (!token) return false;
  return token.split(".").length === 3;
}
