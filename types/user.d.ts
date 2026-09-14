export interface UserInfo {
  userId: string;
  username: string;
  realname: string;
  avatar: string;
  email: string;
  phone: string;
  roles: string[];
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

export {};
