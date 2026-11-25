import { success } from '../../../utils/response';
import { defineMockRoute } from '../../../utils/runtime';

/**
 * legacy 里 GET /system/user/options 被 role.fake.ts 与 user.fake.ts 重复注册，
 * fake-server 首个命中生效（role 文件按字母序先加载），所以生效响应是 role 的静态名单；
 * user.fake.ts 的同名注册在清单里记为 duplicates（见 server/utils/registry.ts）。
 */
export default defineMockRoute({
  handler: () =>
    success(
      [
        { label: '张三', value: 101 },
        { label: '李四', value: 102 },
        { label: '王五', value: 103 },
        { label: '赵六', value: 104 },
        { label: '孙七', value: 105 },
        { label: '周八', value: 106 },
        { label: '吴九', value: 107 },
        { label: '郑十', value: 108 },
      ],
      '获取用户选项成功',
    ),
  method: 'GET',
  module: 'system/role',
  path: '/system/user/options',
});
