import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Dealer } from '@/types/api';
import { useOrders } from '@/hooks/use-orders';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { PlusCircle, ShoppingCart, ArrowRight } from 'lucide-react';
import { LoadingState } from '@/components/common/loading-state';

interface DealerDetailDrawerProps {
  dealer: Dealer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealerDetailDrawer: React.FC<DealerDetailDrawerProps> = ({
  dealer,
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate();

  // Fetch orders specific to this dealer
  const { data: dealerOrders, isLoading: ordersLoading } = useOrders({
    dealer_id: dealer?.id,
    page_size: 20,
  });

  if (!dealer) return null;

  const orders = dealerOrders?.results || [];

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={dealer.name}
      description={`Dealer Code: ${dealer.dealer_code} (ID: ${dealer.id})`}
      width="lg"
    >
      <div className="space-y-6">
        {/* Profile Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider">
              Approved Credit Limit
            </span>
            <span className="font-mono font-bold text-sm text-slate-900">
              {formatCurrency(dealer.credit_limit || '0.00')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px]">CITY / REGION</span>
              <span className="font-medium text-slate-800">{dealer.city || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">PHONE</span>
              <span className="font-medium text-slate-800">{dealer.phone || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">BILLING EMAIL</span>
              <span className="font-medium text-slate-800 truncate block">{dealer.email || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">GSTIN</span>
              <span className="font-mono text-slate-800">{dealer.gstin || '—'}</span>
            </div>
          </div>
        </div>

        {/* Action button */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            onOpenChange(false);
            navigate('/orders/new');
          }}
          className="w-full gap-1.5"
        >
          <PlusCircle className="h-4 w-4" />
          Create Order For {dealer.name}
        </Button>

        {/* Order History Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Order History ({dealerOrders?.count || orders.length})
            </h4>
          </div>

          {ordersLoading ? (
            <LoadingState message="Loading dealer order ledger..." />
          ) : orders.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
              No orders found for this dealer yet.
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.order_number}
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/orders/${order.order_number}`);
                  }}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-indigo-600 flex items-center gap-1.5">
                      <ShoppingCart className="h-3.5 w-3.5 text-slate-400" />
                      {order.order_number}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {formatDateTime(order.created_at)} &bull; {order.items?.length || 0} items
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="font-bold font-mono text-slate-900">
                        {formatCurrency(order.grand_total)}
                      </div>
                      <div className="mt-0.5">
                        <OrderStatusBadge status={order.status} />
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};

