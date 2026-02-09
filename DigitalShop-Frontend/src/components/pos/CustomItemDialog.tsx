import { useState, useRef, useEffect } from 'react';
import POSModal from './POSModal';
import POSButton from './POSButton';
import { useSettings } from '../../contexts/SettingsContext';
import { Wrench, Package, FileText } from 'lucide-react';

export interface CustomItemData {
  itemType: 'SERVICE' | 'CUSTOM';
  customDescription: string;
  unitPrice: number;
  quantity: number;
}

interface CustomItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: CustomItemData) => void;
}

export function CustomItemDialog({ isOpen, onClose, onAdd }: CustomItemDialogProps) {
  const { settings } = useSettings();
  const descriptionRef = useRef<HTMLInputElement>(null);
  const [itemType, setItemType] = useState<'SERVICE' | 'CUSTOM'>('SERVICE');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState('');

  // Auto-focus description field when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => descriptionRef.current?.focus(), 100);
      setDescription('');
      setPrice('');
      setQuantity('1');
      setError('');
      setItemType('SERVICE');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    setError('');

    if (!description.trim()) {
      setError('Description is required');
      descriptionRef.current?.focus();
      return;
    }

    const parsedPrice = parseFloat(price);
    if (!parsedPrice || parsedPrice <= 0) {
      setError('Price must be greater than zero');
      return;
    }

    const parsedQty = parseInt(quantity) || 1;
    if (parsedQty <= 0) {
      setError('Quantity must be at least 1');
      return;
    }

    onAdd({
      itemType,
      customDescription: description.trim(),
      unitPrice: parsedPrice,
      quantity: parsedQty,
    });

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <POSModal open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} title="Add Custom Item" size="md">
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        {/* Item Type Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setItemType('SERVICE')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                itemType === 'SERVICE'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Wrench className="w-4 h-4" />
              Service
            </button>
            <button
              type="button"
              onClick={() => setItemType('CUSTOM')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                itemType === 'CUSTOM'
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              <Package className="w-4 h-4" />
              Custom Item
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="custom-item-desc" className="block text-sm font-medium text-gray-700 mb-1">
            Description *
          </label>
          <input
            ref={descriptionRef}
            id="custom-item-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={itemType === 'SERVICE' ? 'e.g. Screen Repair - iPhone 13' : 'e.g. USB Cable (walk-in)'}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            maxLength={255}
          />
        </div>

        {/* Price and Quantity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="custom-item-price" className="block text-sm font-medium text-gray-700 mb-1">
              Price ({settings.currencySymbol}) *
            </label>
            <input
              id="custom-item-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              min="0"
              step="100"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="custom-item-qty" className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              id="custom-item-qty"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Preview */}
        {description && price && (
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{description}</div>
              <div className="text-sm text-gray-500">
                {parseInt(quantity) || 1} × {settings.currencySymbol} {parseFloat(price).toLocaleString()} = {settings.currencySymbol} {((parseInt(quantity) || 1) * (parseFloat(price) || 0)).toLocaleString()}
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              itemType === 'SERVICE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {itemType}
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <POSButton variant="secondary" onClick={onClose}>
            Cancel
          </POSButton>
          <POSButton variant="primary" onClick={handleSubmit}>
            Add to Cart
          </POSButton>
        </div>
      </div>
    </POSModal>
  );
}

export default CustomItemDialog;
