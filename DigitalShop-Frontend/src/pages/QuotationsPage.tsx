import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationsApi, productsApi, customersApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { format } from 'date-fns';
import {
  Plus, Pencil, Trash2, Send, Check, X, ShoppingCart,
  FileText, Eye, Search, Download,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ──

interface QuotationItem {
  productId: string | null;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
  notes?: string;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string | null;
  customerName: string;
  items: QuotationItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  validUntil: string | null;
  status: string;
  convertedSaleId: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  taxRate: number;
  quantityOnHand: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  SENT: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  ACCEPTED: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  EXPIRED: { label: 'Expired', color: 'bg-yellow-100 text-yellow-800' },
  CONVERTED: { label: 'Converted', color: 'bg-purple-100 text-purple-800' },
};

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT', label: 'Credit' },
  { value: 'CHECK', label: 'Check' },
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

// ── Empty item template ──

const emptyItem = (): QuotationItem => ({
  productId: null,
  productName: '',
  sku: '',
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
  discountAmount: 0,
});

export default function QuotationsPage() {
  const perms = usePermissions();
  const { settings } = useSettings();
  const fmt = (amount: number) => formatCurrencyWithCode(amount, settings.currencyCode);
  const queryClient = useQueryClient();

  // ── State ──
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<QuotationItem[]>([emptyItem()]);
  const [isEditing, setIsEditing] = useState(false);

  // Convert form state
  const [convertPaymentMethod, setConvertPaymentMethod] = useState('CASH');
  const [convertAmountPaid, setConvertAmountPaid] = useState(0);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  // ── Queries ──
  const { data: quotationsRes, isLoading } = useQuery({
    queryKey: ['quotations', statusFilter],
    queryFn: () => quotationsApi.getAll(statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : undefined),
  });
  const quotations: Quotation[] = quotationsRes?.data?.data || [];

  const { data: productsRes } = useQuery({
    queryKey: ['products-for-quotation'],
    queryFn: () => productsApi.getAll({ limit: 1000 }),
    staleTime: 60000,
  });
  const products: Product[] = productsRes?.data?.data || [];

  const { data: customersRes } = useQuery({
    queryKey: ['customers-for-quotation'],
    queryFn: () => customersApi.getAll(),
    staleTime: 60000,
  });
  const customers: Customer[] = customersRes?.data?.data || [];

  // ── Filtered products for search ──
  const filteredProducts = productSearch.length >= 1
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: any) => quotationsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSuccess(res.data?.message || 'Quotation created');
      closeForm();
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to create quotation'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => quotationsApi.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSuccess(res.data?.message || 'Quotation updated');
      closeForm();
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to update quotation'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => quotationsApi.updateStatus(id, status),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSuccess(res.data?.message || 'Status updated');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to update status'),
  });

  const convertMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => quotationsApi.convertToSale(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSuccess(res.data?.message || 'Converted to sale');
      setShowConvert(false);
      setSelected(null);
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to convert'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      setSuccess('Quotation deleted');
      setShowDelete(false);
      setSelected(null);
    },
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to delete'),
  });

  // ── Form helpers ──
  function openNewForm() {
    setIsEditing(false);
    setFormCustomerId('');
    setFormCustomerName('');
    setFormValidUntil('');
    setFormNotes('');
    setFormItems([emptyItem()]);
    setShowForm(true);
  }

  function openEditForm(q: Quotation) {
    setIsEditing(true);
    setSelected(q);
    setFormCustomerId(q.customerId || '');
    setFormCustomerName(q.customerName);
    setFormValidUntil(q.validUntil ? q.validUntil.substring(0, 10) : '');
    setFormNotes(q.notes || '');
    setFormItems(q.items.length > 0 ? [...q.items] : [emptyItem()]);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setSelected(null);
    setIsEditing(false);
  }

  function addItem() {
    setFormItems([...formItems, emptyItem()]);
  }

  function removeItem(index: number) {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof QuotationItem, value: any) {
    const updated = [...formItems];
    (updated[index] as any)[field] = value;
    setFormItems(updated);
  }

  function selectProduct(index: number, product: Product) {
    const updated = [...formItems];
    updated[index] = {
      ...updated[index],
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unitPrice: product.sellingPrice,
      // Product taxRate is decimal (0.18 = 18%), convert to percentage for form
      taxRate: (product.taxRate || 0) * 100,
    };
    setFormItems(updated);
    setProductSearch('');
    setActiveItemIndex(null);
  }

  function handleCustomerSelect(customerId: string) {
    setFormCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) setFormCustomerName(customer.name);
  }

  // Calculate totals
  function calculateTotals(items: QuotationItem[]) {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    for (const item of items) {
      const lineSub = item.unitPrice * item.quantity;
      const lineDisc = item.discountAmount || 0;
      const lineTax = (lineSub - lineDisc) * ((item.taxRate || 0) / 100);
      subtotal += lineSub;
      taxAmount += lineTax;
      discountAmount += lineDisc;
    }
    return { subtotal, taxAmount, discountAmount, totalAmount: subtotal - discountAmount + taxAmount };
  }

  const formTotals = calculateTotals(formItems);

  function handleSubmit() {
    // Validate
    if (!formCustomerName.trim()) {
      setError('Customer name is required');
      return;
    }
    const validItems = formItems.filter(i => i.productName.trim() && i.quantity > 0 && i.unitPrice >= 0);
    if (validItems.length === 0) {
      setError('At least one valid item is required');
      return;
    }

    const payload = {
      customerId: formCustomerId || null,
      customerName: formCustomerName,
      items: validItems,
      validUntil: formValidUntil || undefined,
      notes: formNotes || undefined,
    };

    if (isEditing && selected) {
      updateMutation.mutate({ id: selected.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleConvert() {
    if (!selected) return;
    convertMutation.mutate({
      id: selected.id,
      data: { paymentMethod: convertPaymentMethod, amountPaid: convertAmountPaid },
    });
  }

  // ── PDF Export ──
  function handleExportPDF(q: Quotation) {
    const doc = new jsPDF();
    const cs = settings.currencySymbol || 'UGX';
    const fmtNum = (n: number) => n.toLocaleString('en-UG', { maximumFractionDigits: 0 });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.businessName || 'DigitalShop', 14, 20);

    if (settings.businessAddress) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(settings.businessAddress, 14, 27);
    }
    if (settings.businessPhone) {
      doc.setFontSize(9);
      doc.text(`Tel: ${settings.businessPhone}`, 14, 32);
    }
    if (settings.businessEmail) {
      doc.text(`Email: ${settings.businessEmail}`, 14, 37);
    }
    if (settings.taxNumber) {
      doc.text(`TIN: ${settings.taxNumber}`, 14, 42);
    }

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('QUOTATION', 196, 20, { align: 'right' });

    // Status badge
    const statusColors: Record<string, { r: number; g: number; b: number }> = {
      DRAFT: { r: 107, g: 114, b: 128 },
      SENT: { r: 59, g: 130, b: 246 },
      ACCEPTED: { r: 16, g: 185, b: 129 },
      REJECTED: { r: 239, g: 68, b: 68 },
      EXPIRED: { r: 245, g: 158, b: 11 },
      CONVERTED: { r: 139, g: 92, b: 246 },
    };
    const sc = statusColors[q.status] || statusColors.DRAFT;
    doc.setFillColor(sc.r, sc.g, sc.b);
    doc.roundedRect(155, 24, 41, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(q.status, 175.5, 29.5, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Quotation details
    const detailsY = 50;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Quotation #:', 14, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(q.quotationNumber, 55, detailsY);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 14, detailsY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(q.createdAt), 'dd MMM yyyy'), 55, detailsY + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Valid Until:', 14, detailsY + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : 'N/A', 55, detailsY + 14);

    // Customer info box
    doc.setFont('helvetica', 'bold');
    doc.text('Customer:', 120, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(q.customerName, 120, detailsY + 7);

    if (q.createdByName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Prepared By:', 120, detailsY + 14);
      doc.setFont('helvetica', 'normal');
      doc.text(q.createdByName, 120, detailsY + 21);
    }

    // Items table
    const tableData = q.items.map((item) => {
      const lineSub = item.unitPrice * item.quantity;
      const lineDisc = item.discountAmount || 0;
      const lineTax = (lineSub - lineDisc) * ((item.taxRate || 0) / 100);
      const lineTotal = lineSub - lineDisc + lineTax;
      return [
        item.productName + (item.sku ? `\n${item.sku}` : ''),
        item.quantity.toString(),
        `${cs} ${fmtNum(item.unitPrice)}`,
        lineDisc > 0 ? `${cs} ${fmtNum(lineDisc)}` : '-',
        item.taxRate > 0 ? `${item.taxRate}%` : '-',
        `${cs} ${fmtNum(lineTotal)}`,
      ];
    });

    autoTable(doc, {
      startY: detailsY + 28,
      head: [['Product', 'Qty', 'Unit Price', 'Discount', 'Tax', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { halign: 'center', cellWidth: 15 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 35 },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;

    // Totals section
    const totalsX = 140;
    let tY = finalY + 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsX, tY);
    doc.text(`${cs} ${fmtNum(q.subtotal)}`, 196, tY, { align: 'right' });

    if (q.discountAmount > 0) {
      tY += 7;
      doc.setTextColor(220, 38, 38);
      doc.text('Discount:', totalsX, tY);
      doc.text(`- ${cs} ${fmtNum(q.discountAmount)}`, 196, tY, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    }

    if (q.taxAmount > 0) {
      tY += 7;
      doc.text('Tax:', totalsX, tY);
      doc.text(`${cs} ${fmtNum(q.taxAmount)}`, 196, tY, { align: 'right' });
    }

    tY += 3;
    doc.setDrawColor(0, 0, 0);
    doc.line(totalsX, tY, 196, tY);
    tY += 7;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', totalsX, tY);
    doc.text(`${cs} ${fmtNum(q.totalAmount)}`, 196, tY, { align: 'right' });

    // Notes
    if (q.notes) {
      tY += 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 14, tY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const noteLines = doc.splitTextToSize(q.notes, 170);
      doc.text(noteLines, 14, tY + 6);
    }

    // Terms
    tY += q.notes ? 25 : 15;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('This quotation is valid for the period indicated above.', 14, tY);
    doc.text('Prices are subject to change after the validity period.', 14, tY + 5);

    // Footer
    doc.setFontSize(8);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 285);
    doc.text(`${settings.businessName || 'DigitalShop'} - Quotation Document`, 196, 285, { align: 'right' });

    doc.save(`Quotation_${q.quotationNumber}.pdf`);
  }

  // ── Summary stats ──
  const stats = {
    total: quotations.length,
    draft: quotations.filter(q => q.status === 'DRAFT').length,
    sent: quotations.filter(q => q.status === 'SENT').length,
    accepted: quotations.filter(q => q.status === 'ACCEPTED').length,
    totalValue: quotations.reduce((sum, q) => sum + q.totalAmount, 0),
  };

  // ── Render ──
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage customer quotations</p>
        </div>
        <Button onClick={openNewForm} className="gap-2">
          <Plus className="h-4 w-4" /> New Quotation
        </Button>
      </div>

      {/* Messages */}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription className="text-green-700">{success}</AlertDescription></Alert>}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase">Draft</p>
          <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-blue-500 uppercase">Sent</p>
          <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-green-500 uppercase">Accepted</p>
          <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 uppercase">Total Value</p>
          <p className="text-xl font-bold">{fmt(stats.totalValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
              <SelectItem key={value} value={value}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading quotations...</div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="mx-auto h-12 w-12 mb-3" />
          <p>No quotations found</p>
        </div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q) => {
                const cfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.DRAFT;
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.quotationNumber}</TableCell>
                    <TableCell>{q.customerName}</TableCell>
                    <TableCell>{q.items.length} item{q.items.length !== 1 ? 's' : ''}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(q.totalAmount)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </TableCell>
                    <TableCell>{q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : '—'}</TableCell>
                    <TableCell>{format(new Date(q.createdAt), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="icon"
                          title="View"
                          onClick={() => { setSelected(q); setShowDetail(true); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          title="Download PDF"
                          onClick={() => handleExportPDF(q)}
                        >
                          <Download className="h-4 w-4 text-gray-600" />
                        </Button>
                        {['DRAFT', 'SENT'].includes(q.status) && (
                          <Button
                            variant="ghost" size="icon"
                            title="Edit"
                            onClick={() => openEditForm(q)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {q.status === 'DRAFT' && (
                          <Button
                            variant="ghost" size="icon"
                            title="Send"
                            onClick={() => statusMutation.mutate({ id: q.id, status: 'SENT' })}
                          >
                            <Send className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {['DRAFT', 'SENT'].includes(q.status) && (
                          <Button
                            variant="ghost" size="icon"
                            title="Accept"
                            onClick={() => statusMutation.mutate({ id: q.id, status: 'ACCEPTED' })}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {q.status === 'SENT' && (
                          <Button
                            variant="ghost" size="icon"
                            title="Reject"
                            onClick={() => statusMutation.mutate({ id: q.id, status: 'REJECTED' })}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                        {q.status === 'ACCEPTED' && (
                          <Button
                            variant="ghost" size="icon"
                            title="Convert to Sale"
                            onClick={() => {
                              setSelected(q);
                              setConvertPaymentMethod('CASH');
                              setConvertAmountPaid(q.totalAmount);
                              setShowConvert(true);
                            }}
                          >
                            <ShoppingCart className="h-4 w-4 text-purple-600" />
                          </Button>
                        )}
                        {q.status === 'DRAFT' && (
                          <Button
                            variant="ghost" size="icon"
                            title="Delete"
                            onClick={() => { setSelected(q); setShowDelete(true); }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ────────────── Detail Dialog ────────────── */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quotation {selected?.quotationNumber}</DialogTitle>
            <DialogDescription>
              {selected && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CONFIG[selected.status]?.color}`}>
                  {STATUS_CONFIG[selected.status]?.label}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Customer:</span> {selected.customerName}</div>
                <div><span className="text-gray-500">Created:</span> {format(new Date(selected.createdAt), 'dd MMM yyyy')}</div>
                <div><span className="text-gray-500">Valid Until:</span> {selected.validUntil ? format(new Date(selected.validUntil), 'dd MMM yyyy') : '—'}</div>
                <div><span className="text-gray-500">Created By:</span> {selected.createdByName || '—'}</div>
                {selected.notes && (
                  <div className="col-span-2"><span className="text-gray-500">Notes:</span> {selected.notes}</div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.items.map((item, i) => {
                    const lineSub = item.unitPrice * item.quantity;
                    const lineDisc = item.discountAmount || 0;
                    const lineTax = (lineSub - lineDisc) * ((item.taxRate || 0) / 100);
                    const lineTotal = lineSub - lineDisc + lineTax;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <div>{item.productName}</div>
                          {item.sku && <div className="text-xs text-gray-400">{item.sku}</div>}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{fmt(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">{lineDisc > 0 ? fmt(lineDisc) : '—'}</TableCell>
                        <TableCell className="text-right">{lineTax > 0 ? fmt(lineTax) : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(lineTotal)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>{fmt(selected.subtotal)}</span></div>
                  {selected.discountAmount > 0 && (
                    <div className="flex justify-between text-red-600"><span>Discount</span><span>-{fmt(selected.discountAmount)}</span></div>
                  )}
                  {selected.taxAmount > 0 && (
                    <div className="flex justify-between"><span>Tax</span><span>{fmt(selected.taxAmount)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-1">
                    <span>Total</span><span>{fmt(selected.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {selected.convertedSaleId && (
                <div className="text-sm text-purple-600">Converted to Sale ID: {selected.convertedSaleId}</div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleExportPDF(selected)}
                >
                  <Download className="h-4 w-4" /> Export PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ────────────── Create/Edit Dialog ────────────── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Quotation' : 'New Quotation'}</DialogTitle>
            <DialogDescription>
              {isEditing ? `Editing ${selected?.quotationNumber}` : 'Create a quotation for a customer'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer</Label>
                <Select value={formCustomerId} onValueChange={handleCustomerSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  placeholder="Walk-in or type name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={formValidUntil}
                  onChange={e => setFormValidUntil(e.target.value)}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={1}
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {formItems.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-gray-50 relative">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      {/* Product search */}
                      <div className="col-span-4 relative">
                        <Label className="text-xs">Product</Label>
                        <Input
                          value={item.productName}
                          onChange={e => {
                            updateItem(idx, 'productName', e.target.value);
                            setProductSearch(e.target.value);
                            setActiveItemIndex(idx);
                          }}
                          onFocus={() => { setActiveItemIndex(idx); setProductSearch(item.productName); }}
                          placeholder="Search or type name..."
                        />
                        {activeItemIndex === idx && filteredProducts.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filteredProducts.map(p => (
                              <button
                                key={p.id}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between items-center"
                                onClick={() => selectProduct(idx, p)}
                                type="button"
                              >
                                <div>
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs text-gray-400">{p.sku}</div>
                                </div>
                                <span className="text-xs text-gray-500">{fmt(p.sellingPrice)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="col-span-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="col-span-1">
                        <Label className="text-xs">Tax %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.taxRate}
                          onChange={e => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Discount</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.discountAmount}
                          onChange={e => updateItem(idx, 'discountAmount', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="col-span-1 text-right font-medium text-sm pt-5">
                        {fmt(item.unitPrice * item.quantity - (item.discountAmount || 0))}
                      </div>

                      <div className="col-span-1 pt-5">
                        {formItems.length > 1 && (
                          <Button
                            type="button" variant="ghost" size="icon"
                            onClick={() => removeItem(idx)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{fmt(formTotals.subtotal)}</span></div>
                {formTotals.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600"><span>Discount</span><span>-{fmt(formTotals.discountAmount)}</span></div>
                )}
                {formTotals.taxAmount > 0 && (
                  <div className="flex justify-between"><span>Tax</span><span>{fmt(formTotals.taxAmount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-1">
                  <span>Total</span><span>{fmt(formTotals.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : isEditing ? 'Update Quotation' : 'Create Quotation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────── Convert to Sale Dialog ────────────── */}
      <Dialog open={showConvert} onOpenChange={setShowConvert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Sale</DialogTitle>
            <DialogDescription>
              Convert quotation {selected?.quotationNumber} ({fmt(selected?.totalAmount || 0)}) to a sale
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Payment Method</Label>
              <Select value={convertPaymentMethod} onValueChange={setConvertPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount Paid</Label>
              <Input
                type="number"
                min={0}
                value={convertAmountPaid}
                onChange={e => setConvertAmountPaid(parseFloat(e.target.value) || 0)}
              />
            </div>

            {convertPaymentMethod === 'CREDIT' && (
              <p className="text-sm text-amber-600">
                Credit payment will create an invoice for the outstanding balance.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(false)}>Cancel</Button>
            <Button
              onClick={handleConvert}
              disabled={convertMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {convertMutation.isPending ? 'Converting...' : 'Convert to Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────── Delete Confirmation ────────────── */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Quotation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selected?.quotationNumber}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selected && deleteMutation.mutate(selected.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
