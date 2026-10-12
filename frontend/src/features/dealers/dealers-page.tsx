import React, { useState } from 'react';
import { Plus, Search, Eye, Users } from 'lucide-react';
import { useDealers } from '@/hooks/use-dealers';
import { Dealer } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/common/pagination';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { formatCurrency } from '@/lib/utils';
import { CreateDealerModal } from './create-dealer-modal';
import { DealerDetailDrawer } from './dealer-detail-drawer';

export const DealersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  const { data, isLoading, error, refetch } = useDealers({
    page,
    page_size: pageSize,
  });

  const dealersList = data?.results || [];

  // Filter client-side by name / code / city if search is typed
  const displayedDealers = search.trim()
    ? dealersList.filter((d) => {
        const q = search.trim().toLowerCase();
        return (
          d.dealer_code.toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q) ||
          (d.city && d.city.toLowerCase().includes(q))
        );
      })
    : dealersList;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Dealers Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered distribution partners, credit lines, and localized dispatch routing.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setCreateModalOpen(true)}
          className="gap-1.5 self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          Register Dealer
        </Button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="w-full md:w-80">
          <Input
            placeholder="Search dealers by code, name, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {/* Dealers Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading dealers directory..." />
        ) : error ? (
          <div className="p-6">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : displayedDealers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No Dealers Found"
            description={
              search.trim()
                ? 'No registered dealer matches your query.'
                : 'Seed dealer accounts using `python manage.py seed_data` or register a new dealer.'
            }
            actionLabel="Register Dealer"
            onAction={() => setCreateModalOpen(true)}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Dealer Code</th>
                    <th className="py-3 px-4">Dealership Name</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-right">Credit Limit</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedDealers.map((dealer) => (
                    <tr
                      key={dealer.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedDealer(dealer);
                        setDetailDrawerOpen(true);
                      }}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-indigo-600">
                        {dealer.dealer_code}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {dealer.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{dealer.city || '—'}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{dealer.phone || '—'}</td>
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-xs">{dealer.email || '—'}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                        {formatCurrency(dealer.credit_limit)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDealer(dealer);
                            setDetailDrawerOpen(true);
                          }}
                          className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                          title="View dealer details & orders"
                        >
                          <Eye className="h-3.5 w-3.5" />
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
              totalCount={data?.count || displayedDealers.length}
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

      {/* Modals and Drawers */}
      <CreateDealerModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={() => refetch()}
      />

      <DealerDetailDrawer
        dealer={selectedDealer}
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
      />
    </div>
  );
};

