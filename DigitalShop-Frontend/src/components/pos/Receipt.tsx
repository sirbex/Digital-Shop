import { forwardRef } from 'react';
import Decimal from 'decimal.js';
import { useSettings } from '../../contexts/SettingsContext';
import '../../styles/receipt.css';

/**
 * Professional Receipt Component
 * Complies with:
 * - Uganda Revenue Authority (URA) receipt requirements
 * - East African Community (EAC) tax regulations
 * - ISO standards for thermal receipt printing (80mm width)
 * - Accessibility standards (WCAG 2.1)
 */

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
  taxAmount?: number;
}

interface PaymentDetail {
  method: string;
  amount: number;
  reference?: string;
}

interface ReceiptProps {
  saleNumber: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount?: number; // Total discount applied to the sale
  taxAmount: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  amountTendered?: number; // Amount given by customer (can be more than total)
  change?: number;
  customerName?: string;
  cashierName?: string;
  balanceDue?: number; // Outstanding balance (for credit sales)
  payments?: PaymentDetail[]; // For split payments
  companyInfo?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    tin?: string; // Tax Identification Number (mandatory in Uganda)
    businessRegistration?: string;
    vatRegistered?: boolean;
  };
}

export interface ReceiptRef {
  getElement: () => HTMLDivElement | null;
}

/**
 * Professional Receipt Component
 * Optimized for 80mm thermal printers (302 pixels @ 96 DPI)
 * Meets URA compliance requirements
 */
