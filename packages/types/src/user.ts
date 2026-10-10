/**
 * 登录用户信息。
 *
 * 字段以后端 `/auth/login` 实际返回的为准（`id / nickname / role...`），
 * 早期声明的 `userId / realname` 全仓库没有消费者，属于类型跑在契约前面，
 * 应用侧只能靠 `as` 或局部重复声明绕开它 —— 这里把它拉回现实。
 */
export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  phone: string;
  roles: string[];
  permissions?: string[];
}

export interface LoginParams {
  username: string;
  password: string;
  captcha?: string;
  uuid?: string;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  token?: string;
}

export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  code?: string;
}
