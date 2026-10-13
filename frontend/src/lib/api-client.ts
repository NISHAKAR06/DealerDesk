import axios, { AxiosInstance } from 'axios';
import {
  Product,
  ProductCreateParams,
  ProductUpdateParams,
  ProductFilters,
  PaginatedResponse,
  InventoryAdjustmentRequest,
  InventoryAdjustmentResponse,
  Dealer,
  DealerCreateParams,
  DealerFilters,
  Order,
  OrderCreateInput,
  OrderUpdateInput,
  OrderFilters,
  AssistantRequest,
  AssistantResponse,
  ForecastResponse,
  ReorderSuggestionsResponse,
  SupplierSyncResponse,
  HealthResponse,
} from '@/types/api';
import {
  DEMO_PRODUCTS,
  DEMO_DEALERS,
  DEMO_ORDERS,
  DEMO_REORDER_SUGGESTIONS,
  DEMO_SYNC_RESULT,
} from './demo-data';
const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
function resolveBaseUrl(): string {
  if (envBaseUrl !== undefined && envBaseUrl !== '') {
    return envBaseUrl;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '';
  }
  return import.meta.env.PROD ? '' : 'http://127.0.0.1:8000';
}
const BASE_URL = resolveBaseUrl();

// Mock/Demo mode is strictly OFF by default and only active when explicitly toggled ON by the user in the UI
export function isDemoModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('dealerdesk_demo_mode') === 'true';
}

// In-memory demo state if preview mode is toggled on
const demoState = {
  products: [...DEMO_PRODUCTS],
  dealers: [...DEMO_DEALERS],
  orders: [...DEMO_ORDERS],
};

