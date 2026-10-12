import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { DealerFilters, DealerCreateParams } from '@/types/api';

export function useDealers(filters?: DealerFilters) {
  return useQuery({
    queryKey: queryKeys.dealers(filters as Record<string, unknown>),
    queryFn: () => apiClient.dealers.list(filters),
  });
}

export function useDealer(id: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.dealer(id),
    queryFn: () => apiClient.dealers.get(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateDealer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DealerCreateParams) => apiClient.dealers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dealers'] });
    },
  });
}

