// 生成物，请勿手改 —— 数据在 `./fixtures.json`，由 `scripts/generate-mock-fixtures.mjs` 产出。
// 重新生成：mock 接口有增删或响应结构变化时，先起 Nitro mock（`pnpm --filter @antdv/backend-mock dev`），
// 再跑 `pnpm mock:fixtures`。
import type { FixtureSet } from './types';

import snapshot from './fixtures.json';

// JSON 里推不出 `method` 的字面量联合，也没法表达 `response: unknown`，整体断言一次
export const fixtures = snapshot as unknown as FixtureSet;
