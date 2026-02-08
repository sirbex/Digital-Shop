import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { customersApi, invoicesApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeftIcon,
  CreditCardIcon,
  FileTextIcon,
  PrinterIcon,
  DownloadIcon,
} from 'lucide-react';
import RecordPaymentModal from '../components/invoices/RecordPaymentModal';
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal';
import { usePermissions } from '../hooks/usePermissions';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  balance: number;
  creditLimit: number;
  groupName: string;
  isActive: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' | 'CANCELLED';
  saleNumber?: string;
}

// QuickBooks-style ledger entry (SSOT for transaction history)
interface LedgerEntry {
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

// Account summary with aging (like QuickBooks)
interface AccountSummary {
  customer: Customer;
  totalInvoices: number;
  totalPayments: number;
  currentBalance: number;
  availableCredit: number;
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const perms = usePermissions();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceDetail, setShowInvoiceDetail] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  
  // Statement date filters
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');

  useEffect(() => {
    if (id) {
      loadCustomerData();
    }
  }, [id]);

  const loadCustomerData = async () => {
    try {
      setIsLoading(true);

      // Load customer details
      const customerResponse = await customersApi.getById(id!);
      if (customerResponse.data.success) {
        setCustomer(customerResponse.data.data);
      }

      // Load invoices
      const invoicesResponse = await customersApi.getInvoices(id!);
      if (invoicesResponse.data.success) {
        const invoicesData = invoicesResponse.data.data;
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      }

      // Load QuickBooks-style ledger (SSOT for transaction history)
      // Note: Removed separate transactions API call - ledger is more comprehensive
      await loadLedger();

      // Load account summary with aging
      const summaryResponse = await customersApi.getAccountSummary(id!);
      if (summaryResponse.data.success) {
        const summaryData = summaryResponse.data.data;
        // Map API response to frontend interface
        setAccountSummary({
          customer: summaryData.customer,
          totalInvoices: summaryData.totalInvoiced || 0,
          totalPayments: summaryData.totalPaid || 0,
          currentBalance: summaryData.customer?.balance || 0,
          availableCredit: summaryData.customer?.availableCredit || 0,
          aging: {
            current: summaryData.aging?.current || 0,
            days1to30: summaryData.aging?.overdue1to30 || 0,
            days31to60: summaryData.aging?.overdue31to60 || 0,
            days61to90: summaryData.aging?.overdue61to90 || 0,
            over90: summaryData.aging?.overdueOver90 || 0,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load customer data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLedger = async (startDate?: string, endDate?: string) => {
    try {
      const params: { startDate?: string; endDate?: string } = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const ledgerResponse = await customersApi.getLedger(id!, params);
      if (ledgerResponse.data.success) {
        const ledgerData = ledgerResponse.data.data;
        // Map API response to frontend interface
        const entries = ledgerData?.ledger || [];
        setLedger(entries.map((e: any) => ({
          date: e.transactionDate,
          type: e.type,
          referenceNumber: e.referenceNumber,
          description: e.description,
          debit: e.debit,
          credit: e.credit,
          runningBalance: e.runningBalance,
        })));
      }
    } catch (error) {
      console.error('Failed to load ledger:', error);
    }
  };

  const handleStatementFilter = () => {
    loadLedger(statementStartDate || undefined, statementEndDate || undefined);
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handlePaymentRecorded = () => {
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    loadCustomerData(); // Reload to reflect new payment
  };

  const handleViewInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setShowInvoiceDetail(true);
  };

  const handleInvoiceDetailClose = () => {
    setShowInvoiceDetail(false);
    setSelectedInvoiceId(null);
  };

  const handleRecordPaymentFromDetail = () => {
    // Close detail modal, then open payment modal for the same invoice
    if (selectedInvoiceId) {
      const inv = invoices.find(i => i.id === selectedInvoiceId);
      if (inv) {
        setShowInvoiceDetail(false);
        setSelectedInvoiceId(null);
        handleRecordPayment(inv);
      }
    }
  };

  const getInvoiceStatusBadge = (status: Invoice['status']) => {
    const statusConfig: Record<Invoice['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
      PAID: { label: 'Paid', variant: 'default', className: 'bg-green-500' },
      PARTIALLY_PAID: { label: 'Partial', variant: 'secondary', className: 'bg-yellow-500' },
      UNPAID: { label: 'Unpaid', variant: 'destructive', className: 'bg-red-500' },
      OVERDUE: { label: 'Overdue', variant: 'destructive', className: 'bg-red-700' },
      DRAFT: { label: 'Draft', variant: 'outline' },
      SENT: { label: 'Sent', variant: 'secondary' },
      CANCELLED: { label: 'Cancelled', variant: 'outline' },
    };

    const config = statusConfig[status];
    return (
      <Badge variant={config.variant} className={config.className || ''}>
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format currency as plain number for PDF (no HTML entities)
  const formatCurrencyPlain = (amount: number) => {
    return `UGX ${Math.abs(amount).toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  /**
   * Generate PDF of the customer statement using jsPDF + autoTable
   */
  const generateStatementPdf = () => {
    if (!customer) return;

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DigitalShop', 14, 20);

    doc.setFontSize(14);
    doc.text('Customer Statement', 14, 30);

    // Customer info section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${customer.name}`, 14, 42);
    if (customer.phone) doc.text(`Phone: ${customer.phone}`, 14, 48);
    if (customer.email) doc.text(`Email: ${customer.email}`, 14, 54);
    if (customer.address) doc.text(`Address: ${customer.address}`, 14, 60);

    // Date range and balance info (right side)
    const dateRangeText = statementStartDate || statementEndDate
      ? `Period: ${statementStartDate || 'Start'} to ${statementEndDate || 'Present'}`
      : `As of: ${new Date().toLocaleDateString('en-UG')}`;
    doc.text(dateRangeText, 196, 42, { align: 'right' });

    const balanceAmount = Math.abs(customer.balance);
    const balanceLabel = customer.balance < 0 ? 'Outstanding (Owes)' : 'Credit Balance';
    doc.setFont('helvetica', 'bold');
    doc.text(`${balanceLabel}: ${formatCurrencyPlain(balanceAmount)}`, 196, 48, { align: 'right' });
    doc.text(`Credit Limit: ${formatCurrencyPlain(customer.creditLimit)}`, 196, 54, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // Divider line
    const infoEndY = customer.address ? 66 : customer.email ? 60 : customer.phone ? 54 : 48;
    doc.setLineWidth(0.5);
    doc.line(14, infoEndY, 196, infoEndY);

    // Statement table
    if (ledger.length === 0) {
      doc.setFontSize(12);
      doc.text('No statement entries found for the selected period.', 14, infoEndY + 14);
    } else {
      const tableData = ledger.map((entry) => [
        formatDate(entry.date),
        entry.type,
        entry.referenceNumber,
        entry.description,
        entry.debit > 0 ? formatCurrencyPlain(entry.debit) : '-',
        entry.credit > 0 ? formatCurrencyPlain(entry.credit) : '-',
        `${formatCurrencyPlain(Math.abs(entry.runningBalance))} ${entry.runningBalance < 0 ? 'DR' : 'CR'}`,
      ]);

      // Totals row
      const totalDebit = ledger.reduce((sum, e) => sum + e.debit, 0);
      const totalCredit = ledger.reduce((sum, e) => sum + e.credit, 0);
      const closingBalance = ledger[ledger.length - 1]?.runningBalance || 0;

      tableData.push([
        '', '', '', 'TOTALS',
        formatCurrencyPlain(totalDebit),
        formatCurrencyPlain(totalCredit),
        `${formatCurrencyPlain(Math.abs(closingBalance))} ${closingBalance < 0 ? 'DR' : 'CR'}`,
      ]);

      autoTable(doc, {
        startY: infoEndY + 6,
        head: [['Date', 'Type', 'Reference', 'Description', 'Debit (Charges)', 'Credit (Payments)', 'Balance']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 20 },
          2: { cellWidth: 28 },
          3: { cellWidth: 40 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'right', cellWidth: 28 },
          6: { halign: 'right', cellWidth: 28 },
        },
        // Style the totals row (last row) with bold
        didParseCell: (data) => {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [229, 231, 235]; // gray-200
          }
        },
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${new Date().toLocaleString('en-UG')}`, 14, pageHeight - 10);
    doc.text('DigitalShop — Customer Statement', 196, pageHeight - 10, { align: 'right' });

    // Save/download
    const safeName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`Statement_${safeName}_${dateStr}.pdf`);
  };

  /**
   * Print the customer statement via browser print dialog
   */
  const handlePrintStatement = () => {
    if (!customer) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Could not open print window. Please check your popup blocker settings.');
      return;
    }

    // Build ledger rows HTML
    const ledgerRows = ledger.map((entry) => `
      <tr style="${entry.type === 'PAYMENT' ? 'background-color: #f0fdf4;' : ''}">
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${formatDate(entry.date)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: white; background-color: ${entry.type === 'PAYMENT' ? '#22c55e' : '#3b82f6'};">
            ${entry.type}
          </span>
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 12px;">${entry.referenceNumber}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${entry.description}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626; font-weight: 500;">
          ${entry.debit > 0 ? formatCurrencyPlain(entry.debit) : '-'}
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #16a34a; font-weight: 500;">
          ${entry.credit > 0 ? formatCurrencyPlain(entry.credit) : '-'}
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: ${entry.runningBalance < 0 ? '#dc2626' : '#16a34a'};">
          ${formatCurrencyPlain(Math.abs(entry.runningBalance))} ${entry.runningBalance < 0 ? 'DR' : 'CR'}
        </td>
      </tr>
    `).join('');

    const totalDebit = ledger.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = ledger.reduce((sum, e) => sum + e.credit, 0);
    const closingBalance = ledger[ledger.length - 1]?.runningBalance || 0;

    const dateRangeText = statementStartDate || statementEndDate
      ? `Period: ${statementStartDate || 'Start'} to ${statementEndDate || 'Present'}`
      : `As of: ${new Date().toLocaleDateString('en-UG')}`;

    const balanceLabel = customer.balance < 0 ? 'Outstanding (Owes)' : 'Credit Balance';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer Statement - ${customer.name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; padding: 20px; font-size: 13px; color: #1f2937; }
            @media print {
              body { padding: 10px; }
              .no-print { display: none !important; }
            }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
            .header h1 { font-size: 22px; font-weight: bold; }
            .header h2 { font-size: 16px; color: #374151; margin-top: 4px; }
            .customer-info { margin-bottom: 16px; }
            .customer-info p { margin: 2px 0; }
            .meta-right { text-align: right; }
            .meta-right p { margin: 2px 0; }
            .balance-highlight { font-weight: bold; font-size: 14px; }
            hr { border: none; border-top: 1px solid #d1d5db; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background-color: #3b82f6; color: white; padding: 8px; text-align: left; font-size: 12px; }
            th.right { text-align: right; }
            .totals-row { background-color: #e5e7eb; font-weight: bold; }
            .totals-row td { padding: 8px; border-bottom: 2px solid #9ca3af; }
            .empty-message { text-align: center; padding: 40px; color: #6b7280; }
            .footer { margin-top: 24px; font-size: 10px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>DigitalShop</h1>
              <h2>Customer Statement</h2>
            </div>
            <div class="meta-right">
              <p>${dateRangeText}</p>
              <p class="balance-highlight">${balanceLabel}: ${formatCurrencyPlain(Math.abs(customer.balance))}</p>
              <p>Credit Limit: ${formatCurrencyPlain(customer.creditLimit)}</p>
            </div>
          </div>
          <div class="customer-info">
            <p><strong>${customer.name}</strong></p>
            ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
            ${customer.email ? `<p>Email: ${customer.email}</p>` : ''}
            ${customer.address ? `<p>Address: ${customer.address}</p>` : ''}
          </div>
          <hr />
          ${ledger.length === 0 ? '<p class="empty-message">No statement entries found for the selected period.</p>' : `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th class="right">Debit (Charges)</th>
                  <th class="right">Credit (Payments)</th>
                  <th class="right">Balance</th>
                </tr>
              </thead>
              <tbody>
                ${ledgerRows}
                <tr class="totals-row">
                  <td colspan="4" style="text-align: right;">TOTALS</td>
                  <td style="text-align: right; color: #dc2626;">${formatCurrencyPlain(totalDebit)}</td>
                  <td style="text-align: right; color: #16a34a;">${formatCurrencyPlain(totalCredit)}</td>
                  <td style="text-align: right; color: ${closingBalance < 0 ? '#dc2626' : '#16a34a'};">
                    ${formatCurrencyPlain(Math.abs(closingBalance))} ${closingBalance < 0 ? 'DR' : 'CR'}
                  </td>
                </tr>
              </tbody>
            </table>
          `}
          <div class="footer">
            <p>Generated on ${new Date().toLocaleString('en-UG')} — DigitalShop Customer Statement</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    };
  };

  // SSOT: Use aging data from backend accountSummary (calculated via database triggers)
  // DO NOT recalculate aging on frontend - backend is the single source of truth
  const aging = accountSummary?.aging ?? {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Customer not found</p>
          <Button onClick={() => navigate('/customers')} className="mt-4">
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/customers')}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="text-gray-600">{customer.email} • {customer.phone}</p>
          </div>
        </div>
        <Badge variant={customer.isActive ? 'default' : 'destructive'}>
          {customer.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className={`grid grid-cols-1 ${perms.canViewCustomerBalance ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-4`}>
        {perms.canViewCustomerBalance && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Math.abs(customer.balance))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {customer.balance < 0 ? 'Owes us' : 'Credit balance'}
            </p>
          </CardContent>
        </Card>
        )}

        {perms.canViewCustomerBalance && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Credit Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(customer.creditLimit)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Available: {formatCurrency(Math.max(0, customer.creditLimit - Math.abs(customer.balance)))}
            </p>
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(invoices) ? invoices.length : 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {Array.isArray(invoices) ? invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID').length : 0} outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Customer Group
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customer.groupName || 'None'}</div>
            <p className="text-xs text-gray-500 mt-1">Membership tier</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {perms.canViewCustomerBalance && (
          <TabsTrigger value="statement">
            <FileTextIcon className="h-4 w-4 mr-1" />
            Statement
          </TabsTrigger>
          )}
          <TabsTrigger value="invoices">
            Invoices ({invoices.length})
          </TabsTrigger>
          {perms.canViewCustomerBalance && (
          <TabsTrigger value="aging">Aging Analysis</TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{customer.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{customer.phone || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium">{customer.address || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {!Array.isArray(invoices) || invoices.length === 0 ? (
                  <p className="text-gray-500">No invoices yet</p>
                ) : (
                  <div className="space-y-2">
                    {invoices.slice(0, 5).map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between border-b pb-2 cursor-pointer hover:bg-gray-50 rounded px-2 -mx-2 transition-colors"
                        onClick={() => handleViewInvoice(invoice.id)}
                      >
                        <div>
                          <p className="font-medium text-blue-600 hover:underline">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-gray-500">{formatDate(invoice.issueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(invoice.totalAmount)}</p>
                          {getInvoiceStatusBadge(invoice.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {perms.canViewCustomerBalance && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {!Array.isArray(ledger) || ledger.length === 0 ? (
                  <p className="text-gray-500">No activity yet</p>
                ) : (
                  <div className="space-y-2">
                    {ledger.slice(-5).reverse().map((entry, index) => (
                      <div key={index} className="flex items-center justify-between border-b pb-2">
                        <div>
                          <p className="font-medium">{entry.referenceNumber}</p>
                          <p className="text-sm text-gray-500">
                            {entry.type} • {formatDate(entry.date)}
                          </p>
                        </div>
                        <p className={`font-medium ${entry.credit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {entry.credit > 0 ? '+' + formatCurrency(entry.credit) : '-' + formatCurrency(entry.debit)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}
          </div>
        </TabsContent>

        {/* Statement Tab - QuickBooks-style Ledger */}
        <TabsContent value="statement" className="space-y-4">
          {/* Account Summary Header */}
          {accountSummary && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Opening Balance</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Invoiced</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(accountSummary.totalInvoices)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Payments</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(accountSummary.totalPayments)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Closing Balance</p>
                    <p className={`text-xl font-bold ${accountSummary.currentBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(accountSummary.currentBalance))}
                      <span className="text-xs ml-1">
                        {accountSummary.currentBalance < 0 ? '(Owes)' : '(Credit)'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Available Credit</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(accountSummary.availableCredit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileTextIcon className="h-5 w-5" />
                  Customer Statement
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrintStatement}>
                    <PrinterIcon className="h-4 w-4 mr-1" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={generateStatementPdf}>
                    <DownloadIcon className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Filter */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <label htmlFor="statement-start-date" className="text-sm font-medium">From:</label>
                  <input
                    id="statement-start-date"
                    type="date"
                    value={statementStartDate}
                    onChange={(e) => setStatementStartDate(e.target.value)}
                    className="px-3 py-1 border rounded"
                    aria-label="Statement start date"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="statement-end-date" className="text-sm font-medium">To:</label>
                  <input
                    id="statement-end-date"
                    type="date"
                    value={statementEndDate}
                    onChange={(e) => setStatementEndDate(e.target.value)}
                    className="px-3 py-1 border rounded"
                    aria-label="Statement end date"
                  />
                </div>
                <Button size="sm" onClick={handleStatementFilter}>
                  Apply Filter
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setStatementStartDate('');
                    setStatementEndDate('');
                    loadLedger();
                  }}
                >
                  Clear
                </Button>
              </div>

              {/* Ledger Table */}
              {!Array.isArray(ledger) || ledger.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No statement entries found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-100">
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit (Charges)</TableHead>
                      <TableHead className="text-right">Credit (Payments)</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((entry, index) => (
                      <TableRow key={index} className={entry.type === 'PAYMENT' ? 'bg-green-50' : ''}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.type === 'PAYMENT' ? 'default' : 'secondary'} 
                                 className={entry.type === 'PAYMENT' ? 'bg-green-500' : 'bg-blue-500'}>
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{entry.referenceNumber}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${entry.runningBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.abs(entry.runningBalance))}
                          <span className="text-xs ml-1 text-gray-500">
                            {entry.runningBalance < 0 ? 'DR' : 'CR'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell colSpan={4} className="text-right">TOTALS</TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(ledger.reduce((sum, e) => sum + e.debit, 0))}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(ledger.reduce((sum, e) => sum + e.credit, 0))}
                      </TableCell>
                      <TableCell className={`text-right ${(ledger[ledger.length - 1]?.runningBalance || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(Math.abs(ledger[ledger.length - 1]?.runningBalance || 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>All Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {!Array.isArray(invoices) || invoices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No invoices found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleViewInvoice(invoice.id)}
                      >
                        <TableCell className="font-medium text-blue-600 hover:underline">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.totalAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.amountPaid)}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(invoice.amountDue)}</TableCell>
                        <TableCell>{getInvoiceStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewInvoice(invoice.id)}
                            >
                              <FileTextIcon className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {perms.canRecordPayment && (invoice.status === 'UNPAID' || invoice.status === 'PARTIALLY_PAID' || invoice.status === 'OVERDUE' || invoice.status === 'DRAFT') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRecordPayment(invoice)}
                              >
                                <CreditCardIcon className="h-4 w-4 mr-1" />
                                Pay
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aging Analysis Tab */}
        <TabsContent value="aging">
          <Card>
            <CardHeader>
              <CardTitle>Aging Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Current</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold">{formatCurrency(aging.current)}</p>
                      <p className="text-xs text-gray-500">Not due yet</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">1-30 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-yellow-600">{formatCurrency(aging.days1to30)}</p>
                      <p className="text-xs text-gray-500">Overdue</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">31-60 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-orange-600">{formatCurrency(aging.days31to60)}</p>
                      <p className="text-xs text-gray-500">Overdue</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">61-90 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-red-600">{formatCurrency(aging.days61to90)}</p>
                      <p className="text-xs text-gray-500">Overdue</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Over 90 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-red-700">{formatCurrency(aging.over90)}</p>
                      <p className="text-xs text-gray-500">Critical</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-semibold">Total Outstanding</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(aging.current + aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.over90)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <RecordPaymentModal
          invoice={selectedInvoice}
          onClose={() => setShowPaymentModal(false)}
          onPaymentRecorded={handlePaymentRecorded}
        />
      )}

      {/* Invoice Detail Modal */}
      {showInvoiceDetail && selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={handleInvoiceDetailClose}
          onRecordPayment={handleRecordPaymentFromDetail}
        />
      )}
    </div>
  );
}
