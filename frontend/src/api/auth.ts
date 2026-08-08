import { apiClient } from './client';
import type { User } from '../types';

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/** The Axios response interceptor unwraps { success, data } → data. */
async function post<T>(url: string, body: unknown): Promise<T> {
  return (await apiClient.post(url, body)) as unknown as T;
}

async function put<T>(url: string, body: unknown): Promise<T> {
  return (await apiClient.put(url, body)) as unknown as T;
}

async function del<T>(url: string): Promise<T> {
  return (await apiClient.delete(url)) as unknown as T;
}

export const authApi = {
  register: (data: RegisterInput) => post<AuthResponse>('/auth/register', data),
  login: (data: LoginInput) => post<AuthResponse>('/auth/login', data),
  adminLogin: (data: Pick<LoginInput, 'email' | 'password'>) => post<AuthResponse>('/admin/login', data),
  logout: (refreshToken: string) => post<{ message: string }>('/auth/logout', { refreshToken }),
  me: async () => {
    const res = (await apiClient.get('/auth/me')) as unknown as { user: User };
    return res.user;
  },
  updateProfile: (data: Partial<{ name: string; phone: string | null; currentPassword: string; newPassword: string }>) =>
    put<{ user: User }>('/auth/profile', data),
  deleteAccount: () => del<{ message: string }>('/auth/account'),
  forgotPassword: (email: string) => post<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    post<{ message: string }>('/auth/reset-password', { token, password }),
};
