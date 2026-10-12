import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Search, ShoppingCart, ArrowRight } from 'lucide-react';
import { useOrders } from '@/hooks/use-orders';
import { useDealers } from '@/hooks/use-dealers';
import { OrderStatus } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { Pagination } from '@/components/common/pagination';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();

  const [dealerFilter, setDealerFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [searchOrderNo, setSearchOrderNo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Fetch dealers for filter dropdown
  const { data: dealersData } = useDealers({ page_size: 100 });

  // Fetch orders
  const { data, isLoading, error, refetch } = useOrders({
    dealer_id: dealerFilter,
    status: statusFilter,
    page,
    page_size: pageSize,
  });

  const ordersList = data?.results || [];

  // Filter client-side by order number if typed
  const displayedOrders = searchOrderNo.trim()
    ? ordersList.filter((o) =>
        o.order_number.toLowerCase().includes(searchOrderNo.trim().toLowerCase())
      )
    : ordersList;

  const dealerMap = React.useMemo(() => {
    const map = new Map<number, string>();
    dealersData?.results?.forEach((d) => {
      map.set(d.id, `${d.name} (${d.dealer_code})`);
    });
    return map;
  }, [dealersData]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Order Fulfillment Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor draft creations, stock-locked confirmations, dispatch transit, and deliveries.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/orders/new')}
          className="gap-1.5 self-start md:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          Create Order
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-end">
        {/* Search Order Number */}
        <div className="w-full md:flex-1">
          <Input
            label="Search Order #"
            placeholder="e.g. ORD-20261012-0007"
            value={searchOrderNo}
            onChange={(e) => setSearchOrderNo(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Dealer Filter */}
        <div className="w-full md:w-56">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Filter by Dealer
          </label>
          <select
            value={dealerFilter || ''}
            onChange={(e) => {
              setDealerFilter(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Dealers</option>
            {dealersData?.results?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.dealer_code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Order Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | '');
              setPage(1);
            }}
            className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="DISPATCHED">DISPATCHED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        {(dealerFilter || statusFilter || searchOrderNo) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDealerFilter(undefined);
              setStatusFilter('');
              setSearchOrderNo('');
              setPage(1);
            }}
            className="h-9 px-3 text-xs"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Orders Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading orders registry..." />
        ) : error ? (
          <div className="p-6">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : displayedOrders.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-6 w-6" />}
            title="No Orders Found"
            description="No orders currently match the selected dealer and status filters."
            actionLabel="Create New Order"
            onAction={() => navigate('/orders/new')}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Dealer</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">GST (18%)</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedOrders.map((order) => (
                    <tr
                      key={order.order_number}
                      onClick={() => navigate(`/orders/${order.order_number}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                        {order.order_number}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {dealerMap.get(order.dealer_id) || `Dealer #${order.dealer_id}`}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        {order.items?.length || 0}
                      </td>
                      <td className="py-3 px-4">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(order.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(order.tax_total)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(order.grand_total)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders/${order.order_number}`);
                          }}
                          className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800 gap-1"
                        >
                          View
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              pageSize={pageSize}
              totalCount={data?.count || displayedOrders.length}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </div>
  );
};
