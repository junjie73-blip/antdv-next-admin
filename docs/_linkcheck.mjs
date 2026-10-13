import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.md')) files.push(p);
  }
};
/**
 * 四棵树一起查：`locales.root` 的中文正文在 `guide/` 与 `components/`（站内链接写成
 * `/guide/...`、`/components/...`），英文在 `en/` 下，`zh/` 是中文正文的同步副本
 * （链接改写成 `/zh/guide/...`）。加新页面时三边都要有对应文件，否则这里会报缺目标。
 */
walk(path.join(root, 'guide'));
walk(path.join(root, 'components'));
walk(path.join(root, 'en'));
walk(path.join(root, 'zh'));

const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const targets = new Set();
for (const f of files) {
  const noExt = rel(f).replace(/\.md$/, '');
  targets.add(`/${noExt}`);
  if (noExt.endsWith('/index')) targets.add(`/${noExt.slice(0, -6)}/`);
}

const missing = new Map();
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  for (const m of txt.matchAll(
    /\]\((\/(?:guide|components|en|zh)\/[^)\s#]*)(?:#[^)\s]*)?\)/g,
  )) {
    const t = m[1];
    const ok =
      targets.has(t) ||
      targets.has(`${t}/index`) ||
      targets.has(t.replace(/\/$/, '/index'));
    if (!ok) {
      if (!missing.has(t)) missing.set(t, []);
      missing.get(t).push(rel(f));
    }
  }
}
const entries = [...missing].sort(([a], [b]) => a.localeCompare(b));
for (const [t, src] of entries) console.log(`${t}  <- ${src.join(', ')}`);
console.log(
  `total missing targets: ${entries.length}, files scanned: ${files.length}`,
);
