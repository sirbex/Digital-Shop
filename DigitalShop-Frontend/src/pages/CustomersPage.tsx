import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../lib/api';
import { CustomerForm } from '../components/forms/CustomerForm';
import { usePermissions } from '../hooks/usePermissions';
import { useSettings } from '../contexts/SettingsContext';

export function CustomersPage() {
  const navigate = useNavigate();
  const perms = usePermissions();
  const { settings } = useSettings();
  const cs = settings.currencySymbol;
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [customers, searchQuery, balanceFilter]);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await customersApi.getAll();
      if (response.data.success) {
        setCustomers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterCustomers = () => {
    let filtered = [...customers];

    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.phone && c.phone.includes(searchQuery)) ||
          (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (balanceFilter === 'positive') {
      filtered = filtered.filter((c) => c.balance > 0);
    } else if (balanceFilter === 'negative') {
      filtered = filtered.filter((c) => c.balance < 0);
    }

    setFilteredCustomers(filtered);
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading customers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        {perms.canCreateCustomer && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Customer
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </div>
        {perms.canViewCustomerBalance && (
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">With Outstanding Balance</p>
            <p className="text-2xl font-bold text-red-600">
              {customers.filter((c) => c.balance < 0).length}
            </p>
          </div>
        )}
        {perms.canViewCustomerBalance && (
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Receivables</p>
            <p className="text-2xl font-bold text-red-600">
              {cs}{' '}
              {Math.abs(
                customers.reduce((sum, c) => sum + Math.min(0, c.balance), 0)
              ).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {perms.canViewCustomerBalance && (
            <select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by balance"
            >
              <option value="">All Balances</option>
              <option value="positive">Positive Balance (Prepaid)</option>
              <option value="negative">Negative Balance (Owes Money)</option>
            </select>
          )}

          <div className="text-sm text-gray-600 flex items-center">
            Showing {filteredCustomers.length} of {customers.length}
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Group
              </th>
              {perms.canViewCustomerBalance && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Balance
                </th>
              )}
              {perms.canViewCustomerBalance && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Credit Limit
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={perms.canViewCustomerBalance ? 6 : 4} className="px-6 py-12 text-center text-gray-500">
                  No customers found
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr 
                  key={customer.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    {customer.email && (
                      <div className="text-sm text-gray-500">{customer.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {customer.phone || 'N/A'}
                    </div>
                    {customer.address && (
                      <div className="text-xs text-gray-500">{customer.address}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {customer.customerGroupName || 'No Group'}
                  </td>
                  {perms.canViewCustomerBalance && (
                    <td className="px-6 py-4">
                      <div
                        className={`text-sm font-medium ${
                          customer.balance < 0
                            ? 'text-red-600'
                            : customer.balance > 0
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {cs} {customer.balance.toLocaleString()}
                      </div>
                      {customer.balance < 0 && (
                        <div className="text-xs text-red-500">Owes money</div>
                      )}
                      {customer.balance > 0 && (
                        <div className="text-xs text-green-500">Prepaid</div>
                      )}
                    </td>
                  )}
                  {perms.canViewCustomerBalance && (
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {customer.creditLimit
                        ? `${cs} ${customer.creditLimit.toLocaleString()}`
                        : 'No limit'}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm space-x-2" onClick={(e) => e.stopPropagation()}>
                    {perms.canEditCustomer && (
                      <button
                        onClick={() => setEditingCustomer(customer)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    )}
                    <button 
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Forms */}
      {showAddModal && (
        <CustomerForm
          onSuccess={() => {
            setShowAddModal(false);
            loadCustomers();
          }}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {editingCustomer && (
        <CustomerForm
          customer={editingCustomer}
          onSuccess={() => {
            setEditingCustomer(null);
            loadCustomers();
          }}
          onCancel={() => setEditingCustomer(null)}
        />
      )}
    </div>
  );
}
