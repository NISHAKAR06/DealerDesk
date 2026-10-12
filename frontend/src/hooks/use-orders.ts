import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { OrderFilters, OrderCreateInput, OrderUpdateInput } from '@/types/api';

export function useOrders(filters?: OrderFilters) {
  return useQuery({
    queryKey: queryKeys.orders(filters as Record<string, unknown>),
    queryFn: () => apiClient.orders.list(filters),
  });
}

export function useOrder(orderNumber: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.order(orderNumber),
    queryFn: () => apiClient.orders.get(orderNumber),
    enabled: Boolean(orderNumber) && enabled,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: OrderCreateInput; idempotencyKey?: string }) =>
      apiClient.orders.create(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderNumber, data }: { orderNumber: string; data: OrderUpdateInput }) =>
      apiClient.orders.update(orderNumber, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(variables.orderNumber) });
    },
  });
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) => apiClient.orders.confirm(orderNumber),
    onSuccess: (_, orderNumber) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(orderNumber) });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] });
    },
  });
}

export function useDispatchOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) => apiClient.orders.dispatch(orderNumber),
    onSuccess: (_, orderNumber) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(orderNumber) });
    },
  });
}

export function useDeliverOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) => apiClient.orders.deliver(orderNumber),
    onSuccess: (_, orderNumber) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(orderNumber) });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) => apiClient.orders.cancel(orderNumber),
    onSuccess: (_, orderNumber) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.order(orderNumber) });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['reorder-suggestions'] });
    },
  });
}

