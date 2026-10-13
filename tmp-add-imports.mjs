import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const ROOT = 'apps/web/src';
const DTS = 'apps/web/node_modules/antdv-next/dist/index.d.ts';

// antdv-next 的真实具名导出（去掉 type-only 与被重命名的内部名）
const exported = new Set();
for (const m of readFileSync(DTS, 'utf8').matchAll(/(?:^|\n)export \{([^}]*)\}/g)) {
  for (const spec of m[1].split(',')) {
    const s = spec.trim();
    if (!s || s.startsWith('type ')) continue;
    const parts = s.split(/\s+as\s+/);
    exported.add((parts.length > 1 ? parts[1] : parts[0]).trim());
  }
}

const pascal = (s) =>
  s
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

// 标签后缀 Pascal 化以后与导出名对不上的少数例外（antdv-next 用内部名再导出）
const FIXUP = {
  Textarea: 'TextArea',
};

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.vue')) files.push(p);
  }
};
walk(ROOT);

const stripComments = (txt) =>
  txt.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

let changed = 0;
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  const body = stripComments(txt);

  const imported = new Set();
  for (const m of body.matchAll(/import([^;]*?)from\s+'antdv-next'/g)) {
    for (const spec of m[1].replace(/[{}]/g, ' ').split(',')) {
      const parts = spec.trim().split(/\s+as\s+/);
      if (parts.length > 1) imported.add(parts[1].trim());
      else if (parts[0]) imported.add(parts[0].trim());
    }
  }

  const need = new Map();
  const tags = new Set();
  for (const m of body.matchAll(/<(a-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)[\s/>]/g)) {
    tags.add(m[1]);
  }
  for (const m of body.matchAll(/<(A[A-Z][A-Za-z0-9]*)[\s/>]/g)) tags.add(m[1]);

  for (const tag of tags) {
    const binding = tag.startsWith('a-') ? `A${pascal(tag.slice(2))}` : tag;
    if (imported.has(binding)) continue;
    let name = tag.startsWith('a-') ? pascal(tag.slice(2)) : binding.slice(1);
    if (FIXUP[name]) name = FIXUP[name];
    if (!exported.has(name)) {
      console.log(`!! ${f}: <${tag}> 猜不出导出名（试过 ${name}）`);
      continue;
    }
    need.set(binding, name);
  }
  if (need.size === 0) continue;

  const specs = [...need]
    .map(([b, n]) => (b === n ? n : `${n} as ${b}`))
    .sort((a, b) => a.localeCompare(b));

  let out;
  const existing = /import\s*\{([^}]*)\}\s*from\s*'antdv-next';/s.exec(txt);
  if (existing) {
    const cur = existing[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...new Set([...cur, ...specs])].sort((a, b) =>
      a.localeCompare(b),
    );
    out =
      txt.slice(0, existing.index) +
      `import { ${merged.join(', ')} } from 'antdv-next';` +
      txt.slice(existing.index + existing[0].length);
  } else {
    // 挂在最后一个 import 后面，顺序交给 eslint --fix 归位
    const last = [...txt.matchAll(/^import .*$/gm)].pop();
    const at = last.index + last[0].length;
    out = `${txt.slice(0, at)}\nimport { ${specs.join(', ')} } from 'antdv-next';${txt.slice(at)}`;
  }
  changed += 1;
  console.log(`${f}: +${specs.join(', ')}`);
  if (WRITE) writeFileSync(f, out, 'utf8');
}
console.log('files to change:', changed);
if (WRITE) {
  execFileSync('npx', ['eslint', '--fix', ...files], { stdio: 'inherit' });
}
