/**
 * PermissionGate Component
 * Wraps page content and blocks access when the user lacks a required permission.
 * Use at the top of each page to enforce route-level permission checks.
 * 
 * ADMIN role always passes (handled inside useAuth().hasPermission).
 */

import { useAuth } from '../contexts/AuthContext';

interface PermissionGateProps {
  /** The permission key required (e.g. 'inventory.read', 'settings.roles') */
  permission?: string;
  /** Optional: check ANY of these permissions (user needs at least one) */
  anyOf?: string[];
  /** Content to show when the user has permission */
  children: React.ReactNode;
  /** Optional custom fallback. Defaults to a styled "Access Denied" card. */
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, anyOf, children, fallback }: PermissionGateProps) {
  const { hasPermission, hasAnyPermission } = useAuth();

  // Check single permission or anyOf list
  const allowed = anyOf
    ? hasAnyPermission(...anyOf)
    : permission
      ? hasPermission(permission)
      : true; // No permission specified = always allowed

  if (!allowed) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You don't have permission to view this page.
            Contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
