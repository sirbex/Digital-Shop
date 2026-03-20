import { useState, useEffect, useCallback } from 'react';
import { invoicesApi } from '../lib/api';
import { useSettings } from '../contexts/SettingsContext';

interface CheckEntry {
  id: string;
  receiptNumber: string;
  source: 'CUSTOMER' | 'SUPPLIER';
  partyName: string;
  partyId: string;
  paymentDate: string;
  amount: number;
  checkNumber: string | null;
  checkStatus: string | null;
  bankName: string | null;
  checkDate: string | null;
  referenceNumber: string | null;
  notes: string | null;
  processedByName: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  RECEIVED: { label: 'Received', color: 'text-blue-700', bg: 'bg-blue-100' },
  DEPOSITED: { label: 'Deposited', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  CLEARED: { label: 'Cleared', color: 'text-green-700', bg: 'bg-green-100' },
  BOUNCED: { label: 'Bounced', color: 'text-red-700', bg: 'bg-red-100' },
  VOIDED: { label: 'Voided', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const NEXT_STATUS: Record<string, string[]> = {
  RECEIVED: ['DEPOSITED', 'VOIDED'],
  DEPOSITED: ['CLEARED', 'BOUNCED'],
  CLEARED: [],
  BOUNCED: [],
  VOIDED: [],
};

export function CheckRegisterPage() {
  const { settings } = useSettings();
  const [checks, setChecks] = useState<CheckEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmBounce, setConfirmBounce] = useState<CheckEntry | null>(null);

  const fetchChecks = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.checkStatus = statusFilter;
      if (sourceFilter) params.source = sourceFilter;

      const response = await invoicesApi.getCheckRegister(params);
      if (response.data.success) {
        setChecks(response.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load check register');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    fetchChecks();
  }, [fetchChecks]);

  const handleStatusUpdate = async (check: CheckEntry, newStatus: string) => {
    if (newStatus === 'BOUNCED') {
      setConfirmBounce(check);
      return;
    }

    setActionLoading(check.id);
    try {
      const response = await invoicesApi.updateCheckStatus(check.id, {
        checkStatus: newStatus,
        source: check.source,
      });
      if (response.data.success) {
        fetchChecks();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBounce = async () => {
    if (!confirmBounce) return;

    setActionLoading(confirmBounce.id);
    try {
      const response = await invoicesApi.bounceCheck(confirmBounce.id, {
        source: confirmBounce.source,
      });
      if (response.data.success) {
        setConfirmBounce(null);
        fetchChecks();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process bounced check');
    } finally {
      setActionLoading(null);
    }
  };

  // Summary stats
  const summary = {
    received: checks.filter(c => c.checkStatus === 'RECEIVED').reduce((s, c) => s + c.amount, 0),
    deposited: checks.filter(c => c.checkStatus === 'DEPOSITED').reduce((s, c) => s + c.amount, 0),
    cleared: checks.filter(c => c.checkStatus === 'CLEARED').reduce((s, c) => s + c.amount, 0),
    bounced: checks.filter(c => c.checkStatus === 'BOUNCED').reduce((s, c) => s + c.amount, 0),
    receivedCount: checks.filter(c => c.checkStatus === 'RECEIVED').length,
    depositedCount: checks.filter(c => c.checkStatus === 'DEPOSITED').length,
    clearedCount: checks.filter(c => c.checkStatus === 'CLEARED').length,
    bouncedCount: checks.filter(c => c.checkStatus === 'BOUNCED').length,
  };

  const fmt = (n: number) => `${settings.currencySymbol} ${n.toLocaleString()}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Check Register</h1>
        <p className="text-sm text-gray-500 mt-1">Track and manage all check payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium">In Hand</div>
          <div className="text-lg font-bold text-blue-800">{fmt(summary.received)}</div>
          <div className="text-xs text-blue-500">{summary.receivedCount} checks</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-xs text-yellow-600 font-medium">Deposited</div>
          <div className="text-lg font-bold text-yellow-800">{fmt(summary.deposited)}</div>
          <div className="text-xs text-yellow-500">{summary.depositedCount} checks</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-xs text-green-600 font-medium">Cleared</div>
          <div className="text-lg font-bold text-green-800">{fmt(summary.cleared)}</div>
          <div className="text-xs text-green-500">{summary.clearedCount} checks</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-xs text-red-600 font-medium">Bounced</div>
          <div className="text-lg font-bold text-red-800">{fmt(summary.bounced)}</div>
          <div className="text-xs text-red-500">{summary.bouncedCount} checks</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          aria-label="Filter by check status"
        >
          <option value="">All Statuses</option>
          <option value="RECEIVED">Received</option>
          <option value="DEPOSITED">Deposited</option>
          <option value="CLEARED">Cleared</option>
          <option value="BOUNCED">Bounced</option>
          <option value="VOIDED">Voided</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          aria-label="Filter by source"
        >
          <option value="">All Sources</option>
          <option value="CUSTOMER">Customer Payments</option>
          <option value="SUPPLIER">Supplier Payments</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading checks...</div>
      ) : checks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-gray-600 font-medium">No check payments found</p>
          <p className="text-gray-400 text-sm mt-1">Check payments will appear here when recorded</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From/To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {checks.map((check) => {
                  const status = STATUS_CONFIG[check.checkStatus || 'RECEIVED'];
                  const nextStatuses = NEXT_STATUS[check.checkStatus || 'RECEIVED'] || [];
                  const isProcessing = actionLoading === check.id;

                  return (
                    <tr key={check.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {check.checkNumber || '—'}
                        <div className="text-xs text-gray-400">{check.receiptNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          check.source === 'CUSTOMER' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {check.source === 'CUSTOMER' ? 'Customer' : 'Supplier'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{check.partyName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{check.bankName || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {check.checkDate
                          ? new Date(check.checkDate).toLocaleDateString()
                          : new Date(check.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{fmt(check.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {nextStatuses.length > 0 && (
                          <div className="flex gap-1">
                            {nextStatuses.map((ns) => (
                              <button
                                key={ns}
                                onClick={() => handleStatusUpdate(check, ns)}
                                disabled={isProcessing}
                                className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                                  ns === 'BOUNCED'
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : ns === 'VOIDED'
                                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    : ns === 'CLEARED'
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                              >
                                {isProcessing ? '...' : STATUS_CONFIG[ns]?.label || ns}
                              </button>
                            ))}
                          </div>
                        )}
                        {nextStatuses.length === 0 && (
                          <span className="text-xs text-gray-400">Final</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bounce Confirmation Modal */}
      {confirmBounce && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setConfirmBounce(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-700 mb-2">Confirm Bounced Check</h3>
            <div className="text-sm text-gray-600 space-y-2 mb-4">
              <p>
                This will <strong>reverse</strong> the payment of{' '}
                <strong>{fmt(confirmBounce.amount)}</strong> from{' '}
                <strong>{confirmBounce.partyName}</strong>.
              </p>
              <p>Check #{confirmBounce.checkNumber} ({confirmBounce.bankName || 'Unknown bank'})</p>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700">
                <strong>Warning:</strong> The payment will be deleted and the{' '}
                {confirmBounce.source === 'CUSTOMER' ? 'customer invoice balance' : 'supplier balance'}{' '}
                will be recalculated automatically. The {confirmBounce.source === 'CUSTOMER' ? 'customer' : 'supplier'}{' '}
                will owe this amount again.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBounce(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBounce}
                disabled={actionLoading === confirmBounce.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
              >
                {actionLoading === confirmBounce.id ? 'Processing...' : 'Confirm Bounce'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckRegisterPage;
