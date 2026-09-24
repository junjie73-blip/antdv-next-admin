import type { MockContext } from "../index";
import { defineMock } from "../index";

export default defineMock({
  "[POST]/auth/logout"() {
    return {
      code: 200,
      data: null,
      message: "退出成功",
    };
  },
  "[GET]/auth/login"() {
    return {
      code: 200,
      data: {
        token: "123456",
        username: "admin",
        nickname: "管理员",
        avatar: "https://antdv.com/images/avatar.png",
        email: "admin@example.com",
        phone: "13800000000",
        roles: ["admin"],
        permissions: ["*"],
      },
      message: "登录成功",
    };
  },
  "[GET]/auth/user-info"() {
    return {
      code: 200,
      data: {
        user: {
          id: "1",
          username: "admin",
          role: "admin",
          permissions: ["*"],
          roles: ["admin"],
        },
      },
      message: "获取用户信息成功",
    };
  },
});
