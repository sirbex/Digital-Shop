import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authApi } from '../lib/api';

const IDLE_WARNING_MS = 4 * 60 * 1000; // 4 minutes → show warning
const IDLE_LOGOUT_MS = 5 * 60 * 1000;  // 5 minutes → auto logout

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
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
  idleWarning: boolean;
  idleCountdown: number;
  dismissIdleWarning: () => void;
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

  // ── Idle auto-logout (4 min warning, 5 min logout) ──
  const [idleWarning, setIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearIdleTimers = useCallback(() => {
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null; }
    if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const resetIdleTimers = useCallback(() => {
    clearIdleTimers();
    setIdleWarning(false);
    setIdleCountdown(60);

    // After 4 min of inactivity → show warning
    warningTimerRef.current = setTimeout(() => {
      setIdleWarning(true);
      setIdleCountdown(60);
      // Start countdown
      const start = Date.now();
      countdownRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setIdleCountdown(Math.max(0, 60 - elapsed));
      }, 1000);
    }, IDLE_WARNING_MS);

    // After 5 min of inactivity → auto logout
    logoutTimerRef.current = setTimeout(() => {
      clearIdleTimers();
      setIdleWarning(false);
      logout();
    }, IDLE_LOGOUT_MS);
  }, [clearIdleTimers]);

  useEffect(() => {
    if (!token) {
      clearIdleTimers();
      setIdleWarning(false);
      return;
    }

    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => { throttleTimer = null; }, 1000);
      resetIdleTimers();
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    resetIdleTimers();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      if (throttleTimer) clearTimeout(throttleTimer);
      clearIdleTimers();
    };
  }, [token, resetIdleTimers, clearIdleTimers]);

  const dismissIdleWarning = useCallback(() => {
    resetIdleTimers();
  }, [resetIdleTimers]);

  // ----- Permission helpers (memoised set for O(1) lookups) -----
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const hasPermission = useCallback(
    (key: string): boolean => {
      // SUPER_ADMIN and ADMIN always have all permissions (safety net)
      if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') return true;
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
        idleWarning,
        idleCountdown,
        dismissIdleWarning,
      }}
    >
      {children}
      {idleWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Session Timeout Warning</h3>
            <p className="text-sm text-gray-600 mb-4">
              You will be logged out in <span className="font-bold text-red-600 text-base">{idleCountdown}s</span> due to inactivity.
            </p>
            <button
              onClick={dismissIdleWarning}
              className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              I'm still here
            </button>
          </div>
        </div>
      )}
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
