import React, { useState } from 'react';
import { Search, Boxes, AlertTriangle, ShieldCheck, XCircle } from 'lucide-react';
import { useProducts } from '@/hooks/use-products';
import { Product } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockBadge } from '@/components/common/status-badge';
import { Pagination } from '@/components/common/pagination';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { StockAdjustDialog } from './stock-adjust-dialog';

export const InventoryPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'low' | 'out'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useProducts({
    search: activeSearch || undefined,
    page,
    page_size: pageSize,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(search.trim());
    setPage(1);
  };

  // Filter client-side for status tab if applicable
  const rawResults = data?.results || [];
  const filteredResults = rawResults.filter((p) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'out') return p.stock <= 0;
    if (statusFilter === 'low') return p.stock > 0 && p.stock <= 20;
    if (statusFilter === 'healthy') return p.stock > 20;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Page Title & Explanation */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Inventory &amp; Physical Stock Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time warehouse balance. Adjust physical stock counts with audited correction logs.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-md border border-slate-200">
          <Boxes className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>
            Stock endpoint: <code className="font-mono font-semibold text-slate-900">PUT /api/inventory/&lcub;sku&rcub;/</code>
          </span>
        </div>
      </div>

      {/* Filter & Status Navigation Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Inventory
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('healthy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'healthy'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Healthy Stock (&gt;20)
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('low')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'low'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Low Stock (&le;20)
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('out')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'out'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            Out of Stock (0)
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <Input
            placeholder="Search by SKU or part name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
          <Button type="submit" variant="primary" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Inventory Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading inventory stock counts..." />
        ) : error ? (
          <div className="p-6">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : filteredResults.length === 0 ? (
          <EmptyState
            title="No Inventory Records Match Filter"
            description="No items match your active search or stock level filter."
            actionLabel="Reset Search & Filters"
            onAction={() => {
              setSearch('');
              setActiveSearch('');
              setStatusFilter('all');
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4 text-center">Available Stock</th>
                    <th className="py-3 px-4 text-center">Stock Level Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredResults.map((product) => (
                    <tr key={product.sku} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                        {product.sku}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800 max-w-sm">
                        {product.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{product.category}</td>
                      <td className="py-3.5 px-4 text-slate-500">{product.brand}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {product.stock}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <StockBadge stock={product.stock} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(product);
                            setAdjustDialogOpen(true);
                          }}
                          className="h-7 px-3 text-xs gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        >
                          <Boxes className="h-3 w-3" />
                          Adjust Stock
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
              totalCount={data?.count || 0}
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

      {/* Stock Adjustment Dialog */}
      <StockAdjustDialog
        product={selectedProduct}
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
};

