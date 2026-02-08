import { useState, useEffect, useRef } from 'react';
import { customersApi } from '../../lib/api';
import QuickAddCustomerModal from '../customers/QuickAddCustomerModal';

interface CustomerSelectorProps {
  selectedCustomer: any | null;
  onSelectCustomer: (customer: any | null) => void;
  saleTotal: number;
}

const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

export default function CustomerSelector({ selectedCustomer, onSelectCustomer, saleTotal }: CustomerSelectorProps) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (search.length < 2) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await customersApi.search(search);
        if (response.data.success) {
          setCustomers(response.data.data || []);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error('Failed to search customers:', error);
        setCustomers([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  const handleSelect = (customer: any) => {
    onSelectCustomer(customer);
    setSearch('');
    setShowDropdown(false);
  };

  const handleQuickAddSuccess = (newCustomer: any) => {
    // Automatically select the newly created customer
    onSelectCustomer(newCustomer);
    setShowQuickAdd(false);
  };

  // Calculate credit info - matches SamplePOS
  const creditLimit = selectedCustomer?.creditLimit || 0;
  const currentBalance = selectedCustomer?.balance || 0;
  const availableCredit = creditLimit - currentBalance;
  const canUseCredit = selectedCustomer && availableCredit >= saleTotal;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Optional)</label>
      {selectedCustomer ? (
        <div className="border border-gray-300 rounded-lg p-3 bg-gray-50">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base text-gray-900 truncate">{selectedCustomer.name}</div>
              {selectedCustomer.email && <div className="text-xs text-gray-500 truncate">{selectedCustomer.email}</div>}
              {selectedCustomer.phone && <div className="text-xs text-gray-500">{selectedCustomer.phone}</div>}
              
              {/* Credit Info - matches SamplePOS display */}
              <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-gray-600">Credit Limit:</div>
                  <div className="text-right font-medium">{formatCurrency(creditLimit)}</div>
                  
                  <div className="text-gray-600">Current Balance:</div>
                  <div className={`text-right font-medium ${currentBalance > 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                    {formatCurrency(currentBalance)}
                  </div>
                  
                  <div className="text-gray-600">Available Credit:</div>
                  <div className={`text-right font-bold ${availableCredit < 0 ? 'text-red-600' : availableCredit < saleTotal ? 'text-yellow-600' : 'text-green-600'}`}>
                    {formatCurrency(availableCredit)}
                  </div>
                </div>
              </div>

              {/* Credit warning - matches SamplePOS */}
              {!canUseCredit && saleTotal > 0 && (
                <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Insufficient credit for this sale ({formatCurrency(saleTotal)})</span>
                </div>
              )}
            </div>
            <button
              onClick={() => onSelectCustomer(null)}
              className="text-xs text-red-600 hover:text-red-800 flex-shrink-0 px-2 py-1 hover:bg-red-50 rounded"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2" ref={dropdownRef}>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => search.length >= 2 && setShowDropdown(true)}
                placeholder="Search by name, email, or phone..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-label="Search customers"
              />
              {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {isLoading ? (
                    <div className="p-3 text-xs text-gray-500">Loading...</div>
                  ) : customers && customers.length > 0 ? (
                    customers.map((customer: any) => {
                      const custAvailable = (customer.creditLimit || 0) - (customer.balance || 0);
                      return (
                        <button
                          key={customer.id}
                          onClick={() => handleSelect(customer)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:bg-blue-100 border-b last:border-b-0"
                        >
                          <div className="font-semibold text-sm text-gray-900 truncate">{customer.name}</div>
                          {customer.email && <div className="text-xs text-gray-500 truncate">{customer.email}</div>}
                          {customer.phone && <div className="text-xs text-gray-500">{customer.phone}</div>}
                          <div className="flex justify-between text-xs text-gray-600 mt-1">
                            <span>Limit: {formatCurrency(customer.creditLimit || 0)}</span>
                            <span className={custAvailable < 0 ? 'text-red-600 font-medium' : custAvailable > 0 ? 'text-green-600' : 'text-gray-600'}>
                              Available: {formatCurrency(custAvailable)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-3 text-xs text-gray-500">
                      {search.length >= 2 ? 'No customers found' : 'Type at least 2 characters'}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Quick Add Customer Button - matches SamplePOS */}
            <button
              onClick={() => setShowQuickAdd(true)}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg flex items-center gap-1 whitespace-nowrap"
              title="Quick add new customer"
            >
              <span>+</span>
              <span className="hidden sm:inline">Add Customer</span>
            </button>
          </div>
          <p className="text-xs text-gray-500">💡 Search for existing customers or quick-add a new one</p>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      <QuickAddCustomerModal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  );
}