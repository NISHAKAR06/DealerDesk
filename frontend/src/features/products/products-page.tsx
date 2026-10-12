import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Filter,
  RotateCcw,
  Eye,
  Edit,
  Boxes,
} from 'lucide-react';
import { useProducts } from '@/hooks/use-products';
import { Product } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StockBadge } from '@/components/common/status-badge';
import { Pagination } from '@/components/common/pagination';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { formatCurrency } from '@/lib/utils';
import { ProductFormModal } from './product-form-modal';
import { ProductDetailDrawer } from './product-detail-drawer';
import { StockAdjustDialog } from '@/features/inventory/stock-adjust-dialog';

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query params
  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const vehicleFilter = searchParams.get('vehicle') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeParam = parseInt(searchParams.get('page_size') || '20', 10);

  // Local filter states
  const [search, setSearch] = useState(searchQuery);
  const [category, setCategory] = useState(categoryFilter);
  const [vehicle, setVehicle] = useState(vehicleFilter);
  const [page, setPage] = useState(pageParam);
  const [pageSize, setPageSize] = useState(pageSizeParam);

  // Modals & Drawers state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [productForStockAdjust, setProductForStockAdjust] = useState<Product | null>(null);

  // Sync state if URL search param changes (e.g. from global search)
  useEffect(() => {
    setSearch(searchQuery);
  }, [searchQuery]);

  // Fetch products
  const { data, isLoading, error, refetch } = useProducts({
    search: searchQuery || undefined,
    category: categoryFilter || undefined,
    vehicle: vehicleFilter || undefined,
    page,
    page_size: pageSize,
  });

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    if (category.trim()) params.category = category.trim();
    if (vehicle.trim()) params.vehicle = vehicle.trim();
    params.page = '1';
    params.page_size = String(pageSize);
    setPage(1);
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setSearch('');
    setCategory('');
    setVehicle('');
    setPage(1);
    setSearchParams({});
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    setSearchParams(params);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    params.set('page_size', String(newSize));
    params.set('page', '1');
    setSearchParams(params);
  };

  const hasActiveFilters = Boolean(searchQuery || categoryFilter || vehicleFilter);

  return (
    <div className="space-y-5">
      {/* Action and Filter Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Spare-Parts Catalogue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Browse and search OEM automotive inventory, verify vehicle fitment, and manage parts.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setProductToEdit(null);
            setFormModalOpen(true);
          }}
          className="gap-1.5 self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Filter Toolbar */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-end"
      >
        <div className="w-full md:flex-1">
          <Input
            label="Search Catalogue"
            placeholder="Search by SKU, part name, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="w-full md:w-52">
          <Input
            label="Category Filter"
            placeholder="e.g. Brakes, Lighting..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div className="w-full md:w-56">
          <Input
            label="Vehicle Fitment"
            placeholder="e.g. Bajaj Pulsar 150..."
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button type="submit" variant="primary" size="sm" className="gap-1.5 flex-1 md:flex-none">
            <Filter className="h-3.5 w-3.5" />
            Apply
          </Button>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1.5"
              title="Reset all search filters"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </form>

      {/* Product Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading catalogue products..." />
        ) : error ? (
          <div className="p-6">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : !data?.results || data.results.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No Matching Products Found' : 'No Products In Catalogue'}
            description={
              hasActiveFilters
                ? 'Try adjusting your search criteria or resetting the category and vehicle filters.'
                : 'Seed the database using `python manage.py seed_data` or click "Add Product" to create one.'
            }
            actionLabel={hasActiveFilters ? 'Reset Filters' : 'Add First Product'}
            onAction={
              hasActiveFilters
                ? handleResetFilters
                : () => {
                    setProductToEdit(null);
                    setFormModalOpen(true);
                  }
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Part Name</th>
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Vehicle Fitment</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {data.results.map((product) => (
                    <tr
                      key={product.sku}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                        {product.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setDetailDrawerOpen(true);
                          }}
                          className="hover:text-indigo-600 hover:underline text-left truncate block max-w-xs focus:outline-none"
                        >
                          {product.name}
                        </button>
                      </td>
                      <td className="py-3 px-4">{product.brand}</td>
                      <td className="py-3 px-4 text-slate-600">{product.category}</td>
                      <td className="py-3 px-4 text-slate-600">{product.vehicle_fitment}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900 font-mono">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StockBadge stock={product.stock} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-slate-700"
                            title="View Details"
                            onClick={() => {
                              setSelectedProduct(product);
                              setDetailDrawerOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                            title="Edit Product"
                            onClick={() => {
                              setProductToEdit(product);
                              setFormModalOpen(true);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-amber-600"
                            title="Adjust Stock"
                            onClick={() => {
                              setProductForStockAdjust(product);
                              setStockAdjustOpen(true);
                            }}
                          >
                            <Boxes className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              pageSize={pageSize}
              totalCount={data.count}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              isLoading={isLoading}
            />
          </>
        )}
      </div>

      {/* Modals & Drawers */}
      <ProductFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        productToEdit={productToEdit}
        onSuccess={() => refetch()}
      />

      <ProductDetailDrawer
        product={selectedProduct}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        onEdit={(prod) => {
          setProductToEdit(prod);
          setFormModalOpen(true);
        }}
        onAdjustStock={(prod) => {
          setProductForStockAdjust(prod);
          setStockAdjustOpen(true);
        }}
      />

      <StockAdjustDialog
        product={productForStockAdjust}
        open={stockAdjustOpen}
        onOpenChange={setStockAdjustOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
};

