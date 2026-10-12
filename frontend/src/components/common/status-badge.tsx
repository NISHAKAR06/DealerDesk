import React from 'react';
import { getOrderStatusConfig, getStockStatus } from '@/lib/utils';
import { OrderStatus } from '@/types/api';
import { cn } from '@/lib/utils';

interface OrderBadgeProps {
  status: OrderStatus;
  className?: string;
}

export const OrderStatusBadge: React.FC<OrderBadgeProps> = ({ status, className }) => {
  const config = getOrderStatusConfig(status);
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border uppercase tracking-wider',
        config.badgeClass,
        className
      )}
    >
      {config.label}
    </span>
  );
};

interface StockBadgeProps {
  stock: number;
  className?: string;
}

export const StockBadge: React.FC<StockBadgeProps> = ({ stock, className }) => {
  const config = getStockStatus(stock);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border',
        config.badgeClass,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          config.variant === 'healthy' && 'bg-emerald-500',
          config.variant === 'low' && 'bg-amber-500 animate-pulse',
          config.variant === 'out' && 'bg-rose-500'
        )}
      />
      {config.label}
    </span>
  );
};

