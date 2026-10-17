import type { UserInfo } from '@antdv/types';

import { createPinia, setActivePinia } from 'pinia';
import { useUserStore } from '@antdv/stores';

import { usePermission } from '../usePermission';

/**
 * 权限判定的三条口径：未登录一律否、`'*'` 全通、其余按字面量比对。
 *
 * `'*'` 通配是 mock 里 admin 账号唯一的权限来源（后端逐条列举 40 多个页面不现实），
 * 判定层不认它的话，admin 按钮级权限会全线消失，而菜单层看着一切正常 ——
 * 这类"只在一层生效"的错配最难从 UI 上发现。
 */

function seed(input: { permissions: string[]; roles: string[] }) {
  setActivePinia(createPinia());
  const user = useUserStore();
  user.token = 'a-token';
  user.userInfo = {
    avatar: '',
    email: '',
    id: 1,
    nickname: '测试',
    permissions: input.permissions,
    phone: '',
    roles: input.roles,
    username: 'tester',
  } as unknown as UserInfo;
  return user;
}

describe('usePermission', () => {
  it('未登录时任何判定都是 false，哪怕权限列表是全通', () => {
    setActivePinia(createPinia());
    const permission = usePermission();

    expect(permission.hasPermission('system:user:list')).toBe(false);
    expect(permission.hasRole('admin')).toBe(false);
    expect(permission.isAdmin()).toBe(false);

    seed({ permissions: ['*'], roles: ['admin'] });
    expect(usePermission().hasPermission('system:user:list')).toBe(true);
  });

  it("`'*'` 让任何权限要求都成立", () => {
    seed({ permissions: ['*'], roles: ['custom'] });
    const permission = usePermission();

    expect(permission.hasPermission('anything:at:all')).toBe(true);
    expect(permission.hasAnyPermission(['a', 'b'])).toBe(true);
    expect(permission.hasAllPermissions(['a', 'b', 'c'])).toBe(true);
    expect(permission.checkPermission(['a', 'b'], { mode: 'all' })).toBe(true);
  });

  it("`'*'` 对角色同样成立", () => {
    seed({ permissions: [], roles: ['*'] });
    expect(usePermission().hasAllRoles(['admin', 'ops'])).toBe(true);
  });

  it('没有通配时按字面量比对：some 命中其一、every 必须全中', () => {
    seed({
      permissions: ['system:user:list', 'system:user:query'],
      roles: ['custom'],
    });
    const permission = usePermission();

    expect(permission.hasPermission('system:user:list')).toBe(true);
    expect(permission.hasPermission('system:user:remove')).toBe(false);
    expect(
      permission.hasAnyPermission(['system:user:remove', 'system:user:query']),
    ).toBe(true);
    expect(
      permission.hasAllPermissions(['system:user:list', 'system:user:remove']),
    ).toBe(false);
    expect(
      permission.hasAllPermissions(['system:user:list', 'system:user:query']),
    ).toBe(true);
    expect(
      permission.checkPermission(['system:user:remove'], { mode: 'any' }),
    ).toBe(false);
  });

  it('权限列表为空：默认严格判否，`strict: false` 时放行', () => {
    seed({ permissions: [], roles: [] });

    expect(usePermission().hasPermission('system:user:list')).toBe(false);
    expect(
      usePermission({ strict: false }).hasPermission('system:user:list'),
    ).toBe(true);
  });

  it('isAdmin 只认 super / admin 两个角色', () => {
    seed({ permissions: [], roles: ['admin'] });
    expect(usePermission().isAdmin()).toBe(true);

    seed({ permissions: [], roles: ['super'] });
    expect(usePermission().isAdmin()).toBe(true);

    seed({ permissions: ['*'], roles: ['custom'] });
    expect(usePermission().isAdmin()).toBe(false);
  });
});
