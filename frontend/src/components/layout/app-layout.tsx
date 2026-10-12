import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { isDemoModeActive } from '@/lib/api-client';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const demoActive = isDemoModeActive();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header onOpenMobile={() => setMobileOpen(true)} />

        {demoActive && (
          <div className="bg-amber-500/10 border-b border-amber-200/60 px-4 py-1.5 text-center text-xs text-amber-900">
            <strong>Demo / Preview Mode Active:</strong> Operating against bundled dataset from <code className="font-mono text-[11px]">data/catalogue.csv</code> and <code className="font-mono text-[11px]">data/dealers.csv</code>. Turn off Demo Mode in the header to switch to the live Django backend.
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

