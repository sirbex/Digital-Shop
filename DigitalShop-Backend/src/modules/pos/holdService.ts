import { holdRepository, CreateHoldOrderData, CreateHoldOrderItemData } from './holdRepository.js';
import logger from '../../utils/logger.js';

/**
 * Hold Order Service
 * Business logic for "Put on Hold" and "Resume" cart functionality
 *
 * Key Rules:
 * - Held orders are NOT sales or invoices
 * - NO stock movements created when holding
 * - NO payment processing happens
 * - Resume = load cart state + delete hold record
 */

export interface HoldOrderItem {
    productId: string;
    productName: string;
    productSku?: string | null;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    subtotal: number;
    isTaxable: boolean;
    taxRate: number;
    taxAmount: number;
    discountType?: string | null;
    discountValue?: number | null;
    discountAmount: number;
    discountReason?: string | null;
    metadata?: Record<string, any> | null;
    lineOrder?: number;
}

export interface CreateHoldOrderInput {
    terminalId?: string | null;
    userId: string;
    customerId?: string | null;
    customerName?: string | null;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
    holdReason?: string | null;
    notes?: string | null;
    metadata?: Record<string, any> | null;
    expiresAt?: string | null;
    items: HoldOrderItem[];
}

export const holdService = {
    /**
     * Put cart on hold
     * @param input - Hold order data with items
     * @returns Created hold order with items
     * @throws Error if validation fails
     *
     * Business Logic:
     * 1. Validate input
     * 2. Set default expiration (24 hours if not provided)
     * 3. Create hold order + items in transaction
     * 4. NO stock movements
     * 5. NO payment processing
     */
    async holdCart(input: CreateHoldOrderInput) {
        // Validate required fields
        if (!input.userId) {
            throw new Error('User ID is required');
        }
        
        if (!input.items || input.items.length === 0) {
            throw new Error('At least one item is required');
        }

        // Set default expiration (24 hours from now)
        const expiresAt = input.expiresAt
            ? new Date(input.expiresAt)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Prepare hold data
        const holdData: CreateHoldOrderData = {
            terminalId: input.terminalId,
            userId: input.userId,
            customerId: input.customerId,
            customerName: input.customerName,
            subtotal: input.subtotal,
            taxAmount: input.taxAmount,
            discountAmount: input.discountAmount,
            totalAmount: input.totalAmount,
            holdReason: input.holdReason,
            notes: input.notes,
            metadata: input.metadata,
            expiresAt,
        };

        // Prepare items
        const items: CreateHoldOrderItemData[] = input.items.map((item, index) => ({
            holdId: '', // Set by repository
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice,
            subtotal: item.subtotal,
            isTaxable: item.isTaxable,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            discountType: item.discountType || null,
            discountValue: item.discountValue || null,
            discountAmount: item.discountAmount,
            discountReason: item.discountReason || null,
            metadata: item.metadata || null,
            lineOrder: item.lineOrder ?? index,
        }));

        logger.info('Holding cart', {
            userId: input.userId,
            itemCount: items.length,
            totalAmount: input.totalAmount,
            expiresAt: expiresAt.toISOString(),
        });

        const hold = await holdRepository.createHoldOrder(holdData, items);

        return this.getHoldById(hold.id);
    },

    /**
     * List held orders for a user/terminal
     * @param filters - Optional filters (userId, terminalId)
     * @returns Array of held orders with item counts
     */
    async listHolds(filters: { userId?: string; terminalId?: string }) {
        const holds = await holdRepository.listHoldOrders({
            ...filters,
            includeExpired: false, // Don't show expired holds
        });

        return holds.map((hold) => ({
            id: hold.id,
            holdNumber: hold.hold_number,
            terminalId: hold.terminal_id,
            userId: hold.user_id,
            customerId: hold.customer_id,
            customerName: hold.customer_name,
            subtotal: parseFloat(hold.subtotal || '0'),
            taxAmount: parseFloat(hold.tax_amount || '0'),
            discountAmount: parseFloat(hold.discount_amount || '0'),
            totalAmount: parseFloat(hold.total_amount || '0'),
            holdReason: hold.hold_reason,
            notes: hold.notes,
            metadata: hold.metadata,
            createdAt: hold.created_at,
            expiresAt: hold.expires_at,
            itemCount: parseInt(hold.item_count || '0', 10),
        }));
    },

    /**
     * Load held order by ID (for resume)
     * @param holdId - Hold order UUID
     * @returns Full hold order with items
     * @throws Error if hold not found or expired
     *
     * Use Case: Resume button clicked
     * Next Steps: Load into POS cart + delete hold
     */
    async getHoldById(holdId: string) {
        const hold = await holdRepository.getHoldOrderById(holdId);

        if (!hold) {
            throw new Error(`Hold order ${holdId} not found`);
        }

        // Check expiration
        if (hold.expires_at && new Date(hold.expires_at) < new Date()) {
            throw new Error('Hold order has expired');
        }

        return {
            id: hold.id,
            holdNumber: hold.hold_number,
            terminalId: hold.terminal_id,
            userId: hold.user_id,
            customerId: hold.customer_id,
            customerName: hold.customer_name,
            subtotal: parseFloat(hold.subtotal || '0'),
            taxAmount: parseFloat(hold.tax_amount || '0'),
            discountAmount: parseFloat(hold.discount_amount || '0'),
            totalAmount: parseFloat(hold.total_amount || '0'),
            holdReason: hold.hold_reason,
            notes: hold.notes,
            metadata: hold.metadata,
            createdAt: hold.created_at,
            expiresAt: hold.expires_at,
            items: hold.items.map((item: any) => ({
                id: item.id,
                productId: item.product_id,
                productName: item.product_name,
                productSku: item.product_sku,
                quantity: parseFloat(item.quantity || '0'),
                unitPrice: parseFloat(item.unit_price || '0'),
                costPrice: parseFloat(item.cost_price || '0'),
                subtotal: parseFloat(item.subtotal || '0'),
                isTaxable: item.is_taxable,
                taxRate: parseFloat(item.tax_rate || '0'),
                taxAmount: parseFloat(item.tax_amount || '0'),
                discountType: item.discount_type,
                discountValue: item.discount_value ? parseFloat(item.discount_value) : null,
                discountAmount: parseFloat(item.discount_amount || '0'),
                discountReason: item.discount_reason,
                metadata: item.metadata,
                lineOrder: item.line_order,
            })),
        };
    },

    /**
     * Delete held order (after resuming)
     * @param holdId - Hold order UUID
     *
     * Use Case: After loading hold into POS cart, delete the hold record
     */
    async deleteHold(holdId: string): Promise<void> {
        await holdRepository.deleteHoldOrder(holdId);
    },

    /**
     * Cleanup expired holds (background job)
     * @returns Number of deleted holds
     */
    async cleanupExpiredHolds(): Promise<number> {
        return holdRepository.deleteExpiredHolds();
    },
};
