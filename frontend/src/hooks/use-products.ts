import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { ProductFilters, ProductCreateParams, ProductUpdateParams } from '@/types/api';

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.products(filters as Record<string, unknown>),
    queryFn: () => apiClient.products.list(filters),
  });
}

export function useProduct(sku: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.product(sku),
    queryFn: () => apiClient.products.get(sku),
    enabled: Boolean(sku) && enabled,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductCreateParams) => apiClient.products.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, data }: { sku: string; data: ProductUpdateParams }) =>
      apiClient.products.update(sku, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.product(variables.sku) });
    },
  });
}

