import { useEffect, useState } from 'react';
import { salesApi, inventoryApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';

export function DashboardPage() {
  const perms = usePermissions();
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [salesRes, lowStockRes, expiringRes] = await Promise.all([
        salesApi.getSummary(),
        inventoryApi.getLowStock(),
        inventoryApi.getExpiring(30),
      ]);

      if (salesRes.data.success) {
        setSalesSummary(salesRes.data.data);
      }

      if (lowStockRes.data.success) {
        setLowStockProducts(lowStockRes.data.data.slice(0, 5));
      }

      if (expiringRes.data.success) {
        setExpiringBatches(expiringRes.data.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 truncate">Total Sales</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {salesSummary?.totalSales || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 truncate">Revenue Received</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  UGX {(salesSummary?.totalRevenue || 0).toLocaleString()}
                </p>
                {(salesSummary?.totalCreditOutstanding || 0) > 0 && (
                  <p className="mt-1 text-sm text-orange-600">
                    + UGX {(salesSummary?.totalCreditOutstanding || 0).toLocaleString()} outstanding
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {perms.canViewProfit && (
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 truncate">Profit</p>
                <p className="mt-1 text-3xl font-semibold text-green-600">
                  UGX {(salesSummary?.totalProfit || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
        )}

        {perms.canViewProfit && (
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 truncate">Profit Margin</p>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {(salesSummary?.avgProfitMargin || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Low Stock Products */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
              Low Stock Products
            </h3>
            {lowStockProducts.length === 0 ? (
              <p className="text-gray-500">No low stock products</p>
            ) : (
              <div className="space-y-3">
                {lowStockProducts.map((product: any) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between border-b pb-2"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">
                        {product.quantityOnHand} units
                      </p>
                      <p className="text-xs text-gray-500">
                        Reorder: {product.reorderLevel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expiring Batches */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
              Expiring Soon (30 days)
            </h3>
            {expiringBatches.length === 0 ? (
              <p className="text-gray-500">No expiring batches</p>
            ) : (
              <div className="space-y-3">
                {expiringBatches.map((batch: any) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between border-b pb-2"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{batch.productName}</p>
                      <p className="text-sm text-gray-500">Batch: {batch.batchNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-orange-600">
                        {new Date(batch.expiryDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {batch.remainingQuantity} units
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
