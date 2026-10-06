 
// 一次性 codemod：mock/<模块>/index.ts（defineMock 键映射）→ mock/<模块>.fake.ts（插件原生 FakeRoute 数组）
// 运行后自删，不入库。
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, 'mock');
const OPEN = 'export default defineMock({';
const KEY_RE = /^  '(\[(\w+)\])?(\/[^']*)'\s*(.*)$/;
const RUNTIME_NAMES = [
  'MOCK_METHODS',
  'defineGeneratedMock',
  'envelope',
  'generatedFileOf',
  'keyOf',
  'mockFromTemplate',
  'splitKey',
  'withRuntime',
];
const TYPE_NAMES = [
  'GeneratedRouteDefinition',
  'MockContext',
  'MockEnvelope',
  'MockMethod',
  'RouteManifestItem',
];

const results = [];

function splitChunks(name, lines) {
  const chunks = [];
  let comments = [];

  const isClosed = (chunk) =>
    chunk.length > 1 &&
    /^ {2}\}(?:\))?,?$/.test(
      [...chunk].reverse().find((line) => line.trim() !== '') ?? '',
    );

  for (const line of lines) {
    if (KEY_RE.test(line)) {
      chunks.push({ body: [line], comments });
      comments = [];
      continue;
    }
    const current = chunks[chunks.length - 1];
    if (current && !isClosed(current.body)) {
      current.body.push(line);
      continue;
    }
    // 条目之间的空行与注释
    if (line.trim() === '') continue;
    if (/^ {2}\/\//.test(line)) comments.push(line);
    else throw new Error(`${name}: 条目外内容 ${JSON.stringify(line)}`);
  }

  if (chunks.length === 0) throw new Error(`${name}: 没有条目`);
  if (comments.length > 0)
    throw new Error(`${name}: 尾部悬空注释 ${comments.join(' ')}`);

  return chunks.map((chunk) => ({ ...chunk, body: trimBlanks(chunk.body) }));
}

function trimBlanks(lines) {
  const out = [...lines];
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

function renderRoute(name, { body, comments }) {
  const matched = body[0].match(KEY_RE);
  const method = (matched[2] ?? 'GET').toUpperCase();
  const url = matched[3];
  const rest = (matched[4] ?? '').trim();
  if (!rest) throw new Error(`${name}: ${url} 缺少处理器`);

  const shorthand = rest.startsWith('(');
  const handler = shorthand
    ? `response${rest}`
    : `response: ${rest.replace(/^:\s*/, '')}`;
  const inner = body.slice(1);

  const fields = [`      method: '${method}',`, `      url: '${url}',`];
  const leading = comments.map((line) => `      ${line.trim()}`);

  if (inner.length === 0) {
    // 单行写法：`'[POST]/x': () => ({ ... }),`
    return [
      '    {',
      ...leading,
      ...fields,
      `      ${handler.replace(/,$/, '')},`,
      '    },',
    ].join('\n');
  }

  const last = inner[inner.length - 1];
  if (!/^ {2}\S.*,?$/.test(last))
    throw new Error(`${name}: ${url} 收尾行缩进异常 ${JSON.stringify(last)}`);

  const body2 = inner
    .slice(0, -1)
    .map((line) => (line.trim() === '' ? '' : `    ${line}`));
  return [
    '    {',
    ...leading,
    ...fields,
    `      ${handler}`,
    ...body2,
    `      ${last.trim()}`,
    '    },',
  ].join('\n');
}

function transform(name, text) {
  const start = text.indexOf(OPEN);
  if (start === -1) throw new Error(`${name}: 未找到 ${OPEN}`);

  const head = text.slice(0, start);
  const afterOpen = text.slice(start + OPEN.length);
  const end = afterOpen.lastIndexOf('})');
  if (end === -1) throw new Error(`${name}: 未找到收尾 })`);
  const tail = afterOpen.slice(end + 2).trim();
  if (tail)
    throw new Error(
      `${name}: }) 之后还有内容，需手工处理：${tail.slice(0, 100)}`,
    );

  const lines = afterOpen.slice(0, end).split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const chunks = splitChunks(name, lines);
  const routes = chunks.map((chunk) => renderRoute(name, chunk));

  // 头部：剔除旧的 ../index 引入，把 import 归位排序，其余（faker.seed / 常量 / 辅助函数）留在 import 之后
  const keptLines = head
    .split('\n')
    .filter(
      (line) =>
        !/^import type \{[^}]*\} from '\.\.\/index'$/.test(line) &&
        !/^import \{[^}]*\} from '\.\.\/index'$/.test(line),
    );
  const { doc, imports, rest } = takeImports(keptLines);

  const already = new Set(
    imports.join('\n').match(/\b[A-Z][A-Za-z0-9_]*\b/g) ?? [],
  );
  const usedRuntime = RUNTIME_NAMES.filter(
    (n) =>
      n === 'withRuntime' ||
      new RegExp(`\\b${n}\\b`).test(keptLines.join('\n')) ||
      new RegExp(`\\b${n}\\b`).test(routes.join('\n')),
  );
  const usedTypes = TYPE_NAMES.filter(
    (n) =>
      !already.has(n) &&
      (new RegExp(`\\b${n}\\b`).test(keptLines.join('\n')) ||
        new RegExp(`\\b${n}\\b`).test(routes.join('\n'))),
  );

  const allImports = [
    ...imports,
    usedTypes.length
      ? `import type { ${usedTypes.sort().join(', ')} } from './_runtime'`
      : '',
    "import { defineFakeRoute } from 'vite-plugin-fake-server/client'",
    `import { ${usedRuntime.sort().join(', ')} } from './_runtime'`,
  ].filter(Boolean);

  const header = [
    doc,
    sortImports(dedupe(allImports)).join('\n'),
    rest.filter(Boolean).join('\n').trim(),
  ]
    .filter(Boolean)
    .join('\n\n');

  const out = [
    header,
    '',
    'export default defineFakeRoute(',
    '  withRuntime([',
    routes.join('\n'),
    '  ]),',
    ')',
    '',
  ].join('\n');

  return { count: routes.length, out };
}

