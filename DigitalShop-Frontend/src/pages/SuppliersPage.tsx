import { useState, useEffect, useMemo } from 'react';
import { suppliersApi, purchasesApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';

// Payment Terms options
const PAYMENT_TERMS = [
  { value: 'NET30', label: 'Net 30 Days', days: 30, description: 'Payment due within 30 days' },
  { value: 'NET60', label: 'Net 60 Days', days: 60, description: 'Payment due within 60 days' },
  { value: 'NET90', label: 'Net 90 Days', days: 90, description: 'Payment due within 90 days' },
  { value: 'NET15', label: 'Net 15 Days', days: 15, description: 'Payment due within 15 days' },
  { value: 'COD', label: 'Cash on Delivery', days: 0, description: 'Payment on delivery' },
  { value: 'PREPAID', label: 'Prepaid', days: -1, description: 'Payment before delivery' },
];

// Types
type ViewMode = 'table' | 'cards';
type SortField = 'name' | 'createdAt' | 'paymentTerms' | 'balance';
type SortOrder = 'asc' | 'desc';

interface SupplierFormData {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  notes: string;
}

// Format currency
const formatUGX = (amount: number) => {
  return `UGX ${Number(amount || 0).toLocaleString()}`;
};

// Format date
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return dateString;
  }
};

