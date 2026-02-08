import { useEffect, useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { formatCurrency, formatDisplayDate } from '../utils/currency';
import { goodsReceiptsApi, purchasesApi, inventoryApi } from '../lib/api';
import type { 
  GoodsReceipt as GoodsReceiptType, 
  GoodsReceiptItemFull,
  CostAlert,
  UpdateGoodsReceiptItem 
} from '@shared/zod/goodsReceipt';
import { 
  UpdateGoodsReceiptItemSchema,
  CreateGoodsReceiptFromPOSchema 
} from '@shared/zod/goodsReceipt';

// Configure Decimal for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Extended GoodsReceipt type to handle both camelCase and snake_case from API
interface GoodsReceipt extends Partial<GoodsReceiptType> {
  id: string; // Required for our local use
  receipt_number?: string;
  po_number?: string;
  supplier_name?: string;
  received_date?: string;
  received_by_name?: string;
  supplier_delivery_note?: string;
}

// Extended GRItem type to handle both naming conventions
interface GRItem extends Partial<GoodsReceiptItemFull> {
  id: string; // Required for our local use
  product_id?: string;
  product_name?: string;
  ordered_quantity?: number;
  received_quantity?: number;
  unit_cost?: number;
  batch_number?: string;
  expiry_date?: string;
  uom_symbol?: string;
  conversion_factor?: number;
  po_unit_price?: number;
  product_cost_price?: string;
}

interface PurchaseOrder {
  id: string;
  order_number?: string;
  poNumber?: string;
  supplier_name?: string;
  supplierName?: string;
  order_date?: string;
  orderDate?: string;
  total_amount?: number;
  totalAmount?: number;
  status: string;
}

interface EditItem {
  batchNumber?: string | null;
  expiryDate?: string | null;
  receivedQuantity?: number;
  costPrice?: number;
  selectedUomId?: string;
  receivedUomQty?: number;
  receivedLooseQty?: number;
}

export default function GoodsReceiptsPage() {
  const perms = usePermissions();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedGR, setSelectedGR] = useState<GoodsReceipt | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [costAlerts, setCostAlerts] = useState<CostAlert[]>([]);
  const [baseline, setBaseline] = useState<'PO' | 'PRODUCT'>('PO');
  const [poSearch, setPoSearch] = useState('');
  const [poPage, setPoPage] = useState(1);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [focusedPoIndex, setFocusedPoIndex] = useState(0);
  const poRadioRefs = useRef<HTMLInputElement[]>([]);
  const [poQuickView, setPoQuickView] = useState<Record<string, { itemsCount: number }>>({});
  const [editItems, setEditItems] = useState<Record<string, EditItem>>({});
  const [batchWarnings, setBatchWarnings] = useState<Record<string, string>>({});
  const validationTimeout = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Data fetching state
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // GR Details state
  const [grDetail, setGrDetail] = useState<{ gr: GoodsReceipt | null; items: GRItem[] }>({ gr: null, items: [] });
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Pending POs state
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [poPagination, setPoPagination] = useState<any>(null);
  const [posLoading, setPosLoading] = useState(false);

  // Mutations state
  const [updatePending, setUpdatePending] = useState(false);
  const [createPending, setCreatePending] = useState(false);

  const limit = 20;
  const { user } = useAuth();

  // Persist baseline selection
  useEffect(() => {
    const saved = localStorage.getItem('gr_cost_baseline');
    if (saved === 'PO' || saved === 'PRODUCT') setBaseline(saved);
  }, []);
  
  useEffect(() => {
    localStorage.setItem('gr_cost_baseline', baseline);
  }, [baseline]);

  // Fetch goods receipts
  const fetchGoodsReceipts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await goodsReceiptsApi.getAll({
        page,
        limit,
        status: statusFilter || undefined,
      });
      if (response.data.success) {
        setGoodsReceipts(response.data.data?.data || response.data.data || []);
        setPagination((response.data as any).data?.pagination || (response.data as any).pagination);
      } else {
        setError(response.data.error || 'Failed to load goods receipts');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load goods receipts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoodsReceipts();
  }, [page, statusFilter]);

  // Fetch GR details when modal opens
  const fetchGRDetails = async (grId: string) => {
    setDetailsLoading(true);
    try {
      const response = await goodsReceiptsApi.getById(grId);
      if (response.data.success) {
        const data = response.data.data;
        setGrDetail({
          gr: data?.gr || data,
          items: data?.items || []
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch GR details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Initialize edit state when items load
  const items = useMemo(() => grDetail?.items || [], [grDetail]);

  useEffect(() => {
    if (showDetailsModal && items.length > 0) {
      const init: Record<string, EditItem> = {};
      items.forEach((it: GRItem) => {
        if (!it.id) return; // Skip items without id
        const expiryVal = it.expiryDate || it.expiry_date;
        init[it.id] = {
          batchNumber: it.batchNumber ?? it.batch_number ?? '',
          expiryDate: expiryVal ? new Date(expiryVal).toISOString().slice(0, 10) : '',
          receivedQuantity: it.receivedQuantity ?? it.received_quantity ?? 0,
          costPrice: it.costPrice ?? it.unit_cost ?? 0,
        };
      });
      setEditItems(init);
    }
  }, [showDetailsModal, items]);

  // Fetch pending POs for create modal
  const fetchPendingPOs = async () => {
    setPosLoading(true);
    try {
      const response = await purchasesApi.getAll({ status: 'SENT', page: poPage, limit: 20 });
      if (response.data.success) {
        setPendingPOs(response.data.data?.data || response.data.data || []);
        setPoPagination((response.data as any).data?.pagination || (response.data as any).pagination);
      }
    } catch (err: any) {
      console.error('Failed to fetch pending POs:', err);
    } finally {
      setPosLoading(false);
    }
  };

  // Check for duplicate batch numbers
  const checkBatchDuplicate = async (itemId: string, batchNumber: string) => {
    if (!batchNumber || batchNumber.trim() === '') {
      setBatchWarnings(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      return;
    }

    try {
      const response = await inventoryApi.batchExists(batchNumber);
      if (response.data?.data?.exists) {
        setBatchWarnings(prev => ({
          ...prev,
          [itemId]: '⚠️ This batch number already exists in the system'
        }));
      } else {
        // Also check within current GR items
        const currentItems = Object.entries(editItems);
        const duplicateInCurrent = currentItems.filter(
          ([id, item]) => id !== itemId && item.batchNumber === batchNumber
        ).length > 0;

        if (duplicateInCurrent) {
          setBatchWarnings(prev => ({
            ...prev,
            [itemId]: '⚠️ Duplicate batch number in this goods receipt'
          }));
        } else {
          setBatchWarnings(prev => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Failed to check batch duplicate:', error);
    }
  };

  // PDF Export for Goods Receipt
  const handleExportGRPDF = (gr: GoodsReceipt, grItems: GRItem[]) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DigitalShop', 14, 20);

    doc.setFontSize(14);
    doc.text('Goods Receipt', 14, 30);

    // GR Number and Status
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const grNumber = gr.receiptNumber || gr.receipt_number || 'N/A';
    const poNumber = gr.poNumber || gr.po_number || 'N/A';
    const supplierName = gr.supplierName || gr.supplier_name || 'N/A';
    const status = gr.status || 'DRAFT';

    doc.text(`GR Number: ${grNumber}`, 14, 42);
    doc.text(`PO Number: ${poNumber}`, 14, 50);
    doc.text(`Supplier: ${supplierName}`, 14, 58);

    // Status badge simulation
    const statusColors: Record<string, { r: number; g: number; b: number }> = {
      'DRAFT': { r: 245, g: 158, b: 11 },
      'PENDING': { r: 59, g: 130, b: 246 },
      'COMPLETED': { r: 16, g: 185, b: 129 },
      'FINALIZED': { r: 16, g: 185, b: 129 },
    };
    const statusColor = statusColors[status] || { r: 107, g: 114, b: 128 };
    doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
    doc.roundedRect(130, 38, 60, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(status, 160, 44, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Receipt details
    doc.setFontSize(10);
    const receivedDate = gr.received_date || gr.receivedDate || '-';
    const receivedBy = gr.received_by_name || gr.receivedByName || '-';
    const deliveryNote = gr.supplier_delivery_note || '-';

    doc.text(`Received Date: ${formatDisplayDate(receivedDate)}`, 14, 70);
    doc.text(`Received By: ${receivedBy}`, 14, 78);
    doc.text(`Delivery Note: ${deliveryNote}`, 14, 86);

    // Items table
    const tableData = grItems.map((item: GRItem) => {
      const productName = item.productName || item.product_name || 'Unknown';
      const uomSymbol = item.uomSymbol || item.uom_symbol || 'base';
      const conversionFactor = parseFloat(String(item.conversionFactor || item.conversion_factor || 1));

      const baseOrderedQty = parseFloat(String(item.orderedQuantity || item.ordered_quantity || 0));
      const baseReceivedQty = parseFloat(String(item.receivedQuantity || item.received_quantity || 0));
      const baseUnitCost = parseFloat(String(item.costPrice || item.unit_cost || 0));

      const orderedQty = conversionFactor > 0 ? new Decimal(baseOrderedQty).div(conversionFactor).toNumber() : baseOrderedQty;
      const receivedQty = conversionFactor > 0 ? new Decimal(baseReceivedQty).div(conversionFactor).toNumber() : baseReceivedQty;
      const unitCost = new Decimal(baseUnitCost).times(conversionFactor).toNumber();

      const batchNumber = item.batchNumber || item.batch_number || '-';
      const expiryDate = item.expiryDate || item.expiry_date || '-';
      const totalCost = new Decimal(baseReceivedQty).times(baseUnitCost).toNumber();
      const qtyVariance = baseOrderedQty > 0 ? ((baseReceivedQty - baseOrderedQty) / baseOrderedQty * 100).toFixed(2) : '0.00';

      return [
        productName,
        uomSymbol,
        orderedQty.toString(),
        receivedQty.toString(),
        formatCurrency(unitCost),
        formatCurrency(totalCost),
        batchNumber,
        formatDisplayDate(expiryDate),
        `${parseFloat(qtyVariance) >= 0 ? '+' : ''}${qtyVariance}%`
      ];
    });

    autoTable(doc, {
      startY: 95,
      head: [['Product', 'UoM', 'Ordered', 'Received', 'Unit Cost', 'Total Cost', 'Batch #', 'Expiry', 'Qty Var']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 18 },
        4: { halign: 'right' },
        5: { halign: 'right' },
        8: { halign: 'center' }
      }
    });

    // Calculate total
    const totalValue = grItems.reduce((sum: number, item: GRItem) => {
      const receivedQty = parseFloat(String(item.receivedQuantity || item.received_quantity || 0));
      const unitCost = parseFloat(String(item.costPrice || item.unit_cost || 0));
      return sum + new Decimal(receivedQty).times(unitCost).toNumber();
    }, 0);

    // Get final Y position after table
    const finalY = (doc as any).lastAutoTable?.finalY || 150;

    // Total box
    doc.setFillColor(240, 240, 240);
    doc.rect(130, finalY + 10, 65, 10, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Value:', 132, finalY + 17);
    doc.text(formatCurrency(totalValue), 193, finalY + 17, { align: 'right' });

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 285);
    doc.text('DigitalShop - Goods Receipt Document', 196, 285, { align: 'right' });

    // Save
    doc.save(`GoodsReceipt_${grNumber}.pdf`);
  };

  const handleFinalize = async (id: string) => {
    if (!confirm('Finalize this goods receipt? This will create inventory batches and update stock levels.')) {
      return;
    }

    try {
      // Auto-save all pending edits before finalizing
      const savePromises = items.map(async (item: GRItem) => {
        const itemId = item.id;
        if (!itemId) return; // Skip items without id
        const edits = editItems[itemId];

        if (edits) {
          const hasChanges =
            (edits.batchNumber !== undefined && edits.batchNumber !== (item.batchNumber || item.batch_number)) ||
            (edits.expiryDate !== undefined) ||
            (edits.receivedQuantity !== undefined && edits.receivedQuantity !== (item.receivedQuantity || item.received_quantity)) ||
            (edits.costPrice !== undefined && edits.costPrice !== (item.costPrice || item.unit_cost));

          if (hasChanges) {
            const payload: any = {};
            if (edits.receivedQuantity !== undefined) payload.receivedQuantity = Number(edits.receivedQuantity);
            if (edits.costPrice !== undefined) payload.costPrice = Number(edits.costPrice);
            if (edits.batchNumber !== undefined) payload.batchNumber = edits.batchNumber || null;
            if (edits.expiryDate !== undefined) payload.expiryDate = edits.expiryDate ? new Date(edits.expiryDate).toISOString() : null;
            await goodsReceiptsApi.updateItem(id, itemId!, payload);
          }
        }
      });

      await Promise.all(savePromises);

      // Refresh GR details after saving
      await fetchGRDetails(id);

      const response = await goodsReceiptsApi.finalize(id);

      // Check for cost alerts
      const alerts = (response.data.data?.alerts as CostAlert[]) || [];
      const filtered = alerts.filter((a: CostAlert) => {
        const prev = parseFloat(a.details.previousCost);
        const next = parseFloat(a.details.newCost);
        if (!isFinite(prev) || prev <= 0 || !isFinite(next) || next <= 0) return true;
        const ratio = next / prev;
        const rounded = Math.round(ratio);
        const isIntegerish = Math.abs(ratio - rounded) < 1e-6;
        if (isIntegerish && rounded >= 2 && rounded <= 200) {
          return false;
        }
        return true;
      });
      
      if (filtered.length > 0) {
        setCostAlerts(filtered);
        setShowAlertsModal(true);
      } else {
        alert('Goods receipt finalized successfully!');
      }

      setShowDetailsModal(false);
      fetchGoodsReceipts();
    } catch (err: any) {
      alert(`Failed to finalize: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleViewDetails = (gr: GoodsReceipt) => {
    setSelectedGR(gr);
    setShowDetailsModal(true);
    fetchGRDetails(gr.id);
  };

  const handleItemFieldChange = (itemId: string, field: string, value: any) => {
    setEditItems(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value,
      },
    }));
  };

  const saveItem = async (item: GRItem) => {
    if (!selectedGR) return;
    
    const id = item.id;
    if (!id) return; // Skip items without id
    const current = editItems[id] || {};
    const original = {
      batchNumber: item.batchNumber ?? item.batch_number ?? '',
      expiryDate: (item.expiryDate || item.expiry_date) 
        ? new Date(item.expiryDate || item.expiry_date!).toISOString().slice(0, 10)
        : '',
      receivedQuantity: item.receivedQuantity ?? item.received_quantity ?? 0,
      costPrice: item.costPrice ?? item.unit_cost ?? 0,
    };

    const payload: UpdateGoodsReceiptItem = {};
    if (current.batchNumber !== undefined && current.batchNumber !== original.batchNumber) payload.batchNumber = current.batchNumber || null;
    if (current.expiryDate !== undefined && current.expiryDate !== original.expiryDate) payload.expiryDate = current.expiryDate || null;
    if (current.receivedQuantity !== undefined && current.receivedQuantity !== original.receivedQuantity) payload.receivedQuantity = Number(current.receivedQuantity);
    if (current.costPrice !== undefined && current.costPrice !== original.costPrice) payload.costPrice = Number(current.costPrice);

    if (Object.keys(payload).length === 0) return;

    // Validate with Zod schema
    const validation = UpdateGoodsReceiptItemSchema.safeParse(payload);
    if (!validation.success) {
      alert(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
      return;
    }

    setUpdatePending(true);
    try {
      await goodsReceiptsApi.updateItem(selectedGR.id, id, validation.data);
      // Refresh the items
      await fetchGRDetails(selectedGR.id);
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setUpdatePending(false);
    }
  };

  const openCreateModal = () => {
    setPoSearch('');
    setSelectedPoId('');
    setPoPage(1);
    setShowCreateModal(true);
    fetchPendingPOs();
  };

  const handleCreateGR = async () => {
    if (!user?.id) {
      alert('You must be logged in to create a goods receipt.');
      return;
    }
    const poId = selectedPoId.trim();
    if (!poId) {
      alert('Select a Purchase Order');
      return;
    }
    
    setCreatePending(true);
    try {
      // Fetch PO to build items
      const poRes = await purchasesApi.getById(poId);
      const poData: any = poRes.data?.data;
      if (!poData?.po && !poData?.id) {
        throw new Error('Purchase order not found');
      }
      
      const po = poData?.po || poData;
      const poItems = poData?.items || [];
      
      const payload = {
        purchaseOrderId: po.id,
        receivedDate: new Date().toISOString(),
        notes: null,
        items: poItems.map((it: any) => {
          const rawUnit = Number(it.unit_price ?? it.unitCost ?? it.cost_price ?? 0);
          const baseCost = Number(it.product_cost_price ?? it.productCostPrice ?? 0);
          let normalizedUnit = rawUnit;
          if (isFinite(rawUnit) && rawUnit > 0 && isFinite(baseCost) && baseCost > 0) {
            const ratio = rawUnit / baseCost;
            const rounded = Math.round(ratio);
            const isIntegerish = Math.abs(ratio - rounded) < 1e-6;
            if (isIntegerish && rounded >= 2 && rounded <= 200) {
              normalizedUnit = rawUnit / rounded;
            }
          }
          return {
            purchaseOrderItemId: it.id,
            productId: it.product_id || it.productId,
            productName: it.product_name || it.productName,
            orderedQuantity: Number(it.ordered_quantity ?? it.quantity ?? 0),
            receivedQuantity: Number(it.ordered_quantity ?? it.quantity ?? 0),
            costPrice: normalizedUnit,
            batchNumber: null,
            expiryDate: null,
          };
        })
      };
      
      // Validate with Zod schema
      const validation = CreateGoodsReceiptFromPOSchema.safeParse(payload);
      if (!validation.success) {
        alert(`Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`);
        return;
      }

      await goodsReceiptsApi.create(validation.data);

      setShowCreateModal(false);
      setSelectedPoId('');
      setPoSearch('');
      setPoPage(1);
      setFocusedPoIndex(0);
      fetchGoodsReceipts();
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message || 'Failed to create goods receipt');
    } finally {
      setCreatePending(false);
    }
  };

  // Filter POs by search
  const filteredPOs = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return pendingPOs;
    return pendingPOs.filter((po: PurchaseOrder) => {
      const num = (po.order_number || po.poNumber || '').toString().toLowerCase();
      const supplier = (po.supplier_name || po.supplierName || '').toString().toLowerCase();
      return num.includes(q) || supplier.includes(q);
    });
  }, [poSearch, pendingPOs]);

  // Ensure refs length matches list length
  useEffect(() => {
    poRadioRefs.current = poRadioRefs.current.slice(0, filteredPOs.length);
  }, [filteredPOs.length]);

  // Fetch quick-view details lazily
  const ensurePoQuickView = async (poId: string) => {
    if (!poId || poQuickView[poId]) return;
    try {
      const res = await purchasesApi.getById(poId);
      const items = res.data?.data?.items || [];
      setPoQuickView(prev => ({ ...prev, [poId]: { itemsCount: items.length } }));
    } catch {
      // ignore failures for quick-view
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-800' },
      FINALIZED: { bg: 'bg-green-100', text: 'text-green-800' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-800' },
    };

    const badge = badges[status] || badges.DRAFT;

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Goods Receipts</h2>
          <p className="text-gray-600 mt-1">Receiving workflow with batch creation and cost change alerts</p>
        </div>
        <div className="flex items-center gap-3">
          {perms.canViewCostPrice && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Cost variance baseline:</span>
            <select
              aria-label="Cost variance baseline"
              title="Cost variance baseline"
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              value={baseline}
              onChange={(e) => setBaseline(e.target.value as 'PO' | 'PRODUCT')}
            >
              <option value="PO">PO Cost</option>
              <option value="PRODUCT">Product Cost</option>
            </select>
          </div>
          )}
          {perms.canReceiveGoods && (
            <button
              onClick={openCreateModal}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + Create from PO
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex gap-4">
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="FINALIZED">Finalized</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-600">Loading goods receipts...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">Failed to load goods receipts: {error}</p>
        </div>
      )}

      {/* Goods Receipts Table */}
      {!isLoading && !error && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GR Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {goodsReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No goods receipts found
                  </td>
                </tr>
              ) : (
                goodsReceipts.map((gr: GoodsReceipt) => (
                  <tr key={gr.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {gr.receiptNumber || gr.receipt_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {gr.poNumber || gr.po_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {gr.supplierName || gr.supplier_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDisplayDate(gr.receivedDate || gr.received_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(gr.status || 'PENDING')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(gr)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          👁️ View
                        </button>
                        {gr.status === 'DRAFT' && perms.canReceiveGoods && (
                          <button
                            onClick={() => handleFinalize(gr.id)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            ✓ Finalize
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedGR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {selectedGR.receiptNumber || selectedGR.receipt_number}
                  </h3>
                  <p className="text-gray-600 mt-1">
                    PO: {selectedGR.poNumber || selectedGR.po_number} | Supplier: {selectedGR.supplierName || selectedGR.supplier_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-700">Received Date</label>
                  <p className="text-gray-900">
                    {formatDisplayDate(selectedGR.receivedDate || selectedGR.received_date)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedGR.status || 'PENDING')}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Received By</label>
                  <p className="text-gray-900">{selectedGR.receivedByName || selectedGR.received_by_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Delivery Note</label>
                  <p className="text-gray-900">{selectedGR.supplier_delivery_note || '-'}</p>
                </div>
              </div>

              {selectedGR.notes && (
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <p className="text-gray-900 mt-1">{selectedGR.notes}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold text-gray-900">Items</h4>
                  {detailsLoading && <span className="text-sm text-gray-500">Loading items…</span>}
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ordered</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                        {perms.canViewCostPrice && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>}
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch #</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Var</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-center text-gray-500" colSpan={8}>No items</td>
                        </tr>
                      ) : (
                        items.map((it: GRItem) => {
                          const es = editItems[it.id] || {};
                          const ordered = it.orderedQuantity ?? it.ordered_quantity ?? 0;
                          const baseReceived = es.receivedQuantity ?? it.receivedQuantity ?? it.received_quantity ?? 0;
                          const disabled = selectedGR.status !== 'DRAFT';
                          const baseUnitCost = es.costPrice ?? it.costPrice ?? it.unit_cost ?? 0;
                          
                          const qtyVariancePct = ordered > 0
                            ? new Decimal(baseReceived || 0).minus(ordered).div(ordered).mul(100).toNumber()
                            : 0;

                          const receivedError = ((): string | null => {
                            if (es.receivedQuantity == null) return null;
                            if (Number(es.receivedQuantity) < 0) return 'Must be ≥ 0';
                            return null;
                          })();
                          
                          const unitCostError = ((): string | null => {
                            if (es.costPrice == null) return null;
                            return Number(es.costPrice) < 0 ? 'Must be ≥ 0' : null;
                          })();
                          
                          const expiryError = ((): string | null => {
                            const v = es.expiryDate;
                            if (!v) return null;
                            const d = new Date(v);
                            if (isNaN(d.getTime())) return 'Invalid date';
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return d <= today ? 'Must be a future date' : null;
                          })();
                          
                          const hasErrors = !!(receivedError || unitCostError || expiryError);

                          return (
                            <tr key={it.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">{it.productName || it.product_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{ordered}</td>
                              <td className="px-4 py-2 text-sm">
                                <input
                                  type="number"
                                  min={0}
                                  className={`w-24 border rounded px-2 py-1 ${receivedError ? 'border-red-500' : ''}`}
                                  value={baseReceived}
                                  disabled={disabled}
                                  aria-label="Received quantity"
                                  title="Received quantity"
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    handleItemFieldChange(it.id, 'receivedQuantity', val);
                                  }}
                                />
                                {receivedError && <div className="text-xs text-red-600 mt-1">{receivedError}</div>}
                              </td>
                              {perms.canViewCostPrice && (
                              <td className="px-4 py-2 text-sm">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className={`w-28 border rounded px-2 py-1 ${unitCostError ? 'border-red-500' : ''}`}
                                  value={baseUnitCost}
                                  disabled={disabled}
                                  aria-label="Unit cost"
                                  title="Unit cost"
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    handleItemFieldChange(it.id, 'costPrice', val);
                                  }}
                                />
                                {unitCostError && <div className="text-xs text-red-600 mt-1">{unitCostError}</div>}
                              </td>
                              )}
                              <td className="px-4 py-2 text-sm">
                                <input
                                  type="text"
                                  className={`w-32 border rounded px-2 py-1 ${batchWarnings[it.id] ? 'border-red-500' : ''}`}
                                  value={es.batchNumber ?? ''}
                                  disabled={disabled}
                                  placeholder="Auto on finalize"
                                  aria-label="Batch number"
                                  title="Batch number"
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    handleItemFieldChange(it.id, 'batchNumber', value);
                                    if (validationTimeout.current[it.id]) {
                                      clearTimeout(validationTimeout.current[it.id]);
                                    }
                                    validationTimeout.current[it.id] = setTimeout(() => {
                                      checkBatchDuplicate(it.id, value);
                                    }, 500);
                                  }}
                                />
                                {batchWarnings[it.id] && (
                                  <div className="text-xs text-red-600 mt-1">{batchWarnings[it.id]}</div>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <input
                                  type="date"
                                  className={`w-36 border rounded px-2 py-1 ${expiryError ? 'border-red-500' : ''}`}
                                  value={es.expiryDate ?? ''}
                                  disabled={disabled}
                                  aria-label="Expiry date"
                                  title="Expiry date"
                                  min={new Date().toISOString().slice(0, 10)}
                                  onChange={(e) => handleItemFieldChange(it.id, 'expiryDate', e.target.value || undefined)}
                                />
                                {expiryError && <div className="text-xs text-red-600 mt-1">{expiryError}</div>}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {ordered > 0 ? (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    qtyVariancePct > 0 ? 'bg-yellow-100 text-yellow-800' : 
                                    qtyVariancePct < 0 ? 'bg-red-100 text-red-800' : 
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {qtyVariancePct > 0 ? '+' : ''}{qtyVariancePct.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <button
                                  disabled={disabled || updatePending || hasErrors}
                                  onClick={() => saveItem(it)}
                                  className={`px-3 py-1 rounded ${disabled ? 'bg-gray-200 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                  title={disabled ? 'Cannot edit finalized GR' : 'Save changes'}
                                >
                                  Save
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => handleExportGRPDF(selectedGR, items)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF
                </button>
                {selectedGR.status === 'DRAFT' && perms.canReceiveGoods && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleFinalize(selectedGR.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      ✓ Finalize Goods Receipt
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Alerts Modal */}
      {showAlertsModal && costAlerts.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAlertsModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">⚠️ Cost Price Change Alerts</h3>
                  <p className="text-gray-600 mt-1">{costAlerts.length} product(s) with cost changes</p>
                </div>
                <button
                  onClick={() => setShowAlertsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {costAlerts.map((alert, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-4 border-2 ${alert.severity === 'HIGH'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-2xl">
                      {alert.severity === 'HIGH' ? '🔴' : '🟡'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded ${alert.severity === 'HIGH'
                            ? 'bg-red-600 text-white'
                            : 'bg-yellow-600 text-white'
                          }`}
                        >
                          {alert.severity} SEVERITY
                        </span>
                        <span className="font-semibold text-gray-900">{alert.productName}</span>
                      </div>
                      <p className="text-sm text-gray-700 mb-3">{alert.message}</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Previous Cost:</span>
                          <span className="ml-2 font-semibold text-gray-900">
                            {formatCurrency(parseFloat(alert.details.previousCost))}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">New Cost:</span>
                          <span className="ml-2 font-semibold text-gray-900">
                            {formatCurrency(parseFloat(alert.details.newCost))}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Change:</span>
                          <span className="ml-2 font-semibold text-gray-900">
                            {parseFloat(alert.details.changeAmount) > 0 ? '+' : ''}
                            {formatCurrency(parseFloat(alert.details.changeAmount))}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Percentage:</span>
                          <span className="ml-2 font-semibold text-gray-900">
                            {parseFloat(alert.details.changePercentage) > 0 ? '+' : ''}
                            {parseFloat(alert.details.changePercentage).toFixed(2)}%
                          </span>
                        </div>
                        {alert.details.batchNumber && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Batch:</span>
                            <span className="ml-2 font-mono text-sm text-gray-900">
                              {alert.details.batchNumber}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p className="text-sm text-blue-800">
                  ℹ️ Cost changes have been applied. Pricing formulas will be recalculated automatically.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowAlertsModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create GR Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowCreateModal(false); setSelectedPoId(''); setPoSearch(''); setPoPage(1); setFocusedPoIndex(0); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Create Goods Receipt from PO</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedPoId('');
                  setPoSearch('');
                  setPoPage(1);
                  setFocusedPoIndex(0);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="po-search" className="block text-sm font-medium text-gray-700 mb-1">Search POs (status: APPROVED)</label>
                <input
                  id="po-search"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Search by PO number or supplier"
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                />
              </div>
              <div
                className="border rounded-lg max-h-64 overflow-y-auto"
                role="radiogroup"
                aria-label="Approved purchase orders"
                onKeyDown={(e) => {
                  if (filteredPOs.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = Math.min(filteredPOs.length - 1, focusedPoIndex + 1);
                    setFocusedPoIndex(next);
                    const el = poRadioRefs.current[next];
                    el?.focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = Math.max(0, focusedPoIndex - 1);
                    setFocusedPoIndex(prev);
                    const el = poRadioRefs.current[prev];
                    el?.focus();
                  } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const current = poRadioRefs.current[focusedPoIndex];
                    if (current) {
                      current.checked = true;
                      const val = current.value;
                      setSelectedPoId(val);
                      ensurePoQuickView(val);
                    }
                  }
                }}
              >
                {posLoading ? (
                  <div className="p-3 text-sm text-gray-500">Loading approved POs…</div>
                ) : filteredPOs.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No approved POs found</div>
                ) : (
                  <ul>
                    {filteredPOs.map((po: PurchaseOrder, idx: number) => {
                      const orderNumber = po.order_number || po.poNumber;
                      const supplierName = po.supplier_name || po.supplierName;
                      const orderDate = formatDisplayDate(po.order_date || po.orderDate);
                      const totalAmount = po.total_amount ?? po.totalAmount ?? 0;
                      const qv = poQuickView[po.id];
                      return (
                        <li key={po.id} className="border-b last:border-b-0">
                          <label
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                            onMouseEnter={() => ensurePoQuickView(po.id)}
                            onFocus={() => ensurePoQuickView(po.id)}
                          >
                            <input
                              ref={(el) => { if (el) poRadioRefs.current[idx] = el; }}
                              type="radio"
                              name="selected-po"
                              value={po.id}
                              checked={selectedPoId === po.id}
                              onChange={() => { setSelectedPoId(po.id); ensurePoQuickView(po.id); }}
                              aria-label={`Select ${orderNumber} from ${supplierName}`}
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{orderNumber}</div>
                              <div className="text-xs text-gray-600">{supplierName}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {qv ? `${qv.itemsCount} item${qv.itemsCount === 1 ? '' : 's'}` : 'items: —'} • Total {formatCurrency(totalAmount)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">{orderDate}</div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {poPagination && (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <div>Page {poPagination.page} of {poPagination.totalPages}</div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded" disabled={poPage === 1} onClick={() => { setPoPage(Math.max(1, poPage - 1)); fetchPendingPOs(); }}>Prev</button>
                    <button className="px-2 py-1 border rounded" disabled={poPage === poPagination.totalPages} onClick={() => { setPoPage(Math.min(poPagination.totalPages, poPage + 1)); fetchPendingPOs(); }}>Next</button>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedPoId('');
                    setPoSearch('');
                    setPoPage(1);
                    setFocusedPoIndex(0);
                  }}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button onClick={handleCreateGR} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50" disabled={createPending || !selectedPoId}>
                  {createPending ? 'Creating…' : 'Create GR'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