export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  (
    {
      saleNumber,
      date,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      total,
      paymentMethod,
      amountPaid,
      amountTendered,
      change,
      customerName,
      cashierName,
      balanceDue,
      payments,
      companyInfo: companyInfoProp,
    },
    ref
  ) => {
    const { settings } = useSettings();
    
    // Merge company info: prop overrides > settings > hardcoded defaults
    const companyInfo = companyInfoProp || {
      name: settings.businessName || 'DigitalShop',
      address: settings.businessAddress || '',
      phone: settings.businessPhone || '',
      email: settings.businessEmail || '',
      tin: settings.taxNumber || '',
      vatRegistered: settings.taxEnabled,
    };

    // Currency symbol from settings
    const cs = settings.currencySymbol || 'UGX';

    // Precision currency formatter using Decimal.js
    const formatCurrency = (amount: number): string => {
      const decimal = new Decimal(amount);
      return decimal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    // Standard date formatter (EAT - UTC+3)
    const formatDate = (dateString: string): string => {
      const d = new Date(dateString);
      return d.toLocaleString('en-UG', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Kampala',
      });
    };

    // Calculate tax rate percentage
    const taxRate = subtotal > 0 ? new Decimal(taxAmount).dividedBy(subtotal).times(100).toFixed(1) : '0';

    return (
      <div
        ref={ref}
        className="receipt-container rcpt-root bg-white text-black"
        role="document"
        aria-label="Sales Receipt"
      >
        {/* ============================================
            HEADER SECTION - Company Information
            ============================================ */}
        <header className="text-center mb-3 pb-3 rcpt-header">
          {/* Company Name */}
          <h1
            className="font-bold uppercase mb-2 rcpt-company-name"
          >
            {companyInfo.name}
          </h1>

          {/* Address */}
          {companyInfo.address && (
            <p
              className="text-center whitespace-pre-line mb-1 rcpt-address"
            >
              {companyInfo.address}
            </p>
          )}

          {/* Contact Information */}
          <div className="text-center rcpt-contact">
            {companyInfo.phone && (
              <p className="rcpt-contact-line">
                <strong>Tel:</strong> {companyInfo.phone}
              </p>
            )}
            {companyInfo.email && (
              <p className="rcpt-contact-line">
                <strong>Email:</strong> {companyInfo.email}
              </p>
            )}
          </div>

          {/* Tax Information (URA Compliance) */}
          {companyInfo.tin && (
            <div
              className="text-center mt-2 pt-2 rcpt-tax-info"
            >
              <p className="rcpt-contact-line">
                <strong>TIN:</strong> {companyInfo.tin}
              </p>
              {companyInfo.vatRegistered && (
                <p className="rcpt-m0">
                  <strong>VAT REGISTERED</strong>
                </p>
              )}
            </div>
          )}
        </header>

        {/* ============================================
            RECEIPT TYPE BANNER
            ============================================ */}
        <div
          className="text-center font-bold uppercase py-2 mb-3 rcpt-banner"
        >
          TAX INVOICE / RECEIPT
        </div>

        {/* ============================================
            TRANSACTION DETAILS
            ============================================ */}
        <section className="mb-3 pb-2 rcpt-section-bordered">
          <table className="rcpt-table">
            <tbody>
              <tr>
                <td className="rcpt-cell-w40">
                  <strong>Receipt No:</strong>
                </td>
                <td className="rcpt-cell-right-bold">{saleNumber}</td>
              </tr>
              <tr>
                <td className="rcpt-cell">
                  <strong>Date & Time:</strong>
                </td>
                <td className="rcpt-cell-right-bold">{formatDate(date)}</td>
              </tr>
              {customerName && (
                <tr>
                  <td className="rcpt-cell">
                    <strong>Customer:</strong>
                  </td>
                  <td className="rcpt-cell-right-upper-bold">
                    {customerName}
                  </td>
                </tr>
              )}
              {cashierName && (
                <tr>
                  <td className="rcpt-cell">
                    <strong>Served By:</strong>
                  </td>
                  <td className="rcpt-cell-right-bold">{cashierName}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* ============================================
            ITEMS TABLE
            ============================================ */}
        <section className="mb-3">
          <table className="rcpt-items-table">
            {/* Table Header */}
            <thead>
              <tr className="rcpt-items-header-row">
                <th className="rcpt-th-item">
                  ITEM
                </th>
                <th className="rcpt-th-qty">
                  QTY
                </th>
                <th className="rcpt-th-price">
                  PRICE
                </th>
                <th className="rcpt-th-total">
                  TOTAL
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="rcpt-item-row">
                  <td className="rcpt-td-name">
                    {item.productName}
                    {item.discount !== undefined && item.discount > 0 && (
                      <div className="rcpt-discount-note">
                        Disc: -{formatCurrency(item.discount)}
                      </div>
                    )}
                  </td>
                  <td className="rcpt-td-qty">
                    {item.quantity}
                  </td>
                  <td className="rcpt-td-price">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="rcpt-td-amount">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ============================================
            TOTALS SECTION
            ============================================ */}
        <section className="mb-3 pb-2 rcpt-totals-section">
          <table className="rcpt-totals-table">
            <tbody>
              {/* Subtotal */}
              <tr>
                <td className="rcpt-td-label">
                  <strong>SUBTOTAL:</strong>
                </td>
                <td className="rcpt-td-value">
                  {cs} {formatCurrency(subtotal)}
                </td>
              </tr>

              {/* Discount */}
              {discountAmount !== undefined && discountAmount > 0 && (
                <tr>
                  <td className="rcpt-td-label-red">
                    <strong>DISCOUNT:</strong>
                  </td>
                  <td className="rcpt-td-value-red">
                    -{cs} {formatCurrency(discountAmount)}
                  </td>
                </tr>
              )}

              {/* Tax */}
              {taxAmount > 0 && (
                <tr>
                  <td className="rcpt-td-label">
                    <strong>VAT ({taxRate}%):</strong>
                  </td>
                  <td className="rcpt-td-value">
                    {cs} {formatCurrency(taxAmount)}
                  </td>
                </tr>
              )}

              {/* Grand Total */}
              <tr className="rcpt-grand-total-row">
                <td className="rcpt-grand-total-label">
                  TOTAL:
                </td>
                <td className="rcpt-grand-total-value">
                  {cs} {formatCurrency(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ============================================
            PAYMENT INFORMATION
            ============================================ */}
        <section className="mb-3 pb-2 rcpt-payment-section">
          <table className="rcpt-payment-table">
            <tbody>
              {/* Show multiple payment methods if split payment */}
              {payments && payments.length > 1 ? (
                <>
                  <tr>
                    <td colSpan={2} className="rcpt-payment-methods-label">
                      Payment Methods:
                    </td>
                  </tr>
                  {payments.map((payment, idx) => (
                    <tr key={idx}>
                      <td className="rcpt-split-label">
                        {payment.method === 'CREDIT' ? 'Balance Due' : payment.method}:
                      </td>
                      <td className="rcpt-split-value">
                        {cs} {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                /* Single Payment Method */
                <tr>
                  <td className="rcpt-td-label">
                    <strong>Payment Method:</strong>
                  </td>
                  <td className="rcpt-payment-method-value">
                    {paymentMethod}
                  </td>
                </tr>
              )}

              {/* Amount Tendered (what customer gave) - show when customer gives more than total */}
              {(amountTendered !== undefined && amountTendered > total) && (
                <tr>
                  <td className="rcpt-td-label">
                    <strong>Amount Tendered:</strong>
                  </td>
                  <td className="rcpt-td-value">
                    {cs} {formatCurrency(amountTendered)}
                  </td>
                </tr>
              )}

              {/* Amount Paid - show when it differs from total (partial payment or overpayment) */}
              {amountPaid !== undefined && amountPaid !== total && !amountTendered && (
                <tr>
                  <td className="rcpt-td-label">
                    <strong>Amount Paid:</strong>
                  </td>
                  <td className="rcpt-td-value">
                    {cs} {formatCurrency(amountPaid)}
                  </td>
                </tr>
              )}

              {/* Change - prominently displayed when customer gets change back */}
              {change !== undefined && change > 0 && (
                <tr className="rcpt-change-row">
                  <td className="rcpt-change-label">
                    CHANGE DUE:
                  </td>
                  <td className="rcpt-change-value">
                    {cs} {formatCurrency(change)}
                  </td>
                </tr>
              )}

              {/* Balance Due - show for credit sales */}
              {balanceDue !== undefined && balanceDue > 0 && (
                <tr className="rcpt-balance-row">
                  <td className="rcpt-balance-label">
                    BALANCE DUE:
                  </td>
                  <td className="rcpt-balance-value">
                    {cs} {formatCurrency(balanceDue)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* ============================================
            FOOTER - Terms & Conditions
            ============================================ */}
        <footer
          className="text-center pt-3 mt-3 rcpt-footer"
        >
          <p className="rcpt-thank-you">
            THANK YOU FOR YOUR BUSINESS!
          </p>

          <p className="rcpt-terms">
            All goods sold are not returnable unless faulty
          </p>

          <p className="rcpt-terms">
            For inquiries: {companyInfo.phone}
          </p>

          <div className="rcpt-powered-by">
            <p className="rcpt-powered-text">Powered by {settings.businessName} POS</p>
            {settings.businessEmail && <p className="rcpt-powered-text">{settings.businessEmail}</p>}
          </div>
        </footer>

        {/* ============================================
            PRINT-SPECIFIC STYLES
            Optimized for 80mm thermal printers
            ============================================ */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            /* Page Setup */
            @page {
              size: 80mm auto;
              margin: 0;
            }

            /* Reset margins */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              width: 80mm;
            }

            /* Receipt Container */
            .receipt-container {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 5mm !important;
              background: #fff !important;
              color: #000 !important;
              font-family: "Courier New", Courier, monospace !important;
            }

            /* Force black text */
            * {
              color: #000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            /* Ensure backgrounds print */
            header, section, footer {
              page-break-inside: avoid !important;
            }

            /* Table borders */
            table {
              border-collapse: collapse !important;
            }

            /* Remove unnecessary spacing */
            .no-print {
              display: none !important;
            }

            /* Ensure monospace alignment */
            td, th {
              font-family: "Courier New", Courier, monospace !important;
            }
          }

          /* Screen View Optimization */
          @media screen {
            .receipt-container {
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              border: 1px solid #ddd;
              border-radius: 4px;
            }
          }
        `,
          }}
        />
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';