export function setDemoMode(active: boolean): void {
  demoState.products = [...DEMO_PRODUCTS];
  demoState.dealers = [...DEMO_DEALERS];
  demoState.orders = [...DEMO_ORDERS];
  if (typeof window !== 'undefined') {
    if (active) {
      localStorage.setItem('dealerdesk_demo_mode', 'true');
    } else {
      localStorage.removeItem('dealerdesk_demo_mode');
    }
    window.dispatchEvent(new CustomEvent('dealerdesk:demomode-change', { detail: active }));
  }
}

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response interceptor to ensure standard error shape parsing
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export const apiClient = {
  getBaseUrl(): string {
    return BASE_URL;
  },

  health: {
    async check(): Promise<HealthResponse> {
      if (isDemoModeActive()) {
        return { status: 'ok (demo-mode)' };
      }
      const res = await axiosInstance.get<HealthResponse>('/api/health/');
      return res.data;
    },
  },

  products: {
    async list(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
      if (isDemoModeActive()) {
        let items = [...demoState.products];
        if (filters?.search) {
          const q = filters.search.toLowerCase();
          items = items.filter(
            (p) =>
              p.sku.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.brand.toLowerCase().includes(q)
          );
        }
        if (filters?.category) {
          items = items.filter((p) => p.category === filters.category);
        }
        if (filters?.vehicle) {
          const v = filters.vehicle.toLowerCase();
          items = items.filter((p) => p.vehicle_fitment.toLowerCase().includes(v));
        }
        const pageSize = filters?.page_size || 20;
        const page = filters?.page || 1;
        const start = (page - 1) * pageSize;
        const pageResults = items.slice(start, start + pageSize);

        return {
          count: items.length,
          next: start + pageSize < items.length ? `?page=${page + 1}` : null,
          previous: page > 1 ? `?page=${page - 1}` : null,
          results: pageResults,
        };
      }

      const params: Record<string, string | number> = {};
      if (filters?.search) params.search = filters.search;
      if (filters?.category) params.category = filters.category;
      if (filters?.vehicle) params.vehicle = filters.vehicle;
      if (filters?.page) params.page = filters.page;
      if (filters?.page_size) params.page_size = filters.page_size;

      const res = await axiosInstance.get<PaginatedResponse<Product>>('/api/products/', { params });
      return res.data;
    },

    async get(sku: string): Promise<Product> {
      if (isDemoModeActive()) {
        const found = demoState.products.find((p) => p.sku === sku);
        if (!found) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: `Product ${sku} not found`, details: [] } },
            },
          };
        }
        return found;
      }
      const res = await axiosInstance.get<Product>(`/api/products/${encodeURIComponent(sku)}/`);
      return res.data;
    },

    async create(data: ProductCreateParams): Promise<Product> {
      if (isDemoModeActive()) {
        if (demoState.products.some((p) => p.sku === data.sku)) {
          throw {
            response: {
              status: 409,
              data: { error: { code: 'DUPLICATE', message: `Product ${data.sku} already exists`, details: [] } },
            },
          };
        }
        const newProduct: Product = {
          ...data,
          stock: 0,
        };
        demoState.products.unshift(newProduct);
        return newProduct;
      }
      const res = await axiosInstance.post<Product>('/api/products/', data);
      return res.data;
    },

    async update(sku: string, data: ProductUpdateParams): Promise<Product> {
      if (isDemoModeActive()) {
        const idx = demoState.products.findIndex((p) => p.sku === sku);
        if (idx === -1) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: `Product ${sku} not found`, details: [] } },
            },
          };
        }
        demoState.products[idx] = { ...demoState.products[idx], ...data };
        return demoState.products[idx];
      }
      const res = await axiosInstance.patch<Product>(`/api/products/${encodeURIComponent(sku)}/`, data);
      return res.data;
    },
  },

  inventory: {
    async adjust(sku: string, data: InventoryAdjustmentRequest): Promise<InventoryAdjustmentResponse> {
      if (isDemoModeActive()) {
        const prod = demoState.products.find((p) => p.sku === sku);
        if (!prod) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: `Product ${sku} not found`, details: [] } },
            },
          };
        }
        prod.stock = data.quantity;
        return { sku, quantity: data.quantity };
      }
      const res = await axiosInstance.put<InventoryAdjustmentResponse>(
        `/api/inventory/${encodeURIComponent(sku)}/`,
        data
      );
      return res.data;
    },
  },

  dealers: {
    async list(filters?: DealerFilters): Promise<PaginatedResponse<Dealer>> {
      if (isDemoModeActive()) {
        const items = [...demoState.dealers];
        const pageSize = filters?.page_size || 20;
        const page = filters?.page || 1;
        const start = (page - 1) * pageSize;
        return {
          count: items.length,
          next: start + pageSize < items.length ? `?page=${page + 1}` : null,
          previous: page > 1 ? `?page=${page - 1}` : null,
          results: items.slice(start, start + pageSize),
        };
      }
      const params: Record<string, number> = {};
      if (filters?.page) params.page = filters.page;
      if (filters?.page_size) params.page_size = filters.page_size;

      const res = await axiosInstance.get<PaginatedResponse<Dealer>>('/api/dealers/', { params });
      return res.data;
    },

    async get(id: number): Promise<Dealer> {
      if (isDemoModeActive()) {
        const found = demoState.dealers.find((d) => d.id === id);
        if (!found) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: `Dealer ${id} not found`, details: [] } },
            },
          };
        }
        return found;
      }
      const res = await axiosInstance.get<Dealer>(`/api/dealers/${id}/`);
      return res.data;
    },

    async create(data: DealerCreateParams): Promise<Dealer> {
      if (isDemoModeActive()) {
        if (demoState.dealers.some((d) => d.dealer_code === data.dealer_code)) {
          throw {
            response: {
              status: 409,
              data: {
                error: {
                  code: 'DUPLICATE',
                  message: `Dealer code ${data.dealer_code} already exists`,
                  details: [],
                },
              },
            },
          };
        }
        const nextId = Math.max(...demoState.dealers.map((d) => d.id), 0) + 1;
        const newDealer: Dealer = {
          id: nextId,
          ...data,
        };
        demoState.dealers.push(newDealer);
        return newDealer;
      }
      const res = await axiosInstance.post<Dealer>('/api/dealers/', data);
      return res.data;
    },
  },

  orders: {
    async list(filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
      if (isDemoModeActive()) {
        let items = [...demoState.orders];
        if (filters?.dealer_id) {
          items = items.filter((o) => o.dealer_id === filters.dealer_id);
        }
        if (filters?.status) {
          items = items.filter((o) => o.status === filters.status);
        }
        const pageSize = filters?.page_size || 20;
        const page = filters?.page || 1;
        const start = (page - 1) * pageSize;
        return {
          count: items.length,
          next: start + pageSize < items.length ? `?page=${page + 1}` : null,
          previous: page > 1 ? `?page=${page - 1}` : null,
          results: items.slice(start, start + pageSize),
        };
      }
      const params: Record<string, string | number> = {};
      if (filters?.dealer_id) params.dealer_id = filters.dealer_id;
      if (filters?.status) params.status = filters.status;
      if (filters?.page) params.page = filters.page;
      if (filters?.page_size) params.page_size = filters.page_size;

      const res = await axiosInstance.get<PaginatedResponse<Order>>('/api/orders/', { params });
      return res.data;
    },

    async get(orderNumber: string): Promise<Order> {
      if (isDemoModeActive()) {
        const found = demoState.orders.find((o) => o.order_number === orderNumber);
        if (!found) {
          throw {
            response: {
              status: 404,
              data: {
                error: {
                  code: 'NOT_FOUND',
                  message: `Order ${orderNumber} not found`,
                  details: [],
                },
              },
            },
          };
        }
        return found;
      }
      const res = await axiosInstance.get<Order>(`/api/orders/${encodeURIComponent(orderNumber)}/`);
      return res.data;
    },

    async create(data: OrderCreateInput, idempotencyKey?: string): Promise<Order> {
      if (isDemoModeActive()) {
        if (!data.items || data.items.length === 0) {
          throw {
            response: {
              status: 400,
              data: {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Order must contain at least one item',
                  details: [],
                },
              },
            },
          };
        }
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const orderSeq = String(demoState.orders.length + 1).padStart(4, '0');
        const orderNumber = `ORD-${today}-${orderSeq}`;

        let subtotalNum = 0;
        let taxTotalNum = 0;

        const builtItems = data.items.map((item) => {
          const prod = demoState.products.find((p) => p.sku === item.sku);
          const unitPriceNum = prod ? parseFloat(prod.price) : 1000.0;
          const lineSub = unitPriceNum * item.quantity;
          const lineTax = Math.round(lineSub * 0.18 * 100) / 100;
          const lineTot = lineSub + lineTax;
          subtotalNum += lineSub;
          taxTotalNum += lineTax;
          return {
            sku: item.sku,
            name: prod?.name || item.sku,
            quantity: item.quantity,
            unit_price: unitPriceNum.toFixed(2),
            line_subtotal: lineSub.toFixed(2),
            line_tax: lineTax.toFixed(2),
            line_total: lineTot.toFixed(2),
          };
        });

        const newOrder: Order = {
          order_number: orderNumber,
          dealer_id: data.dealer_id,
          status: 'DRAFT',
          items: builtItems,
          subtotal: subtotalNum.toFixed(2),
          tax_total: taxTotalNum.toFixed(2),
          grand_total: (subtotalNum + taxTotalNum).toFixed(2),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        demoState.orders.unshift(newOrder);
        return newOrder;
      }

      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      const res = await axiosInstance.post<Order>('/api/orders/', data, { headers });
      return res.data;
    },

    async update(orderNumber: string, data: OrderUpdateInput): Promise<Order> {
      if (isDemoModeActive()) {
        const order = demoState.orders.find((o) => o.order_number === orderNumber);
        if (!order) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: 'Order not found', details: [] } },
            },
          };
        }
        if (order.status !== 'DRAFT') {
          throw {
            response: {
              status: 409,
              data: { error: { code: 'ORDER_LOCKED', message: 'Only DRAFT orders can be edited', details: [] } },
            },
          };
        }
        // rebuild items
        let subtotalNum = 0;
        let taxTotalNum = 0;
        order.items = data.items.map((item) => {
          const prod = demoState.products.find((p) => p.sku === item.sku);
          const unitPriceNum = prod ? parseFloat(prod.price) : 1000.0;
          const lineSub = unitPriceNum * item.quantity;
          const lineTax = Math.round(lineSub * 0.18 * 100) / 100;
          subtotalNum += lineSub;
          taxTotalNum += lineTax;
          return {
            sku: item.sku,
            name: prod?.name || item.sku,
            quantity: item.quantity,
            unit_price: unitPriceNum.toFixed(2),
            line_subtotal: lineSub.toFixed(2),
            line_tax: lineTax.toFixed(2),
            line_total: (lineSub + lineTax).toFixed(2),
          };
        });
        order.subtotal = subtotalNum.toFixed(2);
        order.tax_total = taxTotalNum.toFixed(2);
        order.grand_total = (subtotalNum + taxTotalNum).toFixed(2);
        order.updated_at = new Date().toISOString();
        return order;
      }
      const res = await axiosInstance.put<Order>(`/api/orders/${encodeURIComponent(orderNumber)}/`, data);
      return res.data;
    },

    async confirm(orderNumber: string): Promise<Order> {
      if (isDemoModeActive()) {
        const order = demoState.orders.find((o) => o.order_number === orderNumber);
        if (!order) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: 'Order not found', details: [] } },
            },
          };
        }
        if (order.status !== 'DRAFT') {
          throw {
            response: {
              status: 409,
              data: {
                error: {
                  code: 'INVALID_TRANSITION',
                  message: `Cannot confirm order in status ${order.status}`,
                  details: [],
                },
              },
            },
          };
        }
        // Check stock
        for (const item of order.items) {
          const p = demoState.products.find((prod) => prod.sku === item.sku);
          if (p && p.stock < item.quantity) {
            throw {
              response: {
                status: 409,
                data: {
                  error: {
                    code: 'INSUFFICIENT_STOCK',
                    message: `Insufficient stock for ${item.name}. Available: ${p.stock}, Requested: ${item.quantity}`,
                    details: [{ sku: item.sku, requested: item.quantity, available: p.stock }],
                  },
                },
              },
            };
          }
        }
        // Deduct stock
        for (const item of order.items) {
          const p = demoState.products.find((prod) => prod.sku === item.sku);
          if (p) p.stock -= item.quantity;
        }
        order.status = 'CONFIRMED';
        order.updated_at = new Date().toISOString();
        return order;
      }
      const res = await axiosInstance.post<Order>(`/api/orders/${encodeURIComponent(orderNumber)}/confirm/`);
      return res.data;
    },

    async dispatch(orderNumber: string): Promise<Order> {
      if (isDemoModeActive()) {
        const order = demoState.orders.find((o) => o.order_number === orderNumber);
        if (!order) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: 'Order not found', details: [] } },
            },
          };
        }
        if (order.status !== 'CONFIRMED') {
          throw {
            response: {
              status: 409,
              data: {
                error: {
                  code: 'INVALID_TRANSITION',
                  message: `Cannot dispatch order in status ${order.status}`,
                  details: [],
                },
              },
            },
          };
        }
        order.status = 'DISPATCHED';
        order.updated_at = new Date().toISOString();
        return order;
      }
      const res = await axiosInstance.post<Order>(`/api/orders/${encodeURIComponent(orderNumber)}/dispatch/`);
      return res.data;
    },

    async deliver(orderNumber: string): Promise<Order> {
      if (isDemoModeActive()) {
        const order = demoState.orders.find((o) => o.order_number === orderNumber);
        if (!order) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: 'Order not found', details: [] } },
            },
          };
        }
        if (order.status !== 'DISPATCHED') {
          throw {
            response: {
              status: 409,
              data: {
                error: {
                  code: 'INVALID_TRANSITION',
                  message: `Cannot deliver order in status ${order.status}`,
                  details: [],
                },
              },
            },
          };
        }
        order.status = 'DELIVERED';
        order.updated_at = new Date().toISOString();
        return order;
      }
      const res = await axiosInstance.post<Order>(`/api/orders/${encodeURIComponent(orderNumber)}/deliver/`);
      return res.data;
    },

    async cancel(orderNumber: string): Promise<Order> {
      if (isDemoModeActive()) {
        const order = demoState.orders.find((o) => o.order_number === orderNumber);
        if (!order) {
          throw {
            response: {
              status: 404,
              data: { error: { code: 'NOT_FOUND', message: 'Order not found', details: [] } },
            },
          };
        }
        if (order.status !== 'DRAFT' && order.status !== 'CONFIRMED') {
          throw {
            response: {
              status: 409,
              data: {
                error: {
                  code: 'INVALID_TRANSITION',
                  message: `Cannot cancel order in status ${order.status}`,
                  details: [],
                },
              },
            },
          };
        }
        // If CONFIRMED, restore stock
        if (order.status === 'CONFIRMED') {
          for (const item of order.items) {
            const p = demoState.products.find((prod) => prod.sku === item.sku);
            if (p) p.stock += item.quantity;
          }
        }
        order.status = 'CANCELLED';
        order.updated_at = new Date().toISOString();
        return order;
      }
      const res = await axiosInstance.post<Order>(`/api/orders/${encodeURIComponent(orderNumber)}/cancel/`);
      return res.data;
    },
  },

  assistant: {
    async chat(data: AssistantRequest): Promise<AssistantResponse> {
      if (isDemoModeActive()) {
        const q = data.message.toLowerCase();
        let reply = "I can assist you with product catalogue searches, checking live inventory stock, and creating draft orders.";
        const cited_skus: string[] = [];
        const tool_calls = [];
        const actions = [];

        if (q.includes('pulsar') || q.includes('brake') || q.includes('brk-1044')) {
          reply = "Found 1 matching part for Bajaj Pulsar 150: Endurance Brake Pad Set (SKU: BRK-1044). Available stock is 136 units at ₹1,459.50 each.";
          cited_skus.push('BRK-1044');
          tool_calls.push({
            name: 'search_parts',
            arguments: { query: 'brake pads', vehicle: 'Bajaj Pulsar 150' },
          });
        } else if (q.includes('order') || q.includes('create draft')) {
          const orderNum = `ORD-20261012-${String(demoState.orders.length + 1).padStart(4, '0')}`;
          reply = `Created draft order ${orderNum} for Dealer ${data.dealer_id} with 2x BRK-1044.`;
          cited_skus.push('BRK-1044');
          tool_calls.push({
            name: 'create_draft_order',
            arguments: { dealer_id: data.dealer_id, items: [{ sku: 'BRK-1044', quantity: 2 }] },
          });
          actions.push({
            type: 'draft_order_created',
            order_number: orderNum,
          });
        }

        return {
          reply,
          cited_skus,
          tool_calls,
          actions,
        };
      }
      const res = await axiosInstance.post<AssistantResponse>('/api/assistant/chat/', data, {
        timeout: 90000,
      });
      return res.data;
    },
  },

  forecasting: {
    async getSkuForecast(sku: string): Promise<ForecastResponse> {
      if (isDemoModeActive()) {
        return {
          sku,
          forecast: [
            { week_start: '2026-09-28', forecast_units: 31.4 },
            { week_start: '2026-10-05', forecast_units: 28.5 },
            { week_start: '2026-10-12', forecast_units: 35.0 },
            { week_start: '2026-10-19', forecast_units: 30.2 },
          ],
        };
      }
      const res = await axiosInstance.get<ForecastResponse>(`/api/forecast/${encodeURIComponent(sku)}/`);
      return res.data;
    },

    async getReorderSuggestions(): Promise<ReorderSuggestionsResponse> {
      if (isDemoModeActive()) {
        return {
          results: DEMO_REORDER_SUGGESTIONS,
        };
      }
      const res = await axiosInstance.get<ReorderSuggestionsResponse>('/api/reorder-suggestions/');
      return res.data;
    },
  },

  supplierSync: {
    async sync(): Promise<SupplierSyncResponse> {
      if (isDemoModeActive()) {
        return DEMO_SYNC_RESULT;
      }
      const res = await axiosInstance.post<SupplierSyncResponse>('/api/sync/supplier/', null, {
        timeout: 130000,
      });
      return res.data;
    },
  },
};
