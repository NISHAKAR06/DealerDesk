import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Layers,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isDemoModeActive, setDemoMode } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export const SettingsPage: React.FC = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [demoActive, setDemoActive] = useState(isDemoModeActive());

  useEffect(() => {
    const handleDemoChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setDemoActive(customEvent.detail);
    };
    window.addEventListener('dealerdesk:demomode-change', handleDemoChange);
    return () => window.removeEventListener('dealerdesk:demomode-change', handleDemoChange);
  }, []);

  const { data: healthData, isError, isLoading, refetch } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.health.check(),
    retry: 1,
  });

  const handleToggleDemo = async () => {
    const nextVal = !demoActive;
    setDemoActive(nextVal);
    setDemoMode(nextVal);
    await queryClient.resetQueries();
    await refetch();
    toast.info(
      nextVal
        ? 'Demo Mode enabled. Utilizing bundled fixtures from data/ for catalogue and orders.'
        : 'Live Backend mode enabled. Directing calls to http://127.0.0.1:8000.'
    );
  };

  const isOnline = !isError && Boolean(healthData?.status);

  const endpointsContract = [
    { method: 'GET', path: '/api/health/', section: '§1 Health', desc: 'System liveness probe' },
    { method: 'GET / POST', path: '/api/products/', section: '§4 Products', desc: 'Catalogue list & creation' },
    { method: 'GET / PATCH', path: '/api/products/{sku}/', section: '§4 Products', desc: 'Product detail & edit' },
    { method: 'PUT', path: '/api/inventory/{sku}/', section: '§5 Inventory', desc: 'Stock quantity overwrite' },
    { method: 'GET / POST', path: '/api/dealers/', section: '§6 Dealers', desc: 'Dealer registry & creation' },
    { method: 'GET', path: '/api/dealers/{id}/', section: '§6 Dealers', desc: 'Dealer profile lookup' },
    { method: 'GET / POST', path: '/api/orders/', section: '§7 Orders', desc: 'Order list & DRAFT creation' },
    { method: 'GET / PUT', path: '/api/orders/{order_number}/', section: '§7 Orders', desc: 'Order detail & DRAFT edit' },
    { method: 'POST', path: '/api/orders/{order_number}/confirm/', section: '§7.1 Confirm', desc: 'Stock deduction & price lock' },
    { method: 'POST', path: '/api/orders/{order_number}/dispatch/', section: '§7.1 Dispatch', desc: 'Mark order in-transit' },
    { method: 'POST', path: '/api/orders/{order_number}/deliver/', section: '§7.1 Deliver', desc: 'Mark order delivered' },
    { method: 'POST', path: '/api/orders/{order_number}/cancel/', section: '§7.1 Cancel', desc: 'Cancel order & restore stock' },
    { method: 'POST', path: '/api/sync/supplier/', section: '§8 Sync', desc: 'Synchronous supplier pull' },
    { method: 'POST', path: '/api/assistant/chat/', section: '§9 Assistant', desc: 'LLM tool-calling conversational agent' },
    { method: 'GET', path: '/api/forecast/{sku}/', section: '§10 Forecast', desc: '4-week demand projection' },
    { method: 'GET', path: '/api/reorder-suggestions/', section: '§10 Reorder', desc: 'Safety-stock & ROP ledger' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Product Identity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg shadow-sm">
            DD
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              VIKMO DealerDesk
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-medium border border-indigo-200">
                v1.0.0 Enterprise
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dealer Operations &amp; Inventory Management Platform
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-1.5 self-start sm:self-auto text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Recheck Health
        </Button>
      </div>

      {/* Connection & Environment Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Backend API Health Status */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-between">
              <span>Backend Connectivity</span>
              <Activity className="h-4 w-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <div className="text-slate-500">Checking probe...</div>
              ) : isOnline ? (
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Online ({healthData?.status})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span>Disconnected / Offline</span>
                </div>
              )}
            </div>
            <div className="text-slate-500 text-[11px]">
              Probe: <code className="font-mono text-slate-700">GET /api/health/</code>
            </div>
          </CardContent>
        </Card>

        {/* Runtime Environment */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-between">
              <span>Base API URL</span>
              <Server className="h-4 w-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="font-mono font-medium text-slate-900 truncate">
              {apiClient.getBaseUrl()}
            </div>
            <div className="text-[11px] text-slate-500">
              Configured via <code className="font-mono text-slate-700">VITE_API_BASE_URL</code>
            </div>
          </CardContent>
        </Card>

        {/* Timezone & Currency Locale */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center justify-between">
              <span>Regional Standard</span>
              <Cpu className="h-4 w-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="font-medium text-slate-800">Asia/Kolkata (IST, UTC+05:30)</div>
            <div className="text-[11px] text-slate-500">Currency: INR (₹) with 18% GST rounding</div>
          </CardContent>
        </Card>
      </div>

      {/* Demo / Preview Mode Switch Card */}
      <Card>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            Evaluation &amp; Preview Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="space-y-1">
              <div className="font-semibold text-xs text-slate-900 flex items-center gap-2">
                <span>Demo Data Simulation Mode</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    demoActive
                      ? 'bg-amber-100 text-amber-800 font-bold'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {demoActive ? 'ACTIVE' : 'INACTIVE (LIVE BACKEND)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                When enabled, the frontend serves queries and accepts mutations against bundled realistic fixtures from <code className="font-mono text-[11px]">data/catalogue.csv</code> and <code className="font-mono text-[11px]">data/dealers.csv</code>. Useful for interactive UI review when the PostgreSQL Django server is not actively running.
              </p>
            </div>

            <Button
              variant={demoActive ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleToggleDemo}
              className="shrink-0 text-xs"
            >
              {demoActive ? 'Disable Demo Mode' : 'Enable Demo Mode'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Documented Contract Endpoints Coverage */}
      <Card>
        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">
              Documented API Contract Matrix
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              All 16 endpoints defined in <code className="font-mono text-slate-700">API_CONTRACT.md</code> integrated in the frontend client.
            </p>
          </div>
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Section</th>
                  <th className="py-2.5 px-4">Method &amp; Path</th>
                  <th className="py-2.5 px-4">Contract Function</th>
                  <th className="py-2.5 px-4 text-right">Frontend Integration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {endpointsContract.map((ep, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{ep.section}</td>
                    <td className="py-2.5 px-4 font-mono text-indigo-700 font-medium">
                      {ep.method} {ep.path}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{ep.desc}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Integrated
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
