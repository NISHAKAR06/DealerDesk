import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // Do not retry 4xx errors
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false, // Never auto-retry unsafe mutations
    },
  },
});

export const queryKeys = {
  health: ['health'] as const,
  products: (filters?: Record<string, unknown>) => ['products', filters] as const,
  product: (sku: string) => ['product', sku] as const,
  dealers: (filters?: Record<string, unknown>) => ['dealers', filters] as const,
  dealer: (id: number) => ['dealer', id] as const,
  orders: (filters?: Record<string, unknown>) => ['orders', filters] as const,
  order: (orderNumber: string) => ['order', orderNumber] as const,
  skuForecast: (sku: string) => ['forecast', sku] as const,
  reorderSuggestions: ['reorder-suggestions'] as const,
};

