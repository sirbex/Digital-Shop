import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Filter, Download, DollarSign, TrendingUp, Calendar, Building2 } from 'lucide-react';

interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  vendorName: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
}

const paymentMethods = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

const formatCurrencyWithCode = (amount: number, currencyCode: string = 'UGX') => {
  try {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString()}`;
  }
};

export default function ExpensesPage() {
  const perms = usePermissions();
  const { settings } = useSettings();
  const formatCurrency = (amount: number) => formatCurrencyWithCode(amount, settings.currencyCode);
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    paymentMethod: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    expenseDate: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    description: '',
    amount: '',
    paymentMethod: 'CASH',
    vendorName: '',
    referenceNumber: '',
    notes: '',
  });

  // Fetch expenses
  const { data: expensesData, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', filters],
    queryFn: () => expensesApi.getAll({
      startDate: filters.startDate,
      endDate: filters.endDate,
      category: filters.category || undefined,
      paymentMethod: filters.paymentMethod || undefined,
    }),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expensesApi.getCategories(),
  });

  // Fetch summary
  const { data: summaryData } = useQuery({
    queryKey: ['expenses-summary', filters.startDate, filters.endDate],
    queryFn: () => expensesApi.getSummary({
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
  });

  const expenses: Expense[] = expensesData?.data?.data || [];
  const categories: ExpenseCategory[] = categoriesData?.data?.data || [];
  const summary = summaryData?.data?.data || { totalCount: 0, totalAmount: 0, avgAmount: 0 };

  // Get all unique categories (predefined + custom from expenses)
  const allCategories = [...new Set([
    ...categories.map(c => c.name),
    ...expenses.map(e => e.category)
  ])].sort();

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      setShowAddDialog(false);
      resetForm();
      setSuccess('Expense created successfully');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || 'Failed to create expense';
      setError(message);
      setSuccess(null);
      console.error('Create expense error:', err);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => expensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      setShowEditDialog(false);
      setSelectedExpense(null);
      resetForm();
      setSuccess('Expense updated successfully');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || 'Failed to update expense';
      setError(message);
      setSuccess(null);
      console.error('Update expense error:', err);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-summary'] });
      setShowDeleteDialog(false);
      setSelectedExpense(null);
      setSuccess('Expense deleted successfully');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      const message = err?.response?.data?.error || err?.message || 'Failed to delete expense';
      setError(message);
      setSuccess(null);
      console.error('Delete expense error:', err);
    },
  });

  const resetForm = () => {
    setFormData({
      expenseDate: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      description: '',
      amount: '',
      paymentMethod: 'CASH',
      vendorName: '',
      referenceNumber: '',
      notes: '',
    });
  };

  const handleAdd = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setFormData({
      expenseDate: expense.expenseDate.split('T')[0],
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      paymentMethod: expense.paymentMethod,
      vendorName: expense.vendorName || '',
      referenceNumber: expense.referenceNumber || '',
      notes: expense.notes || '',
    });
    setShowEditDialog(true);
  };

  const handleDelete = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowDeleteDialog(true);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
    });
  };

  const handleSubmitUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpense) return;
    updateMutation.mutate({
      id: selectedExpense.id,
      data: {
        ...formData,
        amount: parseFloat(formData.amount),
      },
    });
  };

  const handleConfirmDelete = () => {
    if (!selectedExpense) return;
    deleteMutation.mutate(selectedExpense.id);
  };

  const exportToCSV = () => {
    const headers = ['Expense #', 'Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Vendor', 'Reference'];
    const rows = expenses.map(e => [
      e.expenseNumber,
      e.expenseDate.split('T')[0],
      e.category,
      e.description,
      e.amount.toString(),
      e.paymentMethod,
      e.vendorName || '',
      e.referenceNumber || '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${filters.startDate}_${filters.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Error/Success Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-700">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Expenses</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Track and manage business expenses</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs sm:text-sm"
          >
            <Filter className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="text-xs sm:text-sm">
            <Download className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
            Export
          </Button>
          {perms.canCreateExpense && (
            <Button size="sm" onClick={handleAdd} className="text-xs sm:text-sm">
              <Plus className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Total Expenses</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(summary.totalAmount || 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Number of Expenses</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{summary.totalCount || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Average Expense</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold">{formatCurrency(summary.avgAmount || 0)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Building2 className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Period</span>
          </div>
          <p className="text-xs sm:text-sm font-medium">{filters.startDate} to {filters.endDate}</p>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <Label className="text-xs sm:text-sm">Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="text-xs sm:text-sm"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="text-xs sm:text-sm"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Category</Label>
              <Input
                list="expense-categories-filter"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                placeholder="All Categories"
                className="text-xs sm:text-sm"
              />
              <datalist id="expense-categories-filter">
                <option value="">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Payment Method</Label>
              <Select value={filters.paymentMethod} onValueChange={(value) => setFilters({ ...filters, paymentMethod: value })}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Methods</SelectItem>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm min-w-[100px]">Expense #</TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[90px]">Date</TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[100px]">Category</TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[150px]">Description</TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[100px] text-right">Amount</TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[80px]">Payment</TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[100px]">Vendor</TableHead>
                <TableHead className="text-xs sm:text-sm min-w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingExpenses ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs sm:text-sm">Loading...</TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs sm:text-sm text-muted-foreground">
                    No expenses found for the selected period
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-xs sm:text-sm font-medium">{expense.expenseNumber}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{expense.expenseDate.split('T')[0]}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{expense.category}</TableCell>
                    <TableCell className="text-xs sm:text-sm max-w-[200px] truncate">{expense.description}</TableCell>
                    <TableCell className="text-xs sm:text-sm text-right font-medium text-red-600">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      {paymentMethods.find(pm => pm.value === expense.paymentMethod)?.label || expense.paymentMethod}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{expense.vendorName || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {perms.canEditExpense && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(expense)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {perms.canDeleteExpense && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(expense)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>Record a new business expense</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs sm:text-sm">Date *</Label>
                  <Input
                    type="date"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    required
                    className="text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    className="text-xs sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Category *</Label>
                <Input
                  list="expense-categories-list"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Type or select category"
                  required
                  className="text-xs sm:text-sm"
                />
                <datalist id="expense-categories-list">
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground mt-1">Select existing or type new category</p>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What was this expense for?"
                  required
                  rows={2}
                  className="text-xs sm:text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs sm:text-sm">Payment Method</Label>
                  <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((pm) => (
                        <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Reference #</Label>
                  <Input
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                    placeholder="Receipt/Invoice #"
                    className="text-xs sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Vendor/Payee</Label>
                <Input
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  placeholder="Who did you pay?"
                  className="text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitUpdate}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs sm:text-sm">Date *</Label>
                  <Input
                    type="date"
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    required
                    className="text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="text-xs sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Category *</Label>
                <Input
                  list="expense-categories-list-edit"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Type or select category"
                  required
                  className="text-xs sm:text-sm"
                />
                <datalist id="expense-categories-list-edit">
                  {allCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground mt-1">Select existing or type new category</p>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={2}
                  className="text-xs sm:text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs sm:text-sm">Payment Method</Label>
                  <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                    <SelectTrigger className="text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((pm) => (
                        <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Reference #</Label>
                  <Input
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                    className="text-xs sm:text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Vendor/Payee</Label>
                <Input
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  className="text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Update Expense'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete expense {selectedExpense?.expenseNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
