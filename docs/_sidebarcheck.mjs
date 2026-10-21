import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const cfg = readFileSync(path.join(root, '.vitepress/config.mts'), 'utf8');
const links = [
  ...cfg.matchAll(/link: '(\/(?:guide|components|en|zh)\/[^']*)'/g),
].map((m) => m[1]);
const missing = [];
for (const l of links) {
  const rel = l.replace(/^\//, '').replace(/\/$/, '/index');
  const ok =
    existsSync(path.join(root, `${rel}.md`)) ||
    existsSync(path.join(root, rel, 'index.md'));
  if (!ok) missing.push(l);
}
console.log(
  `sidebar/nav links: ${links.length}, missing files: ${missing.length}`,
);
for (const m of missing) console.log(`  ${m}`);
