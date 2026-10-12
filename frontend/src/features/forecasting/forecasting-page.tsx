import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Search,
  Info,
  Calendar,
  Layers,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useReorderSuggestions, useSkuForecast } from '@/hooks/use-forecasting';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { StockBadge } from '@/components/common/status-badge';

export const ForecastingPage: React.FC = () => {
  const [searchSku, setSearchSku] = useState('');
  const [selectedSku, setSelectedSku] = useState<string>('FIL-1012');

  // Query reorder suggestions
  const {
    data: reorderData,
    isLoading: reorderLoading,
    error: reorderError,
    refetch: refetchReorder,
  } = useReorderSuggestions();

  // Query 4-week forecast for selected SKU
  const {
    data: skuForecastData,
    isLoading: forecastLoading,
    error: forecastError,
    refetch: refetchSkuForecast,
  } = useSkuForecast(selectedSku, Boolean(selectedSku));

  const suggestions = reorderData?.results || [];

  // Filter suggestions by search
  const filteredSuggestions = searchSku.trim()
    ? suggestions.filter((s) =>
        s.sku.toLowerCase().includes(searchSku.trim().toLowerCase())
      )
    : suggestions;

  // Prepare chart data from 4-week forecast endpoint
  const chartData =
    skuForecastData?.forecast?.map((pt) => ({
      week: pt.week_start,
      'Predicted Demand (Units)': pt.forecast_units,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Inventory Forecasting &amp; Reorder Optimization
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Statistical safety-stock models, lead-time demand buffers, and ML-assisted demand projection.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-md border border-slate-200">
          <TrendingUp className="h-4 w-4 text-indigo-600 shrink-0" />
          <span>
            Formula: <code className="font-mono text-slate-800">ROP = Lead-time Demand + Safety Stock</code>
          </span>
        </div>
      </div>

      {/* Reorder Summary Stat Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Forecasted Part SKUs
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {reorderLoading ? '...' : suggestions.length}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Monitored spare-parts portfolio</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Reorder Required
              </p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">
                {reorderLoading
                  ? '...'
                  : suggestions.filter((s) => s.reorder_qty > 0).length}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Stock below calculated reorder point</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Forecast Horizon
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                4 Future Weeks
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">2026-09-28 to 2026-10-19</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected SKU 4-Week Demand Visualization */}
      <Card>
        <CardHeader className="py-4 px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              Four-Week Demand Forecast: <span className="font-mono text-indigo-600">{selectedSku}</span>
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              API endpoint: <code className="font-mono text-slate-700">GET /api/forecast/{selectedSku}/</code>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Select Forecast SKU:</span>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {suggestions.map((s) => (
                <option key={s.sku} value={s.sku}>
                  {s.sku}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {forecastLoading ? (
            <LoadingState message={`Loading forecast projection for ${selectedSku}...`} />
          ) : forecastError ? (
            <div className="p-4">
              <ErrorState
                error={forecastError}
                onRetry={() => refetchSkuForecast()}
                compact
              />
            </div>
          ) : chartData.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No demand forecast points returned for SKU {selectedSku}.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      unit=" units"
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val} units`, 'Projected Demand']}
                      labelFormatter={(label) => `Week Starting: ${label}`}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        fontSize: 12,
                        borderRadius: 6,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar
                      dataKey="Predicted Demand (Units)"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-start gap-2 p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Statistical Notice:</strong> Forecast projections represent statistical estimates derived from historical velocity and lead-time distributions.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 40 SKU Reorder Suggestions Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Reorder Suggestions &amp; Safety Stock Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Live safety-stock and lead-time calculation across all monitored automotive parts.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by SKU..."
              value={searchSku}
              onChange={(e) => setSearchSku(e.target.value)}
              leftIcon={<Search className="h-3.5 w-3.5" />}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {reorderLoading ? (
            <LoadingState message="Loading reorder suggestions..." />
          ) : reorderError ? (
            <div className="p-6">
              <ErrorState error={reorderError} onRetry={() => refetchReorder()} />
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <EmptyState
              title="No Reorder Suggestions Found"
              description="Ensure ml/forecast.csv and data/lead_times.csv are seeded and the endpoint GET /api/reorder-suggestions/ is responding."
              actionLabel="Retry"
              onAction={() => refetchReorder()}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Lead Time</th>
                    <th className="py-3 px-4 text-right">Lead-Time Demand</th>
                    <th className="py-3 px-4 text-right">Safety Stock</th>
                    <th className="py-3 px-4 text-right">Reorder Point (ROP)</th>
                    <th className="py-3 px-4 text-center">Recommended Reorder</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSuggestions.map((item) => {
                    const needsReorder = item.reorder_qty > 0;
                    return (
                      <tr
                        key={item.sku}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          selectedSku === item.sku ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {item.sku}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StockBadge stock={item.current_stock} />
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {item.lead_time_weeks} {item.lead_time_weeks === 1 ? 'wk' : 'wks'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {item.lead_time_demand}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {item.safety_stock}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {item.reorder_point}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {needsReorder ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono font-bold text-xs bg-amber-100 text-amber-800 border border-amber-200">
                              Reorder {item.reorder_qty}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedSku(item.sku)}
                            className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Chart Forecast
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

