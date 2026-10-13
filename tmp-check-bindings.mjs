import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = 'apps/web/src';
const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.vue')) files.push(p);
  }
};
walk(root);

const pascal = (s) => s.replace(/(^|[-])(\w)/g, (_, _d, c) => c.toUpperCase());
const stripComments = (txt) =>
  txt.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const report = new Map();
for (const f of files) {
  const txt = stripComments(readFileSync(f, 'utf8'));
  const tags = new Set();
  for (const m of txt.matchAll(/<(a-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)[\s/>]/g)) {
    tags.add(m[1]);
  }
  // 也算 Pascal 形式 <ACard>
  for (const m of txt.matchAll(/<(A[A-Z][A-Za-z0-9]*)[\s/>]/g)) {
    tags.add(m[1]);
  }
  if (tags.size === 0) continue;
  const declared = new Set();
  // import { X as AY, Z } from 'antdv-next' —— 以及任何 script 里的顶层绑定名
  for (const m of txt.matchAll(/import([^;]*?)from\s+'antdv-next'/g)) {
    for (const spec of m[1].replace(/[{}]/g, ' ').split(',')) {
      const parts = spec.trim().split(/\s+as\s+/);
      if (parts.length === 2) declared.add(parts[1].trim());
      else if (parts[0]) declared.add(parts[0].trim());
    }
  }
  for (const m of txt.matchAll(/\bconst\s+([A-Z]\w*)\s*=/g)) declared.add(m[1]);
  const missing = [];
  for (const tag of tags) {
    const binding = tag.startsWith('a-') ? pascal(tag.slice(2)) : tag;
    const pascalTag = tag.startsWith('a-') ? binding : tag;
    // 模板里 <a-card> 需要绑定 ACard；<ACard> 需要绑定 ACard
    if (!declared.has(pascalTag)) missing.push(`${tag} -> ${pascalTag}`);
  }
  if (missing.length) report.set(f, missing);
}
for (const [f, missing] of report) {
  console.log(f, '|', missing.join(', '));
}
console.log('files:', report.size);
