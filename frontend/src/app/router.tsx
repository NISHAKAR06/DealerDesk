import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingState } from '@/components/common/loading-state';

const DashboardPage = lazy(() =>
  import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage }))
);
const ProductsPage = lazy(() =>
  import('@/features/products/products-page').then((m) => ({ default: m.ProductsPage }))
);
const InventoryPage = lazy(() =>
  import('@/features/inventory/inventory-page').then((m) => ({ default: m.InventoryPage }))
);
const OrdersPage = lazy(() =>
  import('@/features/orders/orders-page').then((m) => ({ default: m.OrdersPage }))
);
const CreateOrderPage = lazy(() =>
  import('@/features/orders/create-order-page').then((m) => ({ default: m.CreateOrderPage }))
);
const OrderDetailPage = lazy(() =>
  import('@/features/orders/order-detail-page').then((m) => ({ default: m.OrderDetailPage }))
);
const DealersPage = lazy(() =>
  import('@/features/dealers/dealers-page').then((m) => ({ default: m.DealersPage }))
);
const AssistantPage = lazy(() =>
  import('@/features/assistant/assistant-page').then((m) => ({ default: m.AssistantPage }))
);
const ForecastingPage = lazy(() =>
  import('@/features/forecasting/forecasting-page').then((m) => ({ default: m.ForecastingPage }))
);
const IntegrationsPage = lazy(() =>
  import('@/features/integrations/integrations-page').then((m) => ({ default: m.IntegrationsPage }))
);
const SettingsPage = lazy(() =>
  import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage }))
);

const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingState message="Loading module..." />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'products',
        element: (
          <SuspenseWrapper>
            <ProductsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'inventory',
        element: (
          <SuspenseWrapper>
            <InventoryPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'orders',
        element: (
          <SuspenseWrapper>
            <OrdersPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'orders/new',
        element: (
          <SuspenseWrapper>
            <CreateOrderPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'orders/:orderNumber',
        element: (
          <SuspenseWrapper>
            <OrderDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'dealers',
        element: (
          <SuspenseWrapper>
            <DealersPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'assistant',
        element: (
          <SuspenseWrapper>
            <AssistantPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'forecasting',
        element: (
          <SuspenseWrapper>
            <ForecastingPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'integrations',
        element: (
          <SuspenseWrapper>
            <IntegrationsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
