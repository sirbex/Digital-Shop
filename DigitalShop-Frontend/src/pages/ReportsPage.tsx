import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { reportsApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';

type ReportType = 'dashboard' | 'dailySales' | 'salesDetails' | 'salesSummary' | 'salesByHour' | 'salesByCashier' | 'salesTrends' | 'paymentMethods' | 'inventory' | 'stockValuation' | 'outOfStock' | 'inventoryMovements' | 'slowMoving' | 'fastMoving' | 'expiringStock' | 'stockReorder' | 'inventoryTurnover' | 'profitLoss' | 'customerAging' | 'customerAccounts' | 'bestSelling' | 'invoices' | 'voided' | 'refunds' | 'discounts' | 'discountsByCashier' | 'paymentsReceived' | 'dailyCollections' | 'expenseSummary' | 'expenseByCategory' | 'incomeVsExpense';

export function ReportsPage() {
  const perms = usePermissions();
  const [selectedReport, setSelectedReport] = useState<ReportType>('dashboard');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const reportContentRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysFilter, setDaysFilter] = useState(30);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Overview', 'Sales']));

  // Report categories with icons, colors, and permission keys
  const allReportCategories = [
    { id: 'Overview', name: 'Overview', icon: '📊', color: 'blue', permissionKey: null },   // Visible to anyone with any report access
    { id: 'Sales', name: 'Sales', icon: '💰', color: 'green', permissionKey: 'reports.sales' },
    { id: 'Financial', name: 'Financial', icon: '📈', color: 'purple', permissionKey: 'reports.financial' },
    { id: 'Inventory', name: 'Inventory', icon: '📦', color: 'orange', permissionKey: 'reports.inventory' },
    { id: 'Customers', name: 'Customers', icon: '👥', color: 'cyan', permissionKey: 'reports.customers' },
    { id: 'Invoices', name: 'Invoices & Refunds', icon: '🧾', color: 'yellow', permissionKey: 'reports.invoices' },
    { id: 'Discounts', name: 'Discounts', icon: '🏷️', color: 'pink', permissionKey: 'reports.discounts' },
  ];

  // Filter categories by permission
  const reportCategories = allReportCategories.filter(cat => {
    if (!cat.permissionKey) return true; // Overview always visible
    return perms.can(cat.permissionKey);
  });

  const allReports = [
    // Dashboard
    { id: 'dashboard', name: 'Dashboard Summary', icon: '📊', description: 'Overview of today\'s sales, inventory & receivables', category: 'Overview' },
    
    // Sales Reports
    { id: 'dailySales', name: 'Daily Sales', icon: '📅', description: 'Sales breakdown by day', category: 'Sales' },
    { id: 'salesDetails', name: 'Sales Details', icon: '📋', description: 'Detailed list of all sales transactions', category: 'Sales' },
    { id: 'salesSummary', name: 'Sales Summary', icon: '📈', description: 'Aggregate sales metrics for period', category: 'Sales' },
    { id: 'salesByHour', name: 'Sales by Hour', icon: '🕐', description: 'Hourly sales breakdown', category: 'Sales' },
    { id: 'salesByCashier', name: 'Sales by Cashier', icon: '👤', description: 'Performance by cashier', category: 'Sales' },
    { id: 'salesTrends', name: 'Sales Trends', icon: '📊', description: 'Daily trends with growth analysis', category: 'Sales' },
    { id: 'paymentMethods', name: 'Payment Methods', icon: '💳', description: 'Analysis by payment method', category: 'Sales' },
    
    // Financial
    { id: 'profitLoss', name: 'Profit & Loss', icon: '💰', description: 'Revenue, costs, and profit breakdown', category: 'Financial' },
    { id: 'bestSelling', name: 'Best Selling', icon: '🏆', description: 'Top performing products', category: 'Financial' },
    { id: 'paymentsReceived', name: 'Payments Received', icon: '💵', description: 'Customer payments on invoices (Income)', category: 'Financial' },
    { id: 'dailyCollections', name: 'Daily Collections', icon: '📆', description: 'Daily breakdown of payments received', category: 'Financial' },
    { id: 'expenseSummary', name: 'Expense Summary', icon: '📤', description: 'Total expenses by category', category: 'Financial', requiresPermission: 'reports.expenses' },
    { id: 'expenseByCategory', name: 'Expenses by Category', icon: '📊', description: 'Expense breakdown by category', category: 'Financial', requiresPermission: 'reports.expenses' },
    { id: 'incomeVsExpense', name: 'Income vs Expense', icon: '⚖️', description: 'Compare income and expenses', category: 'Financial', requiresPermission: 'reports.expenses' },
    
    // Inventory Reports
    { id: 'inventory', name: 'Inventory Report', icon: '📦', description: 'Stock levels and low stock alerts', category: 'Inventory' },
    { id: 'stockValuation', name: 'Stock Valuation', icon: '💎', description: 'Inventory value at cost and retail', category: 'Inventory' },
    { id: 'outOfStock', name: 'Out of Stock', icon: '⚠️', description: 'Products with zero quantity', category: 'Inventory' },
    { id: 'inventoryMovements', name: 'Inventory Movements', icon: '↔️', description: 'Stock movement history', category: 'Inventory' },
    { id: 'slowMoving', name: 'Slow Moving', icon: '🐢', description: 'Products with low sales velocity', category: 'Inventory' },
    { id: 'fastMoving', name: 'Fast Moving', icon: '🚀', description: 'High turnover products', category: 'Inventory' },
    { id: 'expiringStock', name: 'Expiring Stock', icon: '⏰', description: 'Products approaching expiry', category: 'Inventory' },
    { id: 'stockReorder', name: 'Stock Reorder', icon: '🔄', description: 'Products below reorder level', category: 'Inventory' },
    { id: 'inventoryTurnover', name: 'Inventory Turnover', icon: '♻️', description: 'Turnover ratio by product', category: 'Inventory' },
    
    // Customers
    { id: 'customerAccounts', name: 'Customer Accounts', icon: '👥', description: 'Customer balances and transactions', category: 'Customers' },
    { id: 'customerAging', name: 'Customer Aging', icon: '📆', description: 'Outstanding balances by age', category: 'Customers' },
    
    // Invoices
    { id: 'invoices', name: 'Invoices', icon: '🧾', description: 'Invoice listing and status', category: 'Invoices' },
    { id: 'voided', name: 'Voided Sales', icon: '🚫', description: 'Voided transaction records', category: 'Invoices' },
    { id: 'refunds', name: 'Refunds', icon: '↩️', description: 'Refund transaction records', category: 'Invoices' },
    
    // Discounts
    { id: 'discounts', name: 'Discount Report', icon: '🏷️', description: 'All discounts given with details', category: 'Discounts' },
    { id: 'discountsByCashier', name: 'Discounts by Cashier', icon: '👤', description: 'Discount summary per employee', category: 'Discounts' },
  ];

  // Filter reports: only show reports whose category is accessible AND whose own permission is met
  const permittedCategoryIds = new Set(reportCategories.map(c => c.id));
  const reports = allReports.filter(r => {
    if (!permittedCategoryIds.has(r.category)) return false;
    if ('requiresPermission' in r && r.requiresPermission) {
      return perms.can(r.requiresPermission);
    }
    return true;
  });

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Get reports grouped by category
  const getReportsByCategory = (categoryId: string) => {
    return reports.filter(r => r.category === categoryId);
  };

  // Get category color class
  const getCategoryColorClass = (color: string, isSelected: boolean = false) => {
    const colors: Record<string, { bg: string; border: string; text: string; hover: string }> = {
      blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', hover: 'hover:bg-blue-100' },
      green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', hover: 'hover:bg-green-100' },
      purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', hover: 'hover:bg-purple-100' },
      orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', hover: 'hover:bg-orange-100' },
      cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', hover: 'hover:bg-cyan-100' },
      yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', hover: 'hover:bg-yellow-100' },
      pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', hover: 'hover:bg-pink-100' },
    };
    return colors[color] || colors.blue;
  };

  // Auto-load dashboard on mount
  useEffect(() => {
    if (selectedReport === 'dashboard') {
      loadReport();
    }
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      setReportData(null);
      let response;

      switch (selectedReport) {
        case 'dashboard':
          response = await reportsApi.getDashboard();
          break;
        case 'dailySales':
          response = await reportsApi.getDailySales(selectedDate);
          break;
        case 'salesDetails':
          response = await reportsApi.getSalesDetails({ startDate, endDate });
          break;
        case 'salesSummary':
          response = await reportsApi.getSalesSummary(startDate, endDate);
          break;
        case 'salesByHour':
          response = await reportsApi.getSalesByHour(startDate, endDate);
          break;
        case 'salesByCashier':
          response = await reportsApi.getSalesByCashier(startDate, endDate);
          break;
        case 'salesTrends':
          response = await reportsApi.getSalesTrends(startDate, endDate);
          break;
        case 'paymentMethods':
          response = await reportsApi.getPaymentMethodAnalysis(startDate, endDate);
          break;
        case 'profitLoss':
          response = await reportsApi.getProfitLoss(startDate, endDate);
          break;
        case 'bestSelling':
          response = await reportsApi.getBestSelling({ startDate, endDate, limit: 20 });
          break;
        case 'inventory':
          response = await reportsApi.getInventory({});
          break;
        case 'stockValuation':
          response = await reportsApi.getStockValuation();
          break;
        case 'outOfStock':
          response = await reportsApi.getOutOfStock();
          break;
        case 'inventoryMovements':
          response = await reportsApi.getInventoryMovements({ startDate, endDate });
          break;
        case 'slowMoving':
          response = await reportsApi.getSlowMoving(daysFilter);
          break;
        case 'fastMoving':
          response = await reportsApi.getFastMoving({ startDate, endDate, limit: 20 });
          break;
        case 'expiringStock':
          response = await reportsApi.getExpiringStock(daysFilter);
          break;
        case 'stockReorder':
          response = await reportsApi.getStockReorder();
          break;
        case 'inventoryTurnover':
          response = await reportsApi.getInventoryTurnover(startDate, endDate);
          break;
        case 'customerAccounts':
          response = await reportsApi.getCustomerAccounts({});
          break;
        case 'customerAging':
          response = await reportsApi.getCustomerAging();
          break;
        case 'invoices':
          response = await reportsApi.getInvoices({ startDate, endDate });
          break;
        case 'voided':
          response = await reportsApi.getVoided({ startDate, endDate });
          break;
        case 'refunds':
          response = await reportsApi.getRefunds({ startDate, endDate });
          break;
        case 'discounts':
          response = await reportsApi.getDiscounts({ startDate, endDate });
          break;
        case 'discountsByCashier':
          response = await reportsApi.getDiscountsByCashier({ startDate, endDate });
          break;
        case 'paymentsReceived':
          response = await reportsApi.getPaymentsReceived({ startDate, endDate });
          break;
        case 'dailyCollections':
          response = await reportsApi.getDailyCollections({ startDate, endDate });
          break;
        case 'expenseSummary':
          response = await reportsApi.getExpenseSummary({ startDate, endDate });
          break;
        case 'expenseByCategory':
          response = await reportsApi.getExpenseByCategory({ startDate, endDate });
          break;
        case 'incomeVsExpense':
          response = await reportsApi.getIncomeVsExpense({ startDate, endDate });
          break;
      }

      if (response?.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load report:', error);
      alert('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!reportContentRef.current) return;

    const reportName = reports.find(r => r.id === selectedReport)?.name || 'Report';
    const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : selectedDate || new Date().toLocaleDateString();

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // ── Header ──
    doc.setFontSize(18);
    doc.setTextColor(30, 64, 175); // blue-800
    doc.text(reportName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${dateRange}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 3;
    doc.setDrawColor(37, 99, 235); // blue-600
    doc.setLineWidth(0.5);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 8;

    // ── Extract summary cards (key-value pairs from colored boxes) ──
    const container = reportContentRef.current;
    const summaryPairs: { label: string; value: string }[] = [];
    const gridDivs = container.querySelectorAll('.grid > div, .bg-blue-50, .bg-green-50, .bg-red-50, .bg-purple-50, .bg-orange-50, .bg-yellow-50, .bg-gray-50, .bg-emerald-50');
    gridDivs.forEach((card) => {
      const labelEl = card.querySelector('p.text-xs, p.text-sm, div.text-sm');
      const valueEl = card.querySelector('p.text-xl, p.text-2xl, p.text-lg, p.text-3xl, div.text-2xl, div.text-xl');
      if (labelEl && valueEl) {
        const label = (labelEl.textContent || '').trim();
        const value = (valueEl.textContent || '').trim();
        if (label && value) {
          summaryPairs.push({ label, value });
        }
      }
    });

    // Render summary cards as a two-column table
    if (summaryPairs.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.text('Summary', 14, yPos);
      yPos += 2;

      // Pair them into rows of 2
      const summaryRows: string[][] = [];
      for (let i = 0; i < summaryPairs.length; i += 2) {
        const row: string[] = [
          summaryPairs[i].label,
          summaryPairs[i].value,
          summaryPairs[i + 1]?.label || '',
          summaryPairs[i + 1]?.value || '',
        ];
        summaryRows.push(row);
      }

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: summaryRows,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'normal', textColor: [100, 100, 100], cellWidth: 55 },
          1: { fontStyle: 'bold', cellWidth: 65 },
          2: { fontStyle: 'normal', textColor: [100, 100, 100], cellWidth: 55 },
          3: { fontStyle: 'bold', cellWidth: 65 },
        },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as any).lastAutoTable?.finalY + 6 || yPos + 30;
    }

    // ── Extract HTML tables ──
    const tables = container.querySelectorAll('table');
    tables.forEach((table, tableIdx) => {
      // Check if we need a new page
      if (yPos > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        yPos = 15;
      }

      // Get optional heading before the table
      let heading = '';
      let prev = table.parentElement?.previousElementSibling;
      if (prev && (prev.tagName === 'H3' || prev.tagName === 'H4')) {
        heading = (prev.textContent || '').trim();
      }
      if (heading) {
        doc.setFontSize(11);
        doc.setTextColor(50, 50, 50);
        doc.text(heading, 14, yPos);
        yPos += 4;
      }

      // Parse thead
      const headCells: string[] = [];
      table.querySelectorAll('thead th').forEach((th) => {
        headCells.push((th.textContent || '').trim());
      });

      // Parse tbody rows
      const bodyRows: string[][] = [];
      table.querySelectorAll('tbody tr').forEach((tr) => {
        const row: string[] = [];
        tr.querySelectorAll('td').forEach((td) => {
          row.push((td.textContent || '').trim());
        });
        if (row.length > 0) bodyRows.push(row);
      });

      // Parse tfoot if present
      const footRows: string[][] = [];
      table.querySelectorAll('tfoot tr').forEach((tr) => {
        const row: string[] = [];
        tr.querySelectorAll('td').forEach((td) => {
          row.push((td.textContent || '').trim());
        });
        if (row.length > 0) footRows.push(row);
      });

      if (headCells.length === 0 && bodyRows.length === 0) return;

      // Detect right-aligned columns from the original th classes
      const colStyles: Record<number, any> = {};
      table.querySelectorAll('thead th').forEach((th, idx) => {
        const cls = th.className || '';
        if (cls.includes('text-right')) {
          colStyles[idx] = { halign: 'right' };
        } else if (cls.includes('text-center')) {
          colStyles[idx] = { halign: 'center' };
        }
      });

      autoTable(doc, {
        startY: yPos,
        head: headCells.length > 0 ? [headCells] : undefined,
        body: bodyRows,
        foot: footRows.length > 0 ? footRows : undefined,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        footStyles: { fillColor: [243, 244, 246], textColor: [30, 30, 30], fontStyle: 'bold', fontSize: 8 },
        columnStyles: colStyles,
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
          // Footer on every page
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            'DigitalShop ERP System - Confidential Report',
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 7,
            { align: 'center' }
          );
        },
      });

      yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos + 20;
    });

    // ── Profit Flow / flex-based sections (no <table>) ──
    // Extract flow rows from .flex.justify-between containers (P&L, Income vs Expense)
    if (tables.length === 0 || selectedReport === 'profitLoss' || selectedReport === 'incomeVsExpense') {
      const flexRows: string[][] = [];
      container.querySelectorAll('.flex.justify-between').forEach((row) => {
        const spans = row.querySelectorAll('span, p, div');
        if (spans.length >= 2) {
          const label = (spans[0].textContent || '').trim();
          const value = (spans[spans.length - 1].textContent || '').trim();
          if (label && value && label !== value) {
            flexRows.push([label, value]);
          }
        }
      });

      // De-duplicate with summary pairs to avoid double entries
      const existingLabels = new Set(summaryPairs.map(p => p.label));
      const uniqueFlexRows = flexRows.filter(r => !existingLabels.has(r[0]));

      if (uniqueFlexRows.length > 0 && tables.length === 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Item', 'Amount']],
          body: uniqueFlexRows,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          columnStyles: { 0: { cellWidth: 140 }, 1: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        });
        yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos + 20;
      }
    }

    // ── Footer on last page ──
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'DigitalShop ERP System - Confidential Report',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 7,
      { align: 'center' }
    );

    // ── Download ──
    const fileName = `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const exportToCSV = () => {
    if (!reportData) return;

    let csvContent = '';
    const data = Array.isArray(reportData) ? reportData : [reportData];

    if (data.length > 0) {
      const headers = Object.keys(data[0]).filter(k => !['items', 'agingBuckets'].includes(k));
      csvContent += headers.join(',') + '\n';

      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        });
        csvContent += values.join(',') + '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport}_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatCurrency = (value: any) => {
    const num = parseFloat(value || 0);
    return `UGX ${num.toLocaleString()}`;
  };

  const formatPercent = (value: any) => {
    const num = parseFloat(value || 0);
    return `${num.toFixed(1)}%`;
  };

  const renderReportContent = () => {
    if (loading) return <div className="text-center py-12">Loading report...</div>;
    if (!reportData) return <div className="text-center py-12 text-gray-500">Click "Generate Report" to load data</div>;

    switch (selectedReport) {
      case 'dashboard':
        return renderDashboard();
      case 'dailySales':
        return renderDailySales();
      case 'salesDetails':
        return renderSalesDetails();
      case 'salesSummary':
        return renderSalesSummary();
      case 'salesByHour':
        return renderSalesByHour();
      case 'salesByCashier':
        return renderSalesByCashier();
      case 'salesTrends':
        return renderSalesTrends();
      case 'paymentMethods':
        return renderPaymentMethods();
      case 'profitLoss':
        return renderProfitLoss();
      case 'bestSelling':
        return renderBestSelling();
      case 'inventory':
        return renderInventory();
      case 'stockValuation':
        return renderStockValuation();
      case 'outOfStock':
        return renderOutOfStock();
      case 'inventoryMovements':
        return renderInventoryMovements();
      case 'slowMoving':
        return renderSlowMoving();
      case 'fastMoving':
        return renderFastMoving();
      case 'expiringStock':
        return renderExpiringStock();
      case 'stockReorder':
        return renderStockReorder();
      case 'inventoryTurnover':
        return renderInventoryTurnover();
      case 'customerAccounts':
        return renderCustomerAccounts();
      case 'customerAging':
        return renderCustomerAging();
      case 'invoices':
        return renderInvoices();
      case 'voided':
        return renderVoided();
      case 'refunds':
        return renderRefunds();
      case 'discounts':
        return renderDiscounts();
      case 'discountsByCashier':
        return renderDiscountsByCashier();
      case 'paymentsReceived':
        return renderPaymentsReceived();
      case 'dailyCollections':
        return renderDailyCollections();
      case 'expenseSummary':
        return renderExpenseSummary();
      case 'expenseByCategory':
        return renderExpenseByCategory();
      case 'incomeVsExpense':
        return renderIncomeVsExpense();
      default:
        return null;
    }
  };

  // ========== DASHBOARD ==========
  const renderDashboard = () => {
    const { today, month, inventory, receivables } = reportData;
    return (
      <div className="space-y-4 sm:space-y-6">
        <h3 className="text-base sm:text-lg font-semibold">Today's Performance</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Today's Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{today?.todaySales || 0}</p>
          </div>
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Today's Revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(today?.todayRevenue)}</p>
          </div>
          {perms.canViewProfit && (
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Today's Profit</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{formatCurrency(today?.todayProfit)}</p>
          </div>
          )}
          <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Avg Transaction</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{formatCurrency(today?.todayAvgTransaction)}</p>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-semibold">This Month</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Monthly Sales</p>
            <p className="text-lg sm:text-xl font-bold">{month?.monthSales || 0}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Monthly Revenue</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(month?.monthRevenue)}</p>
          </div>
          {perms.canViewProfit && (
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Monthly Profit</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(month?.monthProfit)}</p>
          </div>
          )}
          {perms.canViewProfit && (
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Profit Margin</p>
            <p className="text-lg sm:text-xl font-bold">{formatPercent(month?.monthProfitMargin)}</p>
          </div>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-semibold">Inventory Status</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Total Products</p>
            <p className="text-lg sm:text-xl font-bold">{inventory?.totalProducts || 0}</p>
          </div>
          <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Out of Stock</p>
            <p className="text-lg sm:text-xl font-bold text-red-600">{inventory?.outOfStock || 0}</p>
          </div>
          <div className="bg-orange-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Low Stock</p>
            <p className="text-lg sm:text-xl font-bold text-orange-600">{inventory?.lowStock || 0}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Inventory Value</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(inventory?.inventoryValue)}</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold">Receivables</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Unpaid Invoices</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{receivables?.unpaidInvoices || 0}</p>
          </div>
          <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Total Receivables</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(receivables?.totalReceivables)}</p>
          </div>
        </div>
      </div>
    );
  };

  // ========== DAILY SALES ==========
  const renderDailySales = () => {
    const data = Array.isArray(reportData) ? reportData : [reportData];
    if (data.length === 0) return <div className="text-center py-12 text-gray-500">No sales for this date</div>;
    
    const summary = data[0];
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Total Revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{formatCurrency(summary.totalAmount)}</p>
          </div>
          {perms.canViewProfit && (
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Profit</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(summary.profit)}</p>
          </div>
          )}
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Transactions</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{summary.transactionCount}</p>
          </div>
          {perms.canViewCostPrice && (
          <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Cost of Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(summary.totalCost)}</p>
          </div>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-semibold">By Payment Method</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Cash ({summary.cashTransactions})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(summary.cashSales)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Card ({summary.cardTransactions})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(summary.cardSales)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">M. Money ({summary.mobileMoneyTransactions})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(summary.mobileMoneySales)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Credit ({summary.creditTransactions})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(summary.creditSales)}</p>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${perms.canViewProfit ? 'sm:grid-cols-2' : ''} gap-2 sm:gap-4`}>
          <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Average Transaction</p>
            <p className="text-lg sm:text-xl font-bold text-yellow-600">
              {formatCurrency(summary.transactionCount > 0 ? parseFloat(summary.totalAmount) / parseFloat(summary.transactionCount) : 0)}
            </p>
          </div>
          {perms.canViewProfit && (
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Profit Margin</p>
            <p className="text-lg sm:text-xl font-bold text-green-600">{formatPercent(summary.avgProfitMargin)}</p>
          </div>
          )}
        </div>
      </div>
    );
  };

  // ========== SALES DETAILS ==========
  const renderSalesDetails = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No sales found for this period</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[600px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 sm:px-3 py-2 text-left">Sale #</th>
              <th className="px-2 sm:px-3 py-2 text-left">Date</th>
              <th className="px-2 sm:px-3 py-2 text-left">Customer</th>
              <th className="px-2 sm:px-3 py-2 text-right">Subtotal</th>
              <th className="px-2 sm:px-3 py-2 text-right">Tax</th>
              <th className="px-2 sm:px-3 py-2 text-right">Total</th>
              {perms.canViewProfit && <th className="px-2 sm:px-3 py-2 text-right">Profit</th>}
              <th className="px-2 sm:px-3 py-2 text-center">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-2 sm:px-3 py-2 font-mono text-xs">{row.saleNumber}</td>
                <td className="px-2 sm:px-3 py-2">{new Date(row.saleDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{row.customerName || 'Walk-in'}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.subtotal).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.taxAmount).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium">{parseFloat(row.totalAmount).toLocaleString()}</td>
                {perms.canViewProfit && <td className="px-3 py-2 text-right text-green-600">{parseFloat(row.profit).toLocaleString()}</td>}
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    row.paymentMethod === 'CASH' ? 'bg-green-100 text-green-800' :
                    row.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-800' :
                    row.paymentMethod === 'MOBILE_MONEY' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>{row.paymentMethod}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 text-sm text-gray-500">
          Total: {reportData.length} transactions
        </div>
      </div>
    );
  };

  // ========== SALES SUMMARY ==========
  const renderSalesSummary = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Net Sales</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{formatCurrency(reportData.netSales)}</p>
          </div>
          {perms.canViewProfit && (
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Gross Profit</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(reportData.grossProfit)}</p>
          </div>
          )}
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Transactions</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{reportData.totalTransactions}</p>
          </div>
          {perms.canViewCostPrice && (
          <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Cost of Goods</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(reportData.costOfGoodsSold)}</p>
          </div>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-semibold">Sales Breakdown</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Gross Sales</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.grossSales)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Total Tax</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.totalTax)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Total Discount</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.totalDiscount)}</p>
          </div>
          {perms.canViewProfit && (
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Profit Margin</p>
            <p className="text-lg sm:text-xl font-bold">{formatPercent(reportData.profitMarginPercent)}</p>
          </div>
          )}
        </div>

        <h3 className="text-base sm:text-lg font-semibold">Collections by Payment Method</h3>
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Cash ({reportData.cashCount})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.cashCollected)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Card ({reportData.cardCount})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.cardCollected)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">M. Money ({reportData.mobileMoneyCount})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.mobileMoneyCollected)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Credit ({reportData.creditCount})</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.totalCreditSales)}</p>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-semibold">Transaction Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Average Transaction</p>
            <p className="text-lg sm:text-xl font-bold text-yellow-600">{formatCurrency(reportData.avgTransactionValue)}</p>
          </div>
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Largest Transaction</p>
            <p className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(reportData.largestTransaction)}</p>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Smallest Transaction</p>
            <p className="text-lg sm:text-xl font-bold">{formatCurrency(reportData.smallestTransaction)}</p>
          </div>
        </div>

        <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
          <p className="text-xs sm:text-sm text-gray-600">Credit Outstanding</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{formatCurrency(reportData.creditOutstanding)}</p>
        </div>
      </div>
    );
  };

  // ========== PROFIT & LOSS ==========
  const renderProfitLoss = () => {
    // Handle both old format and new enhanced format
    const revenue = reportData.revenue || {};
    const operatingExpenses = reportData.operatingExpenses || { total: 0, count: 0, byCategory: [] };
    
    const grossRevenue = revenue.grossRevenue || reportData.grossSales || 0;
    const discounts = revenue.discounts || reportData.totalDiscount || 0;
    const netRevenue = revenue.netRevenue || reportData.netRevenue || 0;
    const taxCollected = revenue.taxCollected || reportData.totalTax || 0;
    const transactionCount = revenue.transactionCount || reportData.transactionCount || 0;
    
    const costOfGoodsSold = reportData.costOfGoodsSold || 0;
    const grossProfit = reportData.grossProfit || 0;
    const grossProfitMargin = reportData.grossProfitMargin || 0;
    
    const totalExpenses = operatingExpenses.total || 0;
    const expensesByCategory = operatingExpenses.byCategory || [];
    
    const netProfit = reportData.netProfit ?? (grossProfit - totalExpenses);
    const netProfitMargin = reportData.netProfitMargin ?? (netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0);

    return (
      <div className="space-y-6">
        {/* Revenue Section */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2 font-semibold">Revenue</div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between">
              <span>Gross Sales (excl. tax)</span>
              <span className="font-medium">{formatCurrency(grossRevenue)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Less: Discounts</span>
              <span>({formatCurrency(discounts)})</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold text-blue-600">
              <span>Net Revenue</span>
              <span>{formatCurrency(netRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Cost of Goods Sold Section */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="bg-red-600 text-white px-4 py-2 font-semibold">Cost of Goods Sold</div>
          <div className="p-4">
            <div className="flex justify-between font-semibold text-red-600">
              <span>Total COGS</span>
              <span>({formatCurrency(costOfGoodsSold)})</span>
            </div>
          </div>
        </div>

        {/* Gross Profit Section */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="bg-green-600 text-white px-4 py-2 font-semibold">Gross Profit</div>
          <div className="p-4">
            <div className="flex justify-between">
              <span>Gross Profit</span>
              <span className="text-2xl font-bold text-green-600">{formatCurrency(grossProfit)}</span>
            </div>
            <div className="flex justify-between text-gray-600 mt-2">
              <span>Gross Profit Margin</span>
              <span>{formatPercent(grossProfitMargin)}</span>
            </div>
          </div>
        </div>

        {/* Operating Expenses Section */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="bg-orange-600 text-white px-4 py-2 font-semibold flex justify-between items-center">
            <span>Operating Expenses</span>
            <span className="text-sm font-normal">({operatingExpenses.count || 0} transactions)</span>
          </div>
          <div className="p-4 space-y-2">
            {expensesByCategory.length > 0 ? (
              <>
                {expensesByCategory.map((cat: any) => (
                  <div key={cat.category} className="flex justify-between text-gray-700">
                    <span className="capitalize">{cat.category.replace(/_/g, ' ')}</span>
                    <span>({formatCurrency(cat.amount)})</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-semibold text-orange-600">
                  <span>Total Operating Expenses</span>
                  <span>({formatCurrency(totalExpenses)})</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between font-semibold text-orange-600">
                <span>Total Operating Expenses</span>
                <span>({formatCurrency(totalExpenses)})</span>
              </div>
            )}
          </div>
        </div>

        {/* Net Profit Section - The Bottom Line */}
        <div className="bg-white border-2 border-green-500 rounded-lg overflow-hidden shadow-lg">
          <div className={`${netProfit >= 0 ? 'bg-green-700' : 'bg-red-700'} text-white px-4 py-2 font-semibold`}>
            Net Profit (Bottom Line)
          </div>
          <div className="p-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-lg">Net Profit</span>
                <p className="text-sm text-gray-500 mt-1">
                  Gross Profit - Operating Expenses
                </p>
              </div>
              <span className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netProfit >= 0 ? '' : '-'}{formatCurrency(Math.abs(netProfit))}
              </span>
            </div>
            <div className="flex justify-between text-gray-600 mt-4 pt-4 border-t">
              <span>Net Profit Margin</span>
              <span className={`font-semibold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(netProfitMargin)}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Tax Collected</p>
            <p className="text-xl font-bold">{formatCurrency(taxCollected)}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Transactions</p>
            <p className="text-xl font-bold">{transactionCount}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Accounts Receivable</p>
            <p className="text-xl font-bold">{formatCurrency(reportData.accountsReceivable || 0)}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Inventory Value</p>
            <p className="text-xl font-bold">{formatCurrency(reportData.inventoryValue || 0)}</p>
          </div>
        </div>

        {/* Profit Breakdown Visual */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Profit Flow Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span>Net Revenue</span>
              <span className="font-medium">{formatCurrency(netRevenue)}</span>
            </div>
            <div className="flex justify-between py-2 border-b text-red-600">
              <span>Less: Cost of Goods Sold</span>
              <span>({formatCurrency(costOfGoodsSold)})</span>
            </div>
            <div className="flex justify-between py-2 border-b font-semibold text-green-600">
              <span>= Gross Profit</span>
              <span>{formatCurrency(grossProfit)}</span>
            </div>
            <div className="flex justify-between py-2 border-b text-orange-600">
              <span>Less: Operating Expenses</span>
              <span>({formatCurrency(totalExpenses)})</span>
            </div>
            <div className={`flex justify-between py-2 font-bold text-lg ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              <span>= Net Profit</span>
              <span>{netProfit >= 0 ? '' : '-'}{formatCurrency(Math.abs(netProfit))}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ========== BEST SELLING ==========
  const renderBestSelling = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No sales data for this period</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">Qty Sold</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              {perms.canViewProfit && <th className="px-3 py-2 text-right">Profit</th>}
              {perms.canViewProfit && <th className="px-3 py-2 text-right">Margin</th>}
              <th className="px-3 py-2 text-right">Transactions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any, index: number) => (
              <tr key={row.productId} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                </td>
                <td className="px-3 py-2 font-medium">{row.productName}</td>
                <td className="px-3 py-2 text-gray-500">{row.sku}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.totalQuantitySold).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium">{parseFloat(row.totalRevenue).toLocaleString()}</td>
                {perms.canViewProfit && <td className="px-3 py-2 text-right text-green-600">{parseFloat(row.totalProfit).toLocaleString()}</td>}
                {perms.canViewProfit && <td className="px-3 py-2 text-right">{formatPercent(row.avgProfitMargin)}</td>}
                <td className="px-3 py-2 text-right">{row.transactionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== INVENTORY ==========
  const renderInventory = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No products found</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">On Hand</th>
              <th className="px-3 py-2 text-right">Reorder Level</th>
              {perms.canViewCostPrice && <th className="px-3 py-2 text-right">Cost Price</th>}
              {perms.canViewCostPrice && <th className="px-3 py-2 text-right">Inventory Value</th>}
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => {
              const qty = parseFloat(row.quantityOnHand || 0);
              const reorder = parseFloat(row.reorderLevel || 0);
              const isLowStock = qty <= reorder && qty > 0;
              const isOutOfStock = qty === 0;

              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{row.productName}</td>
                  <td className="px-3 py-2 text-gray-500">{row.sku}</td>
                  <td className={`px-3 py-2 text-right font-medium ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : ''}`}>
                    {qty.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">{reorder.toLocaleString()}</td>
                  {perms.canViewCostPrice && <td className="px-3 py-2 text-right">{parseFloat(row.costPrice || 0).toLocaleString()}</td>}
                  {perms.canViewCostPrice && <td className="px-3 py-2 text-right">{parseFloat(row.inventoryValue || 0).toLocaleString()}</td>}
                  <td className="px-3 py-2 text-center">
                    {isOutOfStock ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Out of Stock</span>
                    ) : isLowStock ? (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">Low Stock</span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">In Stock</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== STOCK VALUATION ==========
  const renderStockValuation = () => {
    const { products, summary } = reportData;

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Total Products</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600">{summary?.totalProducts || 0}</p>
          </div>
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Total Quantity</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{parseFloat(summary?.totalQuantity || 0).toLocaleString()}</p>
          </div>
          {perms.canViewCostPrice && (
          <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Value at Cost</p>
            <p className="text-xl sm:text-2xl font-bold text-purple-600">{formatCurrency(summary?.totalValueAtCost)}</p>
          </div>
          )}
          <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600">Value at Retail</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{formatCurrency(summary?.totalValueAtRetail)}</p>
          </div>
        </div>

        {products && products.length > 0 && (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full text-xs sm:text-sm min-w-[600px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-3 py-2 text-left">Product</th>
                  <th className="px-2 sm:px-3 py-2 text-left">SKU</th>
                  <th className="px-2 sm:px-3 py-2 text-right">Qty</th>
                  {perms.canViewCostPrice && <th className="px-2 sm:px-3 py-2 text-right">Avg Cost</th>}
                  {perms.canViewCostPrice && <th className="px-2 sm:px-3 py-2 text-right">Cost Val.</th>}
                  <th className="px-2 sm:px-3 py-2 text-right">Retail Val.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((row: any) => (
                  <tr key={row.productId} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-3 py-2 font-medium">{row.productName}</td>
                    <td className="px-2 sm:px-3 py-2 text-gray-500">{row.sku}</td>
                    <td className="px-2 sm:px-3 py-2 text-right">{parseFloat(row.totalQuantity).toLocaleString()}</td>
                    {perms.canViewCostPrice && <td className="px-2 sm:px-3 py-2 text-right">{parseFloat(row.avgCostPrice).toLocaleString()}</td>}
                    {perms.canViewCostPrice && <td className="px-2 sm:px-3 py-2 text-right">{parseFloat(row.valueAtCost).toLocaleString()}</td>}
                    <td className="px-2 sm:px-3 py-2 text-right">{parseFloat(row.valueAtRetail).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ========== OUT OF STOCK ==========
  const renderOutOfStock = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-green-600">All products are in stock! 🎉</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-800 font-medium">⚠️ {reportData.length} products are out of stock</p>
        </div>
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Reorder Level</th>
              <th className="px-3 py-2 text-right">Selling Price</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-gray-500">{row.sku}</td>
                <td className="px-3 py-2">{row.category || '-'}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.reorderLevel || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.sellingPrice || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== CUSTOMER ACCOUNTS ==========
  const renderCustomerAccounts = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No customers found</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-right">Credit Limit</th>
              <th className="px-3 py-2 text-right">Total Purchases</th>
              <th className="px-3 py-2 text-right">Total Payments</th>
              <th className="px-3 py-2 text-left">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => {
              const balance = parseFloat(row.balance || 0);
              return (
                <tr key={row.customerId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{row.customerName}</td>
                  <td className="px-3 py-2">{row.phone || '-'}</td>
                  <td className={`px-3 py-2 text-right font-bold ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(balance))} {balance < 0 ? '(owes)' : ''}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.creditLimit)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.totalPurchases)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.totalPayments)}</td>
                  <td className="px-3 py-2">{row.lastActivityDate ? new Date(row.lastActivityDate).toLocaleDateString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== CUSTOMER AGING ==========
  const renderCustomerAging = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-green-600">No outstanding balances! 🎉</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">1-30 Days</th>
              <th className="px-3 py-2 text-right">31-60 Days</th>
              <th className="px-3 py-2 text-right">61-90 Days</th>
              <th className="px-3 py-2 text-right">90+ Days</th>
              <th className="px-3 py-2 text-right font-bold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.customerId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.customerName}</td>
                <td className="px-3 py-2">{row.phone || '-'}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.current || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.days1to30 || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.days31to60 || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.days61to90 || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-red-600">{parseFloat(row.over90 || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-bold text-red-600">{parseFloat(row.totalOutstanding || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== INVOICES ==========
  const renderInvoices = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No invoices found for this period</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Invoice #</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Issue Date</th>
              <th className="px-3 py-2 text-left">Due Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{row.invoiceNumber}</td>
                <td className="px-3 py-2">{row.customerName}</td>
                <td className="px-3 py-2">{new Date(row.issueDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{new Date(row.dueDate).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.totalAmount).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-600">{parseFloat(row.amountPaid).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-red-600 font-medium">{parseFloat(row.amountDue).toLocaleString()}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    row.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    row.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                    row.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== VOIDED ==========
  const renderVoided = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-green-600">No voided sales for this period 👍</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Sale #</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Original Amount</th>
              <th className="px-3 py-2 text-left">Cashier</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50 bg-red-50">
                <td className="px-3 py-2 font-mono text-xs">{row.saleNumber}</td>
                <td className="px-3 py-2">{new Date(row.saleDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{row.customerName || 'Walk-in'}</td>
                <td className="px-3 py-2 text-right line-through text-gray-500">{parseFloat(row.totalAmount).toLocaleString()}</td>
                <td className="px-3 py-2">{row.cashierName}</td>
                <td className="px-3 py-2 text-xs">{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== REFUNDS ==========
  const renderRefunds = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-green-600">No refunds for this period 👍</div>;
    }

    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Sale #</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Refund Amount</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-left">Processed By</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{row.saleNumber}</td>
                <td className="px-3 py-2">{new Date(row.refundDate || row.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2">{row.customerName || 'Walk-in'}</td>
                <td className="px-3 py-2 text-right text-red-600 font-medium">{parseFloat(row.refundAmount).toLocaleString()}</td>
                <td className="px-3 py-2 text-xs">{row.refundReason || '-'}</td>
                <td className="px-3 py-2">{row.processedByName || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ========== DISCOUNTS ==========
  const renderDiscounts = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No discounts given during this period</div>;
    }

    const totalDiscount = reportData.reduce((sum: number, row: any) => sum + parseFloat(row.discountAmount || 0), 0);

    return (
      <div className="space-y-4">
        {/* Summary Card */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Total Discounts Given</p>
              <p className="text-2xl font-bold text-orange-600">UGX {totalDiscount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Transactions with Discounts</p>
              <p className="text-xl font-semibold">{reportData.length}</p>
            </div>
          </div>
        </div>

        {/* Detail Table */}
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-xs sm:text-sm min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Sale #</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Given By</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2 text-left">Items Discounted</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportData.map((row: any) => {
                // discountedItems is already parsed JSON from PostgreSQL json_agg - no need to parse again
                const discountedItems = Array.isArray(row.discountedItems) ? row.discountedItems : [];
                return (
                  <tr key={row.saleId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{row.saleNumber}</td>
                    <td className="px-3 py-2">{new Date(row.saleDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{row.customerName || 'Walk-in'}</td>
                    <td className="px-3 py-2 font-medium">{row.cashierName}</td>
                    <td className="px-3 py-2 text-right">{parseFloat(row.subtotal).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-orange-600 font-medium">{parseFloat(row.discountAmount).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-orange-500">{parseFloat(row.discountPercent).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-xs">
                      {discountedItems.length > 0 ? (
                        <ul className="list-disc list-inside">
                          {discountedItems.map((item: any, idx: number) => (
                            <li key={idx}>{item.productName}: {parseFloat(item.discountAmount).toLocaleString()}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">Sale-level discount</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right">Total Discounts:</td>
                <td className="px-3 py-2 text-right text-orange-600">UGX {totalDiscount.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ========== DISCOUNTS BY CASHIER ==========
  const renderDiscountsByCashier = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No discounts given during this period</div>;
    }

    const totalDiscount = reportData.reduce((sum: number, row: any) => sum + parseFloat(row.totalDiscountGiven || 0), 0);
    const totalSales = reportData.reduce((sum: number, row: any) => sum + parseInt(row.salesWithDiscount || 0), 0);

    return (
      <div className="space-y-4">
        {/* Summary Card */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">Total Discounts by All Cashiers</p>
              <p className="text-2xl font-bold text-purple-600">UGX {totalDiscount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Sales with Discounts</p>
              <p className="text-xl font-semibold">{totalSales}</p>
            </div>
          </div>
        </div>

        {/* Detail Table */}
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-xs sm:text-sm min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Cashier</th>
                <th className="px-3 py-2 text-right">Sales w/ Discount</th>
                <th className="px-3 py-2 text-right">Total Discount</th>
                <th className="px-3 py-2 text-right">Avg Discount %</th>
                <th className="px-3 py-2 text-right">Max Discount</th>
                <th className="px-3 py-2 text-right">Min Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportData.map((row: any) => (
                <tr key={row.cashierId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{row.cashierName}</td>
                  <td className="px-3 py-2 text-right">{row.salesWithDiscount}</td>
                  <td className="px-3 py-2 text-right text-purple-600 font-medium">{parseFloat(row.totalDiscountGiven).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{parseFloat(row.avgDiscountPercent).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-red-500">{parseFloat(row.maxDiscountAmount).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-green-500">{parseFloat(row.minDiscountAmount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{totalSales}</td>
                <td className="px-3 py-2 text-right text-purple-600">UGX {totalDiscount.toLocaleString()}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ========== PAYMENTS RECEIVED (INCOME) ==========
  const renderPaymentsReceived = () => {
    if (!reportData || !Array.isArray(reportData.payments) || reportData.payments.length === 0) {
      return <div className="text-center py-12 text-gray-500">No payments received during this period</div>;
    }

    const { payments, summary } = reportData;

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Total Collected</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600">UGX {(summary?.totalAmount || 0).toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Number of Payments</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{summary?.totalCount || 0}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Cash Received</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-600">UGX {(summary?.cashAmount || 0).toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Mobile Money</p>
            <p className="text-lg sm:text-2xl font-bold text-orange-600">UGX {(summary?.mobileMoneyAmount || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Payments Table */}
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-xs sm:text-sm min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Receipt #</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Invoice #</th>
                <th className="px-3 py-2 text-left">Payment Method</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((payment: any) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{payment.receiptNumber}</td>
                  <td className="px-3 py-2">{payment.paymentDate?.split('T')[0]}</td>
                  <td className="px-3 py-2">{payment.customerName}</td>
                  <td className="px-3 py-2">{payment.invoiceNumber}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      payment.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' :
                      payment.paymentMethod === 'MOBILE_MONEY' ? 'bg-orange-100 text-orange-700' :
                      payment.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {payment.paymentMethod?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-green-600">
                    UGX {parseFloat(payment.amount || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td colSpan={5} className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right text-green-600">UGX {(summary?.totalAmount || 0).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ========== DAILY COLLECTIONS ==========
  const renderDailyCollections = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No collections during this period</div>;
    }

    const totalCollections = reportData.reduce((sum: number, row: any) => sum + parseFloat(row.totalCollected || 0), 0);

    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Collections</p>
          <p className="text-2xl font-bold text-green-600">UGX {totalCollections.toLocaleString()}</p>
        </div>

        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-xs sm:text-sm min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right"># Payments</th>
                <th className="px-3 py-2 text-right">Cash</th>
                <th className="px-3 py-2 text-right">Mobile Money</th>
                <th className="px-3 py-2 text-right">Card</th>
                <th className="px-3 py-2 text-right">Bank Transfer</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportData.map((row: any) => (
                <tr key={row.date} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{row.date}</td>
                  <td className="px-3 py-2 text-right">{row.paymentCount}</td>
                  <td className="px-3 py-2 text-right">{parseFloat(row.cashCollected || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{parseFloat(row.mobileMoneyCollected || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{parseFloat(row.cardCollected || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{parseFloat(row.bankTransferCollected || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-600">
                    {parseFloat(row.totalCollected || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{reportData.reduce((sum: number, r: any) => sum + parseInt(r.paymentCount || 0), 0)}</td>
                <td className="px-3 py-2 text-right">{reportData.reduce((sum: number, r: any) => sum + parseFloat(r.cashCollected || 0), 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{reportData.reduce((sum: number, r: any) => sum + parseFloat(r.mobileMoneyCollected || 0), 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{reportData.reduce((sum: number, r: any) => sum + parseFloat(r.cardCollected || 0), 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{reportData.reduce((sum: number, r: any) => sum + parseFloat(r.bankTransferCollected || 0), 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-600">UGX {totalCollections.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ========== EXPENSE SUMMARY ==========
  const renderExpenseSummary = () => {
    if (!reportData) {
      return <div className="text-center py-12 text-gray-500">No expense data available</div>;
    }

    const { summary, byCategory } = reportData;

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Total Expenses</p>
            <p className="text-lg sm:text-2xl font-bold text-red-600">UGX {(summary?.totalAmount || 0).toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600"># of Expenses</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600">{summary?.totalCount || 0}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Average Expense</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-600">UGX {(summary?.avgAmount || 0).toLocaleString()}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-600">Largest Expense</p>
            <p className="text-lg sm:text-2xl font-bold text-orange-600">UGX {(summary?.maxAmount || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Category Breakdown */}
        {Array.isArray(byCategory) && byCategory.length > 0 && (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full text-xs sm:text-sm min-w-[400px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-right"># Expenses</th>
                  <th className="px-3 py-2 text-right">Total Amount</th>
                  <th className="px-3 py-2 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byCategory.map((cat: any) => (
                  <tr key={cat.category} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{cat.category}</td>
                    <td className="px-3 py-2 text-right">{cat.expenseCount}</td>
                    <td className="px-3 py-2 text-right text-red-600 font-medium">
                      UGX {parseFloat(cat.totalAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">{parseFloat(cat.percentage || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ========== EXPENSE BY CATEGORY ==========
  const renderExpenseByCategory = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No expenses during this period</div>;
    }

    const totalExpenses = reportData.reduce((sum: number, row: any) => sum + parseFloat(row.totalAmount || 0), 0);

    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">UGX {totalExpenses.toLocaleString()}</p>
        </div>

        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-xs sm:text-sm min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right"># Expenses</th>
                <th className="px-3 py-2 text-right">Total Amount</th>
                <th className="px-3 py-2 text-right">Avg. Amount</th>
                <th className="px-3 py-2 text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reportData.map((row: any) => (
                <tr key={row.category} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{row.category}</td>
                  <td className="px-3 py-2 text-right">{row.expenseCount}</td>
                  <td className="px-3 py-2 text-right text-red-600 font-medium">
                    UGX {parseFloat(row.totalAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    UGX {parseFloat(row.avgAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {((parseFloat(row.totalAmount || 0) / totalExpenses) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-semibold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{reportData.reduce((sum: number, r: any) => sum + parseInt(r.expenseCount || 0), 0)}</td>
                <td className="px-3 py-2 text-right text-red-600">UGX {totalExpenses.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ========== INCOME VS EXPENSE ==========
  const renderIncomeVsExpense = () => {
    if (!reportData) {
      return <div className="text-center py-12 text-gray-500">No data available for this period</div>;
    }

    const { income, expenses, netIncome, netProfitMargin, dailyBreakdown } = reportData;
    const totalIncome = parseFloat(income?.totalIncome || income?.salesRevenue || 0);
    const salesRevenue = parseFloat(income?.salesRevenue || 0);
    const grossProfit = parseFloat(income?.grossProfit || 0);
    const paymentsReceived = parseFloat(income?.paymentsReceived || 0);
    const totalExpenses = parseFloat(expenses?.totalExpenses || 0);
    const net = parseFloat(netIncome || 0);
    const margin = parseFloat(netProfitMargin || 0);

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Sales Revenue</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(salesRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">{income?.salesCount || 0} transactions</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Gross Profit</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(grossProfit)}</p>
            <p className="text-xs text-gray-500 mt-1">After COGS</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Operating Expenses</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-gray-500 mt-1">{expenses?.expenseCount || 0} expenses</p>
          </div>
          <div className={`border-2 rounded-lg p-4 ${net >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-yellow-50 border-yellow-300'}`}>
            <p className="text-sm text-gray-600">Net Profit</p>
            <p className={`text-2xl font-bold ${net >= 0 ? 'text-emerald-600' : 'text-yellow-600'}`}>
              {net >= 0 ? '' : '-'}{formatCurrency(Math.abs(net))}
            </p>
            <p className={`text-xs mt-1 ${net >= 0 ? 'text-emerald-500' : 'text-yellow-500'}`}>
              {margin.toFixed(1)}% margin
            </p>
          </div>
        </div>

        {/* Profit Flow Summary */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold mb-4">Profit Calculation Flow</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span>Sales Revenue</span>
              <span className="font-medium text-green-600">+{formatCurrency(salesRevenue)}</span>
            </div>
            <div className="flex justify-between py-2 border-b text-gray-500">
              <span className="pl-4">Less: Cost of Goods Sold (built into Gross Profit)</span>
              <span>—</span>
            </div>
            <div className="flex justify-between py-2 border-b font-semibold text-blue-600">
              <span>= Gross Profit</span>
              <span>{formatCurrency(grossProfit)}</span>
            </div>
            <div className="flex justify-between py-2 border-b text-red-600">
              <span>Less: Operating Expenses</span>
              <span>-{formatCurrency(totalExpenses)}</span>
            </div>
            <div className={`flex justify-between py-2 font-bold text-lg ${net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              <span>= Net Profit</span>
              <span>{net >= 0 ? '' : '-'}{formatCurrency(Math.abs(net))}</span>
            </div>
          </div>
        </div>

        {/* Visual Comparison Bar */}
        <div className="bg-white border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-3">Income vs Expense Comparison</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-green-600 font-medium">Gross Profit (Revenue after COGS)</span>
                <span>{formatCurrency(grossProfit)}</span>
              </div>
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, (grossProfit / Math.max(grossProfit, totalExpenses, 1)) * 100)}%` }}
                >
                  <span className="text-xs text-white font-medium">Income</span>
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-red-600 font-medium">Operating Expenses</span>
                <span>{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${Math.min(100, (totalExpenses / Math.max(grossProfit, totalExpenses, 1)) * 100)}%` }}
                >
                  <span className="text-xs text-white font-medium">Expenses</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <span className="font-medium">{net >= 0 ? 'Net Profit' : 'Net Loss'}</span>
            <span className={`text-xl font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(net))}
            </span>
          </div>
        </div>

        {/* Debt Collections Info */}
        {paymentsReceived > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Additional Collections</h4>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600 text-sm">Payments Received from Invoices</p>
                <p className="text-xs text-gray-500">(Debt collections - not counted in profit calculation)</p>
              </div>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(paymentsReceived)}</p>
            </div>
          </div>
        )}

        {/* Expense Categories Breakdown */}
        {Array.isArray(expenses?.byCategory) && expenses.byCategory.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Expense Breakdown by Category</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right"># Expenses</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">% of Expenses</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.byCategory.map((cat: any) => (
                    <tr key={cat.category} className="hover:bg-gray-50">
                      <td className="px-3 py-2 capitalize">{cat.category.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-right">{cat.count}</td>
                      <td className="px-3 py-2 text-right text-red-600 font-medium">
                        {formatCurrency(cat.totalAmount)}
                      </td>
                      <td className="px-3 py-2 text-right">{cat.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{expenses.expenseCount}</td>
                    <td className="px-3 py-2 text-right text-red-600">{formatCurrency(totalExpenses)}</td>
                    <td className="px-3 py-2 text-right">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Daily Breakdown */}
        {Array.isArray(dailyBreakdown) && dailyBreakdown.length > 0 && (
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Daily Breakdown</h4>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full text-xs sm:text-sm min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Sales</th>
                    <th className="px-3 py-2 text-right">Gross Profit</th>
                    <th className="px-3 py-2 text-right">Collections</th>
                    <th className="px-3 py-2 text-right">Expenses</th>
                    <th className="px-3 py-2 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dailyBreakdown.map((day: any) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{day.date}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(day.salesIncome)}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(day.grossProfit)}</td>
                      <td className="px-3 py-2 text-right text-purple-600">{formatCurrency(day.collectionsIncome)}</td>
                      <td className="px-3 py-2 text-right text-red-600">({formatCurrency(day.totalExpenses)})</td>
                      <td className={`px-3 py-2 text-right font-semibold ${day.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {day.netProfit >= 0 ? '' : '-'}{formatCurrency(Math.abs(day.netProfit))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSalesByHour = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No sales data for this period</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Hour</th>
              <th className="px-3 py-2 text-right">Transactions</th>
              <th className="px-3 py-2 text-right">Total Sales</th>
              <th className="px-3 py-2 text-right">Profit</th>
              <th className="px-3 py-2 text-right">Avg per Sale</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.hour} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.hour}:00 - {row.hour}:59</td>
                <td className="px-3 py-2 text-right">{row.transactionCount}</td>
                <td className="px-3 py-2 text-right font-medium">{parseFloat(row.totalSales).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-600">{parseFloat(row.totalProfit).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.avgSaleAmount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSalesByCashier = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No sales data for this period</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Cashier</th>
              <th className="px-3 py-2 text-right">Transactions</th>
              <th className="px-3 py-2 text-right">Total Sales</th>
              <th className="px-3 py-2 text-right">Profit</th>
              <th className="px-3 py-2 text-right">Cash</th>
              <th className="px-3 py-2 text-right">Card</th>
              <th className="px-3 py-2 text-right">Mobile</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.cashierId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.cashierName}</td>
                <td className="px-3 py-2 text-right">{row.transactionCount}</td>
                <td className="px-3 py-2 text-right font-medium">{parseFloat(row.totalSales).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-600">{parseFloat(row.totalProfit).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.cashSales || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.cardSales || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.mobileSales || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSalesTrends = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No sales data for this period</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-right">Sales</th>
              <th className="px-3 py-2 text-right">Transactions</th>
              <th className="px-3 py-2 text-right">Profit</th>
              <th className="px-3 py-2 text-right">7-Day Avg</th>
              <th className="px-3 py-2 text-right">Growth</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.date} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{new Date(row.date).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right font-medium">{parseFloat(row.totalSales).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{row.transactionCount}</td>
                <td className="px-3 py-2 text-right text-green-600">{parseFloat(row.totalProfit).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-gray-500">{row.movingAvg7Day ? parseFloat(row.movingAvg7Day).toLocaleString() : '-'}</td>
                <td className="px-3 py-2 text-right">
                  {row.growthPercent !== null && row.growthPercent !== undefined ? (
                    <span className={parseFloat(row.growthPercent) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {parseFloat(row.growthPercent) >= 0 ? '+' : ''}{parseFloat(row.growthPercent).toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPaymentMethods = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No sales data for this period</div>;
    }
    const total = reportData.reduce((sum: number, row: any) => sum + parseFloat(row.totalAmount || 0), 0);
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Payment Method</th>
              <th className="px-3 py-2 text-right">Transactions</th>
              <th className="px-3 py-2 text-right">Total Amount</th>
              <th className="px-3 py-2 text-right">% of Total</th>
              <th className="px-3 py-2 text-right">Avg per Sale</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.paymentMethod} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.paymentMethod}</td>
                <td className="px-3 py-2 text-right">{row.transactionCount}</td>
                <td className="px-3 py-2 text-right font-medium">{parseFloat(row.totalAmount).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{((parseFloat(row.totalAmount) / total) * 100).toFixed(1)}%</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.avgAmount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100 font-medium">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{reportData.reduce((sum: number, row: any) => sum + parseInt(row.transactionCount || 0), 0)}</td>
              <td className="px-3 py-2 text-right">{total.toLocaleString()}</td>
              <td className="px-3 py-2 text-right">100%</td>
              <td className="px-3 py-2 text-right">-</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderInventoryMovements = () => {
    if (!reportData) return <div className="text-center py-12 text-gray-500">No movement data</div>;
    const { movements, summary } = reportData;
    return (
      <div>
        {summary && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600">Total IN</div>
              <div className="text-2xl font-bold text-green-700">{parseFloat(summary.totalIn || 0).toLocaleString()}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-red-600">Total OUT</div>
              <div className="text-2xl font-bold text-red-700">{parseFloat(summary.totalOut || 0).toLocaleString()}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600">Net Change</div>
              <div className="text-2xl font-bold text-blue-700">{parseFloat(summary.netChange || 0).toLocaleString()}</div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-xs sm:text-sm min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-left">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(movements || []).map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 font-medium">{row.productName}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${row.movementType?.includes('IN') || row.movementType === 'GOODS_RECEIPT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {row.movementType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{parseFloat(row.quantity).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{row.referenceType || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSlowMoving = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-green-600">No slow-moving products found 👍</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">Qty on Hand</th>
              <th className="px-3 py-2 text-right">Last Sale</th>
              <th className="px-3 py-2 text-right">Days Since Sale</th>
              <th className="px-3 py-2 text-right">Stock Value</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-gray-500 font-mono text-xs">{row.sku}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.quantityOnHand).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{row.lastSaleDate ? new Date(row.lastSaleDate).toLocaleDateString() : 'Never'}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-1 rounded text-xs ${parseInt(row.daysSinceLastSale) > 60 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {row.daysSinceLastSale || '∞'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{parseFloat(row.stockValue || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFastMoving = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No sales data for this period</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Qty Sold</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Profit</th>
              <th className="px-3 py-2 text-right">Current Stock</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.productId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.productName}</td>
                <td className="px-3 py-2 text-right font-medium">{parseFloat(row.totalQuantitySold).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.totalRevenue).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-green-600">{parseFloat(row.totalProfit).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.currentStock || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    row.stockAlert === 'REORDER_NOW' ? 'bg-red-100 text-red-700' :
                    row.stockAlert === 'REORDER_SOON' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {row.stockAlert || 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderExpiringStock = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-green-600">No expiring stock found 👍</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Batch</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-left">Expiry Date</th>
              <th className="px-3 py-2 text-right">Days Left</th>
              <th className="px-3 py-2 text-center">Urgency</th>
              <th className="px-3 py-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.batchId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.productName}</td>
                <td className="px-3 py-2 text-gray-500 font-mono text-xs">{row.batchNumber}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.remainingQuantity).toLocaleString()}</td>
                <td className="px-3 py-2">{new Date(row.expiryDate).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-right">{row.daysUntilExpiry}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded text-xs ${
                    row.urgency === 'EXPIRED' ? 'bg-black text-white' :
                    row.urgency === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                    row.urgency === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {row.urgency}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{parseFloat(row.stockValue || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStockReorder = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-green-600">All stock levels OK 👍</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-right">Current Stock</th>
              <th className="px-3 py-2 text-right">Reorder Level</th>
              <th className="px-3 py-2 text-right">Below By</th>
              <th className="px-3 py-2 text-right">Suggested Order</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-gray-500 font-mono text-xs">{row.sku}</td>
                <td className="px-3 py-2 text-right">
                  <span className={parseFloat(row.quantityOnHand) === 0 ? 'text-red-600 font-bold' : ''}>
                    {parseFloat(row.quantityOnHand).toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{parseFloat(row.reorderLevel).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-red-600">{parseFloat(row.belowReorderBy || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-blue-600 font-medium">{parseFloat(row.suggestedOrderQty || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderInventoryTurnover = () => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return <div className="text-center py-12 text-gray-500">No turnover data available</div>;
    }
    return (
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Units Sold</th>
              <th className="px-3 py-2 text-right">Avg Stock</th>
              <th className="px-3 py-2 text-right">Turnover Ratio</th>
              <th className="px-3 py-2 text-right">Days of Supply</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {reportData.map((row: any) => (
              <tr key={row.productId} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.productName}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.totalSold).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{parseFloat(row.avgStock || 0).toFixed(1)}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`px-2 py-1 rounded text-xs ${
                    parseFloat(row.turnoverRatio) > 5 ? 'bg-green-100 text-green-700' :
                    parseFloat(row.turnoverRatio) > 2 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {parseFloat(row.turnoverRatio || 0).toFixed(2)}x
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{row.daysOfSupply || '∞'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Check if report needs date range filters
  const needsDateRange = ['salesDetails', 'salesSummary', 'salesByHour', 'salesByCashier', 'salesTrends', 'paymentMethods', 'profitLoss', 'bestSelling', 'invoices', 'voided', 'refunds', 'inventoryMovements', 'fastMoving', 'inventoryTurnover', 'discounts', 'discountsByCashier', 'paymentsReceived', 'dailyCollections', 'expenseSummary', 'expenseByCategory', 'incomeVsExpense'].includes(selectedReport);
  const needsSingleDate = selectedReport === 'dailySales';
  const needsDaysFilter = ['slowMoving', 'expiringStock'].includes(selectedReport);

  return (
    <div className="p-3 sm:p-6">
      {/* Header with mobile menu toggle */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Reports & Analytics</h1>
        <button 
          onClick={() => setShowSidebar(!showSidebar)}
          className="lg:hidden bg-blue-600 text-white px-3 py-2 rounded-lg text-sm"
        >
          {showSidebar ? '✕ Close' : '☰ Reports'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Sidebar - Collapsible on mobile */}
        <div className={`lg:col-span-1 ${showSidebar ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <h2 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Select Report</h2>
            <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
              {reportCategories.map(category => {
                const categoryReports = getReportsByCategory(category.id);
                const isExpanded = expandedCategories.has(category.id);
                const colorClasses = getCategoryColorClass(category.color);
                const hasSelectedReport = categoryReports.some(r => r.id === selectedReport);
                
                return (
                  <div key={category.id} className="border rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                        hasSelectedReport ? `${colorClasses.bg} ${colorClasses.border} border-l-4` : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{category.icon}</span>
                        <span className={`text-sm font-medium ${hasSelectedReport ? colorClasses.text : 'text-gray-700'}`}>
                          {category.name}
                        </span>
                        <span className="text-xs text-gray-400">({categoryReports.length})</span>
                      </div>
                      <span className={`text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>
                    
                    {/* Category Reports */}
                    {isExpanded && (
                      <div className="border-t bg-white">
                        {categoryReports.map(report => (
                          <button
                            key={report.id}
                            onClick={() => {
                              setSelectedReport(report.id as ReportType);
                              setReportData(null);
                              setShowSidebar(false);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-l-2 ${
                              selectedReport === report.id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : `border-transparent hover:${colorClasses.bg} hover:border-${category.color}-300`
                            }`}
                            title={report.description}
                          >
                            <span className="text-sm">{report.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs sm:text-sm block truncate">{report.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 sm:gap-4 items-end">
              {needsDateRange && (
                <>
                  <div className="flex-1 min-w-[140px]">
                    <label htmlFor="report-start-date" className="block text-xs sm:text-sm font-medium mb-1">Start Date</label>
                    <input
                      id="report-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2 sm:px-3 py-2 border rounded-lg text-sm"
                      title="Select start date for report"
                    />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label htmlFor="report-end-date" className="block text-xs sm:text-sm font-medium mb-1">End Date</label>
                    <input
                      id="report-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2 sm:px-3 py-2 border rounded-lg text-sm"
                      title="Select end date for report"
                    />
                  </div>
                </>
              )}

              {needsSingleDate && (
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="report-single-date" className="block text-xs sm:text-sm font-medium mb-1">Date</label>
                  <input
                    id="report-single-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-2 sm:px-3 py-2 border rounded-lg text-sm"
                    title="Select date for report"
                  />
                </div>
              )}

              {needsDaysFilter && (
                <div className="flex-1 min-w-[140px]">
                  <label htmlFor="report-days-filter" className="block text-xs sm:text-sm font-medium mb-1">Days</label>
                  <select
                    id="report-days-filter"
                    value={daysFilter}
                    onChange={(e) => setDaysFilter(parseInt(e.target.value))}
                    className="w-full px-2 sm:px-3 py-2 border rounded-lg text-sm"
                    title="Select number of days to include in report"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={60}>Last 60 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                </div>
              )}

              <div className="flex flex-wrap gap-2 col-span-full sm:col-span-1">
                <button
                  onClick={loadReport}
                  disabled={loading}
                  className="flex-1 sm:flex-none bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {loading ? 'Loading...' : '📊 Generate'}
                </button>
                {reportData && (
                  <>
                    <button
                      onClick={exportToPDF}
                      className="flex-1 sm:flex-none bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                    >
                      📄 PDF
                    </button>
                    <button
                      onClick={exportToCSV}
                      className="flex-1 sm:flex-none bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                    >
                      📊 CSV
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 pb-2 border-b">
              {reports.find(r => r.id === selectedReport)?.name}
            </h2>
            <div ref={reportContentRef} className="overflow-x-auto -mx-3 sm:mx-0">
              {renderReportContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
