// 生成物，请勿手改 —— 数据在 `./fixtures.json`，由 `pnpm mock:fixtures` 产出。
// 重新生成：mock 接口有增删或响应结构变化时跑一次即可，脚本会自己起 Nitro，不需要先开服务。
import type { FixtureSet } from './types';

import snapshot from './fixtures.json';

// JSON 里推不出 `method` 的字面量联合，也没法表达 `response: unknown`，整体断言一次
export const fixtures = snapshot as unknown as FixtureSet;
