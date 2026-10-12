import React from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { StockBadge } from '@/components/common/status-badge';
import { formatCurrency } from '@/lib/utils';
import { Product } from '@/types/api';
import { Edit2, Boxes, Tag, ShieldCheck, Car, Layers } from 'lucide-react';

interface ProductDetailDrawerProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (product: Product) => void;
  onAdjustStock: (product: Product) => void;
}

export const ProductDetailDrawer: React.FC<ProductDetailDrawerProps> = ({
  product,
  open,
  onOpenChange,
  onEdit,
  onAdjustStock,
}) => {
  if (!product) return null;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={product.name}
      description={`SKU: ${product.sku}`}
      width="lg"
    >
      <div className="space-y-6">
        {/* Top Highlight Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Current Catalogue Price
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(product.price)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Exclusive of 18% GST</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
              Available Inventory
            </div>
            <StockBadge stock={product.stock} />
          </div>
        </div>

        {/* Specifications Grid */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Part Specifications
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded-md">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Tag className="h-3.5 w-3.5" />
                <span>Brand</span>
              </div>
              <div className="font-semibold text-slate-800">{product.brand}</div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-md">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Layers className="h-3.5 w-3.5" />
                <span>Category</span>
              </div>
              <div className="font-semibold text-slate-800">{product.category}</div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-md col-span-2">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Car className="h-3.5 w-3.5" />
                <span>Vehicle Fitment</span>
              </div>
              <div className="font-semibold text-slate-800">{product.vehicle_fitment}</div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Description &amp; Notes
          </h4>
          <div className="p-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed min-h-[80px]">
            {product.description || 'No description provided for this catalogue item.'}
          </div>
        </div>

        {/* OEM Authenticity Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded bg-blue-50/50 border border-blue-200 text-xs text-blue-800">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Authentic Spare Part:</strong> Certified replacement part conforming to OEM manufacturing tolerances and technical fitment guidelines.
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onAdjustStock(product);
            }}
            className="flex-1 gap-1.5"
          >
            <Boxes className="h-4 w-4" />
            Adjust Stock
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onEdit(product);
            }}
            className="flex-1 gap-1.5"
          >
            <Edit2 className="h-4 w-4" />
            Edit Details
          </Button>
        </div>
      </div>
    </Drawer>
  );
};

