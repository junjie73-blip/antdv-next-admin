import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENTS = join(process.cwd(), 'src/components');

/** 公共组件按目录组织：每个组件一个目录 + index.ts 收口，避免 loose vue 文件散落 */
describe('common-ui 目录结构', () => {
  const entries = readdirSync(COMPONENTS);

  it('components 下只有组件目录', () => {
    const loose = entries.filter(
      (name) => !statSync(join(COMPONENTS, name)).isDirectory(),
    );
    expect(loose, '应移入同名目录').toEqual([]);
  });

  it('每个组件目录都有 index.ts 出口', () => {
    const missing = entries.filter((name) => {
      const files = readdirSync(join(COMPONENTS, name));
      return !files.includes('index.ts');
    });
    expect(missing).toEqual([]);
  });
});
