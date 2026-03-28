// Client type
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Invoice line item
export interface LineItem {
  id: string;
  service: string;
  description?: string;
  service_date?: string;
  provider: string;
  rate: number;
  quantity: number;
  amount: number;
}

// Invoice status enum
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';

// Payment method enum
export type PaymentMethod = 'stripe' | 'venmo' | 'zelle' | 'other';

// Workspace type (returned by portal API)
export interface Workspace {
  id: string;
  user_id: string;
  business_name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  venmo_handle?: string;
  zelle_phone?: string;
  brand_color?: string;
  logo_url?: string;
}

// Invoice type
export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  client?: Client;
  clients?: { name: string; email: string; phone?: string; address?: string; city?: string; state?: string; zip?: string } | null;
  client_name?: string;
  client_email?: string;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: InvoiceStatus;
  payment_method?: PaymentMethod;
  due_date: string;
  paid_date?: string;
  notes?: string;
  internal_notes?: string;
  portal_token: string;
  stripe_payment_intent_id?: string;
  reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  viewed_at?: string;
  workspace?: Workspace;
}

// Invoice timeline event
export interface TimelineEvent {
  id: string;
  invoice_id: string;
  event_type: 'created' | 'sent' | 'viewed' | 'paid' | 'reminder_sent' | 'overdue' | 'cancelled';
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// Bank statement
export interface BankStatement {
  id: string;
  filename: string;
  upload_date: string;
  file_url: string;
  file_type: 'pdf' | 'csv';
  parsed: boolean;
}

// Bank transaction (parsed from statement)
export interface BankTransaction {
  id: string;
  statement_id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  matched_invoice_id?: string;
  category?: string;
  created_at: string;
}

// Dashboard stats
export interface DashboardStats {
  total_outstanding: number;
  total_paid_this_month: number;
  total_overdue: number;
  invoices_count: number;
  clients_count: number;
}

export interface AppSettings {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  stripeApiKey: string;
  stripeConnectStatus: 'connected' | 'disconnected';
  venmoHandle: string;
  zellePhone: string;
  defaultPaymentTerms: string;
  defaultTaxRate: string;
  invoiceNumberPrefix: string;
  defaultNotes: string;
  paymentReminderEnabled: boolean;
  reminderDaysBefore: string;
  reminderDaysAfter: string;
  theme: 'light' | 'dark' | 'system';
  brandColor: string;
}

export interface AppData {
  clients: Client[];
  invoices: Invoice[];
  settings: AppSettings;
  statements: BankStatement[];
  transactions: BankTransaction[];
}
