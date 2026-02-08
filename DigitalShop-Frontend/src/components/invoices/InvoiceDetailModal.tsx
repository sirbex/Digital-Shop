import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { invoicesApi } from '../../lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  CreditCardIcon,
  FileTextIcon,
  CalendarIcon,
  ClockIcon,
  Loader2Icon,
  AlertCircleIcon,
  ExternalLinkIcon,
  DownloadIcon,
  PrinterIcon,
} from 'lucide-react';

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  saleId: string | null;
  saleNumber: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface InvoicePayment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  referenceNumber: string | null;
  notes: string | null;
  processedByName: string | null;
  createdAt: string;
}

interface InvoiceDetailModalProps {
  invoiceId: string;
  onClose: () => void;
  onRecordPayment?: () => void;
}

export default function InvoiceDetailModal({
  invoiceId,
  onClose,
  onRecordPayment,
}: InvoiceDetailModalProps) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvoiceDetails();
  }, [invoiceId]);

  const loadInvoiceDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await invoicesApi.getById(invoiceId);
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setInvoice(data);
        setPayments(data.payments || []);
      } else {
        setError(response.data.error || 'Failed to load invoice details');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load invoice details');
    } finally {
      setIsLoading(false);
    }
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
      PAID: { label: 'Paid', variant: 'default', className: 'bg-green-500' },
      PARTIALLY_PAID: { label: 'Partially Paid', variant: 'secondary', className: 'bg-yellow-500 text-white' },
      UNPAID: { label: 'Unpaid', variant: 'destructive', className: 'bg-red-500' },
      DRAFT: { label: 'Draft', variant: 'outline' },
      SENT: { label: 'Sent', variant: 'secondary' },
      OVERDUE: { label: 'Overdue', variant: 'destructive', className: 'bg-red-700' },
      CANCELLED: { label: 'Cancelled', variant: 'outline' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' as const };
    return (
      <Badge variant={config.variant} className={config.className || ''}>
        {config.label}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: 'Cash',
      CARD: 'Card',
      MOBILE_MONEY: 'Mobile Money',
      BANK_TRANSFER: 'Bank Transfer',
      CREDIT: 'Credit',
    };
    return labels[method] || method;
  };

  const formatCurrencyPlain = (amount: number) => {
    return `UGX ${Math.abs(amount).toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PAID: 'Paid', PARTIALLY_PAID: 'Partially Paid', UNPAID: 'Unpaid',
      DRAFT: 'Draft', SENT: 'Sent', OVERDUE: 'Overdue', CANCELLED: 'Cancelled',
    };
    return labels[status] || status;
  };

  const generateInvoicePdf = (action: 'download' | 'print' = 'download') => {
    if (!invoice) return;

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DigitalShop', 14, 20);

    doc.setFontSize(14);
    doc.text('INVOICE', 196, 20, { align: 'right' });

    // Invoice number & status
    doc.setFontSize(11);
    doc.text(invoice.invoiceNumber, 196, 28, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Status: ${getStatusLabel(invoice.status)}`, 196, 34, { align: 'right' });

    // Customer info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 14, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customerName, 14, 44);

    // Dates
    let yPos = 52;
    doc.setFont('helvetica', 'bold');
    doc.text('Issue Date:', 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(invoice.issueDate), 50, yPos);

    doc.setFont('helvetica', 'bold');
    doc.text('Due Date:', 110, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(invoice.dueDate), 140, yPos);

    if (invoice.saleNumber) {
      yPos += 6;
      doc.setFont('helvetica', 'bold');
      doc.text('Sale Ref:', 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.saleNumber, 50, yPos);
    }

    // Divider
    yPos += 6;
    doc.setLineWidth(0.5);
    doc.line(14, yPos, 196, yPos);
    yPos += 4;

    // Financial summary table
    const financialRows: string[][] = [
      ['Subtotal', formatCurrencyPlain(invoice.subtotal)],
    ];
    if (invoice.taxAmount > 0) {
      financialRows.push(['Tax', formatCurrencyPlain(invoice.taxAmount)]);
    }
    if (invoice.discountAmount > 0) {
      financialRows.push(['Discount', `-${formatCurrencyPlain(invoice.discountAmount)}`]);
    }
    financialRows.push(['Total Amount', formatCurrencyPlain(invoice.totalAmount)]);
    financialRows.push(['Amount Paid', formatCurrencyPlain(invoice.amountPaid)]);
    financialRows.push(['Balance Due', formatCurrencyPlain(invoice.amountDue)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Amount']],
      body: financialRows,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], fontSize: 10 },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 50, halign: 'right' },
      },
      didParseCell: (data) => {
        // Bold the Total and Balance Due rows
        const rowIndex = data.row.index;
        const totalRowIdx = financialRows.length - 3;
        if (rowIndex >= totalRowIdx) {
          data.cell.styles.fontStyle = 'bold';
        }
        // Red for Balance Due
        if (rowIndex === financialRows.length - 1 && invoice.amountDue > 0) {
          data.cell.styles.textColor = [220, 38, 38];
        }
        // Green for Amount Paid
        if (rowIndex === financialRows.length - 2) {
          data.cell.styles.textColor = [22, 163, 74];
        }
      },
      margin: { left: 14, right: 14 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let afterFinancialY = (doc as any).lastAutoTable?.finalY || yPos + 50;

    // Notes
    if (invoice.notes) {
      afterFinancialY += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Notes:', 14, afterFinancialY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const noteLines = doc.splitTextToSize(invoice.notes, 170);
      doc.text(noteLines, 14, afterFinancialY + 6);
      afterFinancialY += 6 + noteLines.length * 5;
    }

    // Payment History
    if (payments.length > 0) {
      afterFinancialY += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Payment History', 14, afterFinancialY);

      const paymentRows = payments.map((p) => [
        p.receiptNumber,
        formatDate(p.paymentDate),
        getPaymentMethodLabel(p.paymentMethod),
        formatCurrencyPlain(p.amount),
        p.processedByName || '-',
      ]);

      // Totals row
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      paymentRows.push(['', '', 'Total Paid', formatCurrencyPlain(totalPaid), '']);

      autoTable(doc, {
        startY: afterFinancialY + 4,
        head: [['Receipt #', 'Date', 'Method', 'Amount', 'Processed By']],
        body: paymentRows,
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: {
          3: { halign: 'right' },
        },
        didParseCell: (data) => {
          // Bold the totals row
          if (data.row.index === paymentRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [22, 163, 74];
          }
        },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Generated on ${new Date().toLocaleDateString('en-UG')} | Page ${i} of ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
      doc.setTextColor(0, 0, 0);
    }

    if (action === 'print') {
      doc.autoPrint();
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onafterprint = () => URL.revokeObjectURL(url);
      }
    } else {
      doc.save(`${invoice.invoiceNumber}.pdf`);
    }
  };

  const isPayable = invoice && ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && invoice.amountDue > 0;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Invoice Details
          </DialogTitle>
          <DialogDescription>
            {isLoading ? 'Loading...' : invoice ? invoice.invoiceNumber : 'Invoice'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading invoice details...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-500">
            <AlertCircleIcon className="h-6 w-6 mr-2" />
            <span>{error}</span>
          </div>
        ) : invoice ? (
          <div className="space-y-5">
            {/* Invoice Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{invoice.invoiceNumber}</h3>
                <p className="text-sm text-gray-500">Customer: {invoice.customerName}</p>
              </div>
              {getStatusBadge(invoice.status)}
            </div>

            {/* Dates & Sale Info */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Issue Date</p>
                  <p className="text-sm font-medium">{formatDate(invoice.issueDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Due Date</p>
                  <p className="text-sm font-medium">{formatDate(invoice.dueDate)}</p>
                </div>
              </div>
              {invoice.saleNumber && (
                <div className="col-span-2 flex items-center gap-2">
                  <ExternalLinkIcon className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Linked Sale</p>
                    <p className="text-sm font-medium text-blue-600">{invoice.saleNumber}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Financial Breakdown */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2">
                <h4 className="text-sm font-semibold text-gray-700">Financial Summary</h4>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span>{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                )}
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-red-500">-{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total Amount</span>
                  <span>{formatCurrency(invoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid</span>
                  <span>{formatCurrency(invoice.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span className={invoice.amountDue > 0 ? 'text-red-600' : 'text-green-600'}>
                    Balance Due
                  </span>
                  <span className={invoice.amountDue > 0 ? 'text-red-600' : 'text-green-600'}>
                    {formatCurrency(invoice.amountDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-700 font-semibold mb-1">Notes</p>
                <p className="text-sm text-yellow-800">{invoice.notes}</p>
              </div>
            )}

            {/* Payment History */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">
                  Payment History ({payments.length})
                </h4>
              </div>

              {payments.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No payments recorded yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Processed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-xs">
                          {payment.receiptNumber}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getPaymentMethodLabel(payment.paymentMethod)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600 text-xs">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {payment.processedByName || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell colSpan={3} className="text-right text-xs">
                        Total Paid
                      </TableCell>
                      <TableCell className="text-right text-green-600 text-xs">
                        {formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Created Date */}
            <p className="text-xs text-gray-400 text-right">
              Created: {formatDateTime(invoice.createdAt)}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => generateInvoicePdf('download')}>
                  <DownloadIcon className="h-4 w-4 mr-1" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => generateInvoicePdf('print')}>
                  <PrinterIcon className="h-4 w-4 mr-1" />
                  Print
                </Button>
              </div>
              {isPayable && onRecordPayment && (
                <Button onClick={onRecordPayment}>
                  <CreditCardIcon className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
