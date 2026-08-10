import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../../api/client';
import { authApi, type LoginInput, type RegisterInput } from '../../api/auth';
import type { User } from '../../types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean; // restoring the session on first load
  login: (input: LoginInput) => Promise<User>;
  googleLogin: (token: string) => Promise<User>;
  adminLogin: (input: { email: string; password: string }) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  /** Replaces the in-memory + stored user (after a profile save). */
  updateStoredUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the session: validate the stored token via /auth/me.
  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(STORAGE_KEYS.access);
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then((me) => {
        if (!active) return;
        setUser(me);
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(me));
      })
      .catch(() => {
        if (!active) return;
        // Interceptor already tried a refresh; session is gone.
        setUser(null);
        localStorage.removeItem(STORAGE_KEYS.access);
        localStorage.removeItem(STORAGE_KEYS.refresh);
        localStorage.removeItem(STORAGE_KEYS.user);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function persistSession(token: string, refreshToken: string, u: User) {
    localStorage.setItem(STORAGE_KEYS.access, token);
    localStorage.setItem(STORAGE_KEYS.refresh, refreshToken);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(u));
    setUser(u);
  }

  async function login(input: LoginInput): Promise<User> {
    const res = await authApi.login(input);
    persistSession(res.token, res.refreshToken, res.user);
    return res.user;
  }

  async function googleLogin(token: string): Promise<User> {
    const res = await authApi.googleLogin(token);
    persistSession(res.token, res.refreshToken, res.user);
    return res.user;
  }

  async function adminLogin(input: { email: string; password: string }): Promise<User> {
    const res = await authApi.adminLogin(input);
    persistSession(res.token, res.refreshToken, res.user);
    return res.user;
  }

  async function register(input: RegisterInput): Promise<User> {
    const res = await authApi.register(input);
    persistSession(res.token, res.refreshToken, res.user);
    return res.user;
  }

  async function logout(): Promise<void> {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refresh) ?? '';
    try {
      await authApi.logout(refreshToken);
    } catch {
      // best-effort server revoke
    }
    localStorage.removeItem(STORAGE_KEYS.access);
    localStorage.removeItem(STORAGE_KEYS.refresh);
    localStorage.removeItem(STORAGE_KEYS.user);
    setUser(null);
  }

  function updateStoredUser(u: User) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(u));
    setUser(u);
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, googleLogin, adminLogin, register, logout, updateStoredUser }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
