import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { inventoryApi } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';
import POSSearchBar from './POSSearchBar';
import POSButton from './POSButton';
import POSModal from './POSModal';

// TIMEZONE STRATEGY: Display dates without conversion
const formatDisplayDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }
  return dateString;
};

const formatCurrencyBase = (amount: number, symbol: string = 'UGX') => `${symbol} ${amount.toLocaleString()}`;

interface ProductUom {
  uomId: string;
  name: string;
  symbol?: string;
  conversionFactor: number;
  price: number;
  cost: number;
  isDefault: boolean;
}

interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  stockOnHand: number;
  costPrice: number;
  sellingPrice: number;
  marginPct: number;
  isTaxable: boolean;
  taxRate: number;
  expiryDate?: string;
  uoms?: ProductUom[];
  selectedUom?: ProductUom;
}

interface POSProductSearchProps {
  onSelect: (product: ProductSearchResult) => void;
}

export interface POSProductSearchHandle {
  focusSearch: () => void;
  clearSearch: () => void;
}

const POSProductSearch = forwardRef<POSProductSearchHandle, POSProductSearchProps>(({ onSelect }, ref) => {
  const { settings } = useSettings();
  const formatCurrency = (amount: number) => formatCurrencyBase(amount, settings.currencySymbol);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selected, setSelected] = useState<ProductSearchResult | null>(null);
  const [highlightedUomIndex, setHighlightedUomIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const productListRef = useRef<HTMLDivElement>(null);
  const uomButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    focusSearch: () => searchInputRef.current?.focus(),
    clearSearch: () => {
      setSearch('');
      setProducts([]);
      setSelectedIndex(0);
      setHighlightedUomIndex(0);
    }
  }));

  // Search products with debounce - uses inventory stock levels
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!search || search.length < 1) {
      setProducts([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Get products with stock from inventory API
        const stockRes = await inventoryApi.getStockLevels();
        if (!stockRes.data.success) {
          setProducts([]);
          return;
        }

        const stockLevels = stockRes.data.data || [];
        const term = search.toLowerCase();

        // Filter products that match search term and have stock > 0
        const results = stockLevels
          .filter((item: any) => {
            // Hide products with zero or no stock
            const stock = parseFloat(item.totalQuantity || 0);
            if (stock <= 0) return false;
            
            // Match search term against product name, SKU, or barcode
            return (
              item.productName?.toLowerCase().includes(term) ||
              item.sku?.toLowerCase().includes(term) ||
              item.barcode?.toLowerCase().includes(term)
            );
          })
          .map((item: any) => {
            const sellingPrice = parseFloat(item.sellingPrice || 0);
            const averageCost = parseFloat(item.averageCost || 0);
            const marginPct = sellingPrice > 0
              ? ((sellingPrice - averageCost) / sellingPrice * 100)
              : 0;

            // Parse UoMs from backend
            let uoms: ProductUom[] = item.uoms || [];

            // If no UoMs defined, create a default fallback
            if (!uoms || uoms.length === 0) {
              uoms = [{
                uomId: `default-${item.productId}`,
                name: 'PIECE',
                symbol: 'PIECE',
                conversionFactor: 1,
                isDefault: true,
                price: sellingPrice,
                cost: averageCost
              }];
            }

            // Get default UOM for display
            const defaultUom = uoms.find((u: ProductUom) => u.isDefault) || uoms[0];

            return {
              id: item.productId,
              name: item.productName,
              sku: item.sku || '',
              barcode: item.barcode || '',
              stockOnHand: parseFloat(item.totalQuantity || 0),
              expiryDate: item.nearestExpiry,
              costPrice: averageCost,
              sellingPrice: sellingPrice,
              marginPct: marginPct,
              isTaxable: item.isTaxable ?? false,
              taxRate: parseFloat(item.taxRate || 0),
              uoms: uoms,
              unitOfMeasure: defaultUom?.symbol || defaultUom?.name || 'PIECE',
            };
          });

        setProducts(results);
      } catch (error) {
        console.error('Search failed:', error);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Auto-focus search bar on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [products]);

  // Global keyboard navigation handler - matches SamplePOS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if UoM modal is open
      if (selected) return;

      // Check if any dialog/modal is open
      const overlays = document.querySelectorAll('[data-radix-dialog-overlay], [role="dialog"]');
      if (overlays.length > 0) return;

      // "/" key refocuses search bar
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Only handle arrow keys and Enter when search has results
      if (!products || products.length === 0) return;

      // Arrow Down: Navigate down the product list
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = Math.min(prev + 1, products.length - 1);
          // Scroll selected item into view
          setTimeout(() => {
            const container = productListRef.current;
            const selectedItem = container?.children[newIndex] as HTMLElement;
            if (selectedItem && container) {
              const containerRect = container.getBoundingClientRect();
              const itemRect = selectedItem.getBoundingClientRect();
              if (itemRect.bottom > containerRect.bottom) {
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }, 0);
          return newIndex;
        });
        return;
      }

      // Arrow Up: Navigate up the product list
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = Math.max(prev - 1, 0);
          // Scroll selected item into view
          setTimeout(() => {
            const container = productListRef.current;
            const selectedItem = container?.children[newIndex] as HTMLElement;
            if (selectedItem && container) {
              const containerRect = container.getBoundingClientRect();
              const itemRect = selectedItem.getBoundingClientRect();
              if (itemRect.top < containerRect.top) {
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }, 0);
          return newIndex;
        });
        return;
      }

      // Arrow Right or Enter: Add selected product to cart
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (products && products.length > 0 && selectedIndex >= 0 && selectedIndex < products.length) {
          const selectedProduct = products[selectedIndex];

          // Clear search immediately after selection
          setSearch('');
          setSelectedIndex(0);

          // If product has 0 or 1 UoM, directly select it
          // If product has multiple UoMs, show selection modal
          if (!selectedProduct.uoms || selectedProduct.uoms.length <= 1) {
            onSelect(selectedProduct);
            // Restore focus to search input after adding to cart
            setTimeout(() => searchInputRef.current?.focus(), 0);
          } else {
            setSelected(selectedProduct);
          }
        }
        return;
      }

      // Escape: Clear search
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearch('');
        setSelectedIndex(0);
        searchInputRef.current?.focus();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, selectedIndex, onSelect, selected]);

  // Keyboard navigation for UoM selection modal
  useEffect(() => {
    if (!selected || !selected.uoms || selected.uoms.length === 0) return;

    // Reset highlighted index when modal opens
    setHighlightedUomIndex(0);

    const handleUomKeyDown = (e: KeyboardEvent) => {
      if (!selected) return;

      // Escape: Close modal without selection
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelected(null);
        setTimeout(() => searchInputRef.current?.focus(), 100);
        return;
      }
    };

    window.addEventListener('keydown', handleUomKeyDown);
    return () => window.removeEventListener('keydown', handleUomKeyDown);
  }, [selected]);

  return (
    <div className="relative">
      <POSSearchBar
        value={search}
        onChange={setSearch}
        autoFocus
        inputRef={searchInputRef}
      />
      
      {isLoading && (
        <div className="mt-2 text-xs text-gray-500">Searching...</div>
      )}
      
      {search && products.length > 0 && (
        <div
          ref={productListRef}
          className="absolute z-20 w-full mt-2 bg-white border rounded-lg shadow-lg max-h-[60vh] overflow-y-auto"
        >
          {products.map((product, index) => (
            <button
              key={product.id}
              className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-blue-50 transition-colors ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
              onClick={() => {
                // Clear search immediately
                setSearch('');
                setSelectedIndex(0);

                // If product has 0 or 1 UoM, directly select it
                if (!product.uoms || product.uoms.length <= 1) {
                  onSelect(product);
                  setTimeout(() => searchInputRef.current?.focus(), 0);
                } else {
                  setSelected(product);
                }
              }}
            >
              <div className="font-semibold text-gray-900">{product.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                SKU: {product.sku} {product.barcode && `| Barcode: ${product.barcode}`}
              </div>
              <div className="flex gap-4 text-xs mt-1">
                <span>
                  Stock: <span className={product.stockOnHand <= 5 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                    {product.stockOnHand}
                  </span>
                </span>
                <span className="text-blue-600 font-medium">
                  {formatCurrency(product.sellingPrice)}
                </span>
                <span>
                  Margin: <span className={
                    product.marginPct < 10 ? 'text-red-600' : 
                    product.marginPct < 20 ? 'text-yellow-600' : 'text-green-600'
                  }>
                    {product.marginPct.toFixed(1)}%
                  </span>
                </span>
                {product.expiryDate && (
                  <span className="text-orange-600">
                    Exp: {formatDisplayDate(product.expiryDate)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {search && !isLoading && products.length === 0 && (
        <div className="absolute z-20 w-full mt-2 bg-white border rounded-lg shadow-lg p-4 text-gray-500 text-center">
          No products found matching "{search}"
        </div>
      )}

      {/* UoM Selection Modal - matches SamplePOS */}
      {selected && (
        <POSModal
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }
          }}
          title="Select Unit of Measure"
        >
          <div className="mb-3 font-semibold text-lg text-gray-900">{selected.name}</div>
          <div className="mb-2 text-xs text-gray-500">SKU: {selected.sku} {selected.barcode && `| Barcode: ${selected.barcode}`}</div>
          <div className="mb-2 text-xs text-gray-500">Stock: {selected.stockOnHand}</div>
          {selected.expiryDate && (
            <div className="mb-2 text-xs text-yellow-800 bg-yellow-100 px-2 py-1 rounded">
              Expiring: {formatDisplayDate(selected.expiryDate)}
            </div>
          )}
          <div className="mb-2 text-xs text-gray-500">
            Margin: <span className={selected.marginPct < 10 ? 'text-red-600' : selected.marginPct < 20 ? 'text-yellow-600' : 'text-green-600'}>
              {selected.marginPct.toFixed(1)}%
            </span>
          </div>

          {/* Keyboard navigation hint */}
          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            <div className="font-medium mb-1">⌨️ Keyboard Shortcuts:</div>
            <div className="space-y-0.5 text-blue-700">
              <div>Tab - Navigate between options</div>
              <div>Enter - Select focused option</div>
              <div>Esc - Cancel</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="font-medium text-gray-700 mb-2">Select Unit of Measure</div>
            <div className="flex flex-col gap-2">
              {selected.uoms?.map((uom, index) => (
                <POSButton
                  key={uom.uomId}
                  ref={(el) => { uomButtonRefs.current[index] = el; }}
                  variant={index === highlightedUomIndex ? 'primary' : 'secondary'}
                  onClick={() => {
                    onSelect({ ...selected, selectedUom: uom });
                    setSelected(null);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }}
                  onFocus={() => setHighlightedUomIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSelect({ ...selected, selectedUom: uom });
                      setSelected(null);
                      setTimeout(() => searchInputRef.current?.focus(), 100);
                    }
                  }}
                  className={index === highlightedUomIndex ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                  autoFocus={index === 0}
                >
                  {uom.symbol || uom.name} - {formatCurrency(uom.price)}
                  {uom.isDefault && <span className="ml-2 text-xs">(Default)</span>}
                  <span className="ml-2 text-xs text-gray-500">Stock: {selected.stockOnHand}</span>
                </POSButton>
              ))}
            </div>
          </div>
        </POSModal>
      )}
    </div>
  );
});

POSProductSearch.displayName = 'POSProductSearch';

export default POSProductSearch;
