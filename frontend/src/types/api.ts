export interface Product {
  sku: string;
  name: string;
  category: string;
  brand: string;
  vehicle_fitment: string;
  price: string; // "1459.50"
  stock: number;
  description: string;
}

export interface ProductCreateParams {
  sku: string;
  name: string;
  category: string;
  brand: string;
  vehicle_fitment: string;
  price: string;
  description: string;
}

export interface ProductUpdateParams {
  name?: string;
  category?: string;
  brand?: string;
  vehicle_fitment?: string;
  price?: string;
  description?: string;
}

export interface InventoryAdjustmentRequest {
  quantity: number;
  reason: string;
}

export interface InventoryAdjustmentResponse {
  sku: string;
  quantity: number;
}

export interface Dealer {
  id: number;
  dealer_code: string;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  credit_limit?: string;
}

export interface DealerCreateParams {
  dealer_code: string;
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  credit_limit?: string;
}

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unit_price: string;
  line_subtotal: string;
  line_tax: string;
  line_total: string;
}

export interface Order {
  order_number: string;
  dealer_id: number;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: string;
  tax_total: string;
  grand_total: string;
  created_at: string;
  updated_at: string;
}

export interface OrderCreateItemInput {
  sku: string;
  quantity: number;
}

export interface OrderCreateInput {
  dealer_id: number;
  items: OrderCreateItemInput[];
}

export interface OrderUpdateInput {
  items: OrderCreateItemInput[];
}

export interface AssistantToolCall {
  name: 'search_parts' | 'check_stock' | 'create_draft_order' | string;
  arguments: Record<string, unknown>;
}

export interface AssistantAction {
  type: 'draft_order_created' | string;
  order_number?: string;
  [key: string]: unknown;
}

export interface AssistantRequest {
  session_id: string;
  dealer_id: number;
  message: string;
}

export interface AssistantResponse {
  reply: string;
  cited_skus: string[];
  tool_calls: AssistantToolCall[];
  actions: AssistantAction[];
}

export interface ForecastPoint {
  week_start: string;
  forecast_units: number;
}

export interface ForecastResponse {
  sku: string;
  forecast: ForecastPoint[];
}

export interface ReorderSuggestion {
  sku: string;
  current_stock: number;
  lead_time_weeks: number;
  lead_time_demand: number;
  safety_stock: number;
  reorder_point: number;
  reorder_qty: number;
}

export interface ReorderSuggestionsResponse {
  results: ReorderSuggestion[];
}

export interface RejectedSupplierItem {
  supplier_sku: string;
  reason: string;
}

export interface SupplierSyncResponse {
  created: number;
  updated: number;
  unchanged: number;
  rejected: RejectedSupplierItem[];
  pages_fetched: number;
  requests_made: number;
}

export interface HealthResponse {
  status: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiErrorDetail {
  sku?: string;
  requested?: number;
  available?: number;
  field?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[] | string[];
  };
}

export interface ProductFilters {
  search?: string;
  category?: string;
  vehicle?: string;
  page?: number;
  page_size?: number;
}

export interface OrderFilters {
  dealer_id?: number;
  status?: OrderStatus | '';
  page?: number;
  page_size?: number;
}

export interface DealerFilters {
  page?: number;
  page_size?: number;
}

