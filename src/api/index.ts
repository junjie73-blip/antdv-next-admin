import { get, post } from "@/api/request";
import { http } from "@/utils";

interface LoginParams {
  username: string;
  password: string;
}

interface LoginResponse {
  user: {
    id: string;
    username: string;
    token: string;
    role: string;
    permissions: string[];
    roles?: string[];
  };
}

interface UserInfoResponse {
  user: {
    id: string;
    username: string;
    role: string;
    permissions: string[];
    roles?: string[];
  };
}

export function login(params: LoginParams): Promise<LoginResponse> {
  return post<LoginResponse>("/auth/login", params as unknown as Record<string, unknown>);
}

export function logout(): Promise<null> {
  return http.Post(
    "/auth/logout",
    {},
    {
      meta: { token: true, silent: true },
    },
  );
}

export function getMenus(): Promise<any> {
  return get<any>("/auth/menus");
}

export function getUserInfo(): Promise<UserInfoResponse> {
  return get<UserInfoResponse>("/auth/user-info");
}
