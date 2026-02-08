import { useCallback, useRef } from 'react';

/**
 * Custom hook for printing receipt components
 * Provides print functionality with browser print dialog
 */
export function usePrint() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!printRef.current) {
      console.error('Print reference not set');
      return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      console.error('Failed to open print window. Check popup blocker settings.');
      return;
    }

    // Get the HTML content to print
    const printContent = printRef.current.innerHTML;

    // Write the content to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Receipt</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 20px;
            }
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .receipt-container {
                width: 80mm;
                margin: 0 auto;
                padding: 10mm;
              }
            }
            .receipt-container {
              max-width: 80mm;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      
      // Close window after printing (optional)
      setTimeout(() => {
        printWindow.close();
      }, 100);
    };
  }, []);

  return {
    printRef,
    handlePrint,
  };
}
