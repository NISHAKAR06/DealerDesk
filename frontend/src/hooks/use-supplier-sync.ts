import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export function useRunSupplierSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.supplierSync.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

