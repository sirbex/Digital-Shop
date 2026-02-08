import { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import {
  inventoryApi,
  productsApi,
  stockAdjustmentsApi,
  stockMovementsApi,
  goodsReceiptsApi,
  purchasesApi,
  suppliersApi,
} from '../lib/api';
import { ProductForm } from '../components/forms/ProductForm';
import { usePermissions } from '../hooks/usePermissions';

type TabType = 'products' | 'stock-levels' | 'batches' | 'adjustments' | 'movements' | 'goods-receipts' | 'purchase-orders';

export function InventoryPage() {
  const perms = usePermissions();
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [isLoading, setIsLoading] = useState(true);

  // Stock Levels state
  const [stockLevels, setStockLevels] = useState<any[]>([]);

  // All categories and UOMs for form dropdowns (from ALL products)
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allUOMs, setAllUOMs] = useState<string[]>([]);

  // Products tab state
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('ACTIVE');
  const [productsPerPage, setProductsPerPage] = useState<number>(50);
  const [currentProductsPage, setCurrentProductsPage] = useState<number>(1);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  // Transaction History modal state
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [transactionHistoryProduct, setTransactionHistoryProduct] = useState<any>(null);
  const [productHistory, setProductHistory] = useState<any>({
    sales: [],
    receipts: [],
    movements: [],
    batches: [],
    summary: null,
    product: null,
    isLoading: true,
  });
  const [historyTab, setHistoryTab] = useState<'sales' | 'receipts' | 'movements' | 'batches'>('sales');

  // Product Details modal state
  const [showProductDetails, setShowProductDetails] = useState(false);
  const [productDetailsData, setProductDetailsData] = useState<any>(null);
  const [productDetailsLoading, setProductDetailsLoading] = useState(false);

  // Batches state
  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);

  // Adjustments state
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [adjustmentPagination, setAdjustmentPagination] = useState({ page: 1, total: 0 });

  // Stock Movements state
  const [movements, setMovements] = useState<any[]>([]);
  const [movementPagination, setMovementPagination] = useState({ page: 1, total: 0 });

  // Goods Receipts state
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [grPagination, setGrPagination] = useState({ page: 1, total: 0 });

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poPagination, setPoPagination] = useState({ page: 1, total: 0 });
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showGRModal, setShowGRModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    productId: '',
    batchId: '',
    adjustmentType: 'ADJUSTMENT_IN',
    quantity: '',
    reason: '',
    notes: '',
  });
  const [grData, setGrData] = useState<any>({
    supplierId: '',
    receivedDate: new Date().toISOString().split('T')[0],
    notes: '',
    items: [] as any[],
  });
  const [poData, setPoData] = useState<any>({
    supplierId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDate: '',
    notes: '',
    items: [] as any[],
  });

  // Purchase Order View/Edit modal state
  const [showPOViewModal, setShowPOViewModal] = useState(false);
  const [viewingPO, setViewingPO] = useState<any>(null);
  const [poViewLoading, setPOViewLoading] = useState(false);
  const [editingPOMode, setEditingPOMode] = useState(false);
  const [editPOData, setEditPOData] = useState<any>(null);

  // Product search state for PO items
  const [poProductSearch, setPoProductSearch] = useState<{ [key: number]: string }>({});
  const [poProductDropdown, setPoProductDropdown] = useState<number | null>(null);
  const [editPoProductSearch, setEditPoProductSearch] = useState<{ [key: number]: string }>({});
  const [editPoProductDropdown, setEditPoProductDropdown] = useState<number | null>(null);

  // Goods Receipt View/Review modal state
  const [showGRViewModal, setShowGRViewModal] = useState(false);
  const [viewingGR, setViewingGR] = useState<any>(null);
  const [grViewLoading, setGRViewLoading] = useState(false);
  const [grItems, setGRItems] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [productsRes, allProductsRes, suppliersRes] = await Promise.all([
        productsApi.getAll({ status: 'ACTIVE' }),
        productsApi.getAll({}), // Get ALL products for categories/UOMs
        suppliersApi.getAll(),
      ]);

      if (productsRes.data.success) setProducts(productsRes.data.data);
      if (suppliersRes.data.success) setSuppliers(suppliersRes.data.data);
      
      // Extract unique categories and UOMs from ALL products
      if (allProductsRes.data.success) {
        const allProds = allProductsRes.data.data;
        setAllCategories(Array.from(new Set(allProds.map((p: any) => p.category).filter(Boolean))).sort() as string[]);
        setAllUOMs(Array.from(new Set(allProds.map((p: any) => p.unitOfMeasure).filter(Boolean))).sort() as string[]);
      }
      // Note: loadTabData is called by useEffect on activeTab change, no need to call here
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTabData = async () => {
    setIsLoading(true);
    try {
      switch (activeTab) {
        case 'products':
          await loadProducts();
          break;
        case 'stock-levels':
          await loadStockLevels();
          break;
        case 'batches':
          await loadBatches();
          break;
        case 'adjustments':
          await loadAdjustments();
          break;
        case 'movements':
          await loadMovements();
          break;
        case 'goods-receipts':
          await loadGoodsReceipts();
          break;
        case 'purchase-orders':
          await loadPurchaseOrders();
          break;
      }
    } catch (error) {
      console.error('Failed to load tab data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStockLevels = async () => {
    const response = await inventoryApi.getStockLevels();
    if (response.data.success) setStockLevels(response.data.data);
  };

  const loadProducts = async () => {
    const response = await productsApi.getAll({ status: productStatusFilter });
    if (response.data.success) {
      setProducts(response.data.data);
      filterProducts(response.data.data);
    }
  };

  const filterProducts = (productList = products) => {
    let filtered = [...productList];
    if (productSearchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
          (p.barcode && p.barcode.toLowerCase().includes(productSearchQuery.toLowerCase()))
      );
    }
    if (productCategoryFilter) {
      filtered = filtered.filter((p) => p.category === productCategoryFilter);
    }
    setFilteredProducts(filtered);
  };

  // Memoized inventory summary calculations using Decimal.js for precision
  const inventorySummary = useMemo(() => {
    let totalCost = new Decimal(0);
    let totalSelling = new Decimal(0);

    filteredProducts.forEach((product) => {
      const costPrice = new Decimal(product.costPrice || 0);
      const sellingPrice = new Decimal(product.sellingPrice || 0);
      const quantity = new Decimal(product.quantityOnHand || 0);

      // Accumulate totals with precision
      totalCost = totalCost.plus(costPrice.times(quantity));
      totalSelling = totalSelling.plus(sellingPrice.times(quantity));
    });

    const profit = totalSelling.minus(totalCost);

    return {
      totalProducts: filteredProducts.length,
      totalCostValue: totalCost.toDecimalPlaces(2).toNumber(),
      totalSellingValue: totalSelling.toDecimalPlaces(2).toNumber(),
      potentialProfit: profit.toDecimalPlaces(2).toNumber(),
    };
  }, [filteredProducts]); // Only recalculate when filteredProducts changes

  // Memoized pagination for products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentProductsPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentProductsPage, productsPerPage]);

  const totalProductsPages = Math.ceil(filteredProducts.length / productsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentProductsPage(1);
  }, [productSearchQuery, productCategoryFilter, productStatusFilter]);

  // Filter products when search/filter changes
  useEffect(() => {
    if (activeTab === 'products') {
      filterProducts();
    }
  }, [productSearchQuery, productCategoryFilter]);

  // Reload products when status filter changes
  useEffect(() => {
    if (activeTab === 'products') {
      loadProducts();
    }
  }, [productStatusFilter]);

  const productCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const loadBatches = async () => {
    const params: any = {};
    if (selectedProduct) params.productId = selectedProduct;
    if (statusFilter) params.status = statusFilter;
    if (expiringOnly) params.expiringSoon = 30;

    const response = await inventoryApi.getBatches(params);
    if (response.data.success) setBatches(response.data.data);
  };

  const loadAdjustments = async (page = 1) => {
    const response = await stockAdjustmentsApi.getAll({ page, limit: 20 });
    if (response.data.success) {
      setAdjustments(response.data.data);
      setAdjustmentPagination({ page, total: (response.data as any).pagination?.total || 0 });
    }
  };

  const loadMovements = async (page = 1) => {
    const response = await stockMovementsApi.getAll({ page, limit: 20 });
    if (response.data.success) {
      setMovements(response.data.data);
      setMovementPagination({ page, total: (response.data as any).pagination?.total || 0 });
    }
  };

  const loadGoodsReceipts = async (page = 1) => {
    const response = await goodsReceiptsApi.getAll({ page, limit: 20 });
    if (response.data.success) {
      // Map backend field names to frontend expected names
      const mappedData = response.data.data.map((gr: any) => ({
        ...gr,
        grNumber: gr.grNumber || gr.receiptNumber, // Handle both field names
        totalAmount: gr.totalAmount || gr.totalValue || 0, // Handle both field names
      }));
      setGoodsReceipts(mappedData);
      setGrPagination({ page, total: (response.data as any).pagination?.total || 0 });
    }
  };

  const loadPurchaseOrders = async (page = 1) => {
    const response = await purchasesApi.getAll({ page, limit: 20 });
    if (response.data.success) {
      setPurchaseOrders(response.data.data);
      setPoPagination({ page, total: (response.data as any).pagination?.total || 0 });
    }
  };

  // Transaction History handler
  const handleViewTransactionHistory = async (product: any) => {
    setTransactionHistoryProduct(product);
    setShowTransactionHistory(true);
    setProductHistory({ 
      sales: [], 
      receipts: [], 
      movements: [], 
      batches: [],
      summary: null,
      product: null,
      isLoading: true 
    });

    try {
      // Use comprehensive product history endpoint
      const response = await inventoryApi.getProductHistory(product.id);
      
      if (response.data.success) {
        setProductHistory({
          ...response.data.data,
          isLoading: false,
        });
      } else {
        setProductHistory({ 
          sales: [], 
          receipts: [], 
          movements: [], 
          batches: [],
          summary: null,
          product: null,
          isLoading: false 
        });
      }
    } catch (error) {
      console.error('Failed to load transaction history:', error);
      setProductHistory({ 
        sales: [], 
        receipts: [], 
        movements: [], 
        batches: [],
        summary: null,
        product: null,
        isLoading: false 
      });
    }
  };

  const handleViewProductDetails = async (product: any) => {
    setShowProductDetails(true);
    setProductDetailsLoading(true);
    setProductDetailsData(null);

    try {
      const response = await inventoryApi.getProductDetails(product.id);
      
      if (response.data.success) {
        setProductDetailsData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load product details:', error);
    } finally {
      setProductDetailsLoading(false);
    }
  };

  const handleCreateAdjustment = async () => {
    try {
      const response = await stockAdjustmentsApi.create({
        productId: adjustmentData.productId,
        batchId: adjustmentData.batchId || undefined,
        adjustmentType: adjustmentData.adjustmentType,
        quantity: parseFloat(adjustmentData.quantity),
        reason: adjustmentData.reason,
        notes: adjustmentData.notes || undefined,
      });

      if (response.data.success) {
        alert(`Stock adjustment ${response.data.data.adjustmentNumber || response.data.data.id || ''} created successfully!`);
        setShowAdjustModal(false);
        resetAdjustmentForm();
        loadAdjustments();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create adjustment');
    }
  };

  const handleApproveAdjustment = async (id: string) => {
    if (!confirm('Approve this stock adjustment?')) return;
    try {
      const response = await stockAdjustmentsApi.approve(id);
      if (response.data.success) {
        alert('Adjustment approved!');
        loadAdjustments();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve adjustment');
    }
  };

  const handleRejectAdjustment = async (id: string) => {
    const notes = prompt('Reason for rejection:');
    if (notes === null) return;
    try {
      const response = await stockAdjustmentsApi.reject(id, notes);
      if (response.data.success) {
        alert('Adjustment rejected!');
        loadAdjustments();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject adjustment');
    }
  };

  const handleCreateGoodsReceipt = async () => {
    try {
      const response = await goodsReceiptsApi.create({
        receivedDate: grData.receivedDate,
        notes: grData.notes,
        items: grData.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          orderedQuantity: item.quantityOrdered,
          receivedQuantity: item.quantityReceived,
          costPrice: item.unitCost,
          expiryDate: item.expiryDate || null,
          batchNumber: item.batchNumber || null,
        })),
      });

      if (response.data.success) {
        alert(`Goods receipt ${response.data.data.grNumber} created!`);
        setShowGRModal(false);
        resetGRForm();
        loadGoodsReceipts();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create goods receipt');
    }
  };

  // View GR details for review
  const handleViewGR = async (id: string) => {
    setGRViewLoading(true);
    setShowGRViewModal(true);
    try {
      const response = await goodsReceiptsApi.getById(id);
      if (response.data.success) {
        setViewingGR(response.data.data);
        setGRItems(response.data.data.items || []);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load goods receipt');
      setShowGRViewModal(false);
    } finally {
      setGRViewLoading(false);
    }
  };

  // Update GR item quantity before finalize
  const updateGRItemQuantity = (index: number, field: string, value: any) => {
    const newItems = [...grItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setGRItems(newItems);
  };

  // Save GR item updates
  const handleSaveGRItems = async () => {
    if (!viewingGR) return;
    try {
      // Update each item that was modified
      for (const item of grItems) {
        await goodsReceiptsApi.updateItem(viewingGR.id, item.id, {
          receivedQuantity: item.receivedQuantity,
          costPrice: item.unitCost || item.costPrice,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
        });
      }
      alert('Items updated successfully!');
      // Reload the GR data
      handleViewGR(viewingGR.id);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update items');
    }
  };

  // Finalize GR from the review modal
  const handleFinalizeGRFromModal = async () => {
    if (!viewingGR) return;
    if (!confirm('Finalize this goods receipt? This will add items to inventory and cannot be undone.')) return;
    
    try {
      const response = await goodsReceiptsApi.finalize(viewingGR.id);
      if (response.data.success) {
        const costChanges = (response.data as any).costChanges;
        if (costChanges?.length > 0) {
          alert(`Goods receipt finalized! ${costChanges.length} product cost(s) updated.`);
        } else {
          alert('Goods receipt finalized! Inventory updated.');
        }
        setShowGRViewModal(false);
        setViewingGR(null);
        loadGoodsReceipts();
        loadStockLevels();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to finalize goods receipt');
    }
  };

  const handleFinalizeGR = async (id: string) => {
    // Open the review modal instead of direct finalize
    handleViewGR(id);
  };

  const handleCreatePO = async () => {
    // Frontend validation
    if (!poData.supplierId) {
      alert('Please select a supplier');
      return;
    }
    if (poData.items.length === 0) {
      alert('Please add at least one item');
      return;
    }
    const invalidItems = poData.items.filter((item: any) => !item.productId || item.quantity <= 0);
    if (invalidItems.length > 0) {
      alert('Please ensure all items have a product selected and quantity > 0');
      return;
    }
    
    try {
      const response = await purchasesApi.create({
        supplierId: poData.supplierId,
        orderDate: poData.orderDate,
        expectedDeliveryDate: poData.expectedDate || undefined,
        notes: poData.notes || undefined,
        items: poData.items.map((item: any) => ({
          productId: item.productId,
          orderedQuantity: item.quantity,
          unitPrice: item.unitCost,
        })),
      });

      if (response.data.success) {
        alert(`Purchase order ${response.data.data.orderNumber} created!`);
        setShowPOModal(false);
        resetPOForm();
        loadPurchaseOrders();
      }
    } catch (error: any) {
      // Show detailed validation errors if available
      const errData = error.response?.data;
      if (errData?.details && Array.isArray(errData.details)) {
        const detailMsg = errData.details.map((d: any) => `${d.field || d.path?.join('.')}: ${d.message}`).join('\n');
        alert(`Validation failed:\n${detailMsg}`);
      } else {
        alert(errData?.error || 'Failed to create purchase order');
      }
    }
  };

  const handleApprovePO = async (id: string) => {
    if (!confirm('Approve this purchase order?')) return;
    try {
      const response = await purchasesApi.approve(id);
      if (response.data.success) {
        alert('Purchase order approved!');
        loadPurchaseOrders();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve purchase order');
    }
  };

  const handleReceivePO = async (id: string) => {
    if (!confirm('Create goods receipt from this purchase order?')) return;
    try {
      const response = await goodsReceiptsApi.hydrateFromPO(id);
      if (response.data.success) {
        alert(`Goods receipt ${response.data.data.grNumber} created! Please review and finalize.`);
        setActiveTab('goods-receipts');
        loadGoodsReceipts();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create goods receipt');
    }
  };

  // View PO details
  const handleViewPO = async (id: string) => {
    setPOViewLoading(true);
    setShowPOViewModal(true);
    setEditingPOMode(false);
    try {
      const response = await purchasesApi.getById(id);
      if (response.data.success) {
        setViewingPO(response.data.data);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load purchase order');
      setShowPOViewModal(false);
    } finally {
      setPOViewLoading(false);
    }
  };

  // Send PO to supplier (change status to SENT)
  const handleSendPO = async (id: string) => {
    if (!confirm('Send this purchase order to the supplier?')) return;
    try {
      const response = await purchasesApi.updateStatus(id, 'SENT');
      if (response.data.success) {
        alert('Purchase order sent to supplier!');
        loadPurchaseOrders();
        if (viewingPO?.id === id) {
          setViewingPO({ ...viewingPO, status: 'SENT' });
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to send purchase order');
    }
  };

  // Cancel PO
  const handleCancelPO = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this purchase order? This action cannot be undone.')) return;
    try {
      const response = await purchasesApi.cancel(id);
      if (response.data.success) {
        alert('Purchase order cancelled.');
        loadPurchaseOrders();
        if (viewingPO?.id === id) {
          setViewingPO({ ...viewingPO, status: 'CANCELLED' });
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to cancel purchase order');
    }
  };

  // Duplicate PO
  const handleDuplicatePO = async (po: any) => {
    // Pre-fill the PO modal with duplicate data
    setPoData({
      supplierId: po.supplierId,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDate: '',
      notes: po.notes || '',
      items: (po.items || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.orderedQuantity,
        unitCost: item.unitPrice,
      })),
    });
    setShowPOViewModal(false);
    setShowPOModal(true);
  };

  // Start editing a DRAFT PO
  const handleStartEditPO = () => {
    if (!viewingPO || viewingPO.status !== 'DRAFT') return;
    setEditPOData({
      supplierId: viewingPO.supplierId,
      orderDate: viewingPO.orderDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      expectedDate: viewingPO.expectedDeliveryDate?.split('T')[0] || '',
      notes: viewingPO.notes || '',
      items: (viewingPO.items || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.orderedQuantity,
        unitCost: item.unitPrice,
      })),
    });
    setEditingPOMode(true);
  };

  // Update PO item during edit
  const updateEditPOItem = (index: number, field: string, value: any) => {
    const newItems = [...editPOData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
        newItems[index].unitCost = product.costPrice || 0;
      }
    }

    setEditPOData({ ...editPOData, items: newItems });
  };

  // Add item during edit
  const addEditPOItem = () => {
    setEditPOData({
      ...editPOData,
      items: [
        ...editPOData.items,
        { productId: '', productName: '', quantity: 0, unitCost: 0 },
      ],
    });
  };

  // Remove item during edit
  const removeEditPOItem = (index: number) => {
    const newItems = editPOData.items.filter((_: any, i: number) => i !== index);
    setEditPOData({ ...editPOData, items: newItems });
  };

  // Save edited PO (create new one since we can't update items)
  const handleSaveEditPO = async () => {
    if (!viewingPO || !editPOData) return;
    
    // Frontend validation
    if (!editPOData.supplierId) {
      alert('Please select a supplier');
      return;
    }
    if (editPOData.items.length === 0) {
      alert('Please add at least one item');
      return;
    }
    const invalidItems = editPOData.items.filter((item: any) => !item.productId || item.quantity <= 0);
    if (invalidItems.length > 0) {
      alert('Please ensure all items have a product selected and quantity > 0');
      return;
    }
    
    // For now, cancel the old one and create a new one
    // (or we could add an update endpoint in the backend)
    try {
      // Create new PO with updated data
      const response = await purchasesApi.create({
        supplierId: editPOData.supplierId,
        orderDate: editPOData.orderDate,
        expectedDeliveryDate: editPOData.expectedDate || undefined,
        notes: editPOData.notes || undefined,
        items: editPOData.items.map((item: any) => ({
          productId: item.productId,
          orderedQuantity: item.quantity,
          unitPrice: item.unitCost,
        })),
      });

      if (response.data.success) {
        // Cancel the old PO
        await purchasesApi.cancel(viewingPO.id);
        
        alert(`Purchase order updated! New PO: ${response.data.data.orderNumber}`);
        setShowPOViewModal(false);
        setEditingPOMode(false);
        setEditPOData(null);
        loadPurchaseOrders();
      }
    } catch (error: any) {
      // Show detailed validation errors if available
      const errData = error.response?.data;
      if (errData?.details && Array.isArray(errData.details)) {
        const detailMsg = errData.details.map((d: any) => `${d.field || d.path?.join('.')}: ${d.message}`).join('\n');
        alert(`Validation failed:\n${detailMsg}`);
      } else {
        alert(errData?.error || 'Failed to update purchase order');
      }
    }
  };

  // Export PO as PDF
  const handleExportPOPdf = () => {
    if (!viewingPO) return;

    const supplier = suppliers.find(s => s.id === viewingPO.supplierId);
    const itemsTotal = viewingPO.items?.reduce((sum: number, item: any) => 
      sum + (item.orderedQuantity * item.unitPrice), 0) || viewingPO.totalAmount;

    // Create a hidden iframe for PDF generation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      alert('Failed to create PDF. Please try again.');
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${viewingPO.orderNumber}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; }
          .header h1 { margin: 0 0 5px 0; color: #1e40af; font-size: 28px; }
          .header .po-number { font-size: 18px; color: #666; font-weight: bold; }
          .header .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-top: 10px; }
          .status-DRAFT { background: #e5e7eb; color: #374151; }
          .status-SENT { background: #e9d5ff; color: #7c3aed; }
          .status-PARTIAL { background: #fef3c7; color: #d97706; }
          .status-RECEIVED { background: #d1fae5; color: #059669; }
          .status-CANCELLED { background: #fee2e2; color: #dc2626; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-section { background: #f9fafb; padding: 15px; border-radius: 8px; }
          .info-section h3 { margin: 0 0 12px 0; color: #1e40af; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-section p { margin: 6px 0; font-size: 13px; }
          .info-section .label { color: #6b7280; }
          .info-section .value { color: #111827; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
          th { background: #1e40af; color: white; padding: 12px 10px; text-align: left; font-weight: 600; }
          td { border-bottom: 1px solid #e5e7eb; padding: 10px; }
          tr:hover { background: #f9fafb; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .total-row { font-weight: bold; background: #eff6ff !important; }
          .total-row td { border-top: 2px solid #1e40af; padding: 14px 10px; }
          .notes { margin-top: 25px; padding: 15px; background: #fefce8; border-left: 4px solid #eab308; border-radius: 0 8px 8px 0; }
          .notes strong { color: #854d0e; }
          .footer { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; }
          .signature { border-top: 2px solid #333; padding-top: 10px; text-align: center; font-size: 12px; color: #666; }
          .company-info { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
          @media print { 
            body { padding: 15px; } 
            .header { border-bottom-width: 2px; }
          }
          @page { margin: 0.5in; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PURCHASE ORDER</h1>
          <div class="po-number">${viewingPO.orderNumber}</div>
          <div class="status status-${viewingPO.status}">${viewingPO.status}</div>
        </div>
        
        <div class="info-grid">
          <div class="info-section">
            <h3>📦 Supplier Information</h3>
            <p><span class="value" style="font-size: 15px;">${supplier?.name || viewingPO.supplierName || 'N/A'}</span></p>
            ${supplier?.contactPerson ? `<p><span class="label">Contact:</span> <span class="value">${supplier.contactPerson}</span></p>` : ''}
            ${supplier?.phone ? `<p><span class="label">Phone:</span> <span class="value">${supplier.phone}</span></p>` : ''}
            ${supplier?.email ? `<p><span class="label">Email:</span> <span class="value">${supplier.email}</span></p>` : ''}
            ${supplier?.address ? `<p><span class="label">Address:</span> <span class="value">${supplier.address}</span></p>` : ''}
          </div>
          <div class="info-section">
            <h3>📋 Order Details</h3>
            <p><span class="label">Order Date:</span> <span class="value">${new Date(viewingPO.orderDate).toLocaleDateString()}</span></p>
            <p><span class="label">Expected Delivery:</span> <span class="value">${viewingPO.expectedDeliveryDate ? new Date(viewingPO.expectedDeliveryDate).toLocaleDateString() : 'Not specified'}</span></p>
            <p><span class="label">Payment Terms:</span> <span class="value">${viewingPO.paymentTerms || supplier?.paymentTerms || 'NET30'}</span></p>
            <p><span class="label">Created By:</span> <span class="value">${viewingPO.createdByName || 'System'}</span></p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 40px;">#</th>
              <th>Product</th>
              <th>SKU</th>
              <th class="text-right" style="width: 80px;">Qty</th>
              <th class="text-right" style="width: 120px;">Unit Price</th>
              <th class="text-right" style="width: 120px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(viewingPO.items || []).map((item: any, i: number) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td>${item.productName || 'N/A'}</td>
                <td>${item.sku || '-'}</td>
                <td class="text-right">${item.orderedQuantity}</td>
                <td class="text-right">UGX ${Number(item.unitPrice || 0).toLocaleString()}</td>
                <td class="text-right">UGX ${(item.orderedQuantity * item.unitPrice).toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5" class="text-right">Grand Total:</td>
              <td class="text-right">UGX ${Number(itemsTotal).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        ${viewingPO.notes ? `
          <div class="notes">
            <strong>📝 Notes:</strong>
            <p style="margin: 8px 0 0 0;">${viewingPO.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <div>
            <div class="signature">Authorized Signature</div>
          </div>
          <div>
            <div class="signature">Received By / Date</div>
          </div>
        </div>

        <div class="company-info">
          Generated on ${new Date().toLocaleString()} • DigitalShop ERP System
        </div>
      </body>
      </html>
    `);
    doc.close();

    // Wait for content to render, then trigger print (which can save as PDF)
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove iframe after printing
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 300);
  };

  // Format currency for UGX
  const formatUGX = (amount: number) => {
    return `UGX ${Number(amount || 0).toLocaleString()}`;
  };

  const resetAdjustmentForm = () => {
    setAdjustmentData({
      productId: '',
      batchId: '',
      adjustmentType: 'ADJUSTMENT_IN',
      quantity: '',
      reason: '',
      notes: '',
    });
  };

  const resetGRForm = () => {
    setGrData({
      supplierId: '',
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
      items: [],
    });
  };

  const resetPOForm = () => {
    setPoData({
      supplierId: '',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDate: '',
      notes: '',
      items: [],
    });
    setPoProductSearch({});
    setPoProductDropdown(null);
  };

  const addGRItem = () => {
    setGrData({
      ...grData,
      items: [
        ...grData.items,
        {
          productId: '',
          productName: '',
          quantityOrdered: 0,
          quantityReceived: 0,
          unitCost: 0,
          expiryDate: '',
          batchNumber: '',
        },
      ],
    });
  };

  const updateGRItem = (index: number, field: string, value: any) => {
    const newItems = [...grData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill product name
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
        newItems[index].unitCost = product.costPrice || 0;
      }
    }

    setGrData({ ...grData, items: newItems });
  };

  const removeGRItem = (index: number) => {
    const newItems = grData.items.filter((_: any, i: number) => i !== index);
    setGrData({ ...grData, items: newItems });
  };

  const addPOItem = () => {
    const newIndex = poData.items.length;
    setPoData({
      ...poData,
      items: [
        ...poData.items,
        {
          productId: '',
          productName: '',
          quantity: 1,
          unitCost: 0,
        },
      ],
    });
    // Focus on the new item's search
    setPoProductDropdown(newIndex);
    setPoProductSearch({ ...poProductSearch, [newIndex]: '' });
  };

  const updatePOItem = (index: number, field: string, value: any) => {
    const newItems = [...poData.items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Auto-fill product name
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
        newItems[index].unitCost = product.costPrice || 0;
      }
    }

    setPoData({ ...poData, items: newItems });
  };

  const removePOItem = (index: number) => {
    const newItems = poData.items.filter((_: any, i: number) => i !== index);
    setPoData({ ...poData, items: newItems });
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const getExpiryBadge = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const days = getDaysUntilExpiry(expiryDate);
    if (days < 0) return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Expired</span>;
    if (days <= 7) return <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">{days}d left</span>;
    if (days <= 30) return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">{days}d left</span>;
    return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">{days}d left</span>;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-red-100 text-red-800',
      DEPLETED: 'bg-gray-100 text-gray-800',
      EXPIRED: 'bg-red-100 text-red-800',
      // PO-specific statuses
      SENT: 'bg-purple-100 text-purple-800',
      PARTIAL: 'bg-orange-100 text-orange-800',
      RECEIVED: 'bg-green-100 text-green-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  // PO-specific status badge with icons
  const getPOStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; icon: string; label: string }> = {
      DRAFT: { bg: 'bg-gray-100 text-gray-700', icon: '📝', label: 'Draft' },
      SENT: { bg: 'bg-purple-100 text-purple-700', icon: '📤', label: 'Sent' },
      APPROVED: { bg: 'bg-blue-100 text-blue-700', icon: '✅', label: 'Approved' },
      PARTIAL: { bg: 'bg-orange-100 text-orange-700', icon: '📦', label: 'Partial' },
      RECEIVED: { bg: 'bg-green-100 text-green-700', icon: '✔️', label: 'Received' },
      CANCELLED: { bg: 'bg-red-100 text-red-700', icon: '❌', label: 'Cancelled' },
    };
    const statusConfig = config[status] || { bg: 'bg-gray-100 text-gray-700', icon: '❓', label: status };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg}`}>
        <span>{statusConfig.icon}</span>
        <span>{statusConfig.label}</span>
      </span>
    );
  };

  // Permission-gated tab definitions
  const allTabs: { id: TabType; label: string; icon: string; permitted: boolean }[] = [
    { id: 'products', label: 'Products', icon: '🏷️', permitted: perms.canViewProducts },
    { id: 'stock-levels', label: 'Stock Levels', icon: '📊', permitted: perms.canViewInventory },
    { id: 'batches', label: 'Batches', icon: '📦', permitted: perms.canViewBatches || perms.canViewInventory },
    { id: 'adjustments', label: 'Adjustments', icon: '🔧', permitted: perms.canAny('inventory.adjust', 'inventory.approve', 'inventory.read') },
    { id: 'movements', label: 'Movements', icon: '↔️', permitted: perms.canViewMovements || perms.canViewInventory },
    { id: 'goods-receipts', label: 'Goods Receipts', icon: '📥', permitted: perms.canViewGoodsReceipts || perms.canReceiveGoods },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: '📋', permitted: perms.canViewPurchases },
  ];
  const tabs = allTabs.filter(t => t.permitted);

  // Ensure activeTab is always a permitted tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <div className="flex gap-2">
          {activeTab === 'products' && perms.canCreateProduct && (
            <button onClick={() => setShowAddProductModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              + Add Product
            </button>
          )}
          {activeTab === 'adjustments' && perms.canAdjustStock && (
            <button onClick={() => setShowAdjustModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              + Stock Adjustment
            </button>
          )}
          {activeTab === 'goods-receipts' && perms.canReceiveGoods && (
            <button onClick={() => setShowGRModal(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              + Goods Receipt
            </button>
          )}
          {activeTab === 'purchase-orders' && perms.canCreatePurchase && (
            <button onClick={() => setShowPOModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
              + Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <>
              {/* Inventory Summary Dashboard - Shown on Products Tab */}
              {activeTab === 'products' && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {/* Total Products */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-5 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-blue-100 text-sm font-medium uppercase tracking-wide">Total Products</div>
                        <div className="text-3xl">📦</div>
                      </div>
                      <div className="text-3xl font-bold">{inventorySummary.totalProducts}</div>
                      <div className="text-blue-100 text-xs mt-1">Active items in inventory</div>
                    </div>

                    {/* Total Cost Value - only visible with cost permission */}
                    {perms.canViewCostPrice && (
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-5 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-purple-100 text-sm font-medium uppercase tracking-wide">Stock Cost Value</div>
                        <div className="text-3xl">💰</div>
                      </div>
                      <div className="text-2xl font-bold">
                        UGX {inventorySummary.totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-purple-100 text-xs mt-1">Total inventory cost</div>
                    </div>
                    )}

                    {/* Total Selling Value */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-5 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-green-100 text-sm font-medium uppercase tracking-wide">Stock Selling Value</div>
                        <div className="text-3xl">💵</div>
                      </div>
                      <div className="text-2xl font-bold">
                        UGX {inventorySummary.totalSellingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-green-100 text-xs mt-1">Potential revenue</div>
                    </div>

                    {/* Potential Profit - only visible with profit permission */}
                    {perms.canViewProfit && (
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-5 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-orange-100 text-sm font-medium uppercase tracking-wide">Potential Profit</div>
                        <div className="text-3xl">📈</div>
                      </div>
                      <div className="text-2xl font-bold">
                        UGX {inventorySummary.potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-orange-100 text-xs mt-1">If all stock sold</div>
                    </div>
                    )}
                  </div>
                </>
              )}

              {/* Products Tab */}
              {activeTab === 'products' && (
                <div className="space-y-4">
                  {/* Product Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="Search by name, SKU, barcode..."
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={productCategoryFilter}
                      onChange={(e) => setProductCategoryFilter(e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Filter products by category"
                      title="Filter products by category"
                    >
                      <option value="">All Categories</option>
                      {productCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <select
                      value={productStatusFilter}
                      onChange={(e) => setProductStatusFilter(e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Filter products by status"
                      title="Filter products by status"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="DISCONTINUED">Discontinued</option>
                    </select>
                    <div className="text-sm text-gray-600 flex items-center gap-4">
                      <span>
                        Showing {filteredProducts.length === 0 ? 0 : ((currentProductsPage - 1) * productsPerPage) + 1}-{Math.min(currentProductsPage * productsPerPage, filteredProducts.length)} of {filteredProducts.length} products
                      </span>
                      <select
                        value={productsPerPage}
                        onChange={(e) => {
                          setProductsPerPage(Number(e.target.value));
                          setCurrentProductsPage(1);
                        }}
                        className="px-2 py-1 border rounded text-sm"
                        aria-label="Items per page"
                      >
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                      </select>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU / Barcode</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pricing</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginatedProducts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                              No products found
                            </td>
                          </tr>
                        ) : (
                          paginatedProducts.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900">{product.name}</div>
                                <div className="text-sm text-gray-500">{product.description}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-mono">{product.sku}</div>
                                {product.barcode && (
                                  <div className="text-xs text-gray-500 font-mono">{product.barcode}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{product.category}</td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-900">Sell: UGX {product.sellingPrice?.toLocaleString()}</div>
                                {perms.canViewCostPrice && (
                                  <div className="text-xs text-gray-500">Cost: UGX {product.costPrice?.toLocaleString()}</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className={`text-sm font-medium ${product.quantityOnHand <= product.reorderLevel ? 'text-red-600' : 'text-green-600'}`}>
                                  {product.quantityOnHand} {product.unitOfMeasure}
                                </div>
                                <div className="text-xs text-gray-500">Reorder: {product.reorderLevel}</div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <button 
                                  onClick={() => handleViewProductDetails(product)} 
                                  className="text-purple-600 hover:text-purple-800 mr-3"
                                  title="View Product Details"
                                >
                                  Details
                                </button>
                                <button 
                                  onClick={() => handleViewTransactionHistory(product)} 
                                  className="text-green-600 hover:text-green-800 mr-3"
                                  title="View Transaction History"
                                >
                                  History
                                </button>
                                {perms.canEditProduct && (
                                <button onClick={() => setEditingProduct(product)} className="text-blue-600 hover:text-blue-800 mr-3">
                                  Edit
                                </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {filteredProducts.length > productsPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-sm text-gray-600">
                        Page {currentProductsPage} of {totalProductsPages}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentProductsPage(1)}
                          disabled={currentProductsPage === 1}
                          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="First page"
                        >
                          «
                        </button>
                        <button
                          onClick={() => setCurrentProductsPage(prev => Math.max(1, prev - 1))}
                          disabled={currentProductsPage === 1}
                          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Previous page"
                        >
                          ‹
                        </button>
                        <div className="flex gap-1">
                          {Array.from({ length: Math.min(5, totalProductsPages) }, (_, i) => {
                            let pageNum;
                            if (totalProductsPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentProductsPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentProductsPage >= totalProductsPages - 2) {
                              pageNum = totalProductsPages - 4 + i;
                            } else {
                              pageNum = currentProductsPage - 2 + i;
                            }
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentProductsPage(pageNum)}
                                className={`px-3 py-1 border rounded ${
                                  currentProductsPage === pageNum
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setCurrentProductsPage(prev => Math.min(totalProductsPages, prev + 1))}
                          disabled={currentProductsPage === totalProductsPages}
                          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Next page"
                        >
                          ›
                        </button>
                        <button
                          onClick={() => setCurrentProductsPage(totalProductsPages)}
                          disabled={currentProductsPage === totalProductsPages}
                          className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Last page"
                        >
                          »
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Low Stock Alert */}
                  {filteredProducts.some((p) => p.quantityOnHand <= p.reorderLevel) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center">
                        <span className="text-yellow-400 text-xl mr-2">⚠️</span>
                        <p className="text-sm text-yellow-800">
                          <strong>Low Stock Alert:</strong>{' '}
                          {filteredProducts.filter((p) => p.quantityOnHand <= p.reorderLevel).length}{' '}
                          product(s) below reorder level
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stock Levels Tab */}
              {activeTab === 'stock-levels' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Selling Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">In Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {stockLevels.map((item) => (
                        <tr key={item.productId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{item.productName}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.sku}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.category || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono">UGX {item.sellingPrice?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono">{item.totalQuantity}</td>
                          <td className="px-4 py-3 text-right font-mono">{item.reorderLevel || '-'}</td>
                          <td className="px-4 py-3">
                            {item.totalQuantity <= (item.reorderLevel || 0) ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Low Stock</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Batches Tab */}
              {activeTab === 'batches' && (
                <div>
                  <div className="mb-4 flex gap-3 flex-wrap">
                    <select
                      value={selectedProduct}
                      onChange={(e) => { setSelectedProduct(e.target.value); loadBatches(); }}
                      className="px-3 py-2 border rounded-lg"
                      aria-label="Filter batches by product"
                      title="Filter batches by product"
                    >
                      <option value="">All Products</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); loadBatches(); }}
                      className="px-3 py-2 border rounded-lg"
                      aria-label="Filter batches by status"
                      title="Filter batches by status"
                    >
                      <option value="">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="DEPLETED">Depleted</option>
                      <option value="EXPIRED">Expired</option>
                    </select>
                    <label className="flex items-center px-3 py-2 border rounded-lg">
                      <input
                        type="checkbox"
                        checked={expiringOnly}
                        onChange={(e) => { setExpiringOnly(e.target.checked); loadBatches(); }}
                        className="mr-2"
                      />
                      Expiring Soon (30 days)
                    </label>
                  </div>

                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {batches.map((batch) => (
                        <tr key={batch.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{batch.productName}</div>
                            <div className="text-sm text-gray-500">{batch.productSku}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm">{batch.batchNumber}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {batch.remainingQuantity} / {batch.initialQuantity}
                          </td>
                          <td className="px-4 py-3">
                            {batch.expiryDate ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm">{new Date(batch.expiryDate).toLocaleDateString()}</span>
                                {getExpiryBadge(batch.expiryDate)}
                              </div>
                            ) : (
                              <span className="text-gray-400">No expiry</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">{new Date(batch.receivedDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{getStatusBadge(batch.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Adjustments Tab */}
              {activeTab === 'adjustments' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adj #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {adjustments.map((adj) => (
                        <tr key={adj.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{adj.adjustmentNumber || adj.id?.slice(0, 8) || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{adj.productName}</div>
                            <div className="text-sm text-gray-500">{adj.sku}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">{adj.adjustmentType}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            <span className={(adj.quantity || adj.quantityAdjusted || 0) > 0 ? 'text-green-600' : 'text-red-600'}>
                              {(adj.quantity || adj.quantityAdjusted || 0) > 0 ? '+' : ''}{adj.quantity || adj.quantityAdjusted || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm max-w-xs truncate" title={adj.reason}>{adj.reason}</td>
                          <td className="px-4 py-3">{getStatusBadge(adj.status)}</td>
                          <td className="px-4 py-3 text-sm">
                            <div>{new Date(adj.createdAt).toLocaleDateString()}</div>
                            <div className="text-gray-500">{adj.createdByName}</div>
                          </td>
                          <td className="px-4 py-3">
                            {adj.status === 'DRAFT' && perms.canApproveAdjustment && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveAdjustment(adj.id)}
                                  className="text-green-600 hover:text-green-800 text-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectAdjustment(adj.id)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Stock Movements Tab */}
              {activeTab === 'movements' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Movement #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {movements.map((mov) => (
                        <tr key={mov.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{mov.movementNumber}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{mov.productName}</div>
                            <div className="text-sm text-gray-500">{mov.sku}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              mov.movementType === 'IN' ? 'bg-green-100 text-green-800' :
                              mov.movementType === 'OUT' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {mov.movementType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            <span className={mov.movementType === 'IN' ? 'text-green-600' : mov.movementType === 'OUT' ? 'text-red-600' : ''}>
                              {mov.movementType === 'IN' ? '+' : mov.movementType === 'OUT' ? '-' : ''}{mov.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div>{mov.referenceType}</div>
                            <div className="text-gray-500">{mov.referenceNumber}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">{new Date(mov.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Goods Receipts Tab */}
              {activeTab === 'goods-receipts' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GR #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {goodsReceipts.map((gr) => (
                        <tr key={gr.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{gr.grNumber}</td>
                          <td className="px-4 py-3">{gr.supplierName}</td>
                          <td className="px-4 py-3 font-mono text-sm">{gr.poNumber || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatUGX(gr.totalAmount)}</td>
                          <td className="px-4 py-3">{getStatusBadge(gr.status)}</td>
                          <td className="px-4 py-3 text-sm">
                            <div>{new Date(gr.receivedDate).toLocaleDateString()}</div>
                            <div className="text-gray-500">{gr.receivedByName}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleViewGR(gr.id)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                View
                              </button>
                              {gr.status === 'DRAFT' && perms.canReceiveGoods && (
                                <button
                                  onClick={() => handleViewGR(gr.id)}
                                  className="text-green-600 hover:text-green-800 text-sm"
                                >
                                  Review & Finalize
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Purchase Orders Tab */}
              {activeTab === 'purchase-orders' && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {purchaseOrders.map((po) => (
                        <tr key={po.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <button 
                              onClick={() => handleViewPO(po.id)}
                              className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {po.orderNumber || po.poNumber}
                            </button>
                          </td>
                          <td className="px-4 py-3">{po.supplierName}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatUGX(po.totalAmount)}</td>
                          <td className="px-4 py-3">{getPOStatusBadge(po.status)}</td>
                          <td className="px-4 py-3 text-sm">{new Date(po.orderDate || po.poDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-sm">
                            {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <button
                                onClick={() => handleViewPO(po.id)}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                title="View Details"
                              >
                                👁️ View
                              </button>
                              
                              {/* DRAFT actions */}
                              {po.status === 'DRAFT' && perms.canApprovePurchase && (
                                <>
                                  <button
                                    onClick={() => handleSendPO(po.id)}
                                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                                    title="Send to Supplier"
                                  >
                                    📤 Send
                                  </button>
                                  <button
                                    onClick={() => handleApprovePO(po.id)}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                    title="Approve PO"
                                  >
                                    ✅ Approve
                                  </button>
                                </>
                              )}
                              
                              {/* SENT actions */}
                              {po.status === 'SENT' && perms.canApprovePurchase && (
                                <button
                                  onClick={() => handleApprovePO(po.id)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  title="Mark as Approved"
                                >
                                  ✅ Approve
                                </button>
                              )}
                              
                              {/* APPROVED actions */}
                              {po.status === 'APPROVED' && perms.canReceiveGoods && (
                                <button
                                  onClick={() => handleReceivePO(po.id)}
                                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                  title="Create Goods Receipt"
                                >
                                  📥 Receive
                                </button>
                              )}
                              
                              {/* Cancel only for DRAFT and SENT (not after approval) */}
                              {['DRAFT', 'SENT'].includes(po.status) && perms.canApprovePurchase && (
                                <button
                                  onClick={() => handleCancelPO(po.id)}
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                  title="Cancel PO"
                                >
                                  ❌
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {purchaseOrders.length === 0 && (
                        <tr key="no-purchase-orders">
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            No purchase orders found. Click "+ Purchase Order" to create one.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">New Stock Adjustment</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Product *</label>
                <select
                  value={adjustmentData.productId}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, productId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  aria-label="Select product for adjustment"
                  title="Select product for adjustment"
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Adjustment Type *</label>
                <select
                  value={adjustmentData.adjustmentType}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, adjustmentType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  aria-label="Select adjustment type"
                  title="Select adjustment type"
                >
                  <option value="ADJUSTMENT_IN">Increase Stock</option>
                  <option value="ADJUSTMENT_OUT">Decrease Stock</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="EXPIRY">Expiry</option>
                  <option value="RETURN">Return</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity *</label>
                <input
                  type="number"
                  value={adjustmentData.quantity}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter quantity (positive or negative)"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reason *</label>
                <input
                  type="text"
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Physical count correction"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  aria-label="Enter stock adjustment notes"
                  title="Enter stock adjustment notes"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowAdjustModal(false); resetAdjustmentForm(); }}
                  className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAdjustment}
                  disabled={!adjustmentData.productId || !adjustmentData.quantity || !adjustmentData.reason}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goods Receipt Modal */}
      {showGRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">New Goods Receipt</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier *</label>
                  <select
                    value={grData.supplierId}
                    onChange={(e) => setGrData({ ...grData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                    aria-label="Select supplier for goods receipt"
                    title="Select supplier for goods receipt"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Received Date *</label>
                  <input
                    type="date"
                    value={grData.receivedDate}
                    onChange={(e) => setGrData({ ...grData, receivedDate: e.target.value })}
                    aria-label="Enter received date"
                    title="Enter received date"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={grData.notes}
                  onChange={(e) => setGrData({ ...grData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  aria-label="Enter goods receipt notes"
                  title="Enter goods receipt notes"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Items</label>
                  <button onClick={addGRItem} className="text-blue-600 hover:text-blue-800 text-sm">
                    + Add Item
                  </button>
                </div>

                {grData.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    No items added. Click "+ Add Item" to add products.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty Ordered</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty Received</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expiry</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {grData.items.map((item: any, index: number) => (
                          <tr key={`gr-item-${index}-${item.productId || 'new'}`}>
                            <td className="px-3 py-2">
                              <select
                                value={item.productId}
                                onChange={(e) => updateGRItem(index, 'productId', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-sm"
                                aria-label="Select product for goods receipt item"
                                title="Select product for goods receipt item"
                              >
                                <option value="">Select</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.quantityOrdered}
                                onChange={(e) => updateGRItem(index, 'quantityOrdered', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border rounded text-sm text-right"
                                min="0"
                                aria-label="Enter quantity ordered"
                                title="Enter quantity ordered"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.quantityReceived}
                                onChange={(e) => updateGRItem(index, 'quantityReceived', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border rounded text-sm text-right"
                                min="0"
                                aria-label="Enter quantity received"
                                title="Enter quantity received"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.unitCost}
                                onChange={(e) => updateGRItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border rounded text-sm text-right"
                                min="0"
                                aria-label="Enter unit cost"
                                title="Enter unit cost"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="date"
                                value={item.expiryDate}
                                onChange={(e) => updateGRItem(index, 'expiryDate', e.target.value)}
                                className="w-32 px-2 py-1 border rounded text-sm"
                                aria-label="Enter expiry date"
                                title="Enter expiry date"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => removeGRItem(index)} className="text-red-600 hover:text-red-800">
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowGRModal(false); resetGRForm(); }}
                  className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGoodsReceipt}
                  disabled={!grData.supplierId || grData.items.length === 0}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Create Goods Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Order Modal */}
      {showPOModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setPoProductDropdown(null)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">New Purchase Order</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier *</label>
                  <select
                    value={poData.supplierId}
                    onChange={(e) => setPoData({ ...poData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                    aria-label="Select supplier for purchase order"
                    title="Select supplier for purchase order"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Order Date *</label>
                  <input
                    type="date"
                    value={poData.orderDate}
                    onChange={(e) => setPoData({ ...poData, orderDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                    aria-label="Enter order date"
                    title="Enter order date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expected Delivery</label>
                  <input
                    type="date"
                    value={poData.expectedDate}
                    onChange={(e) => setPoData({ ...poData, expectedDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    aria-label="Enter expected delivery date"
                    title="Enter expected delivery date"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={poData.notes}
                  onChange={(e) => setPoData({ ...poData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  aria-label="Enter purchase order notes"
                  title="Enter purchase order notes"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">Items</label>
                  <button onClick={addPOItem} className="text-blue-600 hover:text-blue-800 text-sm">
                    + Add Item
                  </button>
                </div>

                {poData.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    No items added. Click "+ Add Item" to add products.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Quantity</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {poData.items.map((item: any, index: number) => {
                          const searchTerm = poProductSearch[index] || '';
                          const filteredProducts = products.filter(p => 
                            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
                          );
                          return (
                          <tr key={`po-item-${index}-${item.productId || 'new'}`}>
                            <td className="px-3 py-2 relative">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={item.productId ? (products.find(p => p.id === item.productId)?.name || '') : searchTerm}
                                  onChange={(e) => {
                                    setPoProductSearch({ ...poProductSearch, [index]: e.target.value });
                                    setPoProductDropdown(index);
                                    if (item.productId) {
                                      updatePOItem(index, 'productId', '');
                                    }
                                  }}
                                  onFocus={() => setPoProductDropdown(index)}
                                  placeholder="Search product..."
                                  className="w-full px-2 py-1 border rounded text-sm"
                                />
                                {item.productId && (
                                  <button
                                    onClick={() => {
                                      updatePOItem(index, 'productId', '');
                                      setPoProductSearch({ ...poProductSearch, [index]: '' });
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  >
                                    ×
                                  </button>
                                )}
                                {poProductDropdown === index && !item.productId && (
                                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {filteredProducts.length === 0 ? (
                                      <div className="px-3 py-2 text-sm text-gray-500">No products found</div>
                                    ) : (
                                      filteredProducts.slice(0, 10).map((p) => (
                                        <button
                                          key={p.id}
                                          onClick={() => {
                                            updatePOItem(index, 'productId', p.id);
                                            setPoProductSearch({ ...poProductSearch, [index]: '' });
                                            setPoProductDropdown(null);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between items-center"
                                        >
                                          <span className="font-medium">{p.name}</span>
                                          <span className="text-xs text-gray-500">{p.sku || ''}{perms.canViewCostPrice ? ` • ${formatUGX(p.costPrice || 0)}` : ''}</span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updatePOItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border rounded text-sm text-right"
                                min="0"
                                aria-label="Enter order quantity"
                                title="Enter order quantity"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.unitCost}
                                onChange={(e) => updatePOItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border rounded text-sm text-right"
                                min="0"
                                aria-label="Enter unit cost"
                                title="Enter unit cost"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-sm">
                              {formatUGX((item.quantity || 0) * (item.unitCost || 0))}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => removePOItem(index)} className="text-red-600 hover:text-red-800">
                                ✕
                              </button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-medium">Total:</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            {formatUGX(poData.items.reduce((sum: number, item: any) => sum + (item.quantity || 0) * (item.unitCost || 0), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setShowPOModal(false); resetPOForm(); }}
                  className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePO}
                  disabled={!poData.supplierId || poData.items.length === 0}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Create Purchase Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PO View/Edit Modal */}
      {showPOViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-purple-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {editingPOMode ? 'Edit Purchase Order' : 'Purchase Order Details'}
                  </h2>
                  {viewingPO && (
                    <p className="text-sm text-gray-600 font-mono">{viewingPO.orderNumber}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPOViewModal(false);
                  setViewingPO(null);
                  setEditingPOMode(false);
                  setEditPOData(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {poViewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
                </div>
              ) : viewingPO ? (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-sm text-gray-500">Status</span>
                        <div className="mt-1">{getPOStatusBadge(viewingPO.status)}</div>
                      </div>
                      <div className="border-l pl-4">
                        <span className="text-sm text-gray-500">Total Amount</span>
                        <div className="text-lg font-bold text-gray-800">{formatUGX(viewingPO.totalAmount)}</div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {viewingPO.status === 'DRAFT' && !editingPOMode && perms.canApprovePurchase && (
                        <>
                          <button
                            onClick={handleStartEditPO}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleSendPO(viewingPO.id)}
                            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-1"
                          >
                            📤 Send to Supplier
                          </button>
                          <button
                            onClick={() => handleApprovePO(viewingPO.id)}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                          >
                            ✅ Approve
                          </button>
                        </>
                      )}
                      {viewingPO.status === 'SENT' && perms.canApprovePurchase && (
                        <button
                          onClick={() => handleApprovePO(viewingPO.id)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                        >
                          ✅ Approve
                        </button>
                      )}
                      {viewingPO.status === 'APPROVED' && perms.canReceiveGoods && (
                        <button
                          onClick={() => handleReceivePO(viewingPO.id)}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"
                        >
                          📥 Receive Goods
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicatePO(viewingPO)}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1"
                      >
                        📋 Duplicate
                      </button>
                      <button
                        onClick={handleExportPOPdf}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-1"
                      >
                        📄 Export PDF
                      </button>
                      {/* Cancel only for DRAFT and SENT (not after approval) */}
                      {['DRAFT', 'SENT'].includes(viewingPO.status) && perms.canApprovePurchase && (
                        <button
                          onClick={() => handleCancelPO(viewingPO.id)}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm flex items-center gap-1"
                        >
                          ❌ Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Edit Mode Form */}
                  {editingPOMode && editPOData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                          <select
                            value={editPOData.supplierId}
                            onChange={(e) => setEditPOData({ ...editPOData, supplierId: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            aria-label="Select supplier for purchase order"
                            title="Select supplier for purchase order"
                          >
                            <option value="">Select Supplier</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                          <input
                            type="date"
                            value={editPOData.orderDate}
                            onChange={(e) => setEditPOData({ ...editPOData, orderDate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            aria-label="Enter order date"
                            title="Enter order date"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
                          <input
                            type="date"
                            value={editPOData.expectedDate}
                            onChange={(e) => setEditPOData({ ...editPOData, expectedDate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            aria-label="Enter expected delivery date"
                            title="Enter expected delivery date"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                          <input
                            type="text"
                            value={editPOData.notes}
                            onChange={(e) => setEditPOData({ ...editPOData, notes: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Optional notes"
                          />
                        </div>
                      </div>

                      {/* Edit Items Table */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="font-medium">Items</label>
                          <button onClick={addEditPOItem} className="text-blue-600 hover:text-blue-800 text-sm">
                            + Add Item
                          </button>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Quantity</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {editPOData.items.map((item: any, index: number) => {
                                const searchTerm = editPoProductSearch[index] || '';
                                const filteredProducts = products.filter(p => 
                                  p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
                                );
                                return (
                                <tr key={`edit-po-item-${item.id || index}-${item.productId || 'new'}`}>
                                  <td className="px-3 py-2 relative">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={item.productId ? (products.find(p => p.id === item.productId)?.name || '') : searchTerm}
                                        onChange={(e) => {
                                          setEditPoProductSearch({ ...editPoProductSearch, [index]: e.target.value });
                                          setEditPoProductDropdown(index);
                                          if (item.productId) {
                                            updateEditPOItem(index, 'productId', '');
                                          }
                                        }}
                                        onFocus={() => setEditPoProductDropdown(index)}
                                        placeholder="Search product..."
                                        className="w-full px-2 py-1 border rounded text-sm"
                                      />
                                      {item.productId && (
                                        <button
                                          onClick={() => {
                                            updateEditPOItem(index, 'productId', '');
                                            setEditPoProductSearch({ ...editPoProductSearch, [index]: '' });
                                          }}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                          ×
                                        </button>
                                      )}
                                      {editPoProductDropdown === index && !item.productId && (
                                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                          {filteredProducts.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-gray-500">No products found</div>
                                          ) : (
                                            filteredProducts.slice(0, 10).map((p) => (
                                              <button
                                                key={p.id}
                                                onClick={() => {
                                                  updateEditPOItem(index, 'productId', p.id);
                                                  setEditPoProductSearch({ ...editPoProductSearch, [index]: '' });
                                                  setEditPoProductDropdown(null);
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex justify-between items-center"
                                              >
                                                <span className="font-medium">{p.name}</span>
                                                <span className="text-xs text-gray-500">{p.sku || ''}{perms.canViewCostPrice ? ` • ${formatUGX(p.costPrice || 0)}` : ''}</span>
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateEditPOItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                      className="w-20 px-2 py-1 border rounded text-sm text-right"
                                      min="0"
                                      aria-label="Enter order quantity"
                                      title="Enter order quantity"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      value={item.unitCost}
                                      onChange={(e) => updateEditPOItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                                      className="w-24 px-2 py-1 border rounded text-sm text-right"
                                      min="0"
                                      aria-label="Enter unit cost"
                                      title="Enter unit cost"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-sm">
                                    {formatUGX((item.quantity || 0) * (item.unitCost || 0))}
                                  </td>
                                  <td className="px-3 py-2">
                                    <button onClick={() => removeEditPOItem(index)} className="text-red-600 hover:text-red-800">
                                      ✕
                                    </button>
                                  </td>
                                </tr>
                              )})}
                            </tbody>
                            <tfoot className="bg-gray-50">
                              <tr>
                                <td colSpan={3} className="px-3 py-2 text-right font-medium">Total:</td>
                                <td className="px-3 py-2 text-right font-mono font-bold">
                                  {formatUGX(editPOData.items.reduce((sum: number, item: any) => 
                                    sum + (item.quantity || 0) * (item.unitCost || 0), 0))}
                                </td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Edit Actions */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => { setEditingPOMode(false); setEditPOData(null); }}
                          className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
                        >
                          Cancel Edit
                        </button>
                        <button
                          onClick={handleSaveEditPO}
                          disabled={!editPOData.supplierId || editPOData.items.length === 0}
                          className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <>
                      {/* Order Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-sm text-gray-500">Supplier</span>
                          <p className="font-medium">{viewingPO.supplierName}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-sm text-gray-500">Order Date</span>
                          <p className="font-medium">{new Date(viewingPO.orderDate).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-sm text-gray-500">Expected Delivery</span>
                          <p className="font-medium">
                            {viewingPO.expectedDeliveryDate 
                              ? new Date(viewingPO.expectedDeliveryDate).toLocaleDateString() 
                              : 'Not specified'}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <span className="text-sm text-gray-500">Created By</span>
                          <p className="font-medium">{viewingPO.createdByName || 'System'}</p>
                        </div>
                      </div>

                      {/* Notes */}
                      {viewingPO.notes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <span className="text-sm font-medium text-yellow-800">Notes</span>
                          <p className="text-gray-700 mt-1">{viewingPO.notes}</p>
                        </div>
                      )}

                      {/* Items Table */}
                      <div>
                        <h3 className="font-medium text-gray-700 mb-2">Order Items ({viewingPO.items?.length || 0})</h3>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ordered</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {(viewingPO.items || []).map((item: any, index: number) => (
                                <tr key={item.id || index} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                                  <td className="px-4 py-3 font-mono text-sm text-gray-500">{item.sku || '-'}</td>
                                  <td className="px-4 py-3 text-right">{item.orderedQuantity}</td>
                                  <td className="px-4 py-3 text-right">
                                    <span className={item.receivedQuantity >= item.orderedQuantity ? 'text-green-600' : 'text-orange-600'}>
                                      {item.receivedQuantity || 0}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono">{formatUGX(item.unitPrice)}</td>
                                  <td className="px-4 py-3 text-right font-mono font-medium">
                                    {formatUGX(item.orderedQuantity * item.unitPrice)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-gray-50">
                              <tr>
                                <td colSpan={6} className="px-4 py-3 text-right font-bold">Grand Total:</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-lg">
                                  {formatUGX(viewingPO.totalAmount)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Timeline/History */}
                      <div className="border-t pt-4">
                        <h3 className="font-medium text-gray-700 mb-2">Order Timeline</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="w-24 text-gray-400">Created:</span>
                            <span>{new Date(viewingPO.createdAt).toLocaleString()}</span>
                          </div>
                          {viewingPO.sentDate && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span className="w-24 text-gray-400">Sent:</span>
                              <span>{new Date(viewingPO.sentDate).toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-gray-600">
                            <span className="w-24 text-gray-400">Updated:</span>
                            <span>{new Date(viewingPO.updatedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Purchase order not found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modals */}
      {showAddProductModal && (
        <ProductForm
          categories={allCategories}
          unitsOfMeasure={allUOMs}
          onSuccess={() => {
            setShowAddProductModal(false);
            loadProducts();
            loadInitialData(); // Refresh categories/UOMs too
          }}
          onCancel={() => setShowAddProductModal(false)}
        />
      )}

      {editingProduct && (
        <ProductForm
          product={editingProduct}
          categories={allCategories}
          unitsOfMeasure={allUOMs}
          onSuccess={() => {
            setEditingProduct(null);
            loadProducts();
            loadInitialData(); // Refresh categories/UOMs too
          }}
          onCancel={() => setEditingProduct(null)}
        />
      )}

      {/* Transaction History Modal */}
      {showTransactionHistory && transactionHistoryProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
                <p className="text-sm text-gray-600">
                  {transactionHistoryProduct.name} ({transactionHistoryProduct.sku})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTransactionHistory(false);
                  setTransactionHistoryProduct(null);
                  setHistoryTab('sales');
                }}
                className="text-gray-400 hover:text-gray-600"
                title="Close transaction history"
                aria-label="Close transaction history"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Product Summary */}
            <div className={`px-6 py-3 bg-blue-50 border-b grid gap-4 text-sm ${perms.canViewCostPrice ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div>
                <span className="text-gray-500">Current Stock:</span>
                <span className={`ml-2 font-semibold ${transactionHistoryProduct.quantityOnHand < 0 ? 'text-red-600' : ''}`}>
                  {transactionHistoryProduct.quantityOnHand} {transactionHistoryProduct.unitOfMeasure}
                </span>
              </div>
              {perms.canViewCostPrice && (
              <div>
                <span className="text-gray-500">Cost Price:</span>
                <span className="ml-2 font-semibold">UGX {transactionHistoryProduct.costPrice?.toLocaleString()}</span>
              </div>
              )}
              <div>
                <span className="text-gray-500">Selling Price:</span>
                <span className="ml-2 font-semibold">UGX {transactionHistoryProduct.sellingPrice?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Reorder Level:</span>
                <span className="ml-2 font-semibold">{transactionHistoryProduct.reorderLevel}</span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {productHistory.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading transaction history...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">📊</span> Transaction Summary
                    </h3>
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-red-600">
                          {productHistory.summary?.totalSold?.toFixed(0) || 0}
                        </div>
                        <div className="text-xs text-gray-500">Qty Sold</div>
                        <div className="text-xs text-gray-400">{productHistory.summary?.salesCount || 0} sales</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-green-600">
                          {productHistory.summary?.totalReceived?.toFixed(0) || 0}
                        </div>
                        <div className="text-xs text-gray-500">Qty Received</div>
                        <div className="text-xs text-gray-400">{productHistory.summary?.receiptsCount || 0} receipts</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-blue-600">
                          {productHistory.summary?.salesRevenue?.toLocaleString() || 0}
                        </div>
                        <div className="text-xs text-gray-500">Sales Revenue</div>
                        <div className="text-xs text-gray-400">UGX</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-purple-600">
                          {productHistory.summary?.movementsCount || 0}
                        </div>
                        <div className="text-xs text-gray-500">Stock Movements</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-2xl font-bold text-orange-600">
                          {productHistory.summary?.activeBatches || 0}
                        </div>
                        <div className="text-xs text-gray-500">Active Batches</div>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                      <button
                        onClick={() => setHistoryTab('sales')}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                          historyTab === 'sales'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        🛒 Sales ({productHistory.sales?.length || 0})
                      </button>
                      <button
                        onClick={() => setHistoryTab('receipts')}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                          historyTab === 'receipts'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        📦 Goods Receipts ({productHistory.receipts?.length || 0})
                      </button>
                      <button
                        onClick={() => setHistoryTab('movements')}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                          historyTab === 'movements'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        🔄 Stock Movements ({productHistory.movements?.length || 0})
                      </button>
                      <button
                        onClick={() => setHistoryTab('batches')}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                          historyTab === 'batches'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        📋 Batches ({productHistory.batches?.length || 0})
                      </button>
                    </nav>
                  </div>

                  {/* Tab Content: Sales */}
                  {historyTab === 'sales' && (
                    <div>
                      {!productHistory.sales?.length ? (
                        <p className="text-gray-500 text-sm italic py-8 text-center">No sales recorded for this product</p>
                      ) : (
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Sale #</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Customer</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Qty</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Unit Price</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Discount</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Cashier</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {productHistory.sales.map((sale: any) => (
                                <tr key={sale.id} className={`hover:bg-gray-50 ${sale.status === 'VOID' ? 'bg-red-50 opacity-60' : ''}`}>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    {new Date(sale.saleDate).toLocaleDateString('en-GB', {
                                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs">{sale.saleNumber}</td>
                                  <td className="px-4 py-2">{sale.customerName || 'Walk-in'}</td>
                                  <td className="px-4 py-2 text-right font-semibold text-red-600">-{sale.quantity}</td>
                                  <td className="px-4 py-2 text-right">UGX {sale.unitPrice?.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-orange-600">
                                    {sale.discountAmount > 0 ? `-${sale.discountAmount?.toLocaleString()}` : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold">UGX {sale.lineTotal?.toLocaleString()}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      sale.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                      sale.status === 'VOID' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {sale.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-gray-600 text-xs">{sale.cashierName}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Goods Receipts */}
                  {historyTab === 'receipts' && (
                    <div>
                      {!productHistory.receipts?.length ? (
                        <p className="text-gray-500 text-sm italic py-8 text-center">No goods receipts recorded for this product</p>
                      ) : (
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Receipt #</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Supplier</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Qty Received</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Unit Cost</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Line Total</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Received By</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {productHistory.receipts.map((receipt: any) => (
                                <tr key={receipt.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    {new Date(receipt.receivedDate).toLocaleDateString('en-GB', {
                                      day: '2-digit', month: 'short', year: 'numeric'
                                    })}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs">{receipt.receiptNumber}</td>
                                  <td className="px-4 py-2">{receipt.supplierName || '-'}</td>
                                  <td className="px-4 py-2 text-right font-semibold text-green-600">+{receipt.quantityReceived}</td>
                                  <td className="px-4 py-2 text-right">UGX {receipt.unitCost?.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right font-semibold">UGX {receipt.lineTotal?.toLocaleString()}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      receipt.status === 'RECEIVED' ? 'bg-green-100 text-green-800' :
                                      receipt.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                                      'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {receipt.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-gray-600 text-xs">{receipt.receivedBy}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Stock Movements */}
                  {historyTab === 'movements' && (
                    <div>
                      {!productHistory.movements?.length ? (
                        <p className="text-gray-500 text-sm italic py-8 text-center">No stock movements recorded for this product</p>
                      ) : (
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Movement #</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Reference</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Quantity</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {productHistory.movements.map((movement: any) => (
                                <tr key={movement.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    {new Date(movement.createdAt).toLocaleDateString('en-GB', {
                                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-xs">{movement.movementNumber}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      movement.movementType === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {movement.movementType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-xs">{movement.referenceType}</td>
                                  <td className={`px-4 py-2 text-right font-semibold ${
                                    movement.movementType === 'IN' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {movement.movementType === 'IN' ? '+' : '-'}{Math.abs(movement.quantity)}
                                  </td>
                                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{movement.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content: Batches */}
                  {historyTab === 'batches' && (
                    <div>
                      {!productHistory.batches?.length ? (
                        <p className="text-gray-500 text-sm italic py-8 text-center">No inventory batches for this product</p>
                      ) : (
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Batch #</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Received</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Expiry</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Original Qty</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Remaining</th>
                                {perms.canViewCostPrice && <th className="px-4 py-2 text-right font-medium text-gray-600">Cost Price</th>}
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {productHistory.batches.map((batch: any) => (
                                <tr key={batch.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 font-mono text-xs">{batch.batchNumber}</td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    {batch.receivedDate ? new Date(batch.receivedDate).toLocaleDateString('en-GB') : '-'}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    {batch.expiryDate ? (
                                      <span className={new Date(batch.expiryDate) < new Date() ? 'text-red-600 font-semibold' : ''}>
                                        {new Date(batch.expiryDate).toLocaleDateString('en-GB')}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-right">{batch.quantity}</td>
                                  <td className="px-4 py-2 text-right font-semibold">{batch.remainingQuantity}</td>
                                  {perms.canViewCostPrice && <td className="px-4 py-2 text-right">UGX {batch.costPrice?.toLocaleString()}</td>}
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      batch.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                      batch.status === 'EXPIRED' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {batch.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowTransactionHistory(false);
                  setTransactionHistoryProduct(null);
                  setHistoryTab('sales');
                }}
                className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details Modal */}
      {showProductDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-purple-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Product Details</h2>
                {productDetailsData?.product && (
                  <p className="text-sm text-gray-600">
                    {productDetailsData.product.name} ({productDetailsData.product.sku})
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowProductDetails(false);
                  setProductDetailsData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
                title="Close product details"
                aria-label="Close product details"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {productDetailsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-gray-600">Loading product details...</span>
                </div>
              ) : productDetailsData ? (
                <div className="space-y-6">
                  {/* Product Info Card */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">📦</span> Product Information
                    </h3>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">SKU:</span>
                        <span className="ml-2 font-semibold">{productDetailsData.product.sku}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Barcode:</span>
                        <span className="ml-2 font-semibold">{productDetailsData.product.barcode || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Category:</span>
                        <span className="ml-2 font-semibold">{productDetailsData.product.categoryName || 'Uncategorized'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Unit:</span>
                        <span className="ml-2 font-semibold">{productDetailsData.product.unitOfMeasure}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          productDetailsData.product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {productDetailsData.product.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Track Expiry:</span>
                        <span className="ml-2 font-semibold">{productDetailsData.product.trackExpiry ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Reorder Level:</span>
                        <span className="ml-2 font-semibold">{productDetailsData.product.reorderLevel}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Created:</span>
                        <span className="ml-2 font-semibold">
                          {productDetailsData.product.createdAt ? new Date(productDetailsData.product.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                        </span>
                      </div>
                    </div>
                    {productDetailsData.product.description && (
                      <div className="mt-3 pt-3 border-t">
                        <span className="text-gray-500">Description:</span>
                        <p className="mt-1 text-gray-700">{productDetailsData.product.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Stock Valuation Card */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">💰</span> Stock Valuation
                    </h3>
                    <div className={`grid gap-4 ${perms.canViewCostPrice && perms.canViewProfit ? 'grid-cols-4' : perms.canViewCostPrice || perms.canViewProfit ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <div className="bg-white p-3 rounded border text-center">
                        <div className={`text-2xl font-bold ${productDetailsData.stockValuation.quantityOnHand < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {productDetailsData.stockValuation.quantityOnHand}
                        </div>
                        <div className="text-xs text-gray-500">Quantity On Hand</div>
                      </div>
                      {perms.canViewCostPrice && (
                      <div className="bg-white p-3 rounded border text-center">
                        <div className="text-2xl font-bold text-gray-700">
                          {productDetailsData.stockValuation.stockValueAtCost?.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Stock Value (Cost)</div>
                        <div className="text-xs text-gray-400">UGX</div>
                      </div>
                      )}
                      <div className="bg-white p-3 rounded border text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {productDetailsData.stockValuation.stockValueAtSelling?.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Stock Value (Selling)</div>
                        <div className="text-xs text-gray-400">UGX</div>
                      </div>
                      {perms.canViewProfit && (
                      <div className="bg-white p-3 rounded border text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {productDetailsData.stockValuation.potentialProfit?.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">Potential Profit</div>
                        <div className="text-xs text-gray-400">{productDetailsData.stockValuation.profitMargin?.toFixed(1)}% margin</div>
                      </div>
                      )}
                    </div>
                    <div className={`grid gap-4 mt-4 text-sm ${perms.canViewCostPrice ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {perms.canViewCostPrice && (
                      <div className="bg-white p-3 rounded border">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cost Price:</span>
                          <span className="font-semibold">UGX {productDetailsData.stockValuation.costPrice?.toLocaleString()}</span>
                        </div>
                      </div>
                      )}
                      <div className="bg-white p-3 rounded border">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Selling Price:</span>
                          <span className="font-semibold">UGX {productDetailsData.stockValuation.sellingPrice?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sales & Purchase Analytics */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Sales Analytics */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <span className="mr-2">📈</span> Sales Analytics
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Total Sales Count:</span>
                          <span className="font-bold text-green-600">{productDetailsData.salesAnalytics.totalSalesCount}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Total Qty Sold:</span>
                          <span className="font-bold">{productDetailsData.salesAnalytics.totalQuantitySold}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Total Revenue:</span>
                          <span className="font-bold text-blue-600">UGX {productDetailsData.salesAnalytics.totalRevenue?.toLocaleString()}</span>
                        </div>
                        {perms.canViewProfit && (
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Total Profit:</span>
                          <span className="font-bold text-green-600">UGX {productDetailsData.salesAnalytics.totalProfit?.toLocaleString()}</span>
                        </div>
                        )}
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Avg Selling Price:</span>
                          <span className="font-bold">UGX {productDetailsData.salesAnalytics.averageSellingPrice?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded text-xs">
                          <span className="text-gray-500">Price Range:</span>
                          <span>UGX {productDetailsData.salesAnalytics.minSellingPrice?.toLocaleString()} - {productDetailsData.salesAnalytics.maxSellingPrice?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Purchase Analytics */}
                    <div className="bg-orange-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <span className="mr-2">🛒</span> Purchase Analytics
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Total Receipts:</span>
                          <span className="font-bold text-orange-600">{productDetailsData.purchaseAnalytics.totalReceiptsCount}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Total Qty Received:</span>
                          <span className="font-bold">{productDetailsData.purchaseAnalytics.totalQuantityReceived}</span>
                        </div>
                        {perms.canViewCostPrice && (
                        <>
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Total Purchase Cost:</span>
                          <span className="font-bold text-red-600">UGX {productDetailsData.purchaseAnalytics.totalPurchaseCost?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Avg Cost Price:</span>
                          <span className="font-bold">UGX {productDetailsData.purchaseAnalytics.averageCostPrice?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between bg-white p-2 rounded text-xs">
                          <span className="text-gray-500">Cost Range:</span>
                          <span>UGX {productDetailsData.purchaseAnalytics.minCostPrice?.toLocaleString()} - {productDetailsData.purchaseAnalytics.maxCostPrice?.toLocaleString()}</span>
                        </div>
                        </>
                        )}
                        <div className="flex justify-between bg-white p-2 rounded">
                          <span className="text-gray-500">Active Batches:</span>
                          <span className="font-bold">{productDetailsData.batchSummary.activeBatches} / {productDetailsData.batchSummary.totalBatches}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Transactions */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="mr-2">🏢</span> Supplier Transactions
                    </h3>
                    {productDetailsData.supplierTransactions.length === 0 ? (
                      <p className="text-gray-500 text-sm italic text-center py-4">No supplier transactions recorded</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Supplier</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Contact</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">Receipts</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">Total Qty</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">Total Value</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">Avg Cost</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Last Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {productDetailsData.supplierTransactions.map((supplier: any) => (
                              <tr key={supplier.supplierId} className="hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <div className="font-medium text-gray-900">{supplier.supplierName}</div>
                                  {supplier.email && <div className="text-xs text-gray-500">{supplier.email}</div>}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="text-gray-900">{supplier.contactPerson || '-'}</div>
                                  {supplier.phone && <div className="text-xs text-gray-500">{supplier.phone}</div>}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold">{supplier.receiptsCount}</td>
                                <td className="px-4 py-2 text-right font-semibold text-green-600">+{supplier.totalQuantity}</td>
                                <td className="px-4 py-2 text-right font-semibold">UGX {supplier.totalValue?.toLocaleString()}</td>
                                <td className="px-4 py-2 text-right">UGX {supplier.averageCost?.toLocaleString()}</td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  {supplier.lastReceiptDate ? new Date(supplier.lastReceiptDate).toLocaleDateString('en-GB') : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Failed to load product details
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowProductDetails(false);
                  setProductDetailsData(null);
                }}
                className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GR View/Review Modal */}
      {showGRViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📥</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {viewingGR?.status === 'DRAFT' ? 'Review & Receive Goods' : 'Goods Receipt Details'}
                  </h2>
                  {viewingGR && (
                    <p className="text-sm text-gray-600 font-mono">{viewingGR.receiptNumber || viewingGR.grNumber}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowGRViewModal(false);
                  setViewingGR(null);
                  setGRItems([]);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {grViewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
                </div>
              ) : viewingGR ? (
                <div className="space-y-6">
                  {/* GR Header Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">PO Number</p>
                      <p className="font-mono font-medium">{viewingGR.poNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Supplier</p>
                      <p className="font-medium">{viewingGR.supplierName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Received Date</p>
                      <p className="font-medium">{new Date(viewingGR.receivedDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <p>{getStatusBadge(viewingGR.status)}</p>
                    </div>
                  </div>

                  {/* Instructions for DRAFT */}
                  {viewingGR.status === 'DRAFT' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
                        <span>⚠️</span> Review Items Before Receiving
                      </h3>
                      <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
                        <li>Verify received quantities match actual goods</li>
                        <li>Enter batch numbers and expiry dates if applicable</li>
                        <li>Adjust unit costs if they differ from PO</li>
                        <li>Click "Save Changes" if you made updates</li>
                        <li>Click "Confirm Receipt & Finalize" to add to inventory</li>
                      </ul>
                    </div>
                  )}

                  {/* Items Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            {viewingGR.status === 'DRAFT' ? 'Qty Received' : 'Quantity'}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {grItems.map((item, index) => (
                          <tr key={item.id || index} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.productName}</p>
                              <p className="text-sm text-gray-500">SKU: {item.productSku || item.sku || '-'}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {viewingGR.status === 'DRAFT' ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={item.receivedQuantity}
                                  onChange={(e) => updateGRItemQuantity(index, 'receivedQuantity', parseFloat(e.target.value) || 0)}
                                  className="w-24 border rounded px-2 py-1 text-right"
                                  aria-label="Enter received quantity"
                                  title="Enter received quantity"
                                />
                              ) : (
                                <span className="font-mono">{item.receivedQuantity}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {viewingGR.status === 'DRAFT' ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitCost || item.costPrice || 0}
                                  onChange={(e) => updateGRItemQuantity(index, 'unitCost', parseFloat(e.target.value) || 0)}
                                  aria-label="Enter unit cost"
                                  title="Enter unit cost"
                                  className="w-28 border rounded px-2 py-1 text-right"
                                />
                              ) : (
                                <span className="font-mono">{formatUGX(item.unitCost || item.costPrice)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {viewingGR.status === 'DRAFT' ? (
                                <input
                                  type="text"
                                  value={item.batchNumber || ''}
                                  onChange={(e) => updateGRItemQuantity(index, 'batchNumber', e.target.value)}
                                  placeholder="Auto-generate"
                                  className="w-32 border rounded px-2 py-1 text-sm"
                                />
                              ) : (
                                <span className="font-mono text-sm">{item.batchNumber || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {viewingGR.status === 'DRAFT' ? (
                                <input
                                  type="date"
                                  value={item.expiryDate ? item.expiryDate.split('T')[0] : ''}
                                  onChange={(e) => updateGRItemQuantity(index, 'expiryDate', e.target.value || null)}
                                  className="border rounded px-2 py-1 text-sm"
                                  aria-label="Set product expiry date"
                                  title="Set product expiry date"
                                />
                              ) : (
                                <span className="text-sm">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium">
                              {formatUGX((item.receivedQuantity || 0) * (item.unitCost || item.costPrice || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={5} className="px-4 py-3 text-right font-semibold">Total Value:</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-lg">
                            {formatUGX(grItems.reduce((sum, item) => sum + ((item.receivedQuantity || 0) * (item.unitCost || item.costPrice || 0)), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Notes */}
                  {viewingGR.notes && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">Notes</p>
                      <p className="text-gray-700">{viewingGR.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Failed to load goods receipt details
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowGRViewModal(false);
                  setViewingGR(null);
                  setGRItems([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              {viewingGR?.status === 'DRAFT' && perms.canReceiveGoods && (
                <>
                  <button
                    onClick={handleSaveGRItems}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    💾 Save Changes
                  </button>
                  <button
                    onClick={handleFinalizeGRFromModal}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                  >
                    ✓ Confirm Receipt & Finalize
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
