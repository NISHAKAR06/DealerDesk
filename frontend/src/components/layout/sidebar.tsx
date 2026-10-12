import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  Bot,
  TrendingUp,
  RefreshCw,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const navigationItems = [
  { name: 'Overview', to: '/', icon: LayoutDashboard },
  { name: 'Products', to: '/products', icon: Package },
  { name: 'Inventory', to: '/inventory', icon: Boxes },
  { name: 'Orders', to: '/orders', icon: ShoppingCart },
  { name: 'Dealers', to: '/dealers', icon: Users },
  { name: 'AI Assistant', to: '/assistant', icon: Bot },
  { name: 'Forecasting', to: '/forecasting', icon: TrendingUp },
  { name: 'Supplier Sync', to: '/integrations', icon: RefreshCw },
  { name: 'Settings', to: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 lg:static',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <NavLink
            to="/"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 overflow-hidden focus:outline-none"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-sm">
              DD
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-tight text-slate-900 truncate">
                  DealerDesk
                </span>
                <span className="text-[10px] font-medium text-slate-500 truncate tracking-wide">
                  Operations &amp; Inventory
                </span>
              </div>
            )}
          </NavLink>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden lg:flex h-7 w-7 text-slate-400 hover:text-slate-600"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {!collapsed && (
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Operations Modules
            </div>
          )}

          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-xs font-medium transition-colors select-none',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? item.name : undefined}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    'transition-colors'
                  )}
                />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* System info footer */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/50">
          {!collapsed ? (
            <div className="flex items-center gap-2 rounded-md bg-white p-2 border border-slate-200/80">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-slate-800 truncate">
                  Enterprise Node
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Auth: Disabled by spec
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title="Enterprise Node (No Auth)">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

