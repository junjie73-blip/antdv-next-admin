import type { ResolvedConfig } from 'vite';

import type { AppLoadingOptions } from './types';

export function injectLoadingHtml(
  html: string,
  loadingHtml: string,
  options: Required<AppLoadingOptions>,
): string {
  const { injectPosition, containerSelector } = options;

  // 防止重复注入
  if (html.includes(containerSelector.replace('#', ''))) {
    return html;
  }

  switch (injectPosition) {
    case 'body-prepend': {
      return html.replace(/<body([^>]*)>/i, `<body$1>\n${loadingHtml}`);
    }
    case 'body-append': {
      return html.replace(/<\/body>/i, `${loadingHtml}\n</body>`);
    }
    case 'head-prepend': {
      return html.replace(/<head([^>]*)>/i, `<head$1>\n${loadingHtml}`);
    }
    case 'head-append': {
      return html.replace(/<\/head>/i, `${loadingHtml}\n</head>`);
    }
    default: {
      return html.replace(/<body([^>]*)>/i, `<body$1>\n${loadingHtml}`);
    }
  }
}

export function resolveLoadingHtml(
  html: string,
  config: ResolvedConfig,
  extraVars: Record<string, string> = {},
): string {
  const vars: Record<string, string> = {
    ...extractViteEnv(config),
    ...extraVars,
  };

  // EJS 风格：<%= VAR %> / <%= VAR || 'default' %>
  html = html.replaceAll(
    /<%=\s*([\w.-]+)(?:\s*\|\|\s*(['"])(.*?)\2)?\s*%>/g,
    (_m, name, _q, fallback) => vars[name] ?? fallback ?? '',
  );

  // Vite 原生语法：%VAR%
  // ⚠️ 保留未识别的 %VAR%，交由 Vite 后续处理
  html = html.replaceAll(/%([\w.-]+)%/g, (_m, name) => vars[name] ?? _m);

  return html;
}

function extractViteEnv(config: ResolvedConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.env ?? {})) {
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}
