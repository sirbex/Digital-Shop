// Inline styles are intentional for thermal receipt printing compatibility
// External CSS doesn't reliably render in print contexts (required for thermal printers)
import { forwardRef } from 'react';
import Decimal from 'decimal.js';

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
      companyInfo = {
        name: 'BRIGS TECHNOLOGY CONSULT LTD',
        address: 'William Street, Plot 27B, Kampala\nP.O. Box 1654, Uganda',
        phone: '+256 773 452 271 | +256 393 194 020',
        email: 'brigstechnologies@gmail.com',
        tin: '1000348899', // URA TIN format
        vatRegistered: true,
      },
    },
    ref
  ) => {
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
        className="receipt-container bg-white text-black"
        style={{
          width: '80mm',
          maxWidth: '80mm',
          minHeight: 'auto',
          margin: '0 auto',
          padding: '6mm',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '12px',
          lineHeight: '1.5',
          color: '#000',
        }}
        role="document"
        aria-label="Sales Receipt"
      >
        {/* ============================================
            HEADER SECTION - Company Information
            ============================================ */}
        <header className="text-center mb-3 pb-3" style={{ borderBottom: '2px solid #000' }}>
          {/* Company Name */}
          <h1
            className="font-bold uppercase mb-2"
            style={{
              fontSize: '18px',
              lineHeight: '1.2',
              letterSpacing: '0.5px',
              margin: '0 0 8px 0',
            }}
          >
            {companyInfo.name}
          </h1>

          {/* Address */}
          {companyInfo.address && (
            <p
              className="text-center whitespace-pre-line mb-1"
              style={{ fontSize: '11px', lineHeight: '1.4', margin: '0 0 4px 0', fontWeight: 'bold' }}
            >
              {companyInfo.address}
            </p>
          )}

          {/* Contact Information */}
          <div className="text-center" style={{ fontSize: '11px', margin: '4px 0' }}>
            {companyInfo.phone && (
              <p style={{ margin: '0 0 2px 0' }}>
                <strong>Tel:</strong> {companyInfo.phone}
              </p>
            )}
            {companyInfo.email && (
              <p style={{ margin: '0 0 2px 0' }}>
                <strong>Email:</strong> {companyInfo.email}
              </p>
            )}
          </div>

          {/* Tax Information (URA Compliance) */}
          {companyInfo.tin && (
            <div
              className="text-center mt-2 pt-2"
              style={{
                borderTop: '1px dashed #666',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              <p style={{ margin: '0 0 2px 0' }}>
                <strong>TIN:</strong> {companyInfo.tin}
              </p>
              {companyInfo.vatRegistered && (
                <p style={{ margin: '0' }}>
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
          className="text-center font-bold uppercase py-2 mb-3"
          style={{
            backgroundColor: '#000',
            color: '#fff',
            fontSize: '18px',
            letterSpacing: '2px',
            margin: '0 -6mm',
            padding: '8px 0',
          }}
        >
          TAX INVOICE / RECEIPT
        </div>

        {/* ============================================
            TRANSACTION DETAILS
            ============================================ */}
        <section className="mb-3 pb-2" style={{ borderBottom: '1px solid #666', fontSize: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '2px 0', width: '40%' }}>
                  <strong>Receipt No:</strong>
                </td>
                <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold' }}>{saleNumber}</td>
              </tr>
              <tr>
                <td style={{ padding: '2px 0' }}>
                  <strong>Date & Time:</strong>
                </td>
                <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold' }}>{formatDate(date)}</td>
              </tr>
              {customerName && (
                <tr>
                  <td style={{ padding: '2px 0' }}>
                    <strong>Customer:</strong>
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {customerName}
                  </td>
                </tr>
              )}
              {cashierName && (
                <tr>
                  <td style={{ padding: '2px 0' }}>
                    <strong>Served By:</strong>
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold' }}>{cashierName}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* ============================================
            ITEMS TABLE
            ============================================ */}
        <section className="mb-3">
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '16px',
              marginBottom: '8px',
            }}
          >
            {/* Table Header */}
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '4px 2px',
                    fontWeight: 'bold',
                    width: '45%',
                  }}
                >
                  ITEM
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '4px 2px',
                    fontWeight: 'bold',
                    width: '10%',
                  }}
                >
                  QTY
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '4px 2px',
                    fontWeight: 'bold',
                    width: '22%',
                  }}
                >
                  PRICE
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '4px 2px',
                    fontWeight: 'bold',
                    width: '23%',
                  }}
                >
                  TOTAL
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {items.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px dotted #999' }}>
                  <td
                    style={{
                      padding: '4px 2px',
                      verticalAlign: 'top',
                      wordBreak: 'break-word',
                      lineHeight: '1.3',
                      fontWeight: 'bold',
                    }}
                  >
                    {item.productName}
                    {item.discount !== undefined && item.discount > 0 && (
                      <div style={{ fontSize: '11px', color: '#c00', fontWeight: 'normal', fontStyle: 'italic' }}>
                        Disc: -{formatCurrency(item.discount)}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      padding: '4px 2px',
                      verticalAlign: 'top',
                      fontWeight: 'bold',
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '4px 2px',
                      verticalAlign: 'top',
                      whiteSpace: 'nowrap',
                      fontWeight: 'bold',
                    }}
                  >
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '4px 2px',
                      verticalAlign: 'top',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                    }}
                  >
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
        <section className="mb-3 pb-2" style={{ borderTop: '2px solid #000', paddingTop: '8px' }}>
          <table style={{ width: '100%', fontSize: '18px', borderCollapse: 'collapse' }}>
            <tbody>
              {/* Subtotal */}
              <tr>
                <td style={{ padding: '2px 0', textAlign: 'right', paddingRight: '8px' }}>
                  <strong>SUBTOTAL:</strong>
                </td>
                <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold', width: '35%' }}>
                  UGX {formatCurrency(subtotal)}
                </td>
              </tr>

              {/* Discount */}
              {discountAmount !== undefined && discountAmount > 0 && (
                <tr>
                  <td style={{ padding: '2px 0', textAlign: 'right', paddingRight: '8px', color: '#c00' }}>
                    <strong>DISCOUNT:</strong>
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold', color: '#c00' }}>
                    -UGX {formatCurrency(discountAmount)}
                  </td>
                </tr>
              )}

              {/* Tax */}
              {taxAmount > 0 && (
                <tr>
                  <td style={{ padding: '2px 0', textAlign: 'right', paddingRight: '8px' }}>
                    <strong>VAT ({taxRate}%):</strong>
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold' }}>
                    UGX {formatCurrency(taxAmount)}
                  </td>
                </tr>
              )}

              {/* Grand Total */}
              <tr style={{ borderTop: '2px solid #000' }}>
                <td
                  style={{
                    padding: '6px 8px 6px 0',
                    textAlign: 'right',
                    fontSize: '20px',
                    fontWeight: 'bold',
                  }}
                >
                  TOTAL:
                </td>
                <td
                  style={{
                    padding: '6px 0',
                    textAlign: 'right',
                    fontSize: '20px',
                    fontWeight: 'bold',
                  }}
                >
                  UGX {formatCurrency(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ============================================
            PAYMENT INFORMATION
            ============================================ */}
        <section className="mb-3 pb-2" style={{ borderTop: '1px solid #666', paddingTop: '8px' }}>
          <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
            <tbody>
              {/* Show multiple payment methods if split payment */}
              {payments && payments.length > 1 ? (
                <>
                  <tr>
                    <td colSpan={2} style={{ padding: '2px 0', fontWeight: 'bold', fontSize: '13px' }}>
                      Payment Methods:
                    </td>
                  </tr>
                  {payments.map((payment, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '2px 0 2px 8px', textAlign: 'right', paddingRight: '8px' }}>
                        {payment.method === 'CREDIT' ? 'Balance Due' : payment.method}:
                      </td>
                      <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold', width: '35%' }}>
                        UGX {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                /* Single Payment Method */
                <tr>
                  <td style={{ padding: '2px 0', textAlign: 'right', paddingRight: '8px' }}>
                    <strong>Payment Method:</strong>
                  </td>
                  <td
                    style={{
                      padding: '2px 0',
                      textAlign: 'right',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      width: '35%',
                    }}
                  >
                    {paymentMethod}
                  </td>
                </tr>
              )}

              {/* Amount Tendered (what customer gave) - show when customer gives more than total */}
              {(amountTendered !== undefined && amountTendered > total) && (
                <tr>
                  <td style={{ padding: '2px 0', textAlign: 'right', paddingRight: '8px' }}>
                    <strong>Amount Tendered:</strong>
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold' }}>
                    UGX {formatCurrency(amountTendered)}
                  </td>
                </tr>
              )}

              {/* Amount Paid - show when it differs from total (partial payment or overpayment) */}
              {amountPaid !== undefined && amountPaid !== total && !amountTendered && (
                <tr>
                  <td style={{ padding: '2px 0', textAlign: 'right', paddingRight: '8px' }}>
                    <strong>Amount Paid:</strong>
                  </td>
                  <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold' }}>
                    UGX {formatCurrency(amountPaid)}
                  </td>
                </tr>
              )}

              {/* Change - prominently displayed when customer gets change back */}
              {change !== undefined && change > 0 && (
                <tr style={{ borderTop: '2px solid #000', backgroundColor: '#f0f0f0' }}>
                  <td
                    style={{
                      padding: '6px 8px 6px 0',
                      textAlign: 'right',
                      fontSize: '18px',
                      fontWeight: 'bold',
                    }}
                  >
                    CHANGE DUE:
                  </td>
                  <td
                    style={{
                      padding: '6px 0',
                      textAlign: 'right',
                      fontSize: '18px',
                      fontWeight: 'bold',
                    }}
                  >
                    UGX {formatCurrency(change)}
                  </td>
                </tr>
              )}

              {/* Balance Due - show for credit sales */}
              {balanceDue !== undefined && balanceDue > 0 && (
                <tr style={{ borderTop: '2px solid #000', backgroundColor: '#fff3cd' }}>
                  <td
                    style={{
                      padding: '6px 8px 6px 0',
                      textAlign: 'right',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#856404',
                    }}
                  >
                    BALANCE DUE:
                  </td>
                  <td
                    style={{
                      padding: '6px 0',
                      textAlign: 'right',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#856404',
                    }}
                  >
                    UGX {formatCurrency(balanceDue)}
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
          className="text-center pt-3 mt-3"
          style={{
            borderTop: '2px double #000',
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '16px' }}>
            THANK YOU FOR YOUR BUSINESS!
          </p>

          <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>
            All goods sold are not returnable unless faulty
          </p>

          <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>
            For inquiries: {companyInfo.phone}
          </p>

          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px dashed #999',
              fontSize: '12px',
              color: '#666',
            }}
          >
            <p style={{ margin: '0' }}>Powered by DigitalShop POS System</p>
            <p style={{ margin: '0' }}>www.digitalshop.ug</p>
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
