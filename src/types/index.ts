export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: 'ativo' | 'arquivado' | 'desativado';
  created_at: string;
  updated_at: string;
  qr_code_count?: number;
}

export interface QRCodeItem {
  id: string;
  code: string; // Ex: A7K92X (permanente)
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  title: string | null;
  destination_url: string;
  status: 'ativo' | 'desativado';
  scan_count: number;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QRCodeHistory {
  id: string;
  qr_code_id: string;
  old_destination_url: string;
  new_destination_url: string;
  changed_by: string;
  changed_at: string;
  reason: string | null;
  qr_code?: string;
  qr_title?: string;
  customer_name?: string;
}

export interface DashboardMetrics {
  totalCustomers: number;
  totalQRCodes: number;
  activeQRCodes: number;
  inactiveQRCodes: number;
  totalScans: number;
}

export interface AppSettings {
  custom_domain?: string;
  redirect_type?: string;
  [key: string]: string | undefined;
}
