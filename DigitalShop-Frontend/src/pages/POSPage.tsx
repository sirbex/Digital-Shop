import { useState, useEffect, useRef, useCallback } from 'react';
import { salesApi, holdApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import { Receipt } from '../components/pos/Receipt';
import { usePrint } from '../hooks/usePrint';
import POSProductSearch, { POSProductSearchHandle } from '../components/pos/POSProductSearch';
import CustomerSelector from '../components/pos/CustomerSelector';
import DiscountDialog from '../components/pos/DiscountDialog';
import { HoldCartDialog } from '../components/pos/HoldCartDialog';
import { ResumeHoldDialog } from '../components/pos/ResumeHoldDialog';
import SplitPaymentDialog from '../components/pos/SplitPaymentDialog';
import CustomItemDialog, { CustomItemData } from '../components/pos/CustomItemDialog';
import PrintReceiptDialog, { ReceiptData } from '../components/pos/PrintReceiptDialog';
import POSButton from '../components/pos/POSButton';
import POSModal from '../components/pos/POSModal';
import { 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Clock,
  Printer,
  X,
  Percent,
  PauseCircle,
  PlayCircle,
  Calculator,
  User,
  Receipt as ReceiptIcon,
  Wrench
} from 'lucide-react';
import Decimal from 'decimal.js';

// Line item type matching SamplePOS
interface LineItem {
  id: string;
  productId: string | null;
  itemType: 'PRODUCT' | 'SERVICE' | 'CUSTOM';
  customDescription?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  marginPct: number;
  subtotal: number;
  isTaxable: boolean;
  taxRate: number;
  taxAmount: number;
  total: number;
  discount?: {
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    amount: number;
    reason: string;
  };
}

export function POSPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const perms = usePermissions();
  const { printRef, handlePrint } = usePrint();
  const productSearchRef = useRef<POSProductSearchHandle>(null);
  
  // Cart state
  const [items, setItems] = useState<LineItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [cartDiscount, setCartDiscount] = useState<{
    type: 'PERCENTAGE' | 'FIXED_AMOUNT';
    value: number;
    amount: number;
    reason: string;
  } | null>(null);
  const [notes, setNotes] = useState('');

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  // CRITICAL: CREDIT is NOT a payment method - it's auto-added internally for remaining balance
  // Users can only select: CASH, CARD, MOBILE_MONEY
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE_MONEY'>('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment lines for split/partial payments (SamplePOS style)
  const [paymentLines, setPaymentLines] = useState<Array<{
    id: string;
    paymentMethod: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'CREDIT';
    amount: number;
    reference?: string;
  }>>([]);
  
  // Backdated sale state (SamplePOS style)
  const [saleDate, setSaleDate] = useState<string>(''); // For backdated sales (empty = current date)
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Discount state
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<{ type: 'cart' | 'item'; itemIndex?: number } | null>(null);

  // Custom item state
  const [showCustomItemDialog, setShowCustomItemDialog] = useState(false);

  // Hold cart state (uses backend API now)
  const [showHoldCartDialog, setShowHoldCartDialog] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [heldOrdersCount, setHeldOrdersCount] = useState(0);

  // Sale result state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate totals using Decimal.js for precision
  const calculateTotals = useCallback(() => {
    let subtotal = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalDiscount = new Decimal(0);

    items.forEach(item => {
      const itemSubtotal = new Decimal(item.unitPrice).times(item.quantity);
      let itemDiscount = new Decimal(0);
      
      if (item.discount) {
        itemDiscount = new Decimal(item.discount.amount);
      }
      
      const afterDiscount = itemSubtotal.minus(itemDiscount);
      // taxRate is stored as decimal (0.18 = 18%), no need to divide by 100
      const itemTax = item.isTaxable 
        ? afterDiscount.times(item.taxRate) 
        : new Decimal(0);

      subtotal = subtotal.plus(itemSubtotal);
      totalDiscount = totalDiscount.plus(itemDiscount);
      totalTax = totalTax.plus(itemTax);
    });

    // Apply cart-level discount
    if (cartDiscount) {
      totalDiscount = totalDiscount.plus(cartDiscount.amount);
    }

    const total = subtotal.minus(totalDiscount).plus(totalTax);
    
    return {
      subtotal: subtotal.toNumber(),
      discount: totalDiscount.toNumber(),
      tax: totalTax.toNumber(),
      total: Math.max(0, total.toNumber()),
    };
  }, [items, cartDiscount]);

  const totals = calculateTotals();

  // Add product to cart
  const handleAddProduct = (product: any) => {
    const existingIndex = items.findIndex(item => item.productId === product.id);

    if (existingIndex >= 0) {
      // Increase quantity of existing item
      setItems(prev => prev.map((item, index) => {
        if (index === existingIndex) {
          const newQty = item.quantity + 1;
          const subtotal = new Decimal(item.unitPrice).times(newQty).toNumber();
          // taxRate is stored as decimal (0.18 = 18%), no need to divide by 100
          const taxAmount = item.isTaxable 
            ? new Decimal(subtotal).times(item.taxRate).toNumber()
            : 0;
          return {
            ...item,
            quantity: newQty,
            subtotal,
            taxAmount,
            total: subtotal + taxAmount,
          };
        }
        return item;
      }));
    } else {
      // Add new item
      const subtotal = product.sellingPrice;
      // taxRate is stored as decimal (0.18 = 18%), no need to divide by 100
      const taxAmount = product.isTaxable 
        ? new Decimal(subtotal).times(product.taxRate || 0).toNumber()
        : 0;

      const newItem: LineItem = {
        id: Date.now().toString(),
        productId: product.id,
        itemType: 'PRODUCT',
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.sellingPrice,
        costPrice: product.costPrice || 0,
        marginPct: product.marginPct || 0,
        subtotal,
        isTaxable: product.isTaxable ?? false,
        taxRate: product.taxRate || 0,
        taxAmount,
        total: subtotal + taxAmount,
      };

      setItems(prev => [...prev, newItem]);
    }

    // Clear search and refocus
    productSearchRef.current?.clearSearch();
    productSearchRef.current?.focusSearch();
  };

  // Add custom/service item to cart (no inventory)
  const handleAddCustomItem = (data: CustomItemData) => {
    const subtotal = new Decimal(data.unitPrice).times(data.quantity).toNumber();

    const newItem: LineItem = {
      id: Date.now().toString(),
      productId: null,
      itemType: data.itemType,
      customDescription: data.customDescription,
      name: data.customDescription,
      sku: data.itemType === 'SERVICE' ? 'SERVICE' : 'CUSTOM',
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      costPrice: 0,
      marginPct: 100,
      subtotal,
      isTaxable: false,
      taxRate: 0,
      taxAmount: 0,
      total: subtotal,
    };

    setItems(prev => [...prev, newItem]);
    productSearchRef.current?.focusSearch();
  };

  // Update item quantity
  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const subtotal = new Decimal(item.unitPrice).times(newQty).toNumber();
        let discountAmount = 0;
        
        if (item.discount) {
          if (item.discount.type === 'PERCENTAGE') {
            discountAmount = new Decimal(subtotal).times(item.discount.value).dividedBy(100).toNumber();
          } else {
            discountAmount = item.discount.value;
          }
        }
        
        const afterDiscount = subtotal - discountAmount;
        // taxRate is stored as decimal (0.18 = 18%), no need to divide by 100
        const taxAmount = item.isTaxable 
          ? new Decimal(afterDiscount).times(item.taxRate).toNumber()
          : 0;

        return {
          ...item,
          quantity: newQty,
          subtotal,
          discount: item.discount ? { ...item.discount, amount: discountAmount } : undefined,
          taxAmount,
          total: afterDiscount + taxAmount,
        };
      }
      return item;
    }));
  };

  // Remove item from cart
  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return `${settings.currencySymbol} ${amount.toLocaleString()}`;
  };

  // Clear entire cart
  const clearCart = () => {
    setItems([]);
    setSelectedCustomer(null);
    setCartDiscount(null);
    setNotes('');
    setAmountPaid('');
    setPaymentMethod('CASH');
    setPaymentReference('');
    setPaymentLines([]);
    setSaleDate('');
    setShowDatePicker(false);
    setError('');
    setSuccess('');
    productSearchRef.current?.focusSearch();
  };

  // Apply discount
  const handleApplyDiscount = (discountData: any) => {
    if (discountData.scope === 'CART') {
      const discountAmount = discountData.type === 'PERCENTAGE'
        ? new Decimal(totals.subtotal).times(discountData.value).dividedBy(100).toNumber()
        : discountData.value;

      setCartDiscount({
        type: discountData.type,
        value: discountData.value,
        amount: discountAmount,
        reason: discountData.reason,
      });
    } else if (discountData.scope === 'LINE_ITEM' && discountData.lineItemIndex !== undefined) {
      setItems(prev => prev.map((item, index) => {
        if (index === discountData.lineItemIndex) {
          const discountAmount = discountData.type === 'PERCENTAGE'
            ? new Decimal(item.subtotal).times(discountData.value).dividedBy(100).toNumber()
            : discountData.value;

          const afterDiscount = item.subtotal - discountAmount;
          // taxRate is stored as decimal (0.18 = 18%), no need to divide by 100
          const taxAmount = item.isTaxable 
            ? new Decimal(afterDiscount).times(item.taxRate).toNumber()
            : 0;

          return {
            ...item,
            discount: {
              type: discountData.type,
              value: discountData.value,
              amount: discountAmount,
              reason: discountData.reason,
            },
            taxAmount,
            total: afterDiscount + taxAmount,
          };
        }
        return item;
      }));
    }
    setShowDiscountDialog(false);
    setDiscountTarget(null);
  };

  // Fetch held orders count on mount and periodically
  useEffect(() => {
    const fetchHeldOrdersCount = async () => {
      try {
        const response = await holdApi.list();
        if (response.data?.success) {
          setHeldOrdersCount(response.data.data?.length || 0);
        }
      } catch (error) {
        // Silently fail - not critical
        console.error('Failed to fetch held orders count:', error);
      }
    };

    fetchHeldOrdersCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchHeldOrdersCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh held orders count after hold/resume
  const refreshHeldOrdersCount = useCallback(async () => {
    try {
      const response = await holdApi.list();
      if (response.data?.success) {
        setHeldOrdersCount(response.data.data?.length || 0);
      }
    } catch (error) {
      console.error('Failed to refresh held orders count:', error);
    }
  }, []);

  // Hold cart using backend API
  const handleHoldCart = async (reason?: string, holdNotes?: string) => {
    if (items.length === 0) return;

    try {
      const holdData = {
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || null,
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        discountAmount: totals.discount,
        totalAmount: totals.total,
        holdReason: reason || null,
        notes: holdNotes || notes || null,
        metadata: cartDiscount ? { cartDiscount } : null,
        items: items.map((item, index) => ({
          productId: item.productId,
          productName: item.name,
          productSku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          subtotal: item.subtotal,
          isTaxable: item.isTaxable,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          discountType: item.discount?.type || null,
          discountValue: item.discount?.value || null,
          discountAmount: item.discount?.amount || 0,
          discountReason: item.discount?.reason || null,
          lineOrder: index,
        })),
      };

      const response = await holdApi.create(holdData);
      
      if (response.data?.success) {
        clearCart();
        setShowHoldCartDialog(false);
        setSuccess(`Cart held as ${response.data.data?.holdNumber || 'HOLD'}`);
        setTimeout(() => setSuccess(''), 3000);
        refreshHeldOrdersCount();
      } else {
        setError(response.data?.error || 'Failed to hold cart');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to hold cart');
    }
  };

  // Resume held cart using backend API
  const resumeHeldCart = async (holdId: string) => {
    // Warn if current cart has items
    if (items.length > 0) {
      if (!confirm('Current cart has items. Replace with held cart?')) return;
    }

    try {
      // Fetch the hold order with all items
      const response = await holdApi.getById(holdId);
      
      if (!response.data?.success) {
        setError(response.data?.error || 'Failed to load held cart');
        return;
      }

      const hold = response.data.data;

      // Convert hold items back to LineItem format
      const lineItems: LineItem[] = hold.items.map((item: any) => {
        const subtotal = item.subtotal;
        const discountAmount = item.discountAmount || 0;
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = item.taxAmount || 0;
        
        return {
          id: Date.now().toString() + Math.random(),
          productId: item.productId,
          name: item.productName,
          sku: item.productSku || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: item.costPrice,
          marginPct: 0,
          subtotal,
          isTaxable: item.isTaxable,
          taxRate: item.taxRate,
          taxAmount,
          total: afterDiscount + taxAmount,
          discount: item.discountAmount > 0 ? {
            type: item.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT',
            value: item.discountValue || 0,
            amount: item.discountAmount,
            reason: item.discountReason || '',
          } : undefined,
        };
      });

      setItems(lineItems);
      
      // Restore customer if there was one
      if (hold.customerId) {
        setSelectedCustomer({ id: hold.customerId, name: hold.customerName });
      } else {
        setSelectedCustomer(null);
      }
      
      // Restore cart discount from metadata
      if (hold.metadata?.cartDiscount) {
        setCartDiscount(hold.metadata.cartDiscount);
      } else {
        setCartDiscount(null);
      }
      
      setNotes(hold.notes || '');
      
      // Delete the hold from backend (it's now resumed)
      await holdApi.delete(holdId);
      
      setShowResumeDialog(false);
      refreshHeldOrdersCount();
      setSuccess('Cart resumed successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resume cart');
    }
  };

  // Smart Hold/Retrieve Toggle (SamplePOS/QuickBooks POS style)
  const handleHoldRetrieveToggle = async () => {
    // If cart has items, hold it instantly (no dialog)
    if (items.length > 0) {
      try {
        const holdData = {
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.name || null,
          subtotal: totals.subtotal,
          taxAmount: totals.tax,
          discountAmount: totals.discount,
          totalAmount: totals.total,
          holdReason: null,
          notes: notes || null,
          metadata: cartDiscount ? { cartDiscount } : null,
          items: items.map((item, index) => ({
            productId: item.productId,
            productName: item.name,
            productSku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            subtotal: item.subtotal,
            isTaxable: item.isTaxable,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            discountType: item.discount?.type || null,
            discountValue: item.discount?.value || null,
            discountAmount: item.discount?.amount || 0,
            discountReason: item.discount?.reason || null,
            lineOrder: index,
          })),
        };

        const response = await holdApi.create(holdData);
        
        if (response.data?.success) {
          clearCart();
          setSuccess(`Cart held as ${response.data.data?.holdNumber || 'HOLD'}`);
          setTimeout(() => setSuccess(''), 3000);
          refreshHeldOrdersCount();
        } else {
          setError(response.data?.error || 'Failed to hold cart');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to hold cart');
      }
    }
    // If cart is empty and there are held orders, show retrieve dialog
    else if (heldOrdersCount > 0) {
      setShowResumeDialog(true);
    }
    // If cart is empty and no holds, show message
    else {
      setSuccess('No held orders to retrieve');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // Add payment line to list
  const handleAddPaymentLine = () => {
    const amount = parseFloat(amountPaid);
    if (!amountPaid || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const newLine = {
      id: `payment_${Date.now()}_${Math.random()}`,
      paymentMethod: paymentMethod,
      amount: amount,
      reference: paymentReference || undefined,
    };

    setPaymentLines([...paymentLines, newLine]);
    setAmountPaid('');
    setPaymentReference('');
    setError('');
  };

  // Remove payment line
  const handleRemovePaymentLine = (lineId: string) => {
    setPaymentLines(paymentLines.filter(line => line.id !== lineId));
  };

  // Calculate payment totals (paymentLines only contains actual payments - CREDIT never added here)
  const totalPaid = paymentLines.reduce((sum, line) => sum + line.amount, 0);
  const remainingBalance = totals.total - totalPaid;
  const changeAmount = remainingBalance < 0 ? Math.abs(remainingBalance) : 0;

  // Process sale
  const handleProcessSale = async (splitPayments?: any[]) => {
    if (items.length === 0) {
      setError('Cart is empty');
      return;
    }

    // CRITICAL FIX: Create a proper copy of paymentLines (not a reference)
    // This prevents CREDIT from being pushed back into the state array
    const finalPaymentLines = splitPayments 
      ? splitPayments.map(p => ({
          id: `payment_${Date.now()}_${Math.random()}`,
          paymentMethod: p.method,
          amount: p.amount,
          reference: p.reference,
        }))
      : [...paymentLines];  // Create a copy with spread operator

    // ========================================================================
    // UX IMPROVEMENT: If user entered amount but forgot to click "Add Payment",
    // auto-add it now to prevent confusion and errors
    // This works REGARDLESS of existing payment lines - just add the input amount
    // ========================================================================
    if (amountPaid && parseFloat(amountPaid) > 0) {
      const amount = parseFloat(amountPaid);
      finalPaymentLines.push({
        id: `payment_${Date.now()}_${Math.random()}`,
        paymentMethod: paymentMethod,
        amount: amount,
        reference: paymentReference || undefined,
      });
      // Clear input after auto-adding
      setAmountPaid('');
      setPaymentReference('');
    }

    // Require at least one payment line (after auto-add)
    if (finalPaymentLines.length === 0) {
      setError('Please add a payment line before completing the sale');
      return;
    }

    // Calculate total from actual payment lines (never includes CREDIT at this point)
    const actualPaymentsReceived = finalPaymentLines.reduce((sum, p) => sum + p.amount, 0);

    // Validate: Walk-in customers must pay in full
    if (!selectedCustomer && actualPaymentsReceived < totals.total - 0.01) {
      setError('Walk-in customers must pay in full. Select a customer for partial payment.');
      return;
    }

    // Permission check: credit/partial payment requires pos.creditSale permission
    if (selectedCustomer && actualPaymentsReceived < totals.total - 0.01 && !perms.canCreditSale) {
      setError('You do not have permission to process credit sales. Please collect full payment.');
      return;
    }

    // CREDIT tracking line: Add ONLY when sending to backend (not stored in state)
    // This keeps paymentLines clean throughout the UI
    if (selectedCustomer && actualPaymentsReceived < totals.total - 0.01) {
      const creditAmount = totals.total - actualPaymentsReceived;
      finalPaymentLines.push({
        id: `payment_${Date.now()}_credit`,
        paymentMethod: 'CREDIT',
        amount: creditAmount,
        reference: undefined,
      });
    }

    setIsProcessing(true);
    setError('');

    try {
      // ========================================================================
      // CRITICAL: Calculate amountPaid EXCLUDING credit lines
      // Credit is not a payment - it's tracking unpaid balance
      // Only sum actual payments received (CASH, CARD, MOBILE_MONEY)
      // ========================================================================
      const actualPaymentsReceived = finalPaymentLines
        .filter(p => p.paymentMethod !== 'CREDIT')
        .reduce((sum, p) => sum + p.amount, 0);
      
      // ========================================================================
      // CRITICAL FIX: Determine payment method from ACTUAL payments only
      // Exclude CREDIT tracking line from payment method determination
      // Use UNIQUE payment methods - multiple CASH lines = still CASH
      // Backend doesn't accept 'SPLIT', so pick primary method if mixed
      // ========================================================================
      const actualPaymentLines = finalPaymentLines.filter(p => p.paymentMethod !== 'CREDIT');
      const uniquePaymentMethods = [...new Set(actualPaymentLines.map(p => p.paymentMethod))];
      
      let determinedPaymentMethod: string;
      if (uniquePaymentMethods.length === 0) {
        // No actual payments = pure credit sale
        determinedPaymentMethod = 'CREDIT';
      } else if (uniquePaymentMethods.length === 1) {
        // Single payment method (even if multiple lines of same type)
        determinedPaymentMethod = uniquePaymentMethods[0];
      } else {
        // Multiple different payment methods - pick the one with highest total
        // Backend doesn't support 'SPLIT', so we report the primary method
        const methodTotals = new Map<string, number>();
        for (const line of actualPaymentLines) {
          const current = methodTotals.get(line.paymentMethod) || 0;
          methodTotals.set(line.paymentMethod, current + line.amount);
        }
        // Find method with highest total
        let maxAmount = 0;
        determinedPaymentMethod = uniquePaymentMethods[0];
        for (const [method, total] of methodTotals) {
          if (total > maxAmount) {
            maxAmount = total;
            determinedPaymentMethod = method;
          }
        }
      }
      
      const saleData = {
        customerId: selectedCustomer?.id || null,
        paymentMethod: determinedPaymentMethod,
        items: items.map(item => ({
          productId: item.productId || null,
          itemType: item.itemType || 'PRODUCT',
          customDescription: item.customDescription || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          // CRITICAL: Only send taxRate if item is taxable (prevents tax on non-taxable products)
          taxRate: item.isTaxable ? item.taxRate : 0,
          discountAmount: item.discount?.amount || 0, // FIXED: Backend expects 'discountAmount' not 'discount'
        })),
        subtotal: totals.subtotal,
        taxAmount: totals.tax,
        discountAmount: totals.discount,
        totalAmount: totals.total,
        amountPaid: actualPaymentsReceived, // CRITICAL: Exclude credit from amountPaid
        notes: notes || undefined,
        paymentReference: paymentReference || undefined,
        saleDate: saleDate || undefined, // Backdated sale support
        splitPayments: finalPaymentLines.length > 1 ? finalPaymentLines.map(p => ({
          method: p.paymentMethod,
          amount: p.amount,
          reference: p.reference,
        })) : undefined,
      };

      const response = await salesApi.create(saleData);

      if (response.data.success) {
        const sale = response.data.data;
        
        // ========================================================================
        // CRITICAL FIX: Recalculate payment values from finalPaymentLines
        // The component-level remainingBalance/changeAmount are stale because
        // they were calculated BEFORE auto-adding the typed amount to finalPaymentLines
        // ========================================================================
        
        // Get actual payments (excluding CREDIT tracking line)
        const actualPayments = finalPaymentLines.filter(p => p.paymentMethod !== 'CREDIT');
        const totalActualPayments = actualPayments.reduce((sum, p) => sum + p.amount, 0);
        
        // Calculate remaining balance and change based on FINAL payment lines
        const finalRemainingBalance = totals.total - totalActualPayments;
        const finalChangeAmount = finalRemainingBalance < 0 ? Math.abs(finalRemainingBalance) : 0;
        const finalBalanceDue = finalRemainingBalance > 0 ? finalRemainingBalance : 0;
        
        // Amount tendered = what customer actually gave (same as totalActualPayments)
        // This is what the customer handed over - shown on receipt when > total
        const amountTendered = totalActualPayments;
        
        // Determine payment method for display
        const displayPaymentMethod = actualPayments.length > 1 
          ? 'SPLIT' 
          : actualPayments[0]?.paymentMethod || paymentMethod;
        
        setLastSale({
          saleNumber: sale.saleNumber || sale.id,
          date: saleDate || sale.createdAt || new Date().toISOString(),
          items: items.map(item => ({
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            discount: item.discount?.amount || 0,
          })),
          subtotal: totals.subtotal,
          discountAmount: totals.discount,
          taxAmount: totals.tax,
          total: totals.total,
          paymentMethod: displayPaymentMethod,
          amountPaid: totalActualPayments,  // Only actual payments (not CREDIT)
          amountTendered: amountTendered,  // What customer actually gave (includes change)
          change: finalChangeAmount,
          balanceDue: finalBalanceDue,  // Outstanding balance for credit sales
          customerName: selectedCustomer?.name,
          payments: actualPayments,  // Only show actual payments, not CREDIT tracking line
        });

        setSuccess('Sale completed successfully!');
        setShowPaymentModal(false);
        setShowSplitPayment(false);
        setShowReceiptModal(true);
        clearCart();
      } else {
        setError(response.data.error || 'Failed to process sale');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process sale');
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard shortcuts - matching SamplePOS behavior
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if typing in an input field (except for specific keys)
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // "/" key - Focus product search (works from anywhere)
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        productSearchRef.current?.focusSearch();
        return;
      }

      // F2 - Open custom item dialog
      if (e.key === 'F2') {
        e.preventDefault();
        if (!showCustomItemDialog) {
          setShowCustomItemDialog(true);
        }
        return;
      }

      // Shift+Enter: Open payment modal
      if (e.shiftKey && e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (items.length > 0 && !showPaymentModal) {
          setShowPaymentModal(true);
        }
        return;
      }

      // Ctrl+D: Open discount dialog for cart (permission gated)
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (items.length > 0 && perms.canApplyCartDiscount) {
          setDiscountTarget({ type: 'cart' });
          setShowDiscountDialog(true);
        }
        return;
      }

      // Ctrl+H: Smart Hold/Retrieve Toggle (SamplePOS style)
      if (e.ctrlKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (perms.canHoldOrders) handleHoldRetrieveToggle();
        return;
      }

      // Ctrl+Enter: Finalize sale (when payment modal open AND payment lines exist)
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (items.length > 0 && showPaymentModal && paymentLines.length > 0) {
          handleProcessSale();
        }
        return;
      }

      // F4 - Open payment
      if (e.key === 'F4' && items.length > 0) {
        e.preventDefault();
        setShowPaymentModal(true);
        return;
      }

      // F8 - Hold/Retrieve toggle (SamplePOS style)
      if (e.key === 'F8') {
        e.preventDefault();
        if (perms.canHoldOrders) handleHoldRetrieveToggle();
        return;
      }

      // F9 - Resume cart (fallback)
      if (e.key === 'F9' && perms.canHoldOrders && heldOrdersCount > 0) {
        e.preventDefault();
        setShowResumeDialog(true);
        return;
      }

      // Delete - Clear cart (when no input focused)
      if (e.key === 'Delete' && !isInputFocused && items.length > 0) {
        e.preventDefault();
        if (confirm('Clear entire cart?')) {
          clearCart();
        }
        return;
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        if (showPaymentModal) {
          setShowPaymentModal(false);
          return;
        }
        if (showSplitPayment) {
          setShowSplitPayment(false);
          return;
        }
        if (showDiscountDialog) {
          setShowDiscountDialog(false);
          return;
        }
        if (showCustomItemDialog) {
          setShowCustomItemDialog(false);
          return;
        }
        if (showHoldCartDialog) {
          setShowHoldCartDialog(false);
          return;
        }
        if (showResumeDialog) {
          setShowResumeDialog(false);
          return;
        }
        if (showReceiptModal) {
          setShowReceiptModal(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, heldOrdersCount, showPaymentModal, showSplitPayment, showDiscountDialog, showHoldCartDialog, showResumeDialog, showReceiptModal, showCustomItemDialog]);

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            Point of Sale
          </h1>
          {perms.canHoldOrders && heldOrdersCount > 0 && (
            <button
              onClick={() => setShowResumeDialog(true)}
              className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium hover:bg-orange-200"
            >
              <PauseCircle className="w-4 h-4" />
              {heldOrdersCount} Held
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <User className="w-4 h-4" />
          {user?.fullName} ({user?.role})
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} title="Dismiss" aria-label="Dismiss error"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-4 mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} title="Dismiss" aria-label="Dismiss success message"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
        {/* Left Panel - Product Search */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <POSProductSearch 
                  ref={productSearchRef}
                  onSelect={handleAddProduct} 
                />
              </div>
              <button
                onClick={() => setShowCustomItemDialog(true)}
                className="shrink-0 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                title="Add custom or service item (F2)"
              >
                <Wrench className="w-4 h-4" />
                Custom Item
              </button>
            </div>
            
            {/* Keyboard Shortcuts Help - matches SamplePOS */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="bg-gray-100 px-2 py-1 rounded" title="Focus product search">/  Search</span>
              <span className="bg-gray-100 px-2 py-1 rounded" title="Navigate product list">↑↓ Navigate</span>
              <span className="bg-gray-100 px-2 py-1 rounded" title="Add selected product">Enter Add</span>
              <span className="bg-gray-100 px-2 py-1 rounded" title="Clear search">Esc Clear</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded" title="Add custom/service item">F2 Custom</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded" title="Open payment modal">Shift+Enter Pay</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded" title="Add cart discount">Ctrl+D Discount</span>
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded" title="Hold/Resume cart">Ctrl+H Hold</span>
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="bg-white rounded-lg shadow flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart ({items.length} items)
              </h2>
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Cart is empty</p>
                  <p className="text-sm mt-1">Search for products to add them</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-center">Qty</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 flex items-center gap-1.5">
                            {item.name}
                            {item.itemType === 'SERVICE' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">SVC</span>
                            )}
                            {item.itemType === 'CUSTOM' && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold">CUSTOM</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{item.itemType !== 'PRODUCT' ? item.itemType : item.sku}</div>
                          {item.discount && (
                            <div className="text-xs text-green-600 mt-1">
                              -{item.discount.type === 'PERCENTAGE' ? `${item.discount.value}%` : `${settings.currencySymbol} ${item.discount.value.toLocaleString()}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {settings.currencySymbol} {item.unitPrice.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-7 rounded border hover:bg-gray-100 flex items-center justify-center"
                              title="Decrease quantity"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              id={`qty-${item.id}`}
                              name={`quantity-${item.id}`}
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-12 text-center border rounded py-1"
                              min="1"
                              aria-label="Item quantity"
                            />
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 rounded border hover:bg-gray-100 flex items-center justify-center"
                              title="Increase quantity"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {settings.currencySymbol} {item.total.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {perms.canApplyItemDiscount && (
                            <button
                              onClick={() => {
                                setDiscountTarget({ type: 'item', itemIndex: index });
                                setShowDiscountDialog(true);
                              }}
                              className="w-7 h-7 text-orange-600 hover:bg-orange-50 rounded flex items-center justify-center"
                              title="Apply discount"
                            >
                              <Percent className="w-4 h-4" />
                            </button>
                            )}
                            <button
                              onClick={() => removeItem(item.id)}
                              className="w-7 h-7 text-red-600 hover:bg-red-50 rounded flex items-center justify-center"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Customer & Payment */}
        <div className="flex flex-col gap-4">
          {/* Customer Selection */}
          <div className="bg-white rounded-lg shadow p-4">
            <CustomerSelector
              selectedCustomer={selectedCustomer}
              onSelectCustomer={(customer: any) => {
                setSelectedCustomer(customer);
                // DON'T auto-change payment method - user decides how to pay (CASH/CARD/MOBILE)
                // System will auto-track remaining balance as credit internally
              }}
              saleTotal={totals.total}
            />
          </div>

          {/* Cart Summary */}
          <div className="bg-white rounded-lg shadow p-4 flex-1">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Summary
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{settings.currencySymbol} {totals.subtotal.toLocaleString()}</span>
              </div>

              {totals.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{settings.currencySymbol} {totals.discount.toLocaleString()}</span>
                </div>
              )}

              {totals.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span>{settings.currencySymbol} {totals.tax.toLocaleString()}</span>
                </div>
              )}

              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-blue-600">{settings.currencySymbol} {totals.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Discount Button — requires pos.cartDiscount permission */}
            {perms.canApplyCartDiscount && (
            <button
              onClick={() => {
                setDiscountTarget({ type: 'cart' });
                setShowDiscountDialog(true);
              }}
              disabled={items.length === 0}
              className="w-full mt-4 py-2 border-2 border-dashed border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Percent className="w-4 h-4" />
              {cartDiscount ? `Discount: ${cartDiscount.type === 'PERCENTAGE' ? `${cartDiscount.value}%` : `${settings.currencySymbol} ${cartDiscount.value.toLocaleString()}`}` : 'Add Cart Discount'}
            </button>
            )}

            {/* Notes */}
            <div className="mt-4">
              <label htmlFor="sale-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                id="sale-notes"
                name="saleNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            {/* Smart Hold/Retrieve Toggle Button (QuickBooks POS style) */}
            {perms.canHoldOrders && (
            <POSButton
              variant={items.length > 0 ? "warning" : (heldOrdersCount > 0 ? "primary" : "secondary")}
              onClick={handleHoldRetrieveToggle}
              disabled={items.length === 0 && heldOrdersCount === 0}
              className="w-full flex items-center justify-center gap-2 relative"
            >
              {items.length > 0 ? (
                <>
                  <PauseCircle className="w-4 h-4" />
                  Hold Cart (Ctrl+H)
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Retrieve Holds (Ctrl+H)
                  {heldOrdersCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {heldOrdersCount}
                    </span>
                  )}
                </>
              )}
            </POSButton>
            )}

            <POSButton
              variant="primary"
              onClick={() => setShowPaymentModal(true)}
              disabled={items.length === 0}
              className="w-full py-4 text-lg flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Pay (F4) - {settings.currencySymbol} {totals.total.toLocaleString()}
            </POSButton>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <POSModal
        open={showPaymentModal}
        onOpenChange={(open) => {
          setShowPaymentModal(open);
          if (!open) {
            // Reset payment modal state when closing
            setSaleDate('');
            setShowDatePicker(false);
            setPaymentLines([]);
            setAmountPaid('');
            setPaymentReference('');
          }
        }}
        title="Complete Payment"
        size="lg"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Total */}
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-sm text-blue-600">Total Amount</div>
            <div className="text-3xl font-bold text-blue-800">{formatCurrency(totals.total)}</div>
            {selectedCustomer && (
              <div className="text-sm text-blue-600 mt-1">Customer: {selectedCustomer.name}</div>
            )}
          </div>

          {/* Payment Method - CRITICAL: CREDIT is NOT a payment method!
              CREDIT is auto-added internally for remaining balance with customer.
              Users should only select actual payment methods: CASH, CARD, MOBILE_MONEY
          */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'CASH', label: 'Cash', icon: Banknote },
                { value: 'CARD', label: 'Card', icon: CreditCard },
                { value: 'MOBILE_MONEY', label: 'Mobile Money', icon: Smartphone },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setPaymentMethod(value as any)}
                  className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-colors ${
                    paymentMethod === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
            {selectedCustomer && (
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Partial payment will automatically track remaining balance for {selectedCustomer.name}
              </p>
            )}
          </div>

          {/* Payment Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount <span className="text-xs text-gray-500">(Press Enter to add)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                id="payment-amount"
                name="paymentAmount"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && amountPaid && parseFloat(amountPaid) > 0) {
                    e.preventDefault();
                    const enteredAmount = parseFloat(amountPaid);
                    const newTotalPaid = totalPaid + enteredAmount;
                    
                    // If payment is complete (full/over) OR customer selected (credit), complete the sale
                    if (newTotalPaid >= totals.total - 0.01 || selectedCustomer) {
                      handleProcessSale();
                    } else {
                      // Partial payment without customer - just add line, user must add more
                      handleAddPaymentLine();
                    }
                  }
                }}
                placeholder={remainingBalance > 0 ? remainingBalance.toString() : totals.total.toString()}
                className="flex-1 px-4 py-3 text-lg border rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0.01"
                step="0.01"
                autoFocus
                aria-label="Payment amount"
              />
              <button
                onClick={() => setAmountPaid(remainingBalance > 0 ? remainingBalance.toString() : totals.total.toString())}
                className="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold"
                disabled={remainingBalance <= 0}
              >
                Fill
              </button>
            </div>
            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[totals.total, 50000, 100000, 200000].filter(a => a >= remainingBalance || a === totals.total).slice(0, 5).map(amount => (
                <button
                  key={amount}
                  onClick={() => setAmountPaid(amount.toString())}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Reference (for card/mobile) */}
          {(paymentMethod === 'CARD' || paymentMethod === 'MOBILE_MONEY') && (
            <div>
              <label htmlFor="payment-reference" className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number <span className="text-gray-500">(Optional)</span>
              </label>
              <input
                type="text"
                id="payment-reference"
                name="paymentReference"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder={paymentMethod === 'CARD' ? 'Last 4 digits' : 'e.g., ABC123XYZ'}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Payment Lines List (only actual payments - CREDIT never added to this array) */}
          {paymentLines.length > 0 && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Payment Lines</h4>
              <div className="space-y-2">
                {paymentLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between bg-white p-2 rounded border">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{line.paymentMethod}</div>
                      {line.reference && (
                        <div className="text-xs text-gray-500">Ref: {line.reference}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatCurrency(line.amount)}</span>
                      <button
                        onClick={() => handleRemovePaymentLine(line.id)}
                        className="text-red-600 hover:text-red-800 font-bold px-2 text-lg"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Running Totals */}
          <div className="border-t-2 border-gray-200 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-gray-100 p-3 rounded-lg">
                <span className="font-semibold text-gray-700">Sale Total:</span>
                <span className="font-bold text-xl text-gray-900">{formatCurrency(totals.total)}</span>
              </div>
              {totalPaid > 0 && (
                <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg">
                  <span className="font-semibold text-green-700">Paid:</span>
                  <span className="font-bold text-xl text-green-600">{formatCurrency(totalPaid)}</span>
                </div>
              )}
              {remainingBalance > 0.01 ? (
                <div className="flex justify-between items-center bg-red-50 p-3 rounded-lg border-2 border-red-300">
                  <span className="font-bold text-red-700">⚠️ Remaining:</span>
                  <span className="font-bold text-2xl text-red-600">{formatCurrency(remainingBalance)}</span>
                </div>
              ) : changeAmount > 0.01 ? (
                <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border-2 border-blue-300 animate-pulse">
                  <span className="font-bold text-blue-700">💰 Change Due:</span>
                  <span className="font-bold text-2xl text-blue-600">{formatCurrency(changeAmount)}</span>
                </div>
              ) : totalPaid > 0 ? (
                <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg border-2 border-green-300">
                  <span className="font-bold text-green-700">✓ Status:</span>
                  <span className="font-bold text-xl text-green-600">Exact Payment</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Backdated Sale Option — restricted to users with sales.backdate permission */}
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <div className="border-t pt-4">
            <label htmlFor="backdate-sale" className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input
                type="checkbox"
                id="backdate-sale"
                name="backdateSale"
                checked={showDatePicker}
                onChange={(e) => {
                  setShowDatePicker(e.target.checked);
                  if (!e.target.checked) setSaleDate('');
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Backdate this sale</span>
            </label>
            {showDatePicker && (
              <div>
                <label htmlFor="sale-date" className="block text-sm font-medium text-gray-700 mb-1">Sale Date</label>
                <input
                  type="datetime-local"
                  id="sale-date"
                  name="saleDate"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {saleDate ? `Sale will be recorded as: ${new Date(saleDate).toLocaleString()}` : 'Leave empty for current date/time'}
                </p>
              </div>
            )}
          </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <POSButton
              variant="secondary"
              onClick={() => {
                setShowPaymentModal(false);
                setSaleDate('');
                setShowDatePicker(false);
                setPaymentLines([]);
                setAmountPaid('');
                setPaymentReference('');
              }}
              className="flex-1"
            >
              Cancel
            </POSButton>
            
            {/* Complete Sale Button - Smart enable logic */}
            <POSButton
              variant="success"
              onClick={() => handleProcessSale()}
              disabled={
                isProcessing || 
                // Must have payment (either in lines or in input to auto-add)
                (paymentLines.length === 0 && (!amountPaid || parseFloat(amountPaid) <= 0)) ||
                // If balance remains, must have customer selected for credit tracking
                (remainingBalance > 0.01 && !selectedCustomer && paymentLines.length > 0)
              }
              className="flex-1"
            >
              {isProcessing ? (
                'Processing...'
              ) : remainingBalance > 0.01 && selectedCustomer && (paymentLines.length > 0 || parseFloat(amountPaid || '0') > 0) ? (
                <>
                  Complete Sale
                  <span className="ml-1 text-xs opacity-90">
                    ({formatCurrency(remainingBalance)} on credit)
                  </span>
                </>
              ) : (
                'Complete Sale ✓'
              )}
            </POSButton>
          </div>
        </div>
      </POSModal>

      {/* Discount Dialog */}
      <DiscountDialog
        isOpen={showDiscountDialog}
        onClose={() => {
          setShowDiscountDialog(false);
          setDiscountTarget(null);
        }}
        onApply={handleApplyDiscount}
        originalAmount={
          discountTarget?.type === 'item' && discountTarget.itemIndex !== undefined
            ? items[discountTarget.itemIndex]?.subtotal || 0
            : totals.subtotal
        }
        lineItemIndex={discountTarget?.type === 'item' ? discountTarget.itemIndex : undefined}
        userRole={user?.role || 'STAFF'}
      />

      {/* Custom Item Dialog */}
      <CustomItemDialog
        isOpen={showCustomItemDialog}
        onClose={() => setShowCustomItemDialog(false)}
        onAdd={handleAddCustomItem}
      />

      {/* Hold Cart Dialog */}
      <HoldCartDialog
        isOpen={showHoldCartDialog}
        onClose={() => setShowHoldCartDialog(false)}
        onConfirm={handleHoldCart}
        itemCount={items.length}
        totalAmount={totals.total}
      />

      {/* Split Payment Dialog */}
      <SplitPaymentDialog
        isOpen={showSplitPayment}
        onClose={() => setShowSplitPayment(false)}
        onConfirm={(payments) => handleProcessSale(payments)}
        totalAmount={totals.total}
        customerName={selectedCustomer?.name}
        hasCustomer={!!selectedCustomer}
      />

      {/* Resume Held Carts Dialog - Uses backend API */}
      <ResumeHoldDialog
        isOpen={showResumeDialog}
        onClose={() => setShowResumeDialog(false)}
        onResume={resumeHeldCart}
      />

      {/* Receipt Modal */}
      <POSModal
        open={showReceiptModal}
        onOpenChange={setShowReceiptModal}
        title="Sale Complete"
        size="md"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <ReceiptIcon className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">Sale #{lastSale?.saleNumber}</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {settings.currencySymbol} {lastSale?.total?.toLocaleString()}
            </div>
            {lastSale?.change > 0 && (
              <div className="text-sm text-gray-600 mt-1">
                Change: {settings.currencySymbol} {lastSale.change.toLocaleString()}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <POSButton
              variant="secondary"
              onClick={() => {
                setShowReceiptModal(false);
                setShowPrintDialog(true);
              }}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </POSButton>
            <POSButton
              variant="primary"
              onClick={() => {
                setShowReceiptModal(false);
                productSearchRef.current?.focusSearch();
              }}
              className="flex-1"
            >
              New Sale
            </POSButton>
          </div>
        </div>
      </POSModal>

      {/* Print Receipt Dialog */}
      <PrintReceiptDialog
        open={showPrintDialog}
        onOpenChange={setShowPrintDialog}
        receiptData={lastSale ? {
          saleNumber: lastSale.saleNumber || '',
          saleDate: new Date(lastSale.date || Date.now()).toLocaleString('en-UG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          customerName: lastSale.customerName,
          cashierName: user?.fullName,
          items: lastSale.items || [],
          subtotal: lastSale.subtotal || 0,
          discountAmount: lastSale.discountAmount || 0,
          taxAmount: lastSale.taxAmount || 0,
          totalAmount: lastSale.total || 0,
          paymentMethod: lastSale.paymentMethod,
          payments: lastSale.payments,
          amountPaid: lastSale.amountPaid,
          amountTendered: lastSale.amountTendered,
          change: lastSale.change,
          balanceDue: lastSale.balanceDue,
        } : null}
        onAfterPrint={() => {
          productSearchRef.current?.focusSearch();
        }}
      />

      {/* Hidden Receipt for Printing */}
      <div className="hidden">
        <div ref={printRef}>
          {lastSale && (
            <Receipt
              saleNumber={lastSale.saleNumber || ''}
              date={lastSale.date || new Date().toISOString()}
              items={lastSale.items || []}
              subtotal={lastSale.subtotal || 0}
              discountAmount={lastSale.discountAmount || 0}
              taxAmount={lastSale.taxAmount || 0}
              total={lastSale.total || 0}
              paymentMethod={lastSale.paymentMethod || 'CASH'}
              payments={lastSale.payments}
              amountPaid={lastSale.amountPaid}
              amountTendered={lastSale.amountTendered}
              change={lastSale.change}
              balanceDue={lastSale.balanceDue}
              customerName={lastSale.customerName}
              cashierName={user?.fullName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
