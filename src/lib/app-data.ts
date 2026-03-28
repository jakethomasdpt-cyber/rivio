import type { AppData, AppSettings, BankStatement, BankTransaction, Client, Invoice } from '@/types';

export const APP_DATA_KEY = 'pt365-app-data-v2';

export const defaultSettings: AppSettings = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  stripeApiKey: '',
  stripeConnectStatus: 'disconnected',
  venmoHandle: '',
  zellePhone: '',
  defaultPaymentTerms: 'net30',
  defaultTaxRate: '0',
  invoiceNumberPrefix: 'INV',
  defaultNotes: '',
  paymentReminderEnabled: false,
  reminderDaysBefore: '3',
  reminderDaysAfter: '3',
  theme: 'system',
  brandColor: '#2563EB',
};

export const defaultClients: Client[] = [];

export const defaultInvoices: Invoice[] = [];

export const defaultStatements: BankStatement[] = [];

export const defaultTransactions: BankTransaction[] = [];

export const defaultAppData: AppData = {
  clients: defaultClients,
  invoices: defaultInvoices,
  settings: defaultSettings,
  statements: defaultStatements,
  transactions: defaultTransactions,
};

export function createInitialAppData(): AppData {
  return structuredClone(defaultAppData);
}
