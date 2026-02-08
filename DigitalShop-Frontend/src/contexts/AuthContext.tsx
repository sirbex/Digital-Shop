import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../lib/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Check if the current user has a specific permission key (e.g. 'products.read') */
  hasPermission: (key: string) => boolean;
  /** Check if the current user has ALL of the given permission keys */
  hasAllPermissions: (...keys: string[]) => boolean;
  /** Check if the current user has ANY of the given permission keys */
  hasAnyPermission: (...keys: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetch the user's permission keys from the backend RBAC system.
   * Gracefully returns empty array on error (RBAC tables may not exist yet).
   */
  const fetchPermissions = useCallback(async () => {
    try {
      const response = await authApi.getMyPermissions();
      if (response.data.success && Array.isArray(response.data.data)) {
        setPermissions(response.data.data);
        localStorage.setItem('auth_permissions', JSON.stringify(response.data.data));
      }
    } catch {
      // RBAC tables may not be set up yet – fall back to empty
      console.warn('Could not fetch permissions (RBAC tables may not exist)');
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    // Check for existing auth on mount
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    const storedPerms = localStorage.getItem('auth_permissions');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Use cached permissions immediately, then refresh from server
      if (storedPerms) {
        try { setPermissions(JSON.parse(storedPerms)); } catch { /* ignore */ }
      }
    }
    setIsLoading(false);
  }, []);

  // When token is set (login or mount), fetch fresh permissions
  useEffect(() => {
    if (token) {
      fetchPermissions();
    }
  }, [token, fetchPermissions]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);

      if (response.data.success && response.data.data) {
        const { token: newToken, user: newUser } = response.data.data;

        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(newUser));

        setToken(newToken);
        setUser(newUser);
        // permissions will be fetched by the useEffect above
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_permissions');
    setToken(null);
    setUser(null);
    setPermissions([]);
  };

  // ----- Permission helpers (memoised set for O(1) lookups) -----
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const hasPermission = useCallback(
    (key: string): boolean => {
      // ADMIN always has all permissions (safety net)
      if (user?.role === 'ADMIN') return true;
      return permissionSet.has(key);
    },
    [permissionSet, user?.role]
  );

  const hasAllPermissions = useCallback(
    (...keys: string[]): boolean => keys.every((k) => hasPermission(k)),
    [hasPermission]
  );

  const hasAnyPermission = useCallback(
    (...keys: string[]): boolean => keys.some((k) => hasPermission(k)),
    [hasPermission]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permissions,
        login,
        logout,
        isLoading,
        isAuthenticated: !!token && !!user,
        hasPermission,
        hasAllPermissions,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
