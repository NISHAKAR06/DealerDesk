import React, { useState } from 'react';
import {
  RefreshCw,
  Server,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useRunSupplierSync } from '@/hooks/use-supplier-sync';
import { SupplierSyncResponse } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { parseApiError } from '@/lib/utils';
import { ErrorState } from '@/components/common/error-state';

export const IntegrationsPage: React.FC = () => {
  const toast = useToast();
  const syncMutation = useRunSupplierSync();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SupplierSyncResponse | null>(null);
  const [lastSyncError, setLastSyncError] = useState<unknown | null>(null);

  const handleStartSync = async () => {
    setConfirmOpen(false);
    setLastSyncError(null);

    try {
      const res = await syncMutation.mutateAsync();
      setSyncResult(res);
      toast.success(
        `Supplier catalog synced successfully. Created: ${res.created}, Updated: ${res.updated}, Unchanged: ${res.unchanged}`,
        'Sync Complete'
      );
    } catch (err) {
      setLastSyncError(err);
      const parsed = parseApiError(err);
      toast.error(
        parsed.message,
        `Supplier Synchronization Failed (${parsed.code})`
      );
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Supplier Catalogue Integration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Paginated cursor ingestion, rate-limit backoff handling, and catalogue synchronization.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={syncMutation.isPending}
          isLoading={syncMutation.isPending}
          className="gap-1.5 self-start md:self-auto"
        >
          <RefreshCw className="h-4 w-4" />
          {syncMutation.isPending ? 'Synchronizing Feed...' : 'Run Catalogue Sync'}
        </Button>
      </div>

      {/* Integration Overview & Configuration Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Supplier Feed Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1 text-xs">
            <div className="flex items-center gap-2 text-slate-900 font-mono font-medium">
              <Server className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>/v1/products</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Configured via <code className="font-mono text-slate-700">SUPPLIER_API_URL</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Security &amp; API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Header: X-Api-Key</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Read securely from environment (<code className="font-mono text-slate-700">SUPPLIER_API_KEY</code>)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Execution Protocol
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1 text-xs">
            <div className="font-semibold text-slate-800">Synchronous All-or-Nothing</div>
            <p className="text-[11px] text-slate-500">
              Cursor pagination with max 5 retries on 429/5xx errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contract Guarantee Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50/50 border border-blue-200 text-xs text-blue-900">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="block font-semibold">Warehouse Stock Isolation Guarantee:</strong>
          <p className="leading-relaxed">
            Per the assignment contract, supplier catalog synchronization updates product metadata and creates missing SKUs with stock 0. It <strong>never</strong> modifies local warehouse inventory stock.
          </p>
        </div>
      </div>

      {/* Active Sync Progress State */}
      {syncMutation.isPending && (
        <Card className="border-indigo-200 bg-indigo-50/20">
          <CardContent className="p-8 text-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">
              Synchronizing Supplier Feed...
            </h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Fetching cursor-paginated catalog pages from supplier API, respecting rate limits, handling backoff retries, and applying latest SKU revisions. This operation may take up to 120 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sync Error Display */}
      {Boolean(lastSyncError) && !syncMutation.isPending && (
        <ErrorState
          error={lastSyncError}
          title="Supplier Synchronization Failed"
          onRetry={() => handleStartSync()}
        />
      )}

      {/* Sync Results Summary Cards */}
      {syncResult && !syncMutation.isPending && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Sync Execution Results
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Requests: {syncResult.requests_made} | Pages: {syncResult.pages_fetched}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Created SKUs</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {syncResult.created}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Stock initialized to 0</div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Updated SKUs</div>
              <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
                {syncResult.updated}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Metadata revisions applied</div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Unchanged SKUs</div>
              <div className="text-2xl font-bold font-mono text-slate-700 mt-1">
                {syncResult.unchanged}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Identical fields preserved</div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200 text-center">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Rejected Items</div>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
                {syncResult.rejected?.length || 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Malformed price or SKU</div>
            </div>
          </div>

          {/* Rejected Items Table */}
          {syncResult.rejected && syncResult.rejected.length > 0 && (
            <Card className="border-rose-200">
              <CardHeader className="py-3 px-5 bg-rose-50/50 border-b border-rose-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-rose-900 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  Rejected Supplier Items ({syncResult.rejected.length})
                </CardTitle>
                <span className="text-[11px] text-rose-700">
                  Skipped per contract rules (§8.3)
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Supplier SKU</th>
                      <th className="py-2.5 px-4">Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                    {syncResult.rejected.map((rej, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-rose-700">
                          {rej.supplier_sku}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-700">{rej.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Confirmation Dialog before Running Sync */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Start Supplier Catalogue Sync"
        description="This will execute a full synchronous pull from the supplier API (POST /api/sync/supplier/). It will fetch all paginated cursor pages, backoff on rate limits, create missing items, and update changed catalogue fields. Local inventory stock will not be touched."
        confirmLabel="Execute Full Sync"
        onConfirm={handleStartSync}
      />
    </div>
  );
};