export function SuppliersPage() {
  const perms = usePermissions();

  // State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [viewingSupplier, setViewingSupplier] = useState<any>(null);

  // Filter/Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterPaymentTerms, setFilterPaymentTerms] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Load suppliers
  const loadSuppliers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await suppliersApi.getAll();
      if (response.data.success) {
        setSuppliers(response.data.data || []);
      } else {
        setError(response.data.error || 'Failed to load suppliers');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Filter and sort suppliers
  const filteredSuppliers = useMemo(() => {
    let result = [...suppliers];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.name?.toLowerCase().includes(query) ||
        s.contactPerson?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.phone?.toLowerCase().includes(query) ||
        s.address?.toLowerCase().includes(query)
      );
    }

    // Payment terms filter
    if (filterPaymentTerms) {
      result = result.filter((s) => s.paymentTerms === filterPaymentTerms);
    }

    // Status filter
    if (filterStatus === 'active') {
      result = result.filter((s) => s.isActive);
    } else if (filterStatus === 'inactive') {
      result = result.filter((s) => !s.isActive);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt || 0).getTime();
          bVal = new Date(b.createdAt || 0).getTime();
          break;
        case 'paymentTerms':
          aVal = a.paymentTerms || '';
          bVal = b.paymentTerms || '';
          break;
        case 'balance':
          aVal = a.balance || 0;
          bVal = b.balance || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [suppliers, searchQuery, filterPaymentTerms, filterStatus, sortField, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((s) => s.isActive).length;
    const inactive = total - active;
    const totalBalance = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

    // Payment terms breakdown
    const paymentTermsBreakdown = suppliers.reduce((acc: any, s) => {
      const term = s.paymentTerms || 'NET30';
      acc[term] = (acc[term] || 0) + 1;
      return acc;
    }, {});

    return { total, active, inactive, totalBalance, paymentTermsBreakdown };
  }, [suppliers]);

  // Handle create
  const handleCreate = async (data: SupplierFormData) => {
    try {
      const response = await suppliersApi.create(data);
      if (response.data.success) {
        alert('Supplier created successfully!');
        setShowCreateModal(false);
        loadSuppliers();
      } else {
        alert(response.data.error || 'Failed to create supplier');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create supplier');
    }
  };

  // Handle update
  const handleUpdate = async (data: SupplierFormData) => {
    if (!editingSupplier) return;
    try {
      const response = await suppliersApi.update(editingSupplier.id, data);
      if (response.data.success) {
        alert('Supplier updated successfully!');
        setEditingSupplier(null);
        loadSuppliers();
      } else {
        alert(response.data.error || 'Failed to update supplier');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update supplier');
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"? This action cannot be undone.`)) return;
    try {
      const response = await suppliersApi.update(id, { isActive: false });
      if (response.data.success) {
        alert('Supplier deactivated successfully!');
        loadSuppliers();
      } else {
        alert(response.data.error || 'Failed to deactivate supplier');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to deactivate supplier');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Payment Terms', 'Balance', 'Status', 'Created'];
    const rows = filteredSuppliers.map((s) => [
      s.name || '',
      s.contactPerson || '',
      s.email || '',
      s.phone || '',
      (s.address || '').replace(/"/g, '""'),
      s.paymentTerms || 'NET30',
      s.balance || 0,
      s.isActive ? 'Active' : 'Inactive',
      formatDate(s.createdAt),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suppliers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">{error}</p>
          <button
            onClick={loadSuppliers}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
          <p className="text-gray-600 mt-1">Manage your suppliers and vendor relationships</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            📤 Export
          </button>
          {perms.canCreateSupplier && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            ➕ Add Supplier
          </button>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Suppliers</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">All registered vendors</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Active Suppliers</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.active}</div>
          <div className="text-xs text-gray-500 mt-1">Available for POs</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Balance</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{formatUGX(stats.totalBalance)}</div>
          <div className="text-xs text-gray-500 mt-1">Outstanding payables</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Filtered Results</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{filteredSuppliers.length}</div>
          <div className="text-xs text-gray-500 mt-1">Current view</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Search */}
          <div className="lg:col-span-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, contact, email, phone..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Payment Terms Filter */}
          <div className="lg:col-span-2">
            <select
              value={filterPaymentTerms}
              onChange={(e) => setFilterPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              aria-label="Filter suppliers by payment terms"
              title="Filter suppliers by payment terms"
            >
              <option value="">All Terms</option>
              {PAYMENT_TERMS.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              aria-label="Filter suppliers by status"
              title="Filter suppliers by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Sort */}
          <div className="lg:col-span-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              aria-label="Sort suppliers by field"
              title="Sort suppliers by field"
            >
              <option value="name">Sort by Name</option>
              <option value="createdAt">Sort by Date</option>
              <option value="paymentTerms">Sort by Terms</option>
              <option value="balance">Sort by Balance</option>
            </select>
          </div>

          {/* Actions */}
          <div className="lg:col-span-2 flex gap-2">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterPaymentTerms('');
                setFilterStatus('all');
                setSortField('name');
                setSortOrder('asc');
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              onClick={loadSuppliers}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              title="Refresh"
            >
              🔄
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {filteredSuppliers.length} of {stats.total} suppliers
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-lg ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗂️ Cards
            </button>
          </div>
        </div>
      </div>

      {/* Suppliers View */}
      {viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email / Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terms</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchQuery || filterPaymentTerms || filterStatus !== 'all'
                        ? 'No suppliers match your filters'
                        : 'No suppliers yet. Add your first supplier to get started!'}
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{supplier.name}</div>
                        {supplier.address && (
                          <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{supplier.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {supplier.contactPerson || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          {supplier.email && (
                            <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline block">
                              {supplier.email}
                            </a>
                          )}
                          {supplier.phone && (
                            <a href={`tel:${supplier.phone}`} className="text-gray-700 block">
                              {supplier.phone}
                            </a>
                          )}
                          {!supplier.email && !supplier.phone && '-'}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          {supplier.paymentTerms || 'NET30'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className={`font-mono ${supplier.balance > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                          {formatUGX(supplier.balance || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            supplier.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {supplier.isActive ? '✓ Active' : '○ Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewingSupplier(supplier)}
                            className="text-gray-600 hover:text-gray-900"
                            title="View Details"
                          >
                            👁️
                          </button>
                          {perms.canEditSupplier && (
                          <button
                            onClick={() => setEditingSupplier(supplier)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          )}
                          {perms.canDeleteSupplier && supplier.isActive && (
                            <button
                              onClick={() => handleDelete(supplier.id, supplier.name)}
                              className="text-red-600 hover:text-red-900"
                              title="Deactivate"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
              {searchQuery || filterPaymentTerms || filterStatus !== 'all'
                ? 'No suppliers match your filters'
                : 'No suppliers yet. Add your first supplier to get started!'}
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-5"
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{supplier.name}</h3>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        supplier.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {supplier.isActive ? '✓ Active' : '○ Inactive'}
                    </span>
                  </div>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    {supplier.paymentTerms || 'NET30'}
                  </span>
                </div>

                {/* Card Body */}
                <div className="space-y-2 mb-4">
                  {supplier.contactPerson && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500">👤</span>
                      <span className="text-gray-700">{supplier.contactPerson}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500">📧</span>
                      <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500">📞</span>
                      <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">
                        {supplier.phone}
                      </a>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-gray-500">📍</span>
                      <span className="text-gray-700">{supplier.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">💰</span>
                    <span className={`font-mono font-semibold ${supplier.balance > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {formatUGX(supplier.balance || 0)}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => setViewingSupplier(supplier)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    👁️ View
                  </button>
                  {perms.canEditSupplier && (
                  <button
                    onClick={() => setEditingSupplier(supplier)}
                    className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    ✏️ Edit
                  </button>
                  )}
                  {perms.canDeleteSupplier && supplier.isActive && (
                    <button
                      onClick={() => handleDelete(supplier.id, supplier.name)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">📋 Supplier Management Tips</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• <strong>Payment Terms:</strong> NET30 (30 days), NET60, NET90, COD, or Prepaid</li>
          <li>• <strong>Contact Info:</strong> Keep supplier details up-to-date for smooth communication</li>
          <li>• <strong>Active Status:</strong> Inactive suppliers won't appear in purchase order creation</li>
          <li>• <strong>Balance:</strong> Outstanding amounts owed to suppliers</li>
          <li>• <strong>Export:</strong> Download supplier data as CSV for reporting</li>
        </ul>
      </div>

      {/* Supplier Detail Modal */}
      {viewingSupplier && (
        <SupplierDetailModal
          supplier={viewingSupplier}
          onClose={() => setViewingSupplier(null)}
          onEdit={() => {
            setEditingSupplier(viewingSupplier);
            setViewingSupplier(null);
          }}
        />
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSupplier) && (
        <SupplierFormModal
          supplier={editingSupplier}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSupplier(null);
          }}
          onSubmit={editingSupplier ? handleUpdate : handleCreate}
        />
      )}
    </div>
  );
}

// Supplier Detail Modal Component
interface SupplierDetailModalProps {
  supplier: any;
  onClose: () => void;
  onEdit: () => void;
}

function SupplierDetailModal({ supplier, onClose, onEdit }: SupplierDetailModalProps) {
  const modalPerms = usePermissions();
  const [activeTab, setActiveTab] = useState<'info' | 'orders'>('info');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const paymentTermInfo = PAYMENT_TERMS.find((t) => t.value === supplier.paymentTerms);

  // Load purchase orders for this supplier
  const loadOrders = async () => {
    if (orders.length > 0) return;
    setLoadingOrders(true);
    try {
      const response = await purchasesApi.getAll({ supplierId: supplier.id });
      if (response.data.success) {
        setOrders(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'orders') loadOrders();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">{supplier.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => handleTabChange('info')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Information
          </button>
          <button
            onClick={() => handleTabChange('orders')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'orders' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📦 Purchase Orders
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[300px]">
          {activeTab === 'info' && (
            <div>
              {/* Supplier Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Supplier Name</label>
                    <div className="mt-1 text-lg font-semibold text-gray-900">{supplier.name}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Contact Person</label>
                    <div className="mt-1 text-gray-900">{supplier.contactPerson || '-'}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <div className="mt-1">
                      {supplier.email ? (
                        <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                          {supplier.email}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <div className="mt-1">
                      {supplier.phone ? (
                        <a href={`tel:${supplier.phone}`} className="text-blue-600 hover:underline">
                          {supplier.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Payment Terms</label>
                    <div className="mt-1">
                      <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-800">
                        {paymentTermInfo?.label || supplier.paymentTerms || 'NET30'}
                      </span>
                      {paymentTermInfo && (
                        <div className="text-xs text-gray-500 mt-1">{paymentTermInfo.description}</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Balance</label>
                    <div className={`mt-1 text-lg font-bold ${supplier.balance > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                      {formatUGX(supplier.balance || 0)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <span
                        className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                          supplier.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {supplier.isActive ? '✓ Active' : '○ Inactive'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <div className="mt-1 text-gray-900">{formatDate(supplier.createdAt)}</div>
                  </div>
                </div>
              </div>

              {/* Address Section */}
              {supplier.address && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <div className="mt-1 text-gray-900 whitespace-pre-wrap">{supplier.address}</div>
                </div>
              )}

              {/* Notes Section */}
              {supplier.notes && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <label className="text-sm font-medium text-yellow-800">Notes</label>
                  <div className="mt-1 text-gray-700 whitespace-pre-wrap">{supplier.notes}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              {loadingOrders ? (
                <div className="text-center py-12">
                  <div className="text-gray-600">Loading orders...</div>
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-blue-600">{order.orderNumber}</div>
                          <div className="text-sm text-gray-600">{formatDate(order.orderDate)}</div>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            order.status === 'RECEIVED'
                              ? 'bg-green-100 text-green-800'
                              : order.status === 'DRAFT'
                              ? 'bg-gray-100 text-gray-800'
                              : order.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          {order.expectedDeliveryDate && <>Expected: {formatDate(order.expectedDeliveryDate)}</>}
                        </div>
                        <div className="text-lg font-bold text-gray-900">{formatUGX(order.totalAmount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">No purchase orders yet</div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Close
          </button>
          {modalPerms.canEditSupplier && (
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              ✏️ Edit Supplier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Supplier Form Modal Component
interface SupplierFormModalProps {
  supplier: any | null;
  onClose: () => void;
  onSubmit: (data: SupplierFormData) => void;
}

function SupplierFormModal({ supplier, onClose, onSubmit }: SupplierFormModalProps) {
  const [formData, setFormData] = useState<SupplierFormData>({
    name: supplier?.name || '',
    contactPerson: supplier?.contactPerson || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    paymentTerms: supplier?.paymentTerms || 'NET30',
    notes: supplier?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Supplier name is required');
      return;
    }

    if (formData.email && !formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      alert('Invalid email format');
      return;
    }

    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Supplier Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={255}
              placeholder="e.g., ABC Suppliers Ltd"
            />
          </div>

          {/* Contact Person */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
            <input
              type="text"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={255}
              placeholder="e.g., John Doe"
            />
          </div>

          {/* Email & Phone Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="supplier@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={50}
                placeholder="+256 700 123456"
              />
            </div>
          </div>

          {/* Address */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Full address..."
            />
          </div>

          {/* Payment Terms */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
            <select
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              aria-label="Select supplier payment terms"
              title="Select supplier payment terms"
            >
              {PAYMENT_TERMS.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label} - {term.description}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes about this supplier..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {supplier ? 'Update Supplier' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SuppliersPage;
