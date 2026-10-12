import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  AlertTriangle,
  Clock,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import {
  useOrder,
  useConfirmOrder,
  useDispatchOrder,
  useDeliverOrder,
  useCancelOrder,
} from '@/hooks/use-orders';
import { useDealer } from '@/hooks/use-dealers';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { formatCurrency, formatDateTime, parseApiError } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';

export const OrderDetailPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [stockErrorDetails, setStockErrorDetails] = useState<any[] | null>(null);

  // Fetch Order
  const { data: order, isLoading, error, refetch } = useOrder(orderNumber || '');

  // Fetch associated dealer
  const { data: dealer } = useDealer(order?.dealer_id || 0, Boolean(order?.dealer_id));

  // Status mutations
  const confirmMutation = useConfirmOrder();
  const dispatchMutation = useDispatchOrder();
  const deliverMutation = useDeliverOrder();
  const cancelMutation = useCancelOrder();

  if (isLoading) {
    return <LoadingState message="Loading order details..." />;
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orders')}
          className="gap-1.5 text-xs text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Button>
        <ErrorState
          error={error}
          title={`Order ${orderNumber} Not Found`}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Lifecycle Action Handlers
  const handleConfirmOrder = async () => {
    setStockErrorDetails(null);
    try {
      await confirmMutation.mutateAsync(order.order_number);
      toast.success(
        `Order ${order.order_number} confirmed. Stock deducted and unit prices locked.`,
        'Order Confirmed'
      );
      setConfirmModalOpen(false);
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.code === 'INSUFFICIENT_STOCK' && parsed.details) {
        setStockErrorDetails(parsed.details);
      }
      toast.error(parsed.message, `Cannot Confirm Order (${parsed.code})`);
      setConfirmModalOpen(false);
    }
  };

  const handleDispatchOrder = async () => {
    try {
      await dispatchMutation.mutateAsync(order.order_number);
      toast.success(`Order ${order.order_number} marked as dispatched in transit.`, 'Dispatched');
      setDispatchModalOpen(false);
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message, `Dispatch Failed (${parsed.code})`);
      setDispatchModalOpen(false);
    }
  };

  const handleDeliverOrder = async () => {
    try {
      await deliverMutation.mutateAsync(order.order_number);
      toast.success(`Order ${order.order_number} marked as delivered to dealer.`, 'Delivered');
      setDeliverModalOpen(false);
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message, `Delivery Failed (${parsed.code})`);
      setDeliverModalOpen(false);
    }
  };

  const handleCancelOrder = async () => {
    try {
      await cancelMutation.mutateAsync(order.order_number);
      toast.success(
        order.status === 'CONFIRMED'
          ? `Order ${order.order_number} cancelled. Quantities restored to available inventory.`
          : `Order ${order.order_number} cancelled.`,
        'Order Cancelled'
      );
      setCancelModalOpen(false);
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message, `Cancellation Failed (${parsed.code})`);
      setCancelModalOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/orders')}
            className="gap-1.5 text-xs text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Orders
          </Button>
          <div className="h-4 w-px bg-slate-300" />
          <h2 className="text-xl font-bold font-mono text-slate-900 tracking-tight">
            {order.order_number}
          </h2>
          <OrderStatusBadge status={order.status} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Note
          </Button>
        </div>
      </div>

      {/* Insufficient Stock Banner if confirmation failed */}
      {stockErrorDetails && stockErrorDetails.length > 0 && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span>Confirmation Blocked: Insufficient Physical Stock</span>
          </div>
          <p>
            The order confirmation was rejected by the backend stock guarantee engine because one or more SKUs lack adequate stock:
          </p>
          <div className="bg-white rounded border border-rose-200 p-2 space-y-1">
            {stockErrorDetails.map((short: any, idx: number) => (
              <div key={idx} className="flex justify-between font-mono">
                <span>SKU: {short.sku}</span>
                <span>Requested: {short.requested} | Available: {short.available}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dealer Information */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Dealer Requisitioner
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1 text-xs">
            <div className="font-bold text-slate-900 text-sm">
              {dealer?.name || `Dealer ID #${order.dealer_id}`}
            </div>
            <div className="text-slate-600 font-mono">Code: {dealer?.dealer_code || '—'}</div>
            <div className="text-slate-500">City: {dealer?.city || 'India'}</div>
            <div className="text-slate-500">Phone: {dealer?.phone || '—'}</div>
            {dealer?.gstin && <div className="text-slate-500 font-mono">GSTIN: {dealer.gstin}</div>}
          </CardContent>
        </Card>

        {/* Timestamps & Lifecycle */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Order Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Created: {formatDateTime(order.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Updated: {formatDateTime(order.updated_at)}</span>
            </div>
            <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
              Timezone: Asia/Kolkata (IST)
            </div>
          </CardContent>
        </Card>

        {/* Contextual Status Action Control Box */}
        <Card className="border-indigo-100 bg-indigo-50/20">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-indigo-900 font-semibold">
              Status Actions ({order.status})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            {order.status === 'DRAFT' && (
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirmModalOpen(true)}
                  className="w-full gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Order &amp; Deduct Stock
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalOpen(true)}
                  className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel Draft Order
                </Button>
              </div>
            )}

            {order.status === 'CONFIRMED' && (
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDispatchModalOpen(true)}
                  className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700"
                >
                  <Truck className="h-4 w-4" />
                  Dispatch Order
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalOpen(true)}
                  className="w-full text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                >
                  <XCircle className="h-4 w-4" />
                  Cancel &amp; Restore Stock
                </Button>
              </div>
            )}

            {order.status === 'DISPATCHED' && (
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDeliverModalOpen(true)}
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  <PackageCheck className="h-4 w-4" />
                  Confirm Delivery
                </Button>
              </div>
            )}

            {(order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
              <div className="p-2.5 rounded bg-white border border-slate-200 text-xs text-slate-500 text-center">
                This order is in terminal state <strong className="text-slate-800">{order.status}</strong>. No further status transitions allowed.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader className="py-3.5 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Authoritative Line Items</CardTitle>
          <span className="text-xs text-slate-500 font-mono">
            {order.items?.length || 0} line items
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4">Part Description</th>
                  <th className="py-2.5 px-4 text-center">Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Price</th>
                  <th className="py-2.5 px-4 text-right">Line Subtotal</th>
                  <th className="py-2.5 px-4 text-right">Line GST (18%)</th>
                  <th className="py-2.5 px-4 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {order.items?.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                      {item.sku}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {formatCurrency(item.line_subtotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">
                      {formatCurrency(item.line_tax)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Financial Breakdown Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="text-xs text-slate-500 flex items-center gap-1.5 p-3 rounded bg-slate-50 border border-slate-200">
          <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>GST 18% calculated using standard ROUND_HALF_UP to 2 decimal places per line item.</span>
        </div>

        <div className="w-full sm:w-80 bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Catalogue Subtotal:</span>
            <span className="font-mono text-slate-900 font-semibold">{formatCurrency(order.subtotal)}</span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>GST Tax (18% Total):</span>
            <span className="font-mono text-slate-900 font-semibold">{formatCurrency(order.tax_total)}</span>
          </div>

          <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2.5">
            <span>Grand Total:</span>
            <span className="font-mono text-indigo-700">{formatCurrency(order.grand_total)}</span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title="Confirm Dealer Order"
        description={`Confirming order ${order.order_number} will lock current catalogue prices and atomically deduct stock for all line items. If stock is insufficient, confirmation will be blocked.`}
        confirmLabel="Confirm & Deduct Stock"
        isLoading={confirmMutation.isPending}
        onConfirm={handleConfirmOrder}
      />

      <ConfirmDialog
        open={dispatchModalOpen}
        onOpenChange={setDispatchModalOpen}
        title="Dispatch Order"
        description={`Mark order ${order.order_number} as dispatched in transit to ${dealer?.name || 'dealer'}. Once dispatched, orders cannot be cancelled.`}
        confirmLabel="Confirm Dispatch"
        isLoading={dispatchMutation.isPending}
        onConfirm={handleDispatchOrder}
      />

      <ConfirmDialog
        open={deliverModalOpen}
        onOpenChange={setDeliverModalOpen}
        title="Mark Order Delivered"
        description={`Confirm physical delivery receipt of order ${order.order_number} at dealer premises. This transitions order to terminal state.`}
        confirmLabel="Confirm Delivery"
        isLoading={deliverMutation.isPending}
        onConfirm={handleDeliverOrder}
      />

      <ConfirmDialog
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel Order"
        description={
          order.status === 'CONFIRMED'
            ? `Cancelling this CONFIRMED order will restore all reserved quantities back to available inventory. This action is irreversible.`
            : `Are you sure you want to cancel draft order ${order.order_number}?`
        }
        variant="destructive"
        confirmLabel="Cancel Order"
        isLoading={cancelMutation.isPending}
        onConfirm={handleCancelOrder}
      />
    </div>
  );
};

