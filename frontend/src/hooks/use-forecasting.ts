import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';

export function useSkuForecast(sku: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.skuForecast(sku),
    queryFn: () => apiClient.forecasting.getSkuForecast(sku),
    enabled: Boolean(sku) && enabled,
  });
}

export function useReorderSuggestions() {
  return useQuery({
    queryKey: queryKeys.reorderSuggestions,
    queryFn: () => apiClient.forecasting.getReorderSuggestions(),
  });
}

