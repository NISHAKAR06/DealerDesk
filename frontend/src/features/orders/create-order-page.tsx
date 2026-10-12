import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Info,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { useDealers } from '@/hooks/use-dealers';
import { useProducts } from '@/hooks/use-products';
import { useCreateOrder } from '@/hooks/use-orders';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency, parseApiError } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { Product } from '@/types/api';

interface DraftOrderItem {
  sku: string;
  product?: Product;
  quantity: number;
}

export const CreateOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const createOrderMutation = useCreateOrder();

  const [dealerId, setDealerId] = useState<number | ''>('');
  const [items, setItems] = useState<DraftOrderItem[]>([]);
  const [selectedSkuToAdd, setSelectedSkuToAdd] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch dealers
  const { data: dealersData, isLoading: dealersLoading } = useDealers({ page_size: 100 });

  // Fetch products for dropdown search
  const { data: productsData } = useProducts({
    search: productSearch || undefined,
    page_size: 50,
  });

  const availableProducts = productsData?.results || [];

  const handleAddItem = (product: Product) => {
    if (items.some((it) => it.sku === product.sku)) {
      toast.warning(`Part ${product.sku} is already added in this order.`);
      return;
    }
    setItems((prev) => [...prev, { sku: product.sku, product, quantity: 1 }]);
    setSelectedSkuToAdd('');
    setProductSearch('');
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: newQty } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculate client preview totals (strictly marked as client preview)
  const previewCalculations = React.useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;

    const lineDetails = items.map((it) => {
      const unitPrice = it.product ? parseFloat(it.product.price) : 0;
      const lineSubtotal = unitPrice * it.quantity;
      // 18% GST rounded half up to 2 decimal places per line
      const lineTax = Math.round(lineSubtotal * 0.18 * 100) / 100;
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      taxTotal += lineTax;

      return {
        ...it,
        unitPrice,
        lineSubtotal,
        lineTax,
        lineTotal,
      };
    });

    const grandTotal = subtotal + taxTotal;
    return { lineDetails, subtotal, taxTotal, grandTotal };
  }, [items]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!dealerId) {
      setFormError('Please select a registered dealer.');
      return;
    }

    if (items.length === 0) {
      setFormError('An order must contain at least one line item.');
      return;
    }

    // Validate quantities are positive integers >= 1
    for (const it of items) {
      if (!Number.isInteger(it.quantity) || it.quantity < 1) {
        setFormError(`Quantity for SKU ${it.sku} must be an integer ≥ 1.`);
        return;
      }
    }

    // Check duplicate SKUs
    const skuSet = new Set(items.map((i) => i.sku));
    if (skuSet.size !== items.length) {
      setFormError('Duplicate SKU entries detected. Combine quantities for identical SKUs.');
      return;
    }

    try {
      const payload = {
        dealer_id: Number(dealerId),
        items: items.map((it) => ({
          sku: it.sku,
          quantity: it.quantity,
        })),
      };

      const createdOrder = await createOrderMutation.mutateAsync({
        data: payload,
      });

      toast.success(
        `Draft order ${createdOrder.order_number} created successfully.`,
        'Order Submitted'
      );
      navigate(`/orders/${createdOrder.order_number}`);
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.message);
      toast.error(parsed.message, `Order Creation Failed (${parsed.code})`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orders')}
          className="gap-1.5 text-xs text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Create Draft Dealer Order
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assemble multi-line spare-part requisitions. Orders are initialized as editable DRAFTs.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmitOrder} className="space-y-6">
        {/* Step 1: Select Dealer */}
        <Card>
          <CardHeader className="py-3.5 px-5">
            <CardTitle className="text-sm font-semibold">1. Select Dealer Requisitioner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md">
              <label htmlFor="dealer-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Dealer Account <span className="text-rose-500">*</span>
              </label>
              <select
                id="dealer-select"
                value={dealerId}
                onChange={(e) => {
                  setDealerId(e.target.value ? Number(e.target.value) : '');
                  setFormError(null);
                }}
                disabled={dealersLoading || createOrderMutation.isPending}
                required
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Choose a registered dealer --</option>
                {dealersData?.results?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.dealer_code} — {d.name} ({d.city || 'National'})
                  </option>
                ))}
              </select>
              {dealersLoading && (
                <p className="text-xs text-slate-400 mt-1">Loading dealers from database...</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Line Items */}
        <Card>
          <CardHeader className="py-3.5 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">2. Order Line Items</CardTitle>
            <span className="text-xs text-slate-500 font-mono">
              {items.length} {items.length === 1 ? 'line' : 'lines'} added
            </span>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Add Part Selector Bar */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-3 items-end">
              <div className="w-full md:w-64">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Search Catalogue Part
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search SKU or name..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="w-full md:flex-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select Catalogue SKU
                </label>
                <select
                  value={selectedSkuToAdd}
                  onChange={(e) => setSelectedSkuToAdd(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose part to add --</option>
                  {availableProducts.map((p) => (
                    <option key={p.sku} value={p.sku} disabled={items.some((i) => i.sku === p.sku)}>
                      {p.sku} — {p.name} ({formatCurrency(p.price)}) [{p.stock} in stock]
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!selectedSkuToAdd}
                onClick={() => {
                  const prod = availableProducts.find((p) => p.sku === selectedSkuToAdd);
                  if (prod) handleAddItem(prod);
                }}
                className="gap-1.5 h-9 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>

            {/* Line Items Table */}
            {items.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                No spare parts added to this order yet. Use the selector above to add line items.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4 text-center">Warehouse Stock</th>
                      <th className="py-2.5 px-4 text-right">Unit Price</th>
                      <th className="py-2.5 px-4 text-center w-32">Quantity</th>
                      <th className="py-2.5 px-4 text-right">Line Subtotal</th>
                      <th className="py-2.5 px-4 text-right">GST (18%)</th>
                      <th className="py-2.5 px-4 text-right">Line Total</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {previewCalculations.lineDetails.map((item, index) => (
                      <tr key={item.sku} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {item.product?.name || item.sku}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {item.product ? item.product.stock : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateQuantity(index, parseInt(e.target.value, 10) || 1)
                            }
                            className="h-8 w-20 text-center rounded border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(item.lineSubtotal)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {formatCurrency(item.lineTax)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {formatCurrency(item.lineTotal)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            title="Remove line item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Summary & Persistence Notice */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50/50 border border-blue-200 text-xs text-blue-900">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block font-semibold">Authoritative Backend Pricing:</strong>
                <p className="leading-relaxed">
                  The backend Django API is authoritative for all unit prices, 18% GST line calculations, and available stock validation upon confirmation. Client totals displayed here are advisory previews.
                </p>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Preview Order Total
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Catalogue Subtotal:</span>
                <span className="font-mono">{formatCurrency(previewCalculations.subtotal)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>GST Tax (18% rounded):</span>
                <span className="font-mono">{formatCurrency(previewCalculations.taxTotal)}</span>
              </div>

              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700">
                  {formatCurrency(previewCalculations.grandTotal)}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={items.length === 0 || !dealerId || createOrderMutation.isPending}
              isLoading={createOrderMutation.isPending}
              className="w-full gap-2 mt-4"
            >
              <CheckCircle2 className="h-4 w-4" />
              Submit Draft Order
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
