import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PermissionGate } from './components/PermissionGate';
import { DashboardLayout } from './components/DashboardLayout';
import { LoginPage } from './pages/LoginPage';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import('./pages/POSPage').then(m => ({ default: m.POSPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const SalesPage = lazy(() => import('./pages/SalesPage').then(m => ({ default: m.SalesPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const CashRegisterPage = lazy(() => import('./pages/CashRegisterPage').then(m => ({ default: m.CashRegisterPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (renamed from cacheTime in React Query v5)
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      <p className="mt-2 text-sm text-gray-600">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                
                {/* Core Pages - Permission gated */}
                <Route path="pos" element={<PermissionGate permission="pos.access"><POSPage /></PermissionGate>} />
                <Route path="inventory" element={<PermissionGate permission="inventory.read"><InventoryPage /></PermissionGate>} />
                <Route path="sales" element={<PermissionGate permission="sales.read"><SalesPage /></PermissionGate>} />
                <Route path="customers" element={<PermissionGate permission="customers.read"><CustomersPage /></PermissionGate>} />
                <Route path="customers/:id" element={<PermissionGate permission="customers.read"><CustomerDetailPage /></PermissionGate>} />
                <Route path="suppliers" element={<PermissionGate permission="suppliers.read"><SuppliersPage /></PermissionGate>} />
                <Route path="cash-register" element={<PermissionGate permission="cashregister.view"><CashRegisterPage /></PermissionGate>} />
                <Route path="expenses" element={<PermissionGate permission="expenses.read"><ExpensesPage /></PermissionGate>} />
                <Route path="users" element={<PermissionGate permission="users.read"><UsersPage /></PermissionGate>} />
                <Route path="settings" element={<PermissionGate anyOf={['settings.read', 'settings.update', 'settings.roles', 'settings.reset']}><SettingsPage /></PermissionGate>} />
                <Route path="reports" element={<PermissionGate permission="reports.sales"><ReportsPage /></PermissionGate>} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

