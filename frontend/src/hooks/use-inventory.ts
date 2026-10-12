import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { InventoryAdjustmentRequest } from '@/types/api';

export function useAdjustInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, data }: { sku: string; data: InventoryAdjustmentRequest }) =>
      apiClient.inventory.adjust(sku, data),
    onSuccess: (_, variables) => {
      // Invalidate products and reorder suggestions
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.sku] });
      queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] });
    },
  });
}

