import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Users,
  ShoppingCart,
  AlertTriangle,
  PlusCircle,
  Boxes,
  Bot,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { useProducts } from '@/hooks/use-products';
import { useDealers } from '@/hooks/use-dealers';
import { useOrders } from '@/hooks/use-orders';
import { useReorderSuggestions } from '@/hooks/use-forecasting';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge, StockBadge } from '@/components/common/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Fetch summary data from endpoints
  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useProducts({ page: 1, page_size: 50 });

  const {
    data: dealersData,
    isLoading: dealersLoading,
    error: dealersError,
  } = useDealers({ page: 1, page_size: 20 });

  const {
    data: ordersData,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useOrders({ page: 1, page_size: 10 });

  const {
    data: reorderData,
    isLoading: reorderLoading,
  } = useReorderSuggestions();

  // Derive counts and lists honestly
  const totalProducts = productsData?.count ?? null;
  const totalDealers = dealersData?.count ?? null;
  const totalOrders = ordersData?.count ?? null;

  // Filter low stock from available products
  const lowStockProducts =
    productsData?.results?.filter((p) => p.stock <= 20) || [];

  // Order status distribution
  const ordersList = ordersData?.results || [];
  const statusCounts = ordersList.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Operations &amp; Fulfilment Desk
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-brand catalogue inventory, dealer draft orders, and automated reorder tracking.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/orders/new')}
            className="gap-1.5"
          >
            <PlusCircle className="h-4 w-4" />
            Create Order
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/inventory')}
            className="gap-1.5"
          >
            <Boxes className="h-4 w-4" />
            Stock Inventory
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/assistant')}
            className="gap-1.5 text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50"
          >
            <Bot className="h-4 w-4" />
            AI Assistant
          </Button>
        </div>
      </div>

      {/* Summary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric: Products */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Catalogue Products
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {productsLoading ? (
                  <span className="text-slate-400 text-lg">Loading...</span>
                ) : productsError ? (
                  <span className="text-xs text-rose-600 font-normal">API Unavailable</span>
                ) : (
                  totalProducts?.toLocaleString() ?? '—'
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Total active SKUs in database</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric: Dealers */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Registered Dealers
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {dealersLoading ? (
                  <span className="text-slate-400 text-lg">Loading...</span>
                ) : dealersError ? (
                  <span className="text-xs text-rose-600 font-normal">API Unavailable</span>
                ) : (
                  totalDealers?.toLocaleString() ?? '—'
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Distribution network partners</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric: Total Orders */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Orders
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {ordersLoading ? (
                  <span className="text-slate-400 text-lg">Loading...</span>
                ) : ordersError ? (
                  <span className="text-xs text-rose-600 font-normal">API Unavailable</span>
                ) : (
                  totalOrders?.toLocaleString() ?? '—'
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">Drafts, confirmed &amp; dispatched</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric: Low Stock Alert */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Low Stock Items
              </p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">
                {productsLoading ? (
                  <span className="text-slate-400 text-lg">Loading...</span>
                ) : productsError ? (
                  <span className="text-xs text-rose-600 font-normal">API Unavailable</span>
                ) : (
                  lowStockProducts.length
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">SKUs with &le; 20 units remaining</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Operational Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Recent Orders */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3.5 px-5">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Orders</CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Latest customer orders and fulfillment pipeline status
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/orders')}
                className="text-xs text-indigo-600 hover:text-indigo-800 gap-1 h-7 px-2"
              >
                View All
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {ordersLoading ? (
                <LoadingState message="Loading recent orders..." />
              ) : ordersError ? (
                <div className="p-4">
                  <ErrorState
                    error={ordersError}
                    onRetry={() => refetchOrders()}
                    compact
                  />
                </div>
              ) : ordersList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No orders recorded yet. Click &quot;Create Order&quot; to submit a draft.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Order #</th>
                        <th className="py-2.5 px-4">Dealer</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Grand Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {ordersList.slice(0, 5).map((order) => (
                        <tr
                          key={order.order_number}
                          onClick={() => navigate(`/orders/${order.order_number}`)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                            {order.order_number}
                          </td>
                          <td className="py-3 px-4">
                            Dealer #{order.dealer_id}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {formatDateTime(order.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <OrderStatusBadge status={order.status} />
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            {formatCurrency(order.grand_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Inventory Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3.5 px-5">
              <div>
                <CardTitle className="text-sm font-semibold">Low Stock Inventory Alerts</CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Products requiring replenishment or stock reconciliation
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/inventory')}
                className="text-xs text-indigo-600 hover:text-indigo-800 gap-1 h-7 px-2"
              >
                Manage Stock
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {productsLoading ? (
                <LoadingState message="Loading inventory stock..." />
              ) : productsError ? (
                <div className="p-4">
                  <ErrorState
                    error={productsError}
                    onRetry={() => refetchProducts()}
                    compact
                  />
                </div>
              ) : lowStockProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50/50 m-4 rounded border border-emerald-200">
                  All catalogue products currently have healthy inventory levels (&gt; 20 units).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">SKU</th>
                        <th className="py-2.5 px-4">Product Name</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-center">Available Stock</th>
                        <th className="py-2.5 px-4 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {lowStockProducts.slice(0, 5).map((prod) => (
                        <tr key={prod.sku} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-900">
                            {prod.sku}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">
                            {prod.name}
                          </td>
                          <td className="py-3 px-4 text-slate-500">{prod.category}</td>
                          <td className="py-3 px-4 text-center">
                            <StockBadge stock={prod.stock} />
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900">
                            {formatCurrency(prod.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Order Status Breakdown & Reorder Highlights */}
        <div className="space-y-6">
          {/* Order Status Breakdown */}
          <Card>
            <CardHeader className="py-3.5 px-5">
              <CardTitle className="text-sm font-semibold">Order Pipeline Distribution</CardTitle>
              <p className="text-[11px] text-slate-500">Live breakdown across order states</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {(['DRAFT', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'] as const).map(
                (st) => {
                  const count = statusCounts[st] || 0;
                  const total = ordersList.length || 1;
                  const pct = Math.round((count / total) * 100);

                  const colors = {
                    DRAFT: 'bg-slate-400',
                    CONFIRMED: 'bg-blue-500',
                    DISPATCHED: 'bg-indigo-500',
                    DELIVERED: 'bg-emerald-500',
                    CANCELLED: 'bg-rose-500',
                  };

                  return (
                    <div key={st} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{st}</span>
                        <span className="text-slate-500 font-mono">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors[st]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </CardContent>
          </Card>

          {/* Reorder Suggestions Quick Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3.5 px-5">
              <div>
                <CardTitle className="text-sm font-semibold">Reorder Alerts</CardTitle>
                <p className="text-[11px] text-slate-500">Lead-time demand &amp; safety stock</p>
              </div>
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent className="pt-2">
              {reorderLoading ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading forecast...</div>
              ) : !reorderData?.results || reorderData.results.length === 0 ? (
                <div className="py-4 text-xs text-slate-500 text-center">
                  Forecast reorder suggestions will appear once loaded from <code className="text-slate-700 font-mono">/api/reorder-suggestions/</code>.
                </div>
              ) : (
                <div className="space-y-3">
                  {reorderData.results
                    .filter((r) => r.reorder_qty > 0)
                    .slice(0, 3)
                    .map((item) => (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between p-2.5 rounded border border-slate-200 bg-slate-50/50 text-xs"
                      >
                        <div>
                          <div className="font-mono font-semibold text-slate-900">
                            {item.sku}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Stock: {item.current_stock} &bull; ROP: {item.reorder_point}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold font-mono text-[11px]">
                            Reorder: {item.reorder_qty}
                          </span>
                        </div>
                      </div>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/forecasting')}
                    className="w-full text-xs mt-2"
                  >
                    View All 40 Forecast SKUs
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