/** 把头部拆成「文件注释 / import 单元 / 其余代码」，多行 import 归为一个单元 */
function takeImports(lines) {
  const doc = [];
  const imports = [];
  const rest = [];
  let buffer = null;

  for (const line of lines) {
    if (buffer !== null) {
      buffer.push(line);
      if (/ from '[^']+'$/.test(line)) {
        imports.push(buffer.join('\n'));
        buffer = null;
      }
      continue;
    }
    if (/^import\b/.test(line)) {
      if (/ from '[^']+'$/.test(line)) imports.push(line);
      else buffer = [line];
      continue;
    }
    if (imports.length === 0 && buffer === null) doc.push(line);
    else rest.push(line);
  }

  if (buffer !== null) throw new Error(`未闭合的 import：${buffer.join(' ')}`);
  return { doc: doc.join('\n').trim(), imports, rest };
}

function dedupe(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 规范顺序：类型引入 → 插件官方包 → 三方 → node 内置 → 相对路径 */
function sortImports(lines) {
  const specifier = (unit) => (unit.match(/from '([^']+)'\s*$/) ?? [])[1] ?? '';
  const rank = (unit) => {
    const spec = specifier(unit);
    if (/^import type\b/.test(unit)) return 0;
    if (spec.startsWith('vite-plugin-fake-server')) return 1;
    if (/^node:/.test(spec)) return 2;
    if (spec.startsWith('./') || spec.startsWith('../')) return 4;
    return 3;
  };
  return [...lines].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const mods = fs
  .readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== 'generated')
  .map((entry) => entry.name);

for (const mod of mods) {
  const file = path.join(ROOT, mod, 'index.ts');
  if (!fs.existsSync(file)) {
    console.log(`skip ${mod} (无 index.ts)`);
    continue;
  }
  try {
    const { count, out } = transform(mod, fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(path.join(ROOT, `${mod}.fake.ts`), out, 'utf8');
    results.push(`${mod}: ${count} 个接口`);
  } catch (error) {
    console.log(`FAIL ${mod}: ${error.message}`);
    results.push(`${mod}: FAIL ${error.message}`);
  }
}

console.log(results.join('\n'));
