/**
 * Vercel 静态站点的 /api 反向代理。
 *
 * 前端生产环境 `VITE_APP_BASE_API=/api`，但静态托管本身没有后端：直连会拿到 404/JSON null，
 * 登录页因此报 "Cannot read properties of null (reading 'code')"。
 *
 * 使用方式：在 Vercel 项目 Environment Variables 配置 `API_UPSTREAM_URL` 为 Nitro mock 服务的
 * origin（例如 `https://mock.example.com`，不要带 /api 后缀）。本函数把 `/api/auth/login`
 * 原样转发到 `${API_UPSTREAM_URL}/api/auth/login`，浏览器侧仍是同源请求。
 * 未配置时返回明确的 503 信封，前端会展示可读错误而不是前端异常。
 */

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function json(res: any, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  const upstream = process.env.API_UPSTREAM_URL?.replace(/\/$/, '');
  if (!upstream) {
    json(res, 503, {
      code: 503,
      message: '未配置 API_UPSTREAM_URL，登录服务不可用',
    });
    return;
  }

  const rawPath = req.query?.path;
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const queryIndex = (req.url ?? '').indexOf('?');
  const search = queryIndex === -1 ? '' : (req.url ?? '').slice(queryIndex);
  const target = `${upstream}/api/${segments.join('/')}${search}`;

  try {
    const method = (req.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers ?? {})) {
      if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
      if (typeof value === 'string') headers[key] = value;
      else if (Array.isArray(value)) headers[key] = value.join(',');
    }

    // Node 的 fetch/undici 接受 Buffer；TS 的 DOM BodyInit 不认 Buffer，显式收口类型。
    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : ((await readBody(req)) as unknown as BodyInit);
    const upstreamResponse = await fetch(target, { method, headers, body });

    res.statusCode = upstreamResponse.status;
    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
    });
    res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
  } catch (error) {
    json(res, 502, {
      code: 502,
      message: `API 上游不可用：${error instanceof Error ? error.message : '未知错误'}`,
    });
  }
}
