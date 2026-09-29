/**
 * Cliente HTTP da API QR Placas
 */

import { User, Customer, QRCodeItem, QRCodeHistory, DashboardMetrics, AppSettings } from '../types';

const TOKEN_KEY = 'qr_placas_token';
const USER_KEY = 'qr_placas_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredAuth();
    if (!window.location.pathname.startsWith('/admin/login') && !window.location.pathname.startsWith('/q/')) {
      window.location.href = '/admin/login?expired=true';
    }
    throw new Error('Sessão expirada. Efetue login novamente.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Erro HTTP ${response.status}`);
  }

  return data;
}

export const api = {
  // Public
  getPublicConfig: () => request<{ baseUrl: string; appName: string }>('/api/public/config'),
  checkPublicCode: (code: string) => request<{ exists: boolean; code: string; status: string; title: string }>(`/api/public/qr/${code}`),

  // Auth
  login: (email: string, password: string) =>
    request<{ success: boolean; token: string; user: User }>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<{ user: User }>('/api/admin/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/api/admin/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  logout: () => request<{ success: boolean }>('/api/admin/auth/logout', { method: 'POST' }),

  // Dashboard
  getDashboard: () =>
    request<{
      metrics: DashboardMetrics;
      recentChanges: QRCodeHistory[];
      recentCustomers: Customer[];
      recentQRCodes: QRCodeItem[];
    }>('/api/admin/dashboard'),

  // Customers
  getCustomers: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    return request<{ customers: Customer[] }>(`/api/admin/customers?${query.toString()}`);
  },
  getCustomer: (id: string) =>
    request<{ customer: Customer; qrCodes: QRCodeItem[] }>(`/api/admin/customers/${id}`),
  createCustomer: (data: { name: string; phone?: string; email?: string; notes?: string; status?: string }) =>
    request<{ customer: Customer }>('/api/admin/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: string, data: { name: string; phone?: string; email?: string; notes?: string; status?: string }) =>
    request<{ customer: Customer }>(`/api/admin/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  setCustomerStatus: (id: string, status: 'ativo' | 'arquivado' | 'desativado') =>
    request<{ success: boolean }>(`/api/admin/customers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteCustomer: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/customers/${id}`, {
      method: 'DELETE',
    }),

  // QR Codes
  getQRCodes: (params?: { search?: string; status?: string; customer_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    if (params?.customer_id) query.set('customer_id', params.customer_id);
    return request<{ qrCodes: QRCodeItem[] }>(`/api/admin/qr-codes?${query.toString()}`);
  },
  getQRCode: (id: string) =>
    request<{ qrCode: QRCodeItem; history: QRCodeHistory[] }>(`/api/admin/qr-codes/${id}`),
  createQRCode: (data: { customer_id: string; title?: string; destination_url: string; status?: string }) =>
    request<{ qrCode: QRCodeItem }>('/api/admin/qr-codes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateQRCodeMeta: (id: string, data: { title?: string; customer_id?: string }) =>
    request<{ qrCode: QRCodeItem }>(`/api/admin/qr-codes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changeDestination: (id: string, new_destination_url: string, reason?: string) =>
    request<{ success: boolean; message: string; qrCode: QRCodeItem }>(`/api/admin/qr-codes/${id}/destination`, {
      method: 'PATCH',
      body: JSON.stringify({ new_destination_url, reason }),
    }),
  setQRCodeStatus: (id: string, status: 'ativo' | 'desativado') =>
    request<{ success: boolean; message: string }>(`/api/admin/qr-codes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getQRCodeHistory: (id: string) =>
    request<{ qrCode: QRCodeItem; history: QRCodeHistory[] }>(`/api/admin/qr-codes/${id}/history`),
  deleteQRCode: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/qr-codes/${id}`, {
      method: 'DELETE',
    }),

  // Settings & Backup
  getSettings: () => request<{ settings: AppSettings; detectedOrigin: string }>('/api/admin/settings'),
  updateSettings: (settings: { custom_domain?: string; redirect_type?: string }) =>
    request<{ success: boolean; message: string }>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  importBackup: (data: any) =>
    request<{ success: boolean; message: string }>('/api/admin/backup/import', {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),
};
