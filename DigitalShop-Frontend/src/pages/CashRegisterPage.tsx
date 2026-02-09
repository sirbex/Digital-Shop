import { useState, useEffect } from 'react';
import { z } from 'zod';
import { api } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';
import { useSettings } from '../contexts/SettingsContext';
import { SessionOpenModal } from '../components/cash-register/SessionOpenModal';
import { SessionCloseModal } from '../components/cash-register/SessionCloseModal';
import { CashMovementForm } from '../components/cash-register/CashMovementForm';
import { OpenSessionSchema, CloseSessionSchema, CreateCashMovementSchema } from '@shared/zod/cashRegister';

export function CashRegisterPage() {
  const perms = usePermissions();
  const { settings } = useSettings();
  const cs = settings.currencySymbol;
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [cashMovements, setCashMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCashMovement, setShowCashMovement] = useState(false);
  const [error, _setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCurrentSession();
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSession) {
      loadCashMovements(currentSession.id);
    }
  }, [currentSession]);

  const loadCurrentSession = async () => {
    try {
      const response = await api.get('/cash-register/current-session');
      if (response.data.success && response.data.data) {
        setCurrentSession(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load current session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await api.get('/cash-register/sessions');
      if (response.data.success) {
        setSessions(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadCashMovements = async (sessionId: string) => {
    try {
      const response = await api.get(`/cash-register/sessions/${sessionId}/movements`);
      if (response.data.success) {
        setCashMovements(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load cash movements:', error);
    }
  };

  const handleOpenSession = async (data: z.infer<typeof OpenSessionSchema>) => {
    try {
      const response = await api.post('/cash-register/sessions/open', data);
      if (response.data.success) {
        setCurrentSession(response.data.data);
        setSuccess('Session opened successfully!');
        loadSessions();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(response.data.error || 'Failed to open session');
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message);
    }
  };

  const handleCloseSession = async (data: z.infer<typeof CloseSessionSchema>) => {
    try {
      const response = await api.post('/cash-register/sessions/close', data);
      if (response.data.success) {
        setCurrentSession(null);
        setSuccess('Session closed successfully!');
        loadSessions();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(response.data.error || 'Failed to close session');
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message);
    }
  };

  const handleCashMovement = async (data: z.infer<typeof CreateCashMovementSchema>) => {
    try {
      const response = await api.post('/cash-register/cash-movements', data);
      if (response.data.success) {
        setSuccess('Cash movement recorded successfully!');
        loadCurrentSession(); // Reload to get updated totals
        loadCashMovements(currentSession.id);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(response.data.error || 'Failed to record cash movement');
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || err.message);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading cash register...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cash Register</h1>
        {currentSession ? (
          <div className="flex gap-2">
            {perms.canRecordCashMovement && (
              <button
                onClick={() => setShowCashMovement(!showCashMovement)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Cash In/Out
              </button>
            )}
            {perms.canCloseRegister && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Close Session
              </button>
            )}
          </div>
        ) : (
          perms.canOpenRegister && (
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Open Session
            </button>
          )
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Current Session */}
      {currentSession ? (
        <div className="space-y-6">
          {/* Session Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Opening Float</p>
              <p className="text-2xl font-bold text-gray-900">
                {cs} {currentSession.openingFloat.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Cash Sales</p>
              <p className="text-2xl font-bold text-green-600">
                {cs} {currentSession.totalCashSales.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Card Sales</p>
              <p className="text-2xl font-bold text-blue-600">
                {cs} {currentSession.totalCardSales.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-600">Expected Cash</p>
              <p className="text-2xl font-bold text-gray-900">
                {cs} {(currentSession.openingFloat + currentSession.totalCashSales).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Cash Movement Form */}
          {showCashMovement && (
            <CashMovementForm
              sessionId={currentSession.id}
              onSubmit={handleCashMovement}
              onCancel={() => setShowCashMovement(false)}
            />
          )}

          {/* Cash Movements History */}
          {cashMovements.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold">Cash Movements</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cashMovements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="px-6 py-4 text-sm">
                          {new Date(movement.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            movement.type === 'CASH_IN' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {movement.type === 'CASH_IN' ? 'Cash In' : 'Cash Out'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {movement.type === 'CASH_IN' ? '+' : '-'}{cs} {movement.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {movement.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Session</h3>
          <p className="text-gray-600 mb-6">
            Open a new cash register session to start accepting payments
          </p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Open Session
          </button>
        </div>
      )}

      {/* Session History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Recent Sessions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opening</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">
                      {new Date(session.openedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {session.userName || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {cs} {session.openingFloat.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {session.closingCash !== null 
                        ? `${cs} ${session.closingCash.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {session.cashVariance !== null ? (
                        <span className={session.cashVariance >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {session.cashVariance >= 0 ? '+' : ''}{session.cashVariance.toFixed(2)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        session.status === 'OPEN'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <SessionOpenModal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        onOpenSession={handleOpenSession}
      />
      {currentSession && (
        <SessionCloseModal
          isOpen={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          onCloseSession={handleCloseSession}
          session={currentSession}
        />
      )}
    </div>
  );
}
