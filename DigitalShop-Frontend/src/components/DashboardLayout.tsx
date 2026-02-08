import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Warehouse, 
  Receipt, 
  Users, 
  Truck,
  BarChart3,
  LogOut,
  Menu,
  X,
  Wallet,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Permission key required to see this nav item (if omitted, always visible) */
  permissionKey?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'POS', path: '/pos', icon: ShoppingCart, permissionKey: 'pos.access' },
  { name: 'Inventory', path: '/inventory', icon: Warehouse, permissionKey: 'inventory.read' },
  { name: 'Sales', path: '/sales', icon: Receipt, permissionKey: 'sales.read' },
  { name: 'Customers', path: '/customers', icon: Users, permissionKey: 'customers.read' },
  { name: 'Suppliers', path: '/suppliers', icon: Truck, permissionKey: 'suppliers.read' },
  { name: 'Expenses', path: '/expenses', icon: Wallet, permissionKey: 'expenses.read' },
  { name: 'Cash Register', path: '/cash-register', icon: Receipt, permissionKey: 'cashregister.view' },
  { name: 'Users', path: '/users', icon: UserCog, permissionKey: 'users.read' },
  { name: 'Settings', path: '/settings', icon: Settings, permissionKey: 'settings.read' },
  { name: 'Reports', path: '/reports', icon: BarChart3 },  // gated by canAccessReports below
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const perms = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Persist collapsed state in localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Close mobile sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const canAccessRoute = (item: NavItem) => {
    // Reports uses canAccessReports (any report category permission)
    if (item.path === '/reports') return perms.canAccessReports;
    if (!item.permissionKey) return true;
    return perms.can(item.permissionKey);
  };

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
  const mainPadding = sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          'hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out z-30',
          sidebarWidth
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white shadow-sm">
          {/* Logo */}
          <div className={cn(
            'flex h-16 flex-shrink-0 items-center bg-primary transition-all duration-300',
            sidebarCollapsed ? 'justify-center px-2' : 'px-4'
          )}>
            {sidebarCollapsed ? (
              <span className="text-2xl font-bold text-white">D</span>
            ) : (
              <h1 className="text-2xl font-bold text-white truncate">DigitalShop</h1>
            )}
          </div>
          
          {/* Navigation */}
          <div className="flex flex-1 flex-col overflow-y-auto pt-4 pb-4">
            <nav className={cn('flex-1 space-y-1', sidebarCollapsed ? 'px-1' : 'px-2')}>
              {navItems.map((item) => {
                if (!canAccessRoute(item)) return null;
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={cn(
                      'group flex items-center rounded-md transition-all duration-200',
                      sidebarCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5',
                      active
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <Icon className={cn(
                      'h-5 w-5 flex-shrink-0 transition-colors',
                      sidebarCollapsed ? '' : 'mr-3',
                      active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                    )} />
                    {!sidebarCollapsed && (
                      <span className="text-sm font-medium truncate">{item.name}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User section */}
          <div className={cn(
            'flex flex-shrink-0 border-t border-gray-200 transition-all duration-300',
            sidebarCollapsed ? 'p-2' : 'p-4'
          )}>
            <div className="flex flex-col w-full">
              {!sidebarCollapsed && (
                <div className="flex items-center mb-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold shadow-sm">
                      {user?.fullName?.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.fullName}</p>
                    <p className="text-xs text-gray-500">{user?.role}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                title={sidebarCollapsed ? 'Logout' : undefined}
                className={cn(
                  'flex items-center text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors',
                  sidebarCollapsed ? 'justify-center p-2' : 'w-full px-3 py-2'
                )}
              >
                <LogOut className={cn('h-5 w-5', sidebarCollapsed ? '' : 'mr-3')} />
                {!sidebarCollapsed && 'Logout'}
              </button>
            </div>
          </div>

          {/* Collapse toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-gray-600 lg:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-75' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ease-in-out lg:hidden shadow-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Mobile header */}
          <div className="flex h-16 flex-shrink-0 items-center justify-between px-4 bg-primary">
            <h1 className="text-xl font-bold text-white">DigitalShop</h1>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="text-white hover:bg-white/10 rounded-md p-1 transition-colors" 
              title="Close sidebar" 
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          {/* Mobile navigation */}
          <div className="flex flex-1 flex-col overflow-y-auto pt-4 pb-4">
            <nav className="flex-1 space-y-1 px-3">
              {navItems.map((item) => {
                if (!canAccessRoute(item)) return null;
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'group flex items-center px-3 py-3 text-base font-medium rounded-lg transition-all duration-200',
                      active
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200'
                    )}
                  >
                    <Icon className={cn(
                      'mr-4 h-6 w-6 flex-shrink-0',
                      active ? 'text-white' : 'text-gray-500'
                    )} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Mobile user section */}
          <div className="flex flex-shrink-0 border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex flex-col w-full">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-lg shadow-sm">
                    {user?.fullName?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-base font-medium text-gray-900 truncate">{user?.fullName}</p>
                  <p className="text-sm text-gray-500">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-full px-4 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors shadow-sm"
              >
                <LogOut className="mr-2 h-5 w-5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('flex flex-col flex-1 transition-all duration-300', mainPadding)}>
        {/* Top bar for mobile/tablet */}
        <div className="sticky top-0 z-20 flex h-14 sm:h-16 flex-shrink-0 bg-white border-b border-gray-200 lg:hidden">
          <button
            type="button"
            className="px-4 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar menu"
            title="Open sidebar menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 items-center justify-center pr-12">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">DigitalShop</h1>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-4 sm:py-6">
            <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
