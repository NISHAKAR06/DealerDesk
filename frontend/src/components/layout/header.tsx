import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  RefreshCw,
  Activity,
  Layers,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isDemoModeActive, setDemoMode } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { Button } from '@/components/ui/button';
import { navigationItems } from './sidebar';

interface HeaderProps {
  onOpenMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [demoMode, setLocalDemoMode] = useState(isDemoModeActive());

  // Listen to demo mode change events
  useEffect(() => {
    const handleDemoChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setLocalDemoMode(customEvent.detail);
    };
    window.addEventListener('dealerdesk:demomode-change', handleDemoChange);
    return () => window.removeEventListener('dealerdesk:demomode-change', handleDemoChange);
  }, []);

  // Backend Health Query
  const { data: healthData, isError, isLoading, refetch } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.health.check(),
    refetchInterval: 30000,
  });

  // Calculate current page title and breadcrumbs
  const currentNav = navigationItems.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  );

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Overview Dashboard';
    if (location.pathname === '/products') return 'Products Catalogue';
    if (location.pathname === '/inventory') return 'Inventory & Stock Management';
    if (location.pathname === '/orders/new') return 'Create New Order';
    if (location.pathname.startsWith('/orders/ORD-')) return 'Order Details';
    if (location.pathname === '/orders') return 'Orders Management';
    if (location.pathname === '/dealers') return 'Dealers Directory';
    if (location.pathname === '/assistant') return 'AI Dealer Assistant';
    if (location.pathname === '/forecasting') return 'Demand Forecasting & Reorder';
    if (location.pathname === '/integrations') return 'Supplier Catalogue Sync';
    if (location.pathname === '/settings') return 'Application Settings & Status';
    return currentNav?.name || 'Operations';
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
    }
  };

  const handleRefreshAll = () => {
    queryClient.invalidateQueries();
    refetch();
  };

  const handleToggleDemoMode = () => {
    const nextVal = !demoMode;
    setDemoMode(nextVal);
    setLocalDemoMode(nextVal);
    queryClient.invalidateQueries();
  };

  const isHealthy = !isError && healthData?.status;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-sm">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobile}
          className="lg:hidden h-9 w-9 text-slate-600"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span>DealerDesk</span>
            <span>/</span>
            <span className="text-slate-700">{currentNav?.name || 'Console'}</span>
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none mt-0.5">
            {getPageTitle()}
          </h1>
        </div>
      </div>

      {/* Middle & Right Controls */}
      <div className="flex items-center gap-3">
        {/* Global Product Search */}
        <form onSubmit={handleGlobalSearch} className="hidden md:flex relative items-center w-64 lg:w-72">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search parts by SKU, name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
        </form>

        {/* Global Refresh Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          title="Refresh live data"
          className="h-8 px-2.5 text-xs text-slate-600 gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {/* Demo Mode Toggle Pill */}
        <button
          type="button"
          onClick={handleToggleDemoMode}
          title={
            demoMode
              ? 'Demo Mode Active (Simulated using bundled data). Click to switch to Live Backend.'
              : 'Live Backend Active (http://127.0.0.1:8000). Click to toggle Demo Preview Mode.'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
            demoMode
              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
          }`}
        >
          <Layers className="h-3 w-3" />
          <span className="hidden sm:inline">{demoMode ? 'Demo Mode: ON' : 'Demo Mode: OFF'}</span>
          <span className="sm:hidden">{demoMode ? 'Demo' : 'Live'}</span>
        </button>

        {/* Backend Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            isLoading
              ? 'bg-slate-50 text-slate-600 border-slate-200'
              : isHealthy
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
          title={
            isLoading
              ? 'Checking backend connection...'
              : isHealthy
              ? 'Backend API reachable (/api/health/ OK)'
              : 'Backend disconnected (Ensure Django is running on port 8000)'
          }
        >
          <Activity className="h-3 w-3 shrink-0" />
          <span className="hidden xl:inline">
            {isLoading ? 'Checking API...' : isHealthy ? 'API Online' : 'API Offline'}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isLoading ? 'bg-slate-400' : isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
        </div>
      </div>
    </header>
  );
};

