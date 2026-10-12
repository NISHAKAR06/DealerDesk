import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ApiErrorShape, OrderStatus } from '@/types/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '—';
  try {
    const date = parseISO(isoString);
    return format(date, 'dd MMM yyyy, hh:mm a');
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString: string | undefined | null): string {
  if (!isoString) return '—';
  try {
    const date = parseISO(isoString);
    return format(date, 'dd MMM yyyy');
  } catch {
    return isoString;
  }
}

export function getStockStatus(stock: number): {
  label: string;
  variant: 'healthy' | 'low' | 'out';
  badgeClass: string;
} {
  if (stock <= 0) {
    return {
      label: 'Out of Stock',
      variant: 'out',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }
  if (stock <= 20) {
    return {
      label: `Low Stock (${stock})`,
      variant: 'low',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: `In Stock (${stock})`,
    variant: 'healthy',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
}

export function getOrderStatusConfig(status: OrderStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'DRAFT':
      return {
        label: 'Draft',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      };
    case 'CONFIRMED':
      return {
        label: 'Confirmed',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'DISPATCHED':
      return {
        label: 'Dispatched',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'DELIVERED':
      return {
        label: 'Delivered',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'CANCELLED':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    default:
      return {
        label: status,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      };
  }
}

export interface ParsedApiError {
  code: string;
  message: string;
  details: unknown[];
  status?: number;
}

export function parseApiError(error: unknown): ParsedApiError {
  if (!error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
      details: [],
    };
  }

  // Check if Axios error with response data
  const axiosErr = error as {
    response?: {
      status?: number;
      data?: ApiErrorShape | unknown;
    };
    code?: string;
    message?: string;
  };

  if (axiosErr.response) {
    const status = axiosErr.response.status;
    const data = axiosErr.response.data as ApiErrorShape | undefined;

    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return {
        code: data.error.code || `HTTP_${status}`,
        message: data.error.message || `Request failed with status ${status}`,
        details: Array.isArray(data.error.details) ? data.error.details : [],
        status,
      };
    }

    if (status === 404) {
      return {
        code: 'NOT_FOUND',
        message: 'The requested resource or endpoint was not found on the backend server (404).',
        details: [],
        status,
      };
    }

    if (status === 502) {
      return {
        code: 'SUPPLIER_UNAVAILABLE',
        message: 'Supplier integration failed or mock supplier is unreachable (502).',
        details: [],
        status,
      };
    }

    return {
      code: `HTTP_${status}`,
      message: `Server returned error status ${status}.`,
      details: [],
      status,
    };
  }

  // Network error or backend down
  if (axiosErr.code === 'ERR_NETWORK' || axiosErr.message?.includes('Network Error')) {
    return {
      code: 'BACKEND_UNAVAILABLE',
      message: 'Backend server is unreachable. Ensure the Django server is running on http://127.0.0.1:8000.',
      details: [],
      status: 0,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'CLIENT_ERROR',
      message: error.message,
      details: [],
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
    details: [],
  };
}

