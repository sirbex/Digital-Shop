import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesApi, inventoryApi, reportsApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

interface DashboardData {
  today: { todaySales: number; todayRevenue: number; todayProfit: number };
  month: { monthSales: number; monthRevenue: number; monthProfit: number };
  inventory: { totalProducts: number; outOfStock: number; lowStock: number; inventoryValue: number };
  receivables: { unpaidInvoices: number; totalReceivables: number };
}

export function DashboardPage() {
  const perms = usePermissions();
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      const promises: Promise<any>[] = [
        reportsApi.getDashboard(),
        inventoryApi.getLowStock(),
        inventoryApi.getExpiring(30),
      ];

      // Only fetch profit-related data if user has permission
      if (perms.canViewProfit) {
        promises.push(salesApi.getTopProducts({ limit: 5, startDate: monthStart, endDate }));
      }

      promises.push(
        reportsApi.getSalesTrends(startDate, endDate).catch(() => ({ data: { success: false } }))
      );

      const results = await Promise.all(promises);

      if (results[0].data.success) setDashboard(results[0].data.data);
      if (results[1].data.success) setLowStockProducts(results[1].data.data.slice(0, 5));
      if (results[2].data.success) setExpiringBatches(results[2].data.data.slice(0, 5));

      let idx = 3;
      if (perms.canViewProfit) {
        if (results[idx]?.data?.success) setTopProducts(results[idx].data.data?.slice(0, 5) || []);
        idx++;
      }
      if (results[idx]?.data?.success) {
        const trends = results[idx].data.data || [];
        setSalesTrend(Array.isArray(trends) ? trends.slice(-7) : []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fmt = (v: number | string | undefined | null) => {
    const n = typeof v === 'string' ? parseFloat(v) || 0 : (v || 0);
    return `${settings.currencySymbol} ${Math.round(n).toLocaleString()}`;
  };
  const fmtShort = (v: number | string | undefined | null) => {
    const n = typeof v === 'string' ? parseFloat(v) || 0 : (v || 0);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return Math.round(n).toLocaleString();
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const today = dashboard?.today;
  const month = dashboard?.month;
  const inv = dashboard?.inventory;
  const recv = dashboard?.receivables;

  // Trend sparkline max
  const trendMax = Math.max(...salesTrend.map((d: any) => parseFloat(d.totalSales || 0)), 1);

  return (
    <div className="space-y-6 pb-8">
      {/* ── Greeting Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.fullName?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here's how your business is doing today
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/pos')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            New Sale
          </button>
          <button onClick={() => navigate('/reports')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            Reports
          </button>
        </div>
      </div>

      {/* ── Hero KPI Cards Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Revenue */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Today's Revenue</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{fmt(today?.todayRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">{today?.todaySales || 0} transactions</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">This Month</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{fmt(month?.monthRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">{month?.monthSales || 0} transactions</p>
        </div>

        {/* Profit (conditional) */}
        {perms.canViewProfit ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Month Profit</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600">{fmt(month?.monthProfit)}</p>
            <p className="text-xs text-gray-500 mt-1">Today: {fmt(today?.todayProfit)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Inventory</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{inv?.totalProducts || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Total products tracked</p>
          </div>
        )}

        {/* Receivables */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Receivables</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">{fmt(recv?.totalReceivables)}</p>
          <p className="text-xs text-gray-500 mt-1">{recv?.unpaidInvoices || 0} unpaid invoices</p>
        </div>
      </div>

      {/* ── Middle Row: Trend Chart + Inventory Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Trend (Last 7 Days) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Sales Trend — Last 7 Days</h2>
            <button onClick={() => navigate('/reports')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View all →
            </button>
          </div>
          {salesTrend.length > 0 ? (
            <div className="flex items-end gap-2 h-36">
              {salesTrend.map((d: any, i: number) => {
                const val = parseFloat(d.totalSales || 0);
                const pct = Math.max(4, (val / trendMax) * 100);
                const dayLabel = new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' });
                const isToday = i === salesTrend.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="relative w-full flex justify-center">
                      <div className="absolute -top-6 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {fmt(val)}
                      </div>
                      <div
                        className={`w-full max-w-[40px] rounded-t-md transition-all duration-300 ${isToday ? 'bg-blue-500' : 'bg-blue-200 group-hover:bg-blue-400'}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[10px] ${isToday ? 'font-semibold text-blue-600' : 'text-gray-400'}`}>{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-36 flex items-center justify-center text-sm text-gray-400">No sales data yet</div>
          )}
        </div>

        {/* Inventory Health */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Inventory Health</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-sm text-gray-600">In Stock</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {Math.max(0, (inv?.totalProducts || 0) - (inv?.outOfStock || 0) - (inv?.lowStock || 0))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-sm text-gray-600">Low Stock</span>
              </div>
              <span className="text-sm font-semibold text-amber-600">{inv?.lowStock || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-sm text-gray-600">Out of Stock</span>
              </div>
              <span className="text-sm font-semibold text-red-600">{inv?.outOfStock || 0}</span>
            </div>

            {/* Visual bar */}
            {(inv?.totalProducts || 0) > 0 && (
              <div className="mt-3">
                <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden flex">
                  <div className="bg-green-400 h-full transition-all" style={{ width: `${Math.max(0, ((inv!.totalProducts - inv!.outOfStock - inv!.lowStock) / inv!.totalProducts) * 100)}%` }} />
                  <div className="bg-amber-400 h-full transition-all" style={{ width: `${(inv!.lowStock / inv!.totalProducts) * 100}%` }} />
                  <div className="bg-red-400 h-full transition-all" style={{ width: `${(inv!.outOfStock / inv!.totalProducts) * 100}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 text-center">{inv!.totalProducts} products total</p>
              </div>
            )}

            {perms.canViewCostPrice && (
              <div className="pt-3 mt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Inventory Value</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(inv?.inventoryValue)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Top Products + Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Selling Products */}
        {perms.canViewProfit && topProducts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-800">Top Selling Products</h2>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">This Month</span>
            </div>
            <div className="space-y-3">
              {topProducts.map((p: any, i: number) => {
                const rev = parseFloat(p.totalRevenue || p.revenue || 0);
                const maxRev = parseFloat(topProducts[0]?.totalRevenue || topProducts[0]?.revenue || 1);
                return (
                  <div key={p.productId || p.id || i} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-gray-400 w-4">{i + 1}.</span>
                        <span className="text-sm text-gray-800 truncate">{p.productName || p.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 ml-2 whitespace-nowrap">{fmt(rev)}</span>
                    </div>
                    <div className="ml-6 w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${(rev / maxRev) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Alerts: Low Stock + Expiring */}
        <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${!perms.canViewProfit || topProducts.length === 0 ? 'lg:col-span-2' : ''}`}>
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Alerts & Notifications</h2>

          {lowStockProducts.length === 0 && expiringBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-400">
              <svg className="w-10 h-10 mb-2 text-green-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm">All clear — no alerts right now</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Low Stock Alerts */}
              {lowStockProducts.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">Low Stock ({lowStockProducts.length})</span>
                  </div>
                  <div className="space-y-2">
                    {lowStockProducts.map((product: any) => (
                      <div key={product.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-amber-50/50 border border-amber-100">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                          <p className="text-[11px] text-gray-500">{product.sku}</p>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <p className="text-sm font-bold text-amber-600">{product.quantityOnHand} left</p>
                          <p className="text-[10px] text-gray-400">Reorder: {product.reorderLevel}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiring Alerts */}
              {expiringBatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-medium text-red-700 uppercase tracking-wide">Expiring Soon ({expiringBatches.length})</span>
                  </div>
                  <div className="space-y-2">
                    {expiringBatches.map((batch: any) => {
                      const daysLeft = Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / 86400000);
                      return (
                        <div key={batch.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-red-50/50 border border-red-100">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{batch.productName}</p>
                            <p className="text-[11px] text-gray-500">Batch: {batch.batchNumber}</p>
                          </div>
                          <div className="text-right ml-2 shrink-0">
                            <p className={`text-sm font-bold ${daysLeft <= 7 ? 'text-red-600' : 'text-orange-500'}`}>
                              {daysLeft <= 0 ? 'Expired' : `${daysLeft}d left`}
                            </p>
                            <p className="text-[10px] text-gray-400">{batch.remainingQuantity} units</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { label: 'New Sale', icon: '🛒', path: '/pos', color: 'bg-green-50 text-green-700 border-green-100' },
            { label: 'Inventory', icon: '📦', path: '/inventory', color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Customers', icon: '👥', path: '/customers', color: 'bg-purple-50 text-purple-700 border-purple-100' },
            { label: 'Expenses', icon: '💸', path: '/expenses', color: 'bg-red-50 text-red-700 border-red-100' },
            { label: 'Sales', icon: '📋', path: '/sales', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
            { label: 'Reports', icon: '📊', path: '/reports', color: 'bg-amber-50 text-amber-700 border-amber-100' },
          ].map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all hover:shadow-sm active:scale-[0.98] ${action.color}`}
            >
              <span>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
